// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Contact repository — file-backed via dataStore.
 *   ${LUXIPANEL_CONFIG_DIR}/mail/contacts.json
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { Contact } from "../models/index.js";

const MODULE = "mail";
const COLLECTION = "contacts";

interface StoredContact {
  id: number;
  accountId: number;
  email: string;
  displayName: string | null;
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
}

function fromStored(d: StoredContact): Contact {
  return {
    id: d.id,
    accountId: d.accountId,
    email: d.email,
    displayName: d.displayName,
    useCount: d.useCount,
    lastUsedAt: new Date(d.lastUsedAt),
    createdAt: new Date(d.createdAt),
  } as unknown as Contact;
}

function store(executor?: Executor | null) {
  return dataStore<StoredContact>(executor, MODULE, COLLECTION, { timestamps: { createdAt: "createdAt" } });
}

export const contactRepository = {
  async search(accountId: number, query: string, limit = 10, executor?: Executor | null): Promise<Contact[]> {
    const term = query.toLowerCase();
    const items = await store(executor).query((d) => d.accountId === accountId && d.email.toLowerCase().includes(term));
    return items
      .map((d) => fromStored(d as unknown as StoredContact))
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, limit);
  },

  async list(accountId: number, executor?: Executor | null): Promise<Contact[]> {
    const items = await store(executor).query((d) => d.accountId === accountId);
    return items
      .map((d) => fromStored(d as unknown as StoredContact))
      .sort((a, b) => {
        if (b.useCount !== a.useCount) return b.useCount - a.useCount;
        const lb = new Date(b.lastUsedAt).getTime();
        const la = new Date(a.lastUsedAt).getTime();
        if (lb !== la) return lb - la;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  },

  async findById(id: number, executor?: Executor | null): Promise<Contact | undefined> {
    const doc = await store(executor).get(id);
    return doc ? fromStored(doc as unknown as StoredContact) : undefined;
  },

  async create(accountId: number, email: string, displayName?: string, executor?: Executor | null): Promise<Contact> {
    const created = await store(executor).create({
      accountId,
      email: email.toLowerCase(),
      displayName: displayName ?? null,
      useCount: 1,
      lastUsedAt: new Date().toISOString(),
      createdAt: "",
    } as StoredContact & { id?: string | number });
    return fromStored(created as unknown as StoredContact);
  },

  async update(
    id: number,
    data: { email?: string; displayName?: string | null; useCount?: number },
    executor?: Executor | null,
  ): Promise<Contact | undefined> {
    const patch: Partial<StoredContact> = {};
    if (data.email !== undefined) patch.email = data.email.toLowerCase();
    if (data.displayName !== undefined) patch.displayName = data.displayName;
    if (data.useCount !== undefined) patch.useCount = data.useCount;
    const updated = await store(executor).update(id, patch);
    return updated ? fromStored(updated as unknown as StoredContact) : undefined;
  },

  async delete(id: number, executor?: Executor | null): Promise<Contact | undefined> {
    const existing = await store(executor).get(id);
    if (!existing) return undefined;
    await store(executor).delete(id);
    return fromStored(existing as unknown as StoredContact);
  },

  async touch(accountId: number, email: string, displayName?: string, executor?: Executor | null): Promise<Contact> {
    const lc = email.toLowerCase();
    const existing = await store(executor).find((d) => d.accountId === accountId && d.email === lc);
    if (existing) {
      const updated = await store(executor).update(existing.id, {
        useCount: ((existing as unknown as StoredContact).useCount ?? 0) + 1,
        lastUsedAt: new Date().toISOString(),
        displayName: displayName || (existing as unknown as StoredContact).displayName,
      });
      return fromStored(updated as unknown as StoredContact);
    }
    return this.create(accountId, lc, displayName, executor);
  },
};
