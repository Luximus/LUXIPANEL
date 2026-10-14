// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-alerts models — types + Zod schemas for the panel owner's server
 * notification preferences and custom notifications.
 *
 * Two kinds of custom notifications are persisted per-server as JSON sidecars
 * on the CONNECTED server under `${LUXIPANEL_CONFIG_DIR}/server-alerts/`:
 *   - scheduled.json → one-shot or recurring scheduled notifications.
 *   - rules.json     → metric-based rules evaluated against live server stats.
 *
 * Delivery preferences and encrypted device subscriptions live on the panel
 * host, while schedules and rules remain scoped to the connected server.
 */

import { z } from "zod";

// ── Legacy preferences compatibility ──────────────────────────────────────

export interface AlertPrefs {
  enabled?: boolean;
  statusEnabled?: boolean;
  accessEnabled?: boolean;
  cpuPct?: number;
  ramPct?: number;
  diskPct?: number;
  lowMbThreshold?: number;
  [k: string]: unknown;
}

export const prefsPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    statusEnabled: z.boolean().optional(),
    accessEnabled: z.boolean().optional(),
    cpuPct: z.number().min(0).max(100).optional(),
    ramPct: z.number().min(0).max(100).optional(),
    diskPct: z.number().min(0).max(100).optional(),
    lowMbThreshold: z.number().int().nonnegative().optional(),
  })
  .strict();

export type PrefsPatch = z.infer<typeof prefsPatchSchema>;

// ── Immediate send ─────────────────────────────────────────────────────────

export const sendImmediateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  /** Optional signal tags so LP can classify/filter the push. */
  signals: z.array(z.string().trim().min(1).max(64)).max(16).optional(),
  /** Optional structured payload forwarded to the device push data field. */
  data: z.record(z.unknown()).optional(),
});

export type SendImmediateInput = z.infer<typeof sendImmediateSchema>;

// ── Scheduled notifications ────────────────────────────────────────────────

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  /** ISO timestamp for the next (or one-shot) firing. Mutually informs `cron`. */
  scheduleAt: string | null;
  /** Cron expression (5-field) for recurring schedules. */
  cron: string | null;
  /** IANA timezone for new cron rows. Legacy rows without it remain UTC. */
  timeZone?: string | null;
  /** When true, the notification reschedules itself after firing. */
  recurring: boolean;
  enabled: boolean;
  /** Optional signal tags / payload passed through to the push. */
  signals?: string[] | null;
  /** Last time this scheduled notification fired (ISO), for audit + cron next. */
  lastFiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 5-field cron, permissive: digits, `*`, `,`, `-`, `/`. */
const CRON_RE = /^(\S+\s+){4}\S+$/;
const timeZoneSchema = z.string().min(1).max(80).refine((value) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}, "Zona horaria inválida");

export const scheduledCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2000),
    scheduleAt: z.string().datetime().nullable().optional(),
    cron: z
      .string()
      .trim()
      .regex(CRON_RE, "cron inválido (se espera expresión de 5 campos)")
      .nullable()
      .optional(),
    timeZone: timeZoneSchema.nullable().optional(),
    recurring: z.boolean().optional(),
    enabled: z.boolean().optional(),
    signals: z.array(z.string().trim().min(1).max(64)).max(16).optional(),
  })
  .refine((v) => Boolean(v.scheduleAt) || Boolean(v.cron), {
    message: "Se requiere scheduleAt (ISO) o cron",
  });

export type ScheduledCreateInput = z.infer<typeof scheduledCreateSchema>;

/** Partial update — any subset of editable fields (≥1). No cross-field refine:
 *  the repository merges onto the stored row and the worker tolerates it. */
export const scheduledUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(2000).optional(),
    scheduleAt: z.string().datetime().nullable().optional(),
    cron: z.string().trim().regex(CRON_RE, "cron inválido (se espera expresión de 5 campos)").nullable().optional(),
    timeZone: timeZoneSchema.nullable().optional(),
    recurring: z.boolean().optional(),
    enabled: z.boolean().optional(),
    signals: z.array(z.string().trim().min(1).max(64)).max(16).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada que actualizar" });

export type ScheduledUpdateInput = z.infer<typeof scheduledUpdateSchema>;

// ── Metric rules ───────────────────────────────────────────────────────────

export const METRIC_RULE_METRICS = ["cpu", "ram", "disk", "load", "service-down"] as const;
export type MetricRuleMetric = (typeof METRIC_RULE_METRICS)[number];

export const METRIC_RULE_OPS = [">=", "<=", "==", "down"] as const;
export type MetricRuleOp = (typeof METRIC_RULE_OPS)[number];

export interface MetricRule {
  id: string;
  name: string;
  metric: MetricRuleMetric;
  op: MetricRuleOp;
  /** Threshold for cpu/ram/disk/load (percent or load average). */
  threshold?: number | null;
  /** systemd unit name for the `service-down` metric. */
  service?: string | null;
  enabled: boolean;
  /** Minimum minutes between consecutive firings of this rule (anti-spam). */
  cooldownMinutes: number;
  /** Last time this rule fired (ISO), used by the cooldown gate. */
  lastFiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const metricRuleCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    metric: z.enum(METRIC_RULE_METRICS),
    op: z.enum(METRIC_RULE_OPS),
    threshold: z.number().finite().nonnegative().nullable().optional(),
    service: z.string().trim().min(1).max(128).nullable().optional(),
    enabled: z.boolean().optional(),
    cooldownMinutes: z.number().int().min(0).max(10080).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.metric === "service-down") {
      if (!v.service) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "service es obligatorio para service-down", path: ["service"] });
      }
    } else {
      // numeric metrics require a threshold and a comparison op
      if (v.threshold === undefined || v.threshold === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "threshold es obligatorio para esta métrica", path: ["threshold"] });
      }
      if (v.op === "down") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "op 'down' solo aplica a service-down", path: ["op"] });
      }
    }
  });

export type MetricRuleCreateInput = z.infer<typeof metricRuleCreateSchema>;

/** Partial update for a metric rule — any subset of editable fields (≥1). */
export const metricRuleUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    metric: z.enum(METRIC_RULE_METRICS).optional(),
    op: z.enum(METRIC_RULE_OPS).optional(),
    threshold: z.number().finite().nonnegative().nullable().optional(),
    service: z.string().trim().min(1).max(128).nullable().optional(),
    enabled: z.boolean().optional(),
    cooldownMinutes: z.number().int().min(0).max(10080).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada que actualizar" });

export type MetricRuleUpdateInput = z.infer<typeof metricRuleUpdateSchema>;

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(64) });
