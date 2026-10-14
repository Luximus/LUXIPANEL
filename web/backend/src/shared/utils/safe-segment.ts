// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sanitizer for a SINGLE path/filename segment built from caller-supplied data
 * (module name, collection name, target/bridge id, …).
 *
 * Three near-copies existed (`kv-store#safe`, `remote-config#configPath`
 * inline, `remote-cache/redis-cli#safeIdentitySegment`) and only the kv-store
 * one was complete: the others skipped the length cap and the `.`/`..`
 * rejection, so `path.posix.join(baseDir, "..")` could escape
 * `LUXIPANEL_CONFIG_DIR` — an LFI/traversal vector. This is the strict version.
 */

/** Characters allowed verbatim in a segment; everything else collapses to `-`. */
const ALLOWED = /[^a-z0-9_.-]+/gi;

/**
 * Neutralize `name` for use as ONE path segment.
 *
 *   - anything outside `[A-Za-z0-9_.-]` becomes `-`
 *   - the result is capped at `maxLength` (default 64) so a single overlong
 *     segment can't blow up the path
 *   - pure `.` / `..` collapse to `-` (they would escape the base directory)
 *
 * Returns `""` for empty input; callers that need a placeholder should `||` it.
 */
export function safeSegment(name: string, maxLength = 64): string {
  const cleaned = name.replace(ALLOWED, "-").slice(0, maxLength);
  if (cleaned === "." || cleaned === "..") return "-";
  return cleaned;
}
