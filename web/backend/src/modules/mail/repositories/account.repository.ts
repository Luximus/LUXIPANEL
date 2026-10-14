// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Account repository — file-backed via dataStore.
 *   ${LUXIPANEL_CONFIG_DIR}/mail/accounts.json
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { Account } from "../models/index.js";

const MODULE = "mail";
const COLLECTION = "accounts";

interface StoredAccount {
  id: number;
  address: string;
  domain: string;
  passwordEncrypted: string;
  passwordHash: string;
  displayName: string | null;
  quotaMb: number;
  enabled: boolean;
  incomingMode: string;
  outgoingMode: string;
  loginMode: string;
  plusAddressingAutoFolder: boolean;
  createdAt: string;
  updatedAt: string;
}

function fromStored(d: StoredAccount): Account {
  return {
    id: d.id,
    address: d.address,
    domain: d.domain,
    passwordEncrypted: d.passwordEncrypted,
    passwordHash: d.passwordHash,
    displayName: d.displayName,
    quotaMb: d.quotaMb,
    enabled: d.enabled,
    incomingMode: d.incomingMode,
    outgoingMode: d.outgoingMode,
    loginMode: d.loginMode,
    plusAddressingAutoFolder: d.plusAddressingAutoFolder,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as Account;
}

const store = makeKvStore<StoredAccount>({ module: MODULE, collection: COLLECTION });

export const accountRepository = {
  async findAll(executor?: Executor | null): Promise<Account[]> {
    const items = await store(executor).list();
    return items
      .map((d) => fromStored(d as unknown as StoredAccount))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getDomains(executor?: Executor | null): Promise<string[]> {
    const items = (await store(executor).list()) as unknown as StoredAccount[];
    return Array.from(new Set(items.map((d) => d.domain))).sort();
  },
};
