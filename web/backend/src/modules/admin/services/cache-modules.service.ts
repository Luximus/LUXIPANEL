import { invalidateCacheSchedule } from "../../../shared/remote-cache/schedule.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * cache-modules.service.ts — reads/writes the per-target cache-engine
 * schedule and exposes the cost panel data for "Ajustes → Módulos".
 *
 * Sources (all on the customer's server, read via the per-request Executor):
 *   * `${LUXIPANEL_CONFIG_DIR}/cache-engine/schedule.json`
 *       { "<module>/<collection>": { enabled, intervalSeconds } }
 *   * `${LUXIPANEL_CONFIG_DIR}/cache-engine/state/<m>__<c>.stat`
 *       per-entry metrics last written by the engine
 *
 * The cacheable allowlist (`cacheable-modules.ts`) supplies the universe of
 * configurable rows and the policy defaults. We never expose volatile
 * modules here — they are not even loadable into the registry, so the API
 * is structurally safe.
 *
 * Persisting an updated `schedule.json` is enough to apply changes: the
 * client-side dispatcher reads it on every tick (60s timer or cron) and
 * adapts intervals/enable flags. No timer reload is needed.
 */

import { z } from "zod";

import { panelConfigDir } from "@config/paths.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { listCacheableCollections } from "../../../shared/cache/cacheable-modules.js";
import {
  remoteCacheStatsSnapshot,
  invalidateRemoteCacheConn,
} from "../../../shared/remote-cache/index.js";
import { scheduleRefresh } from "../../../shared/remote-cache/refresh.js";
import type { Executor, SftpBatchOperation } from "../../../shared/executor/types.js";
import { quoteArg, quoteCmd } from "../../../shared/executor/quote.js";
import { moduleRegistryService } from "./module-registry.service.js";
import { runWithExecutor } from "../../../shared/executor/index.js";
import { createTargetTtlCache } from "./target-ttl-cache.js";

const log = createModuleLogger("cache-modules");

const MIN_INTERVAL_SECONDS = 30;
const MAX_INTERVAL_SECONDS = 86_400;

function baseDir(): string {
  return panelConfigDir();
}
function schedulePath(): string {
  return `${baseDir()}/cache-engine/schedule.json`;
}
function statePath(module: string, collection: string): string {
  return `${baseDir()}/cache-engine/state/${module}__${collection}.stat`;
}
function lastStampPath(module: string, collection: string): string {
  return `${baseDir()}/cache-engine/state/${module}__${collection}.last`;
}
function entryKey(module: string, collection: string): string {
  return `${module}/${collection}`;
}

export interface ScheduleEntry {
  enabled: boolean;
  intervalSeconds: number;
}
export type ScheduleFile = Record<string, ScheduleEntry>;

const scheduleEntrySchema = z.object({
  enabled: z.boolean().default(true),
  intervalSeconds: z
    .number()
    .int()
    .min(MIN_INTERVAL_SECONDS)
    .max(MAX_INTERVAL_SECONDS),
});

const scheduleFileSchema = z.record(z.string(), scheduleEntrySchema);

export const updateEntryInputSchema = z.object({
  // `enabled` ya no se acepta: deriva del módulo padre (ver
  // moduleRegistryService.getEnabledMap). El UI muestra un badge,
  // no un toggle. Solo `intervalSeconds` es editable por entrada.
  intervalSeconds: z.coerce
    .number()
    .int()
    .min(MIN_INTERVAL_SECONDS)
    .max(MAX_INTERVAL_SECONDS),
});

async function readJson<T>(executor: Executor, path: string): Promise<T | null> {
  try {
    const data = await executor.readFile(path, "utf-8");
    const text = typeof data === "string" ? data : data.toString("utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function readSchedule(executor: Executor): Promise<ScheduleFile> {
  const raw = await readJson<unknown>(executor, schedulePath());
  if (!raw) return {};
  const parsed = scheduleFileSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

async function writeSchedule(executor: Executor, next: ScheduleFile): Promise<void> {
  const text = JSON.stringify(next);
  const path = schedulePath();
  const dir = `${baseDir()}/cache-engine`;
  const quotedPath = quoteArg(path);

  // Same pattern as kv-store's writeRawCreate: try the fast SFTP path first
  // (one round-trip), then fall back through sudo and shell write. The
  // cache-engine dir may not exist yet on a server whose cache stack has
  // not been provisioned — the user can still edit the schedule here, and
  // `install-engines.sh` will respect the pre-existing file when it runs.
  if (executor.batchSftp) {
    try {
      const results = await executor.batchSftp([
        { id: "mk", op: "mkdir", path: dir, recursive: true },
        { id: "w", op: "writeFile", path, data: text },
      ]);
      const wrote = results.find((r) => r.id === "w");
      if (wrote?.ok) {
        try {
          await executor.exec(`chmod 600 ${quotedPath}`);
        } catch {
          /* perms inherit from dir umask — non-fatal */
        }
        return;
      }
    } catch {
      /* fall through */
    }
  }

  // Per-op fallback: ensure dir (sudo if needed), then write via shell on a
  // single line (no heredoc — LP `/api/agents/exec` rejects control
  // characters in the command string). Same shape kv-store uses for its
  // SFTP-EPERM fallback. `text` is a compact JSON (no embedded newlines).
  try {
    await executor.exec(quoteCmd("mkdir", ["-p", dir]));
  } catch {
    await executor.exec(quoteCmd("sudo", ["-n", "mkdir", "-p", dir]));
  }
  try {
    await executor.writeFile(path, text, { encoding: "utf-8" });
  } catch {
    const writeCmd = `printf '%s' ${quoteArg(text)} > ${quotedPath}`;
    try {
      await executor.exec(quoteCmd("sh", ["-lc", writeCmd]));
    } catch {
      await executor.exec(quoteCmd("sudo", ["-n", "sh", "-lc", writeCmd]));
    }
  }
  try {
    await executor.exec(quoteCmd("chmod", ["600", path]));
  } catch {
    await executor.exec(quoteCmd("sudo", ["-n", "chmod", "600", path])).catch(() => undefined);
  }
}

interface EngineStat {
  module?: string;
  collection?: string;
  version?: string;
  count?: number;
  changed?: boolean;
  ok?: boolean;
  bytes?: number;
  durationMs?: number;
  wallMs?: number;
}

async function readStat(
  executor: Executor,
  module: string,
  collection: string,
): Promise<EngineStat | null> {
  return readJson<EngineStat>(executor, statePath(module, collection));
}

async function readLastTimestamp(
  executor: Executor,
  module: string,
  collection: string,
): Promise<number | null> {
  try {
    const data = await executor.readFile(lastStampPath(module, collection), "utf-8");
    const text = typeof data === "string" ? data : data.toString("utf-8");
    const n = Number(text.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ── public API ───────────────────────────────────────────────────────────

export interface CacheModuleRow {
  module: string;
  collection: string;
  source: "sidecar-mirror" | "system-collector";
  collector?: string;
  projection?: readonly string[];
  defaultIntervalSeconds: number;
  /** Effective on/off (defaults to true if absent from schedule). */
  enabled: boolean;
  /** Effective interval (falls back to policy default). */
  intervalSeconds: number;
  /** Last successful engine collection (unix seconds), null if never. */
  lastCollectedAt: number | null;
  /** Last engine stat snapshot, null if never collected. */
  engineStat: EngineStat | null;
  /** Panel-side counters for the (target,module,collection). */
  panelMetrics: {
    hitRatio: number;
    avgDurationMs: number;
    counts: Record<string, number>;
    lastOutcome: string | null;
    observed: number;
  };
}

function parseEngineStat(text: string): EngineStat | null {
  try {
    return JSON.parse(text) as EngineStat;
  } catch {
    return null;
  }
}

function parseTimestamp(text: string): number | null {
  const n = Number(text.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function readAllSidecarsBatched(
  executor: Executor,
  policy: ReturnType<typeof listCacheableCollections>,
): Promise<{
  schedule: ScheduleFile;
  stats: Map<string, EngineStat | null>;
  timestamps: Map<string, number | null>;
}> {
  // 1 round-trip SSH para TODOS los sidecars vía batchSftp. Antes esto
  // hacía 1 + 2N readFile secuenciales/paralelos (~37 round-trips para
  // 18 collections) → la UI quedaba colgada 3-8s. Con batch: ~50-200ms.
  const ops: SftpBatchOperation[] = [{ id: "sched", op: "readFile", path: schedulePath(), encoding: "utf-8" }];
  for (const e of policy) {
    const key = `${e.module}/${e.collection}`;
    ops.push({ id: `stat:${key}`, op: "readFile", path: statePath(e.module, e.collection), encoding: "utf-8" });
    ops.push({ id: `ts:${key}`,   op: "readFile", path: lastStampPath(e.module, e.collection), encoding: "utf-8" });
  }

  const stats = new Map<string, EngineStat | null>();
  const timestamps = new Map<string, number | null>();
  let schedule: ScheduleFile = {};

  if (executor.batchSftp) {
    const results = await executor.batchSftp(ops);
    for (const r of results) {
      const text = r.ok && typeof r.data === "string" ? r.data : null;
      if (r.id === "sched") {
        if (text) {
          try {
            const parsed = scheduleFileSchema.safeParse(JSON.parse(text));
            if (parsed.success) schedule = parsed.data;
          } catch { /* keep empty schedule */ }
        }
      } else if (r.id.startsWith("stat:")) {
        stats.set(r.id.slice(5), text ? parseEngineStat(text) : null);
      } else if (r.id.startsWith("ts:")) {
        timestamps.set(r.id.slice(3), text ? parseTimestamp(text) : null);
      }
    }
  } else {
    // Fallback: paralelo con readFile individual.
    schedule = await readSchedule(executor);
    await Promise.all(policy.map(async (e) => {
      const key = `${e.module}/${e.collection}`;
      const [s, t] = await Promise.all([
        readStat(executor, e.module, e.collection),
        readLastTimestamp(executor, e.module, e.collection),
      ]);
      stats.set(key, s);
      timestamps.set(key, t);
    }));
  }
  return { schedule, stats, timestamps };
}

// TTL cache por target — Ajustes→Módulos no necesita data en tiempo real
// (el aviso de la propia UI dice "≤60s" para que el dispatcher recoja
// cambios). Sirve para amortiguar refrescos del usuario y para que un F5
// rápido no re-pague el costo SFTP. update() invalida el target afectado.
const ROWS_TTL_MS = 15_000;
const rowsCache = createTargetTtlCache<CacheModuleRow[]>(ROWS_TTL_MS);

function invalidateCacheModulesCache(targetId: string): void {
  rowsCache.invalidate(targetId);
}

// Map cacheable-module id → catalog id (los slugs no siempre coinciden):
//   - `backup` (cacheable singular) → `backups` (catalog plural).
//   - `nginx` (real nombre) → `dns` (catalog slug legacy preservado por
//     compatibilidad de licencia, ver memoria luxipanel-dns-module-renamed-nginx).
// Sin esta tabla, moduleEnabledMap[cacheableId] retornaría undefined y el
// código caía al default `true` → desactivar "backups"/"DNS" en
// /panel/modules NO apagaba sus colecciones (bug reportado 2026-05-20).
const CACHEABLE_TO_CATALOG_ID: Record<string, string> = {
  backup: "backups",
  nginx: "dns",
};

function resolveCatalogId(cacheableId: string): string {
  return CACHEABLE_TO_CATALOG_ID[cacheableId] ?? cacheableId;
}

// Inverso: dado el catalogId que se acaba de toggle en /panel/modules,
// devolver el cacheable-module id correspondiente (si existe).
const CATALOG_TO_CACHEABLE_ID: Record<string, string> = Object.fromEntries(
  Object.entries(CACHEABLE_TO_CATALOG_ID).map(([k, v]) => [v, k]),
);
function resolveCacheableId(catalogId: string): string {
  return CATALOG_TO_CACHEABLE_ID[catalogId] ?? catalogId;
}

async function buildRows(executor: Executor): Promise<CacheModuleRow[]> {
  const targetId = executor.target.id;
  const cached = rowsCache.get(targetId);
  if (cached !== undefined) return cached;

  const policy = listCacheableCollections();
  // La activación y los sidecars pertenecen al mismo servidor conectado.
  const [
    { schedule, stats, timestamps },
    moduleEnabledMap,
  ] = await Promise.all([
    readAllSidecarsBatched(executor, policy),
    runWithExecutor(executor, () => moduleRegistryService.getEnabledMap()),
  ]);
  const allPanel = remoteCacheStatsSnapshot(targetId);
  const panelByKey = new Map<string, (typeof allPanel)[number]>();
  for (const s of allPanel) {
    panelByKey.set(`${s.module}/${s.collection}`, s);
  }

  const rows: CacheModuleRow[] = policy.map((entry) => {
    const key = entryKey(entry.module, entry.collection);
    const sched = schedule[key];
    // `enabled` DERIVA del estado del módulo padre. resolveCatalogId mapea
    // el id de cacheable (puede no coincidir con el slug del catálogo, p.ej.
    // backup→backups, nginx→dns). Si moduleEnabledMap no lo lista (módulo
    // sin entry en registry, p.ej. "admin"), default = true.
    const moduleEnabled = moduleEnabledMap[resolveCatalogId(entry.module)];
    const enabled = moduleEnabled === undefined ? true : moduleEnabled;
    const intervalSeconds = sched?.intervalSeconds ?? entry.policy.defaultIntervalSeconds;
    const panel = panelByKey.get(key);
    return {
      module: entry.module,
      collection: entry.collection,
      source: entry.policy.source,
      collector: entry.policy.collector,
      projection: entry.policy.projection,
      defaultIntervalSeconds: entry.policy.defaultIntervalSeconds,
      enabled,
      intervalSeconds,
      lastCollectedAt: timestamps.get(key) ?? null,
      engineStat: stats.get(key) ?? null,
      panelMetrics: {
        hitRatio: panel?.hitRatio ?? 0,
        avgDurationMs: panel?.avgDurationMs ?? 0,
        counts: panel?.counts ?? {},
        lastOutcome: panel?.lastOutcome ?? null,
        observed: panel?.observed ?? 0,
      },
    } satisfies CacheModuleRow;
  });

  rowsCache.set(targetId, rows);
  return rows;
}

/**
 * Aplica el estado enabled/disabled de un módulo a TODAS sus colecciones
 * en schedule.json del target conectado. Llamado por PATCH
 * /admin/modules/:id para que el dispatcher remoto pare/arranque la
 * recolección cuando el operador toggle el módulo en /panel/modules.
 */
export async function applyModuleEnablementToSchedule(
  executor: Executor,
  moduleId: string,
  enabled: boolean,
): Promise<void> {
  // moduleId viene del catálogo (PATCH /admin/modules/:id usa catalog ids
  // como "backups", "dns"). Resolver al cacheable id (singular/real)
  // antes de buscar entradas.
  const cacheableId = resolveCacheableId(moduleId);
  const entries = listCacheableCollections().filter((e) => e.module === cacheableId);
  if (entries.length === 0) return; // módulo sin colecciones cacheables — nada que hacer
  const current = await readSchedule(executor);
  let changed = false;
  const next: ScheduleFile = { ...current };
  for (const entry of entries) {
    const key = entryKey(entry.module, entry.collection);
    const prev = current[key];
    const intervalSeconds = prev?.intervalSeconds ?? entry.policy.defaultIntervalSeconds;
    if (prev?.enabled === enabled && prev?.intervalSeconds === intervalSeconds) continue;
    next[key] = { enabled, intervalSeconds };
    changed = true;
  }
  if (!changed) return;
  await writeSchedule(executor, next);
  invalidateCacheSchedule(executor.target.id);
  invalidateCacheModulesCache(executor.target.id);
  log.info({ targetId: executor.target.id, moduleId, enabled, count: entries.length },
    "module enablement propagated to cache-engine schedule");
  // Kick dispatcher para aplicar de inmediato.
  void executor.exec(
    "systemctl start luxipanel-cache-engine.service 2>/dev/null || true",
  ).catch(() => undefined);
  if (enabled) {
    // Al re-habilitar, dispara un re-collect inmediato por colección.
    for (const entry of entries) {
      void scheduleRefresh(executor, entry.module, entry.collection);
    }
  }
}

export const cacheModulesService = {
  /** GET — list all cacheable entries enriched with schedule + cost. */
  async list(executor: Executor): Promise<CacheModuleRow[]> {
    return buildRows(executor);
  },

  /** PUT — update one entry's enabled/interval, persist `schedule.json`,
   *  and (when newly enabled / interval shortened) ask the dispatcher to
   *  re-collect that entry now so the user sees fresh data immediately. */
  async update(
    executor: Executor,
    module: string,
    collection: string,
    patch: z.infer<typeof updateEntryInputSchema>,
  ): Promise<CacheModuleRow> {
    const policy = listCacheableCollections().find(
      (e) => e.module === module && e.collection === collection,
    );
    if (!policy) {
      throw new Error(`module/collection "${module}/${collection}" is not cacheable`);
    }
    const current = await readSchedule(executor);
    const previous = current[entryKey(module, collection)];
    // `enabled` deriva del estado del módulo padre — la entrada en
    // schedule.json se mantiene sincronizada (set/cleared en el handler
    // PATCH /admin/modules/:id, ver applyModuleEnablementToSchedule).
    // Aquí solo movemos intervalSeconds; preservamos `enabled` previo.
    const next: ScheduleFile = {
      ...current,
      [entryKey(module, collection)]: {
        enabled: previous?.enabled ?? true,
        intervalSeconds: patch.intervalSeconds,
      },
    };
    await writeSchedule(executor, next);
  invalidateCacheSchedule(executor.target.id);
    log.info(
      { targetId: executor.target.id, module, collection, patch },
      "cache-engine schedule updated",
    );

    // Trigger the dispatcher RIGHT NOW so the schedule change applies
    // immediately instead of waiting up to 60s for the next systemd-timer
    // tick. Fire-and-forget; failure is fine — the timer will catch up.
    void executor.exec(
      "systemctl start luxipanel-cache-engine.service 2>/dev/null || true",
    ).catch(() => undefined);

    // If interval shortened, kick an immediate per-entry re-collect so
    // the change is visible right away.
    const intervalShortened =
      previous && previous.enabled && patch.intervalSeconds < previous.intervalSeconds;
    if (intervalShortened) {
      void scheduleRefresh(executor, module, collection);
    }
    // The panel-local conn.json memo doesn't track schedule, but reads
    // ride on it — drop it defensively so the next nav doesn't reuse stale
    // assumptions.
    invalidateRemoteCacheConn(executor.target.id);
    // Invalidar el cache TTL de buildRows para que el siguiente list()
    // refleje el cambio inmediatamente en vez de servir snapshot viejo.
    invalidateCacheModulesCache(executor.target.id);

    const rows = await buildRows(executor);
    return rows.find((r) => r.module === module && r.collection === collection)!;
  },
};
