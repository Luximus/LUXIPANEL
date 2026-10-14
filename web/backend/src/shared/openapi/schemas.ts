// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared OpenAPI component schemas.
 *
 * Registers all reusable schemas into the registry so they can be
 * referenced as $ref components throughout the spec.
 */

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry.js";

// Extend Zod prototype once with .openapi() method
extendZodWithOpenApi(z);

// ── Generic responses ──────────────────────────────────────────────────────

export const ErrorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({
    ok: z.literal(false),
    error: z.string().openapi({ example: "Not found" }),
    code: z.string().openapi({ example: "NOT_FOUND" }),
  }).openapi({ description: "Standard error envelope" }),
);

export const SuccessResponseSchema = registry.register(
  "SuccessResponse",
  z.object({
    ok: z.literal(true),
    message: z.string().optional(),
  }).openapi({ description: "Generic success envelope" }),
);

export const PaginationMetaSchema = registry.register(
  "PaginationMeta",
  z.object({
    total: z.number().int().openapi({ example: 42 }),
    page: z.number().int().openapi({ example: 1 }),
    pageSize: z.number().int().openapi({ example: 20 }),
    totalPages: z.number().int().openapi({ example: 3 }),
  }),
);

// ── Auth ───────────────────────────────────────────────────────────────────

export const SessionUserSchema = registry.register(
  "SessionUser",
  z.object({
    userId: z.number().int().openapi({ example: 1 }),
    username: z.string().openapi({ example: "admin" }),
    displayName: z.string().openapi({ example: "Administrator" }),
    role: z.string().openapi({ example: "admin" }),
    modules: z.array(z.string()).openapi({ example: ["mail", "users", "admin"] }),
    kind: z.enum(["admin", "user"]),
  }).openapi({ description: "Authenticated session payload" }),
);

export const LoginBodySchema = registry.register(
  "LoginBody",
  z.object({
    username: z.string().openapi({ example: "admin" }),
    password: z.string().openapi({ example: "SecretPass1" }),
    remember: z.boolean().optional().openapi({ example: false }),
  }),
);

export const LoginResponseSchema = registry.register(
  "LoginResponse",
  z.object({
    ok: z.literal(true),
    user: SessionUserSchema,
    expiresAt: z.number().openapi({ example: 1740000000000 }),
  }),
);

// ── Users ──────────────────────────────────────────────────────────────────

export const PanelUserSchema = registry.register(
  "PanelUser",
  z.object({
    id: z.number().int(),
    username: z.string(),
    displayName: z.string().nullable(),
    email: z.string().email().nullable(),
    roleId: z.number().int().nullable(),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }).openapi({ description: "Panel user account" }),
);

export const RoleSchema = registry.register(
  "Role",
  z.object({
    id: z.number().int(),
    name: z.string().openapi({ example: "mail-operator" }),
    description: z.string().nullable(),
    modules: z.array(z.string()).openapi({ example: ["mail"] }),
    createdAt: z.string().datetime(),
  }).openapi({ description: "User role with module permissions" }),
);

// ── Mail ───────────────────────────────────────────────────────────────────

export const MailAccountSchema = registry.register(
  "MailAccount",
  z.object({
    id: z.number().int(),
    email: z.string().email().openapi({ example: "user@example.com" }),
    domain: z.string().openapi({ example: "example.com" }),
    quota: z.number().int().openapi({ example: 1024, description: "Quota in MB" }),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
  }).openapi({ description: "Mail account" }),
);

export const ForwardSchema = registry.register(
  "Forward",
  z.object({
    id: z.number().int(),
    accountId: z.number().int(),
    destination: z.string().email(),
    enabled: z.boolean(),
  }),
);

// ── Monitor ────────────────────────────────────────────────────────────────

export const StatsSnapshotSchema = registry.register(
  "StatsSnapshot",
  z.object({
    ts: z.number().openapi({ description: "Unix timestamp ms", example: 1740000000000 }),
    cpu: z.object({
      usage: z.number().openapi({ description: "CPU usage %", example: 12.5 }),
      loadAvg: z.array(z.number()).openapi({ example: [0.8, 0.6, 0.5] }),
    }),
    memory: z.object({
      totalMb: z.number(),
      usedMb: z.number(),
      freeMb: z.number(),
      usagePercent: z.number(),
    }),
    disk: z.object({
      totalGb: z.number(),
      usedGb: z.number(),
      freeGb: z.number(),
      usagePercent: z.number(),
    }),
    network: z.object({
      rxBytesPerSec: z.number(),
      txBytesPerSec: z.number(),
    }),
  }).openapi({ description: "System metrics snapshot" }),
);

export const AlertRuleSchema = registry.register(
  "AlertRule",
  z.object({
    id: z.number().int(),
    name: z.string(),
    metric: z.string().openapi({ example: "cpu_usage_percent" }),
    operator: z.enum(["gt", "lt", "gte", "lte"]),
    threshold: z.number(),
    sustainedSamples: z.number().int(),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
  }),
);

// ── Webhooks ───────────────────────────────────────────────────────────────

export const WebhookSchema = registry.register(
  "Webhook",
  z.object({
    id: z.number().int(),
    name: z.string(),
    url: z.string().url(),
    events: z.array(z.string()),
    enabled: z.boolean(),
    failureCount: z.number().int(),
    createdAt: z.string().datetime(),
  }),
);

export const ApiKeySchema = registry.register(
  "ApiKey",
  z.object({
    id: z.number().int(),
    name: z.string(),
    keyPrefix: z.string().openapi({ example: "lxp_abc123de" }),
    scopes: z.array(z.string()),
    expiresAt: z.string().datetime().nullable(),
    lastUsedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  }),
);

// ── Backup ─────────────────────────────────────────────────────────────────

export const BackupJobSchema = registry.register(
  "BackupJob",
  z.object({
    id: z.number().int(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    type: z.string(),
    storagePath: z.string().nullable(),
    sizeBytes: z.number().nullable(),
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    error: z.string().nullable(),
    createdAt: z.string().datetime(),
  }),
);
