/**
 * Panel outbound-mail service — sends SYSTEM emails (cron reports, approval
 * links, tests) using the configured default identity (see
 * `outbound.repository.ts`). Other modules request sends via the event bus
 * (`Events.SYSTEM_MAIL_SEND`) so they never import the mail module directly.
 */

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { mailConfig } from "../../../config/mail.js";
import { mailCryptoService } from "./mail-crypto.service.js";
import { mailboxCredentialService } from "./mailbox-credential.service.js";
import { smtpService } from "./smtp.service.js";
import { fnv1aId } from "../controllers/accounts.helpers.js";
import { mailOutboundRepository } from "../repositories/outbound.repository.js";
import { isIP } from "node:net";

const log = createModuleLogger("mail-outbound");

export interface SystemMailMessage {
  to: string[] | string;
  subject: string;
  text: string;
  html?: string;
}

export const mailOutboundService = {
  /** Send a system email with the configured default outbound identity. */
  async sendSystemMail(executor: Executor | null | undefined, msg: SystemMailMessage): Promise<{ messageId: string }> {
    const cfg = await mailOutboundRepository.get(executor);

    if (cfg.mode === "account" && cfg.accountAddress) {
      const address = cfg.accountAddress;
      const encrypted = await mailboxCredentialService.getEncrypted(fnv1aId(address), executor);
      if (!encrypted) {
        throw new Error(`La cuenta de envío "${address}" no tiene credencial almacenada (re-guarda su contraseña en el módulo Correo).`);
      }
      return smtpService.send(
        address,
        encrypted,
        { from: address, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html },
        mailConfig.smtp.host,
        mailConfig.smtp.port,
      );
    }

    if (cfg.mode === "external" && cfg.external?.host) {
      const ext = cfg.external;
      // Empty user = unauthenticated relay (e.g. a trusted local/LAN postfix).
      const auth = ext.user
        ? { user: ext.user, pass: mailCryptoService.decrypt(ext.passwordEncrypted) }
        : undefined;
      const loopback = ext.host === "localhost" || ext.host === "127.0.0.1" || ext.host === "::1";
      const transport = nodemailer.createTransport({
        host: ext.host,
        port: ext.port,
        secure: ext.secure ?? ext.port === 465,
        auth,
        // Credentials must never be offered over cleartext. Remote relays
        // require a trusted certificate even when authentication is disabled.
        requireTLS: !(ext.secure ?? ext.port === 465) && (!loopback || Boolean(auth)),
        tls: { rejectUnauthorized: !loopback, servername: isIP(ext.host) ? undefined : ext.host },
      } as SMTPTransport.Options);
      try {
        const info = await transport.sendMail({
          from: ext.fromName ? `"${ext.fromName.replaceAll('"', "")}" <${ext.fromAddress}>` : ext.fromAddress,
          to: Array.isArray(msg.to) ? msg.to.join(", ") : msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        });
        log.info({ host: ext.host, to: msg.to, messageId: info.messageId }, "System email sent (external SMTP)");
        return { messageId: info.messageId };
      } finally {
        transport.close();
      }
    }

    throw new Error("El envío del panel no está configurado: define la cuenta por defecto o un SMTP externo en Correo → Configuración → Envío del panel.");
  },
};
