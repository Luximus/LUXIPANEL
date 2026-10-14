// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook repository — file-backed via dataStore (panel config).
 *   ${LUXIPANEL_CONFIG_DIR}/webhooks/webhooks.json
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { Webhook, NewWebhook, WebhookEvent } from "../models/index.js";

export const MODULE = "webhooks";
export const COLLECTION = "webhooks";

interface StoredWebhook {
  id: number;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  enabled: boolean;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

function fromStored(d: StoredWebhook): Webhook {
  return {
    id: d.id,
    name: d.name,
    url: d.url,
    secret: d.secret,
    events: d.events,
    enabled: d.enabled,
    failureCount: d.failureCount,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as Webhook;
}

const store = makeKvStore<StoredWebhook>({ module: MODULE, collection: COLLECTION });

export const webhookRepository = {
  async findAll(executor?: Executor | null): Promise<Webhook[]> {
    const items = await store(executor).list();
    return items
      .map((d) => fromStored(d as unknown as StoredWebhook))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async findEnabled(executor?: Executor | null): Promise<Webhook[]> {
    const items = await store(executor).query((d) => d.enabled === true);
    return items.map((d) => fromStored(d as unknown as StoredWebhook));
  },

  async findByEvent(event: WebhookEvent, executor?: Executor | null): Promise<Webhook[]> {
    const enabled = await this.findEnabled(executor);
    return enabled.filter((w) => (w.events as WebhookEvent[]).includes(event));
  },

  async findById(id: number, executor?: Executor | null): Promise<Webhook | undefined> {
    const doc = await store(executor).get(id);
    return doc ? fromStored(doc as unknown as StoredWebhook) : undefined;
  },

  async create(data: Omit<NewWebhook, "id" | "createdAt" | "updatedAt">, executor?: Executor | null): Promise<Webhook> {
    const created = await store(executor).create({
      name: data.name,
      url: data.url,
      secret: data.secret,
      events: (data.events as WebhookEvent[] | undefined) ?? [],
      enabled: data.enabled ?? true,
      failureCount: data.failureCount ?? 0,
      createdAt: "",
      updatedAt: "",
    } as StoredWebhook & { id?: string | number });
    return fromStored(created as unknown as StoredWebhook);
  },

  async update(id: number, data: Partial<Omit<NewWebhook, "id" | "createdAt">>, executor?: Executor | null): Promise<Webhook | undefined> {
    const updated = await store(executor).update(id, data as Partial<StoredWebhook>);
    return updated ? fromStored(updated as unknown as StoredWebhook) : undefined;
  },

  async incrementFailure(id: number, executor?: Executor | null): Promise<void> {
    const w = await store(executor).get(id);
    if (!w) return;
    await store(executor).update(id, { failureCount: ((w as unknown as StoredWebhook).failureCount ?? 0) + 1 });
  },

  async resetFailure(id: number, executor?: Executor | null): Promise<void> {
    await store(executor).update(id, { failureCount: 0 });
  },

  async delete(id: number, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(id);
  },
};
