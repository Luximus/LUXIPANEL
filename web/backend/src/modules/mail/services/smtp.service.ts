// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SMTP service — sending email via Nodemailer.
 */

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { mailMasterService } from "./mail-master.service.js";
import { AppError } from "../../../shared/errors/errors.js";
import { mailConfig } from "../../../config/mail.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { resolveMailTargetHost } from "./mail-target.js";
import {
  MAIL_CONNECTION_TIMEOUT_MS,
  MAIL_GREETING_TIMEOUT_MS,
  MAIL_SMTP_SOCKET_TIMEOUT_MS,
} from "./mail-transport-constants.js";
import { normalizeHost, getDomainFromAddress, mailTlsOptions } from "./mail-host.js";

const log = createModuleLogger("smtp");

export interface SendMailOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{ filename: string; contentType: string; content: Buffer }>;
  raw?: Buffer;
}

/**
 * Build the list of submission endpoints to try, mirroring how IMAP derives its
 * host from the email domain (see imap.service `buildHostCandidates`). The mail
 * server is NOT on the panel host (the mailbox lives on the account's domain
 * server, e.g. `mail.<domain>`), so a hardcoded `localhost` always fails with
 * ECONNREFUSED. We try the domain-derived hosts on the common submission ports
 * (587 STARTTLS, then 465 SMTPS), honoring an explicit configured host first.
 *
 * When `targetHost` is set (the session is bridged to a REMOTE server), the
 * target's own host leads and `localhost` is NEVER a candidate — a remote
 * tenant's mail must never be submitted through the panel host (fail-closed).
 * Exported for unit testing (pure function).
 */
export function buildSubmissionCandidates(
  address: string,
  preferredHost: string,
  preferredPort: number,
  targetHost?: string,
): Array<{ host: string; port: number; secure: boolean }> {
  const domain = getDomainFromAddress(address);
  const explicit = normalizeHost(preferredHost);
  const target = normalizeHost(targetHost);
  const hosts: string[] = [];
  if (target) {
    // REMOTE target: dial its own host first, then any explicit non-localhost
    // host and the domain-derived names. Never "localhost".
    hosts.push(target);
    if (explicit && explicit !== "localhost") hosts.push(explicit);
    if (domain) hosts.push(`mail.${domain}`, `smtp.${domain}`, domain);
  } else {
    // LOCAL target (panel host): unchanged behaviour.
    // An explicitly-configured non-localhost host wins.
    if (explicit && explicit !== "localhost") hosts.push(explicit);
    if (domain) hosts.push(`mail.${domain}`, `smtp.${domain}`, domain);
    if (explicit === "localhost") hosts.push("localhost");
  }

  const uniqueHosts: string[] = [];
  for (const h of hosts) { if (!uniqueHosts.includes(h)) uniqueHosts.push(h); }

  // Try the configured port first, then the other common submission port.
  const ports = preferredPort === 465 ? [465, 587] : [587, 465];

  const combos: Array<{ host: string; port: number; secure: boolean }> = [];
  for (const host of uniqueHosts) {
    for (const port of ports) {
      combos.push({ host, port, secure: port === 465 });
    }
  }
  return combos;
}

export const smtpService = {
  /**
   * Send an email via SMTP on behalf of `address`.
   *
   * Logins are tried in order: the panel's Dovecot MASTER user (Postfix
   * authenticates SASL through Dovecot, so `addr*master` works there too),
   * then the per-account credential (`encryptedPassword`, may be null).
   * Connection failures rotate through the submission endpoints; an auth
   * rejection (`EAUTH`) moves on to the next login. Other 5xx (recipient,
   * policy) mean the right server was reached — surfaced as-is.
   */
  async send(
    address: string,
    encryptedPassword: string | null,
    options: SendMailOptions,
    smtpHost = mailConfig.smtp.host,
    smtpPort = mailConfig.smtp.port,
  ): Promise<{ messageId: string }> {
    // Per-server isolation: for a remote session submit through the target's
    // host (never localhost); fail-closed if the target can't be resolved.
    const { targetHost } = await resolveMailTargetHost();
    const candidates = buildSubmissionCandidates(address, smtpHost, smtpPort, targetHost);
    const logins = await mailMasterService.resolveAuthCandidates(address, encryptedPassword);
    if (logins.length === 0) {
      throw new AppError(
        "No stored mailbox password for this account and the panel's master access is not available on this server. Registra la contraseña actual o restablece la contraseña del buzón desde panel/mail.",
        409,
        "MAIL_PASSWORD_NOT_SET",
      );
    }
    let lastError: unknown;
    let lastAuthError: unknown;

    for (const login of logins) {
      let reached = false;
      for (const { host, port, secure } of candidates) {
        const transport = nodemailer.createTransport({
          host,
          port,
          secure,
          requireTLS: !secure, // force STARTTLS on the submission port (587)
          auth: { user: login.user, pass: login.pass },
          connectionTimeout: MAIL_CONNECTION_TIMEOUT_MS,
          greetingTimeout: MAIL_GREETING_TIMEOUT_MS,
          socketTimeout: MAIL_SMTP_SOCKET_TIMEOUT_MS,
          // Validate the server certificate: sending the mailbox password to a
          // host derived from the domain (`mail.<domain>`, …) with TLS validation
          // OFF let any MITM / DNS hijack capture it (audit §5). Only loopback
          // (a locally-run submission agent, self-signed) is exempted.
          tls: mailTlsOptions(host, address),
        } as SMTPTransport.Options);

        try {
          const info = await transport.sendMail({
            from: options.from || address,
            to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
            cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(", ") : options.cc) : undefined,
            bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc) : undefined,
            subject: options.subject,
            text: options.text,
            html: options.html,
            replyTo: options.replyTo,
            inReplyTo: options.inReplyTo,
            references: options.references,
            attachments: options.attachments,
            raw: options.raw,
          });

          log.info({ from: address, to: options.to, host, port, auth: login.kind, messageId: info.messageId }, "Email sent");
          return { messageId: info.messageId };
        } catch (err) {
          const code = (err as { code?: string })?.code;
          // Connection-level failures → try the next candidate. Auth/recipient
          // failures (5xx) mean we reached the right server; stop and surface it.
          const isConnError = code === "ESOCKET" || code === "ECONNECTION" || code === "ETIMEDOUT"
            || code === "ECONNREFUSED" || code === "EDNS" || code === "ENOTFOUND" || code === "EHOSTUNREACH";
          lastError = err;
          if (isConnError) {
            log.warn({ code, host, port }, "SMTP endpoint unreachable — trying next candidate");
            continue;
          }
          reached = true;
          if (code === "EAUTH") {
            // Host-independent: stop this login, fall through to the next one.
            lastAuthError = err;
            if (login.kind === "master") mailMasterService.reportAuthFailure();
            log.warn({ host, port, auth: login.kind }, "SMTP login rejected — trying next credential");
            break;
          }
          log.warn({ err, host, port }, "SMTP send failed (server reached)");
          throw err;
        } finally {
          transport.close();
        }
      }
      if (!reached) break;
    }

    if (lastAuthError) {
      throw new AppError(
        `The SMTP server rejected the mailbox credentials for ${address} (${(lastAuthError as Error).message}). Register the current password or set a new mailbox password from panel/mail.`,
        409,
        "MAIL_CREDENTIAL_INVALID",
      );
    }
    log.error({ err: lastError, address }, "All SMTP submission endpoints failed");
    throw lastError ?? new Error("No reachable SMTP submission endpoint");
  },
};
