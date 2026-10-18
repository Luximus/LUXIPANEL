// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { TeamTask } from "../models/team-task.types.js";
import type { QueuedTurn } from "../repositories/agent-queue.repository.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
const state = vi.hoisted(() => ({ task: null as TeamTask | null, queue: [] as QueuedTurn[], interrupted: false, active: false, slot: true, lease: true, cli: false }));
vi.mock("./agent.service.js", () => ({ agentService: { run: vi.fn() } }));
vi.mock("./team-tasks.service.js", () => ({ teamTasksService: { markCollected: vi.fn() } }));
vi.mock("./team-tasks/lifecycle.js", () => ({ finalizeTask: vi.fn(async (_e, _id, result) => { state.task!.status = result.status; }) }));
vi.mock("./team-approvals.js", () => ({ initTeamApprovalDelivery: vi.fn(), validTeamReview: vi.fn(async () => false) }));
vi.mock("./team-tasks/worker-quota.js", () => ({ hasWorkerSlot: vi.fn(() => state.slot), workerRunStarted: vi.fn(), workerRunEnded: vi.fn() }));
vi.mock("./team-isolation.service.js", () => ({ teamIsolationService: { tryAcquireLease: vi.fn(() => state.lease) } }));
vi.mock("./cli-job-tracker.service.js", () => ({ cliJobTracker: { hasJobForConversation: vi.fn(() => state.cli) } }));
vi.mock("./agent-context.service.js", () => ({
  resolveConversationBinding: vi.fn(async (_e, item) => item),
  admitAgentWork: vi.fn(async () => ({ release: vi.fn() })),
}));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: {
  deferQueueDrain: vi.fn(() => state.active), isActive: vi.fn(() => state.active),
  start: vi.fn(() => { state.active = true; }),
} }));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: {
  getTask: vi.fn(async () => state.task),
  updateTask: vi.fn(async (_e, _id, patch) => (state.task = { ...state.task!, ...patch })),
} }));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: {
  listFor: vi.fn(async () => state.queue), takeNext: vi.fn(async () => state.queue.shift()),
  remove: vi.fn(async (_e, id) => { state.queue = state.queue.filter(t => t.id !== id); return true; }),
} }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: {
  messages: vi.fn(async () => ({ items: [{ role: "assistant", error: "exit 1", content: "", messageId: "failure", interrupted: state.interrupted }] })),
  appendMessages: vi.fn(async () => undefined), getMeta: vi.fn(async () => ({ provider: "codex" })), patchRuntime: vi.fn(async () => undefined),
} }));
vi.mock("./mcp-run-tokens.js", () => ({ mintCrossMcpToken: vi.fn(), mintGraphMcpToken: vi.fn() }));
import { drainConversationQueue } from "./turn-queue.service.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { runWithExecutor } from "../../../shared/executor/index.js";
import { admitAgentWork } from "./agent-context.service.js";
import { finalizeTask } from "./team-tasks/lifecycle.js";
const executor = { target: { id: "retry-server" } } as Executor;
const user = { userId: 7, role: "admin" } as SessionUser;
const drain = () => runWithExecutor(executor, () => drainConversationQueue(executor, "worker-chat"), 7, user);
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T15:00:00Z"));
  state.active = false; state.interrupted = false; state.slot = true; state.lease = true; state.cli = false;
  state.task = { id: "t", status: "running", title: "Task", task: "Work", workerAgentId: "worker", workerConversationId: "worker-chat", workerAgentName: "Worker", leaderConversationId: "leader", leaderAgentId: "leader-agent", user, userId: "7", createdAt: "now", isolation: { mode: "lease", leasePath: "/project", cwd: "/project" },
    retry: { state: "waiting", attempts: 0, maxRetries: 3, delayMs: 30000, failureId: "failure", nextAttemptAt: "2026-10-18T15:00:30Z", history: [] } };
  state.queue = [{ id: "q", conversationId: "worker-chat", agentId: "worker", user, userId: "7", withContext: true, userText: "Verifica antes de continuar", auto: true, isWorker: true, ts: "now", teamRetry: { taskId: "t", failureId: "failure", attempt: 1 }, forcedCwd: "/project" }];
});
afterEach(async () => { await vi.runOnlyPendingTimersAsync(); vi.useRealTimers(); });
describe("durable retry queue", () => {
  it("waits exactly 30 seconds and starts only once after duplicate drains/recovery", async () => {
    await Promise.all([drain(), drain()]);
    expect(agentRunRegistry.start).not.toHaveBeenCalled();
    expect(state.queue).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29999);
    expect(agentRunRegistry.start).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(agentRunRegistry.start).toHaveBeenCalledOnce();
    expect(agentRunRegistry.start).toHaveBeenCalledWith(expect.objectContaining({ key: "worker-chat", executor, user, isWorker: true }));
    expect(state.task!.retry).toMatchObject({ state: "running", attempts: 1 });
    expect(state.queue).toHaveLength(0);
  });
  it.each(["slot", "lease", "cli"] as const)("does not overlap when blocked by %s", async condition => {
    if (condition === "cli") state.cli = true; else state[condition] = false;
    await drain(); await vi.advanceTimersByTimeAsync(30_000);
    expect(agentRunRegistry.start).not.toHaveBeenCalled();
    state.slot = true; state.lease = true; state.cli = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(agentRunRegistry.start).toHaveBeenCalledOnce();
  });
  it("honors a stop made during the delay", async () => {
    await drain(); state.interrupted = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(agentRunRegistry.start).not.toHaveBeenCalled(); expect(state.queue).toHaveLength(0);
    expect(state.task!.status).toBe("canceled");
  });
  it("discards stale retries after cancellation without starting work", async () => {
    await drain(); state.task!.status = "canceled";
    await vi.advanceTimersByTimeAsync(30_000);
    expect(agentRunRegistry.start).not.toHaveBeenCalled(); expect(state.queue).toHaveLength(0);
  });
  it("records an admission failure as the scheduled attempt instead of leaving it queued forever", async () => {
    vi.mocked(admitAgentWork).mockRejectedValueOnce(new Error("Provider temporarily unavailable"));
    await drain(); await vi.advanceTimersByTimeAsync(30_000);
    expect(agentRunRegistry.start).not.toHaveBeenCalled();
    expect(state.task!.retry?.attempts).toBe(1);
    expect(state.queue).toHaveLength(0);
    expect(finalizeTask).toHaveBeenCalledWith(executor, "t", expect.objectContaining({ status: "failed" }), { retryExecution: true, dispatchFailureId: "dispatch:q" });
  });
  it("records a launch failure after consuming the queued receipt", async () => {
    vi.mocked(agentRunRegistry.start).mockImplementationOnce(() => { throw new Error("Launch failed"); });
    await drain(); await vi.advanceTimersByTimeAsync(30_000);
    expect(agentRunRegistry.start).toHaveBeenCalledOnce();
    expect(state.task!.retry?.attempts).toBe(1);
    expect(finalizeTask).toHaveBeenCalledWith(executor, "t", expect.objectContaining({ error: "Error: Launch failed" }), { retryExecution: true, dispatchFailureId: "dispatch:q" });
    expect(state.queue).toHaveLength(0);
  });
});
