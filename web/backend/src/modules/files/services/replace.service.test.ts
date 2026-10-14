// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the heavy deps so we exercise the replace logic in isolation.
const searchMock = vi.fn();
vi.mock("./content-search.service.js", () => ({
  contentSearchService: { search: (...a: unknown[]) => searchMock(...a) },
}));
const captureMock = vi.fn(async () => null);
vi.mock("./snapshot.service.js", () => ({
  snapshotService: { capture: (...a: unknown[]) => captureMock(...a) },
}));
vi.mock("../../../shared/files-cache/index.js", () => ({
  invalidateDir: vi.fn(),
  invalidateFile: vi.fn(),
  invalidateStat: vi.fn(),
}));

const { replaceService, buildMatcher, replaceLine } = await import("./replace.service.js");

function makeExecutor(files: Record<string, string>) {
  const store = new Map(Object.entries(files));
  const executor = {
    target: { id: "remote", name: "R" },
    readFile: vi.fn(async (p: string, _enc?: string) => {
      if (!store.has(p)) throw new Error("ENOENT");
      return store.get(p)!;
    }),
    writeFile: vi.fn(async (p: string, data: string) => { store.set(p, data); }),
  } as never;
  return { executor, store };
}

describe("replace helpers", () => {
  it("replaceLine counts and replaces literal matches", () => {
    const { re } = buildMatcher({ path: "/", search: "old.com", replacement: "new.com", mode: "text" });
    const { after, count } = replaceLine("a old.com b old.com", re, "new.com");
    expect(count).toBe(2);
    expect(after).toBe("a new.com b new.com");
  });

  it("escapes regex special chars in text mode", () => {
    const { re } = buildMatcher({ path: "/", search: "a.b", replacement: "X", mode: "text" });
    expect(replaceLine("a.b axb", re, "X")).toEqual({ after: "X axb", count: 1 });
  });

  it("honours $1 backrefs in regex mode", () => {
    const { re } = buildMatcher({ path: "/", search: "v(\\d+)", replacement: "ver-$1", mode: "regex" });
    expect(replaceLine("v12 and v3", re, "ver-$1")).toEqual({ after: "ver-12 and ver-3", count: 2 });
  });

  it("is case-insensitive by default, exact when caseSensitive", () => {
    const ci = buildMatcher({ path: "/", search: "foo", replacement: "bar", mode: "text" }).re;
    expect(replaceLine("Foo foo", ci, "bar").count).toBe(2);
    const cs = buildMatcher({ path: "/", search: "foo", replacement: "bar", mode: "text", caseSensitive: true }).re;
    expect(replaceLine("Foo foo", cs, "bar").count).toBe(1);
  });
});

describe("replaceService", () => {
  beforeEach(() => {
    searchMock.mockReset();
    captureMock.mockClear();
  });

  it("preview returns per-line before/after without writing", async () => {
    searchMock.mockResolvedValue({ files: [{ path: "/srv/.env", name: ".env", matches: [] }], totalMatches: 1, truncated: false });
    const { executor, store } = makeExecutor({ "/srv/.env": "A=old.com\nB=keep\nC=old.com" });
    const prev = await replaceService.preview(executor, { path: "/srv", search: "old.com", replacement: "new.com", mode: "text" });
    expect(prev.totalReplacements).toBe(2);
    expect(prev.files[0]?.replacements).toEqual([
      { line: 1, before: "A=old.com", after: "A=new.com" },
      { line: 3, before: "C=old.com", after: "C=new.com" },
    ]);
    // preview never writes
    expect(store.get("/srv/.env")).toBe("A=old.com\nB=keep\nC=old.com");
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("apply snapshots then writes the replaced content", async () => {
    searchMock.mockResolvedValue({ files: [{ path: "/srv/app.php", name: "app.php", matches: [] }], totalMatches: 1, truncated: false });
    const { executor, store } = makeExecutor({ "/srv/app.php": "host = old.com;" });
    const res = await replaceService.apply(executor, { path: "/srv", search: "old.com", replacement: "new.com", mode: "text" });
    expect(res.filesChanged).toBe(1);
    expect(res.totalReplacements).toBe(1);
    expect(captureMock).toHaveBeenCalledWith(executor, "/srv/app.php", "replace");
    expect(store.get("/srv/app.php")).toBe("host = new.com;");
  });

  it("apply skips files with no effective change", async () => {
    searchMock.mockResolvedValue({ files: [{ path: "/srv/x", name: "x", matches: [] }], totalMatches: 0, truncated: false });
    const { executor } = makeExecutor({ "/srv/x": "nothing here" });
    const res = await replaceService.apply(executor, { path: "/srv", search: "absent", replacement: "y", mode: "text" });
    expect(res.filesChanged).toBe(0);
    expect(captureMock).not.toHaveBeenCalled();
  });
});
