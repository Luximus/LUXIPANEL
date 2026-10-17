import { beforeEach, expect, it, vi } from "vitest";
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ api: { get, post }, unwrap: (r: { data: unknown }) => r.data,
  resolveTargetScope: () => "server-1", scopeHeaders: () => ({}) }));
import { assistantConversationsApi } from "./conversations";
beforeEach(() => {
  vi.resetAllMocks();
  window.dispatchEvent(new Event("luxipanel:target-changed"));
});
it("opens one chat with one read for messages, metadata, context and session", async () => {
  get.mockResolvedValue({ ok: true, data: { items: [], total: 0, hasMore: false, conversation: { id: "chat" },
    context: { tokens: 20 }, sessionId: "upstream", sessions: { claude: "upstream" } } });
  const [messages, meta, context, session] = await Promise.all([
    assistantConversationsApi.messages("chat"), assistantConversationsApi.get("chat"),
    assistantConversationsApi.context("chat"), assistantConversationsApi.session("chat", "claude"),
  ]);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get.mock.calls[0]![0]).toContain("include=meta,session,context");
  expect(meta?.id).toBe("chat"); expect(messages.items).toEqual([]);
  expect(context).toEqual({ tokens: 20 }); expect(session.sessionId).toBe("upstream");
});

it("opens the full history even when marking it reviewed finishes first", async () => {
  const page = { items: [{ role: "assistant", content: "Respuesta guardada", ts: "2026-10-17T12:00:00Z" }],
    total: 1, hasMore: false, conversation: { id: "unread-chat", agentId: "agent" },
    context: { tokens: 20 }, sessionId: "upstream", sessions: { claude: "upstream" } };
  let finish!: (response: unknown) => void;
  get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  post.mockResolvedValue({ ok: true });
  const opening = Promise.all([
    assistantConversationsApi.messages("unread-chat"), assistantConversationsApi.get("unread-chat"),
    assistantConversationsApi.context("unread-chat"), assistantConversationsApi.session("unread-chat", "claude"),
  ]);
  await assistantConversationsApi.markReviewed("unread-chat");
  finish({ ok: true, data: page });
  await expect(opening).resolves.toEqual([
    page, page.conversation, page.context, { sessionId: "upstream", provider: "claude" },
  ]);
  expect(get).toHaveBeenCalledTimes(1);
});

it("still discards a history response when the target changes while opening", async () => {
  let finish!: (response: unknown) => void;
  get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const opening = assistantConversationsApi.messages("previous-target");
  await Promise.resolve();
  window.dispatchEvent(new Event("luxipanel:target-changed"));
  finish({ ok: true, data: { items: [], total: 0, hasMore: false } });
  await expect(opening).rejects.toThrow("Assistant request scope changed");
});
