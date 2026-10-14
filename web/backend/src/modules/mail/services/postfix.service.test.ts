// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Command-injection + 0600-staging regression tests for postfixService.
 * All exec calls must be built with quoteCmd/quoteArg; map content with
 * hostile values must stay inert file content (never a shell fragment).
 */

import { describe, it, expect, vi } from "vitest";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { mailConfig } from "../../../config/mail.js";
import { panelConfigDir } from "../../../config/paths.js";
import { postfixService } from "./postfix.service.js";

let seq = 0;
function mockExecutor(overrides: Partial<Record<string, unknown>> = {}): Executor {
  return {
    target: { id: `t-${Date.now()}-${seq++}`, name: "test" },
    exec: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 })),
    writeFile: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as Executor;
}

function execCmds(executor: Executor): string[] {
  return (executor.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
}

describe("regenerateCatchallMapWithExecutor", () => {
  it("hostile :fail: messages stay inert single-line file content; postmap is quoted", async () => {
    const executor = mockExecutor();
    const message = 'evil"; rm -rf /\n$(id) `id` injected';
    await postfixService.regenerateCatchallMapWithExecutor(
      [{ domain: "example.com", mode: "fail", message }],
      executor,
    );

    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    const [dest, content] = writeFile.mock.calls[0]!;
    expect(dest).toBe(mailConfig.postfix.virtual);
    // Newlines are flattened → the payload cannot smuggle extra map rows.
    expect(String(content)).toBe('@example.com  :fail: evil"; rm -rf / $(id) `id` injected\n');

    expect(execCmds(executor)).toEqual([
      quoteCmd("sudo", ["postmap", mailConfig.postfix.virtual]),
    ]);
  });
});

describe("regenerateMailboxMapWithExecutor — fast path applies 0644 deterministically", () => {
  it("passes mode 0644 to the direct SFTP write (world-readable ON PURPOSE, not umask-dependent)", async () => {
    const executor = mockExecutor();
    await postfixService.regenerateMailboxMapWithExecutor(
      [{ address: "a@example.com", domain: "example.com" }],
      executor,
    );

    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    const call = writeFile.mock.calls.find(([p]) => p === mailConfig.postfix.vmailbox)!;
    expect(call).toBeDefined();
    // Postfix maps are read by the unprivileged postfix daemons → 0644 is
    // intentional; setting it explicitly removes the umask dependency.
    expect(call[2]).toMatchObject({ mode: 0o644 });
  });
});

describe("regenerateMailboxMapWithExecutor — staged sudo copy path (C1)", () => {
  it("stages 0600 under postfix-staging when the direct SFTP write is denied", async () => {
    const vmailbox = mailConfig.postfix.vmailbox;
    const executor = mockExecutor({
      writeFile: vi.fn(async (p: string) => {
        if (p === vmailbox) throw new Error("Permission denied");
      }),
    });
    await postfixService.regenerateMailboxMapWithExecutor(
      [{ address: "a@example.com", domain: "example.com" }],
      executor,
    );

    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    const staged = writeFile.mock.calls.find(([p]) => p !== vmailbox)!;
    expect(String(staged[0]).startsWith(`${panelConfigDir()}/cache/postfix-staging/`)).toBe(true);
    expect(staged[2]).toMatchObject({ mode: 0o600 });

    const cmds = execCmds(executor);
    expect(cmds).toContain(quoteCmd("sudo", ["cp", String(staged[0]), vmailbox]));
    // Destination map is world-readable ON PURPOSE (postfix daemons read it).
    expect(cmds).toContain(quoteCmd("sudo", ["chmod", "0644", vmailbox]));
    expect(cmds).toContain(quoteCmd("sudo", ["postmap", vmailbox]));
    expect(executor.unlink).toHaveBeenCalledWith(String(staged[0]));
  });
});

describe("regenerateRoutingMapsWithExecutor", () => {
  it("emits fully quoted postconf/postmap commands", async () => {
    const executor = mockExecutor();
    await postfixService.regenerateRoutingMapsWithExecutor(
      [{ domain: "example.com", mode: "backup" }],
      executor,
    );

    const cmds = execCmds(executor);
    expect(cmds).toContain(quoteCmd("sudo", ["postmap", mailConfig.postfix.transport]));
    expect(cmds).toContain(quoteCmd("sudo", ["postmap", mailConfig.postfix.relayDomains]));
    expect(cmds).toContain(quoteCmd("sudo", ["postconf", "-h", "transport_maps"]));
    expect(cmds).toContain(
      quoteCmd("sudo", ["postconf", "-e", `transport_maps = hash:${mailConfig.postfix.transport}`]),
    );
    expect(cmds).toContain(
      quoteCmd("sudo", ["postconf", "-e", `relay_domains = hash:${mailConfig.postfix.relayDomains}`]),
    );
    // Nothing runs outside quoteCmd form: every call is `sudo '<argv>...'`.
    for (const cmd of cmds) expect(cmd.startsWith("sudo '")).toBe(true);
  });
});
