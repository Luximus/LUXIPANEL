// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team task board — persistent record of work a LEADER agent delegated to its
 * subordinate ("worker") agents in background chats.
 *
 * A task is created by the leader's `team.assign` tool: it spawns a real chat
 * for the worker (agent-run-registry) and anchors the result here, keyed by the
 * leader's conversation. `team.collect` waits on these records; the UI renders
 * them as live progress cards. Storage is per-server (like conversations):
 * `${LUXIPANEL_CONFIG_DIR}/assistant/team-tasks.json` / `team-plans.json`.
 */

import type { SessionUser } from "../../../shared/types/index.js";

export type TeamTaskStatus = "pending" | "running" | "done" | "failed" | "canceled";

/** Terminal states — a task never leaves one of these (idempotent close). */
export const TERMINAL_TASK_STATUSES: readonly TeamTaskStatus[] = ["done", "failed", "canceled"] as const;

export function isTerminalTaskStatus(s: TeamTaskStatus): boolean {
  return (TERMINAL_TASK_STATUSES as readonly string[]).includes(s);
}

/** Cap on the per-task result snapshot persisted on the board (the full answer
 *  lives in the worker's conversation). Mirrors AI_CONVERSATION_COMPLETED's cap. */
export const TASK_RESULT_SUMMARY_MAX = 4000;

/** Cap on the plan's shared notes (leader-written, prepended to worker tasks). */
export const PLAN_SHARED_NOTES_MAX = 4000;

/**
 * How a worker run was isolated from the project's main checkout.
 * `worktree` = git worktree + rama propia (paralelismo seguro); `lease` =
 * escritores del mismo path serializados (repo no-git); `none` = sin
 * aislamiento (kill-switch off o preparación fallida).
 */
export interface TeamTaskIsolation {
  mode: "worktree" | "lease" | "none";
  /** Raíz del repo git detectada (`rev-parse --show-toplevel`). */
  repoRoot?: string;
  /** `<repoRoot>/.lxp/worktrees/<taskId>`. */
  worktreePath?: string;
  /** Rama de la tarea (`lxp/task-<taskId>`). */
  branch?: string;
  /** HEAD del repo al preparar el worktree (base del diff). */
  baseSha?: string;
  /** HEAD de la rama al cerrar (tras el auto-commit de captura). */
  headSha?: string;
  /** cwd efectivo del worker (worktreePath + subruta si project.path era subdir). */
  cwd?: string;
  /** Modo lease: path serializado. */
  leasePath?: string;
  /** El worktree ya fue eliminado (la rama puede seguir viva). */
  cleaned?: boolean;
  /** La rama ya fue integrada al checkout principal (team.integrate). */
  integrated?: boolean;
  /** URL del PR creado en modo PR de team.integrate. */
  prUrl?: string;
}

/** Estado de la verificación ejecutable (receta de comandos) de una tarea. */
export interface TeamTaskVerify {
  state: "running" | "passed" | "failed" | "skipped";
  /** Intentos consumidos (1 = primera verificación). */
  attempts: number;
  startedAt?: string;
  failedCommand?: string;
  exitCode?: number;
  /** Último tramo de stdout+stderr del comando fallido (≤4000 chars). */
  logTail?: string;
}

export interface TeamTaskFileChange {
  path: string;
  status: "A" | "M" | "D" | "R" | "C" | "?";
  insertions: number;
  deletions: number;
}

/** Artefactos capturados al cerrar la tarea (diff/base del worktree + tokens). */
export interface TeamTaskArtifacts {
  /** Primeras entradas de `git diff --numstat/--name-status` (cap 200). */
  filesChanged?: TeamTaskFileChange[];
  filesChangedTotal?: number;
  insertions?: number;
  deletions?: number;
  /** Diff unificado recortado a ASSISTANT_TEAM_DIFF_PREVIEW_BYTES. */
  diffPreview?: string;
  diffTruncated?: boolean;
  /** El checkout principal tenía cambios sin commitear al asignar (el worktree
   *  parte de HEAD y no los ve). */
  baseHadUncommitted?: boolean;
  /** `overBudget`: la tarea consumió más que su `budgetTokens` (anotado al
   *  cierre; el status NO se reclasifica — el gasto cuenta al plan). */
  tokens?: { inputTokens: number; outputTokens: number; totalTokens: number; estimated: boolean; overBudget?: boolean };
}

export interface TeamTask {
  id?: string;
  /** The LEADER's chat this task belongs to (grouping key for board + collect). */
  leaderConversationId: string;
  /** Leader agent that assigned the task. */
  leaderAgentId: string;
  /** Optional plan this task is a step of (team.plan). */
  planId?: string | null;
  /** Step index inside the plan (when planId is set). */
  stepIndex?: number;
  /** Worker agent the task was delegated to. */
  workerAgentId: string;
  /** Snapshot of the worker's name at assign time (agents are deletable). */
  workerAgentName: string;
  /** The real background chat spawned for the worker. */
  workerConversationId: string;
  /** Short human title for the progress card. */
  title: string;
  /** Full self-contained instruction handed to the worker. */
  task: string;
  projectId?: string | null;
  status: TeamTaskStatus;
  /** Worker's answer, trimmed to TASK_RESULT_SUMMARY_MAX chars. */
  resultSummary?: string;
  error?: string;
  /** True once the leader consumed the result via team.collect. */
  collected?: boolean;
  /** True once an automatic wake-up turn (leader nudge) was enqueued for this
   *  task's batch — prevents nudge loops when the model ignores the nudge. */
  nudged?: boolean;
  /** The worker has a pending interactive permission_request (manual mode). */
  pendingPermission?: boolean;
  /**
   * Snapshot of the assigning user (same rationale as QueuedTurn.user): a
   * backgrounded nudge/re-wake must keep the EXACT tool/CLI gating the user had
   * when the work was assigned — never escalate.
   */
  user?: SessionUser | null;
  userId?: string | null;
  /** Aislamiento del run del worker (worktree/lease/none). */
  isolation?: TeamTaskIsolation;
  /** Estado de la verificación ejecutable (ausente = sin receta). */
  verify?: TeamTaskVerify;
  /** Receta RESUELTA al asignar (snapshot: proyecto u override del assign). */
  verifyCommands?: string[];
  /** Tope de tokens por tarea resuelto al asignar (null = sin tope). */
  budgetTokens?: number | null;
  /** Artefactos capturados al cerrar. */
  artifacts?: TeamTaskArtifacts;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export type TeamPlanStepStatus = "pending" | "assigned" | "done" | "failed";

export interface TeamPlanStep {
  title: string;
  /** Worker the leader intends to (or did) assign this step to. */
  workerAgentId?: string;
  status: TeamPlanStepStatus;
}

export interface TeamPlan {
  id?: string;
  leaderConversationId: string;
  leaderAgentId: string;
  title: string;
  goal: string;
  steps: TeamPlanStep[];
  status: "active" | "completed" | "failed";
  /** Notas compartidas escritas por el líder (team.plan `notes` / team.note);
   *  se prependan SOLO-LECTURA a la tarea de cada worker del plan. ≤4000. */
  sharedNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Compact task view injected into the leader's SSE stream + returned by the
 *  board endpoints — everything the progress card needs, nothing else. */
export interface TeamTaskView {
  id: string;
  title: string;
  status: TeamTaskStatus;
  workerAgentId: string;
  workerAgentName: string;
  workerConversationId: string;
  planId?: string | null;
  pendingPermission?: boolean;
  error?: string;
  /** Compacto — SIN diffPreview (viaja en cada team_task_update por SSE). */
  verify?: { state: TeamTaskVerify["state"]; attempts: number };
  isolation?: { mode: TeamTaskIsolation["mode"]; branch?: string; integrated?: boolean };
  artifacts?: {
    filesChangedTotal?: number;
    insertions?: number;
    deletions?: number;
    tokens?: TeamTaskArtifacts["tokens"];
  };
  createdAt: string;
  finishedAt?: string;
}

export function toTaskView(t: TeamTask): TeamTaskView {
  return {
    id: t.id ?? "",
    title: t.title,
    status: t.status,
    workerAgentId: t.workerAgentId,
    workerAgentName: t.workerAgentName,
    workerConversationId: t.workerConversationId,
    planId: t.planId ?? null,
    ...(t.pendingPermission ? { pendingPermission: true } : {}),
    ...(t.error ? { error: t.error } : {}),
    ...(t.verify ? { verify: { state: t.verify.state, attempts: t.verify.attempts } } : {}),
    ...(t.isolation
      ? {
          isolation: {
            mode: t.isolation.mode,
            ...(t.isolation.branch ? { branch: t.isolation.branch } : {}),
            ...(t.isolation.integrated ? { integrated: true } : {}),
          },
        }
      : {}),
    ...(t.artifacts
      ? {
          artifacts: {
            ...(t.artifacts.filesChangedTotal != null ? { filesChangedTotal: t.artifacts.filesChangedTotal } : {}),
            ...(t.artifacts.insertions != null ? { insertions: t.artifacts.insertions } : {}),
            ...(t.artifacts.deletions != null ? { deletions: t.artifacts.deletions } : {}),
            ...(t.artifacts.tokens ? { tokens: t.artifacts.tokens } : {}),
          },
        }
      : {}),
    createdAt: t.createdAt,
    ...(t.finishedAt ? { finishedAt: t.finishedAt } : {}),
  };
}

/**
 * Persisted rehydration snapshot of a delegated task, keyed by the leader's
 * conversation. Unlike `TeamTaskView` (SSE-compact, worker-centric field
 * names) this is the shape the frontend consumes to REBUILD the "Equipo
 * trabajando" process block from the chat history after a reload — the block
 * used to be live-only and vanished on refresh. Field names are assignee-first
 * so the card can paint the subagent's avatar (`assigneeAgentId`) and name,
 * and open its chat (`childConversationId`).
 */
export interface TeamTaskSnapshot {
  taskId: string;
  /** The LEADER's chat this task belongs to (grouping key). */
  leaderConversationId: string;
  title: string;
  /** Subagent the task was delegated to (drives the avatar). */
  assigneeAgentId: string;
  assigneeName: string;
  state: TeamTaskStatus;
  /** The worker's background chat ("Abrir chat"). */
  childConversationId: string;
  planId: string | null;
  stepIndex: number | null;
  pendingPermission: boolean;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Map a persisted task to its conversation-scoped rehydration snapshot. */
export function toTeamTaskSnapshot(t: TeamTask): TeamTaskSnapshot {
  return {
    taskId: t.id ?? "",
    leaderConversationId: t.leaderConversationId,
    title: t.title,
    assigneeAgentId: t.workerAgentId,
    assigneeName: t.workerAgentName,
    state: t.status,
    childConversationId: t.workerConversationId,
    planId: t.planId ?? null,
    stepIndex: t.stepIndex ?? null,
    pendingPermission: t.pendingPermission ?? false,
    error: t.error ?? null,
    createdAt: t.createdAt,
    startedAt: t.startedAt ?? null,
    finishedAt: t.finishedAt ?? null,
  };
}

/** Trim a worker answer to the persisted summary cap, marking the cut. */
export function clampResultSummary(text: string): string {
  const clean = (text ?? "").trim();
  if (clean.length <= TASK_RESULT_SUMMARY_MAX) return clean;
  return clean.slice(0, TASK_RESULT_SUMMARY_MAX) + "\n…[truncado — resultado completo en el chat del agente]";
}

/** Trim the plan's shared notes to their cap, marking the cut. */
export function clampSharedNotes(text: string): string {
  const clean = (text ?? "").trim();
  if (clean.length <= PLAN_SHARED_NOTES_MAX) return clean;
  return clean.slice(0, PLAN_SHARED_NOTES_MAX) + "\n…[truncado]";
}

/** Short card title from untrusted input → trimmed, single-line, ≤120 chars. */
export function sanitizeTaskTitle(input: unknown, fallback: string): string {
  const raw = typeof input === "string" ? input : "";
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine) return oneLine.slice(0, 120);
  return fallback.replace(/\s+/g, " ").trim().slice(0, 120) || "Tarea delegada";
}
