import { encodeCoordination, decodeCoordination, coordinationEnvelope } from "../models/agent-envelope.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AgentMessage } from "../models/agent-message.types.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { ConversationMessage } from "../repositories/conversations.repository.js";
import type { TeamTask } from "../models/team-task.types.js";

// These unit calls run on the explicitly selected test target.
vi.mock("../../../shared/executor/index.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, getContextExecutor: () => actual.localExecutor };
});

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
    listByDeliveryConversation: vi.fn(async (_e: unknown, id: string) => messages.filter(m => m.deliveryConversationId === id)),
    update: vi.fn(async (_e: unknown, id: string, patch: Partial<AgentMessage>) => {
      const message = messages.find(m => m.id === id);
      return message ? Object.assign(message, patch) : null;
    }),
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
  conversationsRepository: { getMeta: vi.fn(async () => null), allMessages: vi.fn(async () => [] as ConversationMessage[]) },
}));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: { listFor: vi.fn(async () => []) } }));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: { getTask: vi.fn(async () => null as TeamTask | null) } }));

import { eventBus, Events } from "../../../shared/events/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import { agentMessagesService, buildSendMessageTool } from "./agent-messages.service.js";
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";

function consumedHistory(items: AgentMessage[]): ConversationMessage[] {
  const ts = new Date(Date.now() + 60_000).toISOString();
  return items.flatMap(message => [{
    role: "user" as const, auto: true, ts,
    content: encodeCoordination(coordinationEnvelope(message.text, "result", { from: message.fromAgentId, to: message.toAgentId }, { messageId: message.id })),
  }, { role: "assistant" as const, ts, content: "Esperando al equipo.", pending: true }]);
}

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
  vi.mocked(conversationsRepository.allMessages).mockReset().mockResolvedValue([]);
  vi.mocked(agentQueueRepository.listFor).mockReset().mockResolvedValue([]);
  vi.mocked(teamTasksRepository.getTask).mockReset().mockResolvedValue(null);
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

  it("does not resend an identical message already delivered but still unread", async () => {
    const first = await agentMessagesService.send(localExecutor, baseInput);
    first.message.status = "delivered";
    const second = await agentMessagesService.send(localExecutor, baseInput);
    expect(second).toMatchObject({ deduped: true, message: { id: first.message.id } });
    expect(messages).toHaveLength(1);
  });

  it("recovers five consumed phase notices before rejecting a new handoff", async () => {
    for (let i = 0; i < 5; i++) {
      const { message } = await agentMessagesService.send(localExecutor, { ...baseInput, text: `avance ${i}` });
      Object.assign(message, { status: "delivered", deliveryConversationId: "conv-mateo" });
    }
    vi.mocked(conversationsRepository.allMessages).mockResolvedValue(consumedHistory(messages));
    const next = await agentMessagesService.send(localExecutor, { ...baseInput, text: "listo para QA" });
    expect(next.message.status).toBe("pending");
    expect(messages.filter(m => m.status === "read")).toHaveLength(5);
    expect(messages).toHaveLength(6);
  });

  it("keeps the full-mailbox guard when the recipient history cannot be verified", async () => {
    for (let i = 0; i < 5; i++) {
      const { message } = await agentMessagesService.send(localExecutor, { ...baseInput, text: `avance ${i}` });
      Object.assign(message, { status: "delivered", deliveryConversationId: "conv-mateo" });
    }
    vi.mocked(conversationsRepository.allMessages).mockRejectedValue(new Error("target timeout"));
    await expect(agentMessagesService.send(localExecutor, { ...baseInput, text: "otro aviso" })).rejects.toThrow(/buzón.*lleno/);
    expect(messages.every(m => m.status === "delivered")).toBe(true);
  });

  it("rejects oversized legacy text without persisting or silently losing constraints", async () => {
    await expect(agentMessagesService.send(localExecutor, { ...baseInput, text: "x".repeat(9000) + "No reiniciar." })).rejects.toThrow(/2000/);
    expect(messages).toHaveLength(0);
  });

  it("acknowledges an attended phase on AI_TURN_SETTLED while the team is still pending", async () => {
    const { message } = await agentMessagesService.send(localExecutor, baseInput);
    Object.assign(message, { status: "delivered", deliveryConversationId: "conv-mateo" });
    vi.mocked(conversationsRepository.allMessages).mockResolvedValue(consumedHistory([message]));
    agentMessagesService.init();
    eventBus.emit(Events.AI_TURN_SETTLED, { conversationId: "conv-mateo", executor: localExecutor });
    await vi.waitFor(() => expect(message.status).toBe("read"));
    expect(agentMessagesRepository.update).toHaveBeenCalledOnce();
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

  it("accepts compact TOON, retains evidence and rejects oversized or mixed payloads", async () => {
    const built = buildSendMessageTool(ctx)!;
    const message = { kind: "blocked", summary: "Falta revisión.", data: { deploy: false, checks: ["HTTP 503"] } };
    expect((await built.tool.handler({ agentId: "a-mateo", message: encodeCoordination(message) })).ok).toBe(true);
    expect(decodeCoordination(messages[0]!.text)).toEqual(message);
    expect((await built.tool.handler({ agentId: "a-mateo", message, text: "otra instrucción" })).ok).toBe(false);
    expect((await built.tool.handler({ agentId: "a-mateo", message: { ...message, data: { text: "x".repeat(5000) } } })).ok).toBe(false);
    expect(messages).toHaveLength(1);
  });

  it("reads complete referenced evidence only for the same user, project and participating agent", async () => {
    const built = buildSendMessageTool({ ...ctx, userId: undefined })!;
    await built.tool.handler({ agentId: "a-mateo", text: "Detalle completo. No reiniciar." });
    const stored = messages[0]!;
    // Historical principals may be stored as strings while sessions use numbers.
    stored.userId = "7";
    expect(await built.readTool.handler({ messageId: stored.id })).toMatchObject({ ok: true, output: { text: stored.text } });
    stored.userId = "8";
    expect((await built.readTool.handler({ messageId: stored.id })).ok).toBe(false);
    stored.userId = "7";
    stored.projectId = "different-project";
    expect((await built.readTool.handler({ messageId: stored.id })).ok).toBe(false);
    stored.projectId = null;
    stored.fromAgentId = "a-ajeno";
    expect((await built.readTool.handler({ messageId: stored.id })).ok).toBe(false);
    expect((await built.readTool.handler({ messageId: "unknown" })).ok).toBe(false);
  });
  it("reads full verification evidence only in the task participant's conversation and scope", async () => {
    const built = buildSendMessageTool(ctx)!;
    const task = { id: "task", workerAgentId: "a-santiago", workerConversationId: "conv-santiago", leaderAgentId: "a-martin",
      leaderConversationId: "leader", projectId: null, userId: "7", task: "No reiniciar.",
      verify: { state: "failed", attempts: 1, logTail: "evidence ".repeat(500) },
    } as TeamTask;
    vi.mocked(teamTasksRepository.getTask).mockResolvedValue(task);
    expect(await built.readTool.handler({ taskId: "task" })).toMatchObject({ ok: true, output: { task: "No reiniciar.", verify: task.verify } });
    expect(vi.mocked(teamTasksRepository.getTask).mock.calls.at(-1)![0]).toBe(localExecutor);
    for (const patch of [{ userId: "8" }, { projectId: "other" }, { workerAgentId: "other" }, { workerConversationId: "other" }]) {
      vi.mocked(teamTasksRepository.getTask).mockResolvedValue({ ...task, ...patch });
      expect((await built.readTool.handler({ taskId: "task" })).ok).toBe(false);
    }
    expect((await built.readTool.handler({ messageId: "msg", taskId: "task" })).ok).toBe(false);
  });
});
