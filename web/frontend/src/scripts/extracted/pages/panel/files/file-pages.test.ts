import { describe, expect, it, vi } from "vitest";
import { createFilePages, type FilePageResult } from "./file-pages";

function response(start: number, count: number, total = 125): FilePageResult {
  return { ok: true, data: Array.from({ length: count }, (_, i) => ({ name: `file-${start + i}` })), meta: { filesList: { total, nextOffset: start + count, hasMore: start + count < total } } };
}

describe("file loading on demand", () => {
  it("requests one batch at a time and stops after the last batch", async () => {
    const read = vi.fn(async (offset: number) => response(offset, Math.min(50, 125 - offset)));
    const pages = createFilePages(() => "server:folder:tab", read, vi.fn());
    await pages.first();
    expect(read).toHaveBeenCalledTimes(1);
    expect(pages.get().items).toHaveLength(50);
    await pages.next(); await pages.next(); await pages.next();
    expect(read.mock.calls.map(call => call[0])).toEqual([0, 50, 100]);
    expect(pages.get()).toMatchObject({ total: 125, hasMore: false, loading: false });
    expect(pages.get().items).toHaveLength(125);
  });
  it("coalesces repeated scroll events while a request is pending", async () => {
    let finish!: (r: FilePageResult) => void;
    const read = vi.fn().mockResolvedValueOnce(response(0, 50)).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pages = createFilePages(() => "folder", read, vi.fn());
    await pages.first();
    const pending = pages.next(); await pages.next(); await pages.next();
    expect(read).toHaveBeenCalledTimes(2);
    finish(response(50, 50)); await pending;
    expect(pages.get().items).toHaveLength(100);
  });
  it("retains loaded files after an error and retries the same offset", async () => {
    const read = vi.fn().mockResolvedValueOnce(response(0, 50)).mockResolvedValueOnce({ ok: false, error: "unavailable" }).mockResolvedValueOnce(response(50, 50));
    const pages = createFilePages(() => "folder", read, vi.fn());
    await pages.first(); await pages.next();
    expect(pages.get()).toMatchObject({ error: "unavailable", loading: false });
    expect(pages.get().items).toHaveLength(50);
    await pages.next();
    expect(read.mock.calls.map(call => call[0])).toEqual([0, 50, 50]);
    expect(pages.get().items).toHaveLength(100);
  });
  it.each(["target", "directory", "tab", "sort", "hidden", "search"])("discards a delayed reply after the %s changes", async () => {
    let context = "before", finish!: (r: FilePageResult) => void;
    const publish = vi.fn();
    const read = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(response(100, 1, 101));
    const pages = createFilePages(() => context, read, publish);
    const pending = pages.first(); context = "after";
    await pages.first();
    finish(response(0, 50));
    expect(await pending).toMatchObject({ code: "STALE_FILES_LIST" });
    expect(pages.get().items.map(e => e.name)).toEqual(["file-100"]);
  });
  it("cancels outstanding work when the module closes", async () => {
    let finish!: (r: FilePageResult) => void;
    const publish = vi.fn();
    const pages = createFilePages(() => "folder", () => new Promise(resolve => { finish = resolve; }), publish);
    const pending = pages.first(); pages.cancel(); publish.mockClear();
    finish(response(0, 50)); await pending;
    expect(publish).not.toHaveBeenCalled();
  });
  it("deduplicates entries across batches and avoids loops on an empty batch", async () => {
    const read = vi.fn().mockResolvedValueOnce(response(0, 50)).mockResolvedValueOnce(response(49, 50)).mockResolvedValueOnce(response(99, 0));
    const pages = createFilePages(() => "folder", read, vi.fn());
    await pages.first(); await pages.next();
    expect(pages.get().items).toHaveLength(99);
    await pages.next(); await pages.next();
    expect(read).toHaveBeenCalledTimes(3);
    expect(pages.get().hasMore).toBe(false);
  });
});
