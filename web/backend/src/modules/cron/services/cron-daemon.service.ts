import { getContextUser } from "../../../shared/executor/context.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cron daemon service — detect/install the cron package, manage the system
 * cron service, and install the per-execution logging wrapper. Mirrors the
 * firewall module's install methodology (packageInstaller + sudoShell).
 *
 * Service unit name differs per distro: Debian/Ubuntu → `cron`,
 * RHEL/Fedora/Alpine(cronie) → `crond`. We detect which unit exists.
 */

/* eslint-disable no-useless-escape -- the wrapper script body is a multi-line
 * shell template: `\$` and `\\\$` are deliberate escapes to BOTH keep `$VAR`
 * out of JS-template interpolation AND survive the bash round-trip. */

import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import {
  packageInstaller,
  sudoShell,
  type InstallResult,
  type SudoOptions,
} from "../../../shared/system/installer.js";
import { cronBinDir, cronWrapperPath, cronLogsDir } from "./cron-parser.service.js";
import { cronUserLogsRoot, cronUserWrapperPath, type CronOwner } from "./cron-owner.service.js";

const log = createModuleLogger("cron-daemon");

/** POSIX wrapper that records START / streamed output / END for each run. */
function wrapperScript(logsRoot = cronLogsDir()): string {
  return `#!/bin/sh
# lxp-cron-run <jobId> <base64-command>  — installed by LUXIPANEL cron module.
# Writes a per-execution log under ${logsRoot}/<jobId>/<UTC-timestamp>.log
set -u
umask 077
JOB_ID="\${1:-unknown}"
CMD_B64="\${2:-}"
LOGS_ROOT=${quoteArg(logsRoot)}
BASE="\$LOGS_ROOT/\$JOB_ID"
mkdir -p "\$BASE" 2>/dev/null || true
TS=\$(date -u +%Y%m%dT%H%M%SZ)
LOG="\$BASE/\$TS.log"
CMD=\$(printf '%s' "\$CMD_B64" | base64 -d 2>/dev/null)
START=\$(date +%s)
{
  echo "=== START \$(date -u +%Y-%m-%dT%H:%M:%SZ) jobId=\$JOB_ID ==="
  echo "\\\$ \$CMD"
  echo "--- output ---"
} >> "\$LOG" 2>&1
sh -c "\$CMD" >> "\$LOG" 2>&1
CODE=\$?
END=\$(date +%s)
DUR=\$(( (END - START) * 1000 ))
{
  echo "--- end output ---"
  echo "=== END \$(date -u +%Y-%m-%dT%H:%M:%SZ) exit=\$CODE durationMs=\$DUR ==="
} >> "\$LOG" 2>&1
# Rotate: keep only the 50 most recent logs for this job.
ls -1t "\$BASE"/*.log 2>/dev/null | tail -n +51 | while IFS= read -r f; do rm -f "\$f"; done
exit \$CODE
`;
}

export const cronDaemonService = {
  /** Provision an owner-writable runner and private logs without granting root jobs. */
  async ensureUserWrapper(executor: Executor, owner: CronOwner): Promise<void> {
    if (owner.username === "root") {
      await this.ensureWrapper(executor);
      return;
    }
    if (getContextUser()?.hostingPolicy?.runtime) return; // root-owned supervisor installed with the plan
    const wrapper = cronUserWrapperPath(owner);
    const logs = cronUserLogsRoot(owner);
    const binDir = wrapper.slice(0, wrapper.lastIndexOf("/"));
    const run = (argv: string[]) => owner.direct
      ? quoteCmd(argv[0]!, argv.slice(1))
      : quoteCmd("sudo", ["-u", owner.username, "-H", ...argv]);
    const mkdir = await executor.exec(run(["mkdir", "-p", binDir, logs]), { timeoutMs: 8_000 });
    if (mkdir.exitCode !== 0) throw new Error("No se pudo preparar Cron en el directorio del usuario Linux.");
    const tmp = `/tmp/.lxp-cron-run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await executor.writeFile(tmp, wrapperScript(logs), { mode: 0o644 });
    try {
      const install = await executor.exec(run(["install", "-m", "0700", tmp, wrapper]), { timeoutMs: 8_000 });
      if (install.exitCode !== 0) throw new Error("No se pudo instalar el ejecutor de Cron para el usuario.");
      await executor.exec(run(["chmod", "0700", binDir, logs]), { timeoutMs: 8_000 });
    } finally {
      await executor.unlink(tmp).catch(() => undefined);
    }
  },
  /** True when the `crontab` binary is present on the target. */
  async isInstalled(executor: Executor): Promise<boolean> {
    return packageInstaller.isCommandAvailable(executor, "crontab");
  },

  /** Which cron service unit is active ("cron"/"crond"), or null if none. */
  async serviceStatus(executor: Executor): Promise<{ unit: string | null; active: boolean }> {
    for (const unit of ["cron", "crond"]) {
      try {
        const out = await executor.exec(quoteCmd("systemctl", ["is-active", unit]), { timeoutMs: 5_000 });
        const state = (out.stdout || "").trim();
        if (state === "active") return { unit, active: true };
        if (state === "inactive" || state === "failed") return { unit, active: false };
      } catch {
        /* unit not found — try the next */
      }
    }
    return { unit: null, active: false };
  },

  /** True when the wrapper script is present on the target. */
  async wrapperInstalled(executor: Executor): Promise<boolean> {
    try {
      const out = await executor.exec(quoteCmd("test", ["-x", cronWrapperPath()]), { timeoutMs: 5_000 });
      return (out.exitCode ?? 1) === 0;
    } catch {
      return false;
    }
  },

  /** Idempotently install the logging wrapper (writeFile + chmod +x). */
  async ensureWrapper(executor: Executor): Promise<void> {
    try {
      await executor.exec(quoteCmd("mkdir", ["-p", cronBinDir()]), { timeoutMs: 5_000 });
      await executor.writeFile(cronWrapperPath(), wrapperScript());
      await executor.exec(quoteCmd("chmod", ["755", cronWrapperPath()]), { timeoutMs: 5_000 });
      await executor.exec(quoteCmd("mkdir", ["-p", cronLogsDir()]), { timeoutMs: 5_000 });
    } catch (err) {
      log.warn({ err, target: executor.target.id }, "Failed to install cron wrapper");
      throw err;
    }
  },

  /** Install the cron package, enable+start the service and the wrapper. */
  async install(executor: Executor, opts: SudoOptions = {}): Promise<InstallResult & { serviceUnit: string | null }> {
    const result = await packageInstaller.install(
      executor,
      { apt: ["cron"], dnf: ["cronie"], yum: ["cronie"], apk: ["cronie"], pacman: ["cronie"] },
      { sudoPassword: opts.sudoPassword },
    );

    let serviceUnit: string | null = null;
    if (result.ok) {
      // Enable + start whichever unit the distro provides.
      for (const unit of ["cron", "crond"]) {
        const en = await packageInstaller.enableUnit(executor, unit, { sudoPassword: opts.sudoPassword });
        if (en.ok) { serviceUnit = unit; break; }
      }
      await this.ensureWrapper(executor).catch(() => undefined);
      log.info({ target: executor.target.id, serviceUnit }, "Cron daemon installed");
    }
    return { ...result, serviceUnit };
  },

  /** Start + enable the cron service (when already installed). */
  async enableService(executor: Executor, opts: SudoOptions = {}): Promise<{ ok: boolean; code?: string; output?: string }> {
    const { unit } = await this.serviceStatus(executor);
    const target = unit ?? "cron";
    const res = await packageInstaller.enableUnit(executor, target, opts);
    return { ok: res.ok, code: res.code, output: res.output };
  },

  /** Stop + disable the cron service. */
  async disableService(executor: Executor, opts: SudoOptions = {}): Promise<{ ok: boolean; code?: string; output?: string }> {
    const { unit } = await this.serviceStatus(executor);
    const target = unit ?? "cron";
    const res = await sudoShell(
      executor,
      (sudo) => `${sudo} systemctl disable --now ${target}`,
      { sudoPassword: opts.sudoPassword },
    );
    return { ok: res.ok, code: res.code, output: res.output };
  },

  /** Full status snapshot for the UI banner. */
  async overview(executor: Executor): Promise<{
    installed: boolean;
    service: { unit: string | null; active: boolean };
    wrapper: boolean;
  }> {
    const installed = await this.isInstalled(executor);
    const [service, wrapper] = await Promise.all([
      installed ? this.serviceStatus(executor) : Promise.resolve({ unit: null, active: false }),
      installed ? this.wrapperInstalled(executor) : Promise.resolve(false),
    ]);
    return { installed, service, wrapper };
  },
};
