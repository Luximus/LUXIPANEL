// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Gateway webhook repository — INSTANCE-level state on the panel host.
 *
 *   ${LUXIPANEL_CONFIG_DIR}/webhooks/gateways.json
 *
 * Gateway (inbound) webhooks are hosted by THIS panel installation, not by any
 * bridged server. The public ingest endpoint (`/api/hooks/in/:token`) has no
 * SSH session and therefore no per-server executor, so this store is ALWAYS
 * read/written through `localExecutor`, exactly like the license/branding/MCP
 * instance state. Never resolve the per-request executor here — that would make
 * a gateway visible only while its creator's server happens to be connected.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import type { GatewayWebhook, GatewayPayloadSample } from "../models/gateway-webhook.model.js";

const MODULE = "webhooks";
const COLLECTION = "gateways";

type StoredGateway = Omit<GatewayWebhook, "id"> & { id: number };

function store() {
  // Pinned to the panel host. Not in the cacheable allowlist, so dataStore's
  // read-through/bump are inert — every call is a direct local read/write.
  return dataStore<StoredGateway>(localExecutor, MODULE, COLLECTION);
}

export const gatewayWebhookRepository = {
  async findAll(): Promise<GatewayWebhook[]> {
    const items = await store().list();
    return items
      .map((d) => d as unknown as GatewayWebhook)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async findById(id: number): Promise<GatewayWebhook | undefined> {
    const doc = await store().get(id);
    return doc ? (doc as unknown as GatewayWebhook) : undefined;
  },

  async findByToken(token: string): Promise<GatewayWebhook | undefined> {
    const doc = await store().find((d) => (d as unknown as GatewayWebhook).token === token);
    return doc ? (doc as unknown as GatewayWebhook) : undefined;
  },

  async create(
    data: Omit<GatewayWebhook, "id" | "createdAt" | "updatedAt">,
  ): Promise<GatewayWebhook> {
    const created = await store().create({
      ...data,
      createdAt: "",
      updatedAt: "",
    } as StoredGateway);
    return created as unknown as GatewayWebhook;
  },

  async update(
    id: number,
    patch: Partial<Omit<GatewayWebhook, "id" | "createdAt">>,
  ): Promise<GatewayWebhook | undefined> {
    const updated = await store().update(id, patch as Partial<StoredGateway>);
    return updated ? (updated as unknown as GatewayWebhook) : undefined;
  },

  async delete(id: number): Promise<boolean> {
    return store().delete(id);
  },

  /**
   * Atomically record one inbound delivery: prepend the sample to the ring
   * buffer, bump the counter and lastReceivedAt — all inside a single
   * transaction. The public ingest path is concurrent and unauthenticated, so a
   * read-modify-write (findByToken → update) would drop samples and undercount
   * when two deliveries race. No-op if the gateway vanished mid-flight.
   */
  async recordDelivery(
    id: number,
    sample: GatewayPayloadSample,
    maxSamples: number,
  ): Promise<void> {
    await store().transaction(async (current) => {
      const key = String(id);
      const row = current[key] as StoredGateway | undefined;
      if (!row) return { next: current, result: undefined };
      const recent = [sample, ...(row.recentPayloads ?? [])].slice(0, maxSamples);
      current[key] = {
        ...row,
        recentPayloads: recent,
        receivedCount: (row.receivedCount ?? 0) + 1,
        lastReceivedAt: sample.receivedAt,
      };
      return { next: current, result: undefined };
    });
  },
};
