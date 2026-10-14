// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/serve-cached-datatable.ts — the cache-first wrapper
 * that controllers wrap their existing list logic with.
 *
 * Pattern in the controller:
 *
 *   const items = await serveCachedDataTable({
 *     executor, module: "mail", collection: "accounts",
 *     liveLoader: async () => readAccountsFromServerWithEnrichment(executor),
 *   });
 *
 * Behaviour:
 *   * If a fresh/stale entry is in the per-target Redis cache, return it
 *     immediately (microseconds). This is the fast path the panel takes
 *     once the client-side engine has run at least once.
 *   * Otherwise call `liveLoader()` — the legacy heavy code path — and
 *     return its result. The engine will populate the cache on its next
 *     tick so the second call within seconds hits the cache.
 *
 * Fail-open in every direction: any cache error → falls through to live.
 * The caller's response shape never changes.
 */

import { noteRead } from "./response-freshness.js";
import type { Executor } from "../executor/types.js";

import { cachePolicyFor } from "../cache/cacheable-modules.js";
import { getCachedFull } from "./index.js";

export interface ServeCachedDataTableOptions<T> {
  executor: Executor;
  module: string;
  collection: string;
  /** The legacy heavy loader — used on cache miss or when this collection
   *  isn't in the allowlist. */
  liveLoader: () => Promise<T[]>;
  /** Optional per-call override; defaults to the cacheable allowlist. */
  forceLive?: boolean;
  /** When the collection is registered as `scoped` in `cacheable-modules.ts`,
   *  pass the scope value (e.g. the accountId as a string) to fetch ONLY
   *  that scope's blob. Smaller payload, faster transfer, finer-grained
   *  invalidation on mutations. Ignored for non-scoped collections. */
  scope?: string | number;
}

export interface ServeCachedDataTableResult<T> {
  rows: T[];
  /** Was the cache used? Useful for ETag / cost-panel observability. */
  fromCache: boolean;
  /** Engine's collection timestamp (unix seconds) when fromCache=true. */
  collectedAt: number | null;
  /** Engine-side version hash when fromCache=true. */
  version: string | null;
}

/**
 * Wrap a DataTable list endpoint with the cache-first behaviour. Returns
 * `{rows, fromCache, collectedAt, version}` so the caller can include
 * cache freshness in response headers / payload if desired.
 *
 * Controllers that just want the rows can destructure: `const { rows } = ...`.
 */
export async function serveCachedDataTable<T = unknown>(
  opts: ServeCachedDataTableOptions<T>,
): Promise<ServeCachedDataTableResult<T>> {
  const recordLive = () => noteRead({targetId: opts.executor.target.id, resource: `${opts.module}/${opts.collection}`, state: "fresh", collectedAt: Date.now() / 1000, source: "live"});
  const policy = cachePolicyFor(opts.module, opts.collection);
  if (opts.forceLive || !policy) {
    const rows = await opts.liveLoader();
    recordLive();
    return { rows, fromCache: false, collectedAt: null, version: null };
  }
  // Only honour `scope` if the collection is registered as scoped.
  // For unscoped collections the engine doesn't emit per-scope blobs, so a
  // scoped lookup would always miss; silently drop the scope to use the
  // unscoped full blob.
  const scope = policy.scoped && opts.scope !== undefined
    ? String(opts.scope)
    : undefined;
  try {
    const view = await getCachedFull<T>(opts.executor, opts.module, opts.collection, scope);
    if (view) {
      noteRead({targetId: opts.executor.target.id, resource: `${opts.module}/${opts.collection}`, state: view.freshness, collectedAt: view.meta.collectedAt, source: "snapshot"});
      return {
        rows: view.rows,
        fromCache: true,
        collectedAt: view.meta.collectedAt,
        version: view.meta.version,
      };
    }
  } catch {
    // Cache layer is supposed to fail-open by itself; this catch only
    // protects against unexpected throws.
  }
  const rows = await opts.liveLoader();
  recordLive();
  return { rows, fromCache: false, collectedAt: null, version: null };
}
