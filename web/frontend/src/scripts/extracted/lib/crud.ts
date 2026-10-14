// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `confirmMutateReload()` — the CRUD handler every module had copied (E-04).
 *
 * The same 8-10 line sequence lived in cloudflare/dns, cloudflare/access,
 * servers, users, cron, firewall, expo…:
 *
 *   openConfirm(…)            → early return when the user cancels
 *   api.delete/put/post(…)    → the mutation
 *   if (!res.ok) { toast(err, false); return; }
 *   toast(okMsg);
 *   await awaitJob(res);      → write-behind queue: wait for the worker
 *   void reload();            → only THEN refresh the DataTable
 *
 * Divergences the copies had (and that this helper keeps as EXPLICIT options,
 * so no call site changes behavior):
 *  - some show `res.error` on failure, some a fixed string, some no toast at all;
 *  - some skip `awaitJob` (modules not backed by the write-behind queue) — but
 *    `awaitJob` is a documented no-op when the response carries no `job`, so it
 *    is always safe to run and is called unconditionally here.
 *
 * `toast` is injected instead of imported so each module keeps its own toast
 * flavor (the 3000 ms "family A" timing, the `#toast-inner` markup, custom ids).
 *
 * Imported by the runtime URL `/scripts/extracted/lib/crud.js`. The
 * confirm/job-poll imports stay external (they are shared libs of their own).
 */
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import type { ConfirmOptions } from "/scripts/extracted/lib/confirm.js";
import { awaitJob } from "/scripts/extracted/lib/job-poll.js";

/** Minimal shape of an api-client response this helper inspects. */
export interface MutationResponse {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export interface ConfirmMutateReloadOptions<R extends MutationResponse> {
  /**
   * Confirmation to show before mutating. Omit to mutate straight away (the
   * toggle-style handlers that never asked).
   */
  confirm?: { message: string; options?: ConfirmOptions };
  /** The mutation itself (`() => api.delete(...)`). */
  request: () => Promise<R>;
  /** Toast function of the calling module (`showToast`). */
  toast?: (message: string, ok?: boolean) => void;
  /** Message toasted on success. Omit for a silent success. */
  success?: string;
  /**
   * Message toasted on failure: a fixed string, or a function to reproduce the
   * `res.error ?? "…"` flavor. Omit to stay silent on failure (expo).
   */
  error?: string | ((res: R) => string);
  /** Runs after the job settles, before `reload` (e.g. close a dialog). */
  onSuccess?: (res: R) => void | Promise<void>;
  /** Data refresh — usually `() => void loadX()`. */
  reload?: () => void | Promise<void>;
}

/**
 * Returns `true` when the mutation ran AND succeeded, `false` when the user
 * cancelled or the backend rejected it.
 */
export async function confirmMutateReload<R extends MutationResponse>(
  options: ConfirmMutateReloadOptions<R>,
): Promise<boolean> {
  const { confirm, request, toast, success, error, onSuccess, reload } = options;

  if (confirm && !(await openConfirm(confirm.message, confirm.options ?? {}))) return false;

  const res = await request();
  if (!res.ok) {
    if (error !== undefined) {
      toast?.(typeof error === "function" ? error(res) : error, false);
    }
    return false;
  }

  if (success !== undefined) toast?.(success, true);
  // No-op when the response carries no write-behind job (sync modules).
  await awaitJob(res);
  await onSuccess?.(res);
  await reload?.();
  return true;
}
