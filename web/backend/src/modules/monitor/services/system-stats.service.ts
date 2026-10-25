// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * System stats service — collects real-time server metrics.
 *
 * Every metric read runs through an `Executor` (SSH for remote targets, the
 * panel-host `localExecutor` for the box the panel runs on) — NEVER a local
 * `node:child_process`. This satisfies the hard rule (CLAUDE.md): no module
 * executes commands on the panel host directly, and the SAME aggregated
 * command + the SAME pure parsers serve both local and remote servers. `node:os`
 * is only used as a last-resort uptime fallback (libuv read, not a subprocess).
 */

import os from "node:os";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteCmd, localExecutor, type Executor } from "../../../shared/executor/index.js";
import { parseDfLine } from "../../../shared/system-stats/system-snapshot.js";

const log = createModuleLogger("system-stats");

/**
 * A single process as captured at snapshot time. Kept deliberately small
 * (pid + command + cpu/mem %) so it is cheap to store alongside every
 * snapshot in Redis and lets the monitor UI show which active processes were
 * running when a historical sample was recorded.
 */
export interface ProcLite {
  pid: number;
  name: string;
  cpu: number; // %CPU
  mem: number; // %MEM
}

export interface StatsSnapshot {
  ts: number; // Unix timestamp (ms)
  cpu: {
    loadAvg1m: number;
    loadAvg5m: number;
    loadAvg15m: number;
    usagePercent: number;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
  };
  network: {
    rxBytesPerSec: number;
    txBytesPerSec: number;
  };
  uptime: number; // seconds
  /**
   * Top processes audited at this instant — top 25 by CPU and top 25 by RAM.
   * Optional because pre-existing snapshots (and degraded captures) won't
   * have it; the UI treats its absence as "no audit available".
   */
  topProcesses?: { cpu: ProcLite[]; mem: ProcLite[] };
}

/** Number of processes retained per sort dimension at each snapshot. */
const TOP_PROCESS_COUNT = 25;

/**
 * Historical process labels must be useful without persisting raw argv: CLI
 * arguments may include access tokens, SQL, or customer data. Keep only the
 * executable and a safe script/project identity.
 */
function safeProcessName(args: string): string {
  const words = args.trim().split(/\s+/);
  const candidate = (words[0] ?? "").split("/").at(-1)?.replace(/:$/, "") || "";
  const binary = /^[A-Za-z0-9._-]{1,64}$/.test(candidate) ? candidate : "unknown";
  const script = words.slice(1, 6).find((word) => /^(?:\/var\/www\/|\.\/?)/.test(word) && /^[\w./-]+$/.test(word));
  if (binary === "node" && script) {
    if (/(?:^|\/)astro\/(?:bin\/)?astro\.mjs$/.test(script)) {
      return words.includes("check") ? "Astro check" : words.includes("build") ? "Astro build" : "Astro";
    }
    if (/(?:^|\/)vitest(?:\.mjs)?$/.test(script)) return "Vitest";
    if (/(?:^|\/)typescript\/bin\/tsc$/.test(script)) return "TypeScript";
  }
  const project = script?.match(/^\/var\/www\/([\w.-]+)\/(?:\.releases\/[^/]+\/)?(.+)$/);
  if (project && ["node", "python", "python3", "bun", "deno"].includes(binary)) {
    return `${binary} ${project[1]}/${project[2]}`.slice(0, 140);
  }
  return binary.slice(0, 64);
}

/** Parse `ps -eo pid,%cpu,%mem,args` without retaining arbitrary arguments. */
function parsePsLines(text: string, limit = TOP_PROCESS_COUNT): ProcLite[] {
  const out: ProcLite[] = [];
  for (const line of (text ?? "").trim().split("\n")) {
    const parts = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+)$/);
    if (!parts) continue;
    const pid = Number.parseInt(parts[1] ?? "", 10);
    const cpu = Number.parseFloat(parts[2] ?? "");
    const mem = Number.parseFloat(parts[3] ?? "");
    if (!Number.isFinite(pid) || !Number.isFinite(cpu) || !Number.isFinite(mem)) continue;
    out.push({ pid, name: safeProcessName(parts[4] ?? ""), cpu, mem });
    if (out.length >= limit) break;
  }
  return out;
}

/** Sum the rx (col 1) and tx (col 9) byte counters from /proc/net/dev text. */
function sumNetDev(text: string): { rx: number; tx: number } {
  let totalRx = 0;
  let totalTx = 0;
  for (const line of text.split("\n").slice(2)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10 || parts[0]?.includes("lo")) continue;
    totalRx += Number.parseInt(parts[1] ?? "0", 10) || 0;
    totalTx += Number.parseInt(parts[9] ?? "0", 10) || 0;
  }
  return { rx: totalRx, tx: totalTx };
}

/**
 * Parse a single `df -B1 /` data line (columns: Filesystem 1B-blocks Used
 * Available Use% Mounted) into byte counters. Shared by every disk read so the
 * shape is single-source. Returns all-zero when the line is malformed.
 */
// @see shared/system-stats/system-snapshot.ts — one `df -B1` parser for the
// three call sites that had their own (this one, monitor.controller and
// admin/system-info).

type CpuTimes = {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
  total: number;
};

const DEFAULT_SCOPE = "local";
// Lazily seeded on first collect per scope. There is deliberately NO
// module-load pre-seed: the delta helpers already treat a missing previous
// sample as "first call → 0%/0 B", so an empty map is safe, and nothing runs
// on the panel host at import time.
const _prevCpuTimesByScope = new Map<string, CpuTimes>();
const _prevNetBytesByScope = new Map<string, { rx: number; tx: number } | null>();
const _prevNetTsByScope = new Map<string, number>();

function parseProcStat(line: string): CpuTimes | null {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== "cpu" || parts.length < 6) return null;
  const user = Number.parseInt(parts[1] ?? "0", 10);
  const nice = Number.parseInt(parts[2] ?? "0", 10);
  const sys = Number.parseInt(parts[3] ?? "0", 10);
  const idle = Number.parseInt(parts[4] ?? "0", 10);
  const irq = Number.parseInt(parts[5] ?? "0", 10);
  return { user, nice, sys, idle, irq, total: user + nice + sys + idle + irq };
}

/**
 * `df` line → the four disk fields the monitor snapshot exposes. The shared
 * parser also returns `usagePercentRaw` (the literal `25%` column, which the
 * system-info endpoint echoes); the monitor payload never carried it, so it is
 * projected away here to keep the WS/HTTP snapshot byte-identical.
 */
function parseDiskLine(line: string): { totalBytes: number; usedBytes: number; availableBytes: number; usagePercent: number } {
  const { totalBytes, usedBytes, availableBytes, usagePercent } = parseDfLine(line);
  return { totalBytes, usedBytes, availableBytes, usagePercent };
}

/** All-zero CPU sample, used when the remote `/proc/stat` cpu line is missing. */
const ZERO_CPU_TIMES: CpuTimes = { user: 0, nice: 0, sys: 0, idle: 0, irq: 0, total: 0 };

function updateCpuUsage(scope: string, nowCpu: CpuTimes): number {
  const prev = _prevCpuTimesByScope.get(scope) ?? nowCpu;
  const cpuTotalDiff = nowCpu.total - prev.total;
  const cpuIdleDiff = nowCpu.idle - prev.idle;
  _prevCpuTimesByScope.set(scope, nowCpu);
  return cpuTotalDiff > 0
    ? parseFloat((((cpuTotalDiff - cpuIdleDiff) / cpuTotalDiff) * 100).toFixed(1))
    : 0;
}

function updateNetworkUsage(scope: string, nowNet: { rx: number; tx: number } | null, nowTs: number): { rxBytesPerSec: number; txBytesPerSec: number } {
  const prevNet = _prevNetBytesByScope.get(scope) ?? null;
  const prevTs = _prevNetTsByScope.get(scope) ?? nowTs;
  _prevNetBytesByScope.set(scope, nowNet);
  _prevNetTsByScope.set(scope, nowTs);

  if (!nowNet || !prevNet) {
    return { rxBytesPerSec: 0, txBytesPerSec: 0 };
  }

  const elapsedSec = (nowTs - prevTs) / 1000;
  if (elapsedSec <= 0) {
    return { rxBytesPerSec: 0, txBytesPerSec: 0 };
  }

  return {
    rxBytesPerSec: Math.round((nowNet.rx - prevNet.rx) / elapsedSec),
    txBytesPerSec: Math.round((nowNet.tx - prevNet.tx) / elapsedSec),
  };
}

function buildSnapshot(
  scope: string,
  ts: number,
  loadAvg: number[],
  totalMem: number,
  freeMem: number,
  disk: { totalBytes: number; usedBytes: number; availableBytes: number; usagePercent: number },
  nowCpu: CpuTimes,
  nowNet: { rx: number; tx: number } | null,
  nowNetTs: number,
  uptime: number,
): StatsSnapshot {
  return {
    ts,
    cpu: {
      loadAvg1m: loadAvg[0] ?? 0,
      loadAvg5m: loadAvg[1] ?? 0,
      loadAvg15m: loadAvg[2] ?? 0,
      usagePercent: updateCpuUsage(scope, nowCpu),
    },
    memory: {
      totalBytes: totalMem,
      usedBytes: totalMem - freeMem,
      freeBytes: freeMem,
      usagePercent: parseFloat((((totalMem - freeMem) / totalMem) * 100).toFixed(1)),
    },
    disk,
    network: updateNetworkUsage(scope, nowNet, nowNetTs),
    uptime,
  };
}

export const systemStatsService = {
  // Pure parsers exposed for characterization tests (byte-equivalent fixtures).
  // They are the single source of truth for interpreting the raw command output
  // and MUST NOT change behavior across the local/remote paths.
  _parsePsLines: parsePsLines,
  _sumNetDev: sumNetDev,
  _parseProcStat: parseProcStat,
  _parseDfLine: parseDiskLine,

  /**
   * Collect a stats snapshot from the PANEL HOST through the (unwrapped)
   * `localExecutor`. Thin wrapper over {@link collectWithExecutor} so the local
   * box and remote targets share ONE aggregated command + ONE set of parsers —
   * no `node:child_process`, nothing measures the wrong machine. CPU usage is a
   * delta from the previous call (0% on the first). The optional `executor`
   * override exists for tests.
   */
  collect(executor: Executor = localExecutor): Promise<StatsSnapshot> {
    return this.collectWithExecutor(executor, DEFAULT_SCOPE);
  },

  /** Collect a stats snapshot from a bridged target via executor. */
  async collectWithExecutor(executor: Executor, scope = executor.target.id): Promise<StatsSnapshot> {
    const ts = Date.now();

    try {
      const separator = "__LUXIPANEL_MONITOR_SEP__";
      // Core metric reads stay on the `&&` chain (they must all succeed). The
      // process audit is appended with `;` separators: `ps | head` makes ps
      // exit with SIGPIPE, so chaining it with `&&` would abort the rest —
      // sequencing with `;` keeps it best-effort without breaking metrics.
      const psCpu = `ps -ww -eo pid=,%cpu=,%mem=,args= --sort=-%cpu | head -n ${TOP_PROCESS_COUNT}`;
      const psMem = `ps -ww -eo pid=,%cpu=,%mem=,args= --sort=-%mem | head -n ${TOP_PROCESS_COUNT}`;
      const command = [
        `${quoteCmd("cat", ["/proc/loadavg"])} && echo ${separator}`,
        `${quoteCmd("free", ["-b"])} && echo ${separator}`,
        `${quoteCmd("cat", ["/proc/stat"])} && echo ${separator}`,
        `${quoteCmd("df", ["-B1", "/"])} && echo ${separator}`,
        `${quoteCmd("cat", ["/proc/net/dev"])} && echo ${separator}`,
        quoteCmd("cat", ["/proc/uptime"]),
      ].join(" && ") + `; echo ${separator}; ${psCpu}; echo ${separator}; ${psMem}`;
      const aggregateOut = await executor.exec(quoteCmd("sh", ["-lc", command]));
      const chunks = aggregateOut.stdout.split(`${separator}\n`);
      if (chunks.length < 6) {
        throw new Error("Incomplete monitor payload");
      }

      const [loadAvgText, memText, cpuText, dfText, netText, uptimeText, psCpuText, psMemText] = chunks;
      const loadAvg = (loadAvgText ?? "").trim().split(/\s+/).slice(0, 3).map((value) => Number.parseFloat(value) || 0);

      const memLines = (memText ?? "").trim().split("\n");
      const memParts = memLines[1]?.trim().split(/\s+/) ?? [];
      const totalMem = Number.parseInt(memParts[1] ?? "0", 10) || 0;
      const freeMem = Number.parseInt(memParts[6] ?? memParts[3] ?? "0", 10) || 0;

      const cpuLine = (cpuText ?? "").split("\n").find((line) => line.startsWith("cpu "));
      const nowCpu = cpuLine ? parseProcStat(cpuLine) : null;

      const dfLine = (dfText ?? "").trim().split("\n").at(-1) ?? "";
      const disk = parseDiskLine(dfLine);

      const nowNet = sumNetDev(netText ?? "");

      const uptimeSeconds = Number.parseFloat((uptimeText ?? "").trim().split(/\s+/)[0] ?? "0") || Math.floor(os.uptime());

      const snapshot = buildSnapshot(
        scope,
        ts,
        loadAvg,
        totalMem,
        freeMem,
        disk,
        nowCpu ?? ZERO_CPU_TIMES,
        nowNet,
        ts,
        Math.floor(uptimeSeconds),
      );
      const cpuProcs = parsePsLines(psCpuText ?? "");
      const memProcs = parsePsLines(psMemText ?? "");
      if (cpuProcs.length || memProcs.length) {
        snapshot.topProcesses = { cpu: cpuProcs, mem: memProcs };
      }
      return snapshot;
    } catch (err) {
      // FAIL-CLOSED: never substitute the panel host's metrics for the tenant's
      // on a transient SSH hiccup — that would silently report the wrong
      // machine. Propagate so the caller surfaces a degraded/error state.
      log.warn({ err, target: executor.target.id }, "Remote stats collection failed");
      throw err;
    }
  },
};
