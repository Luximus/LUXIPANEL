// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `systemctl is-active` — one probe instead of one per module.
 *
 * Five modules shelled out to `systemctl is-active` with their own suffix
 * (`2>/dev/null; true`, `|| true`, a `sudo -n` fallback) and their own idea of
 * what a failed probe means. The differences matter: a probe that throws must
 * NOT be reported as "down" by the alert worker (that would page on an SSH
 * blip), while a status endpoint wants "down".
 */

import { quoteArg } from "../executor/quote.js";
import type { ExecResult, Executor } from "../executor/types.js";

export interface SystemctlIsActiveOptions {
  /** Timeout for the probe command. */
  timeoutMs?: number;
  /** Also try `sudo -n` (some units are only visible to root). */
  sudoFallback?: boolean;
  /**
   * Command runner; defaults to `executor.exec`. The NGINX module passes a
   * runner that wraps the body in `sh -lc` with the sudo passphrase injected.
   */
  run?: (command: string) => Promise<ExecResult>;
  /**
   * Value returned when the probe itself throws (transport error, timeout).
   * Defaults to `false`. Alerting code passes `true` so an unreachable box is
   * "unknown", not "the service is down".
   */
  onProbeError?: boolean;
}

/** `true` when systemd reports the unit as `active` on the connected server. */
export async function systemctlIsActive(
  executor: Executor,
  unit: string,
  opts: SystemctlIsActiveOptions = {},
): Promise<boolean> {
  const q = quoteArg(unit);
  const probe = `systemctl is-active ${q} 2>/dev/null`;
  const command = opts.sudoFallback
    ? `${probe} || sudo -n systemctl is-active ${q} 2>/dev/null; true`
    : `${probe}; true`;
  const run =
    opts.run ??
    ((cmd: string) =>
      executor.exec(cmd, opts.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : undefined));
  try {
    const res = await run(command);
    return res.stdout.trim() === "active";
  } catch {
    return opts.onProbeError ?? false;
  }
}
