// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();
vi.mock("./snapshot.service.js", () => ({
  snapshotService: { list: (...a: unknown[]) => listMock(...a) },
}));

const { fileHistoryService } = await import("./file-history.service.js");
const { ALLOWED_BASES, setAllowedBases } = await import("./filesystem.service.js");

let originalBases: string[] = [];
beforeEach(() => { listMock.mockReset(); originalBases = [...ALLOWED_BASES]; setAllowedBases(["/srv"]); });
afterEach(() => setAllowedBases(originalBases));

function gitExecutor(opts: { root?: string; log?: string; showExit?: number; showOut?: string; catFileExit?: number }) {
  const exec = vi.fn(async (cmd: string) => {
    if (cmd.includes("rev-parse") && cmd.includes("--show-toplevel")) {
      return { stdout: opts.root ?? "", stderr: "", exitCode: opts.root ? 0 : 128, durationMs: 1 };
    }
    if (cmd.includes("'log'")) {
      return { stdout: opts.log ?? "", stderr: "", exitCode: 0, durationMs: 1 };
    }
    if (cmd.includes("'cat-file'")) {
      return { stdout: "", stderr: "", exitCode: opts.catFileExit ?? 0, durationMs: 1 };
    }
    if (cmd.includes("'show'")) {
      return { stdout: opts.showOut ?? "", stderr: "", exitCode: opts.showExit ?? 0, durationMs: 1 };
    }
    return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
  });
  return { target: { id: "r", name: "R" }, exec } as never;
}

describe("fileHistoryService.history", () => {
  it("merges snapshots and git commits, newest first", async () => {
    listMock.mockResolvedValue([
      { id: "s1", op: "edit", kind: "file", capturedAt: "2026-05-22T10:00:00.000Z" },
    ]);
    const log = [
      "abc1234deadbeef|2026-05-22T12:00:00+00:00|Ana|fix bug | with pipe",
      "def5678cafef00d|2026-05-20T09:00:00+00:00|Beto|initial",
    ].join("\n");
    const exec = gitExecutor({ root: "/srv/app", log });
    const res = await fileHistoryService.history(exec, "/srv/app/src/index.php");

    expect(res.gitRoot).toBe("/srv/app");
    expect(res.relPath).toBe("src/index.php");
    expect(res.entries).toHaveLength(3);
    // newest is the 12:00 git commit
    expect(res.entries[0]?.source).toBe("git");
    expect(res.entries[0]?.rev).toBe("abc1234deadbeef");
    expect(res.entries[0]?.subject).toBe("fix bug | with pipe"); // subject keeps pipes
    // snapshot present
    expect(res.entries.some((e) => e.source === "snapshot" && e.snapshotId === "s1")).toBe(true);
  });

  it("returns only snapshots when not in a git repo", async () => {
    listMock.mockResolvedValue([{ id: "s1", op: "replace", kind: "file", capturedAt: "2026-05-22T10:00:00.000Z" }]);
    const exec = gitExecutor({}); // no root
    const res = await fileHistoryService.history(exec, "/srv/plain/file.txt");
    expect(res.gitRoot).toBeNull();
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0]?.source).toBe("snapshot");
  });
});

describe("fileHistoryService.gitShow", () => {
  it("rejects an invalid revision", async () => {
    await expect(fileHistoryService.gitShow(gitExecutor({ root: "/srv/app" }), "/srv/app/x", "not-a-rev")).rejects.toThrow(/inválida/);
  });

  it("returns content for a valid revision", async () => {
    const exec = gitExecutor({ root: "/srv/app", showOut: "<?php echo 'v1';", showExit: 0 });
    const out = await fileHistoryService.gitShow(exec, "/srv/app/index.php", "abc1234");
    expect(out).toBe("<?php echo 'v1';");
  });

  it("accepts the symbolic HEAD revision (diff baseline)", async () => {
    const exec = gitExecutor({ root: "/srv/app", showOut: "<?php echo 'head';", showExit: 0 });
    const out = await fileHistoryService.gitShow(exec, "/srv/app/index.php", "HEAD");
    expect(out).toBe("<?php echo 'head';");
  });

  it("returns an empty baseline for a file absent at the revision (newly created)", async () => {
    // show fails AND cat-file confirms the path does not exist at HEAD → "" so
    // the whole file legitimately renders as added.
    const exec = gitExecutor({ root: "/srv/app", showExit: 128, catFileExit: 1 });
    const out = await fileHistoryService.gitShow(exec, "/srv/app/new.php", "HEAD");
    expect(out).toBe("");
  });

  it("throws when show fails for a tracked file (avoids a bogus all-added diff)", async () => {
    // show fails but cat-file confirms the path DOES exist at HEAD → real error.
    const exec = gitExecutor({ root: "/srv/app", showExit: 1, catFileExit: 0 });
    await expect(fileHistoryService.gitShow(exec, "/srv/app/index.php", "HEAD")).rejects.toThrow(/No se pudo leer/);
  });
});
