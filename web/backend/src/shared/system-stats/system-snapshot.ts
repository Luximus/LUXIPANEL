// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * One-round-trip system snapshot of the CONNECTED server, and the `df -B1 /`
 * parser — written once (B-14).
 *
 * `admin/system-info.service#snapshot` and `monitor.controller#
 * readRemoteSystemInfo` issued the SAME sentinel-joined command and then
 * repeated its whole parser (uname split, `loadavg.slice(0,3)`,
 * `MemTotal|MemAvailable` kB→bytes, `model name`, `df -B1 /`), comments
 * included, differing only in the sentinel and the output shape. A third copy
 * of the `df` parser lived in `monitor/system-stats.service`.
 *
 * This module owns the COMMAND and the PARSE; each caller keeps its own public
 * response shape, so no HTTP contract moves.
 *
 * Fail-closed by design: a transport-level failure propagates out of
 * `executor.exec` (the handler errors) instead of silently reporting the panel
 * host's own numbers. Individual missing fields degrade to their zero value.
 */

import { quoteCmd } from "../executor/quote.js";
import type { Executor } from "../executor/types.js";

const SEP = "__LXP_SYS_SEP__";

/** Sections of the snapshot command, in order. */
const SNAPSHOT_COMMANDS = [
  "hostname",
  "uname -s -m -r",
  "cat /proc/uptime",
  "cat /proc/loadavg",
  "cat /proc/meminfo",
  "nproc",
  "grep -m1 'model name' /proc/cpuinfo",
  "df -B1 /",
] as const;

/** Byte counters parsed from one `df -B1` data line. */
export interface DfLineStats {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  /** `Use%` as a number (`"42%"` → `42`). */
  usagePercent: number;
  /** `Use%` exactly as printed by `df` (`"42%"`), for callers that echo it. */
  usagePercentRaw: string;
}

/**
 * Parse a single `df -B1` data line (Filesystem 1B-blocks Used Available Use%
 * Mounted). All-zero when the line is malformed.
 */
export function parseDfLine(line: string): DfLineStats {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 5) {
    return { totalBytes: 0, usedBytes: 0, availableBytes: 0, usagePercent: 0, usagePercentRaw: "0%" };
  }
  const usagePercentRaw = parts[4] ?? "0%";
  return {
    totalBytes: Number.parseInt(parts[1] ?? "0", 10) || 0,
    usedBytes: Number.parseInt(parts[2] ?? "0", 10) || 0,
    availableBytes: Number.parseInt(parts[3] ?? "0", 10) || 0,
    usagePercent: Number.parseFloat(String(usagePercentRaw).replace("%", "")) || 0,
    usagePercentRaw,
  };
}

/** Parse the LAST data line of a `df` output block (the header is dropped). */
export function parseDfOutput(output: string): DfLineStats {
  return parseDfLine((output ?? "").trim().split("\n").at(-1) ?? "");
}

/** Raw, shape-neutral snapshot of the connected server. */
export interface SystemSnapshotRaw {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  /** Seconds since boot. */
  uptime: number;
  cpuModel: string;
  cpuCores: number;
  /** 1m / 5m / 15m load averages. */
  loadAvg: number[];
  /** Bytes. */
  memTotal: number;
  /** Bytes (MemAvailable). */
  memFree: number;
  disk: DfLineStats;
}

/**
 * Collect the snapshot in ONE bridged command. Sections are `;`-sequenced with
 * a sentinel, so a missing field degrades that field only.
 */
export async function readSystemSnapshot(
  executor: Executor,
  opts: { timeoutMs?: number } = {},
): Promise<SystemSnapshotRaw> {
  const command = SNAPSHOT_COMMANDS.join(`; echo ${SEP}; `);
  const out = (
    await executor.exec(quoteCmd("sh", ["-lc", command]), { timeoutMs: opts.timeoutMs ?? 8_000 })
  ).stdout;
  const [hostnameT, unameT, uptimeT, loadT, memT, nprocT, cpuModelT, dfT] = out.split(`${SEP}\n`);

  const uname = (unameT ?? "").trim().split(/\s+/);
  const loadAvg = (loadT ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((v) => Number.parseFloat(v) || 0);

  // /proc/meminfo is in kB → bytes.
  let memTotal = 0;
  let memFree = 0;
  for (const line of (memT ?? "").split("\n")) {
    const m = line.match(/^(MemTotal|MemAvailable):\s+(\d+)\s*kB/);
    if (m?.[1] === "MemTotal") memTotal = (Number.parseInt(m[2]!, 10) || 0) * 1024;
    else if (m?.[1] === "MemAvailable") memFree = (Number.parseInt(m[2]!, 10) || 0) * 1024;
  }

  return {
    hostname: (hostnameT ?? "").trim() || "unknown",
    platform: uname[0] ?? "unknown",
    arch: uname[1] ?? "unknown",
    release: uname[2] ?? "unknown",
    uptime: Math.floor(Number.parseFloat((uptimeT ?? "").trim().split(/\s+/)[0] ?? "0") || 0),
    cpuModel: ((cpuModelT ?? "").split(":")[1] ?? "").trim() || "unknown",
    cpuCores: Number.parseInt((nprocT ?? "").trim(), 10) || 0,
    loadAvg,
    memTotal,
    memFree,
    disk: parseDfOutput(dfT ?? ""),
  };
}
