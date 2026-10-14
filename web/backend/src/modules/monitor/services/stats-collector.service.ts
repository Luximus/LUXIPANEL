// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Stats collector — periodically samples system metrics and stores them in Redis.
 *
 * Storage layout:
 *   Key:  monitor:snapshots:{bucketKey}   (ZSET — score=ts, value=JSON)
 *   Key:  monitor:latest                  (STRING — most recent snapshot JSON)
 *
 * Retention: 14 days of history, with at most one stored sample per minute.
 */

import { systemStatsService, type StatsSnapshot } from "./system-stats.service.js";
import { getRedis } from "../../../shared/redis/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { localExecutor, type Executor } from "../../../shared/executor/index.js";

// Lazy import to avoid circular dep — evaluator is hooked in after collection
type AlertEvaluatorService = {
  evaluate(snapshot: StatsSnapshot, executor: Executor, scope: string): Promise<void>;
};
let _alertEvaluator: AlertEvaluatorService | null = null;

const log = createModuleLogger("stats-collector");

const INTERVAL_MS = 10_000;          // collect every 10 seconds for real-time KPIs
const HISTORY_INTERVAL_MS = 60_000;
const RETENTION_SECONDS = 14 * 86_400; // current 7d plus previous 7d for comparison
const LATEST_TTL_SECONDS = 86_400;
const REDIS_KEY_SNAPSHOTS = "monitor:snapshots";
const REDIS_KEY_LATEST = "monitor:latest";

let _timer: ReturnType<typeof setInterval> | null = null;
const _latestByScope = new Map<string, StatsSnapshot>();
const _lastHistoryTsByScope = new Map<string, number>();
const _collectInFlightByScope = new Map<string, Promise<StatsSnapshot>>();

function scopeKey(scope = "local"): string {
  return scope || "local";
}

function redisSnapshotsKey(scope = "local"): string {
  return `${REDIS_KEY_SNAPSHOTS}:${scopeKey(scope)}`;
}

function redisLatestKey(scope = "local"): string {
  return `${REDIS_KEY_LATEST}:${scopeKey(scope)}`;
}

export const statsCollectorService = {
  /** Start the background collection loop. Call once at bootstrap. */
  start(): void {
    if (_timer) return;

    // Collect immediately, then on interval
    this._collect();
    _timer = setInterval(() => this._collect(), INTERVAL_MS);

    log.info({ intervalMs: INTERVAL_MS }, "Stats collector started");
  },

  /** Register an alert evaluator to run after each collection. */
  setAlertEvaluator(evaluator: AlertEvaluatorService): void {
    _alertEvaluator = evaluator;
  },

  /** Stop the collection loop. */
  stop(): void {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
      log.info("Stats collector stopped");
    }
  },

  /** Return the most recently collected snapshot (in-memory cache). */
  getLatest(scope = "local"): StatsSnapshot | null {
    return _latestByScope.get(scopeKey(scope)) ?? null;
  },

  /**
   * Return snapshots within a time range from Redis.
   * @param fromTs  Unix timestamp ms (inclusive)
   * @param toTs    Unix timestamp ms (inclusive), defaults to now
   */
  async getHistory(fromTs: number, toTs = Date.now(), scope = "local"): Promise<StatsSnapshot[]> {
    try {
      const redis = getRedis();
      const raw: string[] = await redis.zrangebyscore(
        redisSnapshotsKey(scope),
        fromTs,
        toTs,
      );
      return raw.map((r) => JSON.parse(r) as StatsSnapshot);
    } catch (err) {
      log.error({ err }, "Failed to read history from Redis");
      throw err;
    }
  },

  /** Collect a snapshot from a bridged target and persist it under that scope. */
  async collectWithExecutor(executor: Executor, scope = executor.target.id): Promise<StatsSnapshot> {
    const snapshot = await systemStatsService.collectWithExecutor(executor, scopeKey(scope));
    await this.recordSnapshot(snapshot, scopeKey(scope), executor);
    return snapshot;
  },

  /**
   * Collect a snapshot from a bridged target with per-scope dedupe and short cache.
   * Prevents bursts of concurrent SSH exec calls when multiple endpoints request stats.
   */
  async collectWithExecutorCached(
    executor: Executor,
    scope = executor.target.id,
    minIntervalMs = 5_000,
  ): Promise<StatsSnapshot> {
    const key = scopeKey(scope);
    const latest = _latestByScope.get(key);
    if (latest && Date.now() - latest.ts < minIntervalMs) {
      return latest;
    }

    const inFlight = _collectInFlightByScope.get(key);
    if (inFlight) {
      return inFlight;
    }

    const task = this.collectWithExecutor(executor, key)
      .finally(() => {
        _collectInFlightByScope.delete(key);
      });
    _collectInFlightByScope.set(key, task);
    return task;
  },

  /**
   * Record a snapshot in memory and Redis.
   *
   * Alert evaluation runs when a target executor is supplied, including the
   * explicit local executor in the background collector:
   * alert rules are per-server and reading them requires that server's
   * executor. The local collector uses `localExecutor`; remote sessions keep
   * their own executor and scope.
   */
  async recordSnapshot(snapshot: StatsSnapshot, scope = "local", executor?: Executor): Promise<void> {
    const redis = getRedis();
    const json = JSON.stringify(snapshot);
    const key = scopeKey(scope);

    _latestByScope.set(key, snapshot);
    // Purge in-memory scopes that stopped reporting (a target that never
    // reconnects would otherwise keep its last snapshot forever).
    const staleBefore = snapshot.ts - LATEST_TTL_SECONDS * 1000;
    for (const [k, snap] of _latestByScope) {
      if (snap.ts < staleBefore) {
        _latestByScope.delete(k);
        _lastHistoryTsByScope.delete(k);
      }
    }

    const lastHistoryTs = _lastHistoryTsByScope.get(key) ?? 0;
    if (snapshot.ts - lastHistoryTs >= HISTORY_INTERVAL_MS) {
      await redis.zadd(redisSnapshotsKey(key), snapshot.ts, json);
      _lastHistoryTsByScope.set(key, snapshot.ts);
      const cutoff = snapshot.ts - RETENTION_SECONDS * 1000;
      await redis.zremrangebyscore(redisSnapshotsKey(key), "-inf", cutoff);
      await redis.expire(redisSnapshotsKey(key), RETENTION_SECONDS);
    }
    await redis.set(redisLatestKey(key), json, "EX", LATEST_TTL_SECONDS);

    if (_alertEvaluator && executor) {
      await _alertEvaluator.evaluate(snapshot, executor, key);
    }
  },

  /** Internal: collect one snapshot and persist it. */
  async _collect(): Promise<void> {
    try {
      const snapshot = await systemStatsService.collect();
      await this.recordSnapshot(snapshot, "local", localExecutor);
    } catch (err) {
      log.error({ err }, "Stats collection failed");
    }
  },
};
