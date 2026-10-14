// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveService } from "./archive.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

describe("archiveService remote helpers", () => {
  let tempRoot = "";
  let originalBases: string[] = [];

  beforeEach(() => {
    originalBases = [...ALLOWED_BASES];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-archive-"));
    setAllowedBases([tempRoot]);
  });

  afterEach(() => {
    setAllowedBases(originalBases);
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("builds tar and unzip commands for an executor", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    const sourceA = path.join(tempRoot, "source-a");
    const sourceB = path.join(tempRoot, "source-b");
    const archivePath = path.join(tempRoot, "archive.tar.gz");
    const zipPath = path.join(tempRoot, "archive.zip");
    const extractPath = path.join(tempRoot, "extracted");

    await archiveService.compressWithExecutor(
      [sourceA, sourceB],
      archivePath,
      "tar.gz",
      { target: { id: "remote", name: "Remote" }, exec } as never,
    );

    await archiveService.extractWithExecutor(
      zipPath,
      extractPath,
      { target: { id: "remote", name: "Remote" }, exec } as never,
    );

    await archiveService.listContentsWithExecutor(
      archivePath,
      { target: { id: "remote", name: "Remote" }, exec } as never,
    );

    const cmds = exec.mock.calls.map((c) => String(c[0]));
    expect(cmds[0]).toContain("tar");
    expect(cmds[0]).toContain("-czf");
    expect(cmds[0]).toContain(archivePath);
    // Extraction is preceded by the containment audit (unzip -Z1 / -Z),
    // then the actual `unzip -o` runs.
    expect(cmds.some((c) => c.includes("-Z1"))).toBe(true);
    expect(cmds.some((c) => c.includes("unzip") && c.includes("'-o'"))).toBe(true);
    expect(cmds.some((c) => c.includes("tar") && c.includes("-tzf"))).toBe(true);
  });
});

describe("archiveService.extractWithExecutor zip-slip/symlink containment", () => {
  let tempRoot = "";
  let originalBases: string[] = [];

  beforeEach(() => {
    originalBases = [...ALLOWED_BASES];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-archive-guard-"));
    setAllowedBases([tempRoot]);
  });

  afterEach(() => {
    setAllowedBases(originalBases);
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  /** Executor whose tar verbose listing returns the given rows. */
  function tarExecutor(listingRows: string[]) {
    const exec = vi.fn(async (cmd: string) => {
      if (cmd.includes("-tvzf")) {
        return { stdout: listingRows.join("\n"), stderr: "", exitCode: 0, durationMs: 1 };
      }
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    return { executor: { target: { id: "r", name: "R" }, exec } as never, exec };
  }

  it("rejects tar members with .. traversal and never extracts", async () => {
    const { executor, exec } = tarExecutor([
      "-rw-r--r-- root/root 10 2026-07-21 10:00 ok.txt",
      "-rw-r--r-- root/root 10 2026-07-21 10:00 ../../../etc/x",
    ]);
    await expect(
      archiveService.extractWithExecutor(path.join(tempRoot, "a.tar.gz"), path.join(tempRoot, "out"), executor),
    ).rejects.toThrow(/contains "\.\."/);
    expect(exec.mock.calls.some((c) => String(c[0]).includes("-xzf"))).toBe(false);
  });

  it("rejects absolute tar members", async () => {
    const { executor } = tarExecutor([
      "-rw-r--r-- root/root 10 2026-07-21 10:00 /etc/cron.d/evil",
    ]);
    await expect(
      archiveService.extractWithExecutor(path.join(tempRoot, "a.tar.gz"), path.join(tempRoot, "out"), executor),
    ).rejects.toThrow(/absolute archive member/);
  });

  it("rejects symlink members pointing outside the destination", async () => {
    const { executor, exec } = tarExecutor([
      "lrwxrwxrwx root/root 0 2026-07-21 10:00 link -> ../../etc/passwd",
    ]);
    await expect(
      archiveService.extractWithExecutor(path.join(tempRoot, "a.tar.gz"), path.join(tempRoot, "out"), executor),
    ).rejects.toThrow(/points outside the destination/);
    expect(exec.mock.calls.some((c) => String(c[0]).includes("-xzf"))).toBe(false);
  });

  it("rejects symlink members with absolute targets", async () => {
    const { executor } = tarExecutor([
      "lrwxrwxrwx root/root 0 2026-07-21 10:00 link -> /etc/shadow",
    ]);
    await expect(
      archiveService.extractWithExecutor(path.join(tempRoot, "a.tar.gz"), path.join(tempRoot, "out"), executor),
    ).rejects.toThrow(/absolute path/);
  });

  it("rejects a member whose name embeds an escaped newline forging a second row", async () => {
    // GNU tar escapes a real newline in a member name to a literal backslash-n
    // and keeps the name on ONE line, so a hostile name cannot inject a fake
    // listing row. The traversal token must still be caught in the name itself.
    const { executor, exec } = tarExecutor([
      String.raw`-rw-r--r-- root/root 10 2026-07-21 10:00 evil\n/../../etc/x`,
    ]);
    await expect(
      archiveService.extractWithExecutor(path.join(tempRoot, "a.tar.gz"), path.join(tempRoot, "out"), executor),
    ).rejects.toThrow(/contains "\.\."/);
    expect(exec.mock.calls.some((c) => String(c[0]).includes("-xzf"))).toBe(false);
  });

  it("fails closed when the listing cannot be produced", async () => {
    const exec = vi.fn(async (cmd: string) => {
      if (cmd.includes("-tvzf")) return { stdout: "", stderr: "boom", exitCode: 2, durationMs: 1 };
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const executor = { target: { id: "r", name: "R" }, exec } as never;
    await expect(
      archiveService.extractWithExecutor(path.join(tempRoot, "a.tar.gz"), path.join(tempRoot, "out"), executor),
    ).rejects.toThrow(/could not list archive contents/);
  });

  it("extracts a clean tar (contained members + inside symlink)", async () => {
    const { executor, exec } = tarExecutor([
      "drwxr-xr-x root/root 0 2026-07-21 10:00 dir/",
      "-rw-r--r-- root/root 10 2026-07-21 10:00 dir/file.txt",
      "lrwxrwxrwx root/root 0 2026-07-21 10:00 dir/l -> file.txt",
    ]);
    await archiveService.extractWithExecutor(path.join(tempRoot, "a.tar.gz"), path.join(tempRoot, "out"), executor);
    expect(exec.mock.calls.some((c) => String(c[0]).includes("-xzf"))).toBe(true);
  });

  it("rejects zip members that escape and zips containing symlinks", async () => {
    const zipExec = (names: string, info: string) =>
      vi.fn(async (cmd: string) => {
        if (cmd.includes("-Z1")) return { stdout: names, stderr: "", exitCode: 0, durationMs: 1 };
        if (cmd.includes("'-Z'")) return { stdout: info, stderr: "", exitCode: 0, durationMs: 1 };
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
      });

    // ".." traversal in a member name.
    let exec = zipExec("ok.txt\n../evil.txt\n", "Archive: a.zip\n-rw-r--r--  3.0 unx 4 tx stor 26-Jul-21 10:00 ok.txt\n");
    await expect(
      archiveService.extractWithExecutor(
        path.join(tempRoot, "a.zip"),
        path.join(tempRoot, "out"),
        { target: { id: "r", name: "R" }, exec } as never,
      ),
    ).rejects.toThrow(/contains "\.\."/);
    expect(exec.mock.calls.some((c) => String(c[0]).includes("unzip '-o'"))).toBe(false);

    // Symlink member reported by zipinfo.
    exec = zipExec("link\n", "Archive: a.zip\nlrwxrwxrwx  3.0 unx 4 tx stor 26-Jul-21 10:00 link\n");
    await expect(
      archiveService.extractWithExecutor(
        path.join(tempRoot, "a.zip"),
        path.join(tempRoot, "out"),
        { target: { id: "r", name: "R" }, exec } as never,
      ),
    ).rejects.toThrow(/symlink members/);
  });
});
