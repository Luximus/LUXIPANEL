// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization + command-injection regression tests for ufwService.
 *
 * The `_parseRules` output parser is PURE LOGIC that must NOT change across the
 * execSync→executor migration: these tests pin its observable contract against
 * real `ufw status numbered` samples. The executor tests assert every mutation
 * is built with quoteCmd/quoteArg so hostile input can never break out of argv.
 */

import { describe, it, expect } from "vitest";
import { quoteCmd } from "../../../shared/executor/index.js";
import { execCmds, mockExecutor } from "../../../shared/executor/__fixtures__/mock-executor.js";
import { ufwService } from "./ufw.service.js";

// Real `sudo ufw status numbered` output (active firewall, IPv4 + IPv6 rules,
// comments present and absent).
const UFW_STATUS_NUMBERED = `Status: active
Logging: on (low)

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere                   # SSH
[ 2] 80/tcp                     ALLOW IN    Anywhere
[ 3] 443/tcp                    ALLOW IN    Anywhere                   # HTTPS
[ 4] 3306/tcp                   DENY IN     192.168.1.0/24
[ 5] 22/tcp (v6)               ALLOW IN    Anywhere (v6)              # SSH
`;

describe("ufwService._parseRules (characterization)", () => {
  const rules = ufwService._parseRules(UFW_STATUS_NUMBERED);

  it("parses every numbered rule line", () => {
    expect(rules).toHaveLength(5);
  });

  it("extracts number, to, action, from and comment for a commented rule", () => {
    expect(rules[0]).toEqual({
      number: 1,
      to: "22/tcp",
      action: "ALLOW IN",
      from: "Anywhere",
      direction: "IN",
      protocol: "tcp",
      comment: "SSH",
    });
  });

  it("returns null comment when no `# comment` is present", () => {
    expect(rules[1]!.comment).toBeNull();
    expect(rules[1]!.to).toBe("80/tcp");
  });

  it("keeps the DENY action and CIDR source verbatim", () => {
    expect(rules[3]).toMatchObject({
      number: 4,
      action: "DENY IN",
      from: "192.168.1.0/24",
      protocol: "tcp",
      direction: "IN",
    });
  });

  it("parses IPv6 rows (v6 suffix stays in `from`)", () => {
    expect(rules[4]).toMatchObject({ number: 5, to: "22/tcp (v6)", from: "Anywhere (v6)", comment: "SSH" });
  });

  it("ignores header / separator lines", () => {
    expect(ufwService._parseRules("Status: active\nTo   Action   From\n-- -- --\n")).toEqual([]);
  });
});

describe("ufwService.getStatusWithExecutor (characterization)", () => {
  it("reports active + logging + rules from `ufw status numbered`", async () => {
    const executor = mockExecutor(UFW_STATUS_NUMBERED);
    const status = await ufwService.getStatusWithExecutor(executor);
    expect(status.active).toBe(true);
    expect(status.logging).toBe("on (low)");
    expect(status.rules).toHaveLength(5);
    expect(execCmds(executor)).toEqual([
      quoteCmd("sudo", ["ufw", "status", "numbered"]),
      quoteCmd("sudo", ["ufw", "status", "verbose"]),
    ]);
  });

  it("reports inactive when status is not active and returns [] on exec throw", async () => {
    const inactive = mockExecutor("Status: inactive\n");
    expect((await ufwService.getStatusWithExecutor(inactive)).active).toBe(false);

    const boom = {
      target: { id: "x", name: "x" },
      exec: vi.fn(async () => {
        throw new Error("ssh down");
      }),
    } as unknown as Executor;
    expect(await ufwService.getStatusWithExecutor(boom)).toEqual({ active: false, logging: null, rules: [] });
  });
});

describe("ufwService mutations via executor (injection regression)", () => {
  it("secureBaselineWithExecutor emits the exact quoted baseline steps in order", async () => {
    const executor = mockExecutor();
    await ufwService.secureBaselineWithExecutor(executor);
    expect(execCmds(executor)).toEqual([
      quoteCmd("sudo", ["ufw", "default", "deny", "incoming"]),
      quoteCmd("sudo", ["ufw", "default", "allow", "outgoing"]),
      quoteCmd("sudo", ["ufw", "allow", "22/tcp", "comment", "SSH"]),
      quoteCmd("sudo", ["ufw", "allow", "80/tcp", "comment", "HTTP"]),
      quoteCmd("sudo", ["ufw", "allow", "443/tcp", "comment", "HTTPS"]),
      quoteCmd("sudo", ["ufw", "--force", "enable"]),
    ]);
  });

  it("disableWithExecutor emits a quoted `ufw disable`", async () => {
    const executor = mockExecutor();
    await ufwService.disableWithExecutor(executor);
    expect(execCmds(executor)).toEqual([quoteCmd("sudo", ["ufw", "disable"])]);
  });

  it("addRuleWithExecutor keeps a hostile comment inside a single quoted argv", async () => {
    const executor = mockExecutor();
    await ufwService.addRuleWithExecutor(executor, "allow", "22/tcp", "1.2.3.4", "hi; rm -rf / $(id)");
    const cmds = execCmds(executor);
    // Comment metacharacters survive as literal text but are single-quoted, so
    // the shell never interprets `;`, `$( )` etc. — no injection, no lost arg.
    expect(cmds).toEqual([
      quoteCmd("sudo", ["ufw", "allow", "from", "1.2.3.4", "22/tcp", "comment", "hi; rm -rf / $(id)"]),
    ]);
    expect(cmds[0]!.startsWith("sudo '")).toBe(true);
  });

  it("addRuleWithExecutor sanitizes action/port/from and omits `from` when any", async () => {
    const executor = mockExecutor();
    await ufwService.addRuleWithExecutor(executor, "deny;rm", "3306/tcp`id`", "any");
    // `;`, backticks stripped from action/port by the argv allowlist.
    expect(execCmds(executor)).toEqual([quoteCmd("sudo", ["ufw", "denyrm", "3306/tcpid"])]);
  });

  it("allowTcpPortsFromCidrWithExecutor builds the full-form multi-port rule", async () => {
    const executor = mockExecutor();
    await ufwService.allowTcpPortsFromCidrWithExecutor(executor, "173.245.48.0/20", "80,443", "cloudflare");
    expect(execCmds(executor)).toEqual([
      quoteCmd("sudo", [
        "ufw", "allow", "proto", "tcp", "from", "173.245.48.0/20", "to", "any", "port", "80,443",
        "comment", "cloudflare",
      ]),
    ]);
  });

  it("deleteRuleWithExecutor uses --force (no TTY prompt) and a numeric position", async () => {
    const executor = mockExecutor();
    await ufwService.deleteRuleWithExecutor(executor, 4);
    expect(execCmds(executor)).toEqual([quoteCmd("sudo", ["ufw", "--force", "delete", "4"])]);
  });

  it("does not import node:child_process (executor-only boundary)", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./ufw.service.ts", import.meta.url), "utf-8"),
    );
    // No import of node:child_process and no execSync/spawn call (comments may
    // still mention the boundary we removed).
    expect(src).not.toMatch(/from ["']node:child_process["']|execSync\(|\bspawn\(/);
  });
});
