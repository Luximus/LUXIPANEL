// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * API keys repository — file-backed via dataStore (panel config).
 *   ${LUXIPANEL_CONFIG_DIR}/webhooks/api-keys.json
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ApiKey, NewApiKey } from "../models/index.js";

const MODULE = "webhooks";
const COLLECTION = "api-keys";

interface StoredKey {
  id: number;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[] | null;
  enabled: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

function fromStored(d: StoredKey): ApiKey {
  return {
    id: d.id,
    name: d.name,
    keyHash: d.keyHash,
    keyPrefix: d.keyPrefix,
    scopes: d.scopes,
    enabled: d.enabled,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
    lastUsedAt: d.lastUsedAt ? new Date(d.lastUsedAt) : null,
    createdAt: new Date(d.createdAt),
  } as unknown as ApiKey;
}

function store(executor?: Executor | null) {
  return dataStore<StoredKey>(executor, MODULE, COLLECTION, { timestamps: { createdAt: "createdAt" } });
}

export const apiKeyRepository = {
  async findAll(executor?: Executor | null): Promise<ApiKey[]> {
    const items = await store(executor).list();
    return items
      .map((d) => fromStored(d as unknown as StoredKey))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async findByHash(keyHash: string, executor?: Executor | null): Promise<ApiKey | undefined> {
    const doc = await store(executor).find((d) => d.keyHash === keyHash);
    return doc ? fromStored(doc as unknown as StoredKey) : undefined;
  },

  async create(data: Omit<NewApiKey, "id" | "createdAt">, executor?: Executor | null): Promise<ApiKey> {
    const created = await store(executor).create({
      name: data.name,
      keyHash: data.keyHash,
      keyPrefix: data.keyPrefix,
      scopes: (data.scopes as string[] | null | undefined) ?? null,
      enabled: data.enabled ?? true,
      expiresAt: data.expiresAt instanceof Date ? data.expiresAt.toISOString() : ((data.expiresAt as unknown as string | null) ?? null),
      lastUsedAt: null,
      createdAt: "",
    } as StoredKey & { id?: string | number });
    return fromStored(created as unknown as StoredKey);
  },

  async touchLastUsed(id: number, executor?: Executor | null): Promise<void> {
    await store(executor).update(id, { lastUsedAt: new Date().toISOString() });
  },

  async delete(id: number, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(id);
  },
};
