// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { coordinationEnvelope, encodeCoordination } from "../models/agent-envelope.js";
import type { AgentMessage } from "../models/agent-message.types.js";
import type { ConversationMessage } from "../repositories/conversations.repository.js";

vi.mock("../repositories/agent-messages.repository.js", () => ({ agentMessagesRepository: {
  listByDeliveryConversation: vi.fn(), update: vi.fn(),
} }));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: { listFor: vi.fn() } }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: { allMessages: vi.fn() } }));

import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { consumedAgentMessages, reconcileAgentMessageReceipts } from "./agent-message-receipts.js";

const at = (second: number) => new Date(Date.UTC(2026, 9, 18, 10, 0, second)).toISOString();
const message: AgentMessage = {
  id: "receipt-1", fromAgentId: "worker", fromAgentName: "Worker", toAgentId: "leader", toAgentName: "Leader",
  text: "Pruebas terminadas; falta revisión.", status: "delivered", hops: 1, createdAt: at(0),
  deliveryConversationId: "leader-chat",
};
const notice = (over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  role: "user", auto: true, ts: at(1),
  content: encodeCoordination(coordinationEnvelope(message.text, "result", { from: "worker", to: "leader" }, { messageId: message.id })),
  ...over,
});
const reply = (over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  role: "assistant", ts: at(2), content: "Recibido; espero al resto del equipo.", pending: true, ...over,
});
const executor = { kind: "test-target" } as unknown as Executor;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(agentMessagesRepository.listByDeliveryConversation).mockResolvedValue([message]);
  vi.mocked(conversationsRepository.allMessages).mockResolvedValue([notice(), reply()]);
  vi.mocked(agentQueueRepository.listFor).mockResolvedValue([]);
});

describe("agent message consumption receipts", () => {
  it.each([
    { pending: true, content: "" },
    { pending: false, content: "Resultado final." },
    { pending: false, content: "", ask: [{ id: "q", type: "text" as const, text: "¿Qué dominio?" }] },
  ])("acknowledges an attended notice without waiting for the whole team: %j", over => {
    expect(consumedAgentMessages([notice(), reply(over)], [message])).toEqual(new Map([[message.id, at(2)]]));
  });

  it.each([
    reply({ error: "provider failed" }), reply({ interrupted: true }),
    reply({ pending: false, content: "" }), reply({ ts: at(0) }), reply({ ts: "invalid" }),
  ])("does not acknowledge a failed, empty or unconfirmed phase", failed => {
    expect(consumedAgentMessages([notice(), failed, reply()], [message]).size).toBe(0);
  });

  it.each([
    notice({ auto: false }), notice({ compacted: true }), notice({ ts: at(-1) }),
    notice({ content: "Unrelated automatic task" }),
    notice({ content: notice().content.replace("from: worker", "from: other") }),
    notice({ content: notice().content.replace("to: leader", "to: other") }),
    notice({ content: notice().content.replace("receipt-1", "unknown") }),
  ])("requires the exact automatic delivery, not a human or mismatched notice", invalid => {
    expect(consumedAgentMessages([invalid, reply()], [message]).size).toBe(0);
  });

  it("does not infer consumption across a human message or compacted history", () => {
    for (const boundary of [notice({ auto: false }), reply({ compacted: true })]) {
      expect(consumedAgentMessages([notice(), boundary, reply()], [message]).size).toBe(0);
    }
  });

  it("can consume multiple notices in one successful phase", () => {
    const other = { ...message, id: "receipt-2" };
    const second = notice({ content: notice().content.replace("receipt-1", "receipt-2") });
    expect([...consumedAgentMessages([notice(), second, reply()], [message, other]).keys()]).toEqual(["receipt-1", "receipt-2"]);
  });

  it("requires the complete legacy body rather than a matching prefix", () => {
    const content = `[MENSAJE DE ${message.fromAgentName} (agente ${message.fromAgentId})]\n${message.text}`;
    expect(consumedAgentMessages([notice({ content }), reply()], [message]).size).toBe(1);
    expect(consumedAgentMessages([notice({ content: content + " Otra tarea." }), reply()], [message]).size).toBe(0);
  });

  it("persists a receipt using the same target and the actual phase timestamp", async () => {
    await reconcileAgentMessageReceipts(executor, "leader-chat");
    expect(conversationsRepository.allMessages).toHaveBeenCalledWith(executor, "leader-chat");
    expect(agentQueueRepository.listFor).toHaveBeenCalledWith(executor, "leader-chat");
    expect(agentMessagesRepository.update).toHaveBeenCalledExactlyOnceWith(executor, "receipt-1", { status: "read", readAt: at(2) });
  });

  it.each([
    { agentMessageId: "receipt-1", userText: "compact notification" },
    { userText: `Legacy delivery: ${message.text}` },
  ])("leaves a still-queued message unread", async queued => {
    vi.mocked(agentQueueRepository.listFor).mockResolvedValue([queued] as never);
    await reconcileAgentMessageReceipts(executor, "leader-chat");
    expect(agentMessagesRepository.update).not.toHaveBeenCalled();
  });

  it("does not interpret a queue read failure as an empty queue", async () => {
    vi.mocked(agentQueueRepository.listFor).mockRejectedValue(new Error("target did not respond"));
    await expect(reconcileAgentMessageReceipts(executor, "leader-chat")).rejects.toThrow("target did not respond");
    expect(agentMessagesRepository.update).not.toHaveBeenCalled();
  });

  it("never acknowledges a queued-only, failed or already-read message", async () => {
    vi.mocked(agentMessagesRepository.listByDeliveryConversation).mockResolvedValue(
      (["pending", "failed", "read"] as const).map(status => ({ ...message, status })),
    );
    await reconcileAgentMessageReceipts(executor, "leader-chat");
    expect(conversationsRepository.allMessages).not.toHaveBeenCalled();
    expect(agentMessagesRepository.update).not.toHaveBeenCalled();
  });
});
