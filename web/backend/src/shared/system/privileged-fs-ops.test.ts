// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  isPermissionDenied,
  stderrIndicatesPermissionDenied,
  resolvePathOwner,
  privilegedRemove,
  privilegedRename,
  privilegedChmod,
} from "./privileged-fs-ops.js";
import { PrivilegedWriteError } from "./privileged-file-write.js";
import { __resetEscalationCacheForTests } from "./privilege-escalation.js";
import { runWithExecutor } from "../executor/context.js";
import { ForbiddenError } from "../errors/index.js";
import type { Executor } from "../executor/types.js";
import type { SessionUser } from "../types/index.js";

/**
 * Minimal executor stub. `groups` is what `id -nG <user>` reports (the
 * escalation gate reads it); the per-test `exec` handles everything else.
 */
function fakeExecutor(
  exec: (cmd: string) => { stdout?: string; stderr?: string; exitCode: number },
  opts: { rename?: (from: string, to: string) => Promise<void>; groups?: string } = {},
): Executor {
  return {
    target: { id: "local", name: "Local" },
    exec: vi.fn(async (cmd: string) => {
      if (cmd.startsWith("id -nG")) {
        return { stdout: `${opts.groups ?? "sudo"}\n`, stderr: "", durationMs: 1, exitCode: 0 };
      }
      return { stdout: "", stderr: "", durationMs: 1, ...exec(cmd) };
    }),
    rename: opts.rename ? vi.fn(opts.rename) : vi.fn(async () => undefined),
  } as unknown as Executor;
}

/** A logged-in panel user; membership on the connected server comes from the
 *  executor's `id -nG`, so the username here is just the identity to check. */
const SUDO_USER = { userId: 1, username: "admin" } as unknown as SessionUser;

/** Run `fn` as `admin` with `executor` pinned as the request executor, so the
 *  escalation gate resolves `getContextUser()` and `id -nG admin`. */
function asUser(executor: Executor, fn: () => Promise<void>): Promise<void> {
  return runWithExecutor(executor, fn, SUDO_USER.userId, SUDO_USER);
}

beforeEach(() => {
  __resetEscalationCacheForTests();
});

describe("isPermissionDenied", () => {
  it("matches EACCES/EPERM codes and messages", () => {
    expect(isPermissionDenied({ code: "EACCES" })).toBe(true);
    expect(isPermissionDenied({ code: "EPERM" })).toBe(true);
    expect(isPermissionDenied(new Error("permission denied"))).toBe(true);
    expect(isPermissionDenied(new Error("ENOENT: no such file"))).toBe(false);
  });
});

describe("stderrIndicatesPermissionDenied", () => {
  it("recognises the common privilege-failure phrasings", () => {
    expect(stderrIndicatesPermissionDenied("rm: cannot remove 'x': Permission denied")).toBe(true);
    expect(stderrIndicatesPermissionDenied("mv: cannot move: Operation not permitted")).toBe(true);
    expect(stderrIndicatesPermissionDenied("rm: cannot remove 'x': No such file")).toBe(false);
  });
});

describe("resolvePathOwner", () => {
  it("returns the numeric uid:gid of the path", async () => {
    const exec = fakeExecutor((cmd) =>
      cmd.includes("%u:%g") ? { stdout: "1000:1000\n", exitCode: 0 } : { exitCode: 0 },
    );
    await expect(resolvePathOwner(exec, "/home/dayz")).resolves.toBe("1000:1000");
  });

  it("returns undefined (fail-open) when stat gives garbage or errors", async () => {
    const bad = fakeExecutor(() => ({ stdout: "UNKNOWN:UNKNOWN", exitCode: 0 }));
    await expect(resolvePathOwner(bad, "/x")).resolves.toBeUndefined();
    const nonZero = fakeExecutor(() => ({ stderr: "stat: cannot stat", exitCode: 1 }));
    await expect(resolvePathOwner(nonZero, "/x")).resolves.toBeUndefined();
  });
});

describe("privilegedRemove", () => {
  it("uses the unprivileged rm when it succeeds (no sudo round-trip)", async () => {
    const exec = fakeExecutor(() => ({ exitCode: 0 }));
    await privilegedRemove(exec, "/tmp/f", false);
    const calls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(String(calls[0]![0])).not.toContain("sudo");
    expect(String(calls[0]![0])).toContain("'-f'");
  });

  it("escalates to sudo rm on a permission failure (privileged user)", async () => {
    const exec = fakeExecutor((cmd) =>
      cmd.startsWith("sudo")
        ? { exitCode: 0 }
        : { stderr: "rm: cannot remove: Permission denied", exitCode: 1 },
    );
    await asUser(exec, () => privilegedRemove(exec, "/home/dayz/@LuxiCore.zip", false));
    const calls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.startsWith("sudo") && c.includes("'rm'") && c.includes("'-f'"))).toBe(true);
  });

  it("does NOT escalate for a non-privileged user — throws 403, no sudo rm", async () => {
    const exec = fakeExecutor(
      () => ({ stderr: "rm: cannot remove: Permission denied", exitCode: 1 }),
      { groups: "users dayz" },
    );
    await expect(
      asUser(exec, () => privilegedRemove(exec, "/root/secret", false)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const calls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.startsWith("sudo"))).toBe(false);
  });

  it("passes -rf for a recursive remove", async () => {
    const exec = fakeExecutor(() => ({ exitCode: 0 }));
    await privilegedRemove(exec, "/tmp/dir", true);
    expect(String((exec.exec as ReturnType<typeof vi.fn>).mock.calls[0]![0])).toContain("'-rf'");
  });

  it("throws (no sudo) on a non-permission failure", async () => {
    const exec = fakeExecutor(() => ({ stderr: "rm: some other error", exitCode: 1 }));
    await expect(privilegedRemove(exec, "/x", false)).rejects.toBeInstanceOf(PrivilegedWriteError);
    expect((exec.exec as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});

describe("privilegedRename", () => {
  it("renames directly when permitted (no sudo)", async () => {
    const rename = vi.fn(async () => undefined);
    const exec = fakeExecutor(() => ({ exitCode: 0 }), { rename });
    await privilegedRename(exec, "/a", "/b");
    expect(rename).toHaveBeenCalledWith("/a", "/b");
    expect((exec.exec as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("escalates to sudo mv on a permission failure (privileged user)", async () => {
    const rename = vi.fn(async () => {
      const err = new Error("EACCES: permission denied") as Error & { code?: string };
      err.code = "EACCES";
      throw err;
    });
    const exec = fakeExecutor(() => ({ exitCode: 0 }), { rename });
    await asUser(exec, () => privilegedRename(exec, "/root/a", "/root/b"));
    const calls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.startsWith("sudo") && c.includes("mv"))).toBe(true);
  });

  it("does NOT escalate for a non-privileged user — throws 403, no sudo mv", async () => {
    const rename = vi.fn(async () => {
      const err = new Error("EACCES: permission denied") as Error & { code?: string };
      err.code = "EACCES";
      throw err;
    });
    const exec = fakeExecutor(() => ({ exitCode: 0 }), { rename, groups: "users" });
    await expect(
      asUser(exec, () => privilegedRename(exec, "/root/a", "/root/b")),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const calls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.startsWith("sudo"))).toBe(false);
  });

  it("rethrows a non-permission rename error without sudo", async () => {
    const rename = vi.fn(async () => {
      const err = new Error("ENOENT: no such file") as Error & { code?: string };
      err.code = "ENOENT";
      throw err;
    });
    const exec = fakeExecutor(() => ({ exitCode: 0 }), { rename });
    await expect(privilegedRename(exec, "/a", "/b")).rejects.toThrow(/ENOENT/);
    expect((exec.exec as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

describe("privilegedChmod", () => {
  it("escalates to sudo chmod on a permission failure (privileged user)", async () => {
    const exec = fakeExecutor((cmd) =>
      cmd.startsWith("sudo")
        ? { exitCode: 0 }
        : { stderr: "chmod: changing permissions: Operation not permitted", exitCode: 1 },
    );
    await asUser(exec, () => privilegedChmod(exec, "/root/f", "644"));
    const calls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.startsWith("sudo") && c.includes("chmod"))).toBe(true);
  });

  it("does NOT escalate for a non-privileged user — throws 403, no sudo chmod", async () => {
    const exec = fakeExecutor(
      () => ({ stderr: "chmod: Operation not permitted", exitCode: 1 }),
      { groups: "users" },
    );
    await expect(
      asUser(exec, () => privilegedChmod(exec, "/root/f", "644")),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const calls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.startsWith("sudo"))).toBe(false);
  });
});
