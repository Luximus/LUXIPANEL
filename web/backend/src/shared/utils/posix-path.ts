// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * POSIX path helpers for REMOTE (target-server) paths — B-29 / B-38.
 *
 * These operate on the connected server's filesystem namespace, which is always
 * POSIX regardless of the panel host, so they deliberately use `path.posix`
 * (never `path`, whose separator follows the panel host).
 *
 * Before this module:
 *   - `dirOf()` was hand-rolled in 5 `files/` files (agent-capability,
 *     operations.controller, snapshot.service, git.service, file-history.service).
 *   - `isAbsoluteUnixPath()` was duplicated in `files/agent-capability.ts` and
 *     `ai-assistant/servers-agent-capability.ts` (modules may not import each
 *     other, so the shared home is here).
 *   - `normalizeAbsPath()` existed twice; the `upload.controller` copy prefixed
 *     a missing `/` first, which `path.posix.resolve("/", p)` already does.
 */

import path from "node:path";

/**
 * POSIX `dirname` with the semantics the `files` module has always used:
 * trailing slashes are trimmed first and a top-level entry (or the root)
 * yields `"/"` rather than `"."`.
 */
export function dirOf(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  return trimmed.slice(0, idx);
}

/**
 * `true` for a usable absolute target path: starts with `/` and carries no NUL
 * (a NUL would truncate the path inside any C-level syscall/argv).
 */
export function isAbsoluteUnixPath(p: unknown): p is string {
  return typeof p === "string" && p.startsWith("/") && !p.includes("\0");
}

/**
 * Resolve `..`/`.` segments against `/` so prefix-based access policies
 * (`canAccessPath`, `pathDenied`) are enforced on the REAL target and not on
 * the raw string. Relative input is treated as rooted. Trailing slashes are
 * dropped; the result is never empty (`"/"` at minimum).
 *
 * SECURITY: always feed the policy check AND the executor this value — never
 * the raw input, or the two can disagree.
 */
export function normalizeAbsPath(p: string): string {
  return path.posix.resolve("/", p).replace(/\/+$/, "") || "/";
}
