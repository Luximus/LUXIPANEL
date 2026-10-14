// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Parsing of nginx `server_name` directives — the ONE regex.
 *
 * Four modules re-derived "which hostnames does this vhost answer for?" with
 * slightly different regexes and normalization rules (nginx sites listing,
 * server-domains discovery, the SSL bridge, webhook discovery). One of them
 * used a non-anchored `\bserver_name` that also matched COMMENTED-OUT
 * directives (`# server_name old.example;`), so a disabled name showed up as a
 * live one.
 *
 * Lives in `shared/` rather than in the nginx module because `webhooks` needs
 * it too and modules must not import each other (CLAUDE.md).
 */

/**
 * A `server_name` directive at the start of a line (leading whitespace only).
 *
 * Anchoring is deliberate: it is what keeps `# server_name …` comments out of
 * the results. Build a FRESH regex per call — a shared /g regex carries
 * `lastIndex` between calls.
 */
function serverNameRe(): RegExp {
  return /^[ \t]*server_name\s+([^;]+);/gim;
}

/** Whitespace-separated tokens of the FIRST `server_name` directive (raw case). */
export function firstServerNameTokens(content: string): string[] {
  const match = serverNameRe().exec(content);
  if (!match || !match[1]) return [];
  return match[1]
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * Every hostname declared by every `server_name` directive: lowercased, the
 * catch-all `_` dropped, deduped, in file order.
 */
export function serverNamesFromContent(content: string): string[] {
  const out: string[] = [];
  for (const match of content.matchAll(serverNameRe())) {
    for (const token of (match[1] ?? "").trim().split(/\s+/)) {
      const value = token.toLowerCase();
      if (value && value !== "_" && !out.includes(value)) out.push(value);
    }
  }
  return out;
}

/**
 * A concrete, fetchable hostname — not the catch-all `_`, not `localhost`, not
 * a wildcard `*.example.com`, not a bare IPv4. Used before turning a
 * `server_name` into a URL we hand to the user or fetch ourselves.
 */
export function isConcreteHost(domain: string): boolean {
  if (!domain || domain === "_" || domain === "localhost") return false;
  if (domain.startsWith("*.")) return false; // wildcard server_name → no concrete host
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false;
  if (domain.startsWith("127.") || domain.startsWith("0.")) return false;
  return domain.includes(".");
}
