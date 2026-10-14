// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Compose controller — send email.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { contactRepository } from "../repositories/index.js";
import { smtpService } from "../services/index.js";
import { ForbiddenError, ValidationError } from "../../../shared/errors/index.js";
import { requireOwnedMailAccount, requireStoredCredential } from "./mailbox-account.helpers.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { parseComposeRequest } from "./_shared/parse-compose-request.js";
import { buildMailMessage } from "../services/mail-message.service.js";
import { appendSpecialMessage } from "../services/imap/imap-append.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { imapService } from "../services/index.js";
import { encryptMailMessage } from "../services/pgp.service.js";

const log = createModuleLogger("mail-compose");

const composeSchema = z.object({
  to: z.union([emailSchema, z.array(emailSchema)]),
  cc: z.union([emailSchema, z.array(emailSchema)]).optional(),
  bcc: z.union([emailSchema, z.array(emailSchema)]).optional(),
  subject: z.string().max(998, "Subject too long"),
  text: z.string().optional(),
  html: z.string().optional(),
  replyTo: emailSchema.optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  draft: z.union([z.literal("true"), z.literal(true)]).optional(),
  encrypted: z.union([z.literal("true"), z.literal(true)]).optional(),
  draftUid: z.coerce.number().int().positive().optional(),
  draftFolder: z.string().min(1).max(255).optional(),
});

export const composeController = {
  /** POST /api/mail/:accountId/send — send an email. */
  send: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const parsed = await parseComposeRequest(req);
    const body = composeSchema.parse(parsed.fields);

    const account = await requireOwnedMailAccount(accountId);
    if (!account.enabled) throw new ForbiddenError("Esta cuenta está desactivada");
    if (account.loginMode === "suspend") {
      throw new ForbiddenError("El inicio de sesión está suspendido para esta cuenta");
    }
    const passwordEncrypted = requireStoredCredential(account);

    const { draft: isDraft, encrypted, draftUid, draftFolder, ...content } = body;
    if (!isDraft && account.outgoingMode !== "allow") throw new ForbiddenError("El envío está suspendido para esta cuenta");
    if (!isDraft && (Array.isArray(content.to) ? content.to.length === 0 : !content.to)) {
      throw new ValidationError("Agrega al menos un destinatario");
    }
    const options = {
      from: account.displayName ? `"${account.displayName.replaceAll('"', '')}" <${account.address}>` : account.address,
      ...content,
      attachments: parsed.attachments,
    };
    const prepared = await buildMailMessage(options);
    if (encrypted) prepared.raw = await encryptMailMessage(prepared.raw, options, account.id);
    if (isDraft) {
      const saved = await appendSpecialMessage(account.address, passwordEncrypted, "drafts", prepared.raw);
      res.json({ ok: true, data: { draft: true, ...saved } });
      return;
    }
    const result = await smtpService.send(account.address, passwordEncrypted, { ...options, raw: prepared.raw });
    let sentCopySaved = false;
    try {
      await appendSpecialMessage(account.address, passwordEncrypted, "sent", prepared.raw);
      sentCopySaved = true;
    } catch (err) {
      log.warn({ err, accountId }, "SMTP succeeded but Sent copy could not be saved");
    }
    if (draftUid && draftFolder) {
      try {
        const folders = await imapService.listFolders(account.address, passwordEncrypted);
        const selected = folders.find((entry) => entry.path === draftFolder);
        if (selected && (selected.specialUse === "\\Drafts" || /^drafts$/i.test(selected.path))) {
          await imapService.deleteMessage(account.address, passwordEncrypted, selected.path, draftUid);
        }
      } catch (err) { log.warn({ err, accountId, draftUid }, "Sent message, but old draft remains"); }
    }

    // Touch contacts for autocomplete
    const recipients = [
      ...(Array.isArray(body.to) ? body.to : [body.to]),
      ...(body.cc ? (Array.isArray(body.cc) ? body.cc : [body.cc]) : []),
    ];
    for (const email of recipients) {
      try { await contactRepository.touch(accountId, email); }
      catch (err) { log.warn({ err, accountId }, "Sent message, but contact autocomplete was not updated"); }
    }

    eventBus.emit(Events.MAIL_SENT, { accountId, to: body.to });

    res.json({ ok: true, messageId: result.messageId, sentCopySaved });
  }),

  updateDraft: asyncHandler(async (req: Request, res: Response) => {
    const accountId = Number.parseInt(String(req.params.accountId), 10);
    const uid = Number.parseInt(String(req.params.uid), 10);
    if (!Number.isSafeInteger(uid) || uid <= 0) throw new ValidationError("Borrador inválido");
    const account = await requireOwnedMailAccount(accountId);
    const encryptedCredential = requireStoredCredential(account);
    const folder = String(req.query.folder ?? "Drafts");
    const folders = await imapService.listFolders(account.address, encryptedCredential);
    const selected = folders.find((entry) => entry.path === folder);
    if (!selected || (selected.specialUse !== "\\Drafts" && !/^drafts$/i.test(selected.path))) {
      throw new ForbiddenError("Solo se pueden actualizar mensajes de Borradores");
    }
    const parsed = await parseComposeRequest(req);
    const body = composeSchema.parse(parsed.fields);
    const { draft: _draft, encrypted, draftUid: _draftUid, draftFolder: _draftFolder, ...content } = body;
    const prepared = await buildMailMessage({ from: account.address, ...content, attachments: parsed.attachments });
    if (encrypted) prepared.raw = await encryptMailMessage(prepared.raw, { from: account.address, ...content }, account.id);
    const saved = await appendSpecialMessage(account.address, encryptedCredential, "drafts", prepared.raw);
    try {
      await imapService.deleteMessage(account.address, encryptedCredential, selected.path, uid);
    } catch (err) {
      log.warn({ err, accountId, uid }, "New draft saved; previous draft could not be removed");
      res.json({ ok: true, data: { ...saved, previousDraftRemoved: false } });
      return;
    }
    res.json({ ok: true, data: { ...saved, previousDraftRemoved: true } });
  }),
};
