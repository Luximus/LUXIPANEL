// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentEventFrame, ConversationMessage } from "../assistant-api";
import type { ChatTurn } from "./types";

const api = vi.hoisted(() => ({
  resume: vi.fn(), send: vi.fn(), messages: vi.fn(), queue: vi.fn(),
  runs: vi.fn(), tasks: vi.fn(), scope: "target-a",
}));
vi.mock("../assistant-api", () => ({
  streamAgentResume: api.resume, streamAgent: api.send, listAgentQueue: api.queue,
  listActiveRuns: api.runs, teamApi: { listActive: api.tasks },
  assistantConversationsApi: { messages: api.messages, markReviewed: vi.fn(async () => {}) },
  displayText: (m: ConversationMessage) => m.content, attachmentUrl: (id: string) => id,
}));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => api.scope }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));

import { chatEngine } from "../chat-engine";
import { dispatchSend, followServerChain, onCleanSettle, resetResumeAttempts } from "./send";
import { adopting, backgroundActive, backgroundPending, backgroundWorkerRunning, chats, pendingAddenda, queues, serverQueued, unreviewedBackground } from "./state";

const key = "reconnection";
const user: ConversationMessage = { role: "user", content: "Revisa el archivo", ts: "2026-10-17T10:00:00Z" };
const tool = { id: "read", name: "files.read", input: { path: "example.txt" }, result: { success: true, output: "Detalle conservado" } };
const finalMessage: ConversationMessage = { role: "assistant", content: "Resultado guardado", ts: "2026-10-17T10:00:01Z",
  apiActivity: { events: [{ type: "tool_use", id: tool.id, name: tool.name, input: tool.input },
    { type: "tool_result", id: tool.id, ...tool.result }] } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function* frames(events: AgentEventFrame[]): AsyncGenerator<AgentEventFrame> { yield* events; }
function seed() {
  chats.set(key, { provider: "openai", conversationId: key, streaming: false, lastSeq: 2,
    turns: [{ role: "user", text: user.content, tools: [], createdAt: Date.parse(user.ts) },
      { role: "assistant", text: "", tools: [tool], interrupted: true }] });
}
const last = () => chats.get(key)!.turns.at(-1)!;
const sendOptions = { provider: "openai", isCli: false, conversationId: key,
  messages: [{ role: "user" as const, content: user.content }], userText: user.content };

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  api.scope = "target-a"; api.queue.mockResolvedValue([]); api.runs.mockResolvedValue([]); api.tasks.mockResolvedValue([]);
  api.resume.mockResolvedValue(null);
  api.messages.mockResolvedValue({ items: [user, finalMessage] });
  api.send.mockImplementation(() => frames([{ event: { type: "text", phase: "final_answer", delta: "Siguiente" }, seq: 0 },
    { event: { type: "done" }, seq: 1 }]));
  seed();
});
afterEach(() => {
  chats.clear(); adopting.clear(); queues.clear(); pendingAddenda.clear(); serverQueued.clear();
  backgroundActive.clear(); backgroundPending.clear(); backgroundWorkerRunning.clear(); unreviewedBackground.clear();
  chatEngine.setActiveView(null); resetResumeAttempts(key);
  vi.useRealTimers(); vi.restoreAllMocks();
});

it.each(["failed", "not-persisted"])("keeps recovery and tool details when the history is %s after a 204", async state => {
  if (state === "failed") api.messages.mockRejectedValueOnce(new Error("offline"));
  else api.messages.mockResolvedValueOnce({ items: [user] });
  await chatEngine.resume(key);
  expect(last()).toMatchObject({ interrupted: true, pending: false, tools: [tool] });
  expect(chats.get(key)?.streaming).toBe(false);
  expect(api.send).not.toHaveBeenCalled();
  api.messages.mockResolvedValue({ items: [user, finalMessage] });
  await chatEngine.resume(key);
  expect(last().text).toBe("Resultado guardado");
  expect(last().interrupted).not.toBe(true);
  expect(last().tools).toEqual([tool]);
  expect(chats.get(key)?.turns).toHaveLength(2);
  expect(api.send).not.toHaveBeenCalled();
});

it("coalesces concurrent resumes and applies each SSE sequence once", async () => {
  const probe = deferred<AsyncGenerator<AgentEventFrame>>();
  api.resume.mockReturnValue(probe.promise);
  const first = chatEngine.resume(key);
  await chatEngine.resume(key);
  expect(api.resume).toHaveBeenCalledOnce();
  expect(api.resume.mock.calls[0]?.slice(0, 2)).toEqual([key, 2]);
  probe.resolve(frames([
    { event: { type: "text", phase: "final_answer", delta: "Final" }, seq: 3 },
    { event: { type: "text", phase: "final_answer", delta: "Final" }, seq: 3 },
    { event: { type: "done" }, seq: 4 },
  ]));
  await first;
  expect(last().text).toBe("Final");
  expect(chats.get(key)?.turns).toHaveLength(2);
  expect(api.send).not.toHaveBeenCalled();
});

it.each(["target", "replacement", "stop"])("discards a late resume probe after %s", async change => {
  const probe = deferred<AsyncGenerator<AgentEventFrame>>();
  api.resume.mockReturnValue(probe.promise);
  const work = chatEngine.resume(key);
  if (change === "target") api.scope = "target-b";
  const replacement = { ...chats.get(key)!, streaming: change === "replacement",
    abort: change === "replacement" ? new AbortController() : undefined,
    turns: [{ role: "assistant" as const, text: "Estado actual", tools: [], ...(change === "stop" ? { stopped: true } : {}) }] };
  chats.set(key, replacement);
  probe.resolve(frames([{ event: { type: "text", delta: "Dato antiguo" }, seq: 3 }, { event: { type: "done" }, seq: 4 }]));
  await work;
  expect(chats.get(key)).toBe(replacement);
  expect(api.resume.mock.calls[0]?.[2]?.aborted).toBe(true);
  expect(api.send).not.toHaveBeenCalled();
});

it.each(["event", "error"])("ignores a late resume %s after another stream takes ownership", async ending => {
  const release = deferred<void>(), entered = deferred<void>();
  api.resume.mockResolvedValue((async function* (): AsyncGenerator<AgentEventFrame> {
    entered.resolve(); await release.promise;
    if (ending === "error") throw new TypeError("network failure");
    yield { event: { type: "done" }, seq: 3 };
  })());
  const work = chatEngine.resume(key);
  await entered.promise;
  const replacement = { ...chats.get(key)!, streaming: true, abort: new AbortController(),
    turns: [{ role: "assistant" as const, text: "Nuevo turno", pending: true, tools: [] }] };
  chats.set(key, replacement); release.resolve();
  await work;
  expect(chats.get(key)).toBe(replacement);
  expect(api.send).not.toHaveBeenCalled();
});

it.each(["send", "resume", "adopt"])("keeps an EOF without a terminal event recoverable in %s", async path => {
  const events: AgentEventFrame[] = [{ event: { type: "text", phase: "commentary", delta: "Aún guardando" }, seq: 3 }];
  if (path === "send") {
    api.send.mockImplementation(() => frames(events));
    await dispatchSend(key, sendOptions);
  } else {
    api.resume.mockResolvedValue(frames(events));
    if (path === "adopt") {
      chats.set(key, { ...chats.get(key)!, turns: [{ role: "user", text: user.content, tools: [] }] });
      await chatEngine.adopt(key, "openai", key, false);
    } else await chatEngine.resume(key);
  }
  expect(last()).toMatchObject({ interrupted: true, pending: false });
  expect(last().apiActivity?.events).toEqual([{ type: "text", phase: "commentary", delta: "Aún guardando" }]);
  expect(chats.get(key)?.streaming).toBe(false);
  expect(api.queue).toHaveBeenCalledTimes(path === "adopt" ? 1 : 0);
});

it("does not let an aborted original send settle its replacement", async () => {
  const release = deferred<void>(), entered = deferred<void>();
  api.send.mockImplementation(() => (async function* (): AsyncGenerator<AgentEventFrame> {
    entered.resolve(); await release.promise;
    throw new DOMException("Aborted", "AbortError");
  })());
  const work = dispatchSend(key, sendOptions);
  await entered.promise;
  const replacement = { ...chats.get(key)!, streaming: true, abort: new AbortController(),
    turns: [{ role: "assistant" as const, text: "Nuevo turno", pending: true, tools: [] }] };
  chats.set(key, replacement); release.resolve();
  await work;
  expect(chats.get(key)).toBe(replacement);
});

it.each([
  { error: "No se pudo guardar" }, { completionPending: true }, { interrupted: true },
  { stopped: true }, { pending: true },
  { ask: [{ id: "q", type: "text" as const, text: "Decisión pendiente" }] },
  { permission: { id: "p", tool: "files.write", title: "Permiso" } },
])("does not dispatch local follow-ups for an unsettled outcome %j", async outcome => {
  chats.set(key, { ...chats.get(key)!, turns: [{ role: "assistant", text: "", tools: [], ...outcome } as ChatTurn] });
  const continuation = { provider: "openai", isCli: false, conversationId: key,
    userText: "Continuación", buildMessages: () => [{ role: "user" as const, content: "Continuación" }] };
  queues.set(key, [continuation]);
  pendingAddenda.set(key, { ...continuation, texts: ["Añadidura"], attachments: [] });
  onCleanSettle(key, key, "openai", false);
  await Promise.resolve();
  expect(api.send).not.toHaveBeenCalled();
  expect(queues.get(key)).toHaveLength(1);
  expect(pendingAddenda.get(key)?.texts).toEqual(["Añadidura"]);
});

it("discards an active-runs snapshot from a previous target", async () => {
  const runs = deferred<unknown[]>();
  api.runs.mockReturnValue(runs.promise);
  const work = chatEngine.refreshBackgroundRuns();
  api.scope = "target-b";
  runs.resolve([{ id: "old-chat", provider: "openai", cli: false, pendingPermission: true }]);
  await work;
  expect(backgroundActive.size).toBe(0);
  expect(backgroundPending.size).toBe(0);
});

it("stops following a queued chain when the target changes during backoff", async () => {
  const work = followServerChain(key, key, "openai", false);
  api.scope = "target-b";
  await vi.advanceTimersByTimeAsync(12_000);
  await work;
  expect(api.messages).not.toHaveBeenCalled();
  expect(api.resume).not.toHaveBeenCalled();
});
