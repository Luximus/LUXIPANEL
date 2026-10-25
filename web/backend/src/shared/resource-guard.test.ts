import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "./executor/index.js";
import { execGuardedBrowser, guardCommand, resourceGuardFailure } from "./resource-guard.js";

describe("resource guard", () => {
  it("runs the portable policy tests without requiring systemd in CI", () => {
    const result = execFileSync("python3", ["-B", fileURLToPath(new URL("./resource-guard.test.py", import.meta.url))], {
      encoding: "utf8", env: { ...process.env, LXP_RESOURCE_INTEGRATION: "0" },
    });
    expect(result).toBe("");
  });

  it("passes the command literally without executing shell substitutions in the outer shell", () => {
    const command = "printf '%s' \"á; $(id); `whoami`; 'quoted'\"";
    const built = guardCommand(command, { kind: "cli" });
    const parsed = JSON.parse(execFileSync("python3", ["-c", "import shlex,json,sys; print(json.dumps(shlex.split(sys.argv[1])))", built], { encoding: "utf8" }));
    expect(parsed.slice(-3)).toEqual(["/bin/bash", "-c", command]);
    expect(JSON.parse(parsed[3])).toEqual({ kind: "cli", admissionPolicyPath: "/etc/luxipanel/monitor/assistant-admission.json" });
  });

  it("uses only the selected executor and reports refusal instead of accepting error JSON as DOM", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '{"type":"error","code":"RESOURCE_GUARD_BUSY","message":"La tarea no llegó a iniciarse."}', stderr: "", exitCode: 75 });
    await expect(execGuardedBrowser({ exec } as unknown as Executor, "chromium --dump-dom https://test.invalid", 30_000)).rejects.toThrow("no llegó a iniciarse");
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0][0]).toContain('"kind":"browser"');
    expect(exec.mock.calls[0][1].timeoutMs).toBeGreaterThan(30_000);
  });

  it("does not turn arbitrary provider errors or exit 137 into a memory diagnosis", () => {
    expect(resourceGuardFailure('{"type":"error","code":"PROVIDER_ERROR","message":"other"}')).toBeNull();
    expect(resourceGuardFailure("Killed (137)")).toBeNull();
    expect(resourceGuardFailure('<html>{"code":"RESOURCE_GUARD_BUSY"}</html>')).toBeNull();
  });
});
