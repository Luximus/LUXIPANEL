// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cupo de workers por usuario (in-process; se repuebla con runs nuevos tras un
 * reinicio — los CLI recuperados no cuentan). Aparte del cap HTTP por usuario.
 */

import { env } from "../../../../config/env.js";

const activeWorkerRuns = new Map<string, Set<string>>();

function workerQuotaKey(userId: string | undefined | null): string {
  return userId != null && userId !== "" ? String(userId) : "anon";
}

export function hasWorkerSlot(userId: string | undefined | null): boolean {
  const max = env.ASSISTANT_MAX_WORKER_RUNS;
  if (max <= 0) return true;
  return (activeWorkerRuns.get(workerQuotaKey(userId))?.size ?? 0) < max;
}

export function workerRunStarted(userId: string | undefined | null, convId: string): void {
  const key = workerQuotaKey(userId);
  const set = activeWorkerRuns.get(key) ?? new Set<string>();
  set.add(convId);
  activeWorkerRuns.set(key, set);
}

export function workerRunEnded(userId: string | undefined | null, convId: string): void {
  const key = workerQuotaKey(userId);
  const set = activeWorkerRuns.get(key);
  if (!set) return;
  set.delete(convId);
  if (set.size === 0) activeWorkerRuns.delete(key);
}

/** Test helper — wipe the in-process worker-quota state. */
export function resetWorkerQuota(): void {
  activeWorkerRuns.clear();
}
