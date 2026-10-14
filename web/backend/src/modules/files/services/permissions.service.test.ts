// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { permissionsService } from "./permissions.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

describe("permissionsService remote helpers", () => {
  let tempRoot = "";
  let originalBases: string[] = [];

  beforeEach(() => {
    originalBases = [...ALLOWED_BASES];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-permissions-"));
    setAllowedBases([tempRoot]);
  });

  afterEach(() => {
    setAllowedBases(originalBases);
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("builds chmod and chown commands for an executor", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 });
    const stat = vi.fn().mockResolvedValue({
      name: "demo.txt",
      path: path.join(tempRoot, "demo.txt"),
      type: "file",
      isDir: false,
      size: 12,
      mode: "0755",
      mtime: new Date("2024-01-01T00:00:00Z"),
      isReadable: true,
      isWritable: true,
      isHidden: false,
      hasGit: false,
      gitStatus: null,
    });
    const filePath = path.join(tempRoot, "demo.txt");

    await permissionsService.chmodWithExecutor(filePath, "755", {
      target: { id: "remote", name: "Remote" },
      exec,
      stat,
    } as never);

    await permissionsService.chownWithExecutor(filePath, "root", "root", {
      target: { id: "remote", name: "Remote" },
      exec,
      stat,
    } as never);

    expect(exec.mock.calls[0]?.[0]).toContain("chmod");
    expect(exec.mock.calls[0]?.[0]).toContain("755");
    expect(exec.mock.calls[1]?.[0]).toContain("sudo");
    expect(exec.mock.calls[1]?.[0]).toContain("chown");
    expect(exec.mock.calls[1]?.[0]).toContain("'root:root'");
  });

  it("reads permissions through an executor", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "root wheel\n", stderr: "", exitCode: 0, durationMs: 1 });
    const stat = vi.fn().mockResolvedValue({
      name: "demo.txt",
      path: path.join(tempRoot, "demo.txt"),
      type: "file",
      isDir: false,
      size: 12,
      mode: "0644",
      mtime: new Date("2024-01-01T00:00:00Z"),
      isReadable: true,
      isWritable: false,
      isHidden: false,
      hasGit: false,
      gitStatus: null,
    });
    const filePath = path.join(tempRoot, "demo.txt");

    const permissions = await permissionsService.getPermissionsWithExecutor(filePath, {
      target: { id: "remote", name: "Remote" },
      exec,
      stat,
    } as never);

    expect(permissions.owner).toBe("root");
    expect(permissions.group).toBe("wheel");
    expect(permissions.mode).toBe("0644");
    expect(permissions.modeSymbolic).toBe("rw-r--r--");
  });
});
