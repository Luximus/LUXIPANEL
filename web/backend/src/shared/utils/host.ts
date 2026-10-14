// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Host / proxy-header normalization — one place for the two idioms that were
 * spelled out by hand in `shared/cookies.ts`, `shared/utils/session-host.ts`,
 * `shared/http/panel-origin.ts` and `shared/panel-url/index.ts`:
 *
 *   1. `firstForwardedValue()` — `x-forwarded-*` may carry a comma-separated
 *      list (one entry per proxy hop); only the FIRST entry is meaningful.
 *   2. `normalizeHost()` — lowercase, strip the port, strip the FQDN root dot.
 *
 * NOTE — neither helper VALIDATES the value: `x-forwarded-host` is attacker
 * controlled. Callers that use it as an identity (see `session-host.ts`, whose
 * BOLA guard is the whole point) must still apply their own allowlist/regex.
 */

/**
 * First entry of a possibly comma-separated proxy header value, trimmed.
 * Accepts the raw `req.headers[...]` union (`string | string[] | undefined`).
 */
export function firstForwardedValue(raw: string | string[] | undefined | null): string {
  return String(raw ?? "").split(",")[0]!.trim();
}

/**
 * Canonical form of a host: trimmed, lowercased, without the `:port` suffix and
 * without trailing FQDN dots. Empty/nullish input → `""`.
 */
export function normalizeHost(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .split(":")[0]!
    .replace(/\.+$/, "");
}
