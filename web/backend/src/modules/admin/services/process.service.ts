// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Process service — check system service status via systemctl ON THE CONNECTED
 * server (via the request executor), never on the panel host.
 */

import { quoteCmd, type Executor } from "../../../shared/executor/index.js";

/** Timeout (ms) for `systemctl` queries over the executor. */
const SYSTEMCTL_TIMEOUT_MS = 5_000;

/** Services that the panel is allowed to inspect. */
const ALLOWED_SERVICES = [
  "postfix",
  "dovecot",
  "opendkim",
  "redis-server",
  "postgresql",
  "nginx",
] as const;

export interface ServiceStatus {
  name: string;
  active: boolean;
  subState: string | null;
  mainPid: number | null;
  memory: number | null;
}

/**
 * Build a ServiceStatus from raw systemctl output. `isActiveOut` is the trimmed
 * `systemctl is-active` output; `showOut` is the trimmed
 * `systemctl show --property=SubState,MainPID,MemoryCurrent` output (empty when
 * the service is inactive, since the caller skips that command).
 */
function parseStatus(name: string, isActiveOut: string, showOut: string): ServiceStatus {
  const status: ServiceStatus = { name, active: isActiveOut === "active", subState: null, mainPid: null, memory: null };
  if (!status.active) return status;
  for (const line of showOut.split("\n")) {
    const [key, val] = line.split("=");
    if (!key || val === undefined) continue;
    if (key === "SubState") status.subState = val;
    if (key === "MainPID") status.mainPid = parseInt(val, 10) || null;
    if (key === "MemoryCurrent") status.memory = parseInt(val, 10) || null;
  }
  return status;
}

export const processService = {
  /** Check the status of a single service on the connected server. */
  async getStatus(executor: Executor, name: string): Promise<ServiceStatus> {
    try {
      // `systemctl is-active` prints active|inactive|failed to stdout and exits
      // non-zero when not active; we key off stdout so it works whether or not
      // the executor throws on a non-zero exit code.
      const activeRes = await executor.exec(
        quoteCmd("systemctl", ["is-active", name]),
        { timeoutMs: SYSTEMCTL_TIMEOUT_MS },
      );
      const active = (activeRes.stdout ?? "").trim();

      const props = active === "active"
        ? ((await executor.exec(
            quoteCmd("systemctl", ["show", name, "--property=SubState,MainPID,MemoryCurrent"]),
            { timeoutMs: SYSTEMCTL_TIMEOUT_MS },
          )).stdout ?? "").trim()
        : "";

      return parseStatus(name, active, props);
    } catch {
      // Systemd not available or service not found → report inactive.
      return { name, active: false, subState: null, mainPid: null, memory: null };
    }
  },

  /** Check all allowed services on the connected server. */
  async getAllStatuses(executor: Executor): Promise<ServiceStatus[]> {
    return Promise.all(ALLOWED_SERVICES.map((s) => this.getStatus(executor, s)));
  },
};
