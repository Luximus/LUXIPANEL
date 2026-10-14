// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Fail2ban service — manage jails and inspect bans.
 *
 * Every command runs through the per-request `Executor` (SSH for remote targets,
 * the sudo-wrapped `localExecutor` for the panel's own box) — NEVER a local
 * `child_process`. Jail names and IPs are sanitized AND passed as quoted argv
 * (`quoteCmd`/`quoteArg`), so hostile input can never break out of a token.
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { packageInstaller, type InstallResult } from "../../../shared/system/index.js";
import type { JailStatus } from "../models/index.js";

const log = createModuleLogger("fail2ban");

const safeJailName = (jail: string): string => jail.replace(/[^a-zA-Z0-9_-]/g, "");
const safeIp = (ip: string): string => ip.replace(/[^0-9a-fA-F.:]/g, "");

export const fail2banService = {
  /** True when the `fail2ban-client` binary is available on the target. */
  async isInstalledWithExecutor(executor: Executor): Promise<boolean> {
    return packageInstaller.isCommandAvailable(executor, "fail2ban-client");
  },

  /** Install Fail2ban + start the daemon with package-manager defaults. */
  async installWithExecutor(
    executor: Executor,
    opts: { sudoPassword?: string } = {},
  ): Promise<InstallResult & { unitEnabled: boolean }> {
    const result = await packageInstaller.install(
      executor,
      {
        apt: ["fail2ban"],
        dnf: ["fail2ban"],
        yum: ["fail2ban"],
        apk: ["fail2ban"],
        pacman: ["fail2ban"],
      },
      { sudoPassword: opts.sudoPassword },
    );
    let unitEnabled = false;
    if (result.ok) {
      const enableOut = await packageInstaller.enableUnit(executor, "fail2ban", { sudoPassword: opts.sudoPassword });
      unitEnabled = enableOut.ok;
      log.info({ target: executor.target.id, unitEnabled }, "Fail2ban package installed");
    }
    return { ...result, unitEnabled };
  },

  /** List all configured jails. */
  async listJailsWithExecutor(executor: Executor): Promise<string[]> {
    try {
      const out = (await executor.exec(quoteCmd("sudo", ["fail2ban-client", "status"]))).stdout;
      const match = out.match(/Jail list:\s*(.+)/);
      if (!match) return [];
      return match[1]!.split(",").map((j) => j.trim()).filter(Boolean);
    } catch {
      return [];
    }
  },

  /** Parse `fail2ban-client status <jail>` output into a JailStatus. */
  _parseJailStatus(jail: string, out: string): JailStatus {
    const currentlyBanned = parseInt(out.match(/Currently banned:\s*(\d+)/)?.[1] ?? "0", 10);
    const totalBanned = parseInt(out.match(/Total banned:\s*(\d+)/)?.[1] ?? "0", 10);
    const bannedLine = out.match(/Banned IP list:\s*(.+)/)?.[1] ?? "";
    const bannedIPs = bannedLine.trim() ? bannedLine.trim().split(/\s+/) : [];
    const filter = out.match(/Filter:\s*(.+)/)?.[1]?.trim() ?? null;
    return { name: jail, active: true, filter, currentlyBanned, totalBanned, bannedIPs };
  },

  /** Get status of a specific jail. */
  async getJailStatusWithExecutor(jail: string, executor: Executor): Promise<JailStatus | null> {
    try {
      const out = (await executor.exec(quoteCmd("sudo", ["fail2ban-client", "status", safeJailName(jail)]))).stdout;
      return this._parseJailStatus(jail, out);
    } catch {
      return null;
    }
  },

  /** Get all jails with their statuses. */
  async getAllStatusesWithExecutor(executor: Executor): Promise<JailStatus[]> {
    const jails = await this.listJailsWithExecutor(executor);
    const statuses = await Promise.all(jails.map((j) => this.getJailStatusWithExecutor(j, executor)));
    return statuses.filter((s): s is JailStatus => s !== null);
  },

  /** Unban an IP from a jail. */
  async unbanWithExecutor(jail: string, ip: string, executor: Executor): Promise<void> {
    const j = safeJailName(jail);
    const i = safeIp(ip);
    await executor.exec(quoteCmd("sudo", ["fail2ban-client", "set", j, "unbanip", i]));
    log.info({ jail: j, ip: i, target: executor.target.id }, "IP unbanned via executor");
  },

  /** Ban an IP in a jail. */
  async banWithExecutor(jail: string, ip: string, executor: Executor): Promise<void> {
    const j = safeJailName(jail);
    const i = safeIp(ip);
    await executor.exec(quoteCmd("sudo", ["fail2ban-client", "set", j, "banip", i]));
    log.info({ jail: j, ip: i, target: executor.target.id }, "IP banned via executor");
  },
};
