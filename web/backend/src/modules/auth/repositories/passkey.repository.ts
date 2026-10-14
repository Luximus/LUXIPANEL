// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Passkey repository — file-backed via dataStore. Lives at
 * `${LUXIPANEL_CONFIG_DIR}/auth/passkeys.json` on the connected server.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { Passkey, NewPasskey } from "../models/index.js";

interface StoredPasskey {
  id: string;
  userId: number;
  label: string;
  credentialId: string;
  publicKeyB64url: string;
  counter: number;
  transports: string[] | null;
  platform: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function fromStored(d: StoredPasskey): Passkey {
  return {
    id: d.id,
    userId: d.userId,
    label: d.label,
    credentialId: d.credentialId,
    publicKeyB64url: d.publicKeyB64url,
    counter: d.counter,
    transports: d.transports,
    platform: d.platform,
    lastUsedAt: d.lastUsedAt ? new Date(d.lastUsedAt) : null,
    revokedAt: d.revokedAt ? new Date(d.revokedAt) : null,
    createdAt: new Date(d.createdAt),
  } as unknown as Passkey;
}

const store = makeKvStore<StoredPasskey>({ module: "auth", collection: "passkeys", idStrategy: "uuid" });

export const passkeyRepository = {
  async findById(id: string, executor?: Executor | null): Promise<Passkey | undefined> {
    const doc = await store(executor).get(id);
    return doc ? fromStored(doc as unknown as StoredPasskey) : undefined;
  },

  async findByCredentialId(credentialId: string, executor?: Executor | null): Promise<Passkey | undefined> {
    const doc = await store(executor).find((d) => d.credentialId === credentialId);
    return doc ? fromStored(doc as unknown as StoredPasskey) : undefined;
  },

  async findActiveByUser(userId: number, executor?: Executor | null): Promise<Passkey[]> {
    const items = await store(executor).query((d) => d.userId === userId && d.revokedAt === null);
    return items
      .map((d) => fromStored(d as unknown as StoredPasskey))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async findAllByUser(userId: number, executor?: Executor | null): Promise<Passkey[]> {
    const items = await store(executor).query((d) => d.userId === userId);
    return items
      .map((d) => fromStored(d as unknown as StoredPasskey))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async create(data: NewPasskey, executor?: Executor | null): Promise<Passkey> {
    const id = (data as { id?: string }).id ?? undefined;
    // dataStore only fills missing timestamps; an empty string is preserved.
    const registeredAt = new Date().toISOString();
    const created = await store(executor).create({
      id: id as string,
      userId: data.userId,
      label: data.label,
      credentialId: data.credentialId,
      publicKeyB64url: data.publicKeyB64url,
      counter: data.counter ?? 0,
      transports: (data.transports as unknown as string[] | null) ?? null,
      platform: data.platform ?? null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: registeredAt,
      updatedAt: registeredAt,
    });
    return fromStored(created as unknown as StoredPasskey);
  },

  async updateCounter(credentialId: string, counter: number, executor?: Executor | null): Promise<void> {
    const target = await store(executor).find((d) => d.credentialId === credentialId);
    if (!target) return;
    await store(executor).update(target.id, { counter, lastUsedAt: new Date().toISOString() });
  },

  async rename(userId: number, id: string, label: string, executor?: Executor | null): Promise<Passkey | null> {
    return store(executor).transaction(async (current) => {
      const existing = current[id];
      if (!existing || existing.userId !== userId || existing.revokedAt !== null) {
        return { next: current, result: null };
      }
      const next = { ...existing, label, updatedAt: new Date().toISOString() };
      current[id] = next;
      return { next: current, result: fromStored({ ...next, id }) };
    });
  },

  async revoke(id: string, executor?: Executor | null): Promise<boolean> {
    const updated = await store(executor).update(id, { revokedAt: new Date().toISOString() });
    return updated !== null;
  },

  async hasActivePasskeys(userId: number, executor?: Executor | null): Promise<boolean> {
    const found = await store(executor).find((d) => d.userId === userId && d.revokedAt === null);
    return found !== null;
  },
};
