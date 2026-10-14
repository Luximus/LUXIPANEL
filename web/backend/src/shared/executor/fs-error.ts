// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Translate low-level filesystem errors (ssh2/SFTP or Node `fs`) into the
 * panel's typed HTTP errors so a `readdir`/`stat` that fails on a `700` dir of
 * another user surfaces as a clean 403/404 instead of a generic
 * `INTERNAL_ERROR` (500).
 *
 * Contract: ONLY permission/absence are mapped; every other failure is
 * re-thrown untouched so it keeps its own semantics (never mask an unknown
 * error as "permission denied"). The panel keeps the plain SFTP model —
 * `readdir` without sudo — so this is purely error shaping, not a behavior
 * change on the happy path.
 */
import { ForbiddenError, NotFoundError } from "../errors/errors.js";
import { errMessage } from "../utils/err-message.js";

/**
 * ssh2 SFTP status codes (subset). See ssh2's `SFTP_STATUS_CODE`.
 *   2 = NO_SUCH_FILE, 3 = PERMISSION_DENIED.
 */
const SFTP_NO_SUCH_FILE = 2;
const SFTP_PERMISSION_DENIED = 3;

/**
 * Map an `err` thrown by `executor.readdir`/`stat` (or a raw `fs` call) to a
 * typed error. Returns the error to `throw` — the caller writes
 * `throw mapFsError(err, path)` so control flow is obvious.
 */
export function mapFsError(err: unknown, path: string): Error {
  // ssh2/SFTP: numeric status code takes precedence (most reliable signal).
  const code = (err as { code?: unknown } | null)?.code;
  if (code === SFTP_PERMISSION_DENIED) return new ForbiddenError(`Permiso denegado para ${path}`);
  if (code === SFTP_NO_SUCH_FILE) return new NotFoundError(path);

  // Node fs errno strings.
  if (code === "EACCES" || code === "EPERM") return new ForbiddenError(`Permiso denegado para ${path}`);
  if (code === "ENOENT") return new NotFoundError(path);

  // Fallback to the message text (some SFTP layers only surface a string).
  const msg = errMessage(err).toLowerCase();
  if (msg.includes("permission denied") || msg.includes("eacces") || msg.includes("eperm")) {
    return new ForbiddenError(`Permiso denegado para ${path}`);
  }
  if (msg.includes("no such file") || msg.includes("enoent") || msg.includes("not found")) {
    return new NotFoundError(path);
  }

  // Anything else: let the original error follow its course (→ 500 as before).
  return err instanceof Error ? err : new Error(errMessage(err));
}
