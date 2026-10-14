// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Command-injection + 0600-staging regression tests for dovecotService.
 * Every user-influenced value that reaches `executor.exec` must be
 * neutralized by quoteArg/quoteCmd (audit: execSync with string interpolation
 * on the panel host was removed in the security wave).
 */

import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { quoteCmd, quoteArg, type Executor } from "../../../shared/executor/index.js";
import { mailConfig } from "../../../config/mail.js";
import { panelConfigDir } from "../../../config/paths.js";
import { dovecotService } from "./dovecot.service.js";

const PAYLOADS = ["; rm -rf /", "$(id)", "`id`", "'; DROP TABLE users --"];

let seq = 0;
function mockExecutor(overrides: Partial<Record<string, unknown>> = {}): Executor {
  return {
    target: { id: `t-${Date.now()}-${seq++}`, name: "test" },
    exec: vi.fn(async () => ({ stdout: "{SHA512-CRYPT}$6$x", stderr: "", exitCode: 0, durationMs: 1 })),
    writeFile: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as Executor;
}

function execCmds(executor: Executor): string[] {
  return (executor.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
}

describe("ensureMaildirWithExecutor — hostile local parts stay quoted", () => {
  it.each(PAYLOADS)("neutralizes %j in the maildir path", async (payload) => {
    const executor = mockExecutor();
    const address = `user${payload}@example.com`;
    await dovecotService.ensureMaildirWithExecutor(address, executor);

    const maildirPath = path.join(mailConfig.vmail.base, "example.com", `user${payload}`);
    const cmds = execCmds(executor);
    expect(cmds).toEqual([
      quoteCmd("sudo", ["mkdir", "-p", path.join(maildirPath, "Maildir")]),
      quoteCmd("sudo", ["chown", "-R", `${mailConfig.vmail.uid}:${mailConfig.vmail.gid}`, maildirPath]),
    ]);
    // The payload only ever appears as a fully-quoted argv element.
    for (const cmd of cmds) {
      expect(cmd).toContain(quoteArg(path.join(maildirPath, "Maildir")).slice(0, 20));
      expect(cmd.startsWith("sudo '")).toBe(true);
    }
  });
});

describe("hashPasswordWithExecutor — plaintext never reaches argv", () => {
  it("stages the secret 0600 and pipes it via a quoted redirect", async () => {
    const executor = mockExecutor();
    const password = `p'ass$(id); rm -rf /`;
    const hash = await dovecotService.hashPasswordWithExecutor(password, executor);
    expect(hash).toBe("{SHA512-CRYPT}$6$x");

    // Secret goes through SFTP (0600), never through the command line.
    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    const [, content, opts] = writeFile.mock.calls[0]!;
    expect(content).toBe(`${password}\n${password}\n`);
    expect(opts).toMatchObject({ mode: 0o600 });

    const shCall = execCmds(executor).find((cmd) => cmd.startsWith("sh "));
    expect(shCall).toBeDefined();
    expect(shCall).not.toContain(password);
  });
});

describe("regenerateUsersFileWithExecutor — fast path applies 0640 atomically", () => {
  it("passes mode 0640 to the direct SFTP write (never umask-default world-readable)", async () => {
    const executor = mockExecutor();
    const entries = [{ address: "a@example.com", passwordHash: "{SHA512-CRYPT}$6$hash", quotaMb: 100 }];
    await dovecotService.regenerateUsersFileWithExecutor(entries, executor);

    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    const call = writeFile.mock.calls.find(([p]) => p === mailConfig.dovecot.usersFile)!;
    expect(call).toBeDefined();
    // The `{SHA512-CRYPT}` secret file lands 0640 from the start, not the SFTP
    // default (world-readable) — this is the fast-path secret-leak fix.
    expect(call[2]).toMatchObject({ mode: 0o640 });
    // No staging needed when the direct write succeeds.
    expect(writeFile.mock.calls.every(([p]) => p === mailConfig.dovecot.usersFile)).toBe(true);
  });
});

describe("regenerateUsersFileWithExecutor — staged sudo copy path", () => {
  it("stages 0600 under dovecot-staging when the direct SFTP write is denied", async () => {
    const usersFile = mailConfig.dovecot.usersFile;
    const executor = mockExecutor({
      writeFile: vi.fn(async (p: string) => {
        if (p === usersFile) throw new Error("Permission denied");
      }),
    });
    const entries = [{ address: "a@example.com", passwordHash: "{SHA512-CRYPT}$6$hash", quotaMb: 100 }];
    await dovecotService.regenerateUsersFileWithExecutor(entries, executor);

    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    const staged = writeFile.mock.calls.find(([p]) => p !== usersFile)!;
    expect(String(staged[0]).startsWith(`${panelConfigDir()}/cache/dovecot-staging/`)).toBe(true);
    expect(staged[2]).toMatchObject({ mode: 0o600 });

    const cmds = execCmds(executor);
    expect(cmds).toContain(quoteCmd("sudo", ["cp", String(staged[0]), usersFile]));
    expect(cmds).toContain(quoteCmd("sudo", ["chmod", "0640", usersFile]));
    expect(cmds).toContain(quoteCmd("sudo", ["chown", `root:${mailConfig.dovecot.group}`, usersFile]));
    // Staged copy cleaned up.
    expect(executor.unlink).toHaveBeenCalledWith(String(staged[0]));
  });
});
