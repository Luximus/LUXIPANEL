// SPDX-License-Identifier: AGPL-3.0-only
import type { Executor } from "../../../../shared/executor/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { eventBus, Events } from "../../../../shared/events/index.js";
import { conversationsRepository } from "../../repositories/conversations.repository.js";
import { teamTasksRepository } from "../../repositories/team-tasks.repository.js";
import { agentQueueRepository, type QueuedTurn } from "../../repositories/agent-queue.repository.js";
import { assistantAuditRepository } from "../../repositories/assistant-audit.repository.js";
import { encodeCoordination } from "../../models/agent-envelope.js";
import { isTerminalTaskStatus, type TeamTask, type TeamTaskRetry } from "../../models/team-task.types.js";
import { enqueueAgentTurn } from "../queued-turn-admission.js";
import { injectTaskUpdate } from "./task-events.js";
import { sanitizeText } from "../../../../shared/diagnostics/sanitize.js";

export const EXECUTION_MAX_RETRIES = 3;
export const EXECUTION_RETRY_DELAY_MS = 30_000;
const log = createModuleLogger("assistant-team-retry");

/** Short diagnostic only. Full provider evidence stays in the worker log. */
export function safeRetryError(error: string): string {
  return sanitizeText(error).replace(/\b(Bearer)\s+\S+/gi, "$1 [redacted]")
    .replace(/((?:password|passwd|token|secret|api[_-]?key|authorization)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi, "https://[redacted]@")
    .slice(0, 500);
}

/** Decisions and missing authority are not transient execution failures. */
export function retryableExecutionError(error: string): boolean {
  return !/(?:permission denied|permissions? insufficient|insufficient permissions|access denied|forbidden|unauthori[sz]ed|credentials? rejected|authentication failed|autenticaci[oó]n|acci[oó]n denegada|permiso.*(?:denegad|insuficient)|credenciales.*rechazad|presupuesto.*(?:agotad|excedid)|cancelad[oa] por|stopped by (?:the )?user)/i.test(error);
}

/** Caller holds the target/task finalization mutex. Does not replay commands. */
export async function scheduleExecutionRetry(executor: Executor, task: TeamTask, error: string, dispatchFailureId?: string): Promise<TeamTask | null> {
  if (!task.id || isTerminalTaskStatus(task.status)) return null;
  if (task.retry?.state === "waiting") {
    await ensureExecutionRetryQueued(executor, task);
    return task;
  }
  const { items } = await conversationsRepository.messages(executor, task.workerConversationId, { limit: 1 });
  const last = items.at(-1);
  if (last?.interrupted || last?.ask?.length) return null;
  const failureId = dispatchFailureId ?? (last?.role === "assistant" ? (last.messageId ?? last.ts) : task.startedAt ?? task.createdAt);
  if (task.retry?.failureId === failureId) return task.retry.state === "exhausted" ? null : task;
  const attempts = task.retry?.attempts ?? 0;
  const retryable = retryableExecutionError(error);
  const retry: TeamTaskRetry = {
    state: retryable && attempts < EXECUTION_MAX_RETRIES ? "waiting" : "exhausted",
    attempts, maxRetries: EXECUTION_MAX_RETRIES, delayMs: EXECUTION_RETRY_DELAY_MS, failureId,
    history: [...(task.retry?.history ?? []), { at: new Date().toISOString(), attempt: attempts, error: safeRetryError(error) }].slice(-4),
    ...(retryable && attempts < EXECUTION_MAX_RETRIES ? { nextAttemptAt: new Date(Date.now() + EXECUTION_RETRY_DELAY_MS).toISOString() } : {}),
  };
  const updated = await teamTasksRepository.updateTask(executor, task.id, { retry });
  log.warn({ targetId: executor.target.id, taskId: task.id, attempt: attempts, retry: retry.state, error: safeRetryError(error), nextAttemptAt: retry.nextAttemptAt }, "worker execution failed");
  await assistantAuditRepository.append({ ts: new Date().toISOString(), provider: "team", tool: `team.execution:${retry.state}:${attempts}`, success: false, durationMs: 0, userId: task.userId ?? undefined }, executor);
  if (!updated || isTerminalTaskStatus(updated.status) || retry.state === "exhausted") return null;
  injectTaskUpdate(updated, executor.target.id);
  await ensureExecutionRetryQueued(executor, updated);
  return updated;
}

/** Rebuild a missed enqueue after restart from the durable retry receipt. */
export async function ensureExecutionRetryQueued(executor: Executor, task: TeamTask): Promise<void> {
  const retry = task.retry;
  if (!task.id || isTerminalTaskStatus(task.status) || retry?.state !== "waiting") return;
  const queued = await agentQueueRepository.listFor(executor, task.workerConversationId);
  if (!queued.some(q => q.teamRetry?.taskId === task.id && q.teamRetry.failureId === retry.failureId)) {
    await enqueueAgentTurn(executor, {
      conversationId: task.workerConversationId, agentId: task.workerAgentId, projectId: task.projectId ?? null,
      user: task.user ?? null, userId: task.userId ?? null, withContext: true, auto: true, isWorker: true,
      forcedCwd: task.isolation?.cwd ?? null, notBefore: retry.nextAttemptAt,
      teamRetry: { taskId: task.id, failureId: retry.failureId, attempt: retry.attempts + 1 },
      userText: encodeCoordination({ kind: "request", summary: `Reintento ${retry.attempts + 1} de ${retry.maxRetries} tras un fallo de ejecución.`,
        data: { error: retry.history.at(-1)?.error, action: "Inspecciona primero el estado real y los logs. Continúa únicamente el trabajo pendiente de esta tarea. No repitas operaciones con resultado no confirmado; verifica antes sus efectos. Conserva permisos, decisiones previas y límites. No hagas commit ni push manuales.", attempt: retry.attempts + 1 },
        refs: [`task:${task.id}`, `conversation:${task.workerConversationId}`] }),
    });
  }
  eventBus.emit(Events.AI_TEAM_TASK_DISPATCH, { executor, taskId: task.id, workerConversationId: task.workerConversationId });
}

/** Queue markers are evidence-bound, never a general bypass of stop/error gates. */
export function validExecutionRetry(task: TeamTask | null, turn: QueuedTurn): task is TeamTask {
  const receipt = turn.teamRetry;
  return Boolean(task?.id && receipt && task.id === receipt.taskId && !isTerminalTaskStatus(task.status)
    && task.workerConversationId === turn.conversationId && task.workerAgentId === turn.agentId
    && (task.projectId ?? null) === (turn.projectId ?? null)
    && (task.user?.userId ?? task.userId ?? null)?.toString() === (turn.user?.userId ?? turn.userId ?? null)?.toString()
    && task.retry?.state === "waiting" && task.retry.failureId === receipt.failureId
    && receipt.attempt === task.retry.attempts + 1 && receipt.attempt <= EXECUTION_MAX_RETRIES);
}
