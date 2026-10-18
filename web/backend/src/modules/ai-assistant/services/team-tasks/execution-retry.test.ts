// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { TeamTask } from "../../models/team-task.types.js";
import type { Executor } from "../../../../shared/executor/index.js";
import type { QueuedTurn } from "../../repositories/agent-queue.repository.js";
const state = vi.hoisted(() => ({ task: null as TeamTask | null, queue: [] as QueuedTurn[], failureId: "first", interrupted: false }));
vi.mock("../../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: {
  updateTask: vi.fn(async (_e, _id, patch) => (state.task = { ...state.task!, ...patch })),
} }));
vi.mock("../../repositories/conversations.repository.js", () => ({ conversationsRepository: {
  messages: vi.fn(async () => ({ items: [{ role: "assistant", messageId: state.failureId, ts: "old", error: "exit 1", interrupted: state.interrupted }] })),
} }));
vi.mock("../../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: { listFor: vi.fn(async () => state.queue) } }));
vi.mock("../queued-turn-admission.js", () => ({ enqueueAgentTurn: vi.fn(async (_e, item) => { state.queue.push(item); return item; }) }));
vi.mock("../../repositories/assistant-audit.repository.js", () => ({ assistantAuditRepository: { append: vi.fn(async () => undefined) } }));
vi.mock("./task-events.js", () => ({ injectTaskUpdate: vi.fn() }));
import { scheduleExecutionRetry, ensureExecutionRetryQueued, validExecutionRetry, retryableExecutionError } from "./execution-retry.js";
import { coordinationTask } from "../../models/agent-envelope.js";
const executor = { target: { id: "server-a" } } as Executor;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T15:00:00Z"));
  state.failureId = "first"; state.interrupted = false; state.queue = [];
  state.task = { id: "t", workerConversationId: "w", workerAgentId: "a", leaderConversationId: "l", leaderAgentId: "leader", workerAgentName: "Worker", title: "Task", task: "Work", status: "running", createdAt: "old", userId: "7" };
});
afterEach(() => vi.useRealTimers());
describe("bounded worker retries", () => {
  it("schedules three retries 30 seconds after each failure, then keeps all four failure records", async () => {
    for (let failure = 0; failure <= 3; failure++) {
      state.failureId = `error-${failure}`;
      const result = await scheduleExecutionRetry(executor, state.task!, `exit 1 at ${failure}`);
      expect(state.task!.retry!.history).toHaveLength(failure + 1);
      if (failure === 3) {
        expect(result).toBeNull(); expect(state.task!.retry!.state).toBe("exhausted"); expect(state.queue).toHaveLength(0); break;
      }
      expect(Date.parse(state.task!.retry!.nextAttemptAt!) - Date.now()).toBe(30_000);
      expect(state.queue).toHaveLength(1);
      expect(validExecutionRetry(state.task, state.queue[0]!)).toBe(true);
      expect(state.queue[0]!.userText).toContain("verifica antes sus efectos");
      expect(() => coordinationTask(state.queue[0]!.userText)).not.toThrow();
      state.queue = [];
      state.task!.retry = { ...state.task!.retry!, state: "running", attempts: failure + 1 };
      await vi.advanceTimersByTimeAsync(30_000);
    }
  });
  it("deduplicates completion events and reconstructs a lost queue from the persisted receipt", async () => {
    await scheduleExecutionRetry(executor, state.task!, "exit 1");
    await scheduleExecutionRetry(executor, state.task!, "exit 1");
    expect(state.queue).toHaveLength(1); expect(state.task!.retry!.history).toHaveLength(1);
    state.queue = [];
    await ensureExecutionRetryQueued(executor, state.task!);
    expect(state.queue[0]!.teamRetry?.attempt).toBe(1);
    expect(state.queue[0]!.notBefore).toBe("2026-10-18T15:00:30.000Z");
  });
  it.each(["Permisos insuficientes", "El proveedor rechazó la autenticación del asistente.", "Acción denegada.", "forbidden", "Cancelada por el usuario."])("never retries an authority/stop failure: %s", async error => {
    expect(retryableExecutionError(error)).toBe(false);
    expect(await scheduleExecutionRetry(executor, state.task!, error)).toBeNull();
    expect(state.queue).toHaveLength(0);
  });
  it("does not restart a human interruption or a terminal task", async () => {
    state.interrupted = true;
    expect(await scheduleExecutionRetry(executor, state.task!, "timeout")).toBeNull();
    state.interrupted = false; state.task!.status = "canceled";
    expect(await scheduleExecutionRetry(executor, state.task!, "timeout")).toBeNull();
    expect(state.queue).toHaveLength(0);
  });
  it("redacts secrets in persisted diagnostics and rejects forged retry receipts", async () => {
    await scheduleExecutionRetry(executor, state.task!, "exit 1 password=secret-value Bearer fake-token");
    expect(JSON.stringify(state.task!.retry)).not.toContain("secret-value");
    expect(JSON.stringify(state.task!.retry)).not.toContain("fake-token");
    const turn = state.queue[0]!;
    expect(validExecutionRetry(state.task, { ...turn, userId: "8" })).toBe(false);
    expect(validExecutionRetry(state.task, { ...turn, conversationId: "other" })).toBe(false);
    expect(validExecutionRetry(state.task, { ...turn, projectId: "other" })).toBe(false);
    expect(validExecutionRetry(state.task, { ...turn, teamRetry: { ...turn.teamRetry!, attempt: 4 } })).toBe(false);
  });
});
