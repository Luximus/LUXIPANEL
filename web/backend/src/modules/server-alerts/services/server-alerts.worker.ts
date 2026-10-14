// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-alerts worker — periodic background evaluator.
 *
 * On each tick it evaluates the panel host and registered remote targets with
 * approved vault credentials, even when nobody has an active browser session.
 *
 * Per server it:
 *   1. Fires due scheduled notifications (one-shot → disable; recurring/cron →
 *      reschedule via lastFiredAt + cron matcher).
 *   2. Evaluates metric rules against a fresh stats snapshot
 *      (`systemStatsService.collectWithExecutor`, reused from the monitor
 *      module — NO re-implemented SSH) plus `systemctl is-active` for
 *      service-down rules. Cooldown (cooldownMinutes / lastFiredAt) gates
 *      re-firing.
 *
 * Everything is fail-soft: a failure on one server / one rule is logged and
 * skipped, never aborting the tick.
 */

import { env } from "../../../config/env.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { localExecutor, runWithExecutor, type Executor } from "../../../shared/executor/index.js";
import { getVaultExecutor } from "../../../shared/executor/vault-executor.js";
import { targetsRepository } from "../../servers/repositories/targets.repository.js";
import { systemctlIsActive } from "../../../shared/system/service-status.js";
import { cronMatches } from "../../../shared/cron/cron-match.js";
import { systemStatsService } from "../../monitor/services/index.js";
import { serverAlertsService } from "./server-alerts.service.js";
import type {
  MetricRule,
  ScheduledNotification,
} from "../models/server-alerts.model.js";

const log = createModuleLogger("server-alerts-worker");

let timer: NodeJS.Timeout | null = null;
let ticking = false;

// Cron evaluation uses the canonical shared 5-field UTC matcher
// (`shared/cron/cron-match.ts#cronMatches`, default clock = "utc").

// ── Scheduled notifications ────────────────────────────────────────────────

export function scheduledIsDue(s: ScheduledNotification, now: Date): boolean {
  if (!s.enabled) return false;
  if (s.cron) {
    // Recurring cron: fire once per matching minute. Guard against double-fire
    // within the same minute using lastFiredAt.
    if (!cronMatches(s.cron, now, s.timeZone || "utc")) return false;
    if (s.lastFiredAt) {
      const last = new Date(s.lastFiredAt).getTime();
      if (Number.isFinite(last) && now.getTime() - last < 60_000) return false;
    }
    return true;
  }
  if (s.scheduleAt) {
    const at = new Date(s.scheduleAt).getTime();
    if (!Number.isFinite(at)) return false;
    // Already fired one-shot?
    if (s.lastFiredAt) return false;
    // Due when its time has arrived (and not absurdly far in the past beyond
    // one tick window we still fire it once to avoid missing a tick boundary).
    return at <= now.getTime();
  }
  return false;
}

async function processScheduled(executor: Executor, now: Date): Promise<void> {
  let rows: ScheduledNotification[];
  try {
    rows = await serverAlertsService.listScheduled(executor);
  } catch (err) {
    log.debug({ err: (err as Error).message, target: executor.target.id }, "Could not read scheduled notifications");
    return;
  }
  for (const s of rows) {
    if (!scheduledIsDue(s, now)) continue;
    try {
      const delivered = await serverAlertsService.sendImmediate(
        {
          title: s.title,
          body: s.body,
          signals: s.signals ?? undefined,
          data: { kind: "scheduled", scheduledId: s.id, targetId: executor.target.id },
          respectPrefs: true,
        },
      );
      if (!delivered.panel) continue;
      // One-shot → disable; recurring/cron → keep enabled, just stamp lastFiredAt.
      const patch: Partial<ScheduledNotification> = s.cron || s.recurring ? {} : { enabled: false };
      await serverAlertsService.markScheduledFired(s.id, patch, executor);
      log.info({ scheduledId: s.id, target: executor.target.id }, "Scheduled notification fired");
    } catch (err) {
      log.warn({ err: (err as Error).message, scheduledId: s.id, target: executor.target.id }, "Scheduled notification send failed");
    }
  }
}

// ── Metric rules ───────────────────────────────────────────────────────────

export function ruleBreaches(rule: MetricRule, value: number): boolean {
  const t = rule.threshold ?? 0;
  switch (rule.op) {
    case ">=":
      return value >= t;
    case "<=":
      return value <= t;
    case "==":
      return value === t;
    default:
      return false;
  }
}

export function cooldownPassed(rule: MetricRule, now: Date): boolean {
  if (!rule.lastFiredAt) return true;
  const last = new Date(rule.lastFiredAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= rule.cooldownMinutes * 60_000;
}

/** Check whether a systemd unit is active on the connected server. */
async function serviceIsActive(executor: Executor, unit: string): Promise<boolean> {
  // A probe failure is "unknown", NOT "down" — otherwise an SSH blip pages.
  return systemctlIsActive(executor, unit, { timeoutMs: 8_000, onProbeError: true });
}

export async function processRules(executor: Executor, now: Date): Promise<void> {
  let rules: MetricRule[];
  try {
    rules = await serverAlertsService.listRules(executor);
  } catch (err) {
    log.debug({ err: (err as Error).message, target: executor.target.id }, "Could not read metric rules");
    return;
  }
  const enabled = rules.filter((r) => r.enabled);
  if (enabled.length === 0) return;

  // Only collect stats when at least one numeric rule needs them.
  const needsSnapshot = enabled.some((r) => r.metric !== "service-down");
  let snapshot: Awaited<ReturnType<typeof systemStatsService.collectWithExecutor>> | null = null;
  if (needsSnapshot) {
    try {
      snapshot = await systemStatsService.collectWithExecutor(executor);
    } catch (err) {
      log.debug({ err: (err as Error).message, target: executor.target.id }, "Stats snapshot failed");
    }
  }

  for (const rule of enabled) {
    if (!cooldownPassed(rule, now)) continue;
    try {
      let breached = false;
      let detail = "";
      if (rule.metric === "service-down") {
        const unit = (rule.service ?? "").trim();
        if (!unit) continue;
        const active = await serviceIsActive(executor, unit);
        breached = !active;
        detail = `${unit} no está activo`;
      } else if (snapshot) {
        let value: number | null = null;
        switch (rule.metric) {
          case "cpu":
            value = snapshot.cpu.usagePercent;
            break;
          case "ram":
            value = snapshot.memory.usagePercent;
            break;
          case "disk":
            value = snapshot.disk.usagePercent;
            break;
          case "load":
            value = snapshot.cpu.loadAvg1m;
            break;
          default:
            value = null;
        }
        if (value === null) continue;
        breached = ruleBreaches(rule, value);
        detail = `${rule.metric} = ${value.toFixed(1)} (umbral ${rule.op} ${rule.threshold})`;
      } else {
        continue; // numeric rule but no snapshot this tick
      }

      if (!breached) continue;

      const delivered = await serverAlertsService.sendImmediate(
        {
          title: `Alerta: ${rule.name}`,
          body: detail,
          signals: ["metric-rule", rule.metric],
          data: { kind: "metric-rule", ruleId: rule.id, metric: rule.metric, targetId: executor.target.id },
          respectPrefs: true,
        },
      );
      if (!delivered.panel) continue;
      await serverAlertsService.markRuleFired(rule.id, executor);
      log.info({ ruleId: rule.id, metric: rule.metric, target: executor.target.id }, "Metric rule fired");
    } catch (err) {
      log.warn({ err: (err as Error).message, ruleId: rule.id, target: executor.target.id }, "Metric rule evaluation failed");
    }
  }
}

// ── Tick + lifecycle ───────────────────────────────────────────────────────

async function tick(): Promise<void> {
  if (ticking) return; // never overlap ticks
  ticking = true;
  const now = new Date();
  try {
    const targets = await targetsRepository.listView();
    const executors: Executor[] = [localExecutor];
    for (const target of targets) {
      if (!target.enabled || !target.hostFingerprint) continue;
      try {
        const executor = await getVaultExecutor(target.id);
        if (executor) executors.push(executor);
      } catch (err) {
        log.warn({ err, targetId: target.id }, "Could not open notification target");
      }
    }
    for (const executor of executors) {
      await runWithExecutor(executor, () => processScheduled(executor, now)).catch((err) =>
        log.warn({ err: (err as Error).message, target: executor.target.id }, "processScheduled failed"),
      );
      await runWithExecutor(executor, () => processRules(executor, now)).catch((err) =>
        log.warn({ err: (err as Error).message, target: executor.target.id }, "processRules failed"),
      );
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "server-alerts tick failed");
  } finally {
    ticking = false;
  }
}

export const serverAlertsWorker = {
  start(): void {
    if (timer) return;
    if (!env.SERVER_ALERTS_WORKER_ENABLED) {
      log.info("Server-alerts worker disabled (SERVER_ALERTS_WORKER_ENABLED=false)");
      return;
    }
    const intervalMs = Math.max(30_000, env.SERVER_ALERTS_WORKER_INTERVAL_MS);
    timer = setInterval(() => {
      void tick();
    }, intervalMs);
    // Do not keep the event loop alive solely for this timer.
    timer.unref?.();
    log.info({ intervalMs }, "Server-alerts worker started");
  },

  stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  },
};
