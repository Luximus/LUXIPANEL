// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * target-ttl-cache — tiny in-memory TTL cache keyed by target id.
 *
 * Several per-target admin services (security settings, server settings,
 * cache-modules rows) each maintained the same shape: a `Map<string, {value,
 * expiresAt}>`, a `cached && cached.expiresAt > Date.now()` freshness gate, and
 * a delete-on-write invalidation. This consolidates that boilerplate WITHOUT
 * changing behavior — each caller keeps its own TTL and its own key derivation.
 *
 * Semantics preserved exactly:
 *   - `get` returns the stored value only while fresh; a stale entry reads as a
 *     miss (`undefined`) and is left in place until the next `set` overwrites it
 *     (matches the previous inline code, which never eagerly evicted on expiry).
 *   - `set` stamps `expiresAt = Date.now() + ttlMs`.
 *   - `invalidate(key)` deletes that key; `invalidate()` (no/empty key) clears
 *     the whole map (matches the former `if (targetId) delete else clear`).
 */

export interface TargetTtlCache<V> {
  /** Return the cached value if present AND not expired, else `undefined`. */
  get(key: string): V | undefined;
  /** Store `value` under `key`, fresh for `ttlMs`. */
  set(key: string, value: V): void;
  /** Drop one key, or clear the whole cache when `key` is empty/nullish. */
  invalidate(key?: string | null): void;
}

export function createTargetTtlCache<V>(ttlMs: number): TargetTtlCache<V> {
  const store = new Map<string, { value: V; expiresAt: number }>();
  return {
    get(key: string): V | undefined {
      const cached = store.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value;
      return undefined;
    },
    set(key: string, value: V): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    invalidate(key?: string | null): void {
      if (key) store.delete(key);
      else store.clear();
    },
  };
}
