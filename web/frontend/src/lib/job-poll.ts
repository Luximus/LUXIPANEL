// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared write-behind job poller for panel DataTables.
 *
 * Backend mutations on queue-backed collections (mail accounts, users, nginx,
 * ssl, firewall, cron…) return a `job: { id, mode }`. When `mode !== "applied"`
 * the client read cache isn't fresh yet, so callers must poll `/api/jobs/:id`
 * until the worker signals done/failed. A done job may have viewReady=false:
 * the write succeeded but the list remains stale; do not repeat that write.
 * This extracted library shares the scoped API transport with module reads.
 */

import { api, resolveTargetScope, scopeHeaders } from "/scripts/extracted/lib/api-client.js?v=20260506a";

export interface MutationJob {
  id?: string;
  mode?: string; // "applied" | "queued" | "sync-fallback"
}

/**
 * Resolve once the job reaches a terminal state (or the cap elapses). No-op
 * when there's no job (synchronous/local apply) or it already applied.
 */
export async function pollJob(
  job: MutationJob | null | undefined,
  opts: { maxMs?: number; intervalMs?: number } = {},
): Promise<void> {
  if (!job || !job.id || job.mode === "applied") return;
  const identity = () => JSON.stringify([resolveTargetScope(), scopeHeaders()["X-Bridge-Session-Id"]]);
  const scope = identity();
  const deadline = Date.now() + (opts.maxMs ?? 30000);
  const interval = opts.intervalMs ?? 700;
  while (Date.now() < deadline && identity() === scope && !document.hidden) {
    try {
      const result = await api.get<{state: string; viewReady?: boolean; resource?: string}>(`/api/jobs/${encodeURIComponent(job.id)}`);
      if (identity() !== scope) return;
      const state = result.data?.state;
      if (state === "done" && result.data?.viewReady === false) window.dispatchEvent(new CustomEvent("lxp:data:refresh-failed", {detail:{resource:result.data.resource}}));
      if (!result.ok || state === "done" || state === "failed" || state === "unknown") return;
    } catch {
      return; // network hiccup: stop polling, the next manual reload converges
    }
    await new Promise((res) => globalThis.setTimeout(res, interval));
  }
}

/** Convenience: extract the job from an api-client response and poll it. */
export function awaitJob(res: any, opts?: { maxMs?: number; intervalMs?: number }): Promise<void> {
  return pollJob(res?.data?.job ?? res?.job, opts);
}
