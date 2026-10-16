import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../../../shared/executor/index.js";
import { buildNohupLaunch } from "./shell.js";
import { runCliOnce, runCliOnceBackground } from "./one-shot.js";

const exec = promisify(execFile);
describe("guarded CLI results", () => {
  const message = "No se pudo activar la protección. La tarea no se inició.";
  const error = JSON.stringify({ type: "error", code: "RESOURCE_GUARD_UNAVAILABLE", message });
  it("does not return a resource refusal as the one-shot answer", async () => {
    const executor = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue({ stdout: error, stderr: "", exitCode: 78 }),
    } as unknown as Executor;
    await expect(runCliOnce({ executor, id: "codex", prompt: "test" })).rejects.toThrow(message);
  });
  it("does not return partial output as a successful background answer", async () => {
    const executor = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn(async (cmd: string) => ({ stdout: cmd.startsWith("cat ") ? (cmd.includes(".exit") ? "78" : error) : "1", stderr: "", exitCode: 0 })),
    } as unknown as Executor;
    await expect(runCliOnceBackground({ executor, id: "codex", prompt: "test", pollMs: 1 })).rejects.toThrow(message);
  });

  it.skipIf(process.env.LXP_RESOURCE_INTEGRATION !== "1")("keeps detached exit tracking and cleanup outside a terminated scope", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lxp-resource-test-"));
    try {
      const log = join(dir, "output.log"), exit = join(dir, "result.exit"), cleaned = join(dir, "cleaned");
      const command = buildNohupLaunch("printf 'guarded-start\\n'; sleep 30", log, exit, dir, "export LXP_GUARD_TEST=ok;", `touch '${cleaned}'`, { runtimeSeconds: 1, queueSeconds: 0 });
      const launched = await exec("bash", ["-c", command], { timeout: 10_000 });
      expect(Number(launched.stdout.trim())).toBeGreaterThan(1);
      const deadline = Date.now() + 15_000;
      let status = "";
      while (!status && Date.now() < deadline) {
        status = await readFile(exit, "utf8").catch(() => "");
        if (!status) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(status.trim()).toBe("124");
      expect(await readFile(cleaned, "utf8")).toBe("");
      const output = await readFile(log, "utf8");
      expect(output).toContain("guarded-start");
      expect(output).toContain("RESOURCE_GUARD_INTERRUPTED");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
