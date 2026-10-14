// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Calendars controller — per-account calendar CRUD.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { calendarRepository } from "../repositories/index.js";
import { ConflictError, NotFoundError } from "../../../shared/errors/index.js";
import { resolveOwnedAccountByParamId as resolveAccount } from "./mailbox-account.helpers.js";

const createCalendarSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(4000).optional().nullable(),
  color: z.string().min(1).max(32).default("#3b82f6"),
  timezone: z.string().min(1).max(64).default("UTC"),
  enabled: z.boolean().default(true),
});

const updateCalendarSchema = createCalendarSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  "No fields to update",
);

export const calendarsController = {
  /** GET /api/accounts/:accountId/calendars */
  list: asyncHandler(async (req: Request, res: Response) => {
    const account = await resolveAccount(req);
    const rows = await calendarRepository.listByAccountId(account.id);
    res.json({ ok: true, data: rows });
  }),

  /** POST /api/accounts/:accountId/calendars */
  create: asyncHandler(async (req: Request, res: Response) => {
    const account = await resolveAccount(req);
    const body = createCalendarSchema.parse(req.body);
    const name = body.name.trim();
    const existing = await calendarRepository.findByAccountAndName(account.id, name);
    if (existing) throw new ConflictError(`Calendar "${name}" already exists`);

    const created = await calendarRepository.create({
      accountId: account.id,
      name,
      description: body.description?.trim() || null,
      color: body.color.trim(),
      timezone: body.timezone.trim(),
      enabled: body.enabled,
    });
    res.status(201).json({ ok: true, data: created });
  }),

  /** PUT /api/accounts/:accountId/calendars/:calendarId */
  update: asyncHandler(async (req: Request, res: Response) => {
    const account = await resolveAccount(req);
    const calendarId = parseInt(String(req.params["calendarId"]), 10);
    const body = updateCalendarSchema.parse(req.body);

    const existing = await calendarRepository.findById(calendarId);
    if (!existing || existing.accountId !== account.id) throw new NotFoundError("Calendar");

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const nextName = body.name.trim();
      const conflict = await calendarRepository.findByAccountAndName(account.id, nextName);
      if (conflict && conflict.id !== existing.id) {
        throw new ConflictError(`Calendar "${nextName}" already exists`);
      }
      updates["name"] = nextName;
    }
    if (body.description !== undefined) updates["description"] = body.description?.trim() || null;
    if (body.color !== undefined) updates["color"] = body.color.trim();
    if (body.timezone !== undefined) updates["timezone"] = body.timezone.trim();
    if (body.enabled !== undefined) updates["enabled"] = body.enabled;

    const updated = await calendarRepository.update(existing.id, updates);
    if (!updated) throw new NotFoundError("Calendar");
    res.json({ ok: true, data: updated });
  }),

  /** DELETE /api/accounts/:accountId/calendars/:calendarId */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const account = await resolveAccount(req);
    const calendarId = parseInt(String(req.params["calendarId"]), 10);
    const existing = await calendarRepository.findById(calendarId);
    if (!existing || existing.accountId !== account.id) throw new NotFoundError("Calendar");
    await calendarRepository.delete(existing.id);
    res.json({ ok: true });
  }),
};
