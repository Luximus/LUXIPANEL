// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Executor } from "../../../shared/executor/index.js";
import { AGENT_PROTOCOL, decodeCoordination } from "../models/agent-envelope.js";
import type { AgentMessage } from "../models/agent-message.types.js";
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { conversationsRepository, type ConversationMessage } from "../repositories/conversations.repository.js";

/** Reading an internal notice and completing the whole team task are different
 * events. Only a persisted recipient phase proves consumption, including a
 * successful phase that is still waiting for its team or a user decision. */
export function consumedAgentMessages(history: ConversationMessage[], delivered: AgentMessage[]): Map<string, string> {
  const candidates = new Map(delivered.filter(message => message.id && message.status === "delivered")
    .map(message => [message.id!, message]));
  const awaiting = new Set<string>();
  const consumed = new Map<string, string>();
  for (const turn of history) {
    if (turn.compacted || (turn.role === "user" && !turn.auto)) {
      awaiting.clear();
      continue;
    }
    if (turn.role === "user") {
      let packet: Record<string, unknown> | undefined;
      try { packet = decodeCoordination(turn.content) as Record<string, unknown>; } catch { /* legacy notice */ }
      const detail = packet?.detail as { messageId?: unknown } | undefined;
      const message = typeof detail?.messageId === "string" ? candidates.get(detail.messageId) : undefined;
      if (packet?.protocol === AGENT_PROTOCOL && message
        && packet.from === message.fromAgentId && packet.to === message.toAgentId
        && Date.parse(turn.ts) >= Date.parse(message.createdAt)) {
        awaiting.add(message.id!);
      } else if (turn.content.startsWith("[MENSAJE DE ")) {
        for (const legacy of candidates.values()) {
          const prefix = `[MENSAJE DE ${legacy.fromAgentName} (agente ${legacy.fromAgentId})]\n${legacy.text}`;
          if (turn.content.startsWith(prefix) && Date.parse(turn.ts) >= Date.parse(legacy.createdAt)) awaiting.add(legacy.id!);
        }
      }
      continue;
    }
    if (!turn.error && !turn.interrupted && Number.isFinite(Date.parse(turn.ts))
      && (turn.pending || turn.ask?.length || turn.content.trim())) {
      for (const id of awaiting) consumed.set(id, turn.ts);
    }
    // A later unrelated reply cannot turn a failed/unconfirmed phase into a receipt.
    awaiting.clear();
  }
  return consumed;
}

export async function reconcileAgentMessageReceipts(executor: Executor, conversationId: string): Promise<void> {
  const delivered = (await agentMessagesRepository.listByDeliveryConversation(executor, conversationId))
    .filter(message => message.status === "delivered");
  if (!delivered.length) return;
  const history = await conversationsRepository.allMessages(executor, conversationId);
  // Fail closed when the queue cannot be observed; never infer it is empty.
  const queued = await agentQueueRepository.listFor(executor, conversationId);
  const consumed = consumedAgentMessages(history, delivered);
  for (const message of delivered) {
    const readAt = message.id && consumed.get(message.id);
    if (!readAt || queued.some(turn => turn.agentMessageId === message.id || turn.userText.includes(message.text))) continue;
    await agentMessagesRepository.update(executor, message.id!, { status: "read", readAt });
  }
}
