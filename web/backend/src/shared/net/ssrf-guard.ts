// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SSRF guard — a single shared place to validate that an *outbound* URL is
 * safe to fetch before the backend dials it on behalf of a request.
 *
 * The panel makes outbound requests with ambient authority (webhook secrets,
 * an OpenClaw API key, `eas` CLI credentials). An attacker who controls a URL
 * we fetch could point it at a loopback/RFC1918/link-local address to reach
 * internal services or exfiltrate those credentials. This module:
 *
 *   1. validates the URL scheme (`http`/`https`, or https-only),
 *   2. resolves the hostname via the OS resolver (`dns.lookup`, same path the
 *      real connection takes) and,
 *   3. rejects if the host is an IP literal — or resolves to *any* address —
 *      in a private/loopback/link-local/reserved range (incl. IPv4-in-IPv6).
 *
 * No new dependencies: `node:dns/promises` + `node:net` only. Business logic
 * stays in the modules; they just call `assertPublicUrl` before the fetch.
 */

import { SsrfBlockedError } from "./ssrf-error.js";
import { resolveAndPinHost, type HostBlockReason } from "./resolve-host.js";

// Re-exported for back-compat with the original ssrf-guard public API.
export { isBlockedAddress } from "./private-ranges.js";
/**
 * Raised when a URL fails an SSRF check (400 / `SSRF_BLOCKED`). It now lives in
 * `./ssrf-error.ts` so the SSH-target guard's `HostPolicyError` can extend the
 * SAME class (they used to be two identical declarations). Re-exported here so
 * every existing `import { SsrfBlockedError } from ".../ssrf-guard.js"` keeps
 * working unchanged.
 */
export { SsrfBlockedError, HostPolicyError } from "./ssrf-error.js";

export interface SafeUrlOptions {
  /** When true, only `https:` is accepted. Default false → `http:`+`https:`. */
  httpsOnly?: boolean;
}

// ── IPv4/IPv6 predicates ────────────────────────────────────────────────────
// The blocked-range table and the IPv4/IPv6 matching helpers live in
// `private-ranges.ts`, and the resolve→screen→pin algorithm in
// `resolve-host.ts`, so host-policy.ts and the preview-sandbox broker share the
// same SSOT (previously these were duplicated and the broker's copy was
// strictly weaker). `isBlockedAddress` is re-exported above so the ssrf-guard
// public API stays unchanged for downstream consumers.

// ── URL validation ────────────────────────────────────────────────────────────

function allowedProtocols(httpsOnly: boolean): string[] {
  return httpsOnly ? ["https:"] : ["http:", "https:"];
}

/** Strip the surrounding brackets Node keeps on IPv6 `URL.hostname`. */
function unbracket(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/**
 * Validate an outbound URL and its resolved addresses. Resolves DNS and blocks
 * if the host is (or resolves to) any private/reserved address — mitigating
 * DNS-rebinding by checking *every* answer. Returns the parsed `URL` on success.
 *
 * @throws {SsrfBlockedError} on a bad scheme, unresolvable host, or blocked IP.
 */
export async function assertPublicUrl(rawUrl: string, opts: SafeUrlOptions = {}): Promise<URL> {
  return (await assertPublicUrlPinned(rawUrl, opts)).url;
}

/**
 * Same check as {@link assertPublicUrl} but ALSO returns the vetted IP the
 * connection must be pinned to. Prefer this when you control the socket
 * (`https.request({ lookup })`): connecting to `pinnedAddress` instead of
 * re-resolving `url.hostname` closes the DNS-rebinding TOCTOU window that
 * plain `assertPublicUrl` + `fetch` still leaves open.
 */
export async function assertPublicUrlPinned(
  rawUrl: string,
  opts: SafeUrlOptions = {},
): Promise<{ url: URL; pinnedAddress: string; family: 4 | 6 }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("Malformed URL");
  }

  const protocols = allowedProtocols(opts.httpsOnly ?? false);
  if (!protocols.includes(parsed.protocol)) {
    throw new SsrfBlockedError(
      opts.httpsOnly ? "Only https URLs are allowed" : "Only http(s) URLs are allowed",
      { protocol: parsed.protocol },
    );
  }

  const host = unbracket(parsed.hostname);
  const resolved = await resolveAndPinHost(host, { onBlocked: throwSsrfBlocked });
  return { url: parsed, pinnedAddress: resolved.pinnedAddress!, family: resolved.family ?? 4 };
}

/** Map the shared rejection reason to this module's historic messages. */
function throwSsrfBlocked(reason: HostBlockReason): never {
  switch (reason.kind) {
    case "empty":
      throw new SsrfBlockedError("URL has no host");
    case "blocked-literal-ip":
    case "forbidden-literal":
    case "loopback-literal":
      throw new SsrfBlockedError("URL points to a private or reserved address");
    case "unresolvable":
    case "no-records":
      throw new SsrfBlockedError("URL host could not be resolved", { host: reason.host });
    case "blocked-record":
      throw new SsrfBlockedError("URL resolves to a private or reserved address", {
        host: reason.host,
      });
  }
}
