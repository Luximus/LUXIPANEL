// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-alerts repository — file-backed via dataStore, same pattern as the
 * notifications module.
 *
 * Layout on the CONNECTED server (per-server isolation):
 *   ${LUXIPANEL_CONFIG_DIR}/server-alerts/scheduled.json
 *   ${LUXIPANEL_CONFIG_DIR}/server-alerts/rules.json
 *
 * `dataStore(executor, "server-alerts", "<collection>")` resolves the sidecar
 * through the per-request/per-worker executor (kv-store) — never the panel
 * host. UUID ids so worker writes never collide with concurrent request writes.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import { randomUUID } from "node:crypto";
import type { Executor } from "../../../shared/executor/index.js";
import type {
  MetricRule,
  ScheduledNotification,
} from "../models/server-alerts.model.js";

const MODULE = "server-alerts";
const SCHEDULED = "scheduled";
const RULES = "rules";

function scheduledStore(executor?: Executor | null) {
  return dataStore<ScheduledNotification>(executor, MODULE, SCHEDULED, {
    idStrategy: "uuid",
    // We control createdAt/updatedAt explicitly so the worker's reschedule
    // writes don't reset createdAt.
    timestamps: false,
  });
}

function rulesStore(executor?: Executor | null) {
  return dataStore<MetricRule>(executor, MODULE, RULES, {
    idStrategy: "uuid",
    timestamps: false,
  });
}

export const serverAlertsRepository = {
  // ── Scheduled notifications ──────────────────────────────────────────────

  async listScheduled(executor?: Executor | null): Promise<ScheduledNotification[]> {
    const rows = scheduledStore(executor);
    const all = await rows.list();
    if (!all.some((row) => !row.id)) return all as ScheduledNotification[];
    await rows.transaction(async (current) => {
      const legacy = current[""];
      if (legacy) {
        const id = randomUUID();
        delete current[""];
        current[id] = { ...legacy, id };
      }
      return { next: current, result: undefined };
    });
    return rows.list() as Promise<ScheduledNotification[]>;
  },

  async createScheduled(
    entry: Omit<ScheduledNotification, "id" | "createdAt" | "updatedAt">,
    executor?: Executor | null,
  ): Promise<ScheduledNotification> {
    const now = new Date().toISOString();
    const row = {
      ...entry,
      createdAt: now,
      updatedAt: now,
    };
    const created = await scheduledStore(executor).create(row as ScheduledNotification);
    return created as ScheduledNotification;
  },

  async updateScheduled(
    id: string,
    patch: Partial<ScheduledNotification>,
    executor?: Executor | null,
  ): Promise<ScheduledNotification | null> {
    const updated = await scheduledStore(executor).update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    return (updated as ScheduledNotification | null) ?? null;
  },

  async deleteScheduled(id: string, executor?: Executor | null): Promise<boolean> {
    return scheduledStore(executor).delete(id);
  },

  // ── Metric rules ─────────────────────────────────────────────────────────

  async listRules(executor?: Executor | null): Promise<MetricRule[]> {
    const rows = rulesStore(executor);
    const all = await rows.list();
    if (!all.some((row) => !row.id)) return all as MetricRule[];
    await rows.transaction(async (current) => {
      const legacy = current[""];
      if (legacy) {
        const id = randomUUID();
        delete current[""];
        current[id] = { ...legacy, id };
      }
      return { next: current, result: undefined };
    });
    return rows.list() as Promise<MetricRule[]>;
  },

  async createRule(
    entry: Omit<MetricRule, "id" | "createdAt" | "updatedAt">,
    executor?: Executor | null,
  ): Promise<MetricRule> {
    const now = new Date().toISOString();
    const row = {
      ...entry,
      createdAt: now,
      updatedAt: now,
    };
    const created = await rulesStore(executor).create(row as MetricRule);
    return created as MetricRule;
  },

  async updateRule(
    id: string,
    patch: Partial<MetricRule>,
    executor?: Executor | null,
  ): Promise<MetricRule | null> {
    const updated = await rulesStore(executor).update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    return (updated as MetricRule | null) ?? null;
  },

  async deleteRule(id: string, executor?: Executor | null): Promise<boolean> {
    return rulesStore(executor).delete(id);
  },
};
