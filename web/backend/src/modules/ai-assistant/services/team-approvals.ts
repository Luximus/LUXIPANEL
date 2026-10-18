// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from "node:crypto";
import { getContextExecutor, runWithExecutor, type Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { resolveLiveAuthorization } from "../../auth/services/live-authorization.service.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { conversationsRepository, type ConversationMessage } from "../repositories/conversations.repository.js";
import { agentQueueRepository, type QueuedTurn } from "../repositories/agent-queue.repository.js";
import { assistantAuditRepository } from "../repositories/assistant-audit.repository.js";
import { isTerminalTaskStatus, type TeamTask } from "../models/team-task.types.js";
import { coordinationTask, encodeCoordination } from "../models/agent-envelope.js";
import { permissionBroker } from "./permission-broker.js";
import { resolveAgentContext, resolveConversationBinding } from "./agent-context.service.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { cliJobTracker } from "./cli-job-tracker.service.js";
import { enqueueAgentTurn } from "./queued-turn-admission.js";
import { hasWaiters, pingWaiters } from "./team-tasks/waiters.js";
import { injectTaskUpdate } from "./team-tasks/task-events.js";

const log = createModuleLogger("assistant-team-approvals");
export interface TeamApproval {
  taskId: string;
  requestId: string;
  kind: "permission" | "plan";
  title: string;
  detail?: string;
  tool?: string;
}
export function planRequestId(message: ConversationMessage): string {
  return `plan:${createHash("sha256").update(JSON.stringify([message.messageId, message.ts, message.content, message.ask])).digest("hex").slice(0, 32)}`;
}
async function requestsForTask(executor: Executor, task: TeamTask): Promise<TeamApproval[]> {
  if (!task.id || isTerminalTaskStatus(task.status)) return [];
  const uid = task.user?.userId ?? (task.userId ? Number(task.userId) : null);
  const requests: TeamApproval[] = permissionBroker.pendingRequests(task.workerConversationId, executor.target.id)
    .filter(r => uid !== null && r.userId === uid)
    .map(r => ({ taskId: task.id!, requestId: r.id, kind: "permission", title: r.title, tool: r.tool, ...(r.detail ? { detail: r.detail } : {}) }));
  if (requests.length || agentRunRegistry.isActive(task.workerConversationId, executor.target.id)) return requests;
  const { items } = await conversationsRepository.messages(executor, task.workerConversationId, { limit: 1 });
  const last = items.at(-1);
  if (last?.role === "assistant" && !last.interrupted && !last.error && last.askKind === "plan-approval" && last.ask?.length) {
    requests.push({ taskId: task.id, requestId: planRequestId(last), kind: "plan", title: "Revisar plan del trabajador", detail: last.content });
  }
  return requests;
}

/** Re-resolve identities on EACH decision, not from the tool roster snapshot. */
async function authorizeLeader(executor: Executor, conversationId: string, task: TeamTask, user?: SessionUser) {
  if (!user || task.leaderConversationId !== conversationId || isTerminalTaskStatus(task.status)
    || String(task.user?.userId ?? task.userId ?? "") !== String(user.userId)) throw new Error("La tarea no pertenece a este líder y usuario.");
  const live = await resolveLiveAuthorization(user, executor);
  const binding = await resolveConversationBinding(executor, { conversationId, agentId: task.leaderAgentId, projectId: task.projectId }, live);
  const leader = await resolveAgentContext(executor, binding.agentId, binding.projectId, live, false);
  const worker = await resolveAgentContext(executor, task.workerAgentId, task.projectId, live, false);
  if ((!leader.agent?.canSpawnChats && !leader.role?.canSpawnChats) || worker.agent?.parentAgentId !== leader.agent?.id
    || leader.projectId !== worker.projectId) throw new Error("No hay una relación de supervisión vigente para esta tarea.");
  await resolveConversationBinding(executor, { conversationId: task.workerConversationId, agentId: task.workerAgentId, projectId: task.projectId }, live);
  return live;
}

export async function listTeamApprovals(executor: Executor, conversationId: string, user?: SessionUser): Promise<TeamApproval[]> {
  const tasks = await teamTasksRepository.listForLeaderConversation(executor, conversationId);
  const result: TeamApproval[] = [];
  for (const task of tasks.filter(t => !isTerminalTaskStatus(t.status))) {
    await authorizeLeader(executor, conversationId, task, user);
    result.push(...await requestsForTask(executor, task));
  }
  return result;
}

const decisions = new Map<string, Promise<unknown>>();
export async function reviewTeamApproval(args: { executor: Executor; conversationId: string; user?: SessionUser; taskId: string; requestId: string; decision: "allow" | "deny"; reason: string }) {
  const key = JSON.stringify([args.executor.target.id, args.taskId, args.requestId]);
  const previous = decisions.get(key) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(async () => {
    const { executor, conversationId, taskId, requestId, decision } = args;
    const task = await teamTasksRepository.getTask(executor, taskId);
    if (!task) throw new Error("Tarea no encontrada.");
    const live = await authorizeLeader(executor, conversationId, task, args.user);
    if (agentRunRegistry.getApproval(conversationId)?.mode === "plan") throw new Error("El líder está en modo Plan; todavía no puede autorizar ejecución.");
    const request = (await requestsForTask(executor, task)).find(r => r.requestId === requestId);
    if (!request) throw new Error("La solicitud ya se resolvió o cambió; consulta team.approvals.");
    if (request.kind === "permission") {
      const resolved = await runWithExecutor(executor, () => permissionBroker.resolve(task.workerConversationId, requestId, decision), live.userId, live);
      if (!resolved) throw new Error("La solicitud ya no está pendiente.");
    } else {
      const queued = await agentQueueRepository.listFor(executor, task.workerConversationId);
      if (queued.some(q => q.teamReview?.requestId === requestId)) throw new Error("La decisión ya fue encolada.");
      await enqueueAgentTurn(executor, {
        conversationId: task.workerConversationId, projectId: task.projectId ?? null, agentId: task.workerAgentId,
        withContext: true, auto: true, isWorker: true, user: live, userId: String(live.userId), forcedCwd: task.isolation?.cwd ?? null,
        teamReview: { taskId, requestId }, ...(decision === "allow" ? { planDecision: "approve" as const } : {}),
        userText: encodeCoordination({ kind: "request", summary: decision === "allow" ? "El líder aprobó este plan." : "El líder rechazó este plan.",
          data: { decision, reason: args.reason.slice(0, 1000), action: decision === "allow" ? "Ejecuta únicamente el plan revisado dentro de los permisos y alcance originales." : "No ejecutes el plan rechazado. Revisa la objeción del líder y presenta una propuesta corregida." },
          refs: [`task:${taskId}`, `request:${requestId}`, `conversation:${conversationId}`] }),
      });
      eventBus.emit(Events.AI_TEAM_TASK_DISPATCH, { executor, taskId, workerConversationId: task.workerConversationId });
    }
    await assistantAuditRepository.append({ ts: new Date().toISOString(), provider: "team", tool: `team.review:${decision}`, success: true, durationMs: 0, userId: String(live.userId) }, executor);
    log.info({ targetId: executor.target.id, taskId, requestId, leaderConversationId: conversationId, decision, userId: live.userId }, "leader resolved worker approval");
    return { resolved: true, decision, taskId, requestId };
  });
  decisions.set(key, result);
  try { return await result; } finally { if (decisions.get(key) === result) decisions.delete(key); }
}

export async function validTeamReview(executor: Executor, turn: QueuedTurn): Promise<boolean> {
  if (!turn.teamReview) return false;
  const task = await teamTasksRepository.getTask(executor, turn.teamReview.taskId);
  if (!task || task.workerConversationId !== turn.conversationId || task.workerAgentId !== turn.agentId || (task.projectId ?? null) !== (turn.projectId ?? null)) return false;
  await authorizeLeader(executor, task.leaderConversationId, task, turn.user ?? undefined);
  if ((await requestsForTask(executor, task)).some(r => r.kind === "plan" && r.requestId === turn.teamReview!.requestId)) return true;
  // A crash after persisting this queued answer but before consuming the
  // receipt must not lose the approval. Only this exact automatic answer can
  // bridge to its immediately preceding proposal; later user turns cannot.
  const { items } = await conversationsRepository.messages(executor, task.workerConversationId, { limit: 2 });
  const last = items.at(-1), proposal = items.at(-2);
  return Boolean(last?.role === "user" && last.auto && last.content === coordinationTask(turn.userText)
    && proposal?.role === "assistant" && proposal.askKind === "plan-approval" && proposal.ask?.length
    && planRequestId(proposal) === turn.teamReview.requestId);
}

let wired = false;
const delivering = new Set<string>();
/** A pending permission wakes an idle leader or releases its collect wait. */
export function initTeamApprovalDelivery(drain: (executor: Executor, conversationId: string) => Promise<void>): void {
  if (wired) return;
  wired = true;
  const deliver = (payload: { conversationId: string; targetId?: string }) => {
    const executor = getContextExecutor();
    if (!executor || (payload.targetId && executor.target.id !== payload.targetId)) return;
    const key = JSON.stringify([executor.target.id, payload.conversationId]);
    if (delivering.has(key)) return;
    delivering.add(key);
    void (async () => {
      const task = await teamTasksRepository.findByWorkerConversation(executor, payload.conversationId);
      if (!task?.id || task.leaderAgentId.startsWith("realtime:")) return;
      const requests = await requestsForTask(executor, task);
      if (!requests.length) return;
      await authorizeLeader(executor, task.leaderConversationId, task, task.user ?? undefined);
      const updated = await teamTasksRepository.updateTask(executor, task.id, { pendingPermission: true });
      if (updated) injectTaskUpdate(updated, executor.target.id);
      const waiting = hasWaiters(task.leaderConversationId, executor.target.id);
      pingWaiters(task.leaderConversationId, executor.target.id);
      if (waiting) return;
      for (const request of requests) {
        const notice = `${task.id}:${request.requestId}`;
        const queue = await agentQueueRepository.listFor(executor, task.leaderConversationId);
        if (queue.some(q => q.teamReviewNotice === notice)) continue;
        const text = encodeCoordination({ kind: "request", summary: "Un trabajador necesita una decisión del líder.",
          data: { taskId: task.id, requestId: request.requestId, kind: request.kind, action: "Consulta team.approvals para leer la solicitud completa y usa team.review para aprobar o rechazar con un motivo. Decide según el pedido y permisos del usuario; no autorices alcance adicional." },
          refs: { conversationId: task.workerConversationId } });
        if (agentRunRegistry.isActive(task.leaderConversationId, executor.target.id)
          && await cliJobTracker.steerConversation(task.leaderConversationId, text).catch(() => false)) continue;
        await enqueueAgentTurn(executor, { conversationId: task.leaderConversationId, agentId: task.leaderAgentId,
          projectId: task.projectId ?? null, withContext: true, auto: true, user: task.user ?? null, userId: task.userId ?? null,
          userText: text, teamReviewNotice: notice });
        await drain(executor, task.leaderConversationId);
      }
    })().catch(err => log.warn({ conversationId: payload.conversationId, error: String(err) }, "leader approval delivery failed"))
      .finally(() => delivering.delete(key));
  };
  eventBus.on(Events.AI_PERMISSION_REQUESTED, deliver);
  eventBus.on(Events.AI_TURN_SETTLED, deliver);
}
