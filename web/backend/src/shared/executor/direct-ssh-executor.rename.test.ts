// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi } from "vitest";

// Keep the import graph light: these pull env/redis chains we don't exercise
// here. The rename path only touches sftp() + exec(), both overridden per test
// below.
vi.mock("../worklog/worklog-recorder.service.js", () => ({
  recordActivity: () => {},
}));

import { DirectSshExecutor } from "./direct-ssh-executor.js";

type ExecResult = { stdout: string; stderr: string; exitCode: number; durationMs: number };

/** Build an executor with sftp()/exec() stubbed, recording what each got. */
function makeExecutor(
  fakeSftp: Record<string, unknown>,
  execImpl: (cmd: string) => ExecResult = () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 0 }),
) {
  const exec = new DirectSshExecutor("t", "t", { username: "u" } as never);
  const execCalls: string[] = [];
  (exec as unknown as { sftp: () => Promise<unknown> }).sftp = async () => fakeSftp;
  (exec as unknown as { exec: (cmd: string) => Promise<ExecResult> }).exec = async (cmd: string) => {
    execCalls.push(cmd);
    return execImpl(cmd);
  };
  return { exec, execCalls };
}

describe("DirectSshExecutor.rename — atomic overwrite", () => {
  it("(a) uses posix-rename (ext_openssh_rename) when the server advertises it", async () => {
    const extCalls: Array<[string, string]> = [];
    const fakeSftp = {
      ext_openssh_rename(from: string, to: string, cb: (err?: Error | null) => void) {
        extCalls.push([from, to]);
        cb(null);
      },
    };
    const { exec, execCalls } = makeExecutor(fakeSftp);

    await exec.rename("/etc/luxipanel/a.json.tmp", "/etc/luxipanel/a.json");

    // The extension carried the rename; the shell `mv` fallback was never used.
    expect(extCalls).toEqual([["/etc/luxipanel/a.json.tmp", "/etc/luxipanel/a.json"]]);
    expect(execCalls).toHaveLength(0);
  });

  it("(b) falls back to `mv -f` when the extension is unsupported, then caches it", async () => {
    let extInvocations = 0;
    const fakeSftp = {
      ext_openssh_rename() {
        extInvocations++;
        // Mirrors ssh2's synchronous throw when the server omits the extension.
        throw new Error("Server does not support this extended request");
      },
    };
    const { exec, execCalls } = makeExecutor(fakeSftp);

    await exec.rename("/etc/luxipanel/a.json.tmp", "/etc/luxipanel/a.json");
    await exec.rename("/etc/luxipanel/b.json.tmp", "/etc/luxipanel/b.json");

    // Fallback is `mv -f` with BOTH operands single-quoted (quoteArg).
    expect(execCalls).toHaveLength(2);
    expect(execCalls[0]).toBe("mv -f '/etc/luxipanel/a.json.tmp' '/etc/luxipanel/a.json'");
    // The "unsupported" throw is cached per connection: the second rename skips
    // ext_openssh_rename entirely (no repeated synchronous throw).
    expect(extInvocations).toBe(1);
  });

  it("throws when the `mv -f` fallback exits non-zero", async () => {
    const fakeSftp = {
      ext_openssh_rename() {
        throw new Error("Server does not support this extended request");
      },
    };
    const { exec } = makeExecutor(fakeSftp, () => ({
      stdout: "",
      stderr: "mv: cannot move",
      exitCode: 1,
      durationMs: 0,
    }));

    await expect(exec.rename("/x.tmp", "/x")).rejects.toThrow(/mv -f/);
  });
});
