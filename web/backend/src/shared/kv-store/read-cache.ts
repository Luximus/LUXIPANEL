// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * kv-store — OPT-IN, scope-local read memo.
 *
 * Every kv-store read is a full sidecar read over the per-server executor
 * (SSH/SFTP through the LP gateway; with privilege-drop each one is its own
 * exec channel). Handlers that resolve the SAME collection several times in one
 * request therefore pay several round-trips for identical bytes — e.g. the
 * assistant's `resolveScope()` reads the conversations index and then the
 * chosen store re-reads that same file to fetch the doc.
 *
 * `withKvReadCache(fn)` opens a scope in which each `(executor, module,
 * collection)` triple is read AT MOST ONCE; the in-flight promise is shared, so
 * concurrent readers also collapse into a single round-trip. The map lives only
 * for the duration of `fn` and dies with it — this is a per-scope memo, NOT a
 * cache:
 *
 *   • Scoped by executor key (per-server) → a memo can never serve one server's
 *     bytes to another. Fail-closed executor resolution is untouched.
 *   • Only READ paths consult it. Mutators (`set`/`update`/`delete`/
 *     `transaction`) always re-read the file inside the collection lock via
 *     `readMapEx`, so the anti-clobber / corrupt-preservation guarantees are
 *     unchanged, and they DROP the memo entry for the collection they wrote so a
 *     later read in the same scope sees the new bytes.
 *   • Rejections are never memoized: a `KvReadError` stays loud on every read.
 *
 * Opened explicitly by the handler that wants it (see the assistant's
 * conversation read endpoints). It must NOT be wrapped around long-lived work
 * (an SSE agent run, a background loop): the memo would then outlive the
 * freshness window it is safe in.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/** collectionKey → in-flight/settled read of that collection's parsed map. */
type ReadMemo = Map<string, Promise<unknown>>;

const storage = new AsyncLocalStorage<ReadMemo>();

/**
 * Run `fn` with a fresh read memo pinned to the current async scope. Nested
 * calls REUSE the outer memo (no re-entrancy surprises). Returns `fn`'s result
 * untouched, so it composes with both sync (`() => next()`) and async callers.
 */
export function withKvReadCache<T>(fn: () => T): T {
  const existing = storage.getStore();
  if (existing) return fn();
  return storage.run(new Map(), fn);
}

/** The memo for the current scope, or `null` outside any `withKvReadCache`. */
export function getKvReadCache(): ReadMemo | null {
  return storage.getStore() ?? null;
}
