/**
 * Panel outbound-mail controller — configure the default sending identity
 * (panel mailbox or external SMTP) and send a test email.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { mailOutboundRepository, type MailOutboundConfig } from "../repositories/outbound.repository.js";
import { mailOutboundService } from "../services/outbound.service.js";
import { mailCryptoService } from "../services/mail-crypto.service.js";

const saveSchema = z.object({
  mode: z.enum(["disabled", "account", "external"]),
  accountAddress: emailSchema.optional(),
  external: z
    .object({
      host: z.string().min(1).max(253),
      port: z.coerce.number().int().min(1).max(65535),
      secure: z.boolean().optional(),
      /** Empty = SMTP relay WITHOUT authentication. */
      user: z.string().max(320).optional().default(""),
      /** Plain password; omitted/empty = keep the stored one. */
      password: z.string().max(256).optional(),
      fromAddress: emailSchema,
      fromName: z.string().max(120).optional(),
    })
    .optional(),
});

function redacted(cfg: MailOutboundConfig) {
  return {
    mode: cfg.mode,
    accountAddress: cfg.accountAddress ?? "",
    external: cfg.external
      ? {
          host: cfg.external.host,
          port: cfg.external.port,
          secure: cfg.external.secure ?? cfg.external.port === 465,
          user: cfg.external.user,
          fromAddress: cfg.external.fromAddress,
          fromName: cfg.external.fromName ?? "",
          hasPassword: Boolean(cfg.external.passwordEncrypted),
        }
      : null,
  };
}

export const mailOutboundController = {
  /** GET /api/mail/outbound — current config (password redacted). */
  get: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cfg = await mailOutboundRepository.get(executor);
    res.json({ ok: true, data: redacted(cfg) });
  }),

  /** PUT /api/mail/outbound — save the config. */
  save: asyncHandler(async (req: Request, res: Response) => {
    const body = saveSchema.parse(req.body);
    const executor = getExecutor(req);
    const current = await mailOutboundRepository.get(executor);

    if (body.mode === "account" && !body.accountAddress) {
      throw new ValidationError("Selecciona la cuenta de correo de envío.");
    }

    let external = current.external;
    if (body.mode === "external") {
      if (!body.external) throw new ValidationError("Faltan los datos del SMTP externo.");
      const passwordEncrypted = body.external.password
        ? mailCryptoService.encrypt(body.external.password)
        : current.external?.passwordEncrypted ?? "";
      // Password is only mandatory when the relay authenticates (user set).
      if (body.external.user && !passwordEncrypted) throw new ValidationError("Define la contraseña del SMTP externo.");
      external = {
        host: body.external.host,
        port: body.external.port,
        secure: body.external.secure,
        user: body.external.user,
        passwordEncrypted,
        fromAddress: body.external.fromAddress,
        fromName: body.external.fromName,
      };
    }

    const saved = await mailOutboundRepository.save(
      { mode: body.mode, accountAddress: body.accountAddress ?? current.accountAddress, external },
      executor,
    );
    res.json({ ok: true, data: redacted(saved) });
  }),

  /** POST /api/mail/outbound/test — send a test email with the saved config. */
  test: asyncHandler(async (req: Request, res: Response) => {
    const { to } = z.object({ to: emailSchema }).parse(req.body);
    const executor = getExecutor(req);
    try {
      const { messageId } = await mailOutboundService.sendSystemMail(executor, {
        to,
        subject: "LUXIPANEL — correo de prueba",
        text: "Este es un correo de prueba del envío del panel (módulo Correo → Envío del panel). Si lo recibes, la configuración funciona.",
      });
      res.json({ ok: true, data: { messageId } });
    } catch (err) {
      res.status(502).json({ ok: false, error: errMessage(err) });
    }
  }),
};
