// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import net from "node:net";
/**
 * Pure host helpers shared by the IMAP and SMTP transports.
 *
 * NOTE — intentionally NOT the `shared/utils/host.ts` `normalizeHost`: that one
 * strips the `:port` suffix and trailing FQDN dots and returns `""` for empty
 * input. The mail transports need the historical semantics — trim + lowercase
 * only, and `null` (never `""`) for empty/nullish input — because callers use
 * the `null` return as their "no host" signal and must preserve any `:port`.
 */

/** Trim + lowercase; `null` for empty/nullish input (never strips the port). */
export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const host = value.trim().toLowerCase();
  return host || null;
}

/** True for loopback hosts (where TLS validation is relaxed — self-signed). */
export function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * TLS options for dialing a mail host (IMAP/SMTP) on behalf of `address`.
 *
 * Certificates are always validated except on loopback. When the candidate is
 * an IP LITERAL (the usual case for a REMOTE vault target, e.g. `198.51.100.7`)
 * Node validates the cert against the IP and fails with
 * `ERR_TLS_CERT_ALTNAME_INVALID` — mail certs are issued for names like
 * `mail.<domain>`, never for the IP. So for IP literals we send SNI + validate
 * against the domain-derived name (`mail.<domain>` of the mailbox address).
 * Node uses `servername` (when set) as the identity to check, so validation
 * stays STRICT — it is just checked against the right name.
 * The `servername` key is only present when needed: imapflow/nodemailer merge
 * these options over their own `servername`, and an explicit `undefined` would
 * clobber the hostname they derive for non-IP candidates.
 */
export function mailTlsOptions(
  host: string,
  address: string,
): { rejectUnauthorized: boolean; servername?: string } {
  if (isLoopbackHost(host)) return { rejectUnauthorized: false };
  if (!net.isIP(host)) return { rejectUnauthorized: true };
  const domain = getDomainFromAddress(address);
  return domain
    ? { rejectUnauthorized: true, servername: `mail.${domain}` }
    : { rejectUnauthorized: true };
}

/** Domain part of an email address (after the last `@`), normalized. */
export function getDomainFromAddress(address: string): string | null {
  const idx = address.lastIndexOf("@");
  if (idx < 0) return null;
  return normalizeHost(address.slice(idx + 1));
}
