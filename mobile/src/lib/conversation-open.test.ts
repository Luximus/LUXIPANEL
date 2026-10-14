import { expect, it, vi } from "vitest";
import { createConversationOpenReader } from "./conversation-open";
it("opens messages, metadata, context and the selected provider session with one read", async () => {
  const reads = createConversationOpenReader();
  const load = vi.fn(async () => ({ items: [], conversation: { id: "a" }, context: { tokens: 2 }, sessions: { codex: "c", claude: "d" } }));
  const values = await Promise.all(["/messages?limit=50&offset=0", "", "/context", "/session?provider=codex"].map(path => reads.read("user:server", "/api/ai/conversations/a" + path, load)));
  expect(load).toHaveBeenCalledTimes(1);
  expect(values[3]).toEqual({ sessionId: "c" });
  expect(values[2]).toEqual({ context: { tokens: 2 } });
});
it("discards invalidated reads and falls back for older servers", async () => {
  const reads = createConversationOpenReader();
  let settle!: (value: any) => void;
  const pending = reads.read("u:s", "/api/ai/conversations/a/context", () => new Promise(resolve => { settle = resolve; }));
  await Promise.resolve(); reads.clear(); settle({ context: { tokens: 9 } });
  expect(await pending).toBeNull();
  const legacy = vi.fn(async path => path.includes("/messages") ? { items: [] } : { context: { tokens: 3 } });
  expect(await reads.read("u:s", "/api/ai/conversations/a/context", legacy)).toEqual({ context: { tokens: 3 } });
  expect(legacy).toHaveBeenCalledTimes(2);
});
