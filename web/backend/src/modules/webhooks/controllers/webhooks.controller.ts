// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhooks controller — CRUD for webhook registrations.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { webhookRepository } from "../repositories/webhook.repository.js";
import { NotFoundError } from "../../../shared/errors/index.js";
import { WEBHOOK_EVENTS } from "../models/index.js";
import { randomHex } from "../../../shared/utils/crypto.js";
import { webhookDispatcher } from "../services/webhook-dispatcher.service.js";
import { deliveryRepository } from "../repositories/delivery.repository.js";
import { runOnPanelHost } from "../../../shared/executor/index.js";

const createSchema = z.object({
  name: z.string().min(2).max(128).trim(),
  url: z.string().url().max(2048),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  enabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

export const webhooksController = {
  deliveries: asyncHandler(async (req: Request, res: Response) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const data = await runOnPanelHost(async () => {
      const existing = await webhookRepository.findById(id);
      if (!existing) throw new NotFoundError("Webhook");
      return deliveryRepository.recent(id);
    });
    res.json({ ok: true, data });
  }),

  test: asyncHandler(async (req: Request, res: Response) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const data = await runOnPanelHost(() => webhookDispatcher.test(id));
    res.json({ ok: data.delivered, data });
  }),
  /** GET /api/webhooks — list all webhooks. */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const data = await runOnPanelHost(() => webhookRepository.findAll());
    // Never return secret in list
    res.json({ ok: true, data: data.map(({ secret: _s, ...w }) => w) });
  }),

  /** POST /api/webhooks — create webhook (returns generated secret once). */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createSchema.parse(req.body);
    const secret = randomHex(32);
    const webhook = await runOnPanelHost(() => webhookRepository.create({ ...body, secret }));
    res.status(201).json({ ok: true, data: { ...webhook, secret } });
  }),

  /** PUT /api/webhooks/:id — update (secret is not changed here). */
  update: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const body = updateSchema.parse(req.body);

    const updated = await runOnPanelHost(async () => {
      const existing = await webhookRepository.findById(id);
      if (!existing) throw new NotFoundError("Webhook");
      return webhookRepository.update(id, body);
    });
    const { secret: _s, ...safe } = updated!;
    res.json({ ok: true, data: safe });
  }),

  /** POST /api/webhooks/:id/regenerate-secret — rotate signing secret. */
  regenerateSecret: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const secret = randomHex(32);
    await runOnPanelHost(async () => {
      const existing = await webhookRepository.findById(id);
      if (!existing) throw new NotFoundError("Webhook");
      await webhookRepository.update(id, { secret });
    });
    res.json({ ok: true, data: { secret } });
  }),

  /** DELETE /api/webhooks/:id — delete webhook. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const ok = await runOnPanelHost(() => webhookRepository.delete(id));
    if (!ok) throw new NotFoundError("Webhook");
    res.json({ ok: true });
  }),

  /** GET /api/webhooks/events — list supported event types. */
  events: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ ok: true, data: [...WEBHOOK_EVENTS] });
  }),
};
