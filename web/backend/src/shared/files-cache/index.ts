// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/files-cache — cache-aside cache for directory listings.
 *
 * Unlike the `remote-cache` module (engine-pushed snapshots of slow-changing
 * DataTables), the filesystem is volatile and unbounded, so this cache:
 *
 *   * is **cache-aside**: the controller still runs the live `readdir` on
 *     cache miss and then writes the result back to the per-target Redis;
 *   * is **TTL-gated** (short — 60 s by default) so even without explicit
 *     invalidation, drift is bounded;
 *   * is **invalidated on every panel-driven mutation** (mkdir, delete,
 *     rename, copy, chmod, chown, write, upload, compress, extract);
 *   * is **fail-open everywhere** — any Redis error, missing conn.json, or
 *     parse failure resolves to `null` and the caller serves live.
 *
 * Isolation: writes go to the **per-target Redis** on the client server, so
 * one customer's listings can never leak into another's. No tenant payload
 * ever touches the panel host (same invariant as the existing remote-cache).
 *
 * Key namespace (one entry per directory):
 *   lprc:v1:files:dir:<sha256(path).slice(0,16)>   →  gzip+base64(JSON entries[])
 *
 * The hash makes the key safe for any filesystem character and bounded in
 * length. We separately keep `<key>:p` (the raw path) so a human can debug
 * with `redis-cli SCAN`.
 */

import { createHash } from "node:crypto";

import { env } from "../../config/env.js";
import { createModuleLogger } from "../logger/index.js";
import type { Executor } from "../executor/types.js";

import { gunzipB64, gzipB64 } from "../remote-cache/codec.js";
import { getRemoteCacheConn } from "../remote-cache/conn.js";
import { RC_KEY_PREFIX } from "../remote-cache/keys.js";
import {
  escapeSingleQuoted,
  execWithRedisAuth,
  isRedisNil,
  redisArgv,
  stripRedisQuotes,
} from "../remote-cache/redis-cli.js";
import { errMessage } from "../utils/err-message.js";

const log = createModuleLogger("files-cache");

const KEY_PREFIX_DIR = `${RC_KEY_PREFIX}:files:dir`;
const KEY_PREFIX_DIRSIZE = `${RC_KEY_PREFIX}:files:dir-size`;
const KEY_PREFIX_FILE = `${RC_KEY_PREFIX}:files:file`;
const KEY_PREFIX_STAT = `${RC_KEY_PREFIX}:files:stat`;
const KEY_PREFIX_SEARCH = `${RC_KEY_PREFIX}:files:search`;
const KEY_PREFIX_VISITS = `${RC_KEY_PREFIX}:files:visits`;
const VISITS_TTL_SECONDS = 60 * 60 * 24 * 60; // 60d — bounds growth, keeps "recent" bias
const DEFAULT_TTL_SECONDS = 60;
const EXEC_TIMEOUT_MS = 1_500;
const MAX_ENTRIES_TO_CACHE = 5_000; // safety: don't cache a 200k-entry dir

interface ExecLike {
  exec(command: string, opts?: { timeoutMs?: number }): Promise<{ stdout: string; stderr: string }>;
  target: { id: string };
}

function isExecLike(executor: Executor): executor is Executor & ExecLike {
  return typeof (executor as { exec?: unknown }).exec === "function";
}

function hashPath(absPath: string): string {
  return createHash("sha256").update(absPath).digest("hex").slice(0, 16);
}

function keyFor(absPath: string): string {
  return `${KEY_PREFIX_DIR}:${hashPath(absPath)}`;
}

function dirSizeKeyFor(absPath: string): string {
  return `${KEY_PREFIX_DIRSIZE}:${hashPath(absPath)}`;
}

function fileKeyFor(absPath: string): string {
  return `${KEY_PREFIX_FILE}:${hashPath(absPath)}`;
}

function statKeyFor(absPath: string): string {
  return `${KEY_PREFIX_STAT}:${hashPath(absPath)}`;
}

/** Combine path + query into a single hash so two different queries on the
 *  same path get distinct keys; a NUL is used as the separator because it
 *  cannot appear in either side. */
function searchKeyFor(absPath: string, query: string): string {
  return `${KEY_PREFIX_SEARCH}:${hashPath(`${absPath}\0${query}`)}`;
}

function visitsKeyFor(absPath: string): string {
  return `${KEY_PREFIX_VISITS}:${hashPath(absPath)}`;
}

/**
 * Build a redis-cli command line: the canonical
 * `redis-cli -h … -p … --no-auth-warning` prefix (shared `redisBase`, no
 * `-a` — the password is exported as REDISCLI_AUTH out-of-band by
 * `execWithRedisAuth`) followed by the already-escaped redis args.
 *
 * Thin local alias: the builder itself (`redisArgv`) and the `--no-raw`
 * quote-stripper now live next to `redisBase` in `remote-cache/redis-cli.ts`.
 */
const buildRedisCmd = redisArgv;

/**
 * Shared connection preamble for every cache op: bail to `fallback` when the
 * executor can't `exec` or the per-target cache Redis isn't reachable
 * (fail-open). Otherwise run `fn` with the resolved connection.
 */
async function withConn<R>(
  executor: Executor,
  fallback: R,
  fn: (conn: { host: string; port: number; password: string }, exec: Executor & ExecLike) => Promise<R>,
): Promise<R> {
  if (!isExecLike(executor)) return fallback;
  let conn;
  try {
    conn = await getRemoteCacheConn(executor);
  } catch {
    return fallback;
  }
  if (!conn) return fallback;
  return fn(conn, executor);
}

/**
 * Batch-read integer values for many paths in a single `--no-raw MGET`.
 * Returns a map `path -> number` seeded with `missDefault`; any hit that
 * parses to a finite, non-negative number overwrites it. Fail-open: on any
 * error every entry keeps its default.
 */
function mgetNumbers<D extends number | null>(
  executor: Executor,
  paths: string[],
  keyFn: (path: string) => string,
  missDefault: D,
): Promise<Record<string, number | D>> {
  const result: Record<string, number | D> = {};
  for (const p of paths) result[p] = missDefault;
  if (!isExecLike(executor) || paths.length === 0) return Promise.resolve(result);

  return withConn(executor, result, async (conn, exec) => {
    try {
      const cmd = buildRedisCmd(conn, [
        "--no-raw",
        "MGET",
        ...paths.map((p) => escapeSingleQuoted(keyFn(p))),
      ]);
      const r = await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
      // `--no-raw MGET` returns one line per requested key, in order: either a
      // quoted bulk string ("12345") or the literal `(nil)` on a miss. Integer
      // values never contain newlines, so a positional split is reliable.
      const lines = r.stdout.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      for (let i = 0; i < paths.length && i < lines.length; i++) {
        const line = lines[i] ?? "";
        const p = paths[i];
        if (p === undefined) continue;
        // Strip the interactive-mode "N) " index prefix if redis-cli emits it.
        const m = line.match(/^\d+\)\s*(.*)$/);
        const tok = (m?.[1] ?? line).trim();
        if (!tok || isRedisNil(tok)) continue;
        const n = Number(stripRedisQuotes(tok));
        if (Number.isFinite(n) && n >= 0) result[p] = n;
      }
    } catch {
      // fail-open: everything keeps its default
    }
    return result;
  });
}

/**
 * Try to read the cached listing for `absPath`. Returns the rows on hit,
 * `null` on any miss/error (fail-open — caller serves live).
 */
export function readCachedDir<T = unknown>(
  executor: Executor,
  absPath: string,
): Promise<T[] | null> {
  return withConn<T[] | null>(executor, null, async (conn, exec) => {
    const key = keyFor(absPath);
    try {
      // `--no-raw GET` returns the bulk string quoted (or "(nil)" on miss).
      // We strip the wrapping quotes and gunzip the base64 payload.
      const cmd = buildRedisCmd(conn, ["--no-raw", "GET", escapeSingleQuoted(key)]);
      const r = await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
      const out = r.stdout.trim();
      if (!out || isRedisNil(out)) return null;
      const json = gunzipB64(stripRedisQuotes(out));
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return null;
      return parsed as T[];
    } catch (err) {
      log.debug(
        {
          err: errMessage(err),
          targetId: exec.target.id,
          path: absPath,
        },
        "files-cache read failed (fail-open)",
      );
      return null;
    }
  });
}

/**
 * Write the listing for `absPath` to Redis with a short TTL. Fire-and-forget;
 * never throws. Skips silently when the entry count exceeds the safety cap or
 * the executor can't speak `exec`.
 */
export function writeCachedDir(
  executor: Executor,
  absPath: string,
  entries: unknown[],
): Promise<void> {
  if (entries.length > MAX_ENTRIES_TO_CACHE) return Promise.resolve();
  return withConn<void>(executor, undefined, async (conn, exec) => {
    const key = keyFor(absPath);
    const ttl = Math.max(5, Number(env.FILES_CACHE_TTL_SECONDS ?? DEFAULT_TTL_SECONDS));
    try {
      const payload = gzipB64(JSON.stringify(entries));
      const cmd = buildRedisCmd(conn, [
        "SET",
        escapeSingleQuoted(key),
        escapeSingleQuoted(payload),
        "EX",
        String(ttl),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch (err) {
      log.debug(
        {
          err: errMessage(err),
          targetId: exec.target.id,
          path: absPath,
        },
        "files-cache write failed (fail-open)",
      );
    }
  });
}

/**
 * Drop the cached entry for `absPath`. Used by mutation endpoints so the
 * next list returns the fresh state. Always invalidates the listing of the
 * parent dir too, since a create/delete/rename changes that view.
 *
 * Fire-and-forget; never throws.
 */
export function invalidateDir(
  executor: Executor,
  absPath: string,
): Promise<void> {
  return withConn<void>(executor, undefined, async (conn, exec) => {
    const k1 = keyFor(absPath);
    const k2 = keyFor(parentDir(absPath));
    try {
      const cmd = buildRedisCmd(conn, [
        "DEL",
        escapeSingleQuoted(k1),
        escapeSingleQuoted(k2),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch (err) {
      log.debug(
        {
          err: errMessage(err),
          targetId: exec.target.id,
          path: absPath,
        },
        "files-cache invalidate failed (fail-open)",
      );
    }
  });
}

function parentDir(absPath: string): string {
  const trimmed = absPath.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  return trimmed.slice(0, idx);
}

// ── dir-size cache ───────────────────────────────────────────────────────
/**
 * Try to read the cached recursive size of `absPath`. Returns `null` on miss
 * or any error.
 */
export function readCachedDirSize(
  executor: Executor,
  absPath: string,
): Promise<number | null> {
  return withConn<number | null>(executor, null, async (conn, exec) => {
    const key = dirSizeKeyFor(absPath);
    try {
      const cmd = buildRedisCmd(conn, ["--no-raw", "GET", escapeSingleQuoted(key)]);
      const r = await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
      const out = r.stdout.trim();
      if (!out || isRedisNil(out)) return null;
      const n = Number(stripRedisQuotes(out));
      return Number.isFinite(n) && n >= 0 ? n : null;
    } catch {
      return null;
    }
  });
}

/**
 * Batch-read the cached recursive sizes for many paths in a single `MGET`
 * round-trip. Returns a map `path -> bytes` with `null` for any path that is
 * not in cache (or on any error — fail-open). This is the fast path that lets
 * the file browser fill in already-known folder sizes instantly; the caller
 * computes the misses lazily via the per-path `dir-size` endpoint.
 */
export function readCachedDirSizes(
  executor: Executor,
  paths: string[],
): Promise<Record<string, number | null>> {
  return mgetNumbers(executor, paths, dirSizeKeyFor, null);
}

// ── folder visit stats ───────────────────────────────────────────────────
/**
 * Record a visit to `absPath`: atomically `INCR` the per-directory counter and
 * refresh its TTL (so popularity decays toward "recently used"). Fire-and-forget;
 * never throws. Powers the path-bar autocomplete ranking (most-visited first).
 */
export function recordVisit(executor: Executor, absPath: string): Promise<void> {
  return withConn<void>(executor, undefined, async (conn, exec) => {
    try {
      // Double-quoted Lua so escapeSingleQuoted can wrap it without escaping.
      const script = 'redis.call("INCR", KEYS[1]) return redis.call("EXPIRE", KEYS[1], ARGV[1])';
      const cmd = buildRedisCmd(conn, [
        "EVAL",
        escapeSingleQuoted(script),
        "1",
        escapeSingleQuoted(visitsKeyFor(absPath)),
        String(VISITS_TTL_SECONDS),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch {
      // fail-open
    }
  });
}

/**
 * Batch-read visit counters for many paths in a single `MGET`. Missing paths
 * default to 0. Used to rank autocomplete suggestions.
 */
export function readVisits(
  executor: Executor,
  paths: string[],
): Promise<Record<string, number>> {
  return mgetNumbers(executor, paths, visitsKeyFor, 0);
}

/**
 * Persist the directory size to Redis with a TTL longer than the listing
 * cache (total bytes drift slowly even with frequent file edits, and a stale
 * size in the UI is far less harmful than a stale file list).
 */
export function writeCachedDirSize(
  executor: Executor,
  absPath: string,
  size: number,
): Promise<void> {
  if (!Number.isFinite(size) || size < 0) return Promise.resolve();
  return withConn<void>(executor, undefined, async (conn, exec) => {
    const ttl = Math.max(30, env.FILES_DIRSIZE_CACHE_TTL_SECONDS);
    try {
      const cmd = buildRedisCmd(conn, [
        "SET",
        escapeSingleQuoted(dirSizeKeyFor(absPath)),
        escapeSingleQuoted(String(Math.floor(size))),
        "EX",
        String(ttl),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch {
      // fail-open
    }
  });
}

// ── file content cache ───────────────────────────────────────────────────
/**
 * Read the cached content of a small text file. Returns the decoded string
 * on hit, `null` on miss / any error. Caller MUST gate by file size before
 * relying on this (we don't want to surface multi-MB blobs from Redis).
 */
export function readCachedFileContent(
  executor: Executor,
  absPath: string,
): Promise<string | null> {
  return withConn<string | null>(executor, null, async (conn, exec) => {
    try {
      const cmd = buildRedisCmd(conn, [
        "--no-raw",
        "GET",
        escapeSingleQuoted(fileKeyFor(absPath)),
      ]);
      const r = await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
      const out = r.stdout.trim();
      if (!out || isRedisNil(out)) return null;
      return gunzipB64(stripRedisQuotes(out));
    } catch {
      return null;
    }
  });
}

/**
 * Persist a small file's content to Redis with a short TTL. Skipped when the
 * content is too large (over `FILES_CONTENT_CACHE_MAX_BYTES`).
 */
export function writeCachedFileContent(
  executor: Executor,
  absPath: string,
  content: string,
): Promise<void> {
  const cap = env.FILES_CONTENT_CACHE_MAX_BYTES;
  // Byte length, not string length — utf-8 can blow up the size for
  // multi-byte locales.
  if (Buffer.byteLength(content, "utf-8") > cap) return Promise.resolve();
  return withConn<void>(executor, undefined, async (conn, exec) => {
    const ttl = Math.max(5, env.FILES_CONTENT_CACHE_TTL_SECONDS);
    try {
      const payload = gzipB64(content);
      const cmd = buildRedisCmd(conn, [
        "SET",
        escapeSingleQuoted(fileKeyFor(absPath)),
        escapeSingleQuoted(payload),
        "EX",
        String(ttl),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch {
      // fail-open
    }
  });
}

/**
 * Drop the cached content of `absPath`. Called on every mutation that
 * changes a file's bytes (write/upload/copy-dest/rename-target).
 */
export function invalidateFile(
  executor: Executor,
  absPath: string,
): Promise<void> {
  return withConn<void>(executor, undefined, async (conn, exec) => {
    try {
      const cmd = buildRedisCmd(conn, [
        "DEL",
        escapeSingleQuoted(fileKeyFor(absPath)),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch {
      // fail-open
    }
  });
}

// ── stat cache ───────────────────────────────────────────────────────────
/**
 * Read the cached stat result for `absPath`. Returns the parsed object on
 * hit (typed loosely as `unknown` — the controller knows its shape) or
 * `null` on any miss/error.
 */
export function readCachedStat<T = unknown>(
  executor: Executor,
  absPath: string,
): Promise<T | null> {
  return withConn<T | null>(executor, null, async (conn, exec) => {
    try {
      const cmd = buildRedisCmd(conn, [
        "--no-raw",
        "GET",
        escapeSingleQuoted(statKeyFor(absPath)),
      ]);
      const r = await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
      const out = r.stdout.trim();
      if (!out || isRedisNil(out)) return null;
      const json = gunzipB64(stripRedisQuotes(out));
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  });
}

/** Persist a stat result; fire-and-forget. */
export function writeCachedStat(
  executor: Executor,
  absPath: string,
  value: unknown,
): Promise<void> {
  return withConn<void>(executor, undefined, async (conn, exec) => {
    const ttl = Math.max(5, env.FILES_STAT_CACHE_TTL_SECONDS);
    try {
      const payload = gzipB64(JSON.stringify(value));
      const cmd = buildRedisCmd(conn, [
        "SET",
        escapeSingleQuoted(statKeyFor(absPath)),
        escapeSingleQuoted(payload),
        "EX",
        String(ttl),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch {
      // fail-open
    }
  });
}

/** Drop the cached stat for `absPath`. */
export function invalidateStat(
  executor: Executor,
  absPath: string,
): Promise<void> {
  return withConn<void>(executor, undefined, async (conn, exec) => {
    try {
      const cmd = buildRedisCmd(conn, [
        "DEL",
        escapeSingleQuoted(statKeyFor(absPath)),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch {
      // fail-open
    }
  });
}

// ── search cache ─────────────────────────────────────────────────────────
/**
 * Read cached search results for a given (path, query) pair. Returns `null`
 * on miss. Granular invalidation by content change is impractical (any
 * descendant write could affect results), so callers MUST be comfortable
 * with the TTL-bounded staleness window.
 */
export function readCachedSearch<T = unknown>(
  executor: Executor,
  absPath: string,
  query: string,
): Promise<T[] | null> {
  return withConn<T[] | null>(executor, null, async (conn, exec) => {
    try {
      const cmd = buildRedisCmd(conn, [
        "--no-raw",
        "GET",
        escapeSingleQuoted(searchKeyFor(absPath, query)),
      ]);
      const r = await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
      const out = r.stdout.trim();
      if (!out || isRedisNil(out)) return null;
      const parsed = JSON.parse(gunzipB64(stripRedisQuotes(out)));
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      return null;
    }
  });
}

/** Persist search results for a (path, query) pair. */
export function writeCachedSearch(
  executor: Executor,
  absPath: string,
  query: string,
  results: unknown[],
): Promise<void> {
  if (!Array.isArray(results)) return Promise.resolve();
  return withConn<void>(executor, undefined, async (conn, exec) => {
    const ttl = Math.max(5, env.FILES_SEARCH_CACHE_TTL_SECONDS);
    try {
      const payload = gzipB64(JSON.stringify(results));
      const cmd = buildRedisCmd(conn, [
        "SET",
        escapeSingleQuoted(searchKeyFor(absPath, query)),
        escapeSingleQuoted(payload),
        "EX",
        String(ttl),
      ]);
      await execWithRedisAuth(exec, conn, cmd, { timeoutMs: EXEC_TIMEOUT_MS });
    } catch {
      // fail-open
    }
  });
}

/** Test seam. */
export const _internal = {
  hashPath,
  parentDir,
  keyFor,
  dirSizeKeyFor,
  fileKeyFor,
  statKeyFor,
  searchKeyFor,
};
