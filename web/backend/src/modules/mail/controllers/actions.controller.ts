// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Actions controller — IMAP message operations (move, delete, flag).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { imapService } from "../services/index.js";
import { requireOwnedMailAccount, requireStoredCredential } from "./mailbox-account.helpers.js";
import { simpleParser, type ParsedMail } from "mailparser";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";

const moveSchema = z.object({
  destFolder: z.string().min(1, "Destination folder required"),
  folder: z.string().default("INBOX"),
});

const flagSchema = z.object({
  flag: z.enum(["\\Seen", "\\Flagged", "\\Answered", "\\Draft", "\\Deleted"]),
  set: z.boolean(),
  folder: z.string().default("INBOX"),
});

const deleteSchema = z.object({
  folder: z.string().default("INBOX"),
});

function parseAccountAndUid(req: Request): { accountId: number; uid: number } {
  return {
    accountId: parseInt(String(req.params["accountId"]), 10),
    uid: parseInt(String(req.params["uid"]), 10),
  };
}

export const actionsController = {
  /**
   * POST /api/mail/:accountId/messages/:uid/move
   * Body: { destFolder, folder? }
   */
  move: asyncHandler(async (req: Request, res: Response) => {
    const { accountId, uid } = parseAccountAndUid(req);
    const body = moveSchema.parse(req.body);

    const account = await requireOwnedMailAccount(accountId);
    const passwordEncrypted = requireStoredCredential(account);

    await imapService.moveMessage(
      account.address,
      passwordEncrypted,
      body.folder,
      uid,
      body.destFolder,
    );

    res.json({ ok: true });
  }),

  /**
   * DELETE /api/mail/:accountId/messages/:uid
   * Query: ?folder=INBOX
   */
  delete: asyncHandler(async (req: Request, res: Response) => {
    const { accountId, uid } = parseAccountAndUid(req);
    const { folder } = deleteSchema.parse({ folder: req.query["folder"] });

    const account = await requireOwnedMailAccount(accountId);
    const passwordEncrypted = requireStoredCredential(account);

    await imapService.deleteMessage(
      account.address,
      passwordEncrypted,
      folder,
      uid,
    );

    res.json({ ok: true });
  }),

  /**
   * GET /api/mail/:accountId/messages/:uid/raw?folder=INBOX
   * Returns the raw RFC822 source — used for "Download message" and
   * "Show original" in the viewer.
   */
  raw: asyncHandler(async (req: Request, res: Response) => {
    const { accountId, uid } = parseAccountAndUid(req);
    const folder = typeof req.query["folder"] === "string" ? req.query["folder"] : "INBOX";

    const account = await requireOwnedMailAccount(accountId);
    const passwordEncrypted = requireStoredCredential(account);

    const raw = await imapService.fetchRawMessage(
      account.address,
      passwordEncrypted,
      folder,
      uid,
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, data: { raw } });
  }),

  attachment: asyncHandler(async (req: Request, res: Response) => {
    const { accountId, uid } = parseAccountAndUid(req);
    const index = Number.parseInt(String(req.params["index"]), 10);
    if (!Number.isSafeInteger(index) || index < 0 || index > 100) throw new ValidationError("Adjunto inválido");
    const folder = typeof req.query.folder === "string" ? req.query.folder : "INBOX";
    const account = await requireOwnedMailAccount(accountId);
    const raw = await imapService.fetchRawMessageBytes(account.address, requireStoredCredential(account), folder, uid);
    if (!raw.length) throw new NotFoundError("Mensaje");
    if (raw.length > 30 * 1024 * 1024) throw new ValidationError("El mensaje supera el límite de descarga");
    const parsed = await simpleParser(raw) as ParsedMail;
    const attachment = parsed.attachments[index];
    if (!attachment) throw new NotFoundError("Adjunto");
    const filename = (attachment.filename || "adjunto").replace(/[\r\n\x00-\x1f]/g, "_").slice(0, 255);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(attachment.content);
  }),

  /**
   * POST /api/mail/:accountId/messages/:uid/flag
   * Body: { flag, set, folder? }
   */
  flag: asyncHandler(async (req: Request, res: Response) => {
    const { accountId, uid } = parseAccountAndUid(req);
    const body = flagSchema.parse(req.body);

    const account = await requireOwnedMailAccount(accountId);
    const passwordEncrypted = requireStoredCredential(account);

    await imapService.setFlag(
      account.address,
      passwordEncrypted,
      body.folder,
      uid,
      body.flag,
      body.set,
    );

    res.json({ ok: true });
  }),
};
