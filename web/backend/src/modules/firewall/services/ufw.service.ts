// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * UFW service — wrapper for the Uncomplicated Firewall CLI.
 *
 * Every command runs through the per-request `Executor` (SSH for remote targets,
 * the sudo-wrapped `localExecutor` for the panel's own box) — NEVER a local
 * `child_process`. This satisfies the hard rule (CLAUDE.md): no module executes
 * commands on the panel host directly, and the same code path works for both
 * local and remote servers.
 *
 * Argv is always built with `quoteCmd`/`quoteArg` (array form, no shell string
 * interpolation), so caller-supplied values can never break out of a token.
 * The `_*Argv` builders are the single source of truth for each command shape:
 * they are reused by the write-behind step recipes in `rules.controller`.
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { packageInstaller, type InstallResult } from "../../../shared/system/index.js";
import type { UfwRule, UfwStatus } from "../models/index.js";

const log = createModuleLogger("ufw");

/** Defense-in-depth allowlist for ufw action/port/from tokens (commas stripped —
 *  multi-port rules use the full form via `_allowTcpArgv`). */
const safe = (s: string): string => s.replace(/[^a-zA-Z0-9_./:+-]/g, "");

export const ufwService = {
  /** True when the `ufw` binary is available on the target. */
  async isInstalledWithExecutor(executor: Executor): Promise<boolean> {
    return packageInstaller.isCommandAvailable(executor, "ufw");
  },

  /** Install UFW with the package manager defaults for the target distro. */
  async installWithExecutor(executor: Executor, opts: { sudoPassword?: string } = {}): Promise<InstallResult> {
    const result = await packageInstaller.install(
      executor,
      {
        apt: ["ufw"],
        dnf: ["ufw"],
        yum: ["ufw"],
        apk: ["ufw"],
        pacman: ["ufw"],
      },
      { sudoPassword: opts.sudoPassword },
    );
    if (result.ok) {
      log.info({ target: executor.target.id }, "UFW package installed");
    }
    return result;
  },

  /** Get current UFW status and all rules through the executor. */
  async getStatusWithExecutor(executor: Executor): Promise<UfwStatus> {
    try {
      const out = (await executor.exec(quoteCmd("sudo", ["ufw", "status", "numbered"]))).stdout;
      const active = /Status: active/i.test(out);
      const verbose = await executor.exec(quoteCmd("sudo", ["ufw", "status", "verbose"])).catch(() => null);
      const loggingMatch = (verbose?.stdout ?? out).match(/Logging: (.+)/i);
      const logging = loggingMatch?.[1]?.trim() ?? null;
      const rules = this._parseRules(out);
      return { active, logging, rules };
    } catch {
      return { active: false, logging: null, rules: [] };
    }
  },

  async setLoggingWithExecutor(executor: Executor, level: "off" | "low" | "medium" | "high" | "full"): Promise<void> {
    await executor.exec(quoteCmd("sudo", ["ufw", "logging", level]));
  },

  /**
   * Steps for a SAFE default policy: deny inbound / allow outbound, but
   * explicitly open SSH (22), HTTP (80) and HTTPS (443) BEFORE enabling.
   *
   * Order matters only at `enable`: `default deny incoming` is NOT enforced
   * while UFW is inactive, so staging the `allow` rules first means the very
   * instant the firewall comes up, SSH and the panel's 80/443 are already
   * permitted. Enabling UFW *without* these (bare `ufw enable`) is the known
   * trap that black-holes 80/443 → Cloudflare 522 and can lock out SSH.
   * Every step is idempotent, so re-running this is harmless.
   */
  _baselineSteps(): string[][] {
    return [
      ["ufw", "default", "deny", "incoming"],
      ["ufw", "default", "allow", "outgoing"],
      ["ufw", "allow", "22/tcp", "comment", "SSH"],
      ["ufw", "allow", "80/tcp", "comment", "HTTP"],
      ["ufw", "allow", "443/tcp", "comment", "HTTPS"],
      ["ufw", "--force", "enable"],
    ];
  },

  /** Apply the safe baseline (deny in / allow out + SSH/HTTP/HTTPS) and enable. */
  async secureBaselineWithExecutor(executor: Executor): Promise<void> {
    for (const args of this._baselineSteps()) {
      await executor.exec(quoteCmd("sudo", args));
    }
    log.info({ target: executor.target.id }, "UFW secure baseline applied + enabled via executor");
  },

  /** Disable UFW. */
  async disableWithExecutor(executor: Executor): Promise<void> {
    await executor.exec(quoteCmd("sudo", ["ufw", "disable"]));
    log.info({ target: executor.target.id }, "UFW disabled via executor");
  },

  // ── argv builders (single source of truth, reused by write-behind steps) ──

  /**
   * Simple allow/deny/limit/reject rule.
   * @param action  "allow" | "deny" | "limit" | "reject"
   * @param port    Port or service name (e.g. "22", "80/tcp", "Nginx Full")
   * @param from    Source IP or "any"
   * @param comment Optional comment
   */
  _addRuleArgv(action: string, port: string, from = "any", comment?: string): string[] {
    const argv = ["ufw", safe(action)];
    if (from !== "any") argv.push("from", safe(from));
    argv.push(safe(port));
    // quoteArg neutralizes the comment; strip only the redundant single quotes.
    if (comment) argv.push("comment", comment.replace(/'/g, ""));
    return argv;
  },

  /**
   * Full-form allow rule: `ufw allow proto tcp from <cidr> to any port <ports>`.
   * Needed for multi-port rules (e.g. "80,443") — the simple form used by
   * `_addRuleArgv` cannot express a port list and its sanitizer strips commas.
   * Idempotent: UFW answers "Skipping adding existing rule" without failing.
   */
  _allowTcpArgv(cidr: string, ports: string, comment?: string): string[] {
    const safeCidr = cidr.replace(/[^0-9a-fA-F.:/]/g, "");
    const safePorts = ports.replace(/[^0-9,:]/g, "");
    const argv = ["ufw", "allow", "proto", "tcp", "from", safeCidr, "to", "any", "port", safePorts];
    if (comment) argv.push("comment", comment.replace(/'/g, ""));
    return argv;
  },

  /**
   * Delete rule by its numbered position. `--force` is REQUIRED: without a TTY
   * a bare `ufw delete N` blocks on the "Proceed (y|n)?" prompt, reads EOF and
   * aborts, so the rule is never removed.
   */
  _deleteRuleArgv(ruleNumber: number): string[] {
    return ["ufw", "--force", "delete", String(ruleNumber)];
  },

  // ── executor mutations ──

  /** Add a simple rule via the executor. */
  async addRuleWithExecutor(
    executor: Executor,
    action: string,
    port: string,
    from = "any",
    comment?: string,
  ): Promise<void> {
    await executor.exec(quoteCmd("sudo", this._addRuleArgv(action, port, from, comment)));
    log.info({ action, port, from, target: executor.target.id }, "UFW rule added via executor");
  },

  /** Add a full-form multi-port TCP allow rule from a CIDR via the executor. */
  async allowTcpPortsFromCidrWithExecutor(
    executor: Executor,
    cidr: string,
    ports: string,
    comment?: string,
  ): Promise<void> {
    await executor.exec(quoteCmd("sudo", this._allowTcpArgv(cidr, ports, comment)));
    log.info({ cidr, ports, target: executor.target.id }, "UFW full-form tcp allow rule added via executor");
  },

  /** Delete a rule by position via the executor. */
  async deleteRuleWithExecutor(executor: Executor, ruleNumber: number): Promise<void> {
    await executor.exec(quoteCmd("sudo", this._deleteRuleArgv(ruleNumber)));
    log.info({ ruleNumber, target: executor.target.id }, "UFW rule deleted via executor");
  },

  _parseRules(output: string): UfwRule[] {
    const rules: UfwRule[] = [];
    const lineRe = /^\[\s*(\d+)\]\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)(?:\s+#\s*(.+))?$/;
    for (const line of output.split("\n")) {
      const m = line.match(lineRe);
      if (!m) continue;
      const [, num, toPort, action, from, comment] = m;
      rules.push({
        number: parseInt(num!, 10),
        action: action?.trim() ?? "",
        direction: action?.includes("OUT") ? "OUT" : action?.includes("FWD") ? "FWD" : "IN",
        to: toPort?.trim() ?? "",
        from: from?.trim() ?? "",
        protocol: toPort?.includes("/tcp") ? "tcp" : toPort?.includes("/udp") ? "udp" : null,
        comment: comment?.trim() ?? null,
      });
    }
    return rules;
  },
};
