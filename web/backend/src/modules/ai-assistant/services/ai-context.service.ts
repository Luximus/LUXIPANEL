// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI context service — collects live server context to inject into the LLM system prompt.
 *
 * Per-server isolation invariant: this context describes the CONNECTED target,
 * not the panel host. Everything is collected through the context `Executor`
 * (SSH/SFTP on the target) — never `os.*` / `execSync` on the panel host, which
 * would both misrepresent the target and leak the panel host's hostname,
 * services and journal into every chat prompt. Fail-OPEN (advisory context, not
 * persistence): with no context executor we return a minimal "unknown" snapshot
 * rather than falling back to the host.
 */

import { getContextExecutor } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/index.js";

export interface ServerContext {
  hostname: string;
  platform: string;
  uptime: number;
  cpu: { cores: number; loadAvg: number[] };
  memory: { totalGb: string; usedPercent: string };
  disk: { usedPercent: string };
  recentLogs: string;
  services: Array<{ name: string; active: boolean }>;
}

/**
 * Per-target snapshot cache. Collecting the context shells out (systemctl /
 * journalctl) on every turn, which is wasteful when the user sends several
 * messages in a minute. Cache the result for ~60s keyed by the context
 * executor's target id so two different servers never share a snapshot.
 * No context executor (e.g. internal/CLI-loopback) → key "" and a minimal
 * snapshot; any error path just re-collects.
 */
const COLLECT_TTL_MS = 60_000;
/** Recent-log lines kept in the prompt — trimmed from 20→8 to cut tokens. */
const RECENT_LOG_LINES = 8;
const SERVICES = ["postfix", "dovecot", "nginx", "postgresql", "redis-server", "opendkim"];
const snapshotCache = new Map<string, { at: number; ctx: ServerContext }>();

/** Resolve the context executor without throwing (advisory path is fail-open). */
function contextExecutorOrNull(): Executor | null {
  try {
    return getContextExecutor() ?? null;
  } catch {
    return null;
  }
}

function cacheKey(exec: Executor | null): string {
  return exec?.target.id ?? "";
}

/** Minimal snapshot used when the target is unreachable / no executor. */
function unknownContext(): ServerContext {
  return {
    hostname: "unknown",
    platform: "unknown",
    uptime: 0,
    cpu: { cores: 0, loadAvg: [0, 0, 0] },
    memory: { totalGb: "?", usedPercent: "?" },
    disk: { usedPercent: "?" },
    recentLogs: "(logs unavailable)",
    services: SERVICES.map((name) => ({ name, active: false })),
  };
}

/**
 * ONE batched probe on the target so a turn pays a single SSH round-trip. Each
 * field is prefixed so the output parses line-by-line; every sub-command is
 * best-effort (`2>/dev/null`) so a missing tool never fails the whole probe.
 */
function buildProbe(): string {
  const svcLoop = SERVICES.join(" ");
  return [
    `printf 'HOST=%s\\n' "$(hostname 2>/dev/null)"`,
    `printf 'UNAME=%s\\n' "$(uname -s -r 2>/dev/null)"`,
    `printf 'UPTIME=%s\\n' "$(cut -d. -f1 /proc/uptime 2>/dev/null)"`,
    `printf 'CORES=%s\\n' "$(nproc 2>/dev/null)"`,
    `printf 'LOAD=%s\\n' "$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null)"`,
    `printf 'MEM=%s\\n' "$(free -b 2>/dev/null | awk '/^Mem:/{printf "%.1f %.1f", $2/1073741824, ($2>0?$3*100/$2:0)}')"`,
    `printf 'DISK=%s\\n' "$(df -P / 2>/dev/null | awk 'NR==2{print $5}' | tr -d %)"`,
    `for s in ${svcLoop}; do printf 'SVC=%s:%s\\n' "$s" "$(systemctl is-active "$s" 2>/dev/null)"; done`,
    `printf 'LOGS_START\\n'`,
    `journalctl -n ${RECENT_LOG_LINES} --no-pager -p warning..err 2>/dev/null`,
  ].join("; ");
}

function parseProbe(stdout: string): ServerContext {
  const ctx = unknownContext();
  const services = new Map(ctx.services.map((s) => [s.name, s] as const));
  const lines = stdout.split("\n");
  const logs: string[] = [];
  let inLogs = false;
  for (const line of lines) {
    if (inLogs) {
      logs.push(line);
      continue;
    }
    if (line === "LOGS_START") {
      inLogs = true;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    const val = line.slice(eq + 1).trim();
    switch (key) {
      case "HOST":
        if (val) ctx.hostname = val;
        break;
      case "UNAME":
        if (val) ctx.platform = val;
        break;
      case "UPTIME": {
        const n = Number.parseInt(val, 10);
        if (Number.isFinite(n)) ctx.uptime = n;
        break;
      }
      case "CORES": {
        const n = Number.parseInt(val, 10);
        if (Number.isFinite(n)) ctx.cpu.cores = n;
        break;
      }
      case "LOAD": {
        const parts = val.split(/\s+/).map(Number).filter((x) => Number.isFinite(x));
        if (parts.length) ctx.cpu.loadAvg = parts.slice(0, 3);
        break;
      }
      case "MEM": {
        const [totalGb, usedPct] = val.split(/\s+/);
        if (totalGb) ctx.memory.totalGb = totalGb;
        if (usedPct) ctx.memory.usedPercent = Number(usedPct).toFixed(1);
        break;
      }
      case "DISK":
        if (val) ctx.disk.usedPercent = Number(val).toFixed(1);
        break;
      case "SVC": {
        const [name, state] = val.split(":");
        const rec = name ? services.get(name) : undefined;
        if (rec) rec.active = state === "active";
        break;
      }
    }
  }
  const tail = logs.join("\n").trim();
  ctx.recentLogs = tail || "(logs unavailable)";
  return ctx;
}

export const aiContextService = {
  /** Collect a server snapshot to pass as LLM context (per-target cached ~60s). */
  async collect(): Promise<ServerContext> {
    const exec = contextExecutorOrNull();
    const key = cacheKey(exec);
    const cached = snapshotCache.get(key);
    if (cached && Date.now() - cached.at < COLLECT_TTL_MS) return cached.ctx;

    // No context executor (loopback / early boot): return an "unknown" snapshot
    // — NEVER read the panel host, which would leak its data into the prompt.
    if (!exec) {
      const ctx = unknownContext();
      snapshotCache.set(key, { at: Date.now(), ctx });
      return ctx;
    }

    let ctx: ServerContext;
    try {
      const res = await exec.exec(buildProbe(), { timeoutMs: 8000 });
      ctx = parseProbe(res.stdout ?? "");
    } catch {
      // Target unreachable / probe failed → degrade to unknown, don't crash the turn.
      ctx = unknownContext();
    }

    snapshotCache.set(key, { at: Date.now(), ctx });
    return ctx;
  },

  /** Build a condensed system-prompt string from the context. */
  toPrompt(ctx: ServerContext): string {
    const serviceList = ctx.services
      .map((s) => `${s.name}: ${s.active ? "running" : "STOPPED"}`)
      .join(", ");

    // Keep only the last RECENT_LOG_LINES lines to stay token-cheap (this block
    // is volatile context, re-sent each turn). The probe already fetches a
    // small window; trim defensively here too in case the source grows.
    const logTail = ctx.recentLogs
      .split("\n")
      .slice(-RECENT_LOG_LINES)
      .join("\n");

    return [
      `You are a server administration assistant for the LUXIPANEL control panel.`,
      `Server: ${ctx.hostname} (${ctx.platform})`,
      `Uptime: ${Math.floor(ctx.uptime / 3600)}h | Load: ${ctx.cpu.loadAvg.map((l) => l.toFixed(2)).join(", ")}`,
      `Memory: ${ctx.memory.usedPercent}% used | Disk: ${ctx.disk.usedPercent}% used`,
      `Services: ${serviceList}`,
      `Recent logs (last ${RECENT_LOG_LINES} lines):\n${logTail}`,
    ].join("\n");
  },
};
