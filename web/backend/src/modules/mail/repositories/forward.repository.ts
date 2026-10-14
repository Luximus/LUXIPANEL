// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Forward repository — file-backed via dataStore.
 *   ${LUXIPANEL_CONFIG_DIR}/mail/forwards.json
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { Forward } from "../models/index.js";

const MODULE = "mail";
const COLLECTION = "forwards";

interface StoredForward {
  id: number;
  accountId: number;
  destination: string;
  keepCopy: boolean;
  enabled: boolean;
  createdAt: string;
}

function fromStored(d: StoredForward): Forward {
  return {
    id: d.id,
    accountId: d.accountId,
    destination: d.destination,
    keepCopy: d.keepCopy,
    enabled: d.enabled,
    createdAt: new Date(d.createdAt),
  } as unknown as Forward;
}

function store(executor?: Executor | null) {
  return dataStore<StoredForward>(executor, MODULE, COLLECTION, { timestamps: { createdAt: "createdAt" } });
}

export const forwardRepository = {
  async findByAccountId(accountId: number, executor?: Executor | null): Promise<Forward[]> {
    const items = await store(executor).query((d) => d.accountId === accountId);
    return items.map((d) => fromStored(d as unknown as StoredForward));
  },

  async findAll(executor?: Executor | null): Promise<Forward[]> {
    const items = await store(executor).list();
    return items.map((d) => fromStored(d as unknown as StoredForward));
  },
};
