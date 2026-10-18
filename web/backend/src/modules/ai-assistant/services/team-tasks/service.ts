import { enqueueAgentTurn } from "../queued-turn-admission.js";
import { compactAgentInput, encodeCoordination, prepareCoordinationTask } from "../../models/agent-envelope.js";
import { visibleSummary } from "../../models/visible-summary.js";
import { admitAgentWork, resolveConversationBinding } from "../agent-context.service.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `teamTasksService` — the public façade object behind the leader→workers
 * delegation cycle: assign/plan/collect/integrate/diff/cancel plus the lazy
 * reconciliation of orphaned tasks and the belt-and-braces close wiring.
 *
 * The in-process state (worker quota, waiters, dispatch FIFO, finalize locks)
 * and the close lifecycle live in sibling modules (./worker-quota, ./waiters,
 * ./lifecycle, ./task-events); this module composes them. The sidecar board
 * (team-tasks.repository) is the source of truth.
 */

import { env } from "../../../../config/env.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { getContextExecutor } from "../../../../shared/executor/index.js";
import type { SessionUser } from "../../../../shared/types/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { eventBus, Events } from "../../../../shared/events/index.js";
import { agentRunRegistry } from "../agent-run-registry.js";
import { cliJobTracker } from "../cli-job-tracker.service.js";
import { teamIsolationService, type PreparedIsolation } from "../team-isolation.service.js";
import { assistantConfigRepository } from "../../repositories/assistant-config.repository.js";
import { conversationsRepository } from "../../repositories/conversations.repository.js";
import { projectsRepository } from "../../repositories/projects.repository.js";
import { teamTasksRepository } from "../../repositories/team-tasks.repository.js";
import { agentQueueRepository } from "../../repositories/agent-queue.repository.js";
import { usageRepository } from "../../repositories/usage.repository.js";
import {
  isTerminalTaskStatus,
  type TeamTask,
} from "../../models/team-task.types.js";
import type { AssistantAgent } from "../../models/assistant-agent.types.js";
import { type RunAgentFn, createWorkerConversation, startWorkerRun } from "./worker-spawn.js";
import { hasWorkerSlot, resetWorkerQuota } from "./worker-quota.js";
import { preserveWorkerExecution } from "./worker-recovery.js";
import { waitForPing, pingWaiters } from "./waiters.js";
import { emitTaskUpdate, injectTaskUpdate } from "./task-events.js";
import { TASK_INTERRUPTED_ERROR } from "./interruption.js";
import { persistedWorkerOutcome } from "./persisted-outcome.js";
import { ensureExecutionRetryQueued } from "./execution-retry.js";
import type { ConversationMessage } from "../../repositories/conversations.repository.js";
import {
  finalizeTask,
  enforceBudgets,
  sweepBudgets,
  removeFromDispatchQueue,
  maybeNudgeLeader,
  deferDispatch,
  resetLifecycleState,
} from "./lifecycle.js";

const log = createModuleLogger("assistant-team-tasks");

/** A `running` task older than this with no live run/CLI job is reconciled
 *  from the persisted conversation (restart killed its in-process run). */
const STALE_RUNNING_MS = 3 * 60_000;

/** Re-check cadence while waiting, in case a ping is ever missed. */
const WAIT_POLL_MS = 30_000;

/** Hard cap of non-terminal tasks per leader conversation (board-enforced —
 *  the per-run tool counter can't cover the CLI channel, where every MCP call
 *  builds a fresh tool instance). */
const MAX_ACTIVE_TASKS_PER_CONVERSATION = 12;

export interface AssignTaskInput {
  executor: Executor;
  user?: SessionUser | undefined;
  userId?: string | undefined;
  leaderConversationId: string;
  leaderAgentId: string;
  worker: AssistantAgent;
  title: string;
  task: string;
  projectId: string | null;
  planId?: string | null;
  stepIndex?: number;
  depth: number;
  runAgent: RunAgentFn;
  /** Origen del panel del run del líder. Sin él se intenta el meta del líder
   *  (persistido por cada run vivo) — ver resolución en assignTask. */
  panelOrigin?: string;
  /** Receta de verificación ya saneada/autorizada (override del assign). */
  verifyCommands?: string[];
  /** Tope de tokens por tarea ya clampado (override del assign). */
  budgetTokens?: number;
  /** Serialize build/deploy tasks across projects on this target. */
  exclusiveBuild?: boolean;
}

let initialized = false;

export const teamTasksService = {
  /**
   * Wire the belt-and-braces close path. Called once from `registerAiModule`.
   * Closes tasks whose worker run finished WITHOUT running our spawn
   * `onComplete` (e.g. a CLI job recovered after a panel restart re-attached
   * with the recovery descriptor's own persistence).
   */
  init(): void {
    if (initialized) return;
    initialized = true;
    // Sweep de presupuestos: cubre a los líderes que terminaron su turno (sin
    // collect en espera) mientras sus workers siguen quemando tokens.
    if (env.ASSISTANT_TEAM_BUDGET_CHECK_MS > 0) {
      const timer = setInterval(() => {
        void sweepBudgets().catch(() => undefined);
      }, env.ASSISTANT_TEAM_BUDGET_CHECK_MS);
      timer.unref?.();
    }
    // Mirror pending approval on the board; the supervision listener delivers
    // the exact request to the authorized leader for a scoped decision.
    const onPermission = (pending: boolean) => (payload: { conversationId: string }) => {
      let executor: Executor | null = null;
      try {
        executor = getContextExecutor();
      } catch {
        return;
      }
      if (!executor) return;
      const exec = executor;
      void this.setPendingPermission(exec, payload.conversationId, pending).catch((err) =>
        log.warn({ err: (err as Error).message }, "team-tasks pendingPermission update failed"),
      );
    };
    eventBus.on(Events.AI_PERMISSION_REQUESTED, onPermission(true));
    eventBus.on(Events.AI_PERMISSION_RESOLVED, onPermission(false));
    eventBus.on(Events.AI_TURN_SETTLED, (payload: { conversationId: string; errored?: boolean; pending?: boolean; awaitingInput?: boolean }) => {
      // The registry emits inside the run's executor scope — capture it NOW
      // (fail-closed: no context executor → not a per-server run → skip).
      let executor: Executor | null = null;
      try {
        executor = getContextExecutor();
      } catch {
        return;
      }
      if (!executor) return;
      void (async () => {
        const task = await teamTasksRepository.findByWorkerConversation(executor, payload.conversationId);
        if (!task?.id || isTerminalTaskStatus(task.status)) return;
        // onComplete may already have started/queued a verification repair or
        // follow-up. This event belongs to the previous turn, not that work.
        if (agentRunRegistry.isActive(task.workerConversationId, executor.target.id)) return;
        if ((await agentQueueRepository.listFor(executor, task.workerConversationId)).length > 0) return;
        if (payload.errored) {
          const { items } = await conversationsRepository.messages(executor, task.workerConversationId, { limit: 1 });
          await finalizeTask(executor, task.id, { status: "failed", error: items.at(-1)?.error || "El agente terminó con error." }, { retryExecution: true });
          return;
        }
        if (payload.pending || payload.awaitingInput) return;
        // Our own onDone may still be about to close it — finalizeTask
        // serializes per-task and terminal states are idempotent, so a
        // duplicate close is a no-op.
        const { items } = await conversationsRepository.messages(executor, task.workerConversationId, { limit: 5 });
        const outcome = persistedWorkerOutcome(items);
        if (outcome === null) return;
        await finalizeTask(executor, task.id, outcome ?? { status: "failed", error: TASK_INTERRUPTED_ERROR });
      })()
        .then(async () => {
          // The finished chat may also BE a leader conversation whose last
          // pending task closed while its run was still streaming (the nudge
          // check inside closeTask saw an active run and skipped) — re-check
          // now that this run is over.
          await maybeNudgeLeader(executor, payload.conversationId);
        })
        .catch((err) => {
          log.warn({ err: (err as Error).message }, "team-tasks AI_TURN_SETTLED close failed");
        });
    });
  },

  /** Spawn a worker chat AND anchor a TeamTask on the board. */
  async assignTask(input: AssignTaskInput): Promise<TeamTask> {
    const binding = await resolveConversationBinding(input.executor, {
      conversationId: input.leaderConversationId,
      // Voice has a synthetic coordinator; its conversation remains authoritative.
      agentId: input.leaderAgentId.startsWith("realtime:") ? undefined : input.leaderAgentId,
      projectId: input.projectId,
    }, input.user);
    const leader = await admitAgentWork(input.executor, binding.agentId, binding.projectId, input.user);
    try {
      const worker = await admitAgentWork(input.executor, input.worker.id, leader.projectId, input.user);
      try { return await this.assignAdmittedTask({ ...input, worker: worker.agent ?? input.worker, projectId: worker.projectId }); }
      finally { worker.release(); }
    } finally { leader.release(); }
  },
  async assignAdmittedTask(input: AssignTaskInput): Promise<TeamTask> {
    const { executor, user, userId, leaderConversationId, leaderAgentId, worker, title, task, projectId, planId, stepIndex, depth, runAgent, verifyCommands, budgetTokens } = input;
    // Reject invalid/verbose author input before creating a chat or reserving work.
    let workText = prepareCoordinationTask(task);
    // Origen del panel para el canal MCP del worker: el explícito del caller o,
    // en su defecto, el meta del LÍDER (cada run vivo lo persiste ahí). Sin
    // esto los subordinados arrancan sin `servers.*`/`permissions.approve`.
    const panelOrigin =
      input.panelOrigin ??
      (await conversationsRepository
        .getMeta(executor, leaderConversationId)
        .then((m) => m?.panelOrigin)
        .catch(() => undefined));
    // GLOBAL cap per leader conversation (the per-run tool counter resets per
    // MCP call on the CLI channel, so the board itself must enforce it).
    const existing = await teamTasksRepository.listForLeaderConversation(executor, leaderConversationId);
    const active = existing.filter((t) => !isTerminalTaskStatus(t.status)).length;
    if (active >= MAX_ACTIVE_TASKS_PER_CONVERSATION) {
      throw new Error(
        `Límite de ${MAX_ACTIVE_TASKS_PER_CONVERSATION} tareas activas por conversación alcanzado; ` +
          "espera (team.collect) o cancela tareas antes de asignar más.",
      );
    }

    // Dedupe por paso de plan: en producción los reintentos del líder crearon
    // varias tarjetas del MISMO (planId, stepIndex) (vistas ×4/×3/×2) y el
    // checklist del plan se sobrescribía con el último cierre. Una tarea del
    // mismo paso aún ACTIVA se reutiliza — reconciliada primero, para que una
    // huérfana de reinicio no bloquee el reintento legítimo. Si solo quedan
    // cierres previos (failed/done), el reintento crea una tarea nueva y las
    // previas salen del ciclo collect/nudge (el modelo no tiene campo
    // "replaced"; collected+nudged es lo más cercano y evita que el líder las
    // re-reporte junto a la sustituta).
    if (planId && typeof stepIndex === "number") {
      const samePlanStep = existing.filter((t) => t.id && t.planId === planId && t.stepIndex === stepIndex);
      for (const dup of samePlanStep) {
        if (isTerminalTaskStatus(dup.status)) continue;
        const reconciled = await this.reconcileRunningTask(executor, dup).catch(() => null);
        const cur = reconciled ?? dup;
        if (!isTerminalTaskStatus(cur.status)) {
          log.info(
            { taskId: cur.id, planId, stepIndex },
            "team task assign reused existing active task for plan step",
          );
          return cur;
        }
      }
      for (const old of samePlanStep) {
        if (old.collected) continue;
        await teamTasksRepository
          .updateTask(executor, old.id ?? "", { collected: true, nudged: true })
          .catch(() => undefined);
      }
    }

    // Presupuesto del plan ANTES de crear la tarea: el enforcement periódico
    // (collect 30s / sweep 60s) es reactivo y el uso CLI se registra a granel
    // al cierre de turno, así que un plan puede reventar su tope entre
    // chequeos (visto: 2.4M sobre 1.5M). Aquí se corta la asignación de MÁS
    // trabajo con el ledger ya persistido. Best-effort: un fallo de lectura
    // del ledger no bloquea la asignación.
    const planBudget = env.ASSISTANT_TEAM_PLAN_TOKEN_BUDGET;
    if (planId && planBudget > 0) {
      const planConvIds = [...new Set(existing.filter((t) => t.planId === planId).map((t) => t.workerConversationId))];
      if (planConvIds.length > 0) {
        const spent = await usageRepository
          .totalsForConversations(executor, planConvIds)
          .then((m) => [...m.values()].reduce((s, u) => s + u.totalTokens, 0))
          .catch(() => 0);
        if (spent >= planBudget) {
          throw new Error(
            `Presupuesto del plan agotado (${spent} de ${planBudget} tokens; plan ${planId}); no se asignan más tareas. ` +
              "Cierra el plan sintetizando lo ya recogido, o amplía ASSISTANT_TEAM_PLAN_TOKEN_BUDGET.",
          );
        }
      }
    }

    // 1. Proyecto (una sola carga): path para el aislamiento + receta verify.
    const project = projectId ? await projectsRepository.get(executor, projectId).catch(() => null) : null;
    const effectiveVerify = verifyCommands?.length ? verifyCommands : project?.verify?.commands ?? [];

    // Notes and task share ONE TOON budget. Preserve every constraint or reject
    // the assignment before dispatch; markdown prefixes used to bypass validation.
    if (planId) {
      const plan = await teamTasksRepository.getPlan(executor, planId).catch(() => null);
      const notes = plan?.sharedNotes?.trim();
      if (plan && plan.leaderConversationId === leaderConversationId && notes) {
        workText = prepareCoordinationTask(task, notes);
      }
    }

    // 2. Conversación del worker SIN el turno de usuario todavía: el camino
    //    síncrono lo persiste antes de arrancar; el diferido deja que
    //    drainConversationQueue lo haga al despachar (evita duplicarlo).
    const convId = await createWorkerConversation(executor, worker, task, projectId, { appendUserMessage: false });
    if (leaderAgentId.startsWith("realtime:")) {
      const parent = await conversationsRepository.getMeta(executor, leaderConversationId);
      await conversationsRepository.patchMeta(executor, convId, { approvalMode: parent?.approvalMode ?? (await assistantConfigRepository.load(executor)).approval.mode });
    }
    // Persistir el origen en el meta del worker YA (no solo al arrancar): el
    // camino DIFERIDO despacha vía drainConversationQueue, que lee el
    // panelOrigin del meta de ESTA conversación para re-montar el canal MCP.
    if (panelOrigin) {
      await conversationsRepository.patchRuntime(executor, convId, { panelOrigin }).catch(() => undefined);
    }

    // 3. Task record `pending` ANTES de cualquier arranque (los caminos de
    //    cierre siempre lo encuentran). Receta y presupuesto SNAPSHOT.
    const budget = budgetTokens ?? (env.ASSISTANT_TEAM_TASK_TOKEN_BUDGET > 0 ? env.ASSISTANT_TEAM_TASK_TOKEN_BUDGET : null);
    let record = await teamTasksRepository.createTask(executor, {
      leaderConversationId,
      leaderAgentId,
      ...(planId !== undefined ? { planId } : {}),
      ...(stepIndex !== undefined ? { stepIndex } : {}),
      workerAgentId: worker.id ?? "",
      workerAgentName: worker.name,
      workerConversationId: convId,
      title,
      task,
      projectId,
      status: "pending",
      ...(effectiveVerify.length ? { verifyCommands: effectiveVerify.slice(0, 10) } : {}),
      budgetTokens: budget,
      user: user ?? null,
      userId: userId ?? null,
    });
    if (!record.id) throw new Error("No se pudo registrar la tarea del equipo.");
    const taskId = record.id;

    // 4. Aislamiento (solo con proyecto con path). Nunca lanza: peor caso "none".
    let prep: PreparedIsolation = { isolation: { mode: "none" }, deferred: false };
    if (input.exclusiveBuild || (leaderAgentId.startsWith("realtime:") && effectiveVerify.length > 0)) {
      const leasePath = "@realtime-build-deploy";
      prep = { isolation: { mode: "lease", leasePath, ...(project?.path ? { cwd: project.path } : {}) },
        deferred: !teamIsolationService.tryAcquireLease(leasePath, taskId, executor.target.id) };
    } else if (project?.path) {
      prep = await teamIsolationService.prepare(executor, { taskId, projectPath: project.path });
      if (leaderAgentId.startsWith("realtime:") && prep.isolation.mode === "none") {
        const leasePath = project.path;
        prep = { isolation: { mode: "lease", leasePath, cwd: project.path },
          deferred: !teamIsolationService.tryAcquireLease(leasePath, taskId, executor.target.id) };
      }
    }
    if (prep.isolation.mode !== "none" || prep.baseHadUncommitted) {
      record =
        (await teamTasksRepository.updateTask(executor, taskId, {
          ...(prep.isolation.mode !== "none" ? { isolation: prep.isolation } : {}),
          ...(prep.baseHadUncommitted ? { artifacts: { baseHadUncommitted: true } } : {}),
        })) ?? record;
    }
    // Barrido perezoso de worktrees huérfanos del repo (restos de crashes /
    // reinicios): conserva los de tareas aún activas. Best-effort en background.
    if (prep.isolation.mode === "worktree" && prep.isolation.repoRoot) {
      const repoRoot = prep.isolation.repoRoot;
      void (async () => {
        const activeTasks = await teamTasksRepository.listActive(executor).catch(() => []);
        const keep = new Set(activeTasks.map((t) => t.id ?? "").filter(Boolean));
        keep.add(taskId);
        await teamIsolationService.sweepOrphans(executor, repoRoot, keep);
      })().catch(() => undefined);
    }

    // 4. Gate de despacho: lease libre + hueco en el cupo de workers.
    const closeHandler = async ({ assistantText, errored, interrupted }: { assistantText: string; errored: boolean; interrupted?: boolean }) => {
      if (interrupted) {
        await finalizeTask(executor, taskId, { status: "canceled", error: TASK_INTERRUPTED_ERROR });
      } else if (errored) {
        await finalizeTask(executor, taskId, {
          status: "failed",
          error: assistantText ? assistantText.slice(0, 500) : "El agente terminó con error.",
        }, { retryExecution: true });
      } else {
        await finalizeTask(executor, taskId, { status: "done", resultSummary: assistantText });
      }
    };
    if (!prep.deferred && hasWorkerSlot(userId)) {
      record =
        (await teamTasksRepository.updateTask(executor, taskId, {
          status: "running",
          startedAt: new Date().toISOString(),
        })) ?? record;
      await conversationsRepository
        .appendMessages(executor, convId, [
          { role: "user", provider: worker.providerId, content: workText, displaySummary: visibleSummary(workText), auto: true, replyAudience: "agent", ts: new Date().toISOString() },
        ])
        .catch(() => undefined);
      startWorkerRun({
        executor,
        user,
        userId,
        worker,
        task: workText,
        projectId,
        conversationId: convId,
        depth,
        runAgent,
        ...(panelOrigin ? { panelOrigin } : {}),
        ...(prep.forcedCwd ? { forcedCwd: prep.forcedCwd } : {}),
        onDone: closeHandler,
      });
    } else {
      // Diferida: el turno inicial queda PERSISTIDO en agent-queue (sobrevive
      // reinicios vía recoverServerRuns); la FIFO ordena el despacho en vida
      // del proceso. Cierra por el listener AI_CHAT_FINISHED (sin onDone).
      await enqueueAgentTurn(executor, {
        conversationId: convId,
        userText: workText,
        provider: worker.providerId,
        agentId: worker.id ?? null,
        projectId: projectId ?? null,
        withContext: true,
        user: user ?? null,
        userId: userId ?? null,
        forcedCwd: prep.isolation.cwd ?? null,
        isWorker: true,
      });
      deferDispatch({
        executor,
        taskId,
        workerConversationId: convId,
        ...(prep.isolation.mode === "lease" && prep.isolation.leasePath ? { leasePath: prep.isolation.leasePath } : {}),
        userId: userId ?? null,
      });
      log.info({ taskId, reason: prep.deferred ? "lease" : "worker-quota" }, "team task deferred");
    }
    emitTaskUpdate(record, "assigned", executor.target.id);
    // Mirror the assignment into the plan step (team.plan), when given.
    if (planId && typeof stepIndex === "number") {
      try {
        const plan = await teamTasksRepository.getPlan(executor, planId);
        if (plan?.id && plan.leaderConversationId === leaderConversationId && plan.steps[stepIndex]) {
          const steps = plan.steps.map((s, i) =>
            i === stepIndex ? { ...s, status: "assigned" as const, workerAgentId: worker.id ?? s.workerAgentId } : s,
          );
          await teamTasksRepository.patchPlan(executor, plan.id, { steps });
        }
      } catch (err) {
        log.warn({ err: (err as Error).message }, "team plan step assign-mark failed");
      }
    }
    return record;
  },

  /** Persist a new ACTIVE team plan (team.plan tool). Steps start pending. */
  async createPlan(
    executor: Executor,
    input: {
      leaderConversationId: string;
      leaderAgentId: string;
      title: string;
      goal: string;
      steps: Array<{ title: string; workerAgentId?: string }>;
      sharedNotes?: string;
    },
  ) {
    return teamTasksRepository.createPlan(executor, {
      leaderConversationId: input.leaderConversationId,
      leaderAgentId: input.leaderAgentId,
      title: input.title,
      goal: input.goal,
      steps: input.steps.map((s) => ({
        title: s.title,
        ...(s.workerAgentId ? { workerAgentId: s.workerAgentId } : {}),
        status: "pending" as const,
      })),
      ...(input.sharedNotes?.trim() ? { sharedNotes: encodeCoordination(compactAgentInput(input.sharedNotes, "progress")) } : {}),
      status: "active",
    });
  },

  /** Actualiza las notas compartidas de un plan (tool team.note del líder). */
  async setPlanNotes(
    executor: Executor,
    leaderConversationId: string,
    planId: string,
    notes: string,
  ): Promise<{ ok: boolean; message: string }> {
    const plan = await teamTasksRepository.getPlan(executor, planId);
    if (!plan?.id) return { ok: false, message: "Plan no encontrado." };
    if (plan.leaderConversationId !== leaderConversationId) {
      return { ok: false, message: "El plan no pertenece a esta conversación." };
    }
    await teamTasksRepository.patchPlan(executor, plan.id, { sharedNotes: encodeCoordination(compactAgentInput(notes, "progress")) });
    return { ok: true, message: "Notas del plan actualizadas (los próximos workers las recibirán)." };
  },

  /**
   * Wait (bounded) until every listed task reaches a terminal state. Resolves
   * early on the leader's AbortSignal (user pressed stop — workers keep
   * running; only the wait is released). Returns the CURRENT snapshot of the
   * listed tasks plus whether the wait timed out.
   */
  async waitForTasks(
    executor: Executor,
    leaderConversationId: string,
    taskIds: string[],
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<{ tasks: TeamTask[]; timedOut: boolean }> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    for (;;) {
      const all = await this.listForLeaderConversation(executor, leaderConversationId, false);
      // Corte por presupuesto de tokens (≤1 lectura del ledger por iteración,
      // acotado por WAIT_POLL_MS). Best-effort.
      await enforceBudgets(executor, all).catch(() => undefined);
      const subset = all.filter((t) => t.id && taskIds.includes(t.id));
      const pending = subset.filter((t) => !isTerminalTaskStatus(t.status));
      if (pending.length === 0) return { tasks: subset, timedOut: false };
      // A leader blocked in collect must be able to decide a worker approval
      // or handle an exhausted failure without waiting for all its peers.
      if (subset.some(t => t.pendingPermission || (t.status === "failed" && !t.collected))) return { tasks: subset, timedOut: false };
      const remaining = deadline - Date.now();
      if (remaining <= 0 || signal?.aborted) return { tasks: subset, timedOut: true };
      await waitForPing(leaderConversationId, Math.min(remaining, WAIT_POLL_MS), signal, executor.target.id);
    }
  },

  /**
   * Board for a leader conversation WITH lazy reconciliation: stale `running`
   * tasks whose worker has no live run (registry) nor CLI job are closed from
   * the persisted conversation — covers API runs killed by a panel restart
   * without needing a background loop.
   */
  async listForLeaderConversation(executor: Executor, leaderConversationId: string, notifyLeader = true): Promise<TeamTask[]> {
    const tasks = await teamTasksRepository.listForLeaderConversation(executor, leaderConversationId);
    const out: TeamTask[] = [];
    for (const t of tasks) {
      if ((t.status !== "running" && t.status !== "pending") || !t.id) {
        out.push(t);
        continue;
      }
      const reconciled = await this.reconcileRunningTask(executor, t);
      out.push(reconciled ?? t);
    }
    // Also recovers a missed wake-up after restart/enqueue failure. This only
    // collects already-existing work; it does not restart workers or tools.
    if (notifyLeader) await maybeNudgeLeader(executor, leaderConversationId);
    return out;
  },

  /** Every non-terminal task, reconciled (Dashboard feed). */
  async listActive(executor: Executor): Promise<TeamTask[]> {
    const tasks = await teamTasksRepository.listActive(executor);
    const out: TeamTask[] = [];
    for (const t of tasks) {
      if ((t.status !== "running" && t.status !== "pending") || !t.id) {
        out.push(t);
        continue;
      }
      const reconciled = await this.reconcileRunningTask(executor, t);
      if (reconciled && isTerminalTaskStatus(reconciled.status)) continue;
      out.push(reconciled ?? t);
    }
    return out;
  },

  /** Reconcile a stale orphaned `running`/`pending` task. Returns the updated
   *  task, or null when it is NOT actually orphaned. */
  async reconcileRunningTask(executor: Executor, task: TeamTask): Promise<TeamTask | null> {
    if (task.leaderAgentId.startsWith("realtime:") && task.status === "pending" && task.pendingPermission) return task;
    if (!task.id) return null;
    if (task.retry?.state === "waiting") {
      await ensureExecutionRetryQueued(executor, task);
      return task;
    }

    if (task.status === "pending") {
      // Un reinicio pudo drenar su turno (recoverServerRuns) sin pasar por
      // dispatchNext → el run existe pero el board sigue `pending`.
      if (agentRunRegistry.isActive(task.workerConversationId, executor.target.id)) {
        return teamTasksRepository.updateTask(executor, task.id, {
          status: "running",
          startedAt: new Date().toISOString(),
        });
      }
      // ¿Su turno inicial sigue encolado (espera legítima)?
      const queued = await agentQueueRepository.listFor(executor, task.workerConversationId).catch(() => []);
      if (queued.length > 0) return null;
      const created = Date.parse(task.createdAt);
      if (Number.isFinite(created) && Date.now() - created < STALE_RUNNING_MS) return null;
      if (await preserveWorkerExecution(executor, task.workerConversationId)) return null;
      removeFromDispatchQueue(task.id);
      return finalizeTask(
        executor,
        task.id,
        { status: "failed", error: "La tarea quedó huérfana (reinicio del panel) sin turno encolado." },
        { skipVerify: true },
      );
    }

    if (task.status !== "running") return null;
    // Live or recently-finished run in the registry → let its close path win.
    if (agentRunRegistry.has(task.workerConversationId, executor.target.id)) return null;
    // Background CLI job still polling → alive.
    if (cliJobTracker.hasJobForConversation(task.workerConversationId, executor.target.id)) return null;
    if (await preserveWorkerExecution(executor, task.workerConversationId)) return null;
    // Verificación en curso (corre SIN run vivo en el registry) → no cerrarla.
    if (task.verify?.state === "running" && task.verify.startedAt) {
      const startedVerify = Date.parse(task.verify.startedAt);
      const budget = (task.verifyCommands?.length ?? 1) * env.ASSISTANT_TEAM_VERIFY_CMD_TIMEOUT_MS + 60_000;
      if (Number.isFinite(startedVerify) && Date.now() - startedVerify < budget) return null;
    }
    // Turno de corrección (retry de verify) encolado → re-drenará.
    const queuedRetry = await agentQueueRepository.listFor(executor, task.workerConversationId).catch(() => []);
    if (queuedRetry.length > 0) return null;
    // Leer el chat ANTES del corte por antigüedad: si la recuperación ya dejó
    // la nota de interrupción, el run está muerto con certeza — cerrar YA como
    // failed en vez de dejar la tarjeta `running` hasta que la ventana de
    // staleness venza (o para siempre, si nadie volvía a leer el board). Solo
    // llegamos aquí sin run vivo en el registry ni CLI job, así que esta
    // lectura extra no compite con ningún camino de cierre normal.
    let items: ConversationMessage[] = [];
    try {
      items = (await conversationsRepository.messages(executor, task.workerConversationId, { limit: 5 })).items;
    } catch {
      return null; // unavailable evidence is not a terminal outcome
    }
    const persisted = persistedWorkerOutcome(items);
    if (persisted === null) return null; // waiting for the human or its own team
    if (persisted && persisted.status !== "done") {
      return finalizeTask(
        executor,
        task.id,
        persisted,
        { skipVerify: true, retryExecution: persisted.status === "failed" && persisted.error !== TASK_INTERRUPTED_ERROR },
      );
    }
    const started = Date.parse(task.startedAt ?? task.createdAt);
    if (Number.isFinite(started) && Date.now() - started < STALE_RUNNING_MS) return null;
    if (persisted) {
      // El guard de finalizeTaskInner re-verifica el placeholder (belt & braces).
      return finalizeTask(
        executor,
        task.id,
        persisted,
        { skipVerify: true },
      );
    }
    return finalizeTask(
      executor,
      task.id,
      { status: "failed", error: TASK_INTERRUPTED_ERROR },
      { skipVerify: true },
    );
  },

  /** Mark a batch of tasks as consumed by the leader (team.collect). */
  async markCollected(executor: Executor, taskIds: string[]): Promise<void> {
    for (const id of taskIds) {
      const task = await teamTasksRepository.getTask(executor, id);
      if (task && isTerminalTaskStatus(task.status)) await teamTasksRepository.updateTask(executor, id, { collected: true });
    }
  },

  /** Flag/unflag a pending interactive permission on the worker's task and
   *  surface it on the leader's live stream. */
  async setPendingPermission(executor: Executor, workerConversationId: string, pending: boolean): Promise<void> {
    const task = await teamTasksRepository.findByWorkerConversation(executor, workerConversationId);
    if (!task?.id || isTerminalTaskStatus(task.status)) return;
    if (Boolean(task.pendingPermission) === pending) return;
    const updated = await teamTasksRepository.updateTask(executor, task.id, { pendingPermission: pending });
    if (updated) {
      injectTaskUpdate(updated, executor.target.id);
      pingWaiters(updated.leaderConversationId, executor.target.id);
    }
  },

  /**
   * Integrate a DONE task's branch into the project's main checkout
   * (team.integrate / REST). ff-only → merge → conflictos (sin marcar failed:
   * el trabajo sigue en la rama). Integración OK → borra rama+worktree.
   */
  async integrateTask(
    executor: Executor,
    taskId: string,
    opts: { mode?: "merge" | "pr" } = {},
  ): Promise<{ ok: boolean; message: string; conflicts?: string[]; summary?: Record<string, unknown> }> {
    const task = await teamTasksRepository.getTask(executor, taskId);
    if (!task?.id) return { ok: false, message: "Tarea no encontrada." };
    if (task.status !== "done") {
      return { ok: false, message: `Solo se integran tareas terminadas (estado actual: ${task.status}).` };
    }
    const iso = task.isolation;
    if (!iso || iso.mode !== "worktree" || !iso.branch) {
      return { ok: false, message: "La tarea no tiene rama de trabajo (sin aislamiento worktree)." };
    }
    if (iso.integrated) return { ok: true, message: `La rama ${iso.branch} ya fue integrada.` };

    // Modo PR: push + gh pr create (gateado). La rama local se conserva.
    if (opts.mode === "pr") {
      if (!env.ASSISTANT_TEAM_PR_ENABLED) {
        return { ok: false, message: "El modo PR está deshabilitado (ASSISTANT_TEAM_PR_ENABLED); usa el modo merge." };
      }
      const body =
        `Tarea delegada: ${task.title}\n\n` +
        (task.resultSummary ? task.resultSummary.slice(0, 1000) + "\n\n" : "") +
        `${task.artifacts?.filesChangedTotal ?? 0} archivo(s), +${task.artifacts?.insertions ?? 0}/-${task.artifacts?.deletions ?? 0}.`;
      const pr = await teamIsolationService.createPr(executor, iso, { title: task.title.slice(0, 100), body });
      if (!pr.ok) return pr;
      const updated = await teamTasksRepository.updateTask(executor, task.id, {
        isolation: { ...iso, ...(pr.prUrl ? { prUrl: pr.prUrl } : {}) },
      });
      if (updated) injectTaskUpdate(updated, executor.target.id);
      return {
        ok: true,
        message: pr.message,
        summary: { branch: iso.branch, ...(pr.prUrl ? { prUrl: pr.prUrl } : {}) },
      };
    }

    const res = await teamIsolationService.integrate(executor, iso);
    if (!res.ok) return res;
    const updated = await teamTasksRepository.updateTask(executor, task.id, {
      isolation: { ...iso, integrated: true },
    });
    await teamIsolationService.cleanup(executor, iso, { deleteBranch: true }).catch(() => undefined);
    if (updated) injectTaskUpdate(updated, executor.target.id);
    return {
      ok: true,
      message: res.message,
      summary: {
        branch: iso.branch,
        ...(task.artifacts?.filesChangedTotal != null ? { files: task.artifacts.filesChangedTotal } : {}),
        ...(task.artifacts?.insertions != null ? { insertions: task.artifacts.insertions } : {}),
        ...(task.artifacts?.deletions != null ? { deletions: task.artifacts.deletions } : {}),
      },
    };
  },

  /** Full diff of a task's branch (live) or its persisted preview (fallback). */
  async taskDiff(
    executor: Executor,
    taskId: string,
  ): Promise<{ task: TeamTask; diff: string | null; truncated: boolean; source: "live" | "preview" | "none" } | null> {
    const task = await teamTasksRepository.getTask(executor, taskId);
    if (!task?.id) return null;
    const iso = task.isolation;
    if (iso?.mode === "worktree") {
      const live = await teamIsolationService
        .fullDiff(executor, iso, env.ASSISTANT_TEAM_DIFF_MAX_BYTES)
        .catch(() => null);
      if (live) return { task, diff: live, truncated: live.length >= env.ASSISTANT_TEAM_DIFF_MAX_BYTES, source: "live" };
    }
    if (task.artifacts?.diffPreview) {
      return { task, diff: task.artifacts.diffPreview, truncated: Boolean(task.artifacts.diffTruncated), source: "preview" };
    }
    return { task, diff: null, truncated: false, source: "none" };
  },

  /** Test helper — wipe the in-process quota/dispatch/finalize state. */
  _resetForTest(): void {
    resetWorkerQuota();
    resetLifecycleState();
  },

  /** Cancel a task: stop the worker's run/CLI job, close as canceled. */
  async cancelTask(executor: Executor, taskId: string): Promise<TeamTask | null> {
    const task = await teamTasksRepository.getTask(executor, taskId);
    if (!task?.id) return null;
    if (isTerminalTaskStatus(task.status)) return task;
    // Quitar turnos pendientes del worker: el inicial de una diferida Y
    // cualquier turno de corrección (retry de verify) aún sin drenar.
    removeFromDispatchQueue(task.id);
    await agentQueueRepository.clearFor(executor, task.workerConversationId).catch(() => undefined);
    agentRunRegistry.stop(task.workerConversationId, executor.target.id);
    cliJobTracker.killForConversation(task.workerConversationId, executor.target.id);
    return finalizeTask(executor, task.id, { status: "canceled", error: "Cancelada por el usuario." }, { skipVerify: true });
  },
};
