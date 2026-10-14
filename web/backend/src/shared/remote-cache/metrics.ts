// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/metrics.ts — lightweight in-process counters for the
 * read-through cache. Consumed by /admin/remote-cache/health (Hito 7) and
 * by the cost panel in Ajustes → Módulos (Hito 6).
 */

export type CacheOutcome =
  | "hit-fresh"
  | "hit-stale"
  | "miss"
  | "bypass-breaker"
  | "no-conn"
  | "error";

interface Bucket {
  counts: Record<CacheOutcome, number>;
  lastOutcome: CacheOutcome | null;
  lastAt: number;
  totalDurationMs: number;
  observed: number;
}

const buckets = new Map<string, Bucket>();

function key(targetId: string, module: string, collection: string): string {
  return `${targetId}/${module}/${collection}`;
}

function emptyBucket(): Bucket {
  return {
    counts: {
      "hit-fresh": 0,
      "hit-stale": 0,
      miss: 0,
      "bypass-breaker": 0,
      "no-conn": 0,
      error: 0,
    },
    lastOutcome: null,
    lastAt: 0,
    totalDurationMs: 0,
    observed: 0,
  };
}

export function recordCacheOutcome(
  targetId: string,
  module: string,
  collection: string,
  outcome: CacheOutcome,
  durationMs: number,
): void {
  const k = key(targetId, module, collection);
  let b = buckets.get(k);
  if (!b) {
    b = emptyBucket();
    buckets.set(k, b);
  }
  b.counts[outcome] += 1;
  b.lastOutcome = outcome;
  b.lastAt = Date.now();
  b.totalDurationMs += Math.max(0, durationMs);
  b.observed += 1;
}

export interface CacheStatsSnapshot {
  targetId: string;
  module: string;
  collection: string;
  counts: Record<CacheOutcome, number>;
  lastOutcome: CacheOutcome | null;
  lastAt: number;
  observed: number;
  avgDurationMs: number;
  hitRatio: number;
}

export function snapshot(targetId?: string): CacheStatsSnapshot[] {
  const out: CacheStatsSnapshot[] = [];
  for (const [k, b] of buckets) {
    const [tid, module, collection] = k.split("/", 3);
    if (targetId && tid !== targetId) continue;
    const hits = b.counts["hit-fresh"] + b.counts["hit-stale"];
    out.push({
      targetId: tid!,
      module: module!,
      collection: collection!,
      counts: { ...b.counts },
      lastOutcome: b.lastOutcome,
      lastAt: b.lastAt,
      observed: b.observed,
      avgDurationMs: b.observed > 0 ? b.totalDurationMs / b.observed : 0,
      hitRatio: b.observed > 0 ? hits / b.observed : 0,
    });
  }
  return out;
}

/** Test seam. */
export function _resetMetricsForTests(): void {
  buckets.clear();
}
