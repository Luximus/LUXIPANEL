// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory dataStore double (per module/collection), mocked BEFORE importing
// the repository (repo pattern for sidecar-backed stores).
const stores = new Map<string, Map<string, Record<string, unknown>>>();
let seq = 0;
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: (_executor: unknown, mod: string, col: string) => {
    const key = `${mod}/${col}`;
    if (!stores.has(key)) stores.set(key, new Map());
    const map = stores.get(key)!;
    return {
      async get(id: string) {
        return map.get(String(id)) ?? null;
      },
      async list() {
        return [...map.values()];
      },
      async create(data: Record<string, unknown>) {
        const id = (data["id"] as string | undefined) ?? `id-${++seq}`;
        const doc = { ...data, id };
        map.set(String(id), doc);
        return doc;
      },
      async update(id: string, patch: Record<string, unknown>) {
        const cur = map.get(String(id));
        if (!cur) return null;
        const next = { ...cur, ...patch };
        map.set(String(id), next);
        return next;
      },
      async delete(id: string) {
        return map.delete(String(id));
      },
      async transaction(
        fn: (
          cur: Record<string, Record<string, unknown>>,
        ) => Promise<{ next: Record<string, Record<string, unknown>>; result: unknown }>,
      ) {
        const obj: Record<string, Record<string, unknown>> = Object.fromEntries(map);
        const { next, result } = await fn(obj);
        map.clear();
        for (const [k, v] of Object.entries(next)) map.set(k, v);
        return result;
      },
    };
  },
}));

import { agentMessagesRepository } from "./agent-messages.repository.js";
import type { AgentMessage } from "../models/agent-message.types.js";

const executor = null;

function baseMessage(over: Partial<AgentMessage> = {}): Omit<AgentMessage, "id" | "createdAt"> {
  return {
    fromAgentId: "agent-santiago",
    fromAgentName: "Santiago",
    toAgentId: "agent-mateo",
    toAgentName: "Mateo",
    text: "necesito el endpoint",
    status: "pending",
    hops: 1,
    senderConversationId: "conv-santiago",
    deliveryConversationId: null,
    userId: null,
    user: null,
    ...over,
  };
}

beforeEach(() => {
  stores.clear();
});

describe("agentMessagesRepository", () => {
  it("creates messages with id + createdAt and lists the pair oldest first", async () => {
    const a = await agentMessagesRepository.create(executor, baseMessage({ text: "A" }));
    await new Promise((r) => setTimeout(r, 2));
    const b = await agentMessagesRepository.create(executor, baseMessage({ text: "B" }));
    // Reverse pair (Mateo → Santiago) must NOT show up in the from→to thread.
    await agentMessagesRepository.create(
      executor,
      baseMessage({ fromAgentId: "agent-mateo", toAgentId: "agent-santiago", text: "C" }),
    );
    expect(a.id).toBeTruthy();
    expect(a.createdAt).toBeTruthy();
    expect(b.hops).toBe(1);
    const pair = await agentMessagesRepository.listForPair(executor, "agent-santiago", "agent-mateo");
    expect(pair.map((m) => m.text)).toEqual(["A", "B"]);
  });

  it("listForAgent returns messages sent AND received by that agent", async () => {
    await agentMessagesRepository.create(executor, baseMessage({ text: "enviado" }));
    await agentMessagesRepository.create(
      executor,
      baseMessage({ fromAgentId: "agent-mateo", toAgentId: "agent-santiago", text: "recibido" }),
    );
    await agentMessagesRepository.create(
      executor,
      baseMessage({ fromAgentId: "agent-x", toAgentId: "agent-y", text: "ajeno" }),
    );
    const mine = await agentMessagesRepository.listForAgent(executor, "agent-santiago");
    expect(mine.map((m) => m.text).sort()).toEqual(["enviado", "recibido"]);
  });

  it("update patches a pending message (delivery)", async () => {
    const m = await agentMessagesRepository.create(executor, baseMessage());
    const updated = await agentMessagesRepository.update(executor, m.id!, {
      status: "delivered",
      deliveredAt: "2026-07-11T00:00:00.000Z",
      deliveryConversationId: "conv-buzon",
    });
    expect(updated?.status).toBe("delivered");
    expect(updated?.deliveryConversationId).toBe("conv-buzon");
  });

  it("update is IDEMPOTENT on terminal states: a second close cannot overwrite the outcome", async () => {
    const m = await agentMessagesRepository.create(executor, baseMessage());
    await agentMessagesRepository.update(executor, m.id!, { status: "read", readAt: "2026-07-11T01:00:00.000Z" });
    // Competing close (a late delivery retry after the recipient already answered).
    const second = await agentMessagesRepository.update(executor, m.id!, { status: "failed", error: "boom" });
    expect(second?.status).toBe("read");
    const stored = await agentMessagesRepository.get(executor, m.id!);
    expect(stored?.status).toBe("read");
    expect(stored?.error).toBeUndefined();
  });

  it("update still allows non-status patches after terminal", async () => {
    const m = await agentMessagesRepository.create(executor, baseMessage());
    await agentMessagesRepository.update(executor, m.id!, { status: "read" });
    const patched = await agentMessagesRepository.update(executor, m.id!, { deliveryConversationId: "conv-buzon" });
    expect(patched?.status).toBe("read");
    expect(patched?.deliveryConversationId).toBe("conv-buzon");
  });

  it("update on a missing id returns null", async () => {
    expect(await agentMessagesRepository.update(executor, "no-existe", { status: "read" })).toBeNull();
  });

  it("listByDeliveryConversation / findByDeliveryConversation resolve the mailbox batch", async () => {
    const a = await agentMessagesRepository.create(executor, baseMessage({ text: "A" }));
    await agentMessagesRepository.update(executor, a.id!, { status: "delivered", deliveryConversationId: "conv-buzon" });
    await new Promise((r) => setTimeout(r, 2));
    const b = await agentMessagesRepository.create(executor, baseMessage({ text: "B" }));
    await agentMessagesRepository.update(executor, b.id!, { status: "delivered", deliveryConversationId: "conv-buzon" });
    await agentMessagesRepository.create(executor, baseMessage({ text: "sin entregar" }));

    const batch = await agentMessagesRepository.listByDeliveryConversation(executor, "conv-buzon");
    expect(batch.map((m) => m.text)).toEqual(["A", "B"]);
    const last = await agentMessagesRepository.findByDeliveryConversation(executor, "conv-buzon");
    expect(last?.id).toBe(b.id);
    expect(await agentMessagesRepository.findByDeliveryConversation(executor, "no-existe")).toBeNull();
  });

  it("listPending returns only non-terminal messages (pending + delivered)", async () => {
    await agentMessagesRepository.create(executor, baseMessage({ text: "pendiente" }));
    const d = await agentMessagesRepository.create(executor, baseMessage({ text: "entregado" }));
    await agentMessagesRepository.update(executor, d.id!, { status: "delivered" });
    const r = await agentMessagesRepository.create(executor, baseMessage({ text: "leido" }));
    await agentMessagesRepository.update(executor, r.id!, { status: "read" });
    const f = await agentMessagesRepository.create(executor, baseMessage({ text: "fallido" }));
    await agentMessagesRepository.update(executor, f.id!, { status: "failed" });

    const pending = await agentMessagesRepository.listPending(executor);
    expect(pending.map((m) => m.text).sort()).toEqual(["entregado", "pendiente"]);
  });
});
