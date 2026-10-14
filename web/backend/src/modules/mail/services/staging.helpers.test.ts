// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Regression tests for the 0600-atomic staging helper (audit Top #9 — C1):
 * staged sidecar content must NEVER be world-readable, not even during the
 * short window before the `sudo cp`.
 */

import { describe, it, expect, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { panelConfigDir } from "../../../config/paths.js";
import { stageSecretFile, removeStagedFile } from "./staging.helpers.js";

let seq = 0;
function mockExecutor(overrides: Partial<Record<keyof Executor, unknown>> = {}): Executor {
  return {
    // Unique target id per test: the helper caches ensured staging dirs.
    target: { id: `t-${Date.now()}-${seq++}`, name: "test" },
    exec: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 })),
    writeFile: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as Executor;
}

describe("stageSecretFile", () => {
  it("writes into <configDir>/cache/<purpose>-staging with atomic mode 0600", async () => {
    const executor = mockExecutor();
    const path = await stageSecretFile(executor, "postfix", "secret-rows\n");

    expect(path.startsWith(`${panelConfigDir()}/cache/postfix-staging/`)).toBe(true);
    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [writtenPath, content, opts] = writeFile.mock.calls[0]!;
    expect(writtenPath).toBe(path);
    expect(content).toBe("secret-rows\n");
    expect(opts).toMatchObject({ mode: 0o600 });

    // Staging dir created recursively and tightened to 0700.
    expect(executor.mkdir).toHaveBeenCalledWith(
      `${panelConfigDir()}/cache/postfix-staging`,
      { recursive: true },
    );
    const execCalls = (executor.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(execCalls.some((cmd) => cmd.startsWith("chmod ") && cmd.includes("0700"))).toBe(true);
  });

  it("falls back to /tmp — still 0600 atomic — when the staging dir cannot be created", async () => {
    const executor = mockExecutor({
      mkdir: vi.fn(async () => { throw new Error("EACCES"); }),
    });
    const path = await stageSecretFile(executor, "dovecot", "hashrow");

    expect(path.startsWith("/tmp/luxipanel-dovecot-")).toBe(true);
    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    const [, , opts] = writeFile.mock.calls.at(-1)!;
    expect(opts).toMatchObject({ mode: 0o600 });
  });
});

describe("removeStagedFile", () => {
  it("unlinks via SFTP", async () => {
    const executor = mockExecutor();
    await removeStagedFile(executor, "/tmp/luxipanel-x");
    expect(executor.unlink).toHaveBeenCalledWith("/tmp/luxipanel-x");
  });

  it("falls back to a quoted `rm -f` and never throws", async () => {
    const executor = mockExecutor({
      unlink: vi.fn(async () => { throw new Error("nope"); }),
    });
    await expect(removeStagedFile(executor, "/tmp/luxipanel-x")).resolves.toBeUndefined();
    const execCalls = (executor.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(execCalls).toContain("rm '-f' '/tmp/luxipanel-x'");
  });
});
