import { describe, expect, it } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { physicalNotePath } from "./physical-path.js";

function executor(stdout: string): Executor {
  return { exec: async () => ({ stdout, stderr: "", exitCode: 0, durationMs: 1 }) } as unknown as Executor;
}

describe("Obsidian physical path gate", () => {
  it("accepts a note whose resolved path remains in the vault", async () => {
    await expect(physicalNotePath(executor("/vault\0/vault/Daily/today.md\0"), "/vault", "Daily/today.md"))
      .resolves.toEqual({ root: "/vault", target: "/vault/Daily/today.md" });
  });

  it("rejects a symlink target that resolves outside the vault", async () => {
    await expect(physicalNotePath(executor("/vault\0/etc/passwd\0"), "/vault", "link.md"))
      .rejects.toBeTruthy();
  });

  it("rejects traversal before running a remote command", async () => {
    await expect(physicalNotePath(executor(""), "/vault", "../secret.md")).rejects.toBeTruthy();
  });
});
