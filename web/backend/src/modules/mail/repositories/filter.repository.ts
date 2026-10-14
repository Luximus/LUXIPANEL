// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Filter repository — file-backed via dataStore.
 *   ${LUXIPANEL_CONFIG_DIR}/mail/filters.json
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { MailFilter } from "../models/index.js";
import type { MailFilterRule, MailFilterAction } from "../types/filter.types.js";

const MODULE = "mail";
const COLLECTION = "filters";

interface StoredFilter {
  id: number;
  accountId: number;
  name: string;
  enabled: boolean;
  position: number;
  rules: MailFilterRule[];
  actions: MailFilterAction[];
  createdAt: string;
  updatedAt: string;
}

function fromStored(d: StoredFilter): MailFilter {
  return {
    id: d.id,
    accountId: d.accountId,
    name: d.name,
    enabled: d.enabled,
    position: d.position,
    rules: d.rules,
    actions: d.actions,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as MailFilter;
}

const store = makeKvStore<StoredFilter>({ module: MODULE, collection: COLLECTION });

export const filterRepository = {
  async findByAccountId(accountId: number, executor?: Executor | null): Promise<MailFilter[]> {
    const items = await store(executor).query((d) => d.accountId === accountId);
    return items
      .map((d) => fromStored(d as unknown as StoredFilter))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
  },

  /** All filters across every account (unsorted — caller groups/sorts). */
  async findAll(executor?: Executor | null): Promise<MailFilter[]> {
    const items = await store(executor).list();
    return items.map((d) => fromStored(d as unknown as StoredFilter));
  },
};
