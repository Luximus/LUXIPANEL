// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization + command-injection regression tests for fail2banService.
 *
 * `_parseJailStatus` and the `Jail list:` parser are PURE LOGIC pinned here
 * against real `fail2ban-client` samples — they must not change across the
 * execSync→executor migration. The mutation tests assert ban/unban commands are
 * built with quoteCmd/quoteArg and that the jail/IP sanitizers stay in force.
 */

import { describe, it, expect } from "vitest";
import { quoteCmd } from "../../../shared/executor/index.js";
import { execCmds, mockExecutor } from "../../../shared/executor/__fixtures__/mock-executor.js";
import { fail2banService } from "./fail2ban.service.js";

// Real `fail2ban-client status sshd` output.
const JAIL_STATUS = `Status for the jail: sshd
|- Filter
|  |- Currently failed: 1
|  |- Total failed:     7
|  \`- File list:        /var/log/auth.log
\`- Actions
   |- Currently banned: 3
   |- Total banned:     12
   \`- Banned IP list:   192.168.1.10 10.0.0.5 203.0.113.7
`;

describe("fail2banService._parseJailStatus (characterization)", () => {
  const status = fail2banService._parseJailStatus("sshd", JAIL_STATUS);

  it("extracts currently/total banned counts", () => {
    expect(status.currentlyBanned).toBe(3);
    expect(status.totalBanned).toBe(12);
  });

  it("splits the banned IP list on whitespace", () => {
    expect(status.bannedIPs).toEqual(["192.168.1.10", "10.0.0.5", "203.0.113.7"]);
  });

  it("marks the jail active and names it", () => {
    expect(status).toMatchObject({ name: "sshd", active: true });
  });

  it("returns [] banned IPs when the list is empty", () => {
    const empty = fail2banService._parseJailStatus(
      "sshd",
      "`- Actions\n   |- Currently banned: 0\n   |- Total banned:     0\n   `- Banned IP list:\n",
    );
    expect(empty.bannedIPs).toEqual([]);
    expect(empty.currentlyBanned).toBe(0);
  });

  it("parses `Filter:` when present, else null", () => {
    expect(fail2banService._parseJailStatus("x", "Filter: sshd\nCurrently banned: 0\n").filter).toBe("sshd");
    expect(status.filter).toBeNull(); // no `Filter:` colon-line in the tree output
  });
});

describe("fail2banService.listJailsWithExecutor (characterization)", () => {
  it("parses the comma-separated `Jail list:` line", async () => {
    const executor = mockExecutor("Status\n|- Number of jail:\t2\n`- Jail list:\tsshd, postfix-sasl\n");
    expect(await fail2banService.listJailsWithExecutor(executor)).toEqual(["sshd", "postfix-sasl"]);
    expect(execCmds(executor)).toEqual([quoteCmd("sudo", ["fail2ban-client", "status"])]);
  });

  it("returns [] when there is no jail list", async () => {
    expect(await fail2banService.listJailsWithExecutor(mockExecutor("Status\n"))).toEqual([]);
  });
});

describe("fail2banService ban/unban via executor (injection regression)", () => {
  it("sanitizes a hostile jail + IP and emits a fully quoted argv", async () => {
    const executor = mockExecutor();
    await fail2banService.banWithExecutor("sshd; rm -rf /", "1.2.3.4`id`", executor);
    // jail → [A-Za-z0-9_-] only ; ip → [0-9a-fA-F.:] only.
    expect(execCmds(executor)).toEqual([
      quoteCmd("sudo", ["fail2ban-client", "set", "sshdrm-rf", "banip", "1.2.3.4d"]),
    ]);
  });

  it("unbanWithExecutor mirrors the sanitization + quoting", async () => {
    const executor = mockExecutor();
    await fail2banService.unbanWithExecutor("sshd", "$(id) 10.0.0.5", executor);
    expect(execCmds(executor)).toEqual([
      quoteCmd("sudo", ["fail2ban-client", "set", "sshd", "unbanip", "d10.0.0.5"]),
    ]);
  });

  it("does not import node:child_process (executor-only boundary)", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./fail2ban.service.ts", import.meta.url), "utf-8"),
    );
    expect(src).not.toMatch(/from ["']node:child_process["']|execSync\(|\bspawn\(/);
  });
});
