// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * IMAP connection management — host-candidate resolution, the managed
 * `withImap` connection runner, and the credential-verification login probe.
 */

import { ImapFlow } from "imapflow";
import { mailMasterService } from "../mail-master.service.js";
import { mailConfig } from "../../../../config/mail.js";
import { AppError } from "../../../../shared/errors/errors.js";
import { resolveMailTargetHost } from "../mail-target.js";
import {
  MAIL_CONNECTION_TIMEOUT_MS,
  MAIL_GREETING_TIMEOUT_MS,
  MAIL_IMAP_SOCKET_TIMEOUT_MS,
} from "../mail-transport-constants.js";
import { normalizeHost, getDomainFromAddress, mailTlsOptions } from "../mail-host.js";

function uniqueHosts(hosts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const raw of hosts) {
    const host = normalizeHost(raw);
    if (!host) continue;
    if (!out.includes(host)) out.push(host);
  }
  return out;
}

/**
 * Ordered list of IMAP hosts to try for `address`.
 *
 * When `targetHost` is set (the session is bridged to a REMOTE server), the
 * target's own host leads and `localhost` is NEVER appended — a remote tenant's
 * mail must never be read by opening a socket to the panel host (fail-closed).
 * When `targetHost` is undefined (LOCAL session / panel host) the historical
 * behaviour is preserved, including the trailing `localhost` fallback.
 *
 * Exported for unit testing (pure function).
 */
export function buildHostCandidates(
  address: string,
  preferred: string | string[],
  targetHost?: string,
): string[] {
  const preferredList = Array.isArray(preferred) ? preferred : [preferred];
  const normalizedPreferred = uniqueHosts(preferredList);
  const domain = getDomainFromAddress(address);

  const dynamic = domain
    ? uniqueHosts([
      `mail.${domain}`,
      `imap.${domain}`,
      domain,
    ])
    : [];

  const fallback = uniqueHosts(mailConfig.imap.fallbackHosts);

  const target = normalizeHost(targetHost);
  if (target) {
    // REMOTE target: dial its host first, then domain-derived names. Drop any
    // "localhost" the caller passed and never add one — fail-closed.
    return uniqueHosts([
      target,
      ...normalizedPreferred.filter((host) => host !== "localhost"),
      ...dynamic,
      ...fallback,
    ]);
  }

  // LOCAL target (panel host): unchanged, incl. the trailing localhost fallback.
  return uniqueHosts([
    ...normalizedPreferred.filter((host) => host !== "localhost"),
    ...fallback,
    ...dynamic,
    ...normalizedPreferred,
    "localhost",
  ]);
}

export function errorSummary(err: unknown): string {
  if (!err) return "Unknown IMAP connection error";
  if (typeof err === "string") return err;

  const value = err as {
    message?: string;
    code?: string;
    responseText?: string;
    serverResponseCode?: string;
    aggregateErrors?: Array<{ message?: string; code?: string }>;
  };

  if (Array.isArray(value.aggregateErrors) && value.aggregateErrors.length > 0) {
    const details = value.aggregateErrors
      .map((item) => {
        const code = item.code ? `${item.code}: ` : "";
        return `${code}${item.message || "unknown error"}`;
      })
      .join(" | ");
    return details || value.message || "Unknown IMAP aggregate error";
  }

  if (value.code && value.message) return `${value.code}: ${value.message}`;
  // imapflow command failures carry a bare "Command failed" message; the
  // server's own text (e.g. "Authentication failed.") lives in responseText.
  if (value.message && value.responseText) {
    const code = value.serverResponseCode ? `[${value.serverResponseCode}] ` : "";
    return `${value.message}: ${code}${value.responseText}`;
  }
  if (value.message) return value.message;
  return "Unknown IMAP connection error";
}

export function extractErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const value = err as { message?: string };
  return value.message || "Unknown error";
}

function newClient(host: string, port: number, address: string, user: string, pass: string): ImapFlow {
  return new ImapFlow({
    host,
    port,
    secure: port === 993,
    // Validate the server certificate whenever TLS is negotiated (implicit on
    // 993, or via STARTTLS which ImapFlow attempts automatically on other
    // ports) — except on loopback. Blunts credential capture by a MITM / DNS
    // hijack presenting a bogus cert (audit §5).
    tls: mailTlsOptions(host, address),
    auth: { user, pass },
    connectionTimeout: MAIL_CONNECTION_TIMEOUT_MS,
    greetingTimeout: MAIL_GREETING_TIMEOUT_MS,
    socketTimeout: MAIL_IMAP_SOCKET_TIMEOUT_MS,
    logger: false,
  });
}

/**
 * Execute an operation with a managed IMAP connection.
 *
 * Logins are tried in order: the panel's Dovecot MASTER user first (opens any
 * mailbox on a server the panel provisioned — immune to passwords changed
 * outside the panel), then the per-account credential captured at
 * create/password-change (`encryptedPassword`, may be null). Connectivity
 * failures rotate through the host candidates; an auth failure stops the
 * current login (host-independent) and moves on to the next one.
 */
export async function withImap<T>(
  address: string,
  encryptedPassword: string | null,
  host: string | string[],
  port: number,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  // Per-server isolation: for a remote session dial the target's host (never
  // localhost); resolveMailTargetHost throws fail-closed if it can't decide.
  const { targetHost } = await resolveMailTargetHost();
  const hostCandidates = buildHostCandidates(address, host, targetHost);
  const logins = await mailMasterService.resolveAuthCandidates(address, encryptedPassword);
  if (logins.length === 0) {
    const detail = mailMasterService.lastError();
    throw new AppError(
      "No stored mailbox password for this account and the panel's master access is not available on this server"
        + (detail ? ` (${detail})` : "")
        + ". Registra la contraseña actual o restablece la contraseña del buzón desde panel/mail.",
      409,
      "MAIL_PASSWORD_NOT_SET",
    );
  }

  let lastError: unknown;
  let lastAuthError: unknown;
  let lastAuthKind: "master" | "account" | null = null;

  for (const login of logins) {
    let reached = false;
    for (const hostCandidate of hostCandidates) {
      const client = newClient(hostCandidate, port, address, login.user, login.pass);
      try {
        await client.connect();
      } catch (err) {
        lastError = err;
        try {
          client.close();
        } catch {
          // ignore
        }
        // An auth failure is host-independent: stop rather than replay the same
        // password against every derived host (credential-spray hardening).
        if (isImapAuthError(err)) {
          reached = true;
          lastAuthError = err;
          lastAuthKind = login.kind;
          if (login.kind === "master") mailMasterService.reportAuthFailure();
          break;
        }
        continue;
      }

      if (login.kind === "master") void mailMasterService.markVerified();
      try {
        return await fn(client);
      } finally {
        try {
          await client.logout();
        } catch {
          client.close();
        }
      }
    }
    // No host answered at all: connectivity is login-independent, so don't
    // burn the same timeouts again with the next credential.
    if (!reached) break;
  }

  if (lastAuthError) {
    // The server was reached but rejected the credential(s): surface it as 409
    // with the "mailbox password" wording / code the inbox UI keys on to offer
    // "use current password" / "change password" instead of a dead-end
    // "IMAP unreachable".
    const summary = errorSummary(lastAuthError);
    if (lastAuthKind === "master" && !encryptedPassword) {
      throw new AppError(
        `The panel's master access for ${address} was rejected by the IMAP server (${summary}) and no mailbox password is stored. Register the current password or set a new mailbox password from panel/mail.`,
        409,
        "MAIL_CREDENTIAL_INVALID",
      );
    }
    throw new AppError(
      `The stored mailbox password for ${address} was rejected by the IMAP server (${summary}). Register the current password or set a new mailbox password from panel/mail.`,
      409,
      "MAIL_CREDENTIAL_INVALID",
    );
  }

  throw new AppError(
    `Unable to connect to IMAP for ${address}. Tried hosts: ${hostCandidates.join(", ")}. ${errorSummary(lastError)}`,
    502,
    "MAIL_IMAP_UNREACHABLE",
  );
}

function isImapAuthError(err: unknown): boolean {
  const e = err as { authenticationFailed?: boolean; response?: string; responseText?: string; message?: string } | null;
  if (!e) return false;
  if (e.authenticationFailed === true) return true;
  const text = `${e.response ?? ""} ${e.responseText ?? ""} ${e.message ?? ""}`;
  return /authenticationfailed|authentication failed|invalid credentials|login failed|\[AUTHENTICATIONFAILED\]/i.test(text);
}

/**
 * Verify a PLAINTEXT mailbox password by attempting an IMAP login across the
 * host candidates. Distinguishes a wrong password (auth) from an unreachable
 * server (connectivity) so the UI can tell the user which it is. Used to let a
 * user register their CURRENT password without changing it.
 */
export async function verifyLogin(
  address: string,
  plainPassword: string,
  host: string | string[] = mailConfig.imap.host,
  port = mailConfig.imap.port,
  /** Login name when it differs from the mailbox (master user: `addr*master`). */
  authUser: string = address,
): Promise<{ ok: true } | { ok: false; reason: "auth" | "unreachable"; detail: string }> {
  const { targetHost } = await resolveMailTargetHost();
  const hostCandidates = buildHostCandidates(address, host, targetHost);
  let lastError: unknown;
  for (const hostCandidate of hostCandidates) {
    const client = newClient(hostCandidate, port, address, authUser, plainPassword);
    try {
      await client.connect();
      try {
        await client.logout();
      } catch {
        client.close();
      }
      return { ok: true };
    } catch (err) {
      lastError = err;
      try {
        client.close();
      } catch {
        // ignore
      }
      // Auth failures don't depend on the host — stop and report distinctly.
      if (isImapAuthError(err)) {
        return { ok: false, reason: "auth", detail: errorSummary(err) };
      }
    }
  }
  return { ok: false, reason: "unreachable", detail: errorSummary(lastError) };
}
