import { decodeCoordination } from "../models/agent-envelope.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Delivery of an async agent↔agent message (AI_AGENT_MESSAGE listener).
 *
 * The listener is the piece that makes the channel work when the recipient is
 * POWERED OFF: it resolves/creates the recipient's mailbox chat, enqueues an
 * automatic turn with the SENDER's user snapshot and DRAINS it — the drain
 * starts a run (= the wake-up). Everything below the listener (registry, agent
 * run, conversations) is mocked: we assert the contract, not the pipeline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { QueuedTurn } from "../repositories/agent-queue.repository.js";
import type { AgentMessage } from "../models/agent-message.types.js";
import type { SessionUser } from "../../../shared/types/index.js";

/** Ordered log of the side effects we care about (delivered BEFORE the drain). */
const calls = vi.hoisted(() => [] as string[]);

const messageStore = vi.hoisted(() => ({ current: null as AgentMessage | null }));
const pairStore = vi.hoisted(() => ({ items: [] as AgentMessage[] }));
vi.mock("../repositories/agent-messages.repository.js", () => ({
  agentMessagesRepository: {
    get: vi.fn(async () => messageStore.current),
    listForPair: vi.fn(async () => pairStore.items),
    update: vi.fn(async (_e: unknown, _id: string, patch: Partial<AgentMessage>) => {
      calls.push(`update:${patch.status ?? "patch"}`);
      messageStore.current = { ...(messageStore.current as AgentMessage), ...patch };
      return messageStore.current;
    }),
  },
}));

const recipient = vi.hoisted(() => ({
  current: { id: "a-mateo", name: "Mateo", providerId: "claude" } as Record<string, unknown> | null,
}));
vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: { get: vi.fn(async () => recipient.current) },
}));

const queue = vi.hoisted(() => ({ items: [] as QueuedTurn[] }));
vi.mock("../repositories/agent-queue.repository.js", () => ({
  agentQueueRepository: {
    enqueue: vi.fn(async (_e: unknown, item: Omit<QueuedTurn, "id" | "ts">) => {
      calls.push("enqueue");
      const doc = { ...item, id: `q-${queue.items.length + 1}`, ts: new Date().toISOString() } as QueuedTurn;
      queue.items.push(doc);
      return doc;
    }),
    listFor: vi.fn(async (_e: unknown, id: string) => queue.items.filter(item => item.conversationId === id)),
    takeNext: vi.fn(async () => {
      calls.push("drain:takeNext");
      return queue.items.shift() ?? null;
    }),
  },
}));

const meta = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  byId: {} as Record<string, Record<string, unknown> | null>,
}));
vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: {
    getMeta: vi.fn(async (_e: unknown, id: string) => (id in meta.byId ? meta.byId[id] : meta.current)),
    create: vi.fn(async (_e: unknown, provider: string, firstMessage: string, projectId: string | null, agentId: string | null) => {
      calls.push("createConversation");
      const created = { id: "conv-nuevo", title: firstMessage, provider, projectId, agentId, messageCount: 0 };
      meta.byId["conv-nuevo"] = created;
      return created;
    }),
    appendMessages: vi.fn(async () => {
      calls.push("appendMessages");
      return undefined;
    }),
    messages: vi.fn(async () => ({ items: [{ role: "user", content: "hola" }], total: 1 })),
    patchRuntime: vi.fn(async () => undefined),
    getEmbeddedMeta: vi.fn(async () => null),
    setTranslation: vi.fn(async () => undefined),
  },
}));

const runOptions = vi.hoisted(() => ({ last: null as Record<string, unknown> | null, targetId: null as string | null }));
vi.mock("./agent.service.js", () => ({
  agentService: {
    // eslint-disable-next-line require-yield
    run: vi.fn(async function* (_msgs: unknown, options: Record<string, unknown>) {
      runOptions.last = options;
      runOptions.targetId = getContextExecutor()?.target.id ?? null;
      return;
    }),
  },
}));

const registryState = vi.hoisted(() => ({ active: new Set<string>(), runs: [] as Array<{ key: string; cli: boolean; targetId: string }> }));
vi.mock("./agent-run-registry.js", () => ({
  agentRunRegistry: {
    isActive: vi.fn((key: string) => registryState.active.has(key)),
    deferQueueDrain: vi.fn((key: string) => registryState.active.has(key)),
    activeRuns: vi.fn(() => registryState.runs),
    start: vi.fn((args: { makeGen: () => AsyncGenerator<unknown> }) => {
      calls.push("run:start");
      // Materialize the generator so the run options (delegationDepth…) are
      // captured — the registry would do this immediately in production.
      void args.makeGen().next();
    }),
  },
}));

vi.mock("../repositories/attachments.repository.js", () => ({
  attachmentsRepository: { storeMany: vi.fn(async () => []) },
}));
vi.mock("../repositories/cli-jobs.repository.js", () => ({
  cliJobsRepository: { delete: vi.fn(async () => undefined) },
}));
const teamState = vi.hoisted(() => ({
  byWorkerConv: null as Record<string, unknown> | null,
  forLeaderConv: [] as Array<Record<string, unknown>>,
}));
vi.mock("../repositories/team-tasks.repository.js", () => ({
  teamTasksRepository: {
    getTask: vi.fn(async () => teamState.byWorkerConv),
    listForLeaderConversation: vi.fn(async () => teamState.forLeaderConv),
    findByWorkerConversation: vi.fn(async () => teamState.byWorkerConv),
    updateTask: vi.fn(async (_e: unknown, _id: string, patch: unknown) => { calls.push("team:acknowledge"); return patch; }),
  },
}));
const steerState = vi.hoisted(() => ({ result: false }));
vi.mock("./cli-job-tracker.service.js", () => ({
  cliJobTracker: {
    steerConversation: vi.fn(async () => {
      calls.push("steer");
      return steerState.result;
    }),
  },
}));
vi.mock("./team-tasks.service.js", () => ({
  teamTasksService: { markCollected: vi.fn(async () => undefined) },
}));
vi.mock("../repositories/assistant-config.repository.js", () => ({
  assistantConfigRepository: { load: vi.fn(async () => ({ translation: { enabled: false }, approval: { mode: "manual" } })) },
}));
vi.mock("./translation.service.js", () => ({
  translationService: { translate: vi.fn(async (_c: unknown, t: string) => t), detectLanguage: vi.fn(async () => "en") },
}));
vi.mock("./slash-commands.service.js", () => ({
  slashCommandsService: { isSlash: vi.fn(() => false) },
}));

vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: { list: async () => ["p1", "proj-1"].map(id => ({ id, ownerId: 7, title: id, path: "/" + id })) },
}));
vi.mock("../repositories/agent-roles.repository.js", () => ({ agentRolesRepository: { get: async () => null } }));

import { eventBus, Events } from "../../../shared/events/index.js";
import { getContextExecutor, localExecutor, runWithExecutor } from "../../../shared/executor/index.js";
import { drainConversationQueue, initAgentMessageListener, initTeamNudgeListener, initTeamVerifyRetryListener } from "./turn-queue.service.js";
import { teamTasksService } from "./team-tasks.service.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";

const sender: SessionUser = {
  userId: 7,
  username: "jose",
  displayName: "Jose",
  role: "admin",
  modules: ["assistant"],
  kind: "admin",
};

function mkMessage(over: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: "msg-1",
    fromAgentId: "a-santiago",
    fromAgentName: "Santiago",
    toAgentId: "a-mateo",
    toAgentName: "Mateo",
    text: "necesito que expongas GET /api/x",
    status: "pending",
    hops: 1,
    senderConversationId: "conv-santiago",
    deliveryConversationId: null,
    userId: "7",
    user: sender,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function emit(): void {
  eventBus.emit(Events.AI_AGENT_MESSAGE, {
    executor: localExecutor,
    messageId: messageStore.current?.id,
    fromAgentId: messageStore.current?.fromAgentId,
    toAgentId: messageStore.current?.toAgentId,
    userId: "7",
    user: sender,
  });
}

/** The listener runs detached (void async) — let its microtasks settle. */
async function settle(): Promise<void> {
  await vi.waitFor(() => expect(calls).toContain("run:start"), { timeout: 1000 });
}

initAgentMessageListener();
initTeamNudgeListener();
initTeamVerifyRetryListener();

it("delivers verification retries as compact TOON pointing to complete scoped evidence", async () => {
  registryState.active.add("verify-worker");
  const logTail = "diagnóstico ".repeat(500);
  teamState.byWorkerConv = { id: "verify-task", status: "running", workerConversationId: "verify-worker",
    leaderConversationId: "leader", verify: { state: "failed", attempts: 1, logTail } };
  await runWithExecutor(localExecutor, async () => {
    eventBus.emit(Events.AI_TEAM_TASK_VERIFY_RETRY, { executor: localExecutor, taskId: "verify-task", workerConversationId: "verify-worker",
      workerAgentId: "a-mateo", user: sender, userId: "7", logTail, failedCommand: "pnpm test", exitCode: 1, attempt: 1, maxAttempts: 2 });
  }, 7, sender);
  await vi.waitFor(() => expect(queue.items).toHaveLength(1));
  const wire = queue.items[0]!.userText;
  expect(wire.length).toBeLessThanOrEqual(2000);
  expect(decodeCoordination(wire)).toMatchObject({ kind: "request", detail: { taskId: "verify-task", tool: "agents.read_message", required: true } });
  expect(teamState.byWorkerConv.verify).toMatchObject({ logTail });
  expect(wire).not.toContain("haz commit");
});

describe("durable team result delivery", () => {
  function setup() {
    meta.current = { id: "leader", provider: "claude", agentId: "a-mateo", projectId: null };
    registryState.active.add("leader"); // persist the follow-up; do not run it yet
    teamState.forLeaderConv = [{ id: "task-1", title: "Ajuste", workerAgentName: "Worker", status: "done", resultSummary: "Verificado" }];
    const onSettled = vi.fn();
    const payload = { executor: localExecutor, leaderConversationId: "leader", leaderAgentId: "a-mateo", user: sender, userId: "7", taskIds: ["task-1"], onSettled };
    return { onSettled, emit: () => eventBus.emit(Events.AI_TEAM_LEADER_NUDGE, payload) };
  }
  it("acknowledges tasks only after their result turn is durably queued", async () => {
    const delivery = setup();
    delivery.emit();
    await vi.waitFor(() => expect(delivery.onSettled).toHaveBeenCalledOnce());
    expect(calls.indexOf("enqueue")).toBeLessThan(calls.indexOf("team:acknowledge"));
    expect(queue.items[0]).toMatchObject({ auto: true, teamTaskIds: ["task-1"], user: sender });
    expect(teamTasksService.markCollected).toHaveBeenCalledWith(localExecutor, ["task-1"]);
    expect(queue.items[0]?.userText).toContain("Verificado");
  });
  it("leaves tasks recoverable on enqueue failure and can deliver on the next reconciliation", async () => {
    const delivery = setup();
    vi.mocked(agentQueueRepository.enqueue).mockRejectedValueOnce(new Error("storage unavailable"));
    delivery.emit();
    await vi.waitFor(() => expect(delivery.onSettled).toHaveBeenCalledTimes(1));
    expect(teamTasksRepository.updateTask).not.toHaveBeenCalled();
    expect(teamTasksService.markCollected).not.toHaveBeenCalled();
    delivery.emit();
    await vi.waitFor(() => expect(delivery.onSettled).toHaveBeenCalledTimes(2));
    expect(queue.items).toHaveLength(1);
    expect(teamTasksService.markCollected).toHaveBeenCalledOnce();
  });
  it("reuses a queued delivery left by a restart instead of duplicating it", async () => {
    const delivery = setup();
    queue.items.push({ id: "saved", conversationId: "leader", withContext: true, userText: "Resultados", ts: "2026-10-17", teamTaskIds: ["task-1"], auto: true });
    delivery.emit();
    await vi.waitFor(() => expect(delivery.onSettled).toHaveBeenCalledOnce());
    expect(agentQueueRepository.enqueue).not.toHaveBeenCalled();
    expect(queue.items).toHaveLength(1);
    expect(teamTasksService.markCollected).toHaveBeenCalledWith(localExecutor, ["task-1"]);
  });
  it("does not restart the leader after a human stop", async () => {
    setup();
    registryState.active.delete("leader");
    queue.items.push({ id: "saved", conversationId: "leader", withContext: true, userText: "Resultados", ts: "2026-10-17", teamTaskIds: ["task-1"], auto: true });
    vi.mocked(conversationsRepository.messages).mockResolvedValueOnce({ items: [{ role: "assistant", content: "", interrupted: true, ts: "2026-10-17" }], total: 1 } as never);
    await drainConversationQueue(localExecutor, "leader");
    expect(calls).not.toContain("drain:takeNext");
    expect(calls).not.toContain("run:start");
    expect(queue.items).toHaveLength(1);
  });
});

beforeEach(() => {
  calls.length = 0;
  queue.items.length = 0;
  pairStore.items = [];
  meta.current = null;
  meta.byId = {};
  registryState.active.clear();
  registryState.runs = [];
  teamState.byWorkerConv = null;
  teamState.forLeaderConv = [];
  steerState.result = false;
  runOptions.last = null; runOptions.targetId = null;
  recipient.current = { id: "a-mateo", name: "Mateo", providerId: "claude" };
  messageStore.current = mkMessage();
  vi.mocked(conversationsRepository.create).mockClear();
  vi.mocked(agentQueueRepository.enqueue).mockClear();
  vi.mocked(agentMessagesRepository.update).mockClear();
  vi.mocked(teamTasksRepository.updateTask).mockClear();
  vi.mocked(teamTasksService.markCollected).mockClear();
});

afterEach(() => {
  vi.clearAllTimers();
});

describe("initAgentMessageListener", () => {
  it("creates a mailbox chat bound to the RECIPIENT agent when the pair has none", async () => {
    emit();
    await settle();

    expect(conversationsRepository.create).toHaveBeenCalledOnce();
    const args = vi.mocked(conversationsRepository.create).mock.calls[0]!;
    expect(args[1]).toBe("claude"); // recipient's own provider
    expect(String(args[2])).toMatch(/^Handoff de Santiago:/);
    expect(args[3]).toBeNull(); // loose (no project)
    expect(args[4]).toBe("a-mateo"); // bound to the recipient agent
  });

  it("REUSES the pair's existing mailbox when its conversation still exists", async () => {
    pairStore.items = [mkMessage({ id: "msg-0", status: "read", deliveryConversationId: "conv-buzon" })];
    meta.current = { id: "conv-buzon", provider: "claude", agentId: "a-mateo", projectId: "proj-1" };
    recipient.current!.projectIds = ["proj-1"];

    emit();
    await settle();

    expect(conversationsRepository.create).not.toHaveBeenCalled();
    const turn = vi.mocked(agentQueueRepository.enqueue).mock.calls[0]![1];
    expect(turn.conversationId).toBe("conv-buzon");
    expect(turn.projectId).toBe("proj-1"); // inherited from the mailbox
  });

  it("creates a NEW mailbox when the pair's previous chat was deleted (meta gone)", async () => {
    pairStore.items = [mkMessage({ id: "msg-0", status: "read", deliveryConversationId: "conv-borrada" })];
    meta.current = null; // getMeta → null: the user deleted that chat

    emit();
    await settle();

    expect(conversationsRepository.create).toHaveBeenCalledOnce();
    const turn = vi.mocked(agentQueueRepository.enqueue).mock.calls[0]![1];
    expect(turn.conversationId).toBe("conv-nuevo");
  });

  it("enqueues an AUTO turn with the sender's user snapshot and delegationDepth = hops", async () => {
    messageStore.current = mkMessage({ hops: 2 });
    emit();
    await settle();

    const turn = vi.mocked(agentQueueRepository.enqueue).mock.calls[0]![1];
    expect(turn.auto).toBe(true);
    expect(turn.agentId).toBe("a-mateo");
    expect(turn.withContext).toBe(true);
    expect(turn.delegationDepth).toBe(2);
    expect(turn.user).toEqual(sender); // SENDER's gating — no escalation
    expect(turn.userId).toBe("7");
    expect(decodeCoordination(turn.userText)).toMatchObject({ protocol: "lxp.agent.v1", from: "a-santiago", fromName: "Santiago", detail: { messageId: "msg-1", required: false } });
    expect(turn.agentMessageId).toBe("msg-1");
    expect(turn.userText).toContain("necesito que expongas GET /api/x");
    expect(turn.userText).toContain("agents.send_message");
  });

  it("propagates delegationDepth from the queued turn into the agent run (bounded chain)", async () => {
    messageStore.current = mkMessage({ hops: 3 });
    emit();
    await settle();

    expect(runOptions.last).toMatchObject({ delegationDepth: 3, agentId: "a-mateo" });
  });

  it("marks the message DELIVERED (with its mailbox) BEFORE draining the queue", async () => {
    emit();
    await settle();

    const patch = vi.mocked(agentMessagesRepository.update).mock.calls[0]![2];
    expect(patch.status).toBe("delivered");
    expect(patch.deliveryConversationId).toBe("conv-nuevo");
    expect(patch.deliveredAt).toBeTruthy();
    // Order matters: the drain can run the whole turn inline and close the
    // message as `read` — a later `delivered` write would clobber that.
    expect(calls.indexOf("update:delivered")).toBeLessThan(calls.indexOf("drain:takeNext"));
  });

  it("is idempotent: a message already delivered is not re-delivered", async () => {
    messageStore.current = mkMessage({ status: "delivered", deliveryConversationId: "conv-buzon" });
    emit();
    await new Promise((r) => setTimeout(r, 20));

    expect(agentQueueRepository.enqueue).not.toHaveBeenCalled();
    expect(conversationsRepository.create).not.toHaveBeenCalled();
  });

  it("fails the message (no delivery) when the recipient agent no longer exists", async () => {
    recipient.current = null;
    emit();
    await vi.waitFor(() => expect(calls).toContain("update:failed"), { timeout: 1000 });

    expect(agentQueueRepository.enqueue).not.toHaveBeenCalled();
    const patch = vi.mocked(agentMessagesRepository.update).mock.calls[0]![2];
    expect(patch.status).toBe("failed");
    expect(patch.error).toMatch(/ya no existe/);
  });
});

describe("initAgentMessageListener — destino: chat de equipo / run activo (sin chats nuevos)", () => {
  it("worker → líder: entrega en la conversación del LÍDER (leaderConversationId) sin crear chat", async () => {
    teamState.byWorkerConv = { leaderAgentId: "a-mateo", leaderConversationId: "conv-lider", workerAgentId: "a-santiago", workerConversationId: "conv-santiago", status: "running" };
    meta.byId["conv-lider"] = { agentId: "a-mateo", provider: "claude", projectId: "p1" };
    meta.byId["conv-santiago"] = { agentId: "a-santiago", projectId: "p1" };
    recipient.current!.projectIds = ["p1"];
    emit();
    await settle();
    expect(conversationsRepository.create).not.toHaveBeenCalled();
    const q = vi.mocked(agentQueueRepository.enqueue).mock.calls[0]?.[1];
    expect(q?.conversationId).toBe("conv-lider");
    expect(q?.projectId).toBe("p1");
    expect(decodeCoordination(q!.userText)).toMatchObject({ team: true, replyTool: "agents.send_message" });
    expect(messageStore.current?.deliveryConversationId).toBe("conv-lider");
  });

  it("líder → worker: entrega en el chat de la tarea abierta más reciente del worker", async () => {
    messageStore.current = mkMessage({ fromAgentId: "a-lider", fromAgentName: "Lider", senderConversationId: "conv-lider" });
    teamState.forLeaderConv = [
      { workerAgentId: "a-mateo", workerConversationId: "conv-w-old", status: "done", createdAt: "2026-01-01T00:00:00Z" },
      { workerAgentId: "a-mateo", workerConversationId: "conv-w-open", status: "running", createdAt: "2026-01-02T00:00:00Z" },
      { workerAgentId: "a-otro", workerConversationId: "conv-x", status: "running", createdAt: "2026-01-03T00:00:00Z" },
    ];
    meta.byId["conv-w-open"] = { agentId: "a-mateo", provider: "claude", projectId: null };
    emit();
    await settle();
    expect(conversationsRepository.create).not.toHaveBeenCalled();
    expect(vi.mocked(agentQueueRepository.enqueue).mock.calls[0]?.[1]?.conversationId).toBe("conv-w-open");
  });

  it("destinatario con run activo + steering OK: inyecta en vivo, persiste auto y NO encola", async () => {
    registryState.runs = [{ key: "conv-run", cli: true, targetId: localExecutor.target.id }];
    registryState.active.add("conv-run");
    meta.byId["conv-run"] = { agentId: "a-mateo", provider: "claude", projectId: null };
    steerState.result = true;
    emit();
    await vi.waitFor(() => expect(calls).toContain("update:delivered"), { timeout: 1000 });
    expect(calls).toContain("steer");
    expect(calls).toContain("appendMessages");
    expect(calls).not.toContain("enqueue");
    expect(calls).not.toContain("createConversation");
    expect(messageStore.current?.deliveryConversationId).toBe("conv-run");
  });

  it("destinatario con run activo sin steering: encola en ESA conversación y no drena (run en curso)", async () => {
    registryState.runs = [{ key: "conv-run", cli: false, targetId: localExecutor.target.id }];
    registryState.active.add("conv-run");
    meta.byId["conv-run"] = { agentId: "a-mateo", provider: "claude", projectId: null };
    steerState.result = false;
    emit();
    await vi.waitFor(() => expect(calls).toContain("update:delivered"), { timeout: 1000 });
    expect(calls).toContain("enqueue");
    expect(calls).not.toContain("run:start");
    expect(conversationsRepository.create).not.toHaveBeenCalled();
    expect(vi.mocked(agentQueueRepository.enqueue).mock.calls[0]?.[1]?.conversationId).toBe("conv-run");
  });

  it("sin relación de equipo ni run activo: buzón del par como antes", async () => {
    emit();
    await settle();
    expect(conversationsRepository.create).toHaveBeenCalledTimes(1);
    expect(decodeCoordination(vi.mocked(agentQueueRepository.enqueue).mock.calls[0]![1].userText)).toMatchObject({ team: false, replyTool: "agents.send_message" });
  });
});

describe("drainConversationQueue — isWorker (cap por usuario)", () => {
  it.each([
    { name: "human request", auto: false, expected: "user" },
    { name: "leader continuation", auto: true, expected: "user" },
    { name: "mailbox reply", auto: true, agentMessageId: "internal-message", expected: "agent" },
    { name: "worker reply", auto: true, isWorker: true, expected: "agent" },
  ])("records the notification audience for $name", async ({ name: _name, expected, ...flags }) => {
    queue.items.push({ id: "audience-turn", conversationId: "audience-chat", user: sender,
      userText: "Continuar", withContext: true, ts: "2026-10-18", ...flags } as QueuedTurn);
    await runWithExecutor(localExecutor, () => drainConversationQueue(localExecutor, "audience-chat"), 7, sender);
    const run = vi.mocked(agentRunRegistry.start).mock.calls.at(-1)?.[0];
    expect(run).toBeDefined();
    await run!.onComplete?.("Resultado", false);
    expect(conversationsRepository.appendMessages).toHaveBeenLastCalledWith(localExecutor, "audience-chat",
      [expect.objectContaining({ role: "assistant", replyAudience: expected })], expect.anything());
  });

  it("propaga isWorker del QueuedTurn hasta agentRunRegistry.start", async () => {
    queue.items.push({
      id: "q-w1",
      conversationId: "conv-worker-drain",
      userText: "tarea diferida del worker",
      withContext: true,
      isWorker: true,
      ts: new Date().toISOString(),
    } as QueuedTurn);
    await runWithExecutor(localExecutor, () => drainConversationQueue(localExecutor, "conv-worker-drain"), 7, sender);
    const startArgs = vi.mocked(agentRunRegistry.start).mock.calls.at(-1)?.[0] as { isWorker?: boolean };
    expect(startArgs.isWorker).toBe(true);
  });

  it("un turno normal drena SIN isWorker", async () => {
    queue.items.push({
      id: "q-u1",
      conversationId: "conv-user-drain",
      userText: "turno de usuario",
      withContext: true,
      ts: new Date().toISOString(),
    } as QueuedTurn);
    await runWithExecutor(localExecutor, () => drainConversationQueue(localExecutor, "conv-user-drain"), 7, sender);
    const startArgs = vi.mocked(agentRunRegistry.start).mock.calls.at(-1)?.[0] as { isWorker?: boolean };
    expect(startArgs.isWorker).toBeUndefined();
  });
});

it("persists a failed or stopped assistant message even without text", async () => {
  const { persistAssistantMessage } = await import("./turn-queue.service.js");
  const { conversationsRepository } = await import("../repositories/conversations.repository.js");
  await persistAssistantMessage(null, "outcome", "", "codex", true, undefined, undefined, undefined, 1, "progress", undefined, { error: "timeout" });
  expect(conversationsRepository.appendMessages).toHaveBeenLastCalledWith(null, "outcome", [expect.objectContaining({ content: "", error: "timeout" })], expect.anything());
  await persistAssistantMessage(null, "outcome", "", "codex", true, undefined, undefined, undefined, 1, undefined, undefined, { interrupted: true });
  expect(conversationsRepository.appendMessages).toHaveBeenLastCalledWith(null, "outcome", [expect.objectContaining({ content: "", interrupted: true })], expect.anything());
});

it("does not acknowledge a user turn whose history write failed", async () => {
  const { persistUserMessage } = await import("./turn-queue.service.js");
  vi.mocked(conversationsRepository.appendMessages).mockRejectedValueOnce(new Error("write failed"));
  await expect(persistUserMessage(null, "chat", "Aprobar plan", "codex", undefined)).rejects.toThrow("write failed");
});

it("persists recorded audio with the user turn and keeps only text in model history", async () => {
  const { persistUserMessage, buildMessagesFromHistory } = await import("./turn-queue.service.js");
  const { attachmentsRepository } = await import("../repositories/attachments.repository.js");
  const recording = { name: "audio.webm", mimeType: "audio/webm", dataBase64: "YXVkaW8=", voice: { transcript: "Hola" } };
  const ref = { id: "voice-clip", name: recording.name, mimeType: recording.mimeType, voice: recording.voice };
  vi.mocked(attachmentsRepository.storeMany).mockResolvedValueOnce([ref]);
  await persistUserMessage(localExecutor, "voice-conv", "Hello", "codex", [recording], { textOriginal: "Hola", lang: "es" });
  expect(attachmentsRepository.storeMany).toHaveBeenCalledWith(localExecutor, "voice-conv", [recording]);
  expect(conversationsRepository.appendMessages).toHaveBeenCalledWith(localExecutor, "voice-conv", [expect.objectContaining({ content: "Hello", textOriginal: "Hola", attachments: [ref] })], {});
  vi.mocked(conversationsRepository.messages).mockResolvedValueOnce({ items: [{ role: "user", content: "Hello", ts: "", attachments: [ref] }], total: 1, hasMore: false });
  expect(await buildMessagesFromHistory(localExecutor, "voice-conv")).toEqual([{ role: "user", content: "Hello" }]);
});

it("does not silently persist a text-only message if saving its recording fails", async () => {
  const { persistUserMessage } = await import("./turn-queue.service.js");
  const { attachmentsRepository } = await import("../repositories/attachments.repository.js");
  vi.mocked(attachmentsRepository.storeMany).mockRejectedValueOnce(new Error("write failed"));
  vi.mocked(conversationsRepository.appendMessages).mockClear();
  await expect(persistUserMessage(localExecutor, "voice-conv", "Hola", "codex", [{ name: "audio.webm", mimeType: "audio/webm", dataBase64: "YXVkaW8=", voice: { transcript: "Hola" } }])).rejects.toThrow("write failed");
  expect(conversationsRepository.appendMessages).not.toHaveBeenCalled();
});

it("revalidates a recovered queued turn before consuming it", async () => {
  recipient.current!.projectIds = ["p1"];
  recipient.current!.assignments = [{ projectId: "p1", status: "removed" }];
  queue.items.push({ id: "blocked", conversationId: "chat", agentId: "a-mateo", projectId: "p1", user: sender, userText: "old work", ts: "" } as QueuedTurn);
  await expect(runWithExecutor(localExecutor, () => drainConversationQueue(localExecutor, "chat"), 7, sender)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_REMOVED" });
  expect(queue.items.map(q => q.id)).toEqual(["blocked"]);
  expect(calls).not.toContain("run:start");
  expect(calls).not.toContain("drain:takeNext");
});
it("does not deliver X into the same pair's mailbox in Y", async () => {
  recipient.current!.projectIds = ["p1", "proj-1"];
  messageStore.current = mkMessage({ projectId: "p1" });
  pairStore.items = [mkMessage({ id: "old", projectId: "proj-1", status: "read", deliveryConversationId: "mailbox-Y" })];
  meta.byId["mailbox-Y"] = { id: "mailbox-Y", agentId: "a-mateo", projectId: "proj-1", provider: "claude" };
  emit(); await settle();
  expect(conversationsRepository.create).toHaveBeenCalledOnce();
  expect(vi.mocked(agentQueueRepository.enqueue).mock.calls[0]?.[1]).toMatchObject({ conversationId: "conv-nuevo", projectId: "p1" });
});

it("serializes concurrent drains and leaves the second turn queued once a run starts", async () => {
  queue.items.push(
    { id: "first", conversationId: "serial-chat", user: sender, userText: "one", ts: "1" } as QueuedTurn,
    { id: "second", conversationId: "serial-chat", user: sender, userText: "two", ts: "2" } as QueuedTurn,
  );
  vi.mocked(agentRunRegistry.start).mockImplementationOnce(args => {
    calls.push("run:start");
    registryState.active.add("serial-chat");
    void args.makeGen().next();
    return {} as never;
  });
  await Promise.all([drainConversationQueue(localExecutor, "serial-chat"), drainConversationQueue(localExecutor, "serial-chat")]);
  expect(calls.filter(call => call === "run:start")).toHaveLength(1);
  expect(queue.items.map(turn => turn.id)).toEqual(["second"]);
});
it("restores a queued sender's target and user context before validating a project agent", async () => {
  recipient.current!.projectIds = ["p1"];
  queue.items.push({ id: "recover", conversationId: "restored", user: sender, userId: "7", agentId: "a-mateo", projectId: "p1", userText: "work", ts: "" } as QueuedTurn);
  await drainConversationQueue(localExecutor, "restored");
  expect(runOptions.last).toMatchObject({ user: sender, agentId: "a-mateo", projectId: "p1" });
  expect(runOptions.targetId).toBe(localExecutor.target.id);
});

it.each([false, true])("keeps a queued turn when its history cannot be saved, auto=%s", async auto => {
  queue.items.push({ id: "unsaved", conversationId: "unsaved-chat", withContext: true, user: sender, userText: "Continuar", ts: "2026-10-17", auto });
  vi.mocked(conversationsRepository.appendMessages).mockRejectedValueOnce(new Error("history unavailable"));
  await expect(drainConversationQueue(localExecutor, "unsaved-chat")).rejects.toThrow("history unavailable");
  expect(queue.items.map(turn => turn.id)).toEqual(["unsaved"]);
  expect(calls).not.toContain("drain:takeNext");
  expect(calls).not.toContain("run:start");
  await drainConversationQueue(localExecutor, "unsaved-chat");
  expect(queue.items).toHaveLength(0);
  expect(calls.filter(call => call === "run:start")).toHaveLength(1);
  expect(calls.indexOf("appendMessages")).toBeLessThan(calls.indexOf("drain:takeNext"));
});

it("keeps the continuation queued when rebuilding context fails", async () => {
  queue.items.push({ id: "context", conversationId: "context-chat", withContext: true, user: sender, userText: "Continuar", ts: "2026-10-17" });
  vi.mocked(conversationsRepository.messages).mockRejectedValueOnce(new Error("history unavailable"));
  await expect(drainConversationQueue(localExecutor, "context-chat")).rejects.toThrow("history unavailable");
  expect(queue.items.map(turn => turn.id)).toEqual(["context"]);
  expect(calls).not.toContain("run:start");
  await drainConversationQueue(localExecutor, "context-chat");
  expect(calls.filter(call => call === "run:start")).toHaveLength(1);
  expect(vi.mocked(conversationsRepository.appendMessages).mock.calls.at(-1)?.[3]).toMatchObject({ queueTurnId: "context" });
});

it.each([
  { interrupted: true },
  { error: "Resultado sin confirmar" },
  { ask: [{ id: "q", type: "text", text: "¿Continuar?" }] },
])("keeps automatic continuations blocked by the latest outcome %j", async outcome => {
  queue.items.push({ id: "blocked-auto", conversationId: "blocked-chat", withContext: true, user: sender, userText: "Continuar", ts: "2026-10-17", auto: true });
  vi.mocked(conversationsRepository.messages).mockResolvedValueOnce({ items: [{ role: "assistant", content: "", ts: "", ...outcome }], total: 1 } as never);
  await drainConversationQueue(localExecutor, "blocked-chat");
  expect(queue.items).toHaveLength(1);
  expect(calls).not.toContain("run:start");
});

it.each(["incorporation", "withdrawal"] as const)("keeps a recovered turn intact after concurrent %s during binding", async change => {
  const { agentRolesRepository } = await import("../repositories/agent-roles.repository.js");
  const projectId = change === "incorporation" ? null : "p1";
  recipient.current = { ...recipient.current, projectIds: projectId ? [projectId] : [], roleId: "base" };
  meta.current = { id: "chat", agentId: "a-mateo", projectId, messageCount: 2 };
  queue.items.push({ id: "recovered", conversationId: "chat", agentId: "a-mateo", projectId,
    user: sender, userText: "Queued work", ts: "", withContext: true });
  const savedQueue = JSON.stringify(queue.items);
  const savedMeta = JSON.stringify(meta.current);
  let resume!: () => void, entered!: () => void;
  const waiting = new Promise<void>(resolve => { resume = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const role = { id: "base", name: "Base", description: "", systemPrompt: "", allowedTools: null };
  const roleSpy = vi.spyOn(agentRolesRepository, "get").mockResolvedValue(role)
    .mockImplementationOnce(async () => { entered(); await waiting; return role; });
  const draining = runWithExecutor(localExecutor, () => drainConversationQueue(localExecutor, "chat"), 7, sender);
  const rejected = expect(draining).rejects.toMatchObject({
    code: change === "incorporation" ? "ASSISTANT_CONTEXT_MISMATCH" : "ASSISTANT_ASSIGNMENT_REMOVED",
  });
  try {
    await started;
    recipient.current = { ...recipient.current, projectIds: ["p1"],
      assignments: [{ projectId: "p1", status: change === "incorporation" ? "active" : "removed" }],
    };
    resume();
    await rejected;
    expect(JSON.stringify(queue.items)).toBe(savedQueue);
    expect(JSON.stringify(meta.current)).toBe(savedMeta);
    expect(calls).not.toContain("appendMessages");
    expect(calls).not.toContain("drain:takeNext");
    expect(calls).not.toContain("run:start");
    expect(runOptions.last).toBeNull();
  } finally { resume(); await draining.catch(() => undefined); roleSpy.mockRestore(); }
});
