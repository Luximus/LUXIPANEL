// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * In-memory waiters (optimization; the sidecar board is the truth). A waiting
 * `team.collect` registers a resolver keyed by the leader conversation; task
 * closes ping them so the wait wakes up before the poll timeout.
 */

const waiters = new Map<string, Set<() => void>>();

export function pingWaiters(leaderConversationId: string): void {
  for (const fn of waiters.get(leaderConversationId) ?? []) {
    try {
      fn();
    } catch {
      /* a broken waiter must never break the close path */
    }
  }
}

/** ¿Hay algún collect esperando en esta conversación de líder? */
export function hasWaiters(leaderConversationId: string): boolean {
  return (waiters.get(leaderConversationId)?.size ?? 0) > 0;
}

/** Resolve on ping / timeout / abort — whichever comes first. */
export function waitForPing(leaderConversationId: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    let set = waiters.get(leaderConversationId);
    if (!set) {
      set = new Set();
      waiters.set(leaderConversationId, set);
    }
    const timer = setTimeout(done, Math.max(0, timeoutMs));
    timer.unref?.();
    function done(): void {
      clearTimeout(timer);
      set?.delete(done);
      if (set && set.size === 0) waiters.delete(leaderConversationId);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    set.add(done);
    signal?.addEventListener("abort", done, { once: true });
  });
}
