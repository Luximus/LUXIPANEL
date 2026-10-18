// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ConversationMessage } from "../assistant-api";
import type { ChatTurn } from "./types";

const io = vi.hoisted(() => ({ messages: vi.fn() }));
vi.mock("../assistant-api", () => ({
  assistantConversationsApi: { messages: io.messages, markReviewed: vi.fn(async () => {}) },
  displayText: (message: ConversationMessage) => (message.role === "user" ? message.textOriginal : message.textTranslated) ?? message.content,
  attachmentUrl: (id: string) => "/api/ai/attachments/" + id,
}));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => "contract-edge-target" }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));

import { chatEngine } from "../chat-engine";
import { historyTurn } from "./history";
import { applyEvent, reloadHistory } from "./stream-apply";
import { chats, backgroundActive, backgroundPending } from "./state";

const key = "contract-edges";
const request: ChatTurn = { role: "user", text: "Entrega el documento completo", tools: [] };
const message = (fields: Partial<ConversationMessage> = {}): ConversationMessage => ({
  role: "assistant", content: "Respuesta completa.", ts: "", messageId: "answer-a", presentation: "full", ...fields,
});
const evidence = { id: "write", name: "files.write", input: { path: "/project/document.txt" },
  result: { success: true, output: "Guardado" } };
const seed = (turns: ChatTurn[]) => chats.set(key, {
  provider: "openai", conversationId: key, turns, streaming: false, runId: "run-a", lastSeq: -1,
});

beforeEach(() => {
  io.messages.mockReset();
  vi.spyOn(chatEngine, "refreshTeamTasks").mockResolvedValue(undefined);
});
afterEach(() => {
  chats.clear(); backgroundActive.clear(); backgroundPending.clear(); vi.restoreAllMocks();
});

it.each([false, true])("preserves legacy CLI documents with console examples, translated=%s", translated => {
  const document = "Manual solicitado.\n\n```sh\n$ printf ejemplo\n```\n\nÚltimo párrafo del documento.";
  const stored: ConversationMessage = { role: "assistant", cli: true, content: document, ts: "",
    ...(translated ? { textTranslated: document } : {}), displaySummary: "Resumen anterior." };
  expect(historyTurn(stored).text).toBe(document);
  expect(stored.content).toBe(document);
});

it("retains a legacy pending notice rather than discarding its stored content", () => {
  const notice = "El resultado sigue pendiente. Hay que revisar el servicio antes de repetir.";
  expect(historyTurn({ role: "assistant", cli: true, content: notice, pending: true, ts: "" }))
    .toMatchObject({ text: notice, completionPending: true });
});

it("preserves confirmed file evidence when a pending response completes in a history window", async () => {
  seed([request, { ...historyTurn(message({ content: "", pending: true })), tools: [evidence] }]);
  io.messages.mockResolvedValue({ items: [message({ content: "Documento terminado." })] });
  await chatEngine.refreshVoiceHistory(key, key);
  expect(chats.get(key)?.turns).toHaveLength(2);
  expect(chats.get(key)?.turns.at(-1)).toMatchObject({ messageId: "answer-a", text: "Documento terminado.", tools: [evidence] });
  expect(chats.get(key)?.turns.at(-1)?.completionPending).not.toBe(true);
});

it("does not downgrade a complete response after a delayed pending history snapshot", async () => {
  seed([request, historyTurn(message({ content: "Documento terminado." }))]);
  io.messages.mockResolvedValue({ items: [message({ content: "", pending: true })] });
  await chatEngine.refreshVoiceHistory(key, key);
  expect(chats.get(key)?.turns.at(-1)).toMatchObject({ messageId: "answer-a", text: "Documento terminado." });
  expect(chats.get(key)?.turns.at(-1)?.completionPending).not.toBe(true);
});

it("keeps local evidence when reload correlates a completed response by message ID", async () => {
  seed([request, { ...historyTurn(message({ content: "", pending: true })), tools: [evidence] }]);
  io.messages.mockResolvedValue({ items: [
    { role: "user", content: request.text, ts: "" }, message(),
  ] });
  expect(await reloadHistory(key, key)).toBe(true);
  expect(chats.get(key)?.turns.at(-1)?.tools).toEqual([evidence]);
});

it("does not append replay text or usage to a completed response restored by ID", () => {
  seed([request, historyTurn(message({ tokens: { input: 2, output: 3, total: 5 } }))]);
  const context = { isCli: false, startedAt: 0, replay: true };
  applyEvent(key, { type: "text", phase: "final_answer", delta: "Respuesta completa.", runId: "run-a" }, { ...context, seq: 1 });
  applyEvent(key, { type: "usage", model: "fixture", inputTokens: 2, outputTokens: 3, runId: "run-a" }, { ...context, seq: 2 });
  applyEvent(key, { type: "done", messageId: "answer-a", runId: "run-a" }, { ...context, seq: 3 });
  expect(chats.get(key)?.turns).toHaveLength(2);
  expect(chats.get(key)?.turns.at(-1)).toMatchObject({ text: "Respuesta completa.", tokens: { input: 2, output: 3, total: 5 } });
});

it("does not erase a completed response on a late pending terminal for the same ID", () => {
  seed([request, historyTurn(message())]);
  applyEvent(key, { type: "done", messageId: "answer-a", pending: true, runId: "run-a" },
    { isCli: false, startedAt: 0, replay: true, seq: 5 });
  expect(chats.get(key)?.turns.at(-1)).toMatchObject({ text: "Respuesta completa.", messageId: "answer-a" });
  expect(chats.get(key)?.turns.at(-1)?.completionPending).not.toBe(true);
});

it("does not inherit a summary signal when the next completion omits presentation", () => {
  seed([request, { ...historyTurn(message({ presentation: "summary", displaySummary: "Proyección anterior." })), pending: true }]);
  applyEvent(key, { type: "done", messageId: "answer-a", displaySummary: "Solo proyección", runId: "run-a" },
    { isCli: false, startedAt: 0, seq: 1 });
  expect(chats.get(key)?.turns.at(-1)?.presentation).not.toBe("summary");
  expect(chats.get(key)?.turns.at(-1)?.text).toBe("Respuesta completa.");
});
