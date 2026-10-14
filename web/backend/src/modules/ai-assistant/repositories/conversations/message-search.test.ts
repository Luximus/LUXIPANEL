import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ read: vi.fn(), user: 1, list: vi.fn(), set: vi.fn(), transaction: vi.fn() }));
vi.mock("../../../../shared/executor/context.js", () => ({ getContextUserId: () => mock.user }));
vi.mock("./stores.js", () => ({ readMessagesAny: mock.read }));
vi.mock("../../../../shared/data-store/index.js", () => ({ dataStore: () => ({ list: mock.list, set: mock.set, transaction: mock.transaction, delete: vi.fn() }) }));
import { searchConversationMessages, updateConversationSearch, conversationSearchStatus } from "./message-search.js";
const meta = { id: "test", title: "title", preview: "", provider: "claude", messageCount: 1, updatedAt: "2026-09-30" };
beforeEach(() => { mock.list.mockResolvedValue([]); mock.set.mockResolvedValue(null); mock.transaction.mockResolvedValue(null); });
it("returns immediately while a cold transcript is indexing", async () => {
  let finish!: (v: unknown) => void;
  mock.read.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const executor = { target: { id: "search-server-1" } } as any;
  const result = await searchConversationMessages(executor, [meta], "historic", true);
  expect(result.size).toBe(0);
  expect(conversationSearchStatus(executor, [meta]).state).toBe("indexing");
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  finish([{ role: "user", content: "historic text" }]);
  await vi.waitFor(() => expect(conversationSearchStatus(executor, [meta]).state).toBe("ready"));
  expect((await searchConversationMessages(executor, [meta], "historic", true)).size).toBe(1);
});
it("updates changed turns without rereading transcripts and isolates users", async () => {
  mock.read.mockClear();
  const executor = { target: { id: "search-server-2" } } as any;
  updateConversationSearch(executor, meta, [{ role: "assistant", content: "indexed incrementally" } as any]);
  expect((await searchConversationMessages(executor, [meta], "incrementally", true)).size).toBe(1);
  expect(mock.read).not.toHaveBeenCalled();
  mock.user = 2;
  expect((await searchConversationMessages(executor, [meta], "incrementally", true)).size).toBe(0);
});
