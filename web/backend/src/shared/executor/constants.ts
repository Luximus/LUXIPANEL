// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Executor constants (single source of truth).
 */

/**
 * Upper bound on captured command stdout+stderr, in bytes (= 10 MiB). Both
 * executors cap `exec()` output at this size (local: `execFile`'s `maxBuffer`;
 * SSH: a running byte counter) so a runaway command can't exhaust memory.
 */
export const EXEC_OUTPUT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Idle time-to-live for a pooled/cached executor, in milliseconds (= 30 min).
 * After this long with no activity a bridged executor is reaped. Shared by the
 * executor factory pool and the vault-executor reaper (previously two
 * independently-named copies of the same policy).
 */
export const EXECUTOR_IDLE_TTL_MS = 30 * 60_000;
