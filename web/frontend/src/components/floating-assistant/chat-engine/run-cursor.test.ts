// SPDX-License-Identifier: AGPL-3.0-only
// Real fetch/SSE parser + engine + reducer; only HTTP/history and background I/O are simulated.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import type { AgentEvent, ConversationMessage } from "../assistant-api";
import type { ChatTurn, QueuedSend } from "./types";

const io = vi.hoisted(() => ({ history: vi.fn(), queue: vi.fn(), scope: "target-a" }));
vi.mock("../assistant-api", async () => ({
  ...await import("../assistant-api/agent-stream"),
  assistantConversationsApi: { messages: io.history, markReviewed: vi.fn(async () => {}) },
  listAgentQueue: io.queue,
  displayText: (m: ConversationMessage) => (m.role === "user" ? m.textOriginal : m.textTranslated) ?? m.content,
  attachmentUrl: (id: string) => "/api/ai/attachments/" + id,
}));
vi.mock("@/lib/api-client", () => ({
  resolveTargetScope: () => io.scope, scopeHeaders: () => ({ "X-Test-Scope": io.scope }),
}));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));

import { chatEngine } from "../chat-engine";
import { dispatchSend, resetResumeAttempts } from "./send";
import { applyEvent } from "./stream-apply";
import { historyTurns } from "./history";
import { chats, queues, pendingAddenda, serverQueued, adopting, backgroundActive, backgroundPending } from "./state";
import { extractModifiedFiles } from "../chat-pane/helpers";

const key = "run-cursor";
const runA = "buffer-A", runB = "buffer-B";
const request = (name: string): ConversationMessage => ({
  role: "user", content: "Solicitud " + name, ts: "2026-10-17T10:00:0" + (name === "A" ? "0" : name === "B" ? "2" : "4") + "Z",
  attachments: [{ id: name, name: name + ".txt", mimeType: "text/plain" }],
});
function answer(name: string): ConversationMessage {
  return { role: "assistant", content: "Respuesta " + name, ts: "2026-10-17T10:00:0" + (name === "A" ? "1" : name === "B" ? "3" : "5") + "Z",
    apiActivity: { events: [
      { type: "tool_use", id: name, name: "files.write", input: { path: "/project/" + name + ".ts" } },
      { type: "tool_result", id: name, success: true, output: "Guardado" },
    ] } };
}
const a = [request("A"), answer("A")];
const b = [...a, request("B"), answer("B")];
const last = () => chats.get(key)!.turns.at(-1)!;
const filePaths = (turn: ChatTurn) => extractModifiedFiles(turn, "/project").map(file => file.path);
function seed() {
  const turns = historyTurns(a, "openai");
  turns[1] = { ...turns[1]!, interrupted: true };
  chats.set(key, { provider: "openai", conversationId: key, turns, streaming: false, runId: runA, lastSeq: 12 });
}
function buffer() {
  const send: QueuedSend = { provider: "openai", isCli: false, conversationId: key,
    userText: "No enviar", buildMessages: () => [{ role: "user", content: "No enviar" }] };
  queues.set(key, [send]); pendingAddenda.set(key, { ...send, texts: ["No drenar"], attachments: [] });
}
function wire(event: AgentEvent, seq?: number) {
  return (seq === undefined ? "" : "id: " + seq + "\n") + "data: " + JSON.stringify(event) + "\n\n";
}
function response(data: string) { return new Response(data, { headers: { "content-type": "text/event-stream" } }); }
function state(runId: string, done = false, nextSeq = 0, replayFromSeq = 0) {
  return wire({ type: "stream_state", runId, done, nextSeq, replayFromSeq });
}
function recovery(runId = runB, done = false, reason: "run_changed" | "run_id_required" | "cursor_out_of_range" = "run_changed") {
  return response(wire({ type: "error", code: "AGENT_STREAM_RECONCILE_REQUIRED", message: "Recupera el historial",
    runId, recovery: { reason, runId, requestedRunId: runA, done, nextSeq: done ? 5 : 0 } }, -1));
}
function replay(runId = runB, name = "B", terminal: AgentEvent = { type: "done" }) {
  const events: AgentEvent[] = [
    { type: "tool_use", id: name, name: "files.write", input: { path: "/project/" + name + ".ts" } },
    { type: "tool_result", id: name, success: true, output: "Guardado" },
    { type: "text", phase: "final_answer", delta: "Respuesta " + name },
    { type: "usage", model: "fixture", inputTokens: 2, outputTokens: 3 },
    terminal,
  ];
  return response(state(runId) + events.map((event, seq) =>
    wire({ ...event, runId }, seq) + (seq === 2 || seq === 3 ? wire({ ...event, runId }, seq) : "")).join(""));
}
function urls() { return vi.mocked(fetch).mock.calls.map(call => new URL(String(call[0]), "https://fixture.test")); }
function noPosts() { expect(vi.mocked(fetch).mock.calls.every(call => call[1]?.method === "GET")).toBe(true); }
function assertBoth() {
  expect(chats.get(key)?.turns.map(turn => turn.text)).toEqual(b.map(message => message.content));
  expect(filePaths(chats.get(key)!.turns[1]!)).toEqual(["/project/A.ts"]);
  expect(filePaths(last())).toEqual(["/project/B.ts"]);
  expect(chats.get(key)?.turns[0]?.attachments?.[0]?.name).toBe("A.txt");
  expect(chats.get(key)?.turns[2]?.attachments?.[0]?.name).toBe("B.txt");
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  io.scope = "target-a"; io.queue.mockResolvedValue([]);
  io.history.mockResolvedValue({ items: b });
  vi.stubGlobal("fetch", vi.fn());
  seed(); buffer();
});
afterEach(() => {
  resetResumeAttempts(key); chatEngine.setActiveView(null);
  chats.clear(); queues.clear(); pendingAddenda.clear(); serverQueued.clear(); adopting.clear();
  backgroundActive.clear(); backgroundPending.clear();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("recovers completed B after A:12 from REST, preserving both responses and files without replay duplication", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(recovery(runB, true));
  await chatEngine.resume(key);
  assertBoth();
  expect(last().interrupted).not.toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(urls()[0]?.searchParams.get("runId")).toBe(runA);
  expect(urls()[0]?.searchParams.get("fromSeq")).toBe("12");
  expect(queues.get(key)).toHaveLength(1);
  expect(pendingAddenda.has(key)).toBe(true);
  noPosts();
});

it.each(["run_changed", "run_id_required", "cursor_out_of_range"] as const)(
  "reconciles %s before replaying live B at zero, deduplicating only within B", async reason => {
    if (reason === "run_id_required") chats.set(key, { ...chats.get(key)!, runId: undefined });
    io.history.mockResolvedValue({ items: b.slice(0, -1) });
    vi.mocked(fetch).mockResolvedValueOnce(recovery(runB, false, reason)).mockResolvedValueOnce(replay());
    await chatEngine.resume(key);
    assertBoth();
    expect(chats.get(key)).toMatchObject({ runId: runB, lastSeq: 4, streaming: false });
    expect(last().tokens?.total).toBe(5);
    expect(urls()[1]?.searchParams.get("runId")).toBe(runB);
    expect(urls()[1]?.searchParams.get("fromSeq")).toBe("-1");
    expect(queues.get(key)).toHaveLength(1); expect(pendingAddenda.has(key)).toBe(true);
    noPosts();
  },
);

it("resumes the same run from the next event exactly once without a history read", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response(state(runA, false, 13, 13)
    + wire({ type: "text", phase: "final_answer", delta: " ignorado", runId: runA }, 12)
    + wire({ type: "text", phase: "final_answer", delta: " final", runId: runA }, 13)
    + wire({ type: "text", phase: "final_answer", delta: " final", runId: runA }, 13)
    + wire({ type: "done", runId: runA }, 14)));
  await chatEngine.resume(key);
  expect(last().text).toBe("Respuesta A final"); expect(last().interrupted).toBe(false);
  expect(chats.get(key)?.lastSeq).toBe(14); expect(io.history).not.toHaveBeenCalled();
  expect(pendingAddenda.has(key)).toBe(true); noPosts();
});

it.each([true, false])("exhausted same-run metadata is not a terminal; persisted evidence=%s", async saved => {
  io.history.mockResolvedValue({ items: saved ? a : [request("A")] });
  vi.mocked(fetch).mockResolvedValueOnce(response(state(runA, true, 13, 13)));
  await chatEngine.resume(key);
  expect(last().interrupted === true).toBe(!saved);
  expect(filePaths(last())).toEqual(["/project/A.ts"]);
  expect(io.history).toHaveBeenCalledOnce(); noPosts();
});

it.each(["pending", "error", "ask", "stopped"] as const)("preserves the successor's saved %s outcome", async kind => {
  const outcome: Partial<ConversationMessage> = kind === "pending" ? { pending: true }
    : kind === "error" ? { error: "No guardado" }
    : kind === "ask" ? { ask: [{ id: "q", text: "Decisión", type: "text" }] } : { interrupted: true };
  io.history.mockResolvedValue({ items: [...b.slice(0, -1), { ...answer("B"), ...outcome }] });
  vi.mocked(fetch).mockResolvedValueOnce(recovery(runB, true));
  await chatEngine.resume(key);
  expect(last().completionPending || last().error || last().ask?.length || last().stopped).toBeTruthy();
  expect(filePaths(last())).toEqual(["/project/B.ts"]); noPosts();
  expect(pendingAddenda.has(key)).toBe(true);
});

it.each([
  { type: "done", pending: true }, { type: "error", message: "No guardado" },
  { type: "permission_request", id: "p", tool: "files.write", title: "Permiso" },
] satisfies AgentEvent[])("keeps live successor state %j without a clean continuation", async terminal => {
  io.history.mockResolvedValue({ items: b.slice(0, -1) });
  vi.mocked(fetch).mockResolvedValueOnce(recovery()).mockResolvedValueOnce(replay(runB, "B", terminal));
  await chatEngine.resume(key);
  expect(last().completionPending || last().error || last().permission || last().interrupted).toBeTruthy();
  expect(pendingAddenda.has(key)).toBe(true); noPosts();
});

it.each(["missing-A", "only-A", "duplicate-context", "read-failed"])("preserves the local trace when reconciliation is %s", async problem => {
  if (problem === "read-failed") io.history.mockRejectedValue(new Error("offline"));
  else if (problem === "only-A") io.history.mockResolvedValue({ items: a });
  else if (problem === "missing-A") io.history.mockResolvedValue({ items: [request("A"), request("B"), answer("B")] });
  else io.history.mockResolvedValue({ items: [...a, ...b] });
  vi.mocked(fetch).mockResolvedValueOnce(recovery(runB, true));
  await chatEngine.resume(key);
  expect(chats.get(key)?.turns).toHaveLength(2);
  expect(last()).toMatchObject({ text: "Respuesta A", interrupted: true });
  expect(filePaths(last())).toEqual(["/project/A.ts"]);
  expect(chats.get(key)?.lastSeq).toBe(12); expect(chats.get(key)?.runId).toBe(runA);
  expect(pendingAddenda.has(key)).toBe(true); noPosts();
});

it("does not close an unadmitted identical request using an anonymous old run's state and terminal", async () => {
  chats.set(key, { provider: "openai", conversationId: key, turns: historyTurns(a, "openai"), streaming: false });
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await dispatchSend(key, { provider: "openai", isCli: false, conversationId: key,
    userText: request("A").content, messages: [{ role: "user", content: request("A").content }],
    attachments: [{ name: "A.txt", mimeType: "text/plain", dataBase64: "YQ==" }] });
  io.history.mockResolvedValue({ items: a });
  vi.mocked(fetch).mockResolvedValueOnce(response(state(runA, true, 14)
    + wire({ type: "done", runId: runA }, 13)));
  await chatEngine.resume(key);
  expect(chats.get(key)?.turns).toHaveLength(4);
  expect(last()).toMatchObject({ text: "", interrupted: true });
  expect(chats.get(key)?.turns[2]?.attachments?.[0]?.url).toBe("data:text/plain;base64,YQ==");
  expect(vi.mocked(fetch).mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  expect(queues.get(key)).toHaveLength(1); expect(pendingAddenda.has(key)).toBe(true);
});

it("binds an unknown buffer only after its pending request is identified in REST", async () => {
  chats.set(key, { ...chats.get(key)!, runId: undefined, lastSeq: undefined,
    turns: [historyTurns([request("A")], "openai")[0]!, { role: "assistant", text: "", tools: [], interrupted: true }] });
  io.history.mockResolvedValue({ items: [request("A")] });
  vi.mocked(fetch).mockResolvedValueOnce(response(state(runA)))
    .mockResolvedValueOnce(replay(runA, "A"));
  await chatEngine.resume(key);
  expect(last()).toMatchObject({ text: "Respuesta A", interrupted: false });
  expect(chats.get(key)?.runId).toBe(runA); noPosts();
});

it("adopts a persisted pending user through the same parser and reconciliation path", async () => {
  chats.set(key, { provider: "openai", conversationId: key, turns: historyTurns([request("A")], "openai"), streaming: false });
  io.history.mockResolvedValue({ items: [request("A")] });
  vi.mocked(fetch).mockResolvedValueOnce(response(state(runA))).mockResolvedValueOnce(replay(runA, "A"));
  await chatEngine.adopt(key, "openai", key, false);
  expect(last()).toMatchObject({ text: "Respuesta A", interrupted: false });
  expect(chats.get(key)?.turns).toHaveLength(2); noPosts();
});

it("records run identity on the original POST before applying data and later resumes that identity", async () => {
  chats.clear(); queues.clear(); pendingAddenda.clear();
  vi.mocked(fetch).mockResolvedValueOnce(response(state(runA)
    + wire({ type: "text", phase: "final_answer", delta: "Inicio", runId: runA }, 0)));
  await dispatchSend(key, { provider: "openai", isCli: false, conversationId: key, userText: "A", messages: [{ role: "user", content: "A" }] });
  expect(chats.get(key)).toMatchObject({ runId: runA, lastSeq: 0 });
  vi.mocked(fetch).mockResolvedValueOnce(response(state(runA, false, 1, 1) + wire({ type: "done", runId: runA }, 1)));
  await chatEngine.resume(key);
  expect(urls()[1]?.searchParams.get("runId")).toBe(runA);
  expect(last()).toMatchObject({ text: "Inicio", interrupted: false });
  expect(vi.mocked(fetch).mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
});

it("does not turn a rejected POST into admission or trigger any recovery submission", async () => {
  chats.clear();
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "Solicitud rechazada" }), { status: 403, headers: { "content-type": "application/json" } }));
  await dispatchSend(key, { provider: "openai", isCli: false, conversationId: key, userText: "A", messages: [{ role: "user", content: "A" }] });
  await chatEngine.resume(key);
  expect(last().error).toContain("Solicitud rechazada");
  expect(chats.get(key)?.runId).toBeUndefined(); expect(fetch).toHaveBeenCalledOnce();
  expect(pendingAddenda.has(key)).toBe(true);
});

it.each([401, 403, 503])("keeps resume HTTP %s separate from a provider terminal", async status => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "Lectura no disponible" }), { status, headers: { "content-type": "application/json" } }));
  await chatEngine.resume(key);
  expect(last()).toMatchObject({ text: "Respuesta A", interrupted: true });
  expect(last().error).toBeUndefined(); noPosts();
});

it("reconciles again when B changes to C during the read, preserving all three turns", async () => {
  io.history.mockResolvedValueOnce({ items: b.slice(0, -1) }).mockResolvedValueOnce({ items: [...b, request("C")] });
  vi.mocked(fetch).mockResolvedValueOnce(recovery()).mockResolvedValueOnce(recovery("buffer-C"))
    .mockResolvedValueOnce(replay("buffer-C", "C"));
  await chatEngine.resume(key);
  expect(chats.get(key)?.turns.map(turn => turn.text)).toEqual([...b, request("C"), answer("C")].map(message => message.content));
  expect(chats.get(key)?.turns.filter(turn => turn.role === "assistant").map(filePaths)).toEqual([["/project/A.ts"], ["/project/B.ts"], ["/project/C.ts"]]);
  expect(urls().map(url => url.searchParams.get("runId"))).toEqual([runA, runB, "buffer-C"]);
  noPosts();
});

it("does not clear current background/permission state with a foreign terminal", () => {
  backgroundActive.set(key, { provider: "openai", cli: false }); backgroundPending.add(key);
  const before = chats.get(key);
  applyEvent(key, { type: "done", runId: runB }, { isCli: false, startedAt: 0, seq: 999 });
  expect(chats.get(key)).toBe(before); expect(backgroundActive.has(key)).toBe(true); expect(backgroundPending.has(key)).toBe(true);
});

it.each(["target", "owner", "turns"])("rejects a late reconciliation after changing %s", async change => {
  let release!: (value: { items: ConversationMessage[] }) => void;
  const read = new Promise<{ items: ConversationMessage[] }>(resolve => { release = resolve; });
  io.history.mockReturnValue(read);
  vi.mocked(fetch).mockResolvedValueOnce(recovery());
  const work = chatEngine.resume(key);
  await vi.waitFor(() => expect(io.history).toHaveBeenCalledOnce());
  if (change === "target") io.scope = "target-b";
  else chats.set(key, { ...chats.get(key)!, ...(change === "owner" ? { abort: new AbortController() } : { turns: [...chats.get(key)!.turns] }) });
  const before = chats.get(key)!.turns;
  release({ items: b }); await work;
  expect(chats.get(key)?.turns.map(turn => turn.text)).toEqual(before.map(turn => turn.text));
  expect(fetch).toHaveBeenCalledOnce(); noPosts();
});

// Cross-package regression using the ORIGINAL registry source in memory, just
// like backend-contract.qa.test.ts. No build output, source copies, or bootstrap.
const backend = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../backend/src");
const services = resolve(backend, "modules/ai-assistant/services");
const executor = { target: { id: "target-a" } };
const stubs = new Map<string, unknown>([
  [resolve(backend, "shared/executor/index.ts"), { runWithExecutor: (_e: unknown, work: () => unknown) => work(), getContextExecutor: () => executor, LOCAL_TARGET_ID: "local" }],
  [resolve(backend, "shared/logger/index.ts"), { createModuleLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }],
  [resolve(backend, "shared/worklog/worklog-recorder.service.ts"), { recordActivity: vi.fn() }],
  [resolve(backend, "modules/ai-assistant/repositories/conversations.repository.ts"), { conversationsRepository: { getMeta: async () => null } }],
  [resolve(services, "providers/cli/shell.ts"), { ANSI_RE: /\x1b\[[0-9;?]*[ -/]*[@-~]/g }],
]);
const allowed = new Set([
  ...["agent-run-registry", "conversation-message-normalizer", "api-activity", "execution-scope", "ask-protocol"].map(name => resolve(services, name + ".ts")),
  ...["events/index", "text/humanize-preview", "diagnostics/sanitize"].map(name => resolve(backend, "shared", name + ".ts")),
  ...["message-presentation", "agent-envelope", "visible-summary"].map(name => resolve(backend, "modules/ai-assistant/models", name + ".ts")),
]);
const nativeRequire = createRequire(import.meta.url);
const backendRequire = createRequire(resolve(backend, "../package.json"));
const loaded = new Map<string, { exports: Record<string, any> }>();
function loadRegistrySource(file: string): any {
  if (stubs.has(file)) return stubs.get(file);
  if (!allowed.has(file)) throw new Error("Unexpected backend dependency: " + file);
  if (loaded.has(file)) return loaded.get(file)!.exports;
  const module = { exports: {} }; loaded.set(file, module);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("exports", "require", "module", source)(module.exports,
    (id: string) => id.startsWith("node:") ? nativeRequire(id)
      : id === "zod" || id === "@toon-format/toon" ? backendRequire(id)
      : loadRegistrySource(resolve(dirname(file), id.replace(/\.js$/, ".ts"))), module);
  return module.exports;
}
const { agentRunRegistry: registry } = loadRegistrySource(resolve(services, "agent-run-registry.ts"));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { resolve, promise };
}
let registryCounter = 0;
it.each(["same-run", "finished-B", "live-B"] as const)(
  "registry → SSE bytes → actual client: %s during A persistence at seq12", async scenario => {
    const registryKey = "cursor-integration-" + ++registryCounter;
    const entered = deferred(), releaseA = deferred(), releaseB = deferred(), attached = deferred();
    const mutateA = vi.fn(), mutateB = vi.fn(), persistA = vi.fn(), persistB = vi.fn();
    const saved: ConversationMessage[] = [request("A")];
    io.history.mockImplementation(async () => ({ items: [...saved] }));
    const first = registry.start({ key: registryKey, executor, makeGen: async function* () {
      mutateA();
      yield* answer("A").apiActivity!.events;
      for (let i = 0; i < 10; i++) yield { type: "text", phase: "commentary", delta: "Avance " + i };
      yield { type: "text", phase: "final_answer", delta: "Respuesta A" };
      yield { type: "done" };
    }, onComplete: async () => { entered.resolve(); await releaseA.promise; persistA(); saved.push(answer("A")); } });
    await entered.promise;
    expect(first.events.length - 1).toBe(12);
    chats.set(key, { ...chats.get(key)!, runId: first.runId });
    let next: typeof first;
    if (scenario !== "same-run") {
      registry.deferQueueDrain(registryKey, async () => {
        saved.push(request("B"));
        next = registry.start({ key: registryKey, executor, makeGen: async function* () {
          if (scenario === "live-B") await releaseB.promise;
          mutateB(); yield* answer("B").apiActivity!.events;
          yield { type: "text", phase: "final_answer", delta: "Respuesta B" };
          yield { type: "done" };
        }, onComplete: async () => { persistB(); saved.push(answer("B")); } });
      }, executor.target.id);
      releaseA.resolve(); await first.completion;
      if (scenario === "finished-B") await next.completion;
    }
    const received: AgentEvent[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      expect(init?.method).toBe("GET");
      expect(init?.headers).toMatchObject({ "X-Test-Scope": "target-a" });
      const url = new URL(String(input), "https://fixture.test");
      let detach: (() => void) | null = null, closed = false;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: AgentEvent, seq?: number) => {
            if (closed) return;
            received.push(event);
            controller.enqueue(new TextEncoder().encode(wire(event, seq)));
          };
          const finish = () => { if (!closed) { closed = true; controller.close(); detach?.(); } };
          detach = registry.attach(registryKey, Number(url.searchParams.get("fromSeq")) + 1,
            (event: AgentEvent, seq: number, runId: string) => {
              send({ ...event, runId }, seq);
              if (event.type === "done" || event.type === "error") finish();
            }, executor.target.id, {
              runId: url.searchParams.get("runId") ?? undefined,
              onState: (event: AgentEvent & { done: boolean; nextSeq: number; replayFromSeq: number }) => {
                send(event); attached.resolve();
                if (event.done && event.replayFromSeq === event.nextSeq) finish();
              },
            });
          if (closed) detach?.();
        },
        cancel() { closed = true; detach?.(); },
      });
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    });
    const work = chatEngine.resume(key);
    if (scenario === "same-run") {
      await attached.promise; releaseA.resolve(); await first.completion;
    } else if (scenario === "live-B") {
      await attached.promise; releaseB.resolve(); await next.completion;
    }
    await work;
    expect(mutateA).toHaveBeenCalledTimes(1); expect(persistA).toHaveBeenCalledTimes(1);
    if (scenario === "same-run") {
      expect(received.filter(event => event.type === "done")).toHaveLength(1);
      expect(last()).toMatchObject({ text: "Respuesta A", interrupted: false });
      expect(io.history).not.toHaveBeenCalled();
    } else {
      assertBoth();
      expect(mutateB).toHaveBeenCalledTimes(1); expect(persistB).toHaveBeenCalledTimes(1);
      expect(received.filter(event => event.type === "error")).toMatchObject([{ code: "AGENT_STREAM_RECONCILE_REQUIRED" }]);
      expect(last().interrupted).not.toBe(true);
    }
    expect(queues.get(key)).toHaveLength(1); expect(pendingAddenda.has(key)).toBe(true);
    noPosts();
  },
);

it("clears active/permission mirrors only after a completed successor is correlated", async () => {
  backgroundActive.set(key, { provider: "openai", cli: false }); backgroundPending.add(key);
  vi.mocked(fetch).mockResolvedValueOnce(recovery(runB, true));
  await chatEngine.resume(key);
  assertBoth();
  expect(backgroundActive.has(key)).toBe(false); expect(backgroundPending.has(key)).toBe(false);
});

it("retains confirmed local file results when REST omits them during successor reconciliation", async () => {
  io.history.mockResolvedValue({ items: [
    request("A"), { ...answer("A"), apiActivity: { events: [answer("A").apiActivity!.events[0]!] } },
    request("B"), answer("B"),
  ] });
  vi.mocked(fetch).mockResolvedValueOnce(recovery(runB, true));
  await chatEngine.resume(key);
  assertBoth();
  expect(chats.get(key)?.turns[1]?.tools[0]?.result).toEqual({ success: true, output: "Guardado" });
});

it("keeps the full persisted CLI console and both runs' files instead of the old partial live console", async () => {
  const cliAnswer = (name: string) => ({ ...answer(name), cli: true, apiActivity: undefined, cliLog: "Write /project/" + name + ".ts\nActividad completa" });
  const turns = historyTurns([request("A"), cliAnswer("A")], "codex");
  turns[1] = { ...turns[1]!, interrupted: true, tools: [{ id: "cli-a", name: "codex.cli", input: {}, terminal: "Actividad parcial" }] };
  chats.set(key, { ...chats.get(key)!, provider: "codex", isCli: true, turns });
  io.history.mockResolvedValue({ items: [request("A"), cliAnswer("A"), request("B"), cliAnswer("B")] });
  vi.mocked(fetch).mockResolvedValueOnce(recovery(runB, true));
  await chatEngine.resume(key);
  assertBoth();
  expect(chats.get(key)?.turns[1]?.tools).toEqual([]);
  expect(chats.get(key)?.turns[1]?.cliHistoryLog).toBe(cliAnswer("A").cliLog);
});
