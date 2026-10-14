// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Signatures controller — manage rich-text email signatures per account.
 * Server-only: state lives in the account sidecar JSON on the remote target
 * (same file as forwards/filters/autoresponder). No sieve/postfix side effect:
 * signatures are presentation metadata consumed by the inbox composer.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { accountSidecarService, type SidecarSignature } from "../services/account-sidecar.service.js";
import { NotFoundError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { fnv1aId } from "./accounts.helpers.js";
import { resolveOwnedAccountAddress as resolveAddress } from "./mailbox-account.helpers.js";

const createSignatureSchema = z.object({
  senderName: z.string().max(128).default(""),
  senderEmail: emailSchema.optional().nullable(),
  linkToSender: z.boolean().default(false),
  html: z.string().max(64 * 1024).default(""),
});

const updateSignatureSchema = createSignatureSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  "No fields to update",
);

function nowIso(): string {
  return new Date().toISOString();
}

export const signaturesController = {
  /** GET /api/accounts/:accountId/signatures */
  list: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const executor = getExecutor(req);
    const sidecar = await accountSidecarService.read(executor, address);
    res.json({ ok: true, data: sidecar.signatures });
  }),

  /** POST /api/accounts/:accountId/signatures */
  create: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const body = createSignatureSchema.parse(req.body);
    const executor = getExecutor(req);

    const ts = nowIso();
    const newSignature: SidecarSignature = {
      id: fnv1aId(`${address}:signature:${body.senderEmail ?? address}:${ts}`),
      senderName: body.senderName.trim(),
      senderEmail: (body.senderEmail ?? address).toLowerCase(),
      linkToSender: body.linkToSender,
      html: body.html,
      createdAt: ts,
      updatedAt: ts,
    };

    await accountSidecarService.update(executor, address, (current) => ({
      ...current,
      signatures: [...current.signatures, newSignature],
    }));

    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.status(201).json({ ok: true, data: newSignature });
  }),

  /** PUT /api/accounts/:accountId/signatures/:signatureId */
  update: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const signatureId = Number.parseInt(String(req.params["signatureId"]), 10);
    const body = updateSignatureSchema.parse(req.body);
    const executor = getExecutor(req);

    const sidecar = await accountSidecarService.read(executor, address);
    const existing = sidecar.signatures.find((s) => s.id === signatureId);
    if (!existing) throw new NotFoundError("Signature");

    const updated: SidecarSignature = {
      ...existing,
      ...(body.senderName !== undefined ? { senderName: body.senderName.trim() } : {}),
      ...(body.senderEmail !== undefined && body.senderEmail !== null
        ? { senderEmail: body.senderEmail.toLowerCase() }
        : {}),
      ...(body.linkToSender !== undefined ? { linkToSender: body.linkToSender } : {}),
      ...(body.html !== undefined ? { html: body.html } : {}),
      updatedAt: nowIso(),
    };

    await accountSidecarService.update(executor, address, (current) => ({
      ...current,
      signatures: current.signatures.map((s) => (s.id === signatureId ? updated : s)),
    }));

    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.json({ ok: true, data: updated });
  }),

  /** DELETE /api/accounts/:accountId/signatures/:signatureId */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const signatureId = Number.parseInt(String(req.params["signatureId"]), 10);
    const executor = getExecutor(req);

    const sidecar = await accountSidecarService.read(executor, address);
    if (!sidecar.signatures.some((s) => s.id === signatureId)) throw new NotFoundError("Signature");

    await accountSidecarService.update(executor, address, (current) => ({
      ...current,
      signatures: current.signatures.filter((s) => s.id !== signatureId),
    }));

    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.json({ ok: true });
  }),
};
