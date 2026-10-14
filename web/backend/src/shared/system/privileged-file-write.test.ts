// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi } from "vitest";

import { writePrivilegedFile } from "./privileged-file-write.js";
import type { Executor } from "../executor/types.js";

function fakeExecutor(execImpl?: (cmd: string) => { exitCode: number; stderr?: string }): {
  executor: Executor;
  exec: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
} {
  const exec = vi.fn(async (cmd: string) => ({
    stdout: "",
    stderr: "",
    durationMs: 1,
    exitCode: 0,
    ...(execImpl ? execImpl(cmd) : {}),
  }));
  const writeFile = vi.fn(async () => undefined);
  const executor = {
    target: { id: "local", name: "Local" },
    exec,
    writeFile,
  } as unknown as Executor;
  return { executor, exec, writeFile };
}

describe("writePrivilegedFile owner", () => {
  it("chowns the file to the given spec after cp+chmod", async () => {
    const { executor, exec } = fakeExecutor();
    await writePrivilegedFile(executor, "/home/dayz/x.zip", Buffer.from("data"), {
      tmpPrefix: "lxp-upload",
      owner: "1000:1000",
    });
    const calls = exec.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("sudo") && c.includes("cp"))).toBe(true);
    expect(calls.some((c) => c.includes("sudo") && c.includes("chmod"))).toBe(true);
    expect(
      calls.some((c) => c.includes("sudo") && c.includes("chown") && c.includes("1000:1000") && c.includes("/home/dayz/x.zip")),
    ).toBe(true);
  });

  it("skips chown when no owner is provided (unchanged legacy behaviour)", async () => {
    const { executor, exec } = fakeExecutor();
    await writePrivilegedFile(executor, "/etc/thing", Buffer.from("data"));
    const calls = exec.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("chown"))).toBe(false);
  });

  it("ignores an invalid (injection-y) owner spec, never running chown", async () => {
    const { executor, exec } = fakeExecutor();
    await writePrivilegedFile(executor, "/etc/thing", Buffer.from("data"), {
      owner: "--reference=/etc/shadow",
    });
    const calls = exec.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("chown"))).toBe(false);
  });

  it("does not fail the write when the chown step errors (best-effort)", async () => {
    const { executor } = fakeExecutor((cmd) =>
      cmd.includes("chown") ? { exitCode: 1, stderr: "chown: invalid user" } : { exitCode: 0 },
    );
    await expect(
      writePrivilegedFile(executor, "/home/dayz/x.zip", Buffer.from("data"), { owner: "9999:9999" }),
    ).resolves.toBeUndefined();
  });
});
