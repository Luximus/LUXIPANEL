// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dirCompareService } from "./dir-compare.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

let originalBases: string[] = [];
beforeEach(() => { originalBases = [...ALLOWED_BASES]; setAllowedBases(["/srv"]); });
afterEach(() => setAllowedBases(originalBases));

/** Executor whose sha256sum output is keyed by which dir is being hashed. */
function makeExecutor(trees: Record<string, Record<string, string>>) {
  const exec = vi.fn(async (cmd: string) => {
    // Find which root this find/xargs targets (the quoted dir in the command).
    const root = Object.keys(trees).find((d) => cmd.includes(`'${d}'`));
    const files = root ? trees[root]! : {};
    const stdout = Object.entries(files)
      .map(([rel, hash]) => `${hash}  ${root}/${rel}`)
      .join("\n");
    return { stdout, stderr: "", exitCode: 0, durationMs: 1 };
  });
  return { target: { id: "r", name: "R" }, exec } as never;
}

describe("dirCompareService.compare", () => {
  it("classifies added / removed / modified and counts same", async () => {
    const exec = makeExecutor({
      "/srv/prod": { "index.php": "AAA", "config.php": "BBB", "old.txt": "CCC" },
      "/srv/staging": { "index.php": "AAA", "config.php": "ZZZ", "new.txt": "DDD" },
    });
    const res = await dirCompareService.compare(exec, "/srv/prod", "/srv/staging");
    expect(res.counts).toEqual({ added: 1, removed: 1, modified: 1, same: 1 });

    const byPath = Object.fromEntries(res.entries.map((e) => [e.path, e.status]));
    expect(byPath["config.php"]).toBe("modified");
    expect(byPath["new.txt"]).toBe("added");   // only in staging (to)
    expect(byPath["old.txt"]).toBe("removed"); // only in prod (from)
    expect(byPath["index.php"]).toBeUndefined(); // same → not listed

    const mod = res.entries.find((e) => e.path === "config.php")!;
    expect(mod.fromPath).toBe("/srv/prod/config.php");
    expect(mod.toPath).toBe("/srv/staging/config.php");
    // modified sorts before added before removed
    expect(res.entries[0]?.status).toBe("modified");
  });

  it("returns all-same when trees are identical", async () => {
    const exec = makeExecutor({
      "/srv/a": { "x": "1", "y": "2" },
      "/srv/b": { "x": "1", "y": "2" },
    });
    const res = await dirCompareService.compare(exec, "/srv/a", "/srv/b");
    expect(res.entries).toHaveLength(0);
    expect(res.counts.same).toBe(2);
    expect(res.truncated).toBe(false);
  });
});
