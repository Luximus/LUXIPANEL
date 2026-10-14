// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Command-injection + Sieve-escaping + 0600-staging regression tests for
 * sieveService (audit: the execSync twin with string interpolation on the
 * panel host was removed in the security wave).
 */

import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { mailConfig } from "../../../config/mail.js";
import { sieveService } from "./sieve.service.js";

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

function accountPaths(address: string) {
  const [local, domain] = address.split("@");
  const maildirBase = path.join(mailConfig.vmail.base, domain!, local!);
  return {
    sieveDir: path.join(maildirBase, ".sieve"),
    sieveFile: path.join(maildirBase, ".sieve", "luxipanel.sieve"),
    activeLink: path.join(maildirBase, ".dovecot.sieve"),
  };
}

describe("writeAccountFiltersAndForwardsWithExecutor — hostile address stays quoted", () => {
  it("every privileged command is quoteCmd-built for an address with $(id)/;", async () => {
    const executor = mockExecutor();
    const address = "user$(id); rm -rf @example.com".replace(" @", "@"); // user$(id); rm -rf@example.com
    const { sieveDir, sieveFile, activeLink } = accountPaths(address);

    await sieveService.writeAccountFiltersAndForwardsWithExecutor(
      address,
      ["dest@example.org"],
      false,
      [],
      executor,
      null,
    );

    const uidGid = `${mailConfig.vmail.uid}:${mailConfig.vmail.gid}`;
    const cmds = execCmds(executor);
    expect(cmds).toContain(quoteCmd("sudo", ["mkdir", "-p", sieveDir]));
    expect(cmds).toContain(quoteCmd("sudo", ["chown", uidGid, sieveFile]));
    expect(cmds).toContain(quoteCmd("sudo", [mailConfig.sievec, sieveFile]));
    expect(cmds).toContain(quoteCmd("sudo", ["ln", "-sf", sieveFile, activeLink]));
    expect(cmds).toContain(quoteCmd("sudo", ["chown", "-h", uidGid, activeLink]));
    // The hostile fragment never appears outside single quotes.
    for (const cmd of cmds) {
      if (cmd.includes("$(id)")) expect(cmd).toMatch(/'[^']*\$\(id\)/);
    }
  });

  it("stages the script with atomic mode 0600 before the sudo cp", async () => {
    const executor = mockExecutor();
    await sieveService.writeAccountFiltersAndForwardsWithExecutor(
      "a@example.com",
      ["dest@example.org"],
      false,
      [],
      executor,
      null,
    );

    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [stagedPath, , opts] = writeFile.mock.calls[0]!;
    expect(opts).toMatchObject({ mode: 0o600 });
    const cmds = execCmds(executor);
    expect(cmds).toContain(quoteCmd("sudo", ["cp", String(stagedPath), accountPaths("a@example.com").sieveFile]));
  });

  it("escapes quotes/newlines in destinations inside the generated script", async () => {
    const executor = mockExecutor();
    await sieveService.writeAccountFiltersAndForwardsWithExecutor(
      "a@example.com",
      ['evil"; keep; redirect "x@y.z\npipe "sh"'],
      false,
      [],
      executor,
      null,
    );

    const writeFile = executor.writeFile as ReturnType<typeof vi.fn>;
    const script = String(writeFile.mock.calls[0]![1]);
    // Quotes escaped + vertical whitespace stripped → still ONE redirect string.
    expect(script).toContain('redirect "evil\\"; keep; redirect \\"x@y.zpipe \\"sh\\"";');
    expect(script).not.toMatch(/\npipe /);
  });

  it("removes the script with quoted rm when there is nothing to write", async () => {
    const executor = mockExecutor();
    const address = "user$(id)@example.com";
    const { sieveFile, activeLink } = accountPaths(address);
    await sieveService.writeAccountFiltersAndForwardsWithExecutor(address, [], false, [], executor, null);

    expect(execCmds(executor)).toEqual([
      quoteCmd("rm", ["-f", sieveFile, `${sieveFile}c`, activeLink]),
    ]);
    expect(executor.writeFile).not.toHaveBeenCalled();
  });
});
