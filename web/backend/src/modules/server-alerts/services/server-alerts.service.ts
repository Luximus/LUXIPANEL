// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-alerts business logic. Preferences and device delivery live on the
 * panel host; schedules and rules are stored per connected server.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { serverAlertsRepository } from "../repositories/server-alerts.repository.js";
import { notificationDeliveryService } from "./notification-delivery.service.js";
import type {
  AlertPrefs,
  MetricRule,
  MetricRuleCreateInput,
  MetricRuleUpdateInput,
  PrefsPatch,
  ScheduledCreateInput,
  ScheduledUpdateInput,
  ScheduledNotification,
  SendImmediateInput,
} from "../models/server-alerts.model.js";

const log = createModuleLogger("server-alerts");

export const serverAlertsService = {
  // ── Compatibility preferences (persisted locally for the caller) ────────

  /** Compatibility view for older clients. */
  async getPrefs(userId: number, targetId: string): Promise<AlertPrefs> {
    const p = await notificationDeliveryService.getPreferences(userId, targetId);
    return { enabled: p.enabled, statusEnabled: p.rules, accessEnabled: p.manual };
  },

  /** Compatibility writer; metric thresholds now belong to rules. */
  async setPrefs(patch: PrefsPatch, userId: number, targetId: string): Promise<AlertPrefs> {
    if (patch.cpuPct !== undefined || patch.ramPct !== undefined || patch.diskPct !== undefined || patch.lowMbThreshold !== undefined) {
      throw new ValidationError("Los umbrales antiguos ya no se usan; crea o edita una regla por métrica");
    }
    const p = await notificationDeliveryService.setPreferences(userId, targetId, {
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.statusEnabled !== undefined ? { rules: patch.statusEnabled } : {}),
      ...(patch.accessEnabled !== undefined ? { manual: patch.accessEnabled } : {}),
    });
    return { enabled: p.enabled, statusEnabled: p.rules, accessEnabled: p.manual };
  },

  // ── Immediate delivery ───────────────────────────────────────────────────

  /** Persist an in-panel notice and fan out to enabled device channels. */
  async sendImmediate(
    input: SendImmediateInput & { respectPrefs?: boolean; recipientUsername?: string; targetUserId?: number },
    targetId?: string | null,
  ) {
    const resolvedTargetId = targetId || (typeof input.data?.targetId === "string" ? input.data.targetId : null);
    if (!resolvedTargetId && !input.recipientUsername) throw new ValidationError("No se pudo determinar el servidor o destinatario del aviso");
    const kind = input.data?.kind;
    const category = kind === "scheduled" ? "scheduled" : kind === "metric-rule" ? "rules" : kind === "test" ? "test" : "manual";
    return notificationDeliveryService.send({
      targetId: resolvedTargetId ?? "local", category, title: input.title, body: input.body,
      recipientUsername: input.recipientUsername, targetUserId: input.targetUserId,
      respectPrefs: input.respectPrefs,
    });
  },

  // ── Scheduled notifications (per-server sidecar) ──────────────────────────

  listScheduled(executor: Executor): Promise<ScheduledNotification[]> {
    return serverAlertsRepository.listScheduled(executor);
  },

  createScheduled(input: ScheduledCreateInput, executor: Executor): Promise<ScheduledNotification> {
    return serverAlertsRepository.createScheduled(
      {
        title: input.title,
        body: input.body,
        scheduleAt: input.scheduleAt ?? null,
        cron: input.cron ?? null,
        timeZone: input.timeZone ?? null,
        recurring: Boolean(input.cron),
        enabled: input.enabled ?? true,
        signals: input.signals ?? null,
        lastFiredAt: null,
      },
      executor,
    );
  },

  /** Edit a scheduled notification (partial). null = not found. */
  updateScheduled(
    id: string,
    patch: ScheduledUpdateInput,
    executor: Executor,
  ): Promise<ScheduledNotification | null> {
    return serverAlertsRepository.updateScheduled(id, patch, executor);
  },

  async deleteScheduled(id: string, executor: Executor): Promise<boolean> {
    return serverAlertsRepository.deleteScheduled(id, executor);
  },

  // ── Metric rules (per-server sidecar) ─────────────────────────────────────

  listRules(executor: Executor): Promise<MetricRule[]> {
    return serverAlertsRepository.listRules(executor);
  },

  createRule(input: MetricRuleCreateInput, executor: Executor): Promise<MetricRule> {
    return serverAlertsRepository.createRule(
      {
        name: input.name,
        metric: input.metric,
        op: input.op,
        threshold: input.threshold ?? null,
        service: input.service ?? null,
        enabled: input.enabled ?? true,
        cooldownMinutes: input.cooldownMinutes ?? 30,
        lastFiredAt: null,
      },
      executor,
    );
  },

  /** Edit a metric rule (partial). null = not found. */
  updateRule(id: string, patch: MetricRuleUpdateInput, executor: Executor): Promise<MetricRule | null> {
    return serverAlertsRepository.updateRule(id, patch, executor);
  },

  async deleteRule(id: string, executor: Executor): Promise<boolean> {
    return serverAlertsRepository.deleteRule(id, executor);
  },

  // ── Worker-facing helpers (no host argument → resolve from instance) ──────

  /** Mark a scheduled notification as fired (and optionally reschedule/disable). */
  async markScheduledFired(
    id: string,
    patch: Partial<ScheduledNotification>,
    executor: Executor,
  ): Promise<void> {
    try {
      await serverAlertsRepository.updateScheduled(id, { ...patch, lastFiredAt: new Date().toISOString() }, executor);
    } catch (err) {
      log.warn({ err: (err as Error).message, id }, "Failed to persist scheduled-fired state");
    }
  },

  /** Stamp a rule's lastFiredAt for the cooldown gate. */
  async markRuleFired(id: string, executor: Executor): Promise<void> {
    try {
      await serverAlertsRepository.updateRule(id, { lastFiredAt: new Date().toISOString() }, executor);
    } catch (err) {
      log.warn({ err: (err as Error).message, id }, "Failed to persist rule-fired state");
    }
  },
};

export type { AlertPrefs };
