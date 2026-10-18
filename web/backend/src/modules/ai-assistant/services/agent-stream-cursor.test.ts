// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Real registry, persistence and SSE controller. Provider/storage I/O is simulated.
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { Executor } from "../../../shared/executor/index.js";
import type { ConversationMessage } from "../repositories/conversations.repository.js";
import type { AgentEvent } from "./providers/provider.types.js";
import type { AgentStreamRecoveryError, AgentStreamState, StartRunParams } from "./agent-run-registry.js";

const io = vi.hoisted(() => ({
  history: new Map<string, ConversationMessage[]>(),
  owned: true,
  recovery: vi.fn(async () => false),
}));
vi.mock("../../../shared/worklog/worklog-recorder.service.js", () => ({ recordActivity: vi.fn() }));
vi.mock("../../../shared/executor/index.js", async importOriginal => ({
  ...await importOriginal<typeof import("../../../shared/executor/index.js")>(),
  getExecutor: (req: { executor: Executor }) => req.executor,
}));
vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: {
    getMeta: vi.fn(async () => null),
    listIds: vi.fn(async () => new Set(io.owned ? [...io.history.keys()] : [])),
    appendMessages: vi.fn(async (_executor: Executor, key: string, messages: ConversationMessage[]) => {
      io.history.set(key, [...(io.history.get(key) ?? []), ...messages]);
    }),
  },
}));
vi.mock("./agent.service.js", () => ({ agentService: {} }));
vi.mock("./queued-turn-admission.js", () => ({ enqueueAgentTurn: vi.fn() }));
vi.mock("./agent-context.service.js", () => ({ resolveConversationBinding: vi.fn() }));
vi.mock("./permission-broker.js", () => ({ permissionBroker: {} }));
vi.mock("./cli-job-tracker.service.js", () => ({ cliJobTracker: {} }));
vi.mock("../repositories/cli-jobs.repository.js", () => ({ cliJobsRepository: {} }));
vi.mock("../repositories/cli-sessions.repository.js", () => ({ cliSessionsRepository: {} }));
vi.mock("./cli-run-recovery.service.js", () => ({ recoverConversation: io.recovery }));
vi.mock("./providers/cli/cli-session.js", () => ({ activeCodexWriterSessions: vi.fn() }));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: {} }));
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: {} }));
vi.mock("./slash-commands.service.js", () => ({ slashCommandsService: {} }));
vi.mock("./context-window.service.js", () => ({ assessContext: vi.fn() }));
vi.mock("./compaction.service.js", () => ({ compactConversation: vi.fn() }));
vi.mock("./mcp-run-tokens.js", () => ({ mintCrossMcpToken: vi.fn(), mintGraphMcpToken: vi.fn() }));
vi.mock("./turn-queue.service.js", () => ({
  MAX_MSG_CONTENT: 32000,
  persistUserMessage: vi.fn(), buildMessagesFromHistory: vi.fn(),
  makeUsageRecorder: vi.fn(), startConversationRun: vi.fn(), drainConversationQueue: vi.fn(),
}));

import { runWithExecutor } from "../../../shared/executor/index.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { persistAssistantMessage } from "./assistant-message-persistence.js";
import { agentController } from "../controllers/agent.controller.js";

const executor = { target: { id: "cursor-target" } } as Executor;
let count = 0;
type Run = ReturnType<typeof agentRunRegistry.start>;
type Frame = { event: AgentEvent | AgentStreamRecoveryError; seq: number; runId: string };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
const userMessage = (content: string): ConversationMessage => ({ role: "user", content, ts: new Date().toISOString() });
function save(key: string) {
  return vi.fn(async (...args: Parameters<NonNullable<StartRunParams["onComplete"]>>) =>
    persistAssistantMessage(executor, key, args[0], "openai", false,
      args[2], args[3], undefined, args[4], args[5], args[6], args[7], args[8], args[9]));
}
async function firstTurn() {
  const key = "cursor-" + ++count, entered = deferred(), release = deferred();
  const mutate = vi.fn(), persist = save(key);
  io.history.set(key, [userMessage("Primera solicitud")]);
  const run = agentRunRegistry.start({
    key, executor,
    makeGen: async function* () {
      mutate();
      yield { type: "tool_use", id: "write-A", name: "files.write", input: { path: "a.txt" } };
      yield { type: "tool_result", id: "write-A", success: true, output: "a.txt guardado" };
      for (let i = 0; i < 10; i++) yield { type: "text", phase: "commentary", delta: "Avance " + i };
      yield { type: "text", phase: "final_answer", delta: "Respuesta A" };
      yield { type: "done" };
    },
    onComplete: async (...args) => { entered.resolve(); await release.promise; await persist(...args); },
  });
  await entered.promise;
  expect(run.events).toHaveLength(13);
  return { key, run, release, mutate, persist, cursor: 12 };
}
async function successor(live: boolean) {
  const first = await firstTurn(), release = deferred(), mutate = vi.fn(), persist = save(first.key);
  let run!: Run;
  agentRunRegistry.deferQueueDrain(first.key, async () => {
    io.history.get(first.key)!.push(userMessage("Segunda solicitud"));
    run = agentRunRegistry.start({
      key: first.key, executor,
      makeGen: async function* () {
        await release.promise;
        mutate();
        yield { type: "tool_use", id: "write-B", name: "files.write", input: { path: "b.txt" } };
        yield { type: "tool_result", id: "write-B", success: true, output: "b.txt guardado" };
        yield { type: "text", phase: "final_answer", delta: "Respuesta B" };
        yield { type: "done" };
      },
      onComplete: persist,
    });
  }, executor.target.id);
  first.release.resolve();
  await first.run.completion;
  if (!live) { release.resolve(); await run.completion; }
  return { first, run, release, mutate, persist };
}
function collect(key: string, fromSeq: number, runId?: string, targetId = executor.target.id) {
  const frames: Frame[] = [], states: AgentStreamState[] = [];
  const detach = agentRunRegistry.attach(key, fromSeq, (event, seq, id) => {
    frames.push(JSON.parse(JSON.stringify({ event, seq, runId: id })) as Frame);
  }, targetId, { ...(runId !== undefined ? { runId } : {}), onState: state => states.push(state) });
  return { frames, states, detach };
}
function http(key: string, query: Record<string, unknown> = {}, lastId?: string, target = executor) {
  const req = Object.assign(new EventEmitter(), {
    query: { conversationId: key, ...query }, executor: target,
    header: (name: string) => name === "Last-Event-ID" ? lastId : undefined,
  }) as unknown as Request;
  const chunks: string[] = [], headers = new Map<string, unknown>();
  const res = {
    locals: { locale: "es" }, statusCode: 200, writableEnded: false,
    setHeader: (name: string, value: unknown) => headers.set(name, value),
    write: (value: string) => { chunks.push(value); return true; },
    status(code: number) { this.statusCode = code; return this; },
    end() { this.writableEnded = true; return this; },
  };
  return { req, res, headers, chunks, response: res as unknown as Response,
    frames: () => chunks.filter(chunk => chunk.includes("data: ")).map(chunk => ({
      id: chunk.match(/^id: (.+)$/m)?.[1],
      data: JSON.parse(chunk.split("data: ")[1]!.trim()),
    })),
  };
}
function attachClient(client: ReturnType<typeof http>) {
  return runWithExecutor((client.req as unknown as { executor: Executor }).executor,
    () => agentController.attach(client.req, client.response));
}
afterEach(() => {
  io.owned = true;
  io.recovery.mockClear();
  vi.restoreAllMocks();
});

describe("run-scoped replay across persistence and successors", () => {
  it("same run resumes after cursor 12, with one saved terminal and no repeated actions", async () => {
    const first = await firstTurn();
    const replay = collect(first.key, 13, first.run.runId);
    try {
      expect(replay.frames).toEqual([]);
      expect(replay.states).toEqual([{ type: "stream_state", runId: first.run.runId, nextSeq: 13, replayFromSeq: 13, done: false }]);
      expect(agentRunRegistry.start({ key: first.key, executor, makeGen: async function* () { throw new Error("must not start"); } })).toBe(first.run);
      first.release.resolve(); await first.run.completion;
      expect(replay.frames).toEqual([{ event: { type: "done", messageId: first.run.messageId, presentation: "full", displaySummary: "Respuesta A" }, seq: 13, runId: first.run.runId }]);
      expect(io.history.get(first.key)?.at(-1)?.messageId).toBe(first.run.messageId);
      expect(first.run.messageId).not.toBe(first.run.runId);
      expect(first.mutate).toHaveBeenCalledTimes(1);
      expect(first.persist).toHaveBeenCalledTimes(1);
      const consumed = collect(first.key, 14, first.run.runId);
      expect(consumed.frames).toEqual([]);
      expect(consumed.states[0]).toMatchObject({ done: true, nextSeq: 14, replayFromSeq: 14 });
      consumed.detach?.();
    } finally { first.release.resolve(); await first.run.completion; replay.detach?.(); }
  });

  it.each([true, false])("predecessor cursor cannot consume the successor terminal, live=%s", async live => {
    const fixture = await successor(live);
    try {
      expect(fixture.run.runId).not.toBe(fixture.first.run.runId);
      for (const requested of [fixture.first.run.runId, undefined]) {
        const stale = collect(fixture.first.key, 13, requested);
        expect(stale.frames).toHaveLength(1);
        expect(stale.frames[0]).toMatchObject({
          seq: -1, runId: fixture.run.runId,
          event: { type: "error", code: "AGENT_STREAM_RECONCILE_REQUIRED",
            recovery: { reason: requested ? "run_changed" : "cursor_out_of_range", done: !live, runId: fixture.run.runId } },
        });
        expect(stale.states).toEqual([]);
        expect(fixture.run.subscribers.size).toBe(0);
        stale.detach?.();
      }
      // Explicitly adopt B only after the consumer reconciles A's saved history.
      const adopted = collect(fixture.first.key, 0, fixture.run.runId);
      fixture.release.resolve(); await fixture.run.completion;
      expect(adopted.frames.map(frame => frame.seq)).toEqual([0, 1, 2, 3]);
      expect(adopted.frames.every(frame => frame.runId === fixture.run.runId)).toBe(true);
      expect(adopted.frames.at(-1)?.event).toEqual({ type: "done", messageId: fixture.run.messageId, presentation: "full", displaySummary: "Respuesta B" });
      expect(fixture.first.mutate).toHaveBeenCalledTimes(1); expect(fixture.mutate).toHaveBeenCalledTimes(1);
      expect(fixture.first.persist).toHaveBeenCalledTimes(1); expect(fixture.persist).toHaveBeenCalledTimes(1);
      expect(io.history.get(fixture.first.key)?.map(message => message.content)).toEqual(["Primera solicitud", "Respuesta A", "Segunda solicitud", "Respuesta B"]);
      const saved = io.history.get(fixture.first.key)!.filter(message => message.role === "assistant");
      expect(saved.map(message => message.messageId)).toEqual([fixture.first.run.messageId, fixture.run.messageId]);
      expect(saved[0]?.messageId).not.toBe(saved[1]?.messageId);
      expect(saved.map(message => message.apiActivity?.events.filter(event => event.type === "tool_use"))).toEqual([
        [{ type: "tool_use", id: "write-A", name: "files.write", input: { path: "a.txt" } }],
        [{ type: "tool_use", id: "write-B", name: "files.write", input: { path: "b.txt" } }],
      ]);
      adopted.detach?.();
      const again = collect(fixture.first.key, 4, fixture.run.runId);
      expect(again.frames).toEqual([]); again.detach?.();
    } finally { fixture.release.resolve(); await fixture.run.completion; }
  });

  it("rejects a cursor without identity even when it fits the successor buffer", async () => {
    const fixture = await successor(false);
    const replay = collect(fixture.first.key, 1);
    expect(replay.frames[0]?.event).toMatchObject({ code: "AGENT_STREAM_RECONCILE_REQUIRED", recovery: { reason: "run_id_required" } });
    expect(replay.frames).toHaveLength(1); replay.detach?.();
  });

  it.each([-1, 1.5, NaN, Infinity, 99])("rejects invalid internal cursor %s", async fromSeq => {
    const fixture = await successor(false);
    const replay = collect(fixture.first.key, fromSeq, fixture.run.runId);
    expect(replay.frames).toHaveLength(1);
    expect(replay.frames[0]?.event).toMatchObject({ recovery: { reason: "cursor_out_of_range" } });
    replay.detach?.();
  });

  it("scopes replay to the target and gives a replacement/recovered buffer a new identity", async () => {
    const first = await firstTurn();
    const otherExecutor = { target: { id: "other-cursor-target" } } as Executor;
    const other = agentRunRegistry.start({ key: first.key, executor: otherExecutor, cli: true,
      makeGen: async function* () { yield { type: "text", delta: "Otra respuesta" }; yield { type: "done" }; } });
    try {
      await other.completion;
      const wrong = collect(first.key, 0, first.run.runId, otherExecutor.target.id);
      expect(wrong.frames[0]?.event).toMatchObject({ recovery: { reason: "run_changed", runId: other.runId } });
      expect(wrong.frames).toHaveLength(1); wrong.detach?.();
      expect(collect(first.key, 0, first.run.runId, "missing-target").detach).toBeNull();
    } finally { first.release.resolve(); await first.run.completion; }
  });
});

describe("HTTP SSE recovery contract", () => {
  it.each([true, false])("closes a stale predecessor attachment explicitly, successor live=%s", async live => {
    const fixture = await successor(live);
    try {
      const client = http(fixture.first.key, { runId: fixture.first.run.runId, fromSeq: "12" });
      await attachClient(client);
      expect(client.res.writableEnded).toBe(true);
      expect(client.frames()).toHaveLength(1);
      expect(client.frames()[0]).toMatchObject({ id: "-1", data: { type: "error", code: "AGENT_STREAM_RECONCILE_REQUIRED", runId: fixture.run.runId, recovery: { reason: "run_changed" } } });
      expect(client.req.listenerCount("close")).toBe(0);
      expect(fixture.run.subscribers.size).toBe(0);
    } finally { fixture.release.resolve(); await fixture.run.completion; }
  });

  it("sends identity before events and closes an already-consumed terminal without duplicates", async () => {
    const fixture = await successor(false);
    const replay = http(fixture.first.key, { runId: fixture.run.runId });
    await attachClient(replay);
    expect(replay.frames()[0]).toEqual({ id: undefined, data: { type: "stream_state", runId: fixture.run.runId, nextSeq: 4, replayFromSeq: 0, done: true } });
    expect(replay.frames().slice(1).map(frame => [frame.id, frame.data.runId])).toEqual(["0", "1", "2", "3"].map(id => [id, fixture.run.runId]));
    const caughtUp = http(fixture.first.key, { runId: fixture.run.runId, fromSeq: "0" }, "3");
    await attachClient(caughtUp);
    expect(caughtUp.res.writableEnded).toBe(true);
    expect(caughtUp.frames()).toHaveLength(1);
    expect(caughtUp.frames()[0]?.data).toMatchObject({ type: "stream_state", done: true, replayFromSeq: 4 });
    expect(caughtUp.req.listenerCount("close")).toBe(0);
  });

  it("detaches a disconnected client without stopping or repeating the provider", async () => {
    const first = await firstTurn();
    const client = http(first.key, { runId: first.run.runId, fromSeq: "12" });
    const response = attachClient(client);
    try {
      await vi.waitFor(() => expect(first.run.subscribers.size).toBe(1));
      client.req.emit("close"); await response;
      expect(first.run.subscribers.size).toBe(0);
      expect(first.run.ac.signal.aborted).toBe(false);
      first.release.resolve(); await first.run.completion;
      expect(first.mutate).toHaveBeenCalledTimes(1); expect(first.persist).toHaveBeenCalledTimes(1);
    } finally { first.release.resolve(); await first.run.completion; client.req.emit("close"); await response; }
  });

  it.each(["1.5", "-2", "abc", "", "9007199254740991"])("does not guess an invalid wire cursor %s", async fromSeq => {
    const fixture = await successor(false);
    const client = http(fixture.first.key, { runId: fixture.run.runId, fromSeq });
    await attachClient(client);
    expect(client.frames()[0]?.data).toMatchObject({ code: "AGENT_STREAM_RECONCILE_REQUIRED", recovery: { reason: "cursor_out_of_range" } });
    expect(client.res.writableEnded).toBe(true);
  });

  it.each(["absent", "forbidden", "gc-race"])("204 does not synthesize success when buffer is %s", async mode => {
    const key = "absent-" + ++count;
    io.history.set(key, []);
    if (mode === "forbidden") io.owned = false;
    if (mode === "gc-race") vi.spyOn(agentRunRegistry, "has").mockReturnValue(true);
    const client = http(key);
    await attachClient(client);
    expect(client.res.statusCode).toBe(204);
    expect(client.res.writableEnded).toBe(true);
    expect(client.frames()).toEqual([]);
    expect(client.headers.has("Content-Type")).toBe(false);
    expect(client.req.listenerCount("close")).toBe(0);
    expect(io.recovery).toHaveBeenCalledTimes(mode === "absent" ? 1 : 0);
  });
});
