// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { isManagedArchive, listLocalArchives, removeLocalArchive } from "./local-archives.service.js";

const DIR = "/var/backups/luxipanel";
const FILE = `${DIR}/daily_2026-09-27T01-02-03-123Z.tar.gz`;

describe("local archive deletion guard", () => {
  it("identifies only generated archives directly inside the configured folder", () => {
    expect(isManagedArchive(FILE, DIR)).toBe(true);
    expect(isManagedArchive("/etc/passwd", DIR)).toBe(false);
    expect(isManagedArchive(`${DIR}/notes.tar.gz`, DIR)).toBe(false);
    expect(isManagedArchive(`${DIR}/nested/daily_2026-09-27T01-02-03-123Z.tar.gz`, DIR)).toBe(false);
  });

  it("never invokes rm for a foreign file and surfaces a failed rm", async () => {
    const exec = vi.fn().mockResolvedValue({ exitCode: 1, stderr: "permission denied" });
    const target = { target: { id: "test" }, exec } as unknown as Executor;
    await expect(removeLocalArchive(target, "/etc/passwd", DIR)).rejects.toThrow();
    expect(exec).not.toHaveBeenCalled();
    await expect(removeLocalArchive(target, FILE, DIR)).rejects.toThrow("permission denied");
  });

  it("lists only managed archives and keeps their size and timestamp", async () => {
    const exec = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: `${FILE}\t42\t1790470923.123\n${DIR}/notes.tar.gz\t5\t1790470923.123\n`,
      stderr: "",
    });
    const target = { target: { id: "test" }, exec } as unknown as Executor;
    const files = await listLocalArchives(target, DIR);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: FILE, sizeBytes: 42 });
    expect(exec.mock.calls[0]?.[0]).toContain("sudo");
  });
});
