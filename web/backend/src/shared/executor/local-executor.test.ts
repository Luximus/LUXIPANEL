// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import { localExecutor } from "./local-executor.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("localExecutor.exec shell contract", () => {
  it("cancels the shell and its child processes without inheriting service secrets", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-cancel-"));
    const output = path.join(dir, "child-finished"); const controller = new AbortController();
    process.env.LXP_TEST_SERVICE_SECRET = "private";
    try {
      const isolated = await localExecutor.exec("printenv LXP_TEST_SERVICE_SECRET", { isolatedEnv: true });
      expect(isolated.exitCode).toBe(1);
      const command = `${process.execPath} -e 'setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(output)}, "finished"), 350)'`;
      const execution = localExecutor.exec(command, { signal: controller.signal, isolatedEnv: true });
      const rejected = expect(execution).rejects.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 100)); controller.abort(); await rejected;
      await new Promise((resolve) => setTimeout(resolve, 400));
      await expect(fs.access(output)).rejects.toThrow();
    } finally { delete process.env.LXP_TEST_SERVICE_SECRET; await fs.rm(dir, { recursive: true, force: true }); }
  });
  it("runs a benign shell command and returns stdout", async () => {
    const res = await localExecutor.exec("ls /tmp", { timeoutMs: 5000 });
    expect(res.exitCode).toBe(0);
    expect(typeof res.stdout).toBe("string");
  });

  it("survives a user-supplied `;` because the body is ONE argv to sh", async () => {
    // Before the fix this would have hit `execFile(cmd, { shell: true })` which
    // reinterprets `cmd` through `sh -c <cmd>` AFTER splitting on whitespace —
    // i.e. `cmd = "echo hi; rm -rf /"` is equivalent to two separate commands.
    // After the fix `cmd` is passed as a SINGLE argv element to `/bin/sh -c`,
    // so the body still parses correctly and the `rm` (which targets `/tmp/x`
    // here, never `/`) is the SAME shell parse the SSH executor already does —
    // callers wanting strict argv-safety must pre-parse user input.
    const res = await localExecutor.exec("echo hi; echo done", { timeoutMs: 5000 });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("hi");
    expect(res.stdout).toContain("done");
  });

  it("propagates the exit code of a failing command", async () => {
    // `false` exits with status 1; the previous `shell:true + string cmd`
    // shape silently collapsed that to 0 (hiding failures from call sites
    // that branch on exitCode). The argv-safe form surfaces it.
    const res = await localExecutor.exec("false", { timeoutMs: 5000 });
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe("");
  });
});
