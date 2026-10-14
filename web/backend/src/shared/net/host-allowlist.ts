// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Host-allowlist matcher for module HTTP egress — the SSOT for the pattern
 * semantics used by BOTH the in-process module SDK (`shared/module-sdk`) and
 * the preview-sandbox broker (`shared/preview-sandbox/broker.ts`), whose copy
 * literally carried a "Faithful copy … kept byte-for-byte identical" comment.
 * A hand-maintained duplicate of an anti-SSRF barrier is exactly the thing
 * that silently drifts, so the semantics now live here once.
 *
 * Pattern grammar (unchanged):
 *   - `example.com`   → exact host match (case-insensitive)
 *   - `*.example.com` → `example.com` itself OR any host ending in
 *                       `.example.com`
 *
 * Callers keep their own error wording (the SDK names the module, the broker
 * names the operator allowlist), so no message/contract changes on migration.
 */

/** Extract the lowercase hostname of `url`, or `null` when it is not a URL. */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** `true` when `host` matches one of the allowlist patterns. */
export function hostMatchesAllowlist(allow: readonly string[], host: string): boolean {
  const h = host.toLowerCase();
  return allow.some((pat) => {
    const p = pat.toLowerCase();
    return p.startsWith("*.") ? h === p.slice(2) || h.endsWith(p.slice(1)) : h === p;
  });
}

/**
 * Parse `url` and test it against `allow`.
 *
 * @returns `{ ok: true, host }` on a match; `{ ok: false, host }` when the host
 *          is not allowlisted; `{ ok: false, host: null }` when the URL is
 *          malformed. The caller decides which error to throw for each case.
 */
export function checkUrlAllowlisted(
  allow: readonly string[],
  url: string,
): { ok: boolean; host: string | null } {
  const host = hostnameOf(url);
  if (host === null) return { ok: false, host: null };
  return { ok: hostMatchesAllowlist(allow, host), host };
}
