import { coreRepository } from "../../../../shared/github/owner-contributions.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Task close lifecycle — deferred dispatch (lease/quota), token budgets, the
 * single-close `finalizeTask` mutex, the executable verify gate, plan-step
 * mirroring and the leader wake-up nudge.
 *
 * These pieces are mutually recursive (a close dispatches the next deferred
 * task; a budget kill closes a task; the verify gate re-enters via the chat's
 * finish event), so they live together to keep the in-process state
 * (pendingDispatch FIFO, finalizeLocks) single-owned and cycle-free.
 */

import { runWithExecutor, getContextUser } from "../../../../shared/executor/context.js";
import type { SessionUser } from "../../../../shared/types/index.js";
import { liveVoiceSession } from "../realtime-state.js";
import { conversationsRepository } from "../../repositories/conversations.repository.js";
import { env } from "../../../../config/env.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { eventBus, Events } from "../../../../shared/events/index.js";
import { agentRunRegistry } from "../agent-run-registry.js";
import { cliJobTracker } from "../cli-job-tracker.service.js";
import { teamIsolationService } from "../team-isolation.service.js";
import { teamVerifyService } from "../team-verify.service.js";
import { projectsRepository } from "../../repositories/projects.repository.js";
import { teamTasksRepository } from "../../repositories/team-tasks.repository.js";
import { agentQueueRepository } from "../../repositories/agent-queue.repository.js";
import { usageRepository } from "../../repositories/usage.repository.js";
import {
  clampResultSummary,
  isTerminalTaskStatus,
  type TeamTask,
  type TeamTaskStatus,
} from "../../models/team-task.types.js";
import { emitTaskUpdate, injectTaskUpdate } from "./task-events.js";
import { pingWaiters, hasWaiters } from "./waiters.js";
import { workerRunStarted, workerRunEnded, hasWorkerSlot } from "./worker-quota.js";
import { isInterruptionPlaceholder, TASK_INTERRUPTED_ERROR } from "./interruption.js";

const log = createModuleLogger("assistant-team-tasks");

// ── Despacho diferido (lease ocupado / cupo lleno) ──────────────────────────
//
// El turno inicial de una tarea diferida vive PERSISTIDO en agent-queue.json
// (recoverServerRuns lo re-drena tras un reinicio); esta FIFO in-process solo
// ordena el despacho dentro de la vida del proceso (best-effort documentado).

interface PendingDispatch {
  executor: Executor;
  taskId: string;
  workerConversationId: string;
  leasePath?: string;
  userId?: string | null;
  user?: SessionUser | null;
}

const pendingDispatch: PendingDispatch[] = [];

/** Push a deferred task onto the FIFO (assignTask, when lease/quota is full). */
export function deferDispatch(item: PendingDispatch): void {
  if (pendingDispatch.some(p => p.taskId === item.taskId && p.executor.target.id === item.executor.target.id)) return;
  pendingDispatch.push({ ...item, user: item.user ?? getContextUser() });
  void dispatchNext().catch(err => log.warn({ err: String(err) }, "deferred dispatch failed"));
}

/** Suma el gasto (ledger) de las tareas de un plan. Best-effort del caller. */
async function planSpentTokens(executor: Executor, leaderConversationId: string, planId: string): Promise<number> {
  const tasks = await teamTasksRepository.listForLeaderConversation(executor, leaderConversationId);
  const convIds = [...new Set(tasks.filter((t) => t.planId === planId).map((t) => t.workerConversationId))];
  if (convIds.length === 0) return 0;
  const totals = await usageRepository.totalsForConversations(executor, convIds);
  return [...totals.values()].reduce((s, u) => s + u.totalTokens, 0);
}

/** Despacha el primer elemento elegible de la FIFO (hueco de cupo + lease). */
async function dispatchNext(): Promise<void> {
  for (let i = 0; i < pendingDispatch.length; i++) {
    const item = pendingDispatch[i]!;
    if (!hasWorkerSlot(item.userId)) continue;
    if (item.leasePath && !teamIsolationService.tryAcquireLease(item.leasePath, item.taskId, item.executor.target.id)) continue;
    pendingDispatch.splice(i, 1); i--;
    workerRunStarted(item.userId, item.workerConversationId);
    await runWithExecutor(item.executor, async () => {
    try {
      const task = await teamTasksRepository.getTask(item.executor, item.taskId);
      if (!task?.id || isTerminalTaskStatus(task.status)) {
        workerRunEnded(item.userId, item.workerConversationId);
        // Cancelada mientras esperaba — suelta el lease y sigue con la FIFO.
        if (item.leasePath) teamIsolationService.releaseLease(item.leasePath, item.taskId, item.executor.target.id);
        return;
      }
      // Presupuesto del plan al DESPACHAR una diferida: pudo agotarse mientras
      // esperaba cupo (el enforcement periódico solo mata tareas ya activas).
      const planBudget = env.ASSISTANT_TEAM_PLAN_TOKEN_BUDGET;
      if (task.planId && planBudget > 0) {
        const spent = await planSpentTokens(item.executor, task.leaderConversationId, task.planId).catch(() => 0);
        if (spent >= planBudget) {
          workerRunEnded(item.userId, item.workerConversationId);
          if (item.leasePath) teamIsolationService.releaseLease(item.leasePath, item.taskId, item.executor.target.id);
          await finalizeTask(
            item.executor,
            item.taskId,
            {
              status: "failed",
              error: `Presupuesto del plan agotado antes de despachar (${spent} de ${planBudget} tokens; plan ${task.planId}).`,
            },
            { skipVerify: true },
          ).catch((err) => log.warn({ err: (err as Error).message, taskId: item.taskId }, "deferred budget-fail close failed"));
          return;
        }
      }
      const updated = await teamTasksRepository.updateTask(item.executor, item.taskId, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
      if (updated) emitTaskUpdate(updated, "dispatched", item.executor.target.id);
      eventBus.emit(Events.AI_TEAM_TASK_DISPATCH, {
        executor: item.executor,
        taskId: item.taskId,
        workerConversationId: item.workerConversationId,
      });
    } catch (err) {
      workerRunEnded(item.userId, item.workerConversationId);
      if (item.leasePath) teamIsolationService.releaseLease(item.leasePath, item.taskId, item.executor.target.id);
      log.warn({ err: (err as Error).message, taskId: item.taskId }, "team task deferred dispatch failed");
    }
    }, item.user?.userId ?? (item.userId ? Number(item.userId) : undefined), item.user ?? undefined);
    return;
  }
}

/** Saca una tarea de la FIFO (cancelación mientras esperaba). */
export function removeFromDispatchQueue(taskId: string): void {
  const idx = pendingDispatch.findIndex((p) => p.taskId === taskId);
  if (idx >= 0) pendingDispatch.splice(idx, 1);
}

// ── Presupuestos de tokens (por tarea y por plan) ───────────────────────────

/** Mata el run del worker y cierra la tarea por presupuesto excedido. */
async function killForBudget(executor: Executor, task: TeamTask, message: string): Promise<void> {
  const taskId = task.id ?? "";
  agentRunRegistry.stop(task.workerConversationId, executor.target.id);
  cliJobTracker.killForConversation(task.workerConversationId, executor.target.id);
  removeFromDispatchQueue(taskId);
  await agentQueueRepository.clearFor(executor, task.workerConversationId).catch(() => undefined);
  await finalizeTask(executor, taskId, { status: "failed", error: message }, { skipVerify: true });
}

/**
 * Enforce token budgets over a leader board snapshot: per-task
 * (`task.budgetTokens`) and per-plan (env ASSISTANT_TEAM_PLAN_TOKEN_BUDGET,
 * suma de TODAS las tareas del plan). UNA lectura del ledger por invocación.
 * Best-effort: cualquier fallo de lectura se ignora (nunca rompe collect).
 */
export async function enforceBudgets(executor: Executor, tasks: TeamTask[]): Promise<void> {
  const planBudget = env.ASSISTANT_TEAM_PLAN_TOKEN_BUDGET > 0 ? env.ASSISTANT_TEAM_PLAN_TOKEN_BUDGET : null;
  const live = tasks.filter((t) => t.id && (t.status === "running" || t.status === "pending"));
  const withTaskBudget = live.filter((t) => (t.budgetTokens ?? 0) > 0);
  if (withTaskBudget.length === 0 && !planBudget) return;
  const convIds = [...new Set(tasks.map((t) => t.workerConversationId))];
  let totals: Awaited<ReturnType<typeof usageRepository.totalsForConversations>>;
  try {
    totals = await usageRepository.totalsForConversations(executor, convIds);
  } catch {
    return;
  }
  for (const t of withTaskBudget) {
    const u = totals.get(t.workerConversationId);
    if (!u || !t.budgetTokens || u.totalTokens < t.budgetTokens) continue;
    await killForBudget(
      executor,
      t,
      `Presupuesto de tokens de la tarea excedido (${u.totalTokens}${u.estimated ? " estimados" : ""} de ${t.budgetTokens}).`,
    ).catch((err) => log.warn({ err: (err as Error).message, taskId: t.id }, "budget kill failed"));
  }
  if (!planBudget) return;
  const byPlan = new Map<string, TeamTask[]>();
  for (const t of tasks) {
    if (!t.planId) continue;
    const arr = byPlan.get(t.planId) ?? [];
    arr.push(t);
    byPlan.set(t.planId, arr);
  }
  for (const [planId, planTasks] of byPlan) {
    const spent = planTasks.reduce((s, t) => s + (totals.get(t.workerConversationId)?.totalTokens ?? 0), 0);
    if (spent < planBudget) continue;
    for (const t of planTasks.filter((x) => x.id && !isTerminalTaskStatus(x.status))) {
      await killForBudget(
        executor,
        t,
        `Presupuesto de tokens del plan excedido (${spent} de ${planBudget}; plan ${planId}).`,
      ).catch((err) => log.warn({ err: (err as Error).message, taskId: t.id }, "plan budget kill failed"));
    }
  }
}

/** Sweep de presupuestos sobre los runs vivos del registry (líderes sin
 *  collect esperando). Dedupe por conversación de líder por pasada. */
export async function sweepBudgets(): Promise<void> {
  const seenLeaders = new Set<string>();
  for (const run of agentRunRegistry.activeRuns()) {
    const ctx = agentRunRegistry.runContext(run.key, run.targetId);
    if (!ctx?.executor) continue;
    const task = await teamTasksRepository.findByWorkerConversation(ctx.executor, run.key).catch(() => null);
    const leaderKey = JSON.stringify([run.targetId, task?.leaderConversationId]);
    if (!task?.id || isTerminalTaskStatus(task.status) || seenLeaders.has(leaderKey)) continue;
    seenLeaders.add(leaderKey);
    const boardTasks = await teamTasksRepository
      .listForLeaderConversation(ctx.executor, task.leaderConversationId)
      .catch(() => [] as TeamTask[]);
    await enforceBudgets(ctx.executor, boardTasks).catch(() => undefined);
  }
}

// ── Cierre único de tarea (finalizeTask) ────────────────────────────────────

type TaskOutcome = {
  status: Extract<TeamTaskStatus, "done" | "failed" | "canceled">;
  resultSummary?: string;
  error?: string;
};

interface FinalizeOpts {
  /** Salta la verificación ejecutable (cancel/reconciliación). */
  skipVerify?: boolean;
}

/** Serializa los cierres concurrentes del MISMO task (onDone del run vs el
 *  listener AI_CHAT_FINISHED disparan a la vez al terminar el mismo run; la
 *  idempotencia del repo evitaba el doble patch, pero los side-effects de
 *  cierre — captura de artefactos, cleanup del worktree — no son idempotentes
 *  gratis). */
const finalizeLocks = new Map<string, Promise<TeamTask | null>>();

export async function finalizeTask(
  executor: Executor,
  taskId: string,
  outcome: TaskOutcome,
  opts: FinalizeOpts = {},
): Promise<TeamTask | null> {
  const prev = finalizeLocks.get(taskId) ?? Promise.resolve(null);
  const next = prev.catch(() => null).then(() => finalizeTaskInner(executor, taskId, outcome, opts));
  finalizeLocks.set(taskId, next);
  try {
    return await next;
  } finally {
    if (finalizeLocks.get(taskId) === next) finalizeLocks.delete(taskId);
  }
}

/**
 * Verify gate: corre la receta ANTES de cerrar como done. Veredictos:
 *  - "passed"  → sigue el cierre done normal (artefactos incluyen los fixes).
 *  - "retry"   → la tarea SIGUE running; se emitió el turno de corrección.
 *  - "failed"  → agotó intentos: cerrar failed con el log.
 */
async function runVerifyGate(
  executor: Executor,
  task: TeamTask,
): Promise<{ verdict: "passed" | "retry" } | { verdict: "failed"; error: string; logTail: string }> {
  const taskId = task.id ?? "";
  const commands = task.verifyCommands ?? [];
  const maxAttempts = env.ASSISTANT_TEAM_VERIFY_MAX_RETRIES + 1; // 1º intento + reintentos
  const attempt = (task.verify?.attempts ?? 0) + 1;
  if (attempt > maxAttempts) {
    return {
      verdict: "failed",
      error: `Verificación fallida tras ${maxAttempts} intento(s).`,
      logTail: task.verify?.logTail ?? "",
    };
  }
  const project = task.projectId ? await projectsRepository.get(executor, task.projectId).catch(() => null) : null;
  const cwd = task.isolation?.cwd ?? task.isolation?.worktreePath ?? project?.path ?? "";
  if (!cwd) {
    await teamTasksRepository
      .updateTask(executor, taskId, { verify: { state: "skipped", attempts: attempt - 1 } })
      .catch(() => undefined);
    return { verdict: "passed" };
  }
  const running = await teamTasksRepository.updateTask(executor, taskId, {
    verify: { state: "running", attempts: attempt, startedAt: new Date().toISOString() },
  });
  if (running) injectTaskUpdate(running, executor.target.id);
  const res = await teamVerifyService.run(executor, {
    commands,
    cwd,
    ...(project?.verify?.timeoutMs ? { cmdTimeoutMs: project.verify.timeoutMs } : {}),
  });
  if (res.ok) {
    const passed = await teamTasksRepository.updateTask(executor, taskId, {
      verify: { state: "passed", attempts: attempt },
    });
    if (passed) injectTaskUpdate(passed, executor.target.id);
    return { verdict: "passed" };
  }
  const failedPatch = await teamTasksRepository.updateTask(executor, taskId, {
    verify: {
      state: "failed",
      attempts: attempt,
      ...(res.failedCommand ? { failedCommand: res.failedCommand } : {}),
      ...(res.exitCode !== undefined ? { exitCode: res.exitCode } : {}),
      logTail: res.logTail,
    },
  });
  if (failedPatch) injectTaskUpdate(failedPatch, executor.target.id);
  if (attempt >= maxAttempts) {
    return {
      verdict: "failed",
      error: `Verificación fallida tras ${attempt} intento(s): ${res.failedCommand ?? "?"} (exit ${res.exitCode ?? "?"}).`,
      logTail: res.logTail,
    };
  }
  // Releer: si la cancelaron mientras verificaba, no encolar el retry.
  const fresh = await teamTasksRepository.getTask(executor, taskId).catch(() => null);
  if (!fresh || isTerminalTaskStatus(fresh.status)) return { verdict: "retry" };
  try {
    eventBus.emit(Events.AI_TEAM_TASK_VERIFY_RETRY, {
      executor,
      taskId,
      workerConversationId: task.workerConversationId,
      workerAgentId: task.workerAgentId,
      projectId: task.projectId ?? null,
      forcedCwd: task.isolation?.cwd ?? null,
      userId: task.userId ?? null,
      user: task.user ?? null,
      failedCommand: res.failedCommand ?? "",
      exitCode: res.exitCode,
      logTail: res.logTail.slice(-3000),
      attempt,
      maxAttempts,
    });
  } catch (err) {
    log.warn({ err: (err as Error).message, taskId }, "AI_TEAM_TASK_VERIFY_RETRY emit failed");
  }
  return { verdict: "retry" };
}

async function finalizeTaskInner(
  executor: Executor,
  taskId: string,
  outcome: TaskOutcome,
  opts: FinalizeOpts,
): Promise<TeamTask | null> {
  const current = await teamTasksRepository.getTask(executor, taskId);
  if (!current?.id) return null;
  // Cierre duplicado (el otro camino ganó dentro del mutex) → no-op.
  if (isTerminalTaskStatus(current.status)) return current;

  workerRunEnded(current.userId ?? undefined, current.workerConversationId);
  if (outcome.status === "done" && current.leaderAgentId.startsWith("realtime:")) {
    const { items } = await conversationsRepository.messages(executor, current.workerConversationId, { limit: 2 });
    const last = items.at(-1);
    if (last?.role === "assistant" && last.ask?.length) {
      const paused = await teamTasksRepository.updateTask(executor, taskId, {
        status: "pending", pendingPermission: true, resultSummary: last.content.slice(0, 4000),
      });
      if (paused) emitTaskUpdate(paused, "awaiting-answer", executor.target.id);
      await dispatchNext();
      return paused;
    }
  }

  // Un "done" cuyo resultado es el placeholder de interrupción NO es un éxito:
  // el run murió con el reinicio y la recuperación solo dejó esa nota. Guardia
  // central (cubre el listener AI_CHAT_FINISHED y la reconciliación, ambos
  // toman "el último assistant" como resultSummary) — antes del verify gate
  // para no verificar un trabajo que nunca terminó.
  if (outcome.status === "done" && isInterruptionPlaceholder(outcome.resultSummary)) {
    outcome = {
      status: "failed",
      error: TASK_INTERRUPTED_ERROR,
      ...(outcome.resultSummary ? { resultSummary: outcome.resultSummary } : {}),
    };
  }

  // Verify gate: solo cierres "done" con receta. En retry la tarea SIGUE
  // running (el turno de corrección volverá a entrar por AI_CHAT_FINISHED).
  if (outcome.status === "done" && !opts.skipVerify && (current.verifyCommands?.length ?? 0) > 0) {
    const gate = await runVerifyGate(executor, current);
    if (gate.verdict === "retry") return null;
    if (gate.verdict === "failed") {
      outcome = {
        status: "failed",
        error: gate.error,
        resultSummary:
          (outcome.resultSummary ? outcome.resultSummary + "\n\n" : "") +
          `[VERIFICACIÓN FALLIDA]\n${gate.logTail}`.trim(),
      };
    }
  }

  // Artefactos + limpieza del aislamiento ANTES del patch terminal (así el
  // update terminal ya lleva el diff/branch y la UI lo pinta de una).
  const patch: Parameters<typeof teamTasksRepository.updateTask>[2] = {
    status: outcome.status,
    ...(outcome.resultSummary !== undefined ? { resultSummary: clampResultSummary(outcome.resultSummary) } : {}),
    ...(outcome.error !== undefined ? { error: outcome.error.slice(0, 500) } : {}),
    pendingPermission: false,
    finishedAt: new Date().toISOString(),
  };
  const iso = current.isolation;
  if (iso?.mode === "worktree" && !iso.cleaned) {
    try {
      const { artifacts, headSha } = await teamIsolationService.captureArtifacts(executor, iso);
      patch.artifacts = { ...(current.artifacts ?? {}), ...artifacts };
      patch.isolation = { ...iso, cleaned: !(executor.target.id==="local"&&iso.repoRoot===coreRepository()), ...(headSha ? { headSha } : {}) };
    } catch (err) {
      log.warn({ err: (err as Error).message, taskId }, "team task artifact capture failed");
      patch.isolation = { ...iso, cleaned: true };
    }
    // done/failed conservan la rama (integrate/forense); canceled la borra.
    if(!(executor.target.id==="local"&&iso.repoRoot===coreRepository()))await teamIsolationService
      .cleanup(executor, iso, { deleteBranch: outcome.status === "canceled" })
      .catch((err) => log.warn({ err: (err as Error).message, taskId }, "team task worktree cleanup failed"));
  } else if (iso?.mode === "lease" && iso.leasePath) {
    teamIsolationService.releaseLease(iso.leasePath, taskId, executor.target.id);
  }

  // Tokens finales de la tarea (para el board/resumen de costes). Best-effort.
  try {
    const totals = await usageRepository.totalsForConversations(executor, [current.workerConversationId]);
    const u = totals.get(current.workerConversationId);
    if (u && u.totalTokens > 0) {
      // Chequeo TERMINAL de presupuesto: el uso CLI se registra a granel al
      // cierre del turno, así que los sweeps periódicos pueden no ver el
      // exceso a tiempo (una tarea con budget 10k cerró "done" con 71k). No se
      // reclasifica done→failed (el trabajo se hizo): se ANOTA el exceso en el
      // board y en el resultSummary; los chequeos pre-assign/dispatch del plan
      // ya lo cuentan vía el ledger.
      const overBudget = (current.budgetTokens ?? 0) > 0 && u.totalTokens > (current.budgetTokens ?? 0);
      patch.artifacts = {
        ...(patch.artifacts ?? current.artifacts ?? {}),
        tokens: {
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          totalTokens: u.totalTokens,
          estimated: u.estimated,
          ...(overBudget ? { overBudget: true } : {}),
        },
      };
      if (overBudget) {
        const note = `[PRESUPUESTO EXCEDIDO: ${u.totalTokens}${u.estimated ? " estimados" : ""} de ${current.budgetTokens} tokens]`;
        const base = patch.resultSummary ?? current.resultSummary ?? "";
        patch.resultSummary = clampResultSummary(base ? `${base}\n\n${note}` : note);
      }
    }
  } catch {
    /* el resumen de costes REST sigue disponible */
  }

  const updated = await teamTasksRepository.updateTask(executor, taskId, patch);
  if (!updated) return null;
  injectTaskUpdate(updated, executor.target.id);
  // Capture BEFORE pinging: waitForPing removes its waiter synchronously when
  // pinged, so checking after would misread "a collect was waiting" as "nobody
  // is waiting" and fire a spurious nudge alongside the collect.
  const hadWaiters = hasWaiters(updated.leaderConversationId);
  pingWaiters(updated.leaderConversationId);
  await updatePlanFromTask(executor, updated).catch((err) =>
    log.warn({ err: (err as Error).message }, "team plan step update failed"),
  );
  if (!hadWaiters) {
    await maybeNudgeLeader(executor, updated.leaderConversationId).catch((err) =>
      log.warn({ err: (err as Error).message }, "team leader nudge check failed"),
    );
  }
  // Un cierre libera cupo/lease → intenta despachar la siguiente diferida.
  // `dispatchNext` guarda su cuerpo, pero los guards síncronos del bucle
  // (hasWorkerSlot/tryAcquireLease) quedan fuera de ese try: si lanzan, esta
  // promesa se rechaza. Sin el .catch sería un unhandledRejection (posible
  // crash del proceso) por un cierre de tarea totalmente correcto.
  void dispatchNext().catch((err) =>
    log.error({ err: (err as Error).message, taskId }, "dispatchNext failed"),
  );
  return updated;
}

/**
 * Mirror a closed task into its plan step (team.plan) and, when every step is
 * terminal, close the plan and emit AI_TEAM_PLAN_COMPLETED (notification).
 */
async function updatePlanFromTask(executor: Executor, task: TeamTask): Promise<void> {
  if (!task.planId || typeof task.stepIndex !== "number") return;
  const plan = await teamTasksRepository.getPlan(executor, task.planId);
  if (!plan?.id || plan.status !== "active") return;
  const steps = plan.steps.map((s, i) =>
    i === task.stepIndex ? { ...s, status: task.status === "done" ? ("done" as const) : ("failed" as const) } : s,
  );
  const allTerminal = steps.every((s) => s.status === "done" || s.status === "failed");
  const status = allTerminal ? (steps.some((s) => s.status === "failed") ? "failed" : "completed") : "active";
  await teamTasksRepository.patchPlan(executor, plan.id, { steps, status });
  if (allTerminal) {
    try {
      eventBus.emit(Events.AI_TEAM_PLAN_COMPLETED, {
        executor,
        leaderConversationId: plan.leaderConversationId,
        planId: plan.id,
        title: plan.title,
        status,
        userId: task.userId ?? undefined,
      });
    } catch (err) {
      log.warn({ err: (err as Error).message }, "AI_TEAM_PLAN_COMPLETED emit failed");
    }
  }
}

/**
 * Wake-up check (Fase "híbrida", camino 2): when every un-collected, un-nudged
 * task of a leader conversation is terminal AND no team.collect is waiting AND
 * the leader has no live run, enqueue-nudge the leader via
 * AI_TEAM_LEADER_NUDGE (agent.controller listens and drains the queue). Tasks
 * are marked `nudged` BEFORE emitting so a model that ignores the nudge can't
 * loop the wake-up forever.
 */
export async function maybeNudgeLeader(executor: Executor, leaderConversationId: string): Promise<void> {
  if (liveVoiceSession(leaderConversationId, executor.target.id)) return;
  if (hasWaiters(leaderConversationId)) return; // a collect will grab them
  if (agentRunRegistry.isActive(leaderConversationId, executor.target.id)) return; // leader mid-turn
  const tasks = await teamTasksRepository.listForLeaderConversation(executor, leaderConversationId);
  const candidates = tasks.filter((t) => t.id && !t.collected && !t.nudged);
  if (candidates.length === 0) return;
  // Voice coordinators have no persisted agent identity; their task cards remain authoritative.
  if (candidates.every(t => t.leaderAgentId.startsWith("realtime:"))) return;
  if (candidates.some((t) => !isTerminalTaskStatus(t.status))) return; // team still working
  for (const t of candidates) {
    await teamTasksRepository.updateTask(executor, t.id ?? "", { nudged: true }).catch(() => undefined);
  }
  const sample = candidates[0]!;
  try {
    eventBus.emit(Events.AI_TEAM_LEADER_NUDGE, {
      executor,
      leaderConversationId,
      leaderAgentId: sample.leaderAgentId,
      userId: sample.userId ?? undefined,
      user: sample.user ?? undefined,
      taskIds: candidates.map((t) => t.id ?? ""),
    });
  } catch (err) {
    log.warn({ err: (err as Error).message }, "AI_TEAM_LEADER_NUDGE emit failed");
  }
}

/** Test helper — wipe the in-process dispatch/finalize state. */
export function resetLifecycleState(): void {
  pendingDispatch.length = 0;
  finalizeLocks.clear();
}
