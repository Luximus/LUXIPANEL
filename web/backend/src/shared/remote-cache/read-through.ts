// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/read-through.ts — generic read-through wrapper that
 * the data-store hooks into. Returns the precomputed (already projected)
 * rows from the per-target cache when available, and falls back to the
 * caller-supplied JSON loader on miss / cache disabled / very stale.
 *
 * The wrapper is intentionally tiny so it can sit on the hot `list()` path
 * without adding latency when the cache is off (a single map lookup for the
 * policy check, then nothing).
 */

import type { Executor } from "../executor/types.js";

import { serveCachedDataTable } from "./serve-cached-datatable.js";

/**
 * If `(module, collection)` is in the cacheable allowlist AND the per-target
 * cache returns a fresh/stale view, return those rows; otherwise run
 * `loader()` and return its result. The cache contains the PROJECTED rows
 * (only fields listed in the policy) — this means consumers that depend on
 * fields outside the projection (e.g. password hashes, raw secrets) MUST
 * read directly from the sidecar via `loader`; we already guard that
 * statically via the projection list.
 *
 * Implementation: the cache-first core is `serveCachedDataTable` (same
 * `cachePolicyFor` → `getCachedFull` → fallback-to-loader sequence, plus the
 * `forceLive`/`scope`/freshness metadata this entry point does not need). This
 * used to be a second copy of that core.
 */
export async function listCached<T>(
  executor: Executor,
  module: string,
  collection: string,
  loader: () => Promise<T[]>,
): Promise<T[]> {
  const { rows } = await serveCachedDataTable<T>({
    executor,
    module,
    collection,
    liveLoader: loader,
  });
  return rows;
}
