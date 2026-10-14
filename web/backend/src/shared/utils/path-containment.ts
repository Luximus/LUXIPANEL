// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Path containment — the ONE answer to "does `candidate` sit under `prefix`?".
 *
 * The naive `p.startsWith(root)` is an anti-traversal HOLE (`/home/bob` starts
 * with `/home/bo`), so the correct predicate is `p === root || p.startsWith(root
 * + sep)`. That two-clause test was copy-pasted in 9 places (tenant-scope ×3,
 * preview-sandbox broker ×2, files/archive, obsidian path-util, auth
 * role-permissions), some normalizing the trailing slash and some not.
 *
 * NOTE — this is a STRING predicate: both arguments must already be absolute
 * and normalized (`path.resolve`) by the caller. It does NOT resolve `..`, and
 * it does NOT resolve symlinks. `shared/executor/context.ts#pathInFileJail`
 * remains the jail check bound to the request scope; it is a thin wrapper over
 * the same semantics.
 */

/** Drop trailing separators, but never reduce the root ("/") to "". */
function trimTrailingSep(value: string, separator: string): string {
  let out = value;
  while (out.length > separator.length && out.endsWith(separator)) {
    out = out.slice(0, -separator.length);
  }
  return out;
}

/**
 * `true` when `candidate` IS `prefix` or lives beneath it.
 *
 * Trailing separators are normalized away on BOTH sides, so `/home/bob/` and
 * `/home/bob` are the same prefix. An empty `prefix` matches any absolute path
 * (the historical behaviour of the inline copies; callers that must not accept
 * an empty root should guard before calling).
 *
 * @param separator Path separator; defaults to POSIX `/` (pass `path.sep` when
 *                  comparing host paths produced by `path.resolve`).
 */
export function isPathUnder(prefix: string, candidate: string, separator = "/"): boolean {
  const root = trimTrailingSep(prefix, separator);
  const p = trimTrailingSep(candidate, separator);
  if (root === "") return p === "" || p.startsWith(separator);
  return p === root || p.startsWith(root + separator);
}

/** `true` when `candidate` is under ANY of `prefixes`. */
export function isPathUnderAny(
  prefixes: readonly string[],
  candidate: string,
  separator = "/",
): boolean {
  return prefixes.some((prefix) => isPathUnder(prefix, candidate, separator));
}
