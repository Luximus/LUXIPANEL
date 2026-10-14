// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Settings repository — file-backed (kvStore) replacement of the former
 * Drizzle/Postgres implementation. Keeps the same shape (`Setting`,
 * methods) so the rest of the code keeps compiling, but every read/write
 * lands on `${LUXIPANEL_CONFIG_DIR}/settings/<category>.json` on the local
 * panel host (or remote target, when an executor is attached to the
 * caller).
 *
 * Each setting document:
 *   { value: string; category: string; description: string|null;
 *     createdAt: string; updatedAt: string }
 */

import { kv } from "../../../shared/kv-store/index.js";
import { getContextExecutor } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/index.js";

export interface Setting {
  key: string;
  value: string;
  category: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredSetting {
  value: string;
  category: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

const MODULE = "admin";
const COLLECTION = "settings";

function fromStored(id: string, doc: StoredSetting): Setting {
  return {
    key: id,
    value: doc.value,
    category: doc.category,
    description: doc.description ?? null,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  };
}

function store(executor?: Executor | null) {
  return kv(executor).module(MODULE).collection<StoredSetting>(COLLECTION);
}

export const settingsRepository = {
  async get(key: string, executor?: Executor | null): Promise<string | null> {
    const doc = await store(executor).get(key);
    return doc?.value ?? null;
  },

  async getByCategory(category: string, executor?: Executor | null): Promise<Setting[]> {
    const items = await store(executor).query((doc) => doc.category === category);
    return items.map((it) => fromStored(it.id, it as unknown as StoredSetting)).sort((a, b) => a.key.localeCompare(b.key));
  },

  async getAll(executor?: Executor | null): Promise<Setting[]> {
    const items = await store(executor).list();
    return items
      .map((it) => fromStored(it.id, it as unknown as StoredSetting))
      .sort((a, b) => (a.category.localeCompare(b.category) || a.key.localeCompare(b.key)));
  },

  async set(key: string, value: string, category = "general", description?: string, executor?: Executor | null): Promise<Setting> {
    const now = new Date().toISOString();
    const existing = await store(executor).get(key);
    const next: StoredSetting = {
      value,
      category,
      description: description ?? existing?.description ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await store(executor).set(key, next);
    return fromStored(key, next);
  },

  async delete(key: string, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(key);
  },

  async setBulk(entries: Array<{ key: string; value: string; category?: string }>, executor?: Executor | null): Promise<void> {
    if (entries.length === 0) return;
    // Single read-modify-write transaction: one SFTP round-trip pair instead of
    // N×(read+write). The legacy per-entry loop also raced against itself when
    // concurrent bulk saves interleaved reads/writes on the same sidecar.
    const exec = executor ?? getContextExecutor();
    if (!exec) {
      // Match the kv-store fail-closed policy: managed-only, no panel-host
      // fallback. Surfaced verbatim so the controller can return a precise 400
      // instead of an opaque 500 from deep in the stack.
      throw new Error(
        "settings-bulk: no executor in scope — a per-server executor is required",
      );
    }
    const now = new Date().toISOString();
    await store(exec).transaction(async (current) => {
      const next: Record<string, StoredSetting> = { ...current };
      for (const e of entries) {
        const prev = current[e.key] as StoredSetting | undefined;
        next[e.key] = {
          value: e.value,
          category: e.category ?? prev?.category ?? "general",
          description: prev?.description ?? null,
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
        };
      }
      return { next, result: undefined };
    });
  },
};
