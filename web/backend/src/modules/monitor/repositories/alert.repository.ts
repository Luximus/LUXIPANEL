// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Alert repository — file-backed via dataStore. Lives at:
 *   ${LUXIPANEL_CONFIG_DIR}/monitor/alert-rules.json
 *   ${LUXIPANEL_CONFIG_DIR}/monitor/alert-events.json
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { AlertRule, NewAlertRule, AlertEvent, NewAlertEvent } from "../models/index.js";

const MODULE = "monitor";
// Cap the alert-events sidecar: a rule that oscillates around its threshold
// emits one event per collector cycle, so without a bound the file grows
// forever and is read+rewritten whole on every createEvent/resolveEvent.
const MAX_EVENTS = 2000;
const EVENT_TRIM_EVERY = 25;
let _eventInsertsSinceTrim = 0;

interface StoredRule {
  id: number;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  sustainedSamples: number;
  enabled: boolean;
  mutedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredEvent {
  id: number;
  ruleId: number;
  state: string;
  triggerValue: number;
  firedAt: string;
  resolvedAt: string | null;
}

function rulesStore(executor?: Executor | null) {
  return dataStore<StoredRule>(executor, MODULE, "alert-rules");
}
function eventsStore(executor?: Executor | null) {
  return dataStore<StoredEvent>(executor, MODULE, "alert-events");
}

function ruleFromStored(d: StoredRule): AlertRule {
  return {
    ...d,
    mutedUntil: d.mutedUntil ?? null,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as AlertRule;
}

function eventFromStored(d: StoredEvent): AlertEvent {
  return {
    ...d,
    firedAt: new Date(d.firedAt),
    resolvedAt: d.resolvedAt ? new Date(d.resolvedAt) : null,
  } as unknown as AlertEvent;
}

export const alertRepository = {
  async findAllRules(executor?: Executor | null): Promise<AlertRule[]> {
    const items = await rulesStore(executor).list();
    return items.map((d) => ruleFromStored(d as unknown as StoredRule)).sort((a, b) => a.name.localeCompare(b.name));
  },

  async findEnabledRules(executor?: Executor | null): Promise<AlertRule[]> {
    const items = await rulesStore(executor).query((d) => d.enabled === true);
    return items.map((d) => ruleFromStored(d as unknown as StoredRule)).sort((a, b) => a.name.localeCompare(b.name));
  },

  async createRule(data: Omit<NewAlertRule, "id" | "createdAt" | "updatedAt">, executor?: Executor | null): Promise<AlertRule> {
    const created = await rulesStore(executor).create({
      name: data.name,
      metric: data.metric,
      operator: data.operator,
      threshold: data.threshold,
      sustainedSamples: data.sustainedSamples ?? 1,
      enabled: data.enabled ?? true,
      mutedUntil: data.mutedUntil ?? null,
      createdAt: "",
      updatedAt: "",
    } as StoredRule & { id?: string | number });
    return ruleFromStored(created as unknown as StoredRule);
  },

  async updateRule(id: number, data: Partial<Omit<NewAlertRule, "id" | "createdAt">>, executor?: Executor | null): Promise<AlertRule | undefined> {
    const updated = await rulesStore(executor).update(id, data as Partial<StoredRule>);
    return updated ? ruleFromStored(updated as unknown as StoredRule) : undefined;
  },

  async deleteRule(id: number, executor?: Executor | null): Promise<boolean> {
    return rulesStore(executor).delete(id);
  },

  async createEvent(data: Omit<NewAlertEvent, "id" | "firedAt">, executor?: Executor | null): Promise<AlertEvent> {
    const created = await eventsStore(executor).create({
      ruleId: data.ruleId,
      state: data.state ?? "firing",
      triggerValue: data.triggerValue ?? 0,
      firedAt: new Date().toISOString(),
      resolvedAt: null,
    } as StoredEvent & { id?: string | number });
    // Trim every N inserts (process-local counter) so the sidecar stays bounded
    // without paying a full read+rewrite on every single event.
    if (++_eventInsertsSinceTrim >= EVENT_TRIM_EVERY) {
      _eventInsertsSinceTrim = 0;
      await this.trimEvents(MAX_EVENTS, executor);
    }
    return eventFromStored(created as unknown as StoredEvent);
  },

  /** Keep at most `max` newest events (single read + rewrite transaction). */
  async trimEvents(max: number, executor?: Executor | null): Promise<void> {
    await eventsStore(executor).transaction(async (current) => {
      const rows = Object.values(current) as StoredEvent[];
      if (rows.length <= max) return { next: current, result: undefined };
      const keep = new Set(
        rows
          .slice()
          .sort((a, b) => (b.firedAt > a.firedAt ? 1 : b.firedAt < a.firedAt ? -1 : 0))
          .slice(0, max)
          .map((r) => r.id),
      );
      const next: Record<string, StoredEvent> = {};
      for (const [key, row] of Object.entries(current)) {
        if (keep.has((row as StoredEvent).id)) next[key] = row as StoredEvent;
      }
      return { next, result: undefined };
    });
  },

  async resolveEvent(ruleId: number, executor?: Executor | null): Promise<boolean> {
    const open = await eventsStore(executor).query((d) => d.ruleId === ruleId && d.state === "firing" && d.resolvedAt === null);
    if (open.length === 0) return false;
    const now = new Date().toISOString();
    for (const ev of open) {
      await eventsStore(executor).update(ev.id, { resolvedAt: now });
    }
    return true;
  },

  /** Recent alert events (newest first), capped. Read from the per-server
   *  sidecar the evaluator writes (`createEvent`/`resolveEvent`). */
  async findRecentEvents(limit = 100, executor?: Executor | null): Promise<AlertEvent[]> {
    const items = await eventsStore(executor).list();
    return items
      .map((d) => eventFromStored(d as unknown as StoredEvent))
      .sort((a, b) => b.firedAt.getTime() - a.firedAt.getTime())
      .slice(0, Math.max(1, limit));
  },
};
