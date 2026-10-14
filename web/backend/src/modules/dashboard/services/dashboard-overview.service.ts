// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Dashboard overview service — aggregates everything the /panel landing page
 * needs in a single payload. Replaces the previous 4-call fan-out
 * (/api/monitor/stats + /services + /history + /preferences/audit-log) so the
 * dashboard no longer leaves skeleton boxes when one of those endpoints fails.
 *
 * Returns a per-section result: each section reports `ok` and either a `data`
 * payload or an `error` string, so the UI can render partial state instead of
 * an all-or-nothing failure.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { quoteCmd, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";
import { injectSudoIntoShellScript, redactSudoSecrets } from "../../../shared/system/sudo-runtime.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { systemStatsService, type StatsSnapshot } from "../../monitor/services/system-stats.service.js";

const log = createModuleLogger("dashboard-overview");

interface DiskFolder {
  path: string;
  bytes: number;
}

interface DiskInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
  mountpoint: string;
  topFolders: DiskFolder[];
}

interface ServiceStatus {
  name: string;
  active: boolean;
}

interface ProcessRow {
  pid: number;
  user: string;
  command: string;
  cpuPercent: number;
  memPercent: number;
  memRssBytes: number;
}

interface DashboardOverview {
  stats: { ok: boolean; data?: StatsSnapshot; error?: string };
  disk: { ok: boolean; data?: DiskInfo; error?: string };
  services: { ok: boolean; data?: ServiceStatus[]; error?: string };
  topProcesses: { ok: boolean; data?: ProcessRow[]; error?: string };
}

const KEY_SERVICES = ["postfix", "dovecot", "opendkim", "nginx", "redis-server", "fail2ban", "ufw"];

/**
 * How many of the largest top-level directories we surface in the UI.
 */
const TOP_FOLDER_LIMIT = 3;

/**
 * Disk top-folder results don't change second-to-second. We cache per
 * executor scope so subsequent loads return instantly while a fresh `du`
 * runs in the background.
 */
const DISK_CACHE_TTL_MS = 60 * 1000;
const diskCacheByScope = new Map<string, { ts: number; data: DiskInfo }>();
const diskInFlightByScope = new Map<string, Promise<DiskFolder[]>>();

async function safeExec(
  executor: Executor,
  cmd: string,
  timeoutMs = 10_000,
): Promise<string> {
  const result = await executor.exec(cmd, { timeoutMs });
  return result.stdout ?? "";
}

/**
 * Run a section collector, turning a thrown error into the section's
 * `{ ok: false, error }` shape (and a `log.warn`) so one failing section never
 * fails the whole overview. `logMessage`/`errorFallback` keep each section's
 * original log text and fallback message.
 */
async function safeCollect<T>(
  executor: Executor,
  logMessage: string,
  errorFallback: string,
  fn: () => Promise<T>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // Never log the Error object itself: exec failures carry the full command
    // line (own enumerable `cmd` prop + duplicated in `message`), which after
    // sudo injection contains the credential.
    log.warn({ err: redactSudoSecrets(errMessage(err)), target: executor.target.id }, logMessage);
    return { ok: false, error: err instanceof Error ? redactSudoSecrets(err.message) : errorFallback };
  }
}

function collectStats(executor: Executor): Promise<DashboardOverview["stats"]> {
  return safeCollect(executor, "stats collection failed", "stats error", async () => {
    const isLocal = executor.target.id === LOCAL_TARGET_ID;
    return isLocal
      ? await systemStatsService.collect()
      : await systemStatsService.collectWithExecutor(executor);
  });
}

function collectDisk(executor: Executor): Promise<DashboardOverview["disk"]> {
  return safeCollect(executor, "disk collection failed", "disk error", async () => {
    const scope = executor.target.id || LOCAL_TARGET_ID;
    // df is cheap (~ms). Always read it live so the % reflects the current
    // state of the mount.
    const dfOut = await safeExec(executor, "df -B1 -P / | tail -1", 5_000);
    const parts = dfOut.trim().split(/\s+/);
    const totalBytes = Number.parseInt(parts[1] ?? "0", 10) || 0;
    const usedBytes = Number.parseInt(parts[2] ?? "0", 10) || 0;
    const availableBytes = Number.parseInt(parts[3] ?? "0", 10) || 0;
    const mountpoint = parts[5] ?? "/";
    const usagePercent = totalBytes > 0
      ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1))
      : 0;

    // Top-folders via `du` is slow (filesystem walk). Use a per-scope cache:
    //   - If we have a fresh cached snapshot, use it (subsequent loads are
    //     instant).
    //   - If we have a stale one, return it AND kick off a background refresh
    //     so the next request gets newer numbers.
    //   - If nothing is cached at all, run `du` synchronously this once.
    const cached = diskCacheByScope.get(scope);
    const now = Date.now();

    if (!cached) {
      // Cold cache: compute folders synchronously this once and seed the cache.
      const folders = await collectTopFolders(executor);
      const data: DiskInfo = { totalBytes, usedBytes, availableBytes, usagePercent, mountpoint, topFolders: folders };
      diskCacheByScope.set(scope, { ts: now, data });
      return data;
    }

    // Warm cache: serve the cached folders immediately (df fields are always
    // live above). If stale, kick off a single background `du` whose `.then`
    // is the ONLY writer of the refreshed entry — we don't re-write the cache
    // here, so a refresh that lands first is never clobbered by stale data.
    const isStale = now - cached.ts > DISK_CACHE_TTL_MS;
    if (isStale && !diskInFlightByScope.has(scope)) {
      const task = collectTopFolders(executor)
        .then((fresh) => {
          diskCacheByScope.set(scope, {
            ts: Date.now(),
            data: { totalBytes, usedBytes, availableBytes, usagePercent, mountpoint, topFolders: fresh },
          });
          return fresh;
        })
        .finally(() => diskInFlightByScope.delete(scope));
      diskInFlightByScope.set(scope, task);
    }

    return {
      totalBytes, usedBytes, availableBytes, usagePercent, mountpoint,
      topFolders: cached.data.topFolders,
    };
  });
}

async function collectTopFolders(executor: Executor): Promise<DiskFolder[]> {
  try {
    // Single pass over the ROOT filesystem reporting each top-level directory's
    // own contribution (`-d1`). `-x` keeps the walk on the same filesystem as
    // `/`, so it skips separate mounts (/proc, /sys, /dev, and any data
    // partition like /home or /var/lib/docker mounted elsewhere) — which means
    // the folder sizes add up to what `df /` reports for the disk card, instead
    // of inflating it with other filesystems. We no longer guess a fixed
    // candidate list, so whatever is actually filling the disk shows up.
    //   -b bytes · -x one filesystem · -d1 only top level · 2>/dev/null hides
    //   permission-denied noise.
    //
    // Run via `sudo`: on a real server the big consumers (/var/vmail mail
    // store, /var/lib/mysql, other users' /home/*) are NOT readable by the SSH
    // user, so an unprivileged `du` silently skips them (2>/dev/null) and
    // wildly undercounts — that's why the top folders summed ~6 GB while the
    // disk reported 48 GB used. `injectSudoIntoShellScript` wires the session
    // passphrase as `sudo -S`; with no credential it degrades to `sudo -n`
    // (and, failing that, the unprivileged read) so servers without sudo still
    // render something instead of erroring.
    const cmd = "sudo du -xb -d1 / 2>/dev/null";
    const body = await injectSudoIntoShellScript(executor, cmd);
    const out = await safeExec(executor, quoteCmd("sh", ["-lc", body]), 30_000);
    const folders: DiskFolder[] = [];
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^(\d+)\s+(.+)$/);
      if (!match) continue;
      const bytes = Number.parseInt(match[1]!, 10) || 0;
      const path = match[2]!.trim();
      // Drop the grand-total row (`du` emits "<bytes> /" last) and any empty
      // path — we only want the per-directory breakdown.
      if (!path || path === "/" || bytes <= 0) continue;
      folders.push({ path, bytes });
    }
    folders.sort((a, b) => b.bytes - a.bytes);
    return folders.slice(0, TOP_FOLDER_LIMIT);
  } catch (err) {
    log.warn(
      { err: redactSudoSecrets(errMessage(err)), target: executor.target.id },
      "top-folder du failed",
    );
    return [];
  }
}

function collectServices(executor: Executor): Promise<DashboardOverview["services"]> {
  return safeCollect(executor, "service status failed", "services error", async () => {
    // `systemctl is-active <unit1> <unit2> ...` emits one line per unit in
    // the same order, regardless of exit status. We force exit 0 with the
    // trailing `; true` so the proxied shell doesn't mark the run as a
    // failure when any service is inactive (which is the normal case).
    const cmd = `systemctl is-active ${KEY_SERVICES.join(" ")} 2>/dev/null; true`;
    const out = await safeExec(executor, cmd, 8_000);
    const lines = out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    return KEY_SERVICES.map((name, idx) => ({
      name,
      active: (lines[idx] ?? "inactive") === "active",
    }));
  });
}

function collectTopProcesses(executor: Executor): Promise<DashboardOverview["topProcesses"]> {
  return safeCollect(executor, "top processes failed", "processes error", async () => {
    // Sort by %CPU descending, then we'll also surface memory via the
    // memPercent field on every row so the UI can re-rank if needed.
    const cmd = "ps -eo pid,user,pcpu,pmem,rss,comm --sort=-pcpu --no-headers | head -8";
    const out = await safeExec(executor, cmd, 6_000);
    const rows: ProcessRow[] = [];
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 6) continue;
      const pid = Number.parseInt(parts[0]!, 10);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      rows.push({
        pid,
        user: parts[1] ?? "",
        cpuPercent: Number.parseFloat(parts[2] ?? "0") || 0,
        memPercent: Number.parseFloat(parts[3] ?? "0") || 0,
        memRssBytes: (Number.parseInt(parts[4] ?? "0", 10) || 0) * 1024,
        command: parts.slice(5).join(" "),
      });
    }
    return rows;
  });
}

export const dashboardOverviewService = {
  async collect(executor: Executor): Promise<DashboardOverview> {
    const [stats, disk, services, topProcesses] = await Promise.all([
      collectStats(executor),
      collectDisk(executor),
      collectServices(executor),
      collectTopProcesses(executor),
    ]);
    return { stats, disk, services, topProcesses };
  },
};
