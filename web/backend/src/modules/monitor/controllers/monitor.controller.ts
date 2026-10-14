// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Monitor controller — system metrics, history, and server info.
 */

import os from "node:os";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { parsePageQuery } from "../../../shared/http/pagination.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { getExecutor, quoteCmd, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";
import { AppError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { statsCollectorService } from "../services/stats-collector.service.js";
import { sampleHistory } from "../services/history-sampling.js";
import { buildHistoryChart } from "../services/history-chart.js";
import { systemStatsService } from "../services/system-stats.service.js";
import { resolveMonitorExecutor } from "../services/monitor-executor.service.js";
import { readSystemSnapshot } from "../../../shared/system-stats/system-snapshot.js";
import { readAccountsFromServer } from "../../mail/controllers/accounts.helpers.js";
import { packageInstaller, SUDO_PASSWORD_REQUIRED } from "../../../shared/system/installer.js";
import { MIN_REAL_UID } from "../../../shared/system/users.js";
import { KNOWN_SERVICES, KNOWN_SERVICE_BY_UNIT } from "../services/known-services.js";

type ServiceStatus = { name: string; active: boolean; installed: boolean; module: string; installable: boolean };

type ProcessRow = {
  pid: number;
  name: string;
  cpuPercent: number;
  memPercent: number;
  memRss: number;
  status: string;
  user: string;
};

const SERVICES_CACHE_TTL_MS = 20_000;
const servicesCacheByScope = new Map<string, { ts: number; data: ServiceStatus[] }>();
const servicesInFlightByScope = new Map<string, Promise<ServiceStatus[]>>();
const PROCESSES_CACHE_TTL_MS = 10_000;
const processesCacheByScope = new Map<string, { ts: number; data: ProcessRow[] }>();
const processesInFlightByScope = new Map<string, Promise<ProcessRow[]>>();
const log = createModuleLogger("monitor-ctrl");

/**
 * Whether the request's session targets a REMOTE server (direct-SSH bridge),
 * read from the authoritative `bridgedSession.direct` flag pinned by the auth
 * middleware. Passed to `resolveMonitorExecutor` so a remote session with an
 * expired bridge fails closed instead of silently sampling the panel host.
 */
function sessionDirect(res: Response): boolean {
  return Boolean((res.locals.bridgedSession as { direct?: boolean } | undefined)?.direct);
}

/**
 * Serve `key` from a TTL cache; on a miss, run `loader` while deduplicating
 * concurrent callers through `inflight`. The loader is responsible for
 * populating `cache` (so its degraded-fallback path can cache too).
 */
function cachedSingleFlight<T>(
  cache: Map<string, { ts: number; data: T }>,
  inflight: Map<string, Promise<T>>,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < ttlMs) {
    return Promise.resolve(cached.data);
  }

  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }

  const task = loader().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, task);
  return task;
}

function isRemoteBridgeError(err: unknown): boolean {
  const message = errMessage(err);
  return message.includes("Session expired")
    || message.includes("Too many requests")
    || message.includes("Connection lost before handshake");
}

function serviceMeta(unit: string): { module: string; installable: boolean } {
  const known = KNOWN_SERVICE_BY_UNIT.get(unit);
  return { module: known?.module ?? "monitor", installable: Boolean(known?.pkg) };
}

async function loadServicesWithExecutor(executor: Awaited<ReturnType<typeof resolveMonitorExecutor>>): Promise<ServiceStatus[]> {
  const scope = executor.target.id || LOCAL_TARGET_ID;

  // Every service the panel's modules depend on. Listing units that are not
  // present is safe: systemctl reports `LoadState=not-found` for them, which
  // is exactly how we detect the "not installed" state.
  const services = KNOWN_SERVICES.map((s) => s.unit);

  return cachedSingleFlight(servicesCacheByScope, servicesInFlightByScope, scope, SERVICES_CACHE_TTL_MS, async () => {
    try {
      // `systemctl show` emits one property block per unit (in argument
      // order), separated by a blank line. We include `Id` so we can key the
      // result by unit name rather than relying on positional order — robust
      // even if systemd reorders or de-duplicates aliased units.
      //   LoadState=loaded     → unit file present  (installed)
      //   LoadState=not-found  → unit file missing  (not installed)
      //   ActiveState=active   → running
      const args = services.join(" ");
      const cmd = `systemctl show --property=Id,LoadState,ActiveState ${args} 2>/dev/null; true`;
      const output = (await executor.exec(cmd, { timeoutMs: 8_000 })).stdout;

      // Parse blocks into a map keyed by the unit name (Id minus `.service`).
      const byUnit = new Map<string, { loadState: string; activeState: string }>();
      for (const block of output.split(/\n\s*\n/)) {
        const fields: Record<string, string> = {};
        for (const line of block.split("\n")) {
          const eq = line.indexOf("=");
          if (eq > 0) fields[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
        const id = (fields["Id"] ?? "").replace(/\.service$/, "");
        if (id) byUnit.set(id, { loadState: fields["LoadState"] ?? "", activeState: fields["ActiveState"] ?? "" });
      }

      const data: ServiceStatus[] = services.map((name) => {
        const meta = serviceMeta(name);
        const row = byUnit.get(name);
        // "masked" units are installed but disabled at the systemd level —
        // treat them as installed so we never offer a misleading "Instalar".
        const installed = row ? row.loadState === "loaded" || row.loadState === "masked" : false;
        const active = row ? row.activeState === "active" : false;
        return { name, active, installed, module: meta.module, installable: meta.installable };
      });
      servicesCacheByScope.set(scope, { ts: Date.now(), data });
      return data;
    } catch (err) {
      if (scope !== "local" && isRemoteBridgeError(err)) {
        log.warn({ err, scope, target: executor.target.id }, "Remote service status check failed; returning degraded status");
        const fallback: ServiceStatus[] = services.map((name) => {
          const meta = serviceMeta(name);
          return { name, active: false, installed: false, module: meta.module, installable: meta.installable };
        });
        servicesCacheByScope.set(scope, { ts: Date.now(), data: fallback });
        return fallback;
      }
      throw err;
    }
  });
}

async function loadProcessesWithExecutor(
  executor: Awaited<ReturnType<typeof resolveMonitorExecutor>>,
  sortBy: string,
  limit: number,
): Promise<ProcessRow[]> {
  const scope = executor.target.id || LOCAL_TARGET_ID;
  const key = `${scope}:${sortBy}:${limit}`;

  return cachedSingleFlight(processesCacheByScope, processesInFlightByScope, key, PROCESSES_CACHE_TTL_MS, async () => {
    const cmd = sortBy === "mem"
      ? `ps aux --sort=-%mem | head -${limit + 1}`
      : `ps aux --sort=-%cpu | head -${limit + 1}`;
    try {
      const output = (await executor.exec(cmd, { timeoutMs: 8_000 })).stdout;
      const lines = output.trim().split("\n").slice(1);
      const parsed = lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          user: parts[0] ?? "",
          pid: parseInt(parts[1] ?? "0", 10),
          cpuPercent: parseFloat(parts[2] ?? "0"),
          memPercent: parseFloat(parts[3] ?? "0"),
          memRss: parseInt(parts[5] ?? "0", 10),
          status: parts[7] ?? "",
          name: parts.slice(10).join(" ") || parts[10] || "",
        };
      }).filter((p) => !isNaN(p.pid) && p.pid > 0);
      processesCacheByScope.set(key, { ts: Date.now(), data: parsed });
      return parsed;
    } catch (err) {
      if (scope !== "local" && isRemoteBridgeError(err)) {
        log.warn({ err, scope, target: executor.target.id, sortBy, limit }, "Remote process list failed; returning empty snapshot");
        const fallback: ProcessRow[] = [];
        processesCacheByScope.set(key, { ts: Date.now(), data: fallback });
        return fallback;
      }
      throw err;
    }
  });
}

interface RemoteSystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  uptime: number;
  cpuModel: string;
  cpuCores: number;
  loadAvg: number[];
  memTotal: number;
  memFree: number;
  disk: { total: number; used: number; available: number; percent: string };
}

/**
 * Read a system overview of the CONNECTED server in a single bridged command.
 * Sequenced with `;` + a sentinel so a missing field degrades that field only,
 * while a transport-level failure (bridge down) propagates from `executor.exec`
 * → the handler fails closed instead of falling back to the panel host.
 */
async function readRemoteSystemInfo(executor: Awaited<ReturnType<typeof resolveMonitorExecutor>>): Promise<RemoteSystemInfo> {
  const snap = await readSystemSnapshot(executor, { timeoutMs: 8_000 });
  return {
    hostname: snap.hostname,
    platform: snap.platform,
    arch: snap.arch,
    release: snap.release,
    uptime: snap.uptime,
    cpuModel: snap.cpuModel,
    cpuCores: snap.cpuCores,
    loadAvg: snap.loadAvg,
    memTotal: snap.memTotal,
    memFree: snap.memFree,
    disk: {
      total: snap.disk.totalBytes,
      used: snap.disk.usedBytes,
      available: snap.disk.availableBytes,
      percent: snap.disk.usagePercentRaw,
    },
  };
}

export const monitorController = {
  /** GET /api/monitor/system — system overview of the CONNECTED server. */
  system: asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user;
    const executor = await resolveMonitorExecutor(user?.bridgeSessionId, { direct: sessionDirect(res) });
    // FAIL-CLOSED: every system metric is read from the bridged target via the
    // executor — NEVER from the panel host's `os.*`. If the bridge is down this
    // throws and surfaces an error rather than reporting the wrong machine.
    const sys = await readRemoteSystemInfo(executor);

    res.json({
      ok: true,
      data: {
        hostname: sys.hostname,
        platform: sys.platform,
        arch: sys.arch,
        release: sys.release,
        uptime: sys.uptime,
        cpu: {
          model: sys.cpuModel,
          cores: sys.cpuCores,
          loadAvg: { "1m": sys.loadAvg[0] ?? 0, "5m": sys.loadAvg[1] ?? 0, "15m": sys.loadAvg[2] ?? 0 },
        },
        memory: {
          total: sys.memTotal,
          free: sys.memFree,
          used: sys.memTotal - sys.memFree,
          usagePercent: sys.memTotal > 0 ? (((sys.memTotal - sys.memFree) / sys.memTotal) * 100).toFixed(1) : "0.0",
        },
        disk: sys.disk,
        // The panel backend's OWN Node process (diagnostics) — this is
        // legitimately panel-host info, not a per-server metric.
        process: {
          pid: process.pid,
          nodeVersion: process.version,
          uptime: Math.floor(process.uptime()),
          memoryUsage: process.memoryUsage(),
        },
      },
    });
  }),

  /** GET /api/monitor/time — server's current ISO time + IANA timezone.
   *  Powers the topbar clock; falls back to local node time if the remote
   *  date command fails. */
  time: asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user;
    const executor = await resolveMonitorExecutor(user?.bridgeSessionId, { direct: sessionDirect(res) });
    let iso = new Date().toISOString();
    let tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    try {
      const result = await executor.exec(
        "printf '%s\\n%s' \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \"$(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || readlink /etc/localtime | sed 's|.*/zoneinfo/||' || echo UTC)\"",
      );
      const lines = result.stdout.trim().split(/\r?\n/);
      if (lines[0]) iso = lines[0];
      if (lines[1] && /^[A-Za-z_+\-0-9/]+$/.test(lines[1].trim())) tz = lines[1].trim();
    } catch {
      // Fall through with the panel-side defaults.
    }
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, data: { iso, tz } });
  }),

  /** GET /api/monitor/stats — quick stats for dashboard (server-only). */
  stats: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const isLocal = executor.target.id === LOCAL_TARGET_ID;

    let accounts = 0;
    try {
      const list = await readAccountsFromServer(executor);
      accounts = list.length;
    } catch {
      // Best-effort: leave accounts at 0 if remote read fails.
    }

    let users = 0;
    let memoryUsagePercent = "0.0";
    let cpuLoad1m = "0.00";
    let uptime = 0;

    if (isLocal) {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const loadAvg = os.loadavg();
      memoryUsagePercent = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);
      cpuLoad1m = loadAvg[0]?.toFixed(2) ?? "0.00";
      uptime = os.uptime();
    } else {
      try {
        const out = await executor.exec(quoteCmd("sh", [
          "-lc",
          "awk '/^MemTotal:/{t=$2}/^MemAvailable:/{a=$2}END{printf \"%.1f\\n\", (t>0?(t-a)/t*100:0)}' /proc/meminfo; awk '{print $1}' /proc/loadavg; awk '{print int($1)}' /proc/uptime",
        ]));
        const lines = out.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
        memoryUsagePercent = lines[0] ?? "0.0";
        cpuLoad1m = (Number(lines[1] ?? "0")).toFixed(2);
        uptime = Number.parseInt(lines[2] ?? "0", 10) || 0;
      } catch {
        // best-effort
      }
    }

    try {
      // MIN_REAL_UID from the SSOT (shared/system/users.ts). Intentional
      // divergence vs git-ssh.service.ts: NO upper bound and NO `$3==0` root
      // clause here — this counts interactive non-root login accounts only.
      const out = await executor.exec(quoteCmd("sh", ["-lc", `getent passwd | awk -F: '$3>=${MIN_REAL_UID} && $7!~/nologin|false/ {c++} END{print c+0}'`]));
      users = Number.parseInt(out.stdout.trim(), 10) || 0;
    } catch {
      // best-effort
    }

    res.json({
      ok: true,
      data: { accounts, users, memoryUsagePercent, cpuLoad1m, uptime },
    });
  }),

  /**
   * GET /api/monitor/history — historical snapshots.
   * Query: ?range=1h|6h|24h|7d  (default: 1h)
   *        ?from=<ms>&to=<ms>   (explicit window, used for period comparison;
   *                              takes precedence over `range` when both valid)
   */
  history: asyncHandler(async (req: Request, res: Response) => {
    const rangeStr = String(req.query["range"] || "1h");
    const rangeMap: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };
    const rangeMs = rangeMap[rangeStr] ?? rangeMap["1h"]!;

    // Explicit window (period comparison). Both must be finite and ordered;
    // otherwise fall back to the range preset ending now.
    const fromRaw = Number.parseInt(String(req.query["from"] ?? ""), 10);
    const toRaw = Number.parseInt(String(req.query["to"] ?? ""), 10);
    const hasWindow = Number.isFinite(fromRaw) && Number.isFinite(toRaw) && toRaw > fromRaw;
    const fromTs = hasWindow ? fromRaw : Date.now() - rangeMs;
    const toTs = hasWindow ? toRaw : Date.now();

    const user = res.locals.user;
    const executor = await resolveMonitorExecutor(user?.bridgeSessionId, { direct: sessionDirect(res) });
    const scope = executor.target.id;
    if (scope !== "local") {
      try {
        await statsCollectorService.collectWithExecutorCached(executor, scope);
      } catch {
        // Keep serving whatever history we already have for this target.
      }
    }

    const snapshots = await statsCollectorService.getHistory(fromTs, toTs, scope);
    if (req.query["resolution"] === "chart") {
      res.json({ ok: true, range: rangeStr, data: buildHistoryChart(snapshots, fromTs, toTs) });
      return;
    }
    res.json({ ok: true, range: rangeStr, data: sampleHistory(snapshots), totalSamples: snapshots.length });
  }),

  /** GET /api/monitor/processes — list top processes by CPU or memory. */
  processes: asyncHandler(async (req: Request, res: Response) => {
    const executor = await resolveMonitorExecutor(res.locals.user?.bridgeSessionId, { direct: sessionDirect(res) });
    const sortBy = String(req.query["sortBy"] || "cpu");
    const { limit } = parsePageQuery(req.query, { defaultLimit: 20, maxLimit: 100 });

    // ISOLATION (fail-closed): a REMOTE target that returns an empty list is
    // served as-is — NEVER back-filled from the panel host's `localExecutor`.
    // The old fallback leaked the panel host's processes under the target's
    // session (cross-tenant, CLAUDE.md). An empty list is either the degraded
    // bridge state (loadProcessesWithExecutor already returns [] on a bridge
    // error) or a genuinely idle target; both are the target's own truth.
    const processes = await loadProcessesWithExecutor(executor, sortBy, limit);

    res.json({ ok: true, data: { processes } });
  }),

  /**
   * GET /api/monitor/snapshot — latest StatsSnapshot (same shape as SSE "stats" events).
   * Collected from in-memory cache (no Redis required). Used as HTTP polling fallback.
   */
  snapshot: asyncHandler(async (_req: Request, res: Response) => {
    const executor = await resolveMonitorExecutor(res.locals.user?.bridgeSessionId, { direct: sessionDirect(res) });
    const scope = executor.target.id;
    const snap = scope === "local"
      ? (statsCollectorService.getLatest(scope) ?? await systemStatsService.collect())
      : await statsCollectorService.collectWithExecutorCached(executor, scope);
    res.json({ ok: true, data: snap });
  }),

  /**
   * POST /api/monitor/processes/:pid/kill — send SIGTERM (or SIGKILL on
   * retry) to a process. Protected processes (init, kernel threads, sshd,
   * the panel itself, etc.) are refused so a click can't take the server
   * offline.
   */
  killProcess: asyncHandler(async (req: Request, res: Response) => {
    const pid = Number.parseInt(String(req.params["pid"] ?? ""), 10);
    if (!Number.isInteger(pid) || pid <= 1) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "invalidProcessId") });
      return;
    }
    const force = String(req.query["force"] ?? "0") === "1";

    const executor = await resolveMonitorExecutor(res.locals.user?.bridgeSessionId, { direct: sessionDirect(res) });

    // Resolve the process command via /proc to make the decision based on the
    // actual binary rather than user-supplied label. comm = short name (15
    // chars max), cmdline = full argv joined by NUL.
    let comm = "";
    let cmdline = "";
    let procOwner = "";
    try {
      // Pull comm, cmdline AND the process owner (via `ps -o user= -p`) so we
      // can authorize the action below.
      const out = await executor.exec(
        quoteCmd("sh", ["-lc", `cat /proc/${pid}/comm 2>/dev/null; echo "---"; tr '\\0' ' ' < /proc/${pid}/cmdline 2>/dev/null; echo "---"; ps -o user= -p ${pid} 2>/dev/null`]),
        { timeoutMs: 5_000 },
      );
      const [commPart, cmdPart, userPart] = out.stdout.split("---\n");
      comm = (commPart ?? "").trim();
      cmdline = (cmdPart ?? "").trim();
      procOwner = (userPart ?? "").trim();
    } catch {
      // Fall through — empty comm means the process is already gone or we
      // can't read /proc. Either way we don't proceed.
    }

    if (!comm) {
      res.status(404).json({ ok: false, error: apiModuleMessage(res.locals.locale, "processUnavailable") });
      return;
    }

    // Role-based authorization: admins can kill any non-protected process;
    // regular users can only kill processes running under their own Linux
    // username. The session.user.username is the Linux account name in this
    // panel (it ties the SSH bridge / passkey flow to a real OS user).
    const sessionUser = res.locals.user;
    const isAdmin = sessionUser?.kind === "admin";
    const requesterName = String(sessionUser?.username ?? "").trim();
    if (!isAdmin) {
      if (!procOwner) {
        res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "processOwnerUnknown") });
        return;
      }
      if (!requesterName || procOwner !== requesterName) {
        res.status(403).json({
          ok: false,
          error: apiModuleMessage(res.locals.locale, "processNotOwned").replace("{owner}", () => procOwner),
          code: "NOT_OWNER",
        });
        return;
      }
    }

    // Hard block on names that would brick the box if terminated. The list
    // is conservative: anything that systemd, the kernel, ssh, the panel
    // backend itself, or the proxy bridge depends on stays untouchable.
    const protectedNames = new Set([
      "systemd", "init", "kthreadd", "ksoftirqd", "kworker", "migration",
      "rcu_sched", "rcu_bh", "watchdog", "khungtaskd", "kswapd",
      "sshd", "systemd-journal", "systemd-logind", "systemd-udevd",
      "dbus-daemon", "dbus-broker", "agetty",
      "node",     // panel runtime
      "pm2",      // process manager
      "nginx",    // reverse proxy
    ]);
    const lcComm = comm.toLowerCase();
    const isKernelThread = cmdline === "" || (lcComm.startsWith("k") && /\[.*\]/.test(cmdline));
    if (isKernelThread || protectedNames.has(lcComm)) {
      res.status(403).json({
        ok: false,
        error: apiModuleMessage(res.locals.locale, "processProtected").replace("{name}", () => comm),
        code: "PROTECTED_PROCESS",
      });
      return;
    }

    const signal = force ? "KILL" : "TERM";
    try {
      await executor.exec(quoteCmd("kill", [`-${signal}`, String(pid)]), { timeoutMs: 5_000 });
      res.json({ ok: true, data: { pid, signal, comm } });
    } catch (err) {
      // Do NOT echo raw err.message to the client — it can contain command
      // output / stderr with sensitive info. Log server-side; client gets a
      // generic localized message.
      log.error({ err, pid, signal, comm }, "kill process failed");
      throw new AppError(apiModuleMessage(res.locals.locale, "processKillFailed"), 500, "KILL_FAILED");
    }
  }),

  /** GET /api/monitor/services — check status of key services. */
  services: asyncHandler(async (_req: Request, res: Response) => {
    const executor = await resolveMonitorExecutor(res.locals.user?.bridgeSessionId, { direct: sessionDirect(res) });
    // ISOLATION (fail-closed): a REMOTE target whose services all read inactive
    // is served as-is — NEVER back-filled from the panel host's `localExecutor`
    // (that leaked the panel host's service status under the target's session,
    // cross-tenant, CLAUDE.md). `loadServicesWithExecutor` already degrades a
    // bridge error to an all-inactive list for this target's scope.
    const results = await loadServicesWithExecutor(executor);
    res.json({ ok: true, data: results });
  }),

  /**
   * POST /api/monitor/services/:name/start — enable + start an installed
   * service. Idempotent (`systemctl enable --now`). Returns
   * `SUDO_PASSWORD_REQUIRED`/`INVALID` codes so the client can prompt.
   */
  startService: asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.params["name"] ?? "");
    const known = KNOWN_SERVICE_BY_UNIT.get(name);
    if (!known) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "unknownService").replace("{name}", () => name) });
      return;
    }

    const body = (req.body ?? {}) as { sudoPassword?: string };
    const sudoPassword = typeof body.sudoPassword === "string" ? body.sudoPassword : undefined;
    const executor = await resolveMonitorExecutor(res.locals.user?.bridgeSessionId, { direct: sessionDirect(res) });

    const result = await packageInstaller.enableUnit(executor, known.unit, { sudoPassword });
    // Invalidate the cached status so the next poll reflects the change.
    servicesCacheByScope.delete(executor.target.id || LOCAL_TARGET_ID);

    if (!result.ok) {
      const status = result.code === SUDO_PASSWORD_REQUIRED ? 200 : 500;
      res.status(status).json({
        ok: false,
        code: result.code,
        error: result.output || `No se pudo activar ${known.label}.`,
      });
      return;
    }
    res.json({ ok: true, data: { name: known.unit } });
  }),

  /**
   * POST /api/monitor/services/:name/install — install the package(s) that
   * provide a service on the target VPS, then enable + start the unit.
   */
  installService: asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.params["name"] ?? "");
    const known = KNOWN_SERVICE_BY_UNIT.get(name);
    if (!known) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "unknownService").replace("{name}", () => name) });
      return;
    }
    if (!known.pkg) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "systemServiceInstallDenied").replace("{name}", () => known.label) });
      return;
    }

    const body = (req.body ?? {}) as { sudoPassword?: string };
    const sudoPassword = typeof body.sudoPassword === "string" ? body.sudoPassword : undefined;
    const executor = await resolveMonitorExecutor(res.locals.user?.bridgeSessionId, { direct: sessionDirect(res) });

    const install = await packageInstaller.install(executor, known.pkg, { sudoPassword });
    servicesCacheByScope.delete(executor.target.id || LOCAL_TARGET_ID);

    if (!install.ok) {
      const status = install.code === SUDO_PASSWORD_REQUIRED ? 200 : 500;
      res.status(status).json({
        ok: false,
        code: install.code,
        error: install.output || `No se pudo instalar ${known.label}.`,
      });
      return;
    }

    // Best-effort: bring the freshly installed unit up. A failure here is not
    // fatal — the package is installed and the next poll will show it stopped.
    const enable = await packageInstaller.enableUnit(executor, known.unit, { sudoPassword });
    servicesCacheByScope.delete(executor.target.id || LOCAL_TARGET_ID);

    res.json({
      ok: true,
      data: { name: known.unit, packages: install.packages, started: enable.ok },
    });
  }),
};
