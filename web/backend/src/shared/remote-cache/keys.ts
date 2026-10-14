// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/keys.ts — shared key/suffix builders for the remote
 * cache, so the read path (`index.ts`) and the refresh path (`refresh.ts`)
 * agree byte-for-byte on namespacing.
 *
 *  • `scopeSuffix` — the `:scope:<scope>` fragment appended to a key for a
 *    scoped collection (one blob per accountId, etc.); empty for the unscoped
 *    full collection.
 *  • `panelMetaKey` — the panel-local metadata key (`panel:rc:…`) that holds
 *    the tiny `{version,count,collectedAt}` entry per (target, module,
 *    collection[, scope]). Metadata only — no tenant payload ever lives here.
 */

/**
 * Read-cache key namespace + wire-format version. This is the WIRE CONTRACT
 * shared with the client-side Python engines (`scripts/remote/engines/
 * common.py`, `lprc:v1` there): every read-cache key the panel builds and every
 * key the engines write share this prefix, so it MUST bump atomically on both
 * sides. Defined here once so `remote-cache/index.ts` and `files-cache/index.ts`
 * derive it instead of re-embedding the literal.
 */
export const RC_KEY_PREFIX = "lprc:v1";

/**
 * Write-queue key namespace (paired WIRE CONTRACT with `RC_KEY_PREFIX`; the
 * Python worker reads `lpwq:v1` keys in `scripts/remote/engines/common.py`).
 * Bumping this prefix MUST be done atomically with the Python side.
 */
export const WQ_KEY_PREFIX = "lpwq:v1";

/** `:scope:<scope>` for scoped blobs; `""` for the unscoped full collection. */
export function scopeSuffix(scope?: string): string {
  return scope === undefined || scope === "" ? "" : `:scope:${scope}`;
}

/** Panel-local meta key for (target, module, collection[, scope]). */
export function panelMetaKey(targetId: string, module: string, collection: string, scope?: string): string {
  return `panel:rc:${targetId}:${module}:${collection}${scopeSuffix(scope)}`;
}

// ── write-queue key builders ──────────────────────────────────────────────
//
// Redis key namespace for the per-target write queue (worker on the client
// server drains jobs from `:queue`, applies steps, then publishes `:done`).
// All builders are exported so callers should NEVER assemble these strings
// inline with template literals.

/** Job payload (LIST element of queue/processing; HASH key `:job:<id>`). */
export function wqJobKey(jobId: string): string {
  return `${WQ_KEY_PREFIX}:job:${jobId}`;
}

/** Per-job status (HASH `:status:<id>`; mirrored to a counter `:status:<id>`). */
export function wqStatusKey(jobId: string): string {
  return `${WQ_KEY_PREFIX}:status:${jobId}`;
}

/** Per-job done notify channel (LIST `:done:<id>`; BLPOP'd by submit-mutation). */
export function wqDoneKey(jobId: string): string {
  return `${WQ_KEY_PREFIX}:done:${jobId}`;
}

/** FIFO LIST of pending jobIds. */
export const WQ_QUEUE_KEY = `${WQ_KEY_PREFIX}:queue`;

/** Idempotency mirror LIST (worker BRPOPLPUSHes here while processing). */
export const WQ_PROCESSING_KEY = `${WQ_KEY_PREFIX}:processing`;

/** Credential blob consumed by the per-target Redis worker's askpass shim. */
export const WQ_CRED_KEY = `${WQ_KEY_PREFIX}:cred`;

/** Namespaced credential blob builder for shared-Redis consumers. */
export function wqCredKey(targetId: string): string {
  return `${WQ_CRED_KEY}:${targetId}`;
}
