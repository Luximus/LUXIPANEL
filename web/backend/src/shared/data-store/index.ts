// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * dataStore — single-entry CRUD helper that every module repository goes
 * through. Sits on top of `kvStore` and adds the conventions modules
 * actually need:
 *
 *   • Auto-generated ids (numeric "next-int" or UUID).
 *   • Automatic `createdAt` / `updatedAt` ISO strings on create/update.
 *   • Type-safe API per (module, collection) pair.
 *
 * Layout on the connected server:
 *
 *   ${LUXIPANEL_CONFIG_DIR}/<module>/<collection>.json   ← one JSON map
 *
 * All I/O happens through the supplied `executor` so every CRUD lands on
 * the right server. Pass `null` to no-op (returns empty data) — useful
 * for boot-time / public endpoints with no session.
 */

import { randomUUID } from "node:crypto";
import { kv } from "../kv-store/index.js";
import type { Executor } from "../executor/index.js";
import { listCached } from "../remote-cache/read-through.js";
import { scheduleRefresh, refreshSync } from "../remote-cache/refresh.js";
import { cachePolicyFor } from "../cache/cacheable-modules.js";

export type IdStrategy = "auto-int" | "uuid";

interface DataStoreOptions {
  /** How to assign new doc ids when callers don't pass one. */
  idStrategy?: IdStrategy;
  /** Override the createdAt/updatedAt field names. */
  timestamps?: { createdAt?: string; updatedAt?: string } | false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoredDoc = Record<string, any>;

export interface DataStore<TDoc extends StoredDoc> {
  /** Read by id. Returns null if missing. */
  get(id: string | number): Promise<(TDoc & { id: string | number }) | null>;
  /** All docs in the collection. */
  list(): Promise<Array<TDoc & { id: string | number }>>;
  /** Filter with a predicate. */
  query(pred: (doc: TDoc & { id: string | number }) => boolean): Promise<Array<TDoc & { id: string | number }>>;
  /** First match. */
  find(pred: (doc: TDoc & { id: string | number }) => boolean): Promise<(TDoc & { id: string | number }) | null>;
  /**
   * Create a new doc. If `data.id` is omitted, the configured idStrategy
   * picks one. Adds `createdAt`/`updatedAt` automatically.
   */
  create(data: TDoc): Promise<TDoc & { id: string | number }>;
  /** Merge-update. Returns null if the doc didn't exist. Pass `{ touch: false }`
   *  to skip refreshing `updatedAt` (housekeeping that isn't "new activity"). */
  update(
    id: string | number,
    patch: Partial<TDoc>,
    opts?: { touch?: boolean },
  ): Promise<(TDoc & { id: string | number }) | null>;
  /** Replace the doc completely (preserving createdAt). */
  set(id: string | number, data: TDoc): Promise<TDoc & { id: string | number }>;
  delete(id: string | number): Promise<boolean>;
  count(): Promise<number>;
  /** Atomic mutator over the whole map. */
  transaction<R>(fn: (current: Record<string, TDoc>) => Promise<{ next: Record<string, TDoc>; result: R }>): Promise<R>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Single-entry CRUD factory. Use as:
 *
 *   const audit = dataStore<AuditDoc>(executor, "auth", "audit-log", { idStrategy: "uuid" });
 *   await audit.create({ userId, eventType, ip, ... });
 *   const recent = await audit.query((d) => d.userId === me);
 */
export function dataStore<TDoc extends StoredDoc>(
  executor: Executor | null | undefined,
  moduleName: string,
  collection: string,
  options: DataStoreOptions = {},
): DataStore<TDoc> {
  const idStrategy = options.idStrategy ?? "auto-int";
  const tsCreated = options.timestamps === false ? null : options.timestamps?.createdAt ?? "createdAt";
  const tsUpdated = options.timestamps === false ? null : options.timestamps?.updatedAt ?? "updatedAt";
  const inner = kv(executor).module(moduleName).collection<TDoc>(collection);

  // `touch` (default true) controls whether `updatedAt` is refreshed. Pass
  // false for housekeeping updates that must NOT count as "new activity"
  // (e.g. clearing a "needs review" flag when the user merely opens a chat).
  function applyTimestamps(doc: TDoc, isCreate: boolean, touch = true): TDoc {
    if (!tsCreated && !tsUpdated) return doc;
    const now = nowIso();
    const next = { ...doc } as TDoc & Record<string, unknown>;
    if (tsUpdated && touch) (next as Record<string, unknown>)[tsUpdated] = now;
    if (isCreate && tsCreated && (next as Record<string, unknown>)[tsCreated] === undefined) {
      (next as Record<string, unknown>)[tsCreated] = now;
    }
    return next;
  }

  // Compute the next auto-int id from a freshly-read map. Folded into the
  // write path so `create(auto-int)` is 1 read + 1 write (not the old read +
  // list + write = 3 RTTs).
  function nextAutoIntIdFromMap(map: Record<string, unknown>): number {
    let max = 0;
    for (const id of Object.keys(map)) {
      const numeric = Number(id);
      if (Number.isFinite(numeric) && numeric > max) max = numeric;
    }
    return max + 1;
  }

  // Read-through cache for non-volatile modules. No-op (just runs the SFTP
  // loader) when the module/collection is not in the allowlist. Falls back
  // transparently on any cache miss / breaker / no-conn. Only reached when an
  // executor is present; the cold (`!executor`) paths use `inner` directly.
  async function cachedList(): Promise<Array<TDoc & { id: string | number }>> {
    return (await listCached(
      executor!,
      moduleName,
      collection,
      async () => (await inner.list()) as Array<TDoc & { id: string | number }>,
    )) as Array<TDoc & { id: string | number }>;
  }

  return {
    async get(id) {
      return (await inner.get(String(id))) as (TDoc & { id: string | number }) | null;
    },
    async list() {
      if (!executor) {
        return (await inner.list()) as Array<TDoc & { id: string | number }>;
      }
      return cachedList();
    },
    async query(pred) {
      // Same cache-first treatment as `list()`: pull the full collection
      // from the per-target Redis when available, then filter in memory.
      // This covers per-account queries like `mail/contacts.list(accountId)`
      // that pred-filter the whole-collection blob.
      if (!executor) {
        return (await inner.query(pred as (doc: TDoc & { id: string }) => boolean)) as Array<TDoc & { id: string | number }>;
      }
      return (await cachedList()).filter((doc) =>
        (pred as (d: TDoc & { id: string | number }) => boolean)(doc),
      );
    },
    async find(pred) {
      if (!executor) {
        return (await inner.find(pred as (doc: TDoc & { id: string }) => boolean)) as (TDoc & { id: string | number }) | null;
      }
      return (await cachedList()).find((doc) =>
        (pred as (d: TDoc & { id: string | number }) => boolean)(doc),
      ) ?? null;
    },
    async create(data) {
      let id: string | number;
      const explicitId = data.id !== undefined && data.id !== null;
      if (explicitId) {
        id = data.id;
      } else if (idStrategy === "uuid") {
        id = randomUUID();
      } else {
        id = ""; // folded into the transaction below
      }
      // Single read-modify-write via kv-store's `transaction` (which already
      // holds the per-collection lock + read-memo drop). Folds the
      // auto-int-id computation into the SAME read that backs the write,
      // turning `create(auto-int)` from 3 RTTs (list + get + set) into 2.
      const stamped = await inner.transaction(async (current) => {
        let nextId: string | number;
        if (explicitId) {
          nextId = id;
        } else if (idStrategy === "uuid") {
          nextId = randomUUID();
        } else {
          nextId = nextAutoIntIdFromMap(current as Record<string, unknown>);
        }
        const nextDoc = applyTimestamps({ ...data, id: nextId } as TDoc, true);
        current[String(nextId)] = nextDoc;
        return { next: current, result: nextDoc };
      });
      await bumpCache(stamped as TDoc);
      return { ...(stamped as object), id: (stamped as { id?: string | number }).id ?? id } as TDoc & { id: string | number };
    },
    async update(id, patch, opts) {
      const touch = opts?.touch ?? true;
      // Single read-modify-write (1 read + 1 write = 2 RTTs) instead of the
      // prior get + set pattern (3 RTTs reading the same JSON twice).
      const merged = await inner.transaction(async (current) => {
        const docId = String(id);
        const existing = current[docId];
        if (!existing) return { next: current, result: null as TDoc | null };
        const next = applyTimestamps(
          { ...(existing as object), ...(patch as object) } as TDoc,
          false,
          touch,
        );
        current[docId] = next;
        return { next: current, result: next };
      });
      if (!merged) return null;
      await bumpCache(merged as TDoc);
      return { ...(merged as object), id } as TDoc & { id: string | number };
    },
    async set(id, data) {
      // Single read-modify-write (2 RTTs vs 3 RTTs): the prior pattern did
      // `get` (read) then `set` (read-modify-write = another read + write).
      const stamped = await inner.transaction(async (current) => {
        const docId = String(id);
        const existing = current[docId];
        const nextDoc = applyTimestamps(
          { ...data, [tsCreated ?? "__"]: (existing as TDoc | null)?.[tsCreated ?? "__"] ?? undefined } as TDoc,
          !existing,
        );
        current[docId] = nextDoc;
        return { next: current, result: nextDoc };
      });
      await bumpCache(stamped as TDoc);
      return { ...(stamped as object), id } as TDoc & { id: string | number };
    },
    async delete(id) {
      // Capture the doc AND delete it inside ONE read-modify-write (the prior
      // `get` + `delete` read the whole collection JSON twice). We still grab
      // the previous doc so bumpCache can extract its scope for a granular
      // refresh; otherwise we'd fall back to whole-collection.
      const docId = String(id);
      let before: TDoc | undefined;
      const deleted = await inner.transaction(async (current) => {
        const existing = current[docId];
        if (existing === undefined) return { next: current, result: false };
        before = existing as TDoc;
        delete current[docId];
        return { next: current, result: true };
      });
      if (deleted) await bumpCache(before);
      return deleted;
    },
    async count() {
      return inner.count();
    },
    async transaction(fn) {
      const result = await inner.transaction(fn);
      await bumpCache();
      return result;
    },
  };

  async function bumpCache(doc?: TDoc): Promise<void> {
    // Targeted refresh after a write. No-op when the module/collection isn't
    // cacheable or there's no executor, so it's cheap on the cold path.
    if (!executor) return;
    const policy = cachePolicyFor(moduleName, collection);
    if (!policy) return;
    // For scoped collections (e.g. mail/contacts has accountId), invalidate
    // ONLY the mutated doc's scope; the rest of the collection stays warm.
    let scope: string | undefined;
    if (policy.scoped && policy.scopeField && doc) {
      const v = (doc as Record<string, unknown>)[policy.scopeField];
      if (v !== undefined && v !== null) scope = String(v);
    }
    // sidecar-mirror collectors are fast (they mirror one JSON file), so we
    // refresh SYNCHRONOUSLY: by the time the mutation resolves the read cache
    // already reflects the write and the DataTable shows it on the next reload
    // — without per-controller job polling. Heavy system-collector collections
    // (mail accounts) don't reach here: they go through submitMutation.
    if (policy.source === "sidecar-mirror") {
      await refreshSync(executor, moduleName, collection, scope);
    } else {
      void scheduleRefresh(executor, moduleName, collection, scope);
    }
  }
}
