// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Calendar repository — file-backed via dataStore.
 *   ${LUXIPANEL_CONFIG_DIR}/mail/calendars.json
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { Calendar, NewCalendar } from "../models/index.js";

const MODULE = "mail";
const COLLECTION = "calendars";

interface StoredCalendar {
  id: number;
  accountId: number;
  name: string;
  description: string | null;
  color: string;
  timezone: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function fromStored(d: StoredCalendar): Calendar {
  return {
    id: d.id,
    accountId: d.accountId,
    name: d.name,
    description: d.description,
    color: d.color,
    timezone: d.timezone,
    enabled: d.enabled,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as Calendar;
}

const store = makeKvStore<StoredCalendar>({ module: MODULE, collection: COLLECTION });

export const calendarRepository = {
  async listByAccountId(accountId: number, executor?: Executor | null): Promise<Calendar[]> {
    const items = await store(executor).query((d) => d.accountId === accountId);
    return items
      .map((d) => fromStored(d as unknown as StoredCalendar))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  },

  async findById(id: number, executor?: Executor | null): Promise<Calendar | undefined> {
    const doc = await store(executor).get(id);
    return doc ? fromStored(doc as unknown as StoredCalendar) : undefined;
  },

  async findByAccountAndName(accountId: number, name: string, executor?: Executor | null): Promise<Calendar | undefined> {
    const doc = await store(executor).find((d) => d.accountId === accountId && d.name === name);
    return doc ? fromStored(doc as unknown as StoredCalendar) : undefined;
  },

  async create(data: NewCalendar, executor?: Executor | null): Promise<Calendar> {
    const created = await store(executor).create({
      accountId: data.accountId,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? "#3b82f6",
      timezone: data.timezone ?? "UTC",
      enabled: data.enabled ?? true,
      createdAt: "",
      updatedAt: "",
    } as StoredCalendar & { id?: string | number });
    return fromStored(created as unknown as StoredCalendar);
  },

  async update(id: number, data: Partial<NewCalendar>, executor?: Executor | null): Promise<Calendar | undefined> {
    const updated = await store(executor).update(id, data as Partial<StoredCalendar>);
    return updated ? fromStored(updated as unknown as StoredCalendar) : undefined;
  },

  async delete(id: number, executor?: Executor | null): Promise<Calendar | undefined> {
    const existing = await store(executor).get(id);
    if (!existing) return undefined;
    await store(executor).delete(id);
    return fromStored(existing as unknown as StoredCalendar);
  },
};
