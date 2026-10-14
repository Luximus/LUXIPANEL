// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";

export interface WebhookDelivery {
  id?: number;
  webhookId: number;
  event: string;
  delivered: boolean;
  status: number | null;
  attempts: number;
  at: string;
}

const store = makeKvStore<WebhookDelivery>({ module: "webhooks", collection: "deliveries" });

export const deliveryRepository = {
  async record(delivery: Omit<WebhookDelivery, "id">): Promise<void> {
    await store().create(delivery);
    const all = await store().list();
    if (all.length > 500) {
      const stale = all.sort((a, b) => a.at.localeCompare(b.at)).slice(0, all.length - 500);
      for (const item of stale) if (item.id != null) await store().delete(item.id);
    }
  },
  async recent(webhookId: number): Promise<WebhookDelivery[]> {
    return (await store().list())
      .filter((item) => item.webhookId === webhookId)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 30);
  },
};
