// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ConversationMessage, AgentEvent } from "../assistant-api";
import type { ChatTurn } from "./types";

const io = vi.hoisted(() => ({ messages: vi.fn(), scope: "target-a" }));
vi.mock("../assistant-api", () => ({
  assistantConversationsApi: { messages: io.messages, markReviewed: vi.fn(async () => {}) },
  displayText: (message: ConversationMessage) => (message.role === "user" ? message.textOriginal : message.textTranslated) ?? message.content,
  attachmentUrl: (id: string) => "/api/ai/attachments/" + id,
}));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => io.scope }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));

import { chatEngine } from "../chat-engine";
import { historyTurn, historyTurns, reconcileMessageTurns } from "./history";
import { findSavedRequestIndex } from "./history-identity";
import { applyEvent, reloadHistory, reconcileRunHistory } from "./stream-apply";
import { chats, backgroundActive, backgroundPending } from "./state";

const key = "durable-response";
const request: ChatTurn = { role: "user", text: "Solicitud repetida", tools: [] };
const saved = (messageId?: string, fields: Partial<ConversationMessage> = {}): ConversationMessage => ({
  role: "assistant", content: "Respuesta idéntica", ts: "", ...(messageId ? { messageId } : {}), ...fields,
});
const seed = (turns: ChatTurn[]) => chats.set(key, {
  provider: "openai", conversationId: key, turns, streaming: false, runId: "transport-a", lastSeq: -1,
});
const context = { isCli: false, startedAt: 0 };
beforeEach(() => { io.scope = "target-a"; io.messages.mockReset(); });
afterEach(() => { chats.clear(); backgroundActive.clear(); backgroundPending.clear(); vi.restoreAllMocks(); });

it.each([false, true])("keeps the complete translated body and optional metadata in history: cli=%s", cli => {
  const text = "```ts\n" + "const retained = true;\n".repeat(250) + "```";
  const message = saved("response-one", { content: "Canonical source", textTranslated: text,
    presentation: "full", displaySummary: "A bounded projection", cli, cliLog: cli ? "$ command\nProcess" : undefined });
  expect(historyTurn(message)).toMatchObject({ messageId: "response-one", presentation: "full", text });
  expect(message.content).toBe("Canonical source");
});

it("reconciles a pending response with its completion without downgrading on a late pending snapshot", () => {
  const pending = saved("one", { content: "", pending: true, presentation: "full" });
  const complete = saved("one", { content: "Completed body", presentation: "summary", displaySummary: "Completed" });
  const turns = historyTurns([pending, complete, pending]);
  expect(turns).toHaveLength(1);
  expect(turns[0]).toMatchObject({ messageId: "one", text: "Completed body", presentation: "summary" });
  expect(turns[0]?.completionPending).not.toBe(true);
  expect(turns[0]?.pending).not.toBe(true);
});

it("keeps separate IDs and all legacy messages even when their text and timestamp are identical", () => {
  const messages = [saved("one"), saved("two"), saved(), saved(), saved("   "), saved("   ")];
  expect(historyTurns(messages).map(turn => turn.messageId)).toEqual(["one", "two", undefined, undefined, "   ", "   "]);
});

it("retains tool evidence and one canonical body when overlapping history pages share a response ID", () => {
  const pending: ChatTurn = { ...historyTurn(saved("one", { pending: true, content: "" })),
    tools: [{ id: "write", name: "files.write", input: { path: "/project/result.ts" }, result: { success: true, output: "Saved" } }] };
  chatEngine.seed(key, "openai", key, [pending, historyTurn(saved("one")), historyTurn(saved("two"))]);
  const turns = chats.get(key)!.turns;
  expect(turns).toHaveLength(2);
  expect(turns[0]?.text).toBe("Respuesta idéntica");
  expect(turns[0]?.tools[0]?.result?.success).toBe(true);
  expect(reconcileMessageTurns(turns)).toEqual(turns);
});

it.each(["done", "pending", "error"] as const)("retains response identity independently from the SSE cursor on %s", outcome => {
  seed([request, { role: "assistant", text: "Full answer", tools: [], pending: true }]);
  const event: AgentEvent = outcome === "error"
    ? { type: "error", message: "Unconfirmed result", messageId: "logical-a", presentation: "summary", runId: "transport-a" }
    : { type: "done", messageId: "logical-a", presentation: "summary", displaySummary: "Short view", runId: "transport-a", ...(outcome === "pending" ? { pending: true } : {}) };
  applyEvent(key, event, { ...context, seq: 4 });
  const turn = chats.get(key)!.turns.at(-1)!;
  expect(turn.messageId).toBe("logical-a");
  expect(turn.presentation).toBe(outcome === "done" ? "summary" : "full");
  expect(turn.pending).toBe(false);
  expect(chats.get(key)?.runId).toBe("transport-a");
  expect(chats.get(key)?.lastSeq).toBe(4);
  const snapshot = chats.get(key);
  applyEvent(key, event, { ...context, seq: 4, replay: true });
  expect(chats.get(key)).toBe(snapshot);
});

it("updates the same logical response when a replay terminal closes a duplicate placeholder", () => {
  seed([request, historyTurn(saved("logical-a", { pending: true })),
    { role: "assistant", text: "Complete answer", tools: [], pending: true }]);
  applyEvent(key, { type: "done", messageId: "logical-a", presentation: "full", runId: "transport-a" }, { ...context, seq: 7 });
  expect(chats.get(key)?.turns).toHaveLength(2);
  expect(chats.get(key)?.turns.at(-1)).toMatchObject({ messageId: "logical-a", text: "Complete answer", pending: false });
});

it.each([false, true])("does not settle a new request with an older response ID: identified=%s", identified => {
  seed([request, historyTurn(saved("older")), { ...request },
    { role: "assistant", text: "", tools: [], pending: true, ...(identified ? { messageId: "current" } : {}) }]);
  backgroundActive.set(key, { provider: "openai", cli: false }); backgroundPending.add(key);
  const before = chats.get(key);
  applyEvent(key, { type: "done", messageId: "older", runId: "transport-a" }, { ...context, seq: 10 });
  expect(chats.get(key)).toBe(before);
  expect(backgroundActive.has(key)).toBe(true);
  expect(backgroundPending.has(key)).toBe(true);
});

it("reloads a pending response by durable identity without inferring identity from timestamps or prose", async () => {
  seed([request, historyTurn(saved("logical-a", { pending: true, content: "" }))]);
  const final = saved("logical-a", { textTranslated: "Final translated body", presentation: "full" });
  io.messages.mockResolvedValue({ items: [{ role: "user", content: "Persisted translated request", ts: "" }, final] });
  expect(await reloadHistory(key, key)).toBe(true);
  expect(chats.get(key)?.turns).toHaveLength(2);
  expect(chats.get(key)?.turns.at(-1)).toMatchObject({ messageId: "logical-a", text: "Final translated body", presentation: "full" });
});

it("rejects matching prose with a different response ID even when the legacy context matches", async () => {
  const oldRequest: ChatTurn = { ...request, createdAt: 10 };
  const local = [oldRequest, historyTurn(saved("local", { pending: true }))];
  seed(local);
  io.messages.mockResolvedValue({ items: [
    { role: "user", content: request.text, ts: new Date(10).toISOString() }, saved("other"),
  ] });
  expect(await reloadHistory(key, key)).toBe(false);
  expect(chats.get(key)?.turns).toBe(local);
  expect(findSavedRequestIndex(local, [oldRequest, historyTurn(saved("other"))])).toBeNull();
});

it("reconciles a completed selected buffer using the same persisted response ID", async () => {
  seed([request, { ...historyTurn(saved("logical-a", { pending: true })), interrupted: true }]);
  io.messages.mockResolvedValue({ items: [{ role: "user", content: "Translated prompt", ts: "" }, saved("logical-a")] });
  expect(await reconcileRunHistory(key, key, { runId: "transport-a", done: true })).toBe("saved");
  expect(chats.get(key)?.turns).toHaveLength(2);
  expect(chats.get(key)?.turns.at(-1)?.interrupted).not.toBe(true);
});

it("discards a late response after the target changes even when the message ID matches", async () => {
  seed([request, historyTurn(saved("logical-a", { pending: true }))]);
  const before = chats.get(key);
  let resolve!: (value: { items: ConversationMessage[] }) => void;
  io.messages.mockImplementation(() => new Promise(done => { resolve = done; }));
  const reload = reloadHistory(key, key);
  io.scope = "target-b";
  resolve({ items: [saved("logical-a")] });
  expect(await reload).toBe(false);
  expect(chats.get(key)).toBe(before);
});

it("does not downgrade a terminal response when a later REST refresh still reports pending", async () => {
  seed([request, historyTurn(saved("logical-a", { content: "Final body", presentation: "full" }))]);
  io.messages.mockResolvedValue({ items: [
    { role: "user", content: request.text, ts: "" }, saved("logical-a", { pending: true, content: "" }),
  ] });
  expect(await reloadHistory(key, key)).toBe(true);
  expect(chats.get(key)?.turns.at(-1)).toMatchObject({ messageId: "logical-a", text: "Final body" });
  expect(chats.get(key)?.turns.at(-1)?.completionPending).not.toBe(true);
});

it("preserves a legacy CLI document without classifying it as a terminal transcript", () => {
  const content = "Documento solicitado.\n\n" + Array.from({ length: 60 }, (_, index) => "Apartado " + index + ": texto completo.").join("\n\n");
  expect(historyTurn(saved(undefined, { content, cli: true })).text).toBe(content);
});

it("does not carry an ID match from another conversation when seeding a new chat", () => {
  seed([historyTurn(saved("same-id", { content: "Other conversation body" }))]);
  chatEngine.seed(key, "openai", "other-conversation", [historyTurn(saved("same-id", { content: "", pending: true }))]);
  expect(chats.get(key)?.turns[0]?.completionPending).toBe(true);
  expect(chats.get(key)?.turns[0]?.text).toBe("");
});
