// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Contacts controller — address book CRUD + autocomplete.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { parsePageQuery } from "../../../shared/http/pagination.js";
import { contactRepository } from "../repositories/index.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { ConflictError, NotFoundError } from "../../../shared/errors/index.js";
import { resolveOwnedAccountByParamId as resolveAccount } from "./mailbox-account.helpers.js";

const createContactSchema = z.object({
  email: emailSchema,
  displayName: z.string().max(128).optional().nullable(),
});

const updateContactSchema = z.object({
  email: emailSchema.optional(),
  displayName: z.string().max(128).optional().nullable(),
  useCount: z.number().int().min(0).optional(),
}).refine((body) => Object.keys(body).length > 0, "No fields to update");

export const contactsController = {
  /** GET /api/mail/:accountId/contacts?q=search — search contacts. */
  search: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const query = String(req.query.q || "");
    // Shared clamp: this endpoint used to accept an UNBOUNDED `?limit=`
    // (and `NaN` for garbage) before the `Math.min` at the call site.
    const { limit } = parsePageQuery(req.query, { defaultLimit: 10, maxLimit: 50 });

    const results = await contactRepository.search(accountId, query, limit);

    res.json({
      ok: true,
      data: results.map((c) => ({
        id: c.id,
        email: c.email,
        displayName: c.displayName,
        useCount: c.useCount,
      })),
    });
  }),

  /** GET /api/accounts/:accountId/contacts — list full account contacts. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const account = await resolveAccount(req);
    const rows = await contactRepository.list(account.id);
    res.json({ ok: true, data: rows });
  }),

  /** POST /api/accounts/:accountId/contacts — create contact. */
  create: asyncHandler(async (req: Request, res: Response) => {
    const account = await resolveAccount(req);
    const body = createContactSchema.parse(req.body);

    const existing = await contactRepository.search(account.id, body.email, 1);
    if (existing.some((item) => item.email.toLowerCase() === body.email.toLowerCase())) {
      throw new ConflictError(`Contact ${body.email} already exists`);
    }

    const created = await contactRepository.create(
      account.id,
      body.email.toLowerCase(),
      body.displayName?.trim() || undefined,
    );
    res.status(201).json({ ok: true, data: created });
  }),

  /** PUT /api/accounts/:accountId/contacts/:contactId — update contact. */
  update: asyncHandler(async (req: Request, res: Response) => {
    const account = await resolveAccount(req);
    const contactId = parseInt(String(req.params["contactId"]), 10);
    const body = updateContactSchema.parse(req.body);

    const existing = await contactRepository.findById(contactId);
    if (!existing || existing.accountId !== account.id) throw new NotFoundError("Contact");

    if (body.email && body.email.toLowerCase() !== existing.email.toLowerCase()) {
      const conflict = await contactRepository.search(account.id, body.email, 10);
      if (conflict.some((item) => item.id !== existing.id && item.email.toLowerCase() === body.email!.toLowerCase())) {
        throw new ConflictError(`Contact ${body.email} already exists`);
      }
    }

    const updated = await contactRepository.update(existing.id, {
      email: body.email?.toLowerCase(),
      displayName: body.displayName === undefined ? existing.displayName : (body.displayName || null),
      useCount: body.useCount,
    });
    if (!updated) throw new NotFoundError("Contact");
    res.json({ ok: true, data: updated });
  }),

  /** DELETE /api/accounts/:accountId/contacts/:contactId — delete contact. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const account = await resolveAccount(req);
    const contactId = parseInt(String(req.params["contactId"]), 10);
    const existing = await contactRepository.findById(contactId);
    if (!existing || existing.accountId !== account.id) throw new NotFoundError("Contact");
    await contactRepository.delete(contactId);
    res.json({ ok: true });
  }),
};
