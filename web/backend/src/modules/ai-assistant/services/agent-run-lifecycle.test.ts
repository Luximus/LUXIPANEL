// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Real registry + queue + persistence; only providers and storage are simulated.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { AgentEvent } from "./providers/provider.types.js";
import type { QueuedTurn } from "../repositories/agent-queue.repository.js";
import type { ConversationMessage } from "../repositories/conversations.repository.js";

const io = vi.hoisted(() => ({
  history: new Map<string, ConversationMessage[]>(),
  queue: [] as Array<QueuedTurn & { target: string }>,
  order: [] as string[],
  contexts: [] as Array<{ target: string; user?: number }>,
  cli: false,
  beforeSave: undefined as undefined | ((messages: ConversationMessage[]) => Promise<void>),
  failUserSave: false,
  key: (executor: Executor, id: string) => JSON.stringify([executor.target.id, id]),
}));
vi.mock("../../../shared/worklog/worklog-recorder.service.js", () => ({ recordActivity: vi.fn() }));
vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: {
    getMeta: vi.fn(async (_executor: Executor, id: string) => ({ id, provider: "claude", projectId: null, agentId: null })),
    patchRuntime: vi.fn(async () => undefined),
    appendMessages: vi.fn(async (executor: Executor, id: string, messages: ConversationMessage[]) => {
      await io.beforeSave?.(messages);
      if (io.failUserSave && messages[0]?.role === "user") throw new Error("fixture queued history unavailable");
      const key = io.key(executor, id);
      io.history.set(key, [...(io.history.get(key) ?? []), ...messages]);
      io.order.push(...messages.map(message => "saved:" + message.role));
    }),
    messages: vi.fn(async (executor: Executor, id: string, options: { limit: number }) => {
      const all = io.history.get(io.key(executor, id)) ?? [];
      return { items: all.slice(-options.limit), total: all.length };
    }),
  },
}));
vi.mock("../repositories/agent-queue.repository.js", () => ({
  agentQueueRepository: {
    enqueue: vi.fn(async (executor: Executor, turn: Omit<QueuedTurn, "id" | "ts">) => {
      const item = { ...turn, id: "retry-" + io.queue.length, ts: "2026-10-17", target: executor.target.id };
      io.queue.push(item);
      return item;
    }),
    listFor: vi.fn(async (executor: Executor, id: string) => io.queue.filter(turn => turn.target === executor.target.id && turn.conversationId === id)),
    takeNext: vi.fn(async (executor: Executor, id: string, turnId: string) => {
      const index = io.queue.findIndex(turn => turn.target === executor.target.id && turn.conversationId === id && turn.id === turnId);
      return index < 0 ? null : io.queue.splice(index, 1)[0];
    }),
  },
}));
vi.mock("./agent-context.service.js", () => ({
  resolveConversationBinding: vi.fn(async (_executor: Executor, candidate: QueuedTurn) => ({
    agentId: candidate.agentId ?? null, projectId: candidate.projectId ?? null,
  })),
  admitAgentWork: vi.fn(async () => ({ release: vi.fn() })),
}));
vi.mock("./agent.service.js", () => ({
  agentService: {
    run: vi.fn(async function* (): AsyncGenerator<AgentEvent> {
      io.order.push("provider:start");
      io.contexts.push({ target: getContextExecutor().target.id, user: getContextUser()?.userId });
      if (io.cli) {
        yield { type: "tool_use", id: "cli", name: "claude.cli", input: {} };
        yield { type: "tool_result", id: "cli", success: true, output: "Respuesta verificada" };
      } else {
        yield { type: "text", delta: "Respuesta verificada", phase: "final_answer" };
      }
      yield { type: "done" };
    }),
  },
}));
vi.mock("./usage-recorder.js", () => ({
  makeUsageRecorder: (args: { cliHolder: { value: boolean } }) => (event: AgentEvent) => {
    if (event.type === "tool_use" && event.name.endsWith(".cli")) args.cliHolder.value = true;
  },
}));
vi.mock("./mcp-run-tokens.js", () => ({ mintCrossMcpToken: () => undefined, mintGraphMcpToken: () => undefined }));
vi.mock("./team-tasks.service.js", () => ({ teamTasksService: { markCollected: vi.fn() } }));
vi.mock("./team-tasks/worker-quota.js", () => ({ workerRunStarted: vi.fn(), workerRunEnded: vi.fn() }));
vi.mock("../repositories/attachments.repository.js", () => ({ attachmentsRepository: { storeMany: vi.fn() } }));
vi.mock("../repositories/cli-jobs.repository.js", () => ({ cliJobsRepository: { delete: vi.fn(async () => undefined) } }));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: {} }));
vi.mock("../repositories/agents.repository.js", () => ({ agentsRepository: {} }));
vi.mock("../repositories/agent-messages.repository.js", () => ({ agentMessagesRepository: {} }));
vi.mock("./cli-job-tracker.service.js", () => ({ cliJobTracker: {} }));

import { getContextExecutor, getContextUser, runWithExecutor } from "../../../shared/executor/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { agentService } from "./agent.service.js";
import { drainConversationQueue, initTeamVerifyRetryListener, persistAssistantMessage, startConversationRun } from "./turn-queue.service.js";

const executor = { target: { id: "lifecycle-target" } } as Executor;
const otherExecutor = { target: { id: "other-lifecycle-target" } } as Executor;
const user = { userId: 7, username: "fixture", displayName: "Fixture", role: "admin", modules: ["assistant"], kind: "admin" } as SessionUser;
let counter = 0;
const nextKey = () => "lifecycle-" + ++counter;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function holdSave(reject = false) {
  const entered = deferred(), release = deferred();
  io.beforeSave = async messages => {
    if (messages[0]?.role !== "assistant") return;
    io.beforeSave = undefined;
    entered.resolve();
    await release.promise;
    if (reject) throw new Error("fixture assistant history unavailable");
  };
  return { entered, release };
}
function queueTurn(key: string, target = executor.target.id) {
  io.queue.push({ id: target + "-follow-up", target, conversationId: key, userText: "Continuar",
    withContext: true, user, userId: "7", ts: "2026-10-17", auto: true });
}
function start(key: string) {
  const starts = vi.spyOn(agentRunRegistry, "start");
  startConversationRun({ executor, conversationId: key, messages: [{ role: "user", content: "Trabajo" }],
    provider: "claude", user, userId: "7", withContext: true });
  const run = starts.mock.results[0]!.value as ReturnType<typeof agentRunRegistry.start>;
  return { run, starts };
}
function terminals(events: AgentEvent[]) {
  return events.filter(event => event.type === "done" || event.type === "error");
}
initTeamVerifyRetryListener();
beforeEach(() => {
  io.history.clear(); io.queue.length = 0; io.order.length = 0; io.contexts.length = 0;
  io.cli = false; io.beforeSave = undefined; io.failUserSave = false;
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe("persistence release and real queue continuation", () => {
  it.each([false, true])("resumes exactly once after onComplete, without awaiting itself (CLI=%s)", async cli => {
    io.cli = cli;
    const key = nextKey(), save = holdSave();
    queueTurn(key); queueTurn(key, otherExecutor.target.id);
    const { run, starts } = start(key);
    const received: AgentEvent[] = [];
    await save.entered.promise;
    const unsubscribe = agentRunRegistry.attach(key, 0, event => {
      received.push(event);
      if (event.type === "done") io.order.push("terminal:done");
    }, executor.target.id);
    try {
      await Promise.all([drainConversationQueue(executor, key), drainConversationQueue(executor, key)]);
      expect(agentRunRegistry.activeCountForUser(7, executor.target.id)).toBe(1);
      expect(agentRunRegistry.runContext(key, executor.target.id)).toMatchObject({ executor, ownerUserId: 7 });
      expect(agentRunRegistry.runContext(key, otherExecutor.target.id)).toBeNull();
      expect(agentService.run).toHaveBeenCalledTimes(1);
      expect(io.queue).toHaveLength(2);
      expect(terminals(received)).toHaveLength(0);
      save.release.resolve();
      await run.completion;
      expect(starts).toHaveBeenCalledTimes(2);
      const successor = starts.mock.results[1]!.value as typeof run;
      expect(successor).not.toBe(run);
      await successor.completion;
      expect(agentService.run).toHaveBeenCalledTimes(2);
      expect(terminals(received)).toEqual([{ type: "done" }]);
      expect(io.order.indexOf("saved:assistant")).toBeLessThan(io.order.indexOf("terminal:done"));
      expect(io.order.indexOf("terminal:done")).toBeLessThan(io.order.lastIndexOf("provider:start"));
      expect(io.history.get(io.key(executor, key))?.map(message => message.role)).toEqual(["assistant", "user", "assistant"]);
      expect(io.queue.map(turn => turn.target)).toEqual([otherExecutor.target.id]);
      expect(io.contexts).toEqual([{ target: executor.target.id, user: 7 }, { target: executor.target.id, user: 7 }]);
    } finally {
      save.release.resolve();
      await run.completion;
      unsubscribe?.();
    }
  });

  it("keeps the durable continuation queued when saving the current result fails", async () => {
    const key = nextKey(), save = holdSave(true);
    queueTurn(key);
    const { run } = start(key);
    await save.entered.promise;
    const received: AgentEvent[] = [];
    const unsubscribe = agentRunRegistry.attach(key, 0, event => received.push(event), executor.target.id);
    try {
      await drainConversationQueue(executor, key);
      save.release.resolve();
      await run.completion;
      expect(agentService.run).toHaveBeenCalledTimes(1);
      expect(io.queue).toHaveLength(1);
      expect(io.history.get(io.key(executor, key))).toBeUndefined();
      expect(terminals(received)).toEqual([{ type: "error", message: expect.stringContaining("guardado") }]);
    } finally { save.release.resolve(); await run.completion; unsubscribe?.(); }
  });

  it("does not rewrite a saved terminal when dispatch fails; the queued turn can recover", async () => {
    const key = nextKey();
    queueTurn(key);
    io.failUserSave = true;
    const { run, starts } = start(key);
    await run.completion;
    expect(terminals(run.events)).toEqual([{ type: "done" }]);
    expect(io.queue).toHaveLength(1);
    expect(starts).toHaveBeenCalledTimes(1);
    io.failUserSave = false;
    await drainConversationQueue(executor, key);
    const successor = starts.mock.results[1]!.value as typeof run;
    await successor.completion;
    expect(agentService.run).toHaveBeenCalledTimes(2);
    expect(io.queue).toHaveLength(0);
    expect(terminals(run.events)).toEqual([{ type: "done" }]);
  });

  it("preserves a verify retry enqueued while the worker completion hook still owns the run", async () => {
    const key = nextKey(), closing = deferred(), release = deferred();
    const run = agentRunRegistry.start({
      key, executor, user, isWorker: true,
      makeGen: async function* () { yield { type: "text", delta: "Primera respuesta" }; yield { type: "done" }; },
      onComplete: async text => {
        await persistAssistantMessage(executor, key, text, "claude", false);
        eventBus.emit(Events.AI_TEAM_TASK_VERIFY_RETRY, {
          executor, taskId: "fixture-task", workerConversationId: key, workerAgentId: "worker",
          user, userId: "7", logTail: "fixture verification failed", attempt: 1, maxAttempts: 2,
        });
        closing.resolve();
        await release.promise;
      },
    });
    try {
      await closing.promise;
      await vi.waitFor(() => expect(io.queue).toHaveLength(1));
      await drainConversationQueue(executor, key);
      expect(agentRunRegistry.isActive(key, executor.target.id)).toBe(true);
      expect(agentService.run).not.toHaveBeenCalled();
      release.resolve();
      await run.completion;
      await vi.waitFor(() => expect(agentRunRegistry.isActive(key, executor.target.id)).toBe(false));
      expect(agentService.run).toHaveBeenCalledTimes(1);
      expect(io.queue).toHaveLength(0);
      expect(io.contexts).toEqual([{ target: executor.target.id, user: 7 }]);
    } finally { release.resolve(); await run.completion; }
  });
});

describe("one terminal and bounded shutdown", () => {
  it.each([
    { throws: false, rejects: false }, { throws: true, rejects: false },
    { throws: false, rejects: true }, { throws: true, rejects: true },
  ])("defers provider errors until storage settles (%j)", async ({ throws, rejects }) => {
    const key = nextKey(), entered = deferred(), release = deferred();
    const run = agentRunRegistry.start({
      key, executor,
      makeGen: async function* () {
        yield { type: "text", phase: "commentary", delta: "Avance" };
        if (throws) throw new Error("fixture provider error");
        yield { type: "error", message: "fixture provider error" };
      },
      onComplete: async () => {
        entered.resolve(); await release.promise;
        if (rejects) throw new Error("fixture storage error");
      },
    });
    await entered.promise;
    const events: AgentEvent[] = [];
    const unsubscribe = agentRunRegistry.attach(key, 0, event => events.push(event), executor.target.id);
    try {
      expect(terminals(events)).toHaveLength(0);
      release.resolve();
      await run.completion;
      expect(terminals(events)).toEqual([{ type: "error", message: rejects ? expect.stringContaining("guardado") : "fixture provider error" }]);
    } finally { release.resolve(); await run.completion; unsubscribe?.(); }
  });

  it.each([false, true])("waits for an already-started save and prevents a successor during shutdown (CLI=%s)", async cli => {
    const key = nextKey(), entered = deferred(), release = deferred();
    const drain = vi.fn(async () => undefined);
    const run = agentRunRegistry.start({
      key, executor, cli,
      makeGen: async function* () { yield { type: "done", pending: true }; },
      onComplete: async () => { entered.resolve(); await release.promise; },
    });
    await entered.promise;
    agentRunRegistry.deferQueueDrain(key, drain, executor.target.id);
    let stopped = false;
    const shutdown = agentRunRegistry.gracefulShutdown(1000).then(result => { stopped = true; return result; });
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(stopped).toBe(false);
      expect(run.ac.signal.aborted).toBe(false);
      release.resolve();
      expect(await shutdown).toEqual({ flushed: 1, cliDetached: 0 });
      await run.completion;
      expect(drain).not.toHaveBeenCalled();
      expect(terminals(run.events)).toEqual([{ type: "done", pending: true }]);
    } finally { release.resolve(); await Promise.all([run.completion, shutdown]); }
  });

  it.each([false, true])("does not dispatch a late queue wake-up after shutdown has flushed the save (CLI=%s)", async cli => {
    const key = nextKey(), entered = deferred(), release = deferred();
    queueTurn(key);
    const settled = vi.fn();
    eventBus.on(Events.AI_TURN_SETTLED, settled);
    const run = agentRunRegistry.start({
      key, executor, cli,
      makeGen: async function* () { yield { type: "done", pending: true }; },
      onComplete: async () => { entered.resolve(); await release.promise; },
    });
    await entered.promise;
    const shutdown = agentRunRegistry.gracefulShutdown(1000);
    try {
      release.resolve();
      await shutdown;
      await run.completion;
      await drainConversationQueue(executor, key);
      expect(agentService.run).not.toHaveBeenCalled();
      expect(io.queue).toHaveLength(1);
      expect(settled).not.toHaveBeenCalled();
    } finally {
      release.resolve(); await Promise.all([run.completion, shutdown]);
      eventBus.off(Events.AI_TURN_SETTLED, settled);
    }
  });

  it("keeps ownership after the shutdown deadline while a save is still pending", async () => {
    const key = nextKey(), entered = deferred(), release = deferred();
    const run = agentRunRegistry.start({
      key, executor,
      makeGen: async function* () { yield { type: "done", pending: true }; },
      onComplete: async () => { entered.resolve(); await release.promise; },
    });
    await entered.promise;
    try {
      await agentRunRegistry.gracefulShutdown(5);
      expect(agentRunRegistry.isActive(key, executor.target.id)).toBe(true);
      expect(terminals(run.events)).toHaveLength(0);
    } finally { release.resolve(); await run.completion; }
  });
});
