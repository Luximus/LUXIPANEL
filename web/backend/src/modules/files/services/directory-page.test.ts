import { describe, expect, it } from "vitest";
import { directoryPage } from "./directory-page.js";

const entries = [
  { name: "z-dir", isDir: true, size: 0 },
  { name: "file10.txt", isDir: false, size: 10 },
  { name: ".hidden", isDir: false, isHidden: true, size: 3 },
  { name: "file2.txt", isDir: false, size: 20 },
  { name: "a-dir", isDir: true, size: 0 },
];

describe("directory windows", () => {
  it("preserves the complete response for existing trees and directory pickers", () => {
    expect(directoryPage(entries, {}).data).toBe(entries);
    expect(directoryPage(entries, {})).not.toHaveProperty("meta");
  });
  it("sorts the full directory before slicing, with folders first and numeric names", () => {
    const first = directoryPage(entries, { limit: 2 });
    const second = directoryPage(entries, { limit: 2, offset: 2 });
    expect(first.data.map(e => e.name)).toEqual(["a-dir", "z-dir"]);
    expect(first.meta?.filesList).toEqual({ total: 4, nextOffset: 2, hasMore: true });
    expect(second.data.map(e => e.name)).toEqual(["file2.txt", "file10.txt"]);
    expect(second.meta?.filesList.hasMore).toBe(false);
    expect(entries[0].name).toBe("z-dir");
  });
  it("filters hidden entries and the search before counting and paging", () => {
    expect(directoryPage(entries, { limit: 50, showHidden: "true" }).meta?.filesList.total).toBe(5);
    const result = directoryPage(entries, { limit: 1, query: "FILE" });
    expect(result.data[0].name).toBe("file2.txt");
    expect(result.meta?.filesList.total).toBe(2);
  });
  it("applies descending size globally while retaining folders first", () => {
    expect(directoryPage(entries, { limit: 2, offset: 2, sortKey: "size", sortDir: "desc" }).data.map(e => e.name)).toEqual(["file2.txt", "file10.txt"]);
  });
  it("reports the end for empty directories and offsets beyond the last entry", () => {
    expect(directoryPage([], { limit: 50 }).meta?.filesList).toEqual({ total: 0, nextOffset: 0, hasMore: false });
    expect(directoryPage(entries, { limit: 50, offset: 100 }).meta?.filesList.hasMore).toBe(false);
  });
});
