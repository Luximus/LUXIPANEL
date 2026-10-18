// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { runWithExecutor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { TeamTask } from "../models/team-task.types.js";
import type { ConversationMessage } from "../repositories/conversations.repository.js";
const state = vi.hoisted(() => ({
  task: null as TeamTask | null, last: null as ConversationMessage | null, queue: [] as Record<string, any>[],
  parent: "leader", supervisor: true, revoked: false, mode: "manual", active: new Set<string>(),
}));
vi.mock("../../auth/services/live-authorization.service.js", () => ({ resolveLiveAuthorization: vi.fn(async user => {
  if (state.revoked) throw new Error("Account disabled"); return user;
}) }));
vi.mock("./agent-context.service.js", () => ({
  resolveConversationBinding: vi.fn(async (_e, binding) => binding),
  resolveAgentContext: vi.fn(async (_e, id, projectId) => ({ agent: { id, canSpawnChats: id === "leader" && state.supervisor, parentAgentId: id === "worker" ? state.parent : null }, projectId, role: null })),
}));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: {
  getTask: vi.fn(async (_e, id) => state.task?.id === id ? state.task : null),
  listForLeaderConversation: vi.fn(async () => state.task ? [state.task] : []),
  findByWorkerConversation: vi.fn(async () => state.task),
  updateTask: vi.fn(async (_e, _id, patch) => (state.task = { ...state.task!, ...patch })),
} }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: { messages: vi.fn(async () => ({ items: state.last ? [state.last] : [] })) } }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: {
  inject: vi.fn(() => true), activeRuns: vi.fn(() => []), isActive: vi.fn(id => state.active.has(id)),
  getApproval: vi.fn(() => ({ mode: state.mode })),
} }));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: { listFor: vi.fn(async (_e, id) => state.queue.filter(t => t.conversationId === id)) } }));
vi.mock("./queued-turn-admission.js", () => ({ enqueueAgentTurn: vi.fn(async (_e, turn) => { state.queue.push(turn); return turn; }) }));
vi.mock("../repositories/assistant-audit.repository.js", () => ({ assistantAuditRepository: { append: vi.fn(async () => undefined) } }));
vi.mock("./cli-job-tracker.service.js", () => ({ cliJobTracker: { steerConversation: vi.fn(async () => false) } }));
vi.mock("./team-tasks/task-events.js", () => ({ injectTaskUpdate: vi.fn() }));
import { permissionBroker } from "./permission-broker.js";
import { listTeamApprovals, reviewTeamApproval, planRequestId, validTeamReview, initTeamApprovalDelivery } from "./team-approvals.js";
import { coordinationTask } from "../models/agent-envelope.js";
const executor = { target: { id: "server-a" } } as Executor;
const user = { userId: 7, username: "test", role: "admin", kind: "admin" } as SessionUser;
const scope = <T>(fn: () => T) => runWithExecutor(executor, fn, 7, user);
const decide = (requestId: string, decision: "allow" | "deny" = "allow") => reviewTeamApproval({ executor, conversationId: "leader-chat", taskId: "task", requestId, decision, reason: "Dentro de la tarea autorizada", user });
beforeEach(() => {
  state.task = { id: "task", status: "running", leaderAgentId: "leader", leaderConversationId: "leader-chat", workerAgentId: "worker", workerConversationId: "worker-chat", workerAgentName: "Worker", title: "Task", task: "Work", projectId: "p", createdAt: "now", user, userId: "7" };
  state.last = null; state.queue = []; state.parent = "leader"; state.supervisor = true; state.revoked = false; state.mode = "manual"; state.active = new Set();
});
afterEach(() => scope(() => permissionBroker.cancelConversation("worker-chat")));
describe("leader approval authority", () => {
  it.each(["allow", "deny"] as const)("resolves a scoped pending permission as %s without changing global approval policy", async decision => {
    const promise = scope(() => permissionBroker.request({ conversationId: "worker-chat", tool: "Bash", title: "Run checks", detail: "npm test" }));
    const requests = await scope(() => listTeamApprovals(executor, "leader-chat", user));
    expect(requests[0]).toMatchObject({ kind: "permission", detail: "npm test" });
    expect(await scope(() => decide(requests[0]!.requestId, decision))).toMatchObject({ resolved: true, decision });
    expect(await promise).toBe(decision);
    await expect(scope(() => decide(requests[0]!.requestId))).rejects.toThrow("ya se resolvió");
  });
  it.each(["different-user", "different-leader", "removed-supervisor", "removed-parent", "revoked", "plan-mode"])("rejects %s", async reason => {
    const promise = scope(() => permissionBroker.request({ conversationId: "worker-chat", tool: "Bash", title: "Change" }));
    const request = scope(() => permissionBroker.pendingRequests("worker-chat"))[0]!;
    if (reason === "different-user") state.task!.user = { ...user, userId: 8 };
    if (reason === "different-leader") state.task!.leaderConversationId = "elsewhere";
    if (reason === "removed-supervisor") state.supervisor = false;
    if (reason === "removed-parent") state.parent = "other";
    if (reason === "revoked") state.revoked = true;
    if (reason === "plan-mode") state.mode = "plan";
    await expect(scope(() => decide(request.id))).rejects.toThrow();
    expect(scope(() => permissionBroker.pendingCount("worker-chat"))).toBe(1);
    scope(() => permissionBroker.cancelConversation("worker-chat")); expect(await promise).toBe("deny");
  });
  it("does not read or resolve a request on another server with the same conversation id", async () => {
    const other = { target: { id: "server-b" } } as Executor;
    const promise = runWithExecutor(other, () => permissionBroker.request({ conversationId: "worker-chat", tool: "Bash", title: "Other server" }), 7, user);
    const id = runWithExecutor(other, () => permissionBroker.pendingRequests("worker-chat"))[0]!.id;
    expect(await scope(() => listTeamApprovals(executor, "leader-chat", user))).toEqual([]);
    await expect(scope(() => decide(id))).rejects.toThrow("ya se resolvió");
    runWithExecutor(other, () => permissionBroker.cancelConversation("worker-chat")); expect(await promise).toBe("deny");
  });
  it("binds a plan decision to the complete exact proposal and preserves a rejection", async () => {
    state.last = { role: "assistant", content: "Plan completo de la tarea", ts: "t1", askKind: "plan-approval", ask: [{ id: "plan", type: "single", text: "¿Apruebas?", options: ["Sí", "No"] }] };
    const id = planRequestId(state.last);
    expect((await scope(() => listTeamApprovals(executor, "leader-chat", user)))[0]?.detail).toBe(state.last.content);
    await scope(() => decide(id, "deny"));
    expect(state.queue[0]?.planDecision).toBeUndefined();
    expect(state.queue[0]?.userText).toContain("No ejecutes el plan rechazado");
    expect(() => coordinationTask(state.queue[0]!.userText)).not.toThrow();
    await expect(scope(() => decide(id))).rejects.toThrow("ya fue encolada");
    state.last = { ...state.last, content: "Un plan diferente" };
    await expect(scope(() => decide(id))).rejects.toThrow("ya se resolvió");
  });
  it("only issues an auto-mode continuation for an approved plan receipt", async () => {
    state.last = { role: "assistant", content: "Plan", ts: "t1", askKind: "plan-approval", ask: [{ id: "plan", type: "single", text: "¿Apruebas?", options: ["Sí", "No"] }] };
    await scope(() => decide(planRequestId(state.last!)));
    expect(state.queue[0]).toMatchObject({ auto: true, isWorker: true, planDecision: "approve", teamReview: { taskId: "task" }, user });
    expect(await scope(() => validTeamReview(executor, state.queue[0] as never))).toBe(true);
    state.last = { ...state.last!, ts: "t2" };
    expect(await scope(() => validTeamReview(executor, state.queue[0] as never))).toBe(false);
  });
  it("registers the pending request before notifying its supervisor", async () => {
    const drain = vi.fn(async () => undefined);
    initTeamApprovalDelivery(drain);
    const promise = scope(() => permissionBroker.request({ conversationId: "worker-chat", tool: "Bash", title: "Run checks" }));
    await vi.waitFor(() => expect(state.queue).toHaveLength(1));
    expect(state.queue[0]).toMatchObject({ conversationId: "leader-chat", auto: true, user });
    expect(state.queue[0]?.userText).toContain("team.approvals");
    expect(drain).toHaveBeenCalledWith(executor, "leader-chat");
    scope(() => permissionBroker.cancelConversation("worker-chat")); expect(await promise).toBe("deny");
  });
});
