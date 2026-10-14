import { expect, it, vi } from "vitest";
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ api: { get }, unwrap: (r: { data: unknown }) => r.data,
  resolveTargetScope: () => "server-1", scopeHeaders: () => ({}) }));
import { assistantConversationsApi } from "./conversations";
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
