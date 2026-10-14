// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AgentMessage } from "../models/agent-message.types.js";
import type { SessionUser } from "../../../shared/types/index.js";

// In-memory message store: the repository is the only persistence the service
// touches, so we drive it directly (no sidecar / SSH).
const messages = vi.hoisted(() => [] as AgentMessage[]);
let seq = 0;
vi.mock("../repositories/agent-messages.repository.js", () => ({
  agentMessagesRepository: {
    create: vi.fn(async (_e: unknown, item: Omit<AgentMessage, "id" | "createdAt">) => {
      const doc: AgentMessage = { ...item, id: `msg-${++seq}`, createdAt: new Date(Date.now() + seq).toISOString() };
      messages.push(doc);
      return doc;
    }),
    listForPair: vi.fn(async (_e: unknown, from: string, to: string) =>
      messages.filter((m) => m.fromAgentId === from && m.toAgentId === to),
    ),
    listByDeliveryConversation: vi.fn(async () => [] as AgentMessage[]),
    update: vi.fn(async () => null),
    get: vi.fn(async (_e: unknown, id: string) => messages.find((m) => m.id === id) ?? null),
  },
}));

const agents = vi.hoisted(() => [] as AssistantAgent[]);
vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    list: vi.fn(async () => agents),
    get: vi.fn(async (id: string) => agents.find((a) => a.id === id) ?? null),
  },
}));

vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: { getMeta: vi.fn(async () => null) },
}));

import { eventBus, Events } from "../../../shared/events/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import { agentMessagesService, buildSendMessageTool } from "./agent-messages.service.js";
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";

function mkAgent(over: Partial<AssistantAgent> & { id: string; name: string }): AssistantAgent {
  return {
    description: "",
    systemPrompt: "",
    providerId: "claude",
    model: "",
    allowedTools: null,
    ...over,
  } as AssistantAgent;
}

// Santiago ↔ Mateo are CONNECTED peers; Lucía reports to Santiago; Martín is
// Santiago's leader (parent); Ajeno is unrelated to everyone.
const santiago = mkAgent({ id: "a-santiago", name: "Santiago", connections: ["a-mateo"], parentAgentId: "a-martin" });
const mateo = mkAgent({ id: "a-mateo", name: "Mateo" });
const lucia = mkAgent({ id: "a-lucia", name: "Lucía", parentAgentId: "a-santiago" });
const martin = mkAgent({ id: "a-martin", name: "Martín" });
const ajeno = mkAgent({ id: "a-ajeno", name: "Ajeno" });

const user: SessionUser = {
  userId: 7,
  username: "jose",
  displayName: "Jose",
  role: "admin",
  modules: ["assistant"],
  kind: "admin",
};

beforeEach(() => {
  messages.length = 0;
  agents.length = 0;
  agents.push(santiago, mateo, lucia, martin, ajeno);
  seq = 0;
  vi.mocked(agentMessagesRepository.update).mockClear();
});

afterEach(() => {
  eventBus.removeAllListeners(Events.AI_AGENT_MESSAGE);
});

describe("agentMessagesService.send", () => {
  const baseInput = {
    fromAgent: santiago,
    toAgentId: "a-mateo",
    text: "necesito que expongas GET /api/x",
    depth: 0,
    user,
    userId: "7",
    senderConversationId: "conv-santiago",
  };

  it("persists a pending message with hops = depth + 1 and the SENDER's user snapshot, and emits AI_AGENT_MESSAGE", async () => {
    const seen: Array<Record<string, unknown>> = [];
    eventBus.on(Events.AI_AGENT_MESSAGE, (p: Record<string, unknown>) => seen.push(p));

    const { message, deduped } = await agentMessagesService.send(localExecutor, { ...baseInput, depth: 1 });

    expect(deduped).toBe(false);
    expect(message.status).toBe("pending");
    expect(message.hops).toBe(2);
    expect(message.toAgentName).toBe("Mateo");
    expect(message.user).toEqual(user);
    expect(message.userId).toBe("7");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      messageId: message.id,
      fromAgentId: "a-santiago",
      toAgentId: "a-mateo",
      userId: "7",
      user,
    });
    expect(seen[0]!["executor"]).toBe(localExecutor);
  });

  it("accepts a subordinate, a connection and the PARENT as recipients", async () => {
    for (const to of ["a-lucia", "a-mateo", "a-martin"]) {
      const { message } = await agentMessagesService.send(localExecutor, { ...baseInput, toAgentId: to, text: `hola ${to}` });
      expect(message.toAgentId).toBe(to);
    }
  });

  it("rejects a target that is NOT related to the sender", async () => {
    await expect(
      agentMessagesService.send(localExecutor, { ...baseInput, toAgentId: "a-ajeno" }),
    ).rejects.toThrow(/no está relacionado/i);
    expect(messages).toHaveLength(0);
  });

  it("rejects a self-message", async () => {
    await expect(
      agentMessagesService.send(localExecutor, { ...baseInput, toAgentId: "a-santiago" }),
    ).rejects.toThrow(/a sí mismo/i);
  });

  it("rejects when the delegation depth cap (3) is reached", async () => {
    await expect(agentMessagesService.send(localExecutor, { ...baseInput, depth: 3 })).rejects.toThrow(
      /profundidad/i,
    );
    expect(messages).toHaveLength(0);
  });

  it("dedupes an identical PENDING message of the same pair (returns the existing id, no new record)", async () => {
    const first = await agentMessagesService.send(localExecutor, baseInput);
    const second = await agentMessagesService.send(localExecutor, baseInput);
    expect(second.deduped).toBe(true);
    expect(second.message.id).toBe(first.message.id);
    expect(messages).toHaveLength(1);
  });

  it("caps the mailbox at 5 unread messages per from→to pair", async () => {
    for (let i = 0; i < 5; i++) {
      await agentMessagesService.send(localExecutor, { ...baseInput, text: `requerimiento ${i}` });
    }
    await expect(
      agentMessagesService.send(localExecutor, { ...baseInput, text: "uno más" }),
    ).rejects.toThrow(/buzón de "Mateo" está lleno/i);
    // A message already READ frees a slot (the cap counts pending + delivered).
    messages[0]!.status = "read";
    const extra = await agentMessagesService.send(localExecutor, { ...baseInput, text: "uno más" });
    expect(extra.message.status).toBe("pending");
  });

  it("clamps the text to 8000 chars", async () => {
    const { message } = await agentMessagesService.send(localExecutor, { ...baseInput, text: "x".repeat(9000) });
    expect(message.text.length).toBeLessThanOrEqual(8000);
    expect(message.text).toMatch(/recortado/);
  });
});

describe("buildSendMessageTool", () => {
  const ctx = {
    agent: santiago,
    allAgents: [santiago, mateo, lucia, martin, ajeno],
    executor: localExecutor,
    user,
    userId: "7",
    depth: 0,
    conversationId: "conv-santiago",
  };

  it("returns null for an agent with no related agents", () => {
    expect(
      buildSendMessageTool({ ...ctx, agent: ajeno, allAgents: [ajeno] }),
    ).toBeNull();
  });

  it("lists subordinate + connection + parent as targets", () => {
    const built = buildSendMessageTool(ctx)!;
    expect(built.tool.name).toBe("agents.send_message");
    expect(built.targets.map((a) => a.id).sort()).toEqual(["a-lucia", "a-martin", "a-mateo"]);
  });

  it("refuses an unrelated recipient without touching the store", async () => {
    const built = buildSendMessageTool(ctx)!;
    const res = await built.tool.handler({ agentId: "a-ajeno", text: "hola" });
    expect(res.ok).toBe(false);
    expect(messages).toHaveLength(0);
  });

  it("caps at 3 sends per run (deduped resends don't consume the budget)", async () => {
    const built = buildSendMessageTool(ctx)!;
    for (const text of ["t1", "t2", "t3"]) {
      const res = await built.tool.handler({ agentId: "a-mateo", text });
      expect(res.ok).toBe(true);
    }
    const blocked = await built.tool.handler({ agentId: "a-mateo", text: "t4" });
    expect(blocked.ok).toBe(false);
    expect(String((blocked.output as { hint?: string }) ?? blocked.output)).toMatch(/3 mensajes/);
    expect(messages).toHaveLength(3);
  });
});
