import { readVersioned } from "./versioned-read.js";
import { cacheScheduleEntry } from "./schedule.js";
import { localCacheMget } from "./local-client.js";
import { getContextUser } from "../executor/context.js";
import { isHostingSession } from "../tenant/tenant-scope.js";
import { PrivilegeDropExecutor } from "../executor/privilege-drop-executor.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache — read-through view of the per-target cache Redis
 * that lives ON the customer's server (fed by the client-side engines, Hito
 * 2/3). This module is the LUXIPANEL panel-side reader: it asks
 * `redis-cli` over the existing `/api/agents/exec` contract (no contract
 * change) and returns the precomputed DataTable payload.
 *
 * Properties (every one of them is a correctness/perf invariant):
 *   * **Fail-open everywhere.** A missing `conn.json`, a Redis hiccup, an
 *     exec timeout, a parse error or an open breaker → returns `null`; the
 *     caller stays on the legacy JSON path. The panel NEVER goes down
 *     because the cache is unhealthy.
 *   * **Per-target circuit breaker.** N consecutive failures trip the
 *     breaker for M ms, so a broken target doesn't burn SSH/exec budget on
 *     every request.
 *   * **Panel-local meta layer (metadata ONLY).** A tiny
 *     `{version,count,collectedAt}` entry per `target.id` lives in the
 *     panel's own Redis with a short TTL. The blob itself NEVER touches the
 *     panel host — it stays on the customer's server. This respects the
 *     strict per-server isolation rule while cutting most refetches.
 *   * **Single exec round-trip** for meta + payload (commands piped to one
 *     `redis-cli`), with strict timeout.
 *   * **Stale-while-revalidate.** While `collectedAt` is within
 *     REMOTE_CACHE_FRESH_SECONDS the page is "fresh"; up to
 *     REMOTE_CACHE_VERY_STALE_SECONDS it is still served (marked stale, the
 *     engine refreshes on its own schedule); beyond that we fail open.
 *   * **Aislamiento estricto:** keys are namespaced by `target.id` on the
 *     panel side and naturally isolated by the per-server Redis instance on
 *     the client side. Cross-server reads are structurally impossible.
 */

import { env } from "../../config/env.js";
import { createModuleLogger } from "../logger/index.js";
import { getRedis } from "../redis/index.js";
import { eventBus, Events } from "../events/index.js";
import type { Executor } from "../executor/types.js";

import { gunzipB64 } from "./codec.js";
import { getRemoteCacheConn, type RemoteCacheConn } from "./conn.js";
import { escapeSingleQuoted, execWithRedisAuth, isRedisNil, redisBase } from "./redis-cli.js";
import { panelMetaKey, RC_KEY_PREFIX, scopeSuffix } from "./keys.js";
import { recordCacheOutcome, type CacheOutcome } from "./metrics.js";
import { errMessage } from "../utils/err-message.js";

export { invalidateRemoteCacheConn } from "./conn.js";
export { snapshot as remoteCacheStatsSnapshot } from "./metrics.js";

const log = createModuleLogger("remote-cache");

// Mirrors the engine-side constant in scripts/remote/engines/common.py.
const KEY_PREFIX = RC_KEY_PREFIX;

export interface CacheMeta {
  state?: "stale";
  failedAt?: number;
  schemaVersion: number;
  version: string;
  count: number;
  collectedAt: number;
  source: "sidecar-mirror" | "system-collector" | string;
  pageSizes: number[];
  pages: Record<string, number>;
}

export interface CachedView<T = unknown> {
  rows: T[];
  meta: CacheMeta;
  freshness: "fresh" | "stale";
}

// ── circuit breaker ──────────────────────────────────────────────────────
interface BreakerState {
  failures: number;
  openedAt: number;
}
const breaker = new Map<string, BreakerState>();

function isOpen(targetId: string): boolean {
  const s = breaker.get(targetId);
  if (!s) return false;
  if (s.failures < env.REMOTE_CACHE_BREAKER_THRESHOLD) return false;
  if (Date.now() - s.openedAt < env.REMOTE_CACHE_BREAKER_OPEN_MS) return true;
  // Half-open: clear and let the next call attempt.
  breaker.delete(targetId);
  return false;
}

function trackOk(targetId: string): void {
  breaker.delete(targetId);
}

function trackFailure(targetId: string): void {
  const s = breaker.get(targetId) ?? { failures: 0, openedAt: 0 };
  s.failures += 1;
  if (s.failures >= env.REMOTE_CACHE_BREAKER_THRESHOLD && s.openedAt === 0) {
    s.openedAt = Date.now();
    log.warn(
      { targetId, failures: s.failures },
      "remote-cache breaker tripped open",
    );
    // Surface a one-shot notification: repeated query failures against the
    // per-server cache (problems "para consultar"). Fired only on the
    // open transition, not on every failure.
    eventBus.emit(Events.REMOTE_CACHE_BREAKER_OPEN, {
      targetId,
      failures: s.failures,
    });
  }
  breaker.set(targetId, s);
}

// ── panel-local meta cache (metadata-only — no tenant payload here) ──────
interface PanelMetaEntry {
  version: string;
  count: number;
  collectedAt: number;
}

async function writePanelMeta(
  targetId: string,
  module: string,
  collection: string,
  meta: CacheMeta,
  scope?: string,
): Promise<void> {
  try {
    const r = getRedis();
    const entry: PanelMetaEntry = {
      version: meta.version,
      count: meta.count,
      collectedAt: meta.collectedAt,
    };
    await r.set(
      panelMetaKey(targetId, module, collection, scope),
      JSON.stringify(entry),
      "EX",
      env.REMOTE_CACHE_PANEL_META_TTL_SECONDS,
    );
  } catch {
    // Panel Redis hiccup: best-effort, never block the read.
  }
}

// ── in-memory blob memo (keyed by version) ───────────────────────────────
// Bounded by BYTES and AGE, not just entry count: each value is a whole
// projected collection (potentially many MB) across several targets, so a plain
// 256-entry cap could pin hundreds of MB in heap indefinitely (`insertedAt` was
// stored but never used → no expiry). We track an approximate byte size per
// entry, evict LRU until under the byte budget, and skip stale entries on read.
const BLOB_CACHE_LIMIT = 256;
const BLOB_CACHE_MAX_BYTES = 64 * 1024 * 1024; // 64 MiB total across all entries
const BLOB_CACHE_TTL_MS = 10 * 60_000; // entries expire after 10 min
const blobMemo = new Map<string, { value: unknown[]; insertedAt: number; bytes: number }>();
let blobMemoBytes = 0;

function memoKey(
  targetId: string,
  module: string,
  collection: string,
  version: string,
  pageSlot: string,
): string {
  return `${targetId}|${module}|${collection}|${version}|${pageSlot}`;
}

/** Cheap byte estimate of a projected collection (UTF-16 code units ≈ 2 bytes,
 *  but JSON length is a good-enough proxy; avoids a full re-encode per set). */
function estimateBytes(value: unknown[]): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function memoDelete(k: string): void {
  const hit = blobMemo.get(k);
  if (!hit) return;
  blobMemoBytes -= hit.bytes;
  blobMemo.delete(k);
}

function memoGet(k: string): unknown[] | null {
  const hit = blobMemo.get(k);
  if (!hit) return null;
  // Expire by age (stale versions are never re-requested and would otherwise
  // linger until byte pressure evicts them).
  if (Date.now() - hit.insertedAt > BLOB_CACHE_TTL_MS) {
    memoDelete(k);
    return null;
  }
  // LRU bump
  blobMemo.delete(k);
  blobMemo.set(k, hit);
  return hit.value;
}

function memoSet(k: string, value: unknown[]): void {
  memoDelete(k); // replace: drop the old byte accounting first
  const bytes = estimateBytes(value);
  blobMemo.set(k, { value, insertedAt: Date.now(), bytes });
  blobMemoBytes += bytes;
  // Evict LRU (Map iteration order = insertion order) until under BOTH caps.
  while (blobMemo.size > BLOB_CACHE_LIMIT || blobMemoBytes > BLOB_CACHE_MAX_BYTES) {
    const oldest = blobMemo.keys().next().value;
    if (oldest === undefined) break;
    if (oldest === k) break; // never evict the entry we just inserted
    memoDelete(oldest);
  }
}

// ── exec wrapper: GET meta + GET payload in one redis-cli round-trip ─────
function buildRedisCommand(
  conn: RemoteCacheConn,
  keys: string[],
): { shell: string } {
  const base = redisBase(conn);
  // Pipe the commands on stdin: each one prints its reply on its own line.
  // We separate replies with a sentinel line to be robust to "(nil)" / empty
  // bulk strings.
  const cmds = keys.map((k) => `GET ${k}`).join("\\n");
  // Single-quote the whole command block (escaping embedded quotes) instead of
  // raw-interpolating it. The keys embed `scopeSuffix(scope)`, and `scope`
  // originates from the caller (`serveCachedDataTable({ scope })`); an unescaped
  // single quote here would break out of the quoting and run arbitrary commands
  // over SSH. Every sibling path already uses escapeSingleQuoted — match it.
  const shell = `printf '%b' ${escapeSingleQuoted(cmds)} | ${base}`;
  return { shell };
}

function parseRedisOutput(stdout: string, expected: number): (string | null)[] {
  // redis-cli prints each reply on its own line (in non-TTY mode). bulk
  // strings come out as raw text + newline; nil comes out as "(nil)".
  const lines = stdout.split(/\r?\n/);
  // Drop trailing blank line if any.
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const out: (string | null)[] = [];
  for (let i = 0; i < expected; i++) {
    const raw = lines[i];
    if (raw === undefined || isRedisNil(raw)) {
      out.push(null);
    } else {
      out.push(raw);
    }
  }
  return out;
}

function decodeBlob(b64: string): unknown {
  // Engines write everything as gzip+base64; gunzip + JSON.parse.
  return JSON.parse(gunzipB64(b64));
}

interface FetchOutcome {
  meta: CacheMeta | null;
  payloadRaw: string | null;
}

async function fetchMetaAndPayload(
  executor: Executor,
  conn: RemoteCacheConn,
  metaKey: string,
  payloadKey: string,
): Promise<FetchOutcome | null> {
  if (executor.target.id === "local") {
    const [metaRaw, payloadRaw] = await localCacheMget(conn, [metaKey, payloadKey]);
    return {meta:metaRaw ? decodeBlob(metaRaw) as CacheMeta : null,payloadRaw:payloadRaw ?? null};
  }
  const { shell } = buildRedisCommand(conn, [metaKey, payloadKey]);
  const result = await Promise.race([
    execWithRedisAuth(executor, conn, shell, { timeoutMs: env.REMOTE_CACHE_EXEC_TIMEOUT_MS }),
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), env.REMOTE_CACHE_EXEC_TIMEOUT_MS + 250),
    ),
  ]);
  if (!result) return null;
  if (result.exitCode !== 0) return null;

  const [metaRaw, payloadRaw] = parseRedisOutput(result.stdout, 2);
  if (!metaRaw) return { meta: null, payloadRaw: null };
  let meta: CacheMeta | null;
  try {
    meta = decodeBlob(metaRaw) as CacheMeta;
  } catch {
    return null;
  }
  return { meta, payloadRaw: payloadRaw ?? null };
}

function classifyFreshness(meta: CacheMeta, intervalSeconds?: number): "fresh" | "stale" | "very-stale" {
  const ageSec = (Date.now() / 1000) - (meta.collectedAt ?? 0);
  const fresh = intervalSeconds ? intervalSeconds + 60 : env.REMOTE_CACHE_FRESH_SECONDS;
  const stale = intervalSeconds ? Math.max(fresh * 3, 180) : env.REMOTE_CACHE_VERY_STALE_SECONDS;
  if (ageSec < fresh && meta.state !== "stale") return "fresh";
  if (ageSec < stale) return "stale";
  return "very-stale";
}

function metaKey(module: string, collection: string, scope?: string): string {
  return `${KEY_PREFIX}:${module}:${collection}${scopeSuffix(scope)}:meta`;
}

function fullKey(module: string, collection: string, scope?: string): string {
  return `${KEY_PREFIX}:${module}:${collection}${scopeSuffix(scope)}:full`;
}

// ── public API ───────────────────────────────────────────────────────────

async function getCached<T>(
  executor: Executor,
  module: string,
  collection: string,
  payloadKeyName: string,
  pageSlot: string,
  scope?: string,
): Promise<CachedView<T> | null> {
  // Cache projections are administrative; tenants must read through their scoped executor.
  if (isHostingSession(getContextUser() ?? undefined) || executor instanceof PrivilegeDropExecutor) return null;
  const schedule = await cacheScheduleEntry(executor, module, collection);
  if (!schedule.enabled) return null;
  const targetId = executor.target.id;
  const started = Date.now();
  const finish = (outcome: CacheOutcome, view: CachedView<T> | null) => {
    recordCacheOutcome(targetId, module, collection, outcome, Date.now() - started);
    return view;
  };

  if (isOpen(targetId)) return finish("bypass-breaker", null);

  // One operation compares metadata and transfers the immutable payload only
  // when this executor has not seen its version. Legacy targets keep v1.
  const snapshot = await readVersioned(executor, module, collection, scope);
  if (snapshot) {
    const freshness = classifyFreshness(snapshot.meta, schedule.intervalSeconds);
    if (freshness !== "very-stale") {
      trackOk(targetId);
      return finish(freshness === "fresh" ? "hit-fresh" : "hit-stale", {rows: snapshot.rows as T[], meta: snapshot.meta, freshness});
    }
  }
  const conn = await getRemoteCacheConn(executor);
  if (!conn) return finish("no-conn", null);

  let fetched: FetchOutcome | null;
  try {
    fetched = await fetchMetaAndPayload(
      executor,
      conn,
      metaKey(module, collection, scope),
      payloadKeyName,
    );
  } catch (err) {
    trackFailure(targetId);
    log.debug(
      { err: errMessage(err), targetId, module, collection },
      "remote-cache fetch failed",
    );
    return finish("error", null);
  }
  if (!fetched) {
    trackFailure(targetId);
    return finish("error", null);
  }

  trackOk(targetId);

  const { meta, payloadRaw } = fetched;
  if (!meta) return finish("miss", null);

  const freshness = classifyFreshness(meta, schedule.intervalSeconds);
  if (freshness === "very-stale") return finish("miss", null);

  // Try the in-memory memo first when version matches what's in Redis.
  const memoK = memoKey(targetId, module, collection, meta.version, pageSlot);
  let rows = memoGet(memoK) as T[] | null;
  if (!rows) {
    if (!payloadRaw) return finish("miss", null);
    try {
      const decoded = decodeBlob(payloadRaw);
      if (!Array.isArray(decoded)) return finish("miss", null);
      rows = decoded as T[];
    } catch {
      trackFailure(targetId);
      return finish("error", null);
    }
    memoSet(memoK, rows as unknown[]);
  }

  // Refresh panel-local metadata (best-effort, fire-and-forget). A single SET
  // is cheaper than the previous conditional GET-then-SET, and the GET never
  // short-circuited the exec above (we always need the up-to-date collectedAt).
  void writePanelMeta(targetId, module, collection, meta, scope);

  const outcome: CacheOutcome = freshness === "fresh" ? "hit-fresh" : "hit-stale";
  return finish(outcome, { rows, meta, freshness });
}

/** Fetch the full projected dataset (used when client-side filtering is needed).
 *  When `scope` is provided, returns only that scope's slice (per-account, etc.). */
export function getCachedFull<T = unknown>(
  executor: Executor,
  module: string,
  collection: string,
  scope?: string,
): Promise<CachedView<T> | null> {
  return getCached<T>(
    executor, module, collection,
    fullKey(module, collection, scope),
    scope ? `full:s${scope}` : "full",
    scope,
  );
}

/** Health snapshot for /admin/remote-cache/health (Hito 7). */
export function remoteCacheHealth(targetId: string): {
  breaker: { open: boolean; failures: number; openedAt: number };
} {
  const s = breaker.get(targetId);
  return {
    breaker: {
      open: isOpen(targetId),
      failures: s?.failures ?? 0,
      openedAt: s?.openedAt ?? 0,
    },
  };
}

/** Test seam. */
export function _resetRemoteCacheForTests(): void {
  breaker.clear();
  blobMemo.clear();
  blobMemoBytes = 0;
}
