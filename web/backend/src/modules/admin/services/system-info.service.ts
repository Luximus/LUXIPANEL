// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * System info service — CPU, RAM, disk, uptime of the CONNECTED server, read
 * via the request executor (never the panel host's node:os / local shell).
 */

import { quoteCmd, type Executor } from "../../../shared/executor/index.js";

export interface CpuStats {
  model: string;
  cores: number;
  loadAvg: { "1m": number; "5m": number; "15m": number };
}

export interface MemoryStats {
  total: number;
  free: number;
  used: number;
  usagePercent: string;
}

export interface DiskStats {
  total: number;
  used: number;
  available: number;
  percent: string;
}

export interface SystemSnapshot {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  uptime: number;
  cpu: CpuStats;
  memory: MemoryStats;
  disk: DiskStats;
  process: {
    pid: number;
    nodeVersion: string;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

const SEP = "__LXP_ADMIN_SYS_SEP__";

export const systemInfoService = {
  /**
   * Collect a full system snapshot from the CONNECTED server in a single
   * bridged command. Fail-closed: a transport-level failure propagates from
   * `executor.exec` so the handler errors instead of reporting the panel host.
   */
  async snapshot(executor: Executor): Promise<SystemSnapshot> {
    const command = [
      "hostname",
      "uname -s -m -r",
      "cat /proc/uptime",
      "cat /proc/loadavg",
      "cat /proc/meminfo",
      "nproc",
      "grep -m1 'model name' /proc/cpuinfo",
      "df -B1 /",
    ].join(`; echo ${SEP}; `);
    const out = (await executor.exec(quoteCmd("sh", ["-lc", command]), { timeoutMs: 8000 })).stdout;
    const parts = out.split(`${SEP}\n`);
    const [hostnameT, unameT, uptimeT, loadT, memT, nprocT, cpuModelT, dfT] = parts;

    const uname = (unameT ?? "").trim().split(/\s+/);
    const loadAvg = (loadT ?? "").trim().split(/\s+/).slice(0, 3).map((v) => Number.parseFloat(v) || 0);

    // /proc/meminfo is in kB → bytes.
    let totalMem = 0;
    let freeMem = 0;
    for (const line of (memT ?? "").split("\n")) {
      const m = line.match(/^(MemTotal|MemAvailable):\s+(\d+)\s*kB/);
      if (m?.[1] === "MemTotal") totalMem = (Number.parseInt(m[2]!, 10) || 0) * 1024;
      else if (m?.[1] === "MemAvailable") freeMem = (Number.parseInt(m[2]!, 10) || 0) * 1024;
    }

    const cpuModel = ((cpuModelT ?? "").split(":")[1] ?? "").trim() || "unknown";
    const disk = parseDf(dfT ?? "");

    return {
      hostname: (hostnameT ?? "").trim() || "unknown",
      platform: uname[0] ?? "unknown",
      arch: uname[1] ?? "unknown",
      release: uname[2] ?? "unknown",
      uptime: Math.floor(Number.parseFloat((uptimeT ?? "").trim().split(/\s+/)[0] ?? "0") || 0),
      cpu: {
        model: cpuModel,
        cores: Number.parseInt((nprocT ?? "").trim(), 10) || 0,
        loadAvg: {
          "1m": loadAvg[0] ?? 0,
          "5m": loadAvg[1] ?? 0,
          "15m": loadAvg[2] ?? 0,
        },
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: totalMem > 0 ? (((totalMem - freeMem) / totalMem) * 100).toFixed(1) : "0.0",
      },
      disk,
      // The panel backend's OWN Node process (diagnostics) — legitimately
      // panel-host info, not a per-server metric.
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
      },
    };
  },

  /** Get disk usage for the root filesystem on the connected server. */
  async getDiskUsage(executor: Executor): Promise<DiskStats> {
    try {
      const out = (await executor.exec(quoteCmd("df", ["-B1", "/"]), { timeoutMs: 5000 })).stdout;
      return parseDf(out);
    } catch {
      return { total: 0, used: 0, available: 0, percent: "N/A" };
    }
  },
};

function parseDf(text: string): DiskStats {
  const line = text.trim().split("\n").at(-1) ?? "";
  const parts = line.split(/\s+/);
  if (parts.length >= 5) {
    return {
      total: Number.parseInt(parts[1] ?? "0", 10) || 0,
      used: Number.parseInt(parts[2] ?? "0", 10) || 0,
      available: Number.parseInt(parts[3] ?? "0", 10) || 0,
      percent: parts[4] ?? "0%",
    };
  }
  return { total: 0, used: 0, available: 0, percent: "N/A" };
}
