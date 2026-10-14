// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Autoresponder repository — file-backed via dataStore.
 *   ${LUXIPANEL_CONFIG_DIR}/mail/autoresponders.json
 *
 * One autoresponder per account, keyed by `accountId`.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { Autoresponder } from "../models/index.js";

const MODULE = "mail";
const COLLECTION = "autoresponders";

interface StoredAutoresponder {
  id: number;
  accountId: number;
  enabled: boolean;
  charset: string;
  intervalHours: number;
  localPart: string;
  domain: string;
  fromName: string | null;
  subject: string;
  body: string;
  isHtml: boolean;
  startAt: string | null;
  stopAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function fromStored(d: StoredAutoresponder): Autoresponder {
  return {
    id: d.id,
    accountId: d.accountId,
    enabled: d.enabled,
    charset: d.charset,
    intervalHours: d.intervalHours,
    localPart: d.localPart,
    domain: d.domain,
    fromName: d.fromName,
    subject: d.subject,
    body: d.body,
    isHtml: d.isHtml,
    startAt: d.startAt ? new Date(d.startAt) : null,
    stopAt: d.stopAt ? new Date(d.stopAt) : null,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as Autoresponder;
}

const store = makeKvStore<StoredAutoresponder>({ module: MODULE, collection: COLLECTION });

export const autoresponderRepository = {
  async findByAccountId(accountId: number, executor?: Executor | null): Promise<Autoresponder | undefined> {
    const doc = await store(executor).find((d) => d.accountId === accountId);
    return doc ? fromStored(doc as unknown as StoredAutoresponder) : undefined;
  },

  /** All autoresponders across every account (one per account). */
  async findAll(executor?: Executor | null): Promise<Autoresponder[]> {
    const items = await store(executor).list();
    return items.map((d) => fromStored(d as unknown as StoredAutoresponder));
  },
};
