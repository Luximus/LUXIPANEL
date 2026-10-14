// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { beginBackupActivity, beginDirectoryChange, validateBackupDir } from "./backup-config.service.js";

function executor(id: string): Executor {
  return { target: { id } } as Executor;
}

describe("backup directory safety", () => {
  it("accepts an absolute data directory and rejects system, root, and traversing paths", () => {
    expect(validateBackupDir("/var/backups/luxipanel")).toBe("/var/backups/luxipanel");
    expect(validateBackupDir("/mnt/backups")).toBe("/mnt/backups");
    for (const invalid of ["/", "relative", "/etc/luxipanel", "/tmp/backups", "/home/backups", "/var/www/backups", "/var/backups/../etc", "/var/backups/"]) {
      expect(() => validateBackupDir(invalid)).toThrow();
    }
  });

  it("blocks directory changes while a backup is active, only on that target", () => {
    const first = executor("server-a");
    const second = executor("server-b");
    const finishBackup = beginBackupActivity(first);
    expect(() => beginDirectoryChange(first)).toThrow();
    const finishChange = beginDirectoryChange(second);
    expect(() => beginBackupActivity(second)).toThrow();
    finishChange();
    finishBackup();
    const release = beginDirectoryChange(first);
    release();
  });
});
