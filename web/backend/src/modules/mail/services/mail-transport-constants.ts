// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared Nodemailer/ImapFlow transport timeouts (ms). Single source of truth
 * for the connection/greeting/socket timeouts used by the SMTP submission
 * (`smtp.service.ts`) and IMAP connection (`imap/imap-connection.ts`) paths.
 *
 * NOTE: the socket timeout intentionally DIFFERS between SMTP (30s) and IMAP
 * (20s); do not unify these two values.
 */

export const MAIL_CONNECTION_TIMEOUT_MS = 8_000;
export const MAIL_GREETING_TIMEOUT_MS = 8_000;
export const MAIL_SMTP_SOCKET_TIMEOUT_MS = 30_000;
export const MAIL_IMAP_SOCKET_TIMEOUT_MS = 20_000;
