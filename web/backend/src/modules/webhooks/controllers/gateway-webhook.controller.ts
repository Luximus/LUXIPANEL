// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Gateway webhook controller — admin CRUD for inbound (receive-data) webhooks.
 *
 * All state is INSTANCE-level (panel host); the repository pins `localExecutor`,
 * so these handlers never touch the per-request executor.
 *
 * GET    /api/webhooks/categories            — categories + counts + functional flag
 * GET    /api/webhooks/gateways              — list (optional ?category=)
 * GET    /api/webhooks/gateways/:id          — single (incl. recent payloads)
 * POST   /api/webhooks/gateways              — create
 * PUT    /api/webhooks/gateways/:id          — update
 * DELETE /api/webhooks/gateways/:id          — delete
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { gatewayWebhookRepository } from "../repositories/gateway-webhook.repository.js";
import {
  WEBHOOK_CATEGORIES,
  DATA_FIELD_TYPES,
  toPublic,
  type WebhookCategory,
} from "../models/gateway-webhook.model.js";
import { mergeApiKeys, newToken } from "../services/gateway-webhook.service.js";

/** Categories that are implemented today. Others are reserved placeholders. */
const FUNCTIONAL_CATEGORIES: WebhookCategory[] = ["receive-data"];

const dataFieldSchema = z.object({
  name: z.string().min(1).max(128).trim(),
  description: z.string().max(512).optional().default(""),
  type: z.enum(DATA_FIELD_TYPES).default("text"),
  defaultValue: z.string().max(2048).optional().default(""),
  required: z.boolean().default(false),
  multiline: z.boolean().default(false),
});

const dataStructureSchema = z
  .object({
    name: z.string().max(128).optional().default(""),
    strict: z.boolean().default(false),
    fields: z.array(dataFieldSchema).default([]),
  })
  .nullable()
  .optional();

const apiKeyInputSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().min(1).max(128).trim(),
  value: z.string().max(512).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(128).trim(),
  category: z.enum(WEBHOOK_CATEGORIES).default("receive-data"),
  enabled: z.boolean().default(true),
  ipRestrictions: z.string().max(2048).optional().default(""),
  apiKeys: z.array(apiKeyInputSchema).max(20).optional().default([]),
  dataStructure: dataStructureSchema,
  getRequestHeaders: z.boolean().default(false),
  getRequestHttpMethod: z.boolean().default(false),
  jsonPassThrough: z.boolean().default(false),
});

const updateSchema = createSchema.partial();

/** Build the public ingest URL the caller should POST to. */
function ingestUrl(req: Request, token: string): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host || "";
  return `${proto}://${host}/api/hooks/in/${token}`;
}

function withUrl(req: Request, w: ReturnType<typeof toPublic>) {
  return { ...w, ingestUrl: ingestUrl(req, w.token) };
}

export const gatewayWebhookController = {
  /** GET /api/webhooks/categories */
  categories: asyncHandler(async (_req: Request, res: Response) => {
    const all = await gatewayWebhookRepository.findAll();
    const data = WEBHOOK_CATEGORIES.map((id) => ({
      id,
      functional: FUNCTIONAL_CATEGORIES.includes(id),
      count: all.filter((w) => w.category === id).length,
    }));
    res.json({ ok: true, data });
  }),

  /** GET /api/webhooks/gateways */
  list: asyncHandler(async (req: Request, res: Response) => {
    const category = req.query.category ? String(req.query.category) : null;
    let items = await gatewayWebhookRepository.findAll();
    if (category) items = items.filter((w) => w.category === category);
    res.json({ ok: true, data: items.map((w) => withUrl(req, toPublic(w))) });
  }),

  /** GET /api/webhooks/gateways/:id */
  get: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const w = await gatewayWebhookRepository.findById(id);
    if (!w) throw new NotFoundError("Webhook");
    res.json({ ok: true, data: withUrl(req, toPublic(w)) });
  }),

  /** POST /api/webhooks/gateways */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createSchema.parse(req.body);
    if (!FUNCTIONAL_CATEGORIES.includes(body.category)) {
      throw new ValidationError(`La categoría "${body.category}" aún no está disponible.`);
    }
    const apiKeys = mergeApiKeys([], body.apiKeys);
    const created = await gatewayWebhookRepository.create({
      category: body.category,
      name: body.name,
      token: newToken(),
      enabled: body.enabled,
      apiKeys,
      ipRestrictions: body.ipRestrictions,
      dataStructure: body.dataStructure ?? null,
      getRequestHeaders: body.getRequestHeaders,
      getRequestHttpMethod: body.getRequestHttpMethod,
      jsonPassThrough: body.jsonPassThrough,
      receivedCount: 0,
      lastReceivedAt: null,
      recentPayloads: [],
    });
    res.status(201).json({ ok: true, data: withUrl(req, toPublic(created)) });
  }),

  /** PUT /api/webhooks/gateways/:id */
  update: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const existing = await gatewayWebhookRepository.findById(id);
    if (!existing) throw new NotFoundError("Webhook");
    const body = updateSchema.parse(req.body);

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.ipRestrictions !== undefined) patch.ipRestrictions = body.ipRestrictions;
    if (body.dataStructure !== undefined) patch.dataStructure = body.dataStructure ?? null;
    if (body.getRequestHeaders !== undefined) patch.getRequestHeaders = body.getRequestHeaders;
    if (body.getRequestHttpMethod !== undefined) patch.getRequestHttpMethod = body.getRequestHttpMethod;
    if (body.jsonPassThrough !== undefined) patch.jsonPassThrough = body.jsonPassThrough;
    if (body.apiKeys !== undefined) patch.apiKeys = mergeApiKeys(existing.apiKeys ?? [], body.apiKeys);

    const updated = await gatewayWebhookRepository.update(id, patch);
    res.json({ ok: true, data: withUrl(req, toPublic(updated!)) });
  }),

  /** DELETE /api/webhooks/gateways/:id */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const ok = await gatewayWebhookRepository.delete(id);
    if (!ok) throw new NotFoundError("Webhook");
    res.json({ ok: true });
  }),
};
