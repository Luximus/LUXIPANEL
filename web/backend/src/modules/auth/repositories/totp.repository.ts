// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TOTP secrets repository — file-backed via dataStore. One doc per user
 * keyed by `userId`. Lives at `${LUXIPANEL_CONFIG_DIR}/auth/totp.json`.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { TotpSecret } from "../models/index.js";

interface StoredTotp {
  userId: number;
  secret: string;
  enabled: boolean;
  enabledAt: string | null;
  /** RFC-6238 time step of the last code accepted for this user. Codes whose
   *  matched step is <= this are rejected as replays. Absent until first use. */
  lastUsedStep?: number;
  createdAt: string;
  updatedAt: string;
}

function fromStored(d: StoredTotp): TotpSecret {
  return {
    id: d.userId,
    userId: d.userId,
    secret: d.secret,
    enabled: d.enabled,
    enabledAt: d.enabledAt ? new Date(d.enabledAt) : null,
    createdAt: new Date(d.createdAt),
  } as unknown as TotpSecret;
}

const store = makeKvStore<StoredTotp>({ module: "auth", collection: "totp" });

export const totpRepository = {
  async getByUser(userId: number, executor?: Executor | null): Promise<TotpSecret | undefined> {
    const doc = await store(executor).get(userId);
    return doc ? fromStored(doc as unknown as StoredTotp) : undefined;
  },

  async upsert(userId: number, secret: string, enabled: boolean, executor?: Executor | null): Promise<TotpSecret> {
    const existing = await store(executor).get(userId);
    if (existing) {
      const updated = await store(executor).update(userId, { secret, enabled });
      return fromStored(updated as unknown as StoredTotp);
    }
    const created = await store(executor).create({
      userId,
      secret,
      enabled,
      enabledAt: null,
      createdAt: "",
      updatedAt: "",
    } as StoredTotp & { id?: string | number });
    return fromStored(created as unknown as StoredTotp);
  },

  async enable(userId: number, executor?: Executor | null): Promise<void> {
    await store(executor).update(userId, { enabled: true, enabledAt: new Date().toISOString() });
  },

  async disable(userId: number, executor?: Executor | null): Promise<void> {
    await store(executor).update(userId, { enabled: false, enabledAt: null });
  },

  async remove(userId: number, executor?: Executor | null): Promise<void> {
    await store(executor).delete(userId);
  },

  /** Last accepted TOTP time step (anti-replay). undefined if never used. */
  async getLastUsedStep(userId: number, executor?: Executor | null): Promise<number | undefined> {
    const doc = await store(executor).get(userId);
    return (doc as unknown as StoredTotp | null)?.lastUsedStep;
  },

  /** Persist the time step of the just-accepted code (anti-replay). */
  async setLastUsedStep(userId: number, step: number, executor?: Executor | null): Promise<void> {
    await store(executor).update(userId, { lastUsedStep: step } as Partial<StoredTotp>);
  },
};
