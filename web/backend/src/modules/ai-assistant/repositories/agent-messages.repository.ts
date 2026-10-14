// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agent↔agent message persistence — sidecar on the connected server (like
 * conversations and the team task board, which these messages reference):
 *
 *   `${LUXIPANEL_CONFIG_DIR}/assistant/agent-messages.json`
 *
 * The sidecar is the SOURCE OF TRUTH of the async channel: the delivery
 * listener (turn-queue.service) reads the pending message from here, the
 * mailbox is resolved from the pair's previous deliveries, and a message is
 * only marked `read` once the recipient's turn actually finished. A message
 * therefore survives a panel restart with the recipient still powered off.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import {
  isTerminalMessageStatus,
  type AgentMessage,
  type AgentMessageStatus,
} from "../models/agent-message.types.js";

const log = createModuleLogger("assistant-agent-messages");
const MODULE = "assistant";
const COLLECTION = "agent-messages";

function store(executor?: Executor | null) {
  return dataStore<AgentMessage>(executor, MODULE, COLLECTION, { idStrategy: "uuid", timestamps: false });
}

function byCreatedAt(a: AgentMessage, b: AgentMessage): number {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export const agentMessagesRepository = {
  async create(
    executor: Executor | null | undefined,
    item: Omit<AgentMessage, "id" | "createdAt">,
  ): Promise<AgentMessage> {
    return store(executor).create({ ...item, createdAt: new Date().toISOString() });
  },

  async get(executor: Executor | null | undefined, id: string): Promise<AgentMessage | null> {
    return store(executor).get(id) as Promise<AgentMessage | null>;
  },

  /**
   * Patch a message ATOMICALLY (transaction over the sidecar map). Transitions
   * are IDEMPOTENT on terminal states: once a message is read/failed, a
   * competing close (the AI_CHAT_FINISHED listener vs a delivery retry) is
   * dropped instead of overwriting the outcome. Returns the updated message, or
   * null when it is missing.
   */
  async update(
    executor: Executor | null | undefined,
    id: string,
    patch: Partial<Omit<AgentMessage, "id" | "createdAt" | "fromAgentId" | "toAgentId">>,
  ): Promise<AgentMessage | null> {
    return store(executor).transaction(async (current) => {
      const existing = current[id];
      if (!existing) return { next: current, result: null };
      if (patch.status && isTerminalMessageStatus(existing.status) && patch.status !== existing.status) {
        log.debug({ id, from: existing.status, to: patch.status }, "agent-message: terminal transition dropped");
        return { next: current, result: { ...existing, id } };
      }
      const updated = { ...existing, ...patch, id };
      return { next: { ...current, [id]: updated }, result: updated };
    });
  },

  /** Messages of one ordered pair (from → to), oldest first. */
  async listForPair(
    executor: Executor | null | undefined,
    fromAgentId: string,
    toAgentId: string,
  ): Promise<AgentMessage[]> {
    const all = await store(executor).list();
    return all.filter((m) => m.fromAgentId === fromAgentId && m.toAgentId === toAgentId).sort(byCreatedAt);
  },

  /** Every message an agent sent OR received, oldest first (REST + UI). */
  async listForAgent(executor: Executor | null | undefined, agentId: string): Promise<AgentMessage[]> {
    const all = await store(executor).list();
    return all.filter((m) => m.fromAgentId === agentId || m.toAgentId === agentId).sort(byCreatedAt);
  },

  /** Messages delivered into a given mailbox conversation, oldest first. Used by
   *  the AI_CHAT_FINISHED listener to mark the batch it just answered as read. */
  async listByDeliveryConversation(
    executor: Executor | null | undefined,
    deliveryConversationId: string,
  ): Promise<AgentMessage[]> {
    const all = await store(executor).list();
    return all.filter((m) => m.deliveryConversationId === deliveryConversationId).sort(byCreatedAt);
  },

  /** Most recent message delivered into a mailbox conversation (or null). */
  async findByDeliveryConversation(
    executor: Executor | null | undefined,
    deliveryConversationId: string,
  ): Promise<AgentMessage | null> {
    const items = await this.listByDeliveryConversation(executor, deliveryConversationId);
    return items[items.length - 1] ?? null;
  },

  /** Every message not yet in a terminal state (pending + delivered), oldest
   *  first. Drives the mailbox cap and the post-restart re-delivery sweep. */
  async listPending(executor: Executor | null | undefined): Promise<AgentMessage[]> {
    const all = await store(executor).list();
    return all.filter((m) => !isTerminalMessageStatus(m.status)).sort(byCreatedAt);
  },
};

export type { AgentMessage, AgentMessageStatus };
