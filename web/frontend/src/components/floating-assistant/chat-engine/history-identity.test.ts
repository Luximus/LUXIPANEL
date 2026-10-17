// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ConversationMessage } from "../assistant-api";
import type { ChatTurn, QueuedSend } from "./types";

const api = vi.hoisted(() => ({ send: vi.fn(), resume: vi.fn(), messages: vi.fn(), queue: vi.fn() }));
vi.mock("../assistant-api", () => ({
  streamAgent: api.send, streamAgentResume: api.resume, listAgentQueue: api.queue,
  assistantConversationsApi: { messages: api.messages, markReviewed: vi.fn(async () => {}) },
  displayText: (m: ConversationMessage) => (m.role === "user" ? m.textOriginal : m.textTranslated) ?? m.content,
  attachmentUrl: (id: string) => "/api/ai/attachments/" + id,
}));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => "history-identity-target" }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));

import { chatEngine } from "../chat-engine";
import { historyTurns } from "./history";
import { dispatchSend, resetResumeAttempts } from "./send";
import { reloadHistory } from "./stream-apply";
import { adopting, chats, pendingAddenda, queues, serverQueued } from "./state";
import { extractModifiedFiles } from "../chat-pane/helpers";

const key = "history-identity";
const previousUser: ConversationMessage = { role: "user", content: "Comprueba el estado", ts: "2026-10-17T10:00:00Z" };
function answer(content: string, path: string, ts: string): ConversationMessage {
  return { role: "assistant", content, ts, apiActivity: { events: [
    { type: "tool_use", id: path, name: "files.write", input: { path, content: "fixture" } },
    { type: "tool_result", id: path, success: true, output: "Guardado" },
  ] } };
}
const previousAnswer = answer("Resultado anterior", "/project/src/previous.ts", "2026-10-17T10:00:01Z");
const prior = [previousUser, previousAnswer];
const last = () => chats.get(key)!.turns.at(-1)!;
const files = (turn: ChatTurn) => extractModifiedFiles(turn, "/project");

function seed(items = prior) {
  chats.set(key, { provider: "openai", conversationId: key, streaming: false, turns: historyTurns(items, "openai") });
}
function bufferedFollowUps() {
  const followUp: QueuedSend = { provider: "openai", isCli: false, conversationId: key, userText: "Continuación",
    buildMessages: () => [{ role: "user", content: "Continuación" }] };
  queues.set(key, [followUp]);
  pendingAddenda.set(key, { ...followUp, texts: ["Añadidura pendiente"], attachments: [] });
}
async function sendRequest(text = previousUser.content, isCli = false, withAttachment = true) {
  await dispatchSend(key, { provider: "openai", isCli, conversationId: key,
    messages: [{ role: "user", content: text }], userText: text,
    ...(withAttachment ? { attachments: [{ name: "request.txt", mimeType: "text/plain", dataBase64: "bmV3" }] } : {}) });
}
function unresolved(withAttachment = true) {
  expect(chats.get(key)?.turns).toHaveLength(4);
  expect(chats.get(key)?.turns.slice(0, 2)).toEqual(historyTurns(prior, "openai"));
  expect(chats.get(key)?.turns[2]?.attachments).toEqual(withAttachment ? [
    { name: "request.txt", mimeType: "text/plain", url: "data:text/plain;base64,bmV3" },
  ] : undefined);
  expect(last()).toMatchObject({ text: "", interrupted: true, pending: false });
  expect(files(chats.get(key)!.turns[1]!)).toEqual([{ path: "/project/src/previous.ts", kind: "modified" }]);
  expect(api.send).toHaveBeenCalledTimes(1);
}

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T11:00:00Z"));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  api.resume.mockResolvedValue(null); api.queue.mockResolvedValue([]);
  api.messages.mockResolvedValue({ items: prior, total: prior.length, hasMore: false });
  api.send.mockImplementation(async function* () { throw new TypeError("Failed to fetch"); });
  seed();
});
afterEach(() => {
  chats.clear(); adopting.clear(); queues.clear(); pendingAddenda.clear(); serverQueued.clear();
  resetResumeAttempts(key); chatEngine.setActiveView(null);
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
});

it.each([
  { identical: true, isCli: false }, { identical: false, isCli: false },
  { identical: true, isCli: true }, { identical: false, isCli: true },
].flatMap(test => [false, true].map(withAttachment => ({ ...test, withAttachment }))))(
  "preserves a request never admitted after 204 and old REST history: %j", async ({ identical, isCli, withAttachment }) => {
  const text = identical ? previousUser.content : "Comprueba otro estado";
  await sendRequest(text, isCli, withAttachment);
  bufferedFollowUps();
  unresolved(withAttachment);
  await chatEngine.resume(key);
  unresolved(withAttachment);
  // Exhaust the existing bounded READ recovery budget; no prompt is resubmitted.
  await vi.advanceTimersByTimeAsync(60_000);
  unresolved(withAttachment);
  expect(chats.get(key)?.turns[2]?.text).toBe(text);
  expect(queues.get(key)).toHaveLength(1);
  expect(pendingAddenda.get(key)?.texts).toEqual(["Añadidura pendiente"]);
  expect(api.queue).not.toHaveBeenCalled();
});

it("protects an interrupted request on a direct history reload outside a resume", async () => {
  await sendRequest();
  const local = chats.get(key);
  expect(await reloadHistory(key, key)).toBe(false);
  expect(chats.get(key)).toBe(local);
  unresolved();
});

it("keeps a newer local request even if its timestamp collides with the previous prompt", async () => {
  vi.setSystemTime(new Date(previousUser.ts));
  await sendRequest(previousUser.content, false, false);
  await chatEngine.resume(key);
  unresolved(false);
});

it.each(["current-only", "rewritten-prefix", "successor-without-current-answer", "new-user-only", "no-user", "legacy-prefix"])(
  "does not invent request identity from %s history",
  async scenario => {
    await sendRequest();
    bufferedFollowUps();
    const currentUser: ConversationMessage = { ...previousUser, ts: "2026-10-17T11:00:01Z",
      attachments: [{ id: "saved-request", name: "request.txt", mimeType: "text/plain" }] };
    const final = answer("Respuesta ajena", "/project/src/other.ts", "2026-10-17T11:00:02Z");
    let items: ConversationMessage[];
    switch (scenario) {
      case "current-only": items = [currentUser, final]; break;
      case "rewritten-prefix": items = [{ ...previousUser, ts: "2026-10-17T09:00:00Z" }, previousAnswer, currentUser, final]; break;
      case "successor-without-current-answer":
        items = [...prior, currentUser, { ...currentUser, ts: "2026-10-17T11:00:03Z" }, final]; break;
      case "new-user-only": items = [...prior, currentUser]; break;
      case "no-user": items = [final]; break;
      default: {
        const chat = chats.get(key)!;
        chats.set(key, { ...chat, turns: chat.turns.map((turn, i) => i < 2 ? { ...turn, createdAt: undefined } : turn) });
        items = [...prior.map(message => ({ ...message, ts: "" })), currentUser, final];
      }
    }
    api.messages.mockResolvedValue({ items, total: items.length, hasMore: false });
    const before = chats.get(key)!.turns;
    await chatEngine.resume(key);
    expect(chats.get(key)?.turns.slice(0, -1)).toEqual(before.slice(0, -1));
    expect(last()).toMatchObject({ text: "", interrupted: true });
    expect(files(chats.get(key)!.turns[1]!)).toEqual([{ path: "/project/src/previous.ts", kind: "modified" }]);
    expect(queues.get(key)).toHaveLength(1);
    expect(pendingAddenda.has(key)).toBe(true);
    expect(api.send).toHaveBeenCalledTimes(1);
  },
);

it.each([false, true])("recovers a repeated request only when its own answer persists, extra older history=%s", async olderPage => {
  const currentUser: ConversationMessage = { ...previousUser, ts: "2026-10-17T11:00:03Z",
    attachments: [{ id: "saved-request", name: "request.txt", mimeType: "text/plain" }] };
  const currentAnswer = answer("Resultado actual", "/project/src/current.ts", "2026-10-17T11:00:05Z");
  const older: ConversationMessage[] = olderPage ? [
    { role: "user", content: "Antes", ts: "2026-10-17T09:00:00Z" },
    { role: "assistant", content: "Antes terminado", ts: "2026-10-17T09:00:01Z" },
  ] : [];
  api.send.mockImplementation(async function* () {
    for (const event of currentAnswer.apiActivity!.events) yield { event };
    throw new TypeError("Failed to fetch");
  });
  await sendRequest();
  const localFiles = files(last());
  expect(localFiles).toEqual([{ path: "/project/src/current.ts", kind: "modified" }]);
  await chatEngine.resume(key);
  unresolved();
  expect(files(last())).toEqual(localFiles);

  api.messages.mockResolvedValue({ items: [...older, ...prior, currentUser], hasMore: false });
  await chatEngine.resume(key);
  expect(last().interrupted).toBe(true);
  expect(files(last())).toEqual(localFiles);
  api.messages.mockResolvedValue({ items: [...older, ...prior, currentUser, currentAnswer], hasMore: false });
  await chatEngine.resume(key);
  expect(chats.get(key)?.turns).toHaveLength(older.length + 4);
  expect(chats.get(key)?.turns.at(-3)?.text).toBe("Resultado anterior");
  expect(last().text).toBe("Resultado actual");
  expect(last().interrupted).not.toBe(true);
  expect(files(last())).toEqual(localFiles);
  expect(files(chats.get(key)!.turns.at(-3)!)).toEqual([{ path: "/project/src/previous.ts", kind: "modified" }]);
  expect(chats.get(key)?.turns.at(-2)?.attachments?.[0]?.name).toBe("request.txt");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(api.send).toHaveBeenCalledTimes(1);
  expect(chats.get(key)?.turns).toHaveLength(older.length + 4);
});

it.each([
  { pending: true }, { error: "No se pudo guardar" }, { interrupted: true },
  { ask: [{ id: "q", type: "text" as const, text: "Decisión pendiente" }] },
])("keeps follow-ups blocked after recovering this request's non-success outcome %j", async outcome => {
  await sendRequest(); bufferedFollowUps();
  api.messages.mockResolvedValue({ items: [...prior,
    { ...previousUser, ts: "2026-10-17T11:00:01Z",
      attachments: [{ id: "saved-request", name: "request.txt", mimeType: "text/plain" }] },
    { ...answer("", "/project/src/current.ts", "2026-10-17T11:00:02Z"), ...outcome },
  ] });
  await chatEngine.resume(key);
  expect(last().text).toBe("");
  expect(last().interrupted).not.toBe(true);
  expect(last().completionPending || last().error || last().stopped || last().ask?.length).toBeTruthy();
  expect(files(last())).toEqual([{ path: "/project/src/current.ts", kind: "modified" }]);
  expect(queues.get(key)).toHaveLength(1);
  expect(pendingAddenda.has(key)).toBe(true);
  expect(api.send).toHaveBeenCalledTimes(1);
});

it("does not substitute a successor answer when the shared history anchor is ambiguous", async () => {
  await sendRequest();
  const current = { ...previousUser, ts: "2026-10-17T11:00:01Z",
    attachments: [{ id: "saved-request", name: "request.txt", mimeType: "text/plain" }] };
  api.messages.mockResolvedValue({ items: [...prior, ...prior, current,
    answer("Resultado de otro turno", "/project/src/other.ts", "2026-10-17T11:00:02Z")] });
  await chatEngine.resume(key);
  unresolved();
});

it("recovers a first request already identified by its stored timestamp", async () => {
  const userTurn = historyTurns([previousUser], "openai")[0]!;
  chats.set(key, { provider: "openai", conversationId: key, streaming: false,
    turns: [userTurn, { role: "assistant", text: "", tools: [], interrupted: true }] });
  await chatEngine.resume(key);
  expect(last().text).toBe(previousAnswer.content);
  expect(last().interrupted).not.toBe(true);
  expect(api.send).not.toHaveBeenCalled();
});

it("keeps a request without any positional or timestamp evidence unresolved", async () => {
  chats.set(key, { provider: "openai", conversationId: key, streaming: false,
    turns: [{ role: "user", text: previousUser.content, tools: [] },
      { role: "assistant", text: "", tools: [], interrupted: true }] });
  await chatEngine.resume(key);
  expect(last()).toMatchObject({ text: "", interrupted: true });
  expect(api.send).not.toHaveBeenCalled();
});
