import { describe, expect, it, vi } from "vitest";
import { createPagedList } from "./paged-list";

describe("demand-only history", () => {
  it("fetches only 15 initially and one page per demand despite duplicate events", async () => {
    const fetch = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => ({ items: Array.from({ length: limit }, (_, i) => ({ id: offset + i })), total: 500 }));
    const list = createPagedList(fetch, () => {});
    await list.first();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(list.get().items).toHaveLength(15);
    await Promise.all([list.next(), list.next(), list.next()]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(list.get().items).toHaveLength(30);
  });
  it("retains the page and retries its cursor after a failure", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ items: [{ id: 1 }], total: 2, hasMore: true, nextCursor: "cursor" })
      .mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [{ id: 2 }], total: 2, hasMore: false });
    const list = createPagedList<{ id: number }>(fetch, () => {});
    await list.first(); await list.next();
    expect(list.get().items).toEqual([{ id: 1 }]);
    await list.next();
    expect(fetch.mock.calls[2][0].cursor).toBe("cursor");
    expect(list.get().items).toEqual([{ id: 1 }, { id: 2 }]);
    await list.next(); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("discards a reply after a scope change/cancellation", async () => {
    let resolve!: (value: { items: { id: number }[]; total: number }) => void;
    const publish = vi.fn();
    const list = createPagedList<{id:number}>(() => new Promise(r => { resolve = r; }), publish);
    const pending = list.first(); list.cancel();
    resolve({ items: [{ id: 1 }], total: 1 }); await pending;
    expect(publish).toHaveBeenCalledTimes(1);
    expect(list.get().items).toHaveLength(0);
  });
});

it("fetches two pages per batch and retains a successful page after a failure", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({items:[{id:1}],total:4,hasMore:true})
    .mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({items:[{id:2},{id:3}],total:4,hasMore:true})
    .mockResolvedValueOnce({items:[{id:4}],total:4,hasMore:false});
  const list=createPagedList<{id:number}>(fetch,()=>{},2,2);
  await list.first(); expect(list.get().items).toEqual([{id:1}]); expect(list.get().error).toBeTruthy();
  await list.next(); expect(fetch.mock.calls[2]![0].offset).toBe(1); expect(list.get().items).toHaveLength(4);
});
