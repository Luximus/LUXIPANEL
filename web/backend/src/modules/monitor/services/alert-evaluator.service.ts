// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Alert evaluator service - evaluates alert rules against the latest metrics snapshot.
 *
 * Runs after the stats collector produces a fresh snapshot with its target
 * executor (including the explicit local executor). Rules are per-server
 * (`dataStore(executor,"monitor","alert-rules")`), so evaluation never relies
 * on ambient AsyncLocalStorage or reads another server's rules.
 *
 * Breach/firing state is keyed by `${scope}:${ruleId}` so rules from different
 * servers (whose numeric ids can collide — ids are per-sidecar) never share
 * state.
 */

import { alertRepository } from "../repositories/alert.repository.js";
import { type StatsSnapshot } from "./system-stats.service.js";
import { type AlertRule, type AlertMetric } from "../models/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { Executor } from "../../../shared/executor/index.js";

const log = createModuleLogger("alert-evaluator");

/** Maps `${scope}:${ruleId}` to consecutive breach count. */
const _breachCounts = new Map<string, number>();
/** Tracks which rules (by `${scope}:${ruleId}`) are currently "firing". */
const _firingRules = new Set<string>();
/** Rules whose firing event was delivered (muted firings have no paired notice). */
const _notifiedRules = new Set<string>();

function stateKey(scope: string, ruleId: number): string {
  return `${scope}:${ruleId}`;
}

/** Extract the relevant metric value from a snapshot. */
function extractMetric(snapshot: StatsSnapshot, metric: AlertMetric): number | null {
  switch (metric) {
    case "cpu_usage_percent":
      return snapshot.cpu.usagePercent;
    case "memory_usage_percent":
      return snapshot.memory.usagePercent;
    case "disk_usage_percent":
      return snapshot.disk.usagePercent;
    case "load_avg_1m":
      return snapshot.cpu.loadAvg1m;
    case "load_avg_5m":
      return snapshot.cpu.loadAvg5m;
    case "rx_bytes_per_sec":
      return snapshot.network.rxBytesPerSec;
    case "tx_bytes_per_sec":
      return snapshot.network.txBytesPerSec;
    default:
      return null;
  }
}

/** Check if a value breaches the threshold for a given rule. */
function breaches(rule: AlertRule, value: number): boolean {
  switch (rule.operator) {
    case "gt":
      return value > rule.threshold;
    case "gte":
      return value >= rule.threshold;
    case "lt":
      return value < rule.threshold;
    case "lte":
      return value <= rule.threshold;
    default:
      return false;
  }
}

export const alertEvaluatorService = {
  /**
   * Evaluate all enabled rules of `scope`'s server against a fresh snapshot.
   * Called by the stats collector after each PER-SERVER collection cycle, with
   * the same executor that produced the snapshot.
   */
  async evaluate(snapshot: StatsSnapshot, executor: Executor, scope: string): Promise<void> {
    let rules: AlertRule[];
    try {
      rules = await alertRepository.findEnabledRules(executor);
    } catch (err) {
      // Sidecar may not exist yet / transient read error — skip this cycle.
      log.debug({ err, scope }, "Could not load alert rules");
      return;
    }

    // A paused/deleted rule must no longer look firing in the UI. Resolve its
    // open event even when it has disappeared from the enabled-rule query.
    const enabledIds = new Set(rules.map((rule) => rule.id));
    const prefix = `${scope}:`;
    for (const key of [..._firingRules]) {
      if (!key.startsWith(prefix)) continue;
      const id = Number(key.slice(prefix.length));
      if (enabledIds.has(id)) continue;
      _firingRules.delete(key);
      _notifiedRules.delete(key);
      _breachCounts.delete(key);
      try { await alertRepository.resolveEvent(id, executor); }
      catch (err) { log.error({ err, ruleId: id, scope }, "Failed to resolve paused alert"); }
    }

    for (const rule of rules) {
      const value = extractMetric(snapshot, rule.metric);
      if (value === null) continue;

      const key = stateKey(scope, rule.id);
      const isBreach = breaches(rule, value);

      if (isBreach) {
        const count = (_breachCounts.get(key) ?? 0) + 1;
        _breachCounts.set(key, count);

        if (count >= rule.sustainedSamples && !_firingRules.has(key)) {
          // Transition to firing
          _firingRules.add(key);
          try {
            await alertRepository.createEvent(
              {
                ruleId: rule.id,
                state: "firing",
                triggerValue: value,
              },
              executor,
            );
          } catch (err) {
            log.error({ err, ruleId: rule.id, scope }, "Failed to create alert event");
          }
          log.warn(
            { ruleId: rule.id, rule: rule.name, metric: rule.metric, value, threshold: rule.threshold, scope },
            "Alert firing",
          );
        }
        // A rule can cross its threshold during a maintenance mute. Once that
        // mute expires, deliver the still-active alert exactly once without
        // creating a second firing event in the history.
        const mutedUntil = rule.mutedUntil ? Date.parse(rule.mutedUntil) : NaN;
        if (_firingRules.has(key) && !_notifiedRules.has(key) &&
            (!Number.isFinite(mutedUntil) || mutedUntil <= Date.now())) {
          eventBus.emit(Events.ALERT_FIRING, { rule, value, scope });
          _notifiedRules.add(key);
        }
      } else {
        // Condition cleared
        _breachCounts.set(key, 0);

        if (_firingRules.has(key)) {
          _firingRules.delete(key);
          try {
            await alertRepository.resolveEvent(rule.id, executor);
          } catch (err) {
            log.error({ err, ruleId: rule.id, scope }, "Failed to resolve alert event");
          }
          log.info({ ruleId: rule.id, rule: rule.name, scope }, "Alert resolved");
          if (_notifiedRules.delete(key)) {
            eventBus.emit(Events.ALERT_RESOLVED, { rule, value, scope });
          }
        }
      }
    }
  },

  /**
   * Return IDs of rules currently firing for `scope` (target id) — only that
   * server's firing rules.
   */
  firingRuleIds(scope: string): number[] {
    const prefix = `${scope}:`;
    return [..._firingRules]
      .filter((k) => k.startsWith(prefix))
      .map((k) => Number(k.slice(prefix.length)));
  },

  /** Reset all state (useful for tests). */
  reset(): void {
    _breachCounts.clear();
    _firingRules.clear();
    _notifiedRules.clear();
  },
};
