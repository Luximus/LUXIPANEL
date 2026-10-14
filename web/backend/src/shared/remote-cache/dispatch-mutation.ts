// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `dispatchMutation()` — "local target runs synchronously, remote target goes
 * through the write-behind queue" (B-10).
 *
 * Seven controller handlers (cron/jobs ×4, firewall/rules ×3) opened with the
 * exact same shape — including a copy of the same explanatory comment:
 *
 *     if (executor.target.id === "local") { …WithExecutor(); res.json(); return; }
 *     const result = await submitMutation(executor, {…});
 *     res.json({ ok: true, job: { id: result.jobId, mode: result.mode } });
 *
 * WHY the local target must never use the queue: the queue's worker
 * (`worker.py`) lives ON the customer's box and is provisioned per remote
 * server. For `target.id === "local"` the panel host IS the target, so the
 * mutation runs synchronously through the (sudo-wrapped) `localExecutor` —
 * never the queue, and never a `child_process` on the panel host.
 *
 * This helper owns ONLY the branch. Each caller keeps its own pre-checks
 * (validation, 404/409 resolution) and builds its own HTTP body, because the
 * envelopes genuinely differ (`data.id`, `data.enabled`, and firewall's
 * `cloudflareAllow`, which must nest `job` INSIDE `data` — the frontend
 * api-client maps `data: json.data ?? json`, so a top-level `job` sibling
 * would be dropped and `awaitJob()` would no-op).
 */

import type { Executor } from "../executor/types.js";
import { submitMutation, type SubmitMode, type SubmitMutationInput } from "./submit-mutation.js";

/** The `job` envelope the frontend's `awaitJob()` polls. */
export interface MutationJobRef {
  id: string;
  mode: SubmitMode;
}

export interface DispatchedMutation<T> {
  /** Whatever the executed branch produced (ids, flags, counters…). */
  data: T;
  /** Present ONLY on the queued (remote) branch. */
  job?: MutationJobRef;
}

/** `true` when the connected server IS the panel host. */
export function isLocalTarget(executor: Executor): boolean {
  return executor.target.id === "local";
}

/**
 * Run `local()` on the local target, or plan + `submitMutation()` on a remote
 * one.
 *
 * `remote()` runs BEFORE the submit, so it is the right place for the planning
 * reads and for throwing `NotFoundError`/`ConflictError` — nothing is enqueued
 * when it throws.
 */
export async function dispatchMutation<T>(opts: {
  executor: Executor;
  local: () => Promise<T>;
  remote: () => Promise<{ data: T; submit: SubmitMutationInput }>;
}): Promise<DispatchedMutation<T>> {
  if (isLocalTarget(opts.executor)) {
    return { data: await opts.local() };
  }
  const { data, submit } = await opts.remote();
  const result = await submitMutation(opts.executor, submit);
  return { data, job: { id: result.jobId, mode: result.mode } };
}
