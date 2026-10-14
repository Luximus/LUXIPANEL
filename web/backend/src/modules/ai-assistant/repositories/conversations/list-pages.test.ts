import { describe, expect, it } from "vitest";
import { createConversationPager } from "./list-pages.js";

describe("scoped conversation cursors", () => {
  const rows = Array.from({ length: 500 }, (_, id) => ({ id: String(id) }));
  it.each([0, 15, 16, 500])("returns one bounded page for %i chats", count => {
    const result = createConversationPager()(rows.slice(0, count), "s:u", "", 15);
    expect(result.items).toHaveLength(Math.min(count, 15));
    expect(result.hasMore).toBe(count > 15);
  });
  it("keeps order across new, reordered and deleted chats without repeating rows", () => {
    const page = createConversationPager();
    const first = page(rows, "s:u", "", 15);
    const changed = [{ id: "new" }, ...rows.filter(r => r.id !== "16").reverse()];
    const next = page(changed, "s:u", "", 15, first.nextCursor!);
    expect(next.items.map(r => r.id)).toEqual(["15", ...Array.from({ length: 14 }, (_, i) => String(i + 17))]);
    expect(next.total).toBe(499);
  });
  it("rejects another user, server, query, expired and malformed cursors", () => {
    let time = 0;
    const page = createConversationPager(() => time, 100);
    const first = page(rows, "s:u", "q", 15);
    for (const [scope, query, cursor] of [["other:u", "q", first.nextCursor], ["s:v", "q", first.nextCursor], ["s:u", "x", first.nextCursor], ["s:u", "q", "bad:NaN"]]) {
      expect(() => page(rows, scope!, query!, 15, cursor!)).toThrow();
    }
    time = 101;
    expect(() => page(rows, "s:u", "q", 15, first.nextCursor!)).toThrow();
  });
});
