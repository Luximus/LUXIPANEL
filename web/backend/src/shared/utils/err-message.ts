// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `err instanceof Error ? err.message : String(err)` — written out by hand in a
 * dozen catch blocks across `shared/` (remote-cache, files-cache, executor,
 * system/installer) and many more in `modules/`. One helper, one behaviour.
 */

/** Human-readable message for an unknown thrown value. Never throws. */
export function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return String(err);
  } catch {
    return "unknown error";
  }
}

/**
 * Same, but with a caller-supplied fallback for nullish values. Used by the
 * `Kv*Error` constructors, whose message reads
 * `… (${filePath}): ${errReason(cause)}`.
 */
export function errReason(err: unknown, fallback = "unknown error"): string {
  if (err instanceof Error) return err.message;
  return err ? String(err) : fallback;
}
