// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LOCAL_TARGET_ID, type Executor } from "../../../shared/executor/index.js";
import type { AgentEvent } from "./providers/provider.types.js";
import type { StartRunParams } from "./agent-run-registry.js";
import { preserveWorkerExecution } from "./team-tasks/worker-recovery.js";
vi.mock("./team-tasks/worker-recovery.js", () => ({ preserveWorkerExecution: vi.fn(async () => false) }));

// ── Mocks (before importing the service) ────────────────────────────────────

// These tests isolate task lifecycle from assignment authorization, exercised
// with real context/admission code in agent-market.service.test.ts.
vi.mock("./agent-context.service.js", () => ({
  admitAgentWork: async (_e: unknown, _id: unknown, projectId: string | null) => ({ projectId: projectId ?? null, release: () => {} }),
  resolveConversationBinding: async (_e: unknown, input: { agentId?: string; projectId?: string }) => ({ agentId: input.agentId, projectId: input.projectId ?? null }),
}));

vi.mock("../repositories/assistant-audit.repository.js", () => ({ assistantAuditRepository: { append: vi.fn(async () => undefined) } }));

// In-memory task board + plans (double of team-tasks.repository).
interface AnyTask { [k: string]: unknown; id?: string; status: string; leaderConversationId: string; workerConversationId: string; createdAt: string }
interface AnyPlan { [k: string]: unknown; id?: string; status: string; leaderConversationId: string; steps: Array<{ title: string; workerAgentId?: string; status: string }> }
const board = new Map<string, AnyTask>();
const plans = new Map<string, AnyPlan>();
let seq = 0;
const TERMINAL = new Set(["done", "failed", "canceled"]);
vi.mock("../repositories/team-tasks.repository.js", () => ({
  teamTasksRepository: {
    async createTask(_e: unknown, item: AnyTask) {
      const doc = { ...item, id: `task-${++seq}`, createdAt: new Date().toISOString() };
      board.set(doc.id!, doc);
      return doc;
    },
    async getTask(_e: unknown, id: string) {
      return board.get(id) ?? null;
    },
    async updateTask(_e: unknown, id: string, patch: Record<string, unknown>) {
      const cur = board.get(id);
      if (!cur) return null;
      if (typeof patch["status"] === "string" && TERMINAL.has(cur.status) && patch["status"] !== cur.status) return cur;
      const next = { ...cur, ...patch } as AnyTask;
      board.set(id, next);
      return next;
    },
    async listForLeaderConversation(_e: unknown, conv: string) {
      return [...board.values()].filter((t) => t.leaderConversationId === conv);
    },
    async listActive() {
      return [...board.values()].filter((t) => !TERMINAL.has(t.status));
    },
    async findByWorkerConversation(_e: unknown, conv: string) {
      return [...board.values()].find((t) => t.workerConversationId === conv) ?? null;
    },
    async createPlan(_e: unknown, item: AnyPlan) {
      const doc = { ...item, id: `plan-${++seq}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      plans.set(doc.id!, doc);
      return doc;
    },
    async getPlan(_e: unknown, id: string) {
      return plans.get(id) ?? null;
    },
    async patchPlan(_e: unknown, id: string, patch: Record<string, unknown>) {
      const cur = plans.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch } as AnyPlan;
      plans.set(id, next);
      return next;
    },
    async getPlanByConversation(_e: unknown, conv: string) {
      return [...plans.values()].find((p) => p.leaderConversationId === conv) ?? null;
    },
  },
}));

const conversationMessages = new Map<string, Array<{ role: string; content: string; ts: string }>>();
const conversationChoices = new Map<string, Record<string, unknown>>();
const assistantDefaults: { defaultChatEffort?: "" | "low" | "medium" | "high" | "xhigh" | "max" } = {};
let convSeq = 0;
// Meta del líder (panelOrigin heredable) + registro de patchRuntime por conv.
const leaderMeta = { current: null as Record<string, unknown> | null };
const patchedRuntime: Array<[string, Record<string, unknown>]> = [];
vi.mock("../repositories/assistant-config.repository.js", () => ({
  assistantConfigRepository: { load: async () => ({ approval: { mode: "plan" }, ...assistantDefaults }) },
}));
vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: {
    async create(_e: unknown, _provider: string, _task: string, _project: unknown, _agent: unknown, choices: Record<string, unknown> = {}) {
      const id = `conv-w-${++convSeq}`;
      conversationMessages.set(id, []);
      conversationChoices.set(id, choices);
      return { id };
    },
    async appendMessages(_e: unknown, id: string, msgs: Array<{ role: string; content: string; ts: string }>) {
      const arr = conversationMessages.get(id) ?? [];
      arr.push(...msgs);
      conversationMessages.set(id, arr);
    },
    async messages(_e: unknown, id: string) {
      const items = conversationMessages.get(id) ?? [];
      return { items, total: items.length, hasMore: false };
    },
    async getMeta(_e: unknown, id: string) {
      return id === "conv-leader" ? leaderMeta.current : null;
    },
    async patchMeta(_e: unknown, id: string, patch: Record<string, unknown>) { patchedRuntime.push([id, patch]); return null; },
    async patchRuntime(_e: unknown, id: string, patch: Record<string, unknown>) {
      patchedRuntime.push([id, patch]);
      return null;
    },
  },
}));

// Tokens MCP por-run: startWorkerRun debe acuñarlos FRESCOS para el worker.
vi.mock("./mcp-run-tokens.js", () => ({
  mintCrossMcpToken: vi.fn((user: unknown, convId: string) => (user ? `cross-${convId}` : undefined)),
  mintGraphMcpToken: vi.fn((user: unknown, convId: string) => (user ? `graph-${convId}` : undefined)),
}));

// Cola persistida de turnos (camino diferido): doble in-memory.
const queuedTurns: Array<Record<string, unknown>> = [];
vi.mock("../repositories/agent-queue.repository.js", () => ({
  agentQueueRepository: {
    enqueue: vi.fn(async (_e: unknown, item: Record<string, unknown>) => {
      const doc = { ...item, id: `q-${queuedTurns.length + 1}`, ts: new Date().toISOString() };
      queuedTurns.push(doc);
      return doc;
    }),
    listFor: vi.fn(async (_e: unknown, conversationId: string) =>
      queuedTurns.filter((q) => q["conversationId"] === conversationId),
    ),
    clearFor: vi.fn(async () => undefined),
  },
}));

// Ledger de uso (presupuestos): por defecto vacío; cada test siembra totales.
type UsageTotals = { inputTokens: number; outputTokens: number; totalTokens: number; estimated: boolean };
const usageTotals = { current: new Map<string, UsageTotals>() };
vi.mock("../repositories/usage.repository.js", () => ({
  usageRepository: {
    totalsForConversations: vi.fn(async () => usageTotals.current),
    record: vi.fn(async () => undefined),
  },
}));

vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: { list: vi.fn(async () => []) },
}));

const registryState = {
  started: [] as StartRunParams[],
  has: vi.fn((_k: string) => false),
  isActive: vi.fn((_k: string) => false),
  stopped: [] as string[],
};
vi.mock("./agent-run-registry.js", () => ({
  agentRunRegistry: {
    start: (params: (typeof registryState.started)[number]) => {
      registryState.started.push(params);
      return {};
    },
    has: (k: string) => registryState.has(k),
    inject: vi.fn(() => true),
    stop: (k: string) => {
      registryState.stopped.push(k);
      return true;
    },
    isActive: (k: string) => registryState.isActive(k),
  },
}));

vi.mock("./cli-job-tracker.service.js", () => ({
  cliJobTracker: {
    hasJobForConversation: vi.fn(() => false),
    killForConversation: vi.fn(() => 0),
  },
}));

// Descriptores cli-job: startWorkerRun debe borrarlos al completar runs CLI.
const cliJobsDeleted: string[] = [];
vi.mock("../repositories/cli-jobs.repository.js", () => ({
  cliJobsRepository: {
    delete: vi.fn(async (_e: unknown, conversationId: string) => {
      cliJobsDeleted.push(conversationId);
      return true;
    }),
  },
}));

// Verify runner double: cada test encola sus veredictos (FIFO).
const verifyQueue: Array<{ ok: boolean; failedCommand?: string; exitCode?: number; logTail: string; durationMs: number }> = [];
vi.mock("./team-verify.service.js", () => ({
  teamVerifyService: {
    run: vi.fn(async () => verifyQueue.shift() ?? { ok: true, logTail: "ok", durationMs: 1 }),
  },
}));

// worker-quota: delega en el módulo real (misma Map in-process), pero envuelve
// `hasWorkerSlot` en un vi.fn para poder forzar UN throw en el guard síncrono de
// `dispatchNext` (regresión del unhandledRejection). El resto de tests ven el
// comportamiento real intacto.
vi.mock("./team-tasks/worker-quota.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./team-tasks/worker-quota.js")>();
  return { ...actual, hasWorkerSlot: vi.fn(actual.hasWorkerSlot) };
});

import {
  teamTasksService,
  CLI_RECOVERY_INTERRUPTED_TEXT,
  TASK_INTERRUPTED_ERROR,
  isInterruptionPlaceholder,
} from "./team-tasks.service.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { hasWorkerSlot } from "./team-tasks/worker-quota.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";

const executor = { target: { id: LOCAL_TARGET_ID } } as Executor;
const worker: AssistantAgent = {
  id: "agent-w",
  name: "Backend",
  description: "backend specialist",
  systemPrompt: "",
  providerId: "claude",
  model: "",
  allowedTools: null,
};

// The runner double: never actually consumed (the registry double doesn't run
// makeGen), but must be a valid generator factory.
// eslint-disable-next-line @typescript-eslint/require-await
async function* noopGen(): AsyncGenerator<AgentEvent> {
  yield { type: "done" };
}
const runAgent = () => noopGen();

async function assign(leaderConv = "conv-leader") {
  return teamTasksService.assignTask({
    executor,
    leaderConversationId: leaderConv,
    leaderAgentId: "agent-lead",
    worker,
    title: "Tarea",
    task: "haz algo con todo el contexto",
    projectId: null,
    depth: 0,
    runAgent,
  });
}

beforeEach(() => {
  board.clear();
  plans.clear();
  conversationMessages.clear();
  conversationChoices.clear();
  delete assistantDefaults.defaultChatEffort;
  registryState.started.length = 0;
  registryState.stopped.length = 0;
  registryState.has.mockReturnValue(false);
  registryState.isActive.mockReturnValue(false);
  // El cupo de workers y la FIFO de despacho son estado in-process del
  // servicio: los runs mockeados nunca completan, así que sin reset el cupo
  // se agota entre tests y los assign se van por el camino diferido.
  teamTasksService._resetForTest();
  verifyQueue.length = 0;
  cliJobsDeleted.length = 0;
  leaderMeta.current = null;
  patchedRuntime.length = 0;
  usageTotals.current = new Map();
  queuedTurns.length = 0;
});

describe("teamTasksService.assignTask", () => {
  it("persists the configured reasoning effort for a delegated chat", async () => {
    assistantDefaults.defaultChatEffort = "max";
    const task = await assign();
    expect(task.status).toBe("running");
    expect(conversationChoices.get(task.workerConversationId)).toEqual({ effort: "max" });
  });

  it("keeps the queued task's reasoning choice when the default changes before dispatch", async () => {
    for (let i = 0; i < 4; i++) await assign();
    assistantDefaults.defaultChatEffort = "max";
    const task = await assign();
    expect(task.status).toBe("pending");
    assistantDefaults.defaultChatEffort = "low";
    await registryState.started[0]?.onComplete?.("hecho", false);
    await vi.waitFor(() => expect(board.get(task.id ?? "")?.status).toBe("running"));
    expect(conversationChoices.get(task.workerConversationId)).toEqual({ effort: "max" });
  });

  it.each([undefined, ""] as const)("keeps automatic reasoning when the configured effort is %s", async (effort) => {
    if (effort !== undefined) assistantDefaults.defaultChatEffort = effort;
    const task = await assign();
    expect(conversationChoices.get(task.workerConversationId)).not.toHaveProperty("effort");
  });

  it("creates the board record BEFORE starting the run and returns it running", async () => {
    const task = await assign();
    expect(task.status).toBe("running");
    expect(task.workerConversationId).toMatch(/^conv-w-/);
    expect(registryState.started).toHaveLength(1);
    expect(registryState.started[0]?.key).toBe(task.workerConversationId);
    // Worker run: marcado isWorker para NO consumir el cap HTTP por usuario.
    expect(registryState.started[0]?.isWorker).toBe(true);
    // The worker chat got the task as its first user message.
    expect(conversationMessages.get(task.workerConversationId)?.[0]?.content).toBe("haz algo con todo el contexto");
  });

  it("closes the task as done with the answer when the worker run completes", async () => {
    const task = await assign();
    await registryState.started[0]?.onComplete?.("respuesta del worker", false);
    const stored = board.get(task.id ?? "");
    expect(stored?.status).toBe("done");
    expect(stored?.resultSummary).toBe("respuesta del worker");
    // The answer was persisted to the worker chat too.
    const msgs = conversationMessages.get(task.workerConversationId) ?? [];
    expect(msgs.at(-1)?.role).toBe("assistant");
  });

  it("keeps the task alive with a delayed retry when the worker run errors", async () => {
    const task = await assign();
    await registryState.started[0]?.onComplete?.("", true);
    expect(board.get(task.id ?? "")).toMatchObject({ status: "running", retry: { state: "waiting", attempts: 0, maxRetries: 3, delayMs: 30000 } });
    expect(queuedTurns.at(-1)).toMatchObject({ isWorker: true, teamRetry: { taskId: task.id, attempt: 1 } });
  });

  it("preserves the same console, metrics and translated answer as a normal chat", async () => {
    const task = await assign();
    const run = registryState.started[0]!;
    run.onEvent?.({ type: "tool_use", id: "cli", name: "claude.cli", input: {} });
    run.onEvent?.({ type: "usage", model: "claude-cli", inputTokens: 20, outputTokens: 5, estimated: true });
    await run.onComplete?.("Done", false, undefined, { text: "Hecho", lang: "es" }, 1500, "Revisando archivos\nDone");
    expect(conversationMessages.get(task.workerConversationId)?.at(-1)).toMatchObject({
      content: "Done", cli: true, cliLog: "Revisando archivos\nDone", durationMs: 1500,
      tokens: { input: 20, output: 5, total: 25, estimated: true }, textTranslated: "Hecho", lang: "es",
    });
  });

  it("persists a failed worker with no answer and keeps its reason on the board", async () => {
    const task = await assign();
    const run = registryState.started[0]!;
    const error = "El proveedor rechazó la autenticación del asistente.";
    run.onEvent?.({ type: "tool_use", id: "cli", name: "claude.cli", input: {} });
    await run.onComplete?.("", true, undefined, undefined, 3000, "OAuth session expired", undefined, { error });
    expect(conversationMessages.get(task.workerConversationId)?.at(-1)).toMatchObject({ content: "", cli: true, error, cliLog: "OAuth session expired", durationMs: 3000 });
    expect(board.get(task.id ?? "")).toMatchObject({ status: "failed", error });
  });

  it("keeps worker plan questions and interruptions after reloading", async () => {
    const task = await assign();
    const ask = [{ id: "plan", type: "single" as const, text: "¿Continuar?", options: ["Sí", "No"] }];
    await registryState.started[0]!.onComplete?.("", true, ask, undefined, 100, undefined, "plan-approval", { interrupted: true });
    expect(conversationMessages.get(task.workerConversationId)?.at(-1)).toMatchObject({ content: "", ask, askKind: "plan-approval", interrupted: true });
  });

  it("borra el descriptor cli-job al completar un run CLI de worker", async () => {
    const task = await assign();
    const started = registryState.started[0];
    // El evento `.cli` marca el run como CLI (mismo señal que usa el recorder).
    started?.onEvent?.({ type: "tool_use", id: "t1", name: "claude.cli", input: {} });
    await started?.onComplete?.("respuesta del worker", false);
    expect(cliJobsDeleted).toContain(task.workerConversationId);
  });

  it("NO toca cli-jobs cuando el worker corre en modo API", async () => {
    const task = await assign();
    await registryState.started[0]?.onComplete?.("respuesta del worker", false);
    expect(cliJobsDeleted).not.toContain(task.workerConversationId);
  });

  it("hereda panelOrigin del meta del líder, acuña tokens frescos y parchea el meta del worker", async () => {
    leaderMeta.current = { panelOrigin: "https://panel.example.com" };
    const captured: Array<Record<string, unknown>> = [];
    const capturingRunAgent = ((_msgs: unknown, opts: Record<string, unknown>) => {
      captured.push(opts);
      return noopGen();
    }) as unknown as Parameters<typeof teamTasksService.assignTask>[0]["runAgent"];
    const task = await teamTasksService.assignTask({
      executor,
      user: { userId: 1, username: "operator", displayName: "J", role: "admin", modules: [], kind: "admin" } as never,
      leaderConversationId: "conv-leader",
      leaderAgentId: "agent-lead",
      worker,
      title: "Tarea",
      task: "verifica el estado",
      projectId: null,
      depth: 0,
      runAgent: capturingRunAgent,
    });
    // Materializar el generador para capturar las opciones reales del run.
    void registryState.started[0]?.makeGen().next();
    expect(captured[0]).toMatchObject({
      panelOrigin: "https://panel.example.com",
      crossMcpToken: `cross-${task.workerConversationId}`,
      graphMcpToken: `graph-${task.workerConversationId}`,
    });
    // El meta del worker queda con el origen para los turnos drenados/retry.
    expect(patchedRuntime).toContainEqual([task.workerConversationId, { panelOrigin: "https://panel.example.com" }]);
  });

  it("sin panelOrigin del líder el worker corre como antes (sin canal)", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const capturingRunAgent = ((_msgs: unknown, opts: Record<string, unknown>) => {
      captured.push(opts);
      return noopGen();
    }) as unknown as Parameters<typeof teamTasksService.assignTask>[0]["runAgent"];
    await teamTasksService.assignTask({
      executor,
      leaderConversationId: "conv-leader",
      leaderAgentId: "agent-lead",
      worker,
      title: "Tarea",
      task: "verifica el estado",
      projectId: null,
      depth: 0,
      runAgent: capturingRunAgent,
    });
    void registryState.started[0]?.makeGen().next();
    expect(captured[0]).not.toHaveProperty("panelOrigin");
    expect(captured[0]).not.toHaveProperty("crossMcpToken");
    expect(patchedRuntime).toHaveLength(0);
  });
});

describe("teamTasksService.waitForTasks", () => {
  it("resolves as soon as every listed task reaches a terminal state (waiter ping)", async () => {
    registryState.has.mockReturnValue(true); // workers alive → no reconciliation
    const a = await assign();
    const b = await assign();
    const wait = teamTasksService.waitForTasks(executor, "conv-leader", [a.id ?? "", b.id ?? ""], 5_000);
    // Finish both AFTER the wait started.
    setTimeout(() => void registryState.started[0]?.onComplete?.("ok A", false), 20);
    setTimeout(() => void registryState.started[1]?.onComplete?.("ok B", false), 40);
    const t0 = Date.now();
    const { tasks, timedOut } = await wait;
    expect(timedOut).toBe(false);
    expect(Date.now() - t0).toBeLessThan(3_000);
    expect(tasks.map((t) => t.status).sort()).toEqual(["done", "done"]);
  });

  it("times out and reports partials when a task is still running", async () => {
    registryState.has.mockReturnValue(true);
    const a = await assign();
    const b = await assign();
    await registryState.started[0]?.onComplete?.("ok A", false);
    const { tasks, timedOut } = await teamTasksService.waitForTasks(
      executor,
      "conv-leader",
      [a.id ?? "", b.id ?? ""],
      100,
    );
    expect(timedOut).toBe(true);
    const byId = new Map(tasks.map((t) => [t.id, t.status]));
    expect(byId.get(a.id)).toBe("done");
    expect(byId.get(b.id)).toBe("running");
  });

  it("releases the wait on the leader's AbortSignal without touching the workers", async () => {
    registryState.has.mockReturnValue(true);
    const a = await assign();
    const ac = new AbortController();
    const wait = teamTasksService.waitForTasks(executor, "conv-leader", [a.id ?? ""], 10_000, ac.signal);
    setTimeout(() => ac.abort(), 30);
    const t0 = Date.now();
    const { timedOut } = await wait;
    expect(timedOut).toBe(true);
    expect(Date.now() - t0).toBeLessThan(2_000);
    expect(board.get(a.id ?? "")?.status).toBe("running"); // worker untouched
    expect(registryState.stopped).toHaveLength(0);
  });
});

describe("teamTasksService reconciliation", () => {
  it("does not fail a stale worker whose persisted CLI is recovering", async () => {
    const task = await assign();
    const stored = board.get(task.id ?? "");
    if (stored) stored["startedAt"] = new Date(Date.now() - 10 * 60_000).toISOString();
    vi.mocked(preserveWorkerExecution).mockResolvedValueOnce(true);
    const list = await teamTasksService.listForLeaderConversation(executor, "conv-leader");
    expect(list[0]?.status).toBe("running");
  });
  it("closes a STALE running task from the persisted worker chat (restart orphan)", async () => {
    const task = await assign();
    // Simulate the worker having answered before the panel died.
    conversationMessages.get(task.workerConversationId)?.push({
      role: "assistant",
      content: "respuesta persistida",
      ts: new Date().toISOString(),
    });
    // Make it stale: no live run, no CLI job, started long ago.
    const stored = board.get(task.id ?? "");
    if (stored) stored["startedAt"] = new Date(Date.now() - 10 * 60_000).toISOString();
    const list = await teamTasksService.listForLeaderConversation(executor, "conv-leader");
    expect(list[0]?.status).toBe("done");
    expect(list[0]?.resultSummary).toBe("respuesta persistida");
  });

  it("fails a stale running task whose worker chat has no answer", async () => {
    const task = await assign();
    const stored = board.get(task.id ?? "");
    if (stored) stored["startedAt"] = new Date(Date.now() - 10 * 60_000).toISOString();
    const list = await teamTasksService.listForLeaderConversation(executor, "conv-leader");
    expect(list[0]?.status).toBe("failed");
  });

  it("leaves a running task alone while its run is still tracked", async () => {
    registryState.has.mockReturnValue(true);
    const task = await assign();
    const stored = board.get(task.id ?? "");
    if (stored) stored["startedAt"] = new Date(Date.now() - 10 * 60_000).toISOString();
    const list = await teamTasksService.listForLeaderConversation(executor, "conv-leader");
    expect(list[0]?.status).toBe("running");
    expect(task.id).toBeTruthy();
  });
});

describe("leader nudge watcher (AI_TEAM_LEADER_NUDGE)", () => {
  it("recovers a missed delivery without restarting workers", async () => {
    const deliveries: Array<{ onSettled: () => void }> = [];
    const listener = (payload: unknown) => deliveries.push(payload as { onSettled: () => void });
    eventBus.on(Events.AI_TEAM_LEADER_NUDGE, listener);
    try {
      await assign();
      await registryState.started[0]?.onComplete?.("Verificado", false);
      expect(deliveries).toHaveLength(1);
      deliveries[0]!.onSettled(); // enqueue failed; no durable acknowledgment
      await teamTasksService.listForLeaderConversation(executor, "conv-leader");
      expect(deliveries).toHaveLength(2);
      expect(registryState.started).toHaveLength(1);
    } finally { eventBus.off(Events.AI_TEAM_LEADER_NUDGE, listener); }
  });

  it("emits ONCE when the last uncollected task closes with no leader run and no waiters", async () => {
    const events: Array<{ taskIds: string[] }> = [];
    const listener = (p: unknown) => events.push(p as { taskIds: string[] });
    eventBus.on(Events.AI_TEAM_LEADER_NUDGE, listener);
    try {
      const a = await assign();
      const b = await assign();
      await registryState.started[0]?.onComplete?.("ok A", false);
      expect(events).toHaveLength(0); // B still running → team still working
      await registryState.started[1]?.onComplete?.("ok B", false);
      expect(events).toHaveLength(1);
      expect(events[0]?.taskIds.sort()).toEqual([a.id, b.id].sort());
      // In-flight delivery dedupes; durable acknowledgment belongs to enqueue.
      expect(board.get(a.id ?? "")?.["nudged"]).not.toBe(true);
      expect(board.get(b.id ?? "")?.["nudged"]).not.toBe(true);
      await teamTasksService.listForLeaderConversation(executor, "conv-leader");
      expect(events).toHaveLength(1);
    } finally {
      eventBus.off(Events.AI_TEAM_LEADER_NUDGE, listener);
    }
  });

  it("does NOT nudge while the leader run is active or a collect is waiting", async () => {
    const events: unknown[] = [];
    const listener = (p: unknown) => events.push(p);
    eventBus.on(Events.AI_TEAM_LEADER_NUDGE, listener);
    try {
      // Case 1: leader mid-turn.
      registryState.isActive.mockImplementation((k: string) => k === "conv-leader");
      await assign();
      await registryState.started[0]?.onComplete?.("ok", false);
      expect(events).toHaveLength(0);
      // Case 2: a collect wait active (waiters registered) — new leader conv.
      registryState.isActive.mockReturnValue(false);
      registryState.has.mockReturnValue(true);
      const b = await assign("conv-leader-2");
      const wait = teamTasksService.waitForTasks(executor, "conv-leader-2", [b.id ?? ""], 3_000);
      await new Promise((r) => setTimeout(r, 10));
      await registryState.started[1]?.onComplete?.("ok", false);
      const { timedOut } = await wait;
      expect(timedOut).toBe(false);
      expect(events).toHaveLength(0); // the collect grabbed it — no nudge
    } finally {
      eventBus.off(Events.AI_TEAM_LEADER_NUDGE, listener);
    }
  });
});

describe("team plans", () => {
  it("mirrors task closes into plan steps and completes the plan (event emitted)", async () => {
    const events: Array<{ planId: string; status: string }> = [];
    const listener = (p: unknown) => events.push(p as { planId: string; status: string });
    eventBus.on(Events.AI_TEAM_PLAN_COMPLETED, listener);
    try {
      const plan = await teamTasksService.createPlan(executor, {
        leaderConversationId: "conv-leader",
        leaderAgentId: "agent-lead",
        title: "Plan X",
        goal: "meta",
        steps: [{ title: "paso A" }, { title: "paso B" }],
      });
      const assignStep = (i: number) =>
        teamTasksService.assignTask({
          executor,
          leaderConversationId: "conv-leader",
          leaderAgentId: "agent-lead",
          worker,
          title: `Paso ${i}`,
          task: "trabajo",
          projectId: null,
          planId: plan.id ?? "",
          stepIndex: i,
          depth: 0,
          runAgent,
        });
      const t0 = await assignStep(0);
      const t1 = await assignStep(1);
      expect(plans.get(plan.id ?? "")?.steps.map((s) => s.status)).toEqual(["assigned", "assigned"]);
      await registryState.started[0]?.onComplete?.("ok 0", false);
      expect(plans.get(plan.id ?? "")?.steps[0]?.status).toBe("done");
      expect(plans.get(plan.id ?? "")?.status).toBe("active");
      expect(events).toHaveLength(0);
      await registryState.started[1]?.onComplete?.("Permisos insuficientes", true); // permanent failure
      expect(plans.get(plan.id ?? "")?.steps[1]?.status).toBe("failed");
      expect(plans.get(plan.id ?? "")?.status).toBe("failed");
      expect(events).toHaveLength(1);
      expect(events[0]?.status).toBe("failed");
      expect(t0.planId).toBe(plan.id);
      expect(t1.stepIndex).toBe(1);
    } finally {
      eventBus.off(Events.AI_TEAM_PLAN_COMPLETED, listener);
    }
  });
});

describe("teamTasksService.cancelTask", () => {
  it("stops the worker run and closes the task as canceled (idempotent on terminal)", async () => {
    const task = await assign();
    const canceled = await teamTasksService.cancelTask(executor, task.id ?? "");
    expect(canceled?.status).toBe("canceled");
    expect(registryState.stopped).toContain(task.workerConversationId);
    // Cancel again → still canceled, no double side effects on the board.
    const again = await teamTasksService.cancelTask(executor, task.id ?? "");
    expect(again?.status).toBe("canceled");
  });
});

describe("interruption placeholders (restart recovery)", () => {
  it("keeps a worker waiting for its human answer instead of closing it", async () => {
    const task = await assign();
    await registryState.started[0]?.onComplete?.("Necesito el destino", false, [{ id: "q", type: "text", text: "Destino" }]);
    expect(board.get(task.id!)?.status).toBe("running");
    board.get(task.id!)!["startedAt"] = new Date(Date.now() - 600000).toISOString();
    const tasks = await teamTasksService.listForLeaderConversation(executor, "conv-leader");
    expect(tasks[0]?.status).toBe("running");
  });

  it("does not turn a partial failed answer into success during reconciliation", async () => {
    const task = await assign();
    conversationMessages.get(task.workerConversationId)?.push({ role: "assistant", content: "Voy a cambiarlo", error: "Resultado sin confirmar", ts: new Date().toISOString() } as never);
    const tasks = await teamTasksService.listForLeaderConversation(executor, "conv-leader");
    expect(tasks[0]).toMatchObject({ status: "running", retry: { state: "waiting", history: [{ error: "Resultado sin confirmar" }] } });
    expect(queuedTurns.at(-1)?.userText).toContain("No repitas operaciones con resultado no confirmado");
  });

  it("keeps a manual worker stop canceled even if text was produced", async () => {
    const task = await assign();
    await registryState.started[0]?.onComplete?.("Trabajo parcial", false, undefined, undefined, undefined, undefined, undefined, { interrupted: true });
    expect(board.get(task.id!)?.status).toBe("canceled");
  });

  it("matches the recovery note and this service's own error text", () => {
    expect(isInterruptionPlaceholder(CLI_RECOVERY_INTERRUPTED_TEXT)).toBe(true);
    expect(isInterruptionPlaceholder(TASK_INTERRUPTED_ERROR)).toBe(true);
    // Tolerante a variaciones que conserven el prefijo del controller.
    expect(isInterruptionPlaceholder("⚠️ La ejecución se interrumpió (reinicio del servidor)")).toBe(true);
    expect(isInterruptionPlaceholder("respuesta real del worker")).toBe(false);
    expect(isInterruptionPlaceholder("")).toBe(false);
    expect(isInterruptionPlaceholder(undefined)).toBe(false);
  });

  it("closes as FAILED (not done) when the 'result' is the interruption placeholder", async () => {
    const task = await assign();
    // El cierre llega con el placeholder como último assistant (mismo camino
    // que el listener AI_CHAT_FINISHED: toma el último mensaje como summary).
    await registryState.started[0]?.onComplete?.(CLI_RECOVERY_INTERRUPTED_TEXT, false);
    const stored = board.get(task.id ?? "");
    expect(stored?.status).toBe("failed");
    expect(stored?.["error"]).toBe(TASK_INTERRUPTED_ERROR);
    // El placeholder queda como summary informativo, nunca como éxito.
    expect(stored?.["resultSummary"]).toContain("La ejecución se interrumpió");
  });

  it("reconciliation fails a running orphan IMMEDIATELY (no stale window) when the worker chat got the placeholder", async () => {
    const task = await assign();
    // Reinicio: el run ya no está en el registry y la recuperación dejó la nota.
    conversationMessages.get(task.workerConversationId)?.push({
      role: "assistant",
      content: CLI_RECOVERY_INTERRUPTED_TEXT,
      ts: new Date().toISOString(),
    });
    // startedAt = ahora (fresca): el cierre NO debe esperar STALE_RUNNING_MS.
    const list = await teamTasksService.listForLeaderConversation(executor, "conv-leader");
    expect(list[0]?.status).toBe("failed");
    expect(list[0]?.error).toBe(TASK_INTERRUPTED_ERROR);
  });

  it("reconciliation still closes a stale orphan with a REAL answer as done", async () => {
    const task = await assign();
    conversationMessages.get(task.workerConversationId)?.push({
      role: "assistant",
      content: "respuesta real persistida",
      ts: new Date().toISOString(),
    });
    const stored = board.get(task.id ?? "");
    if (stored) stored["startedAt"] = new Date(Date.now() - 10 * 60_000).toISOString();
    const list = await teamTasksService.listForLeaderConversation(executor, "conv-leader");
    expect(list[0]?.status).toBe("done");
    expect(list[0]?.resultSummary).toBe("respuesta real persistida");
  });
});

describe("plan-step dedupe (assignTask)", () => {
  async function assignStep(stepIndex: number, planId = "plan-dup") {
    return teamTasksService.assignTask({
      executor,
      leaderConversationId: "conv-leader",
      leaderAgentId: "agent-lead",
      worker,
      title: `Paso ${stepIndex}`,
      task: "trabajo del paso",
      projectId: null,
      planId,
      stepIndex,
      depth: 0,
      runAgent,
    });
  }

  it("reuses the existing ACTIVE task of the same (planId, stepIndex) instead of duplicating", async () => {
    registryState.has.mockReturnValue(true); // el run del primer intento sigue vivo
    const first = await assignStep(0);
    const retry = await assignStep(0);
    expect(retry.id).toBe(first.id);
    // Ni tarea nueva en el board ni run nuevo arrancado.
    expect([...board.values()].filter((t) => t["planId"] === "plan-dup")).toHaveLength(1);
    expect(registryState.started).toHaveLength(1);
  });

  it("does NOT dedupe across different steps or plans", async () => {
    registryState.has.mockReturnValue(true);
    const a = await assignStep(0);
    const b = await assignStep(1);
    const c = await assignStep(0, "plan-otro");
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });

  it("after a FAILED attempt a retry creates a new task and retires the old one from collect/nudge", async () => {
    const first = await assignStep(0);
    await registryState.started[0]?.onComplete?.("Permisos insuficientes", true); // permanent failure
    const retry = await assignStep(0);
    expect(retry.id).not.toBe(first.id);
    expect(retry.status).toBe("running");
    const old = board.get(first.id ?? "");
    expect(old?.status).toBe("failed");
    // La vieja sale del ciclo collect/nudge (lo más cercano a "reemplazada").
    expect(old?.["collected"]).toBe(true);
    expect(old?.["nudged"]).toBe(true);
  });

  it("a running orphan (placeholder in the worker chat) does not block the retry: it is failed and replaced", async () => {
    const first = await assignStep(0);
    // Reinicio: run muerto + nota de interrupción persistida.
    conversationMessages.get(first.workerConversationId)?.push({
      role: "assistant",
      content: CLI_RECOVERY_INTERRUPTED_TEXT,
      ts: new Date().toISOString(),
    });
    const retry = await assignStep(0);
    expect(retry.id).not.toBe(first.id);
    const old = board.get(first.id ?? "");
    expect(old?.status).toBe("failed");
    expect(old?.["collected"]).toBe(true);
  });
});

describe("verify gate (finalizeTask)", () => {
  async function assignWithVerify() {
    const t = await teamTasksService.assignTask({
      executor,
      leaderConversationId: "conv-verify",
      leaderAgentId: "agent-lead",
      worker,
      title: "Tarea",
      task: "implementa la feature",
      projectId: null,
      depth: 0,
      runAgent,
      verifyCommands: ["npm test"],
    });
    // Dale un cwd de worktree para que el gate no lo salte (sin cwd → skipped).
    const rec = board.get(t.id ?? "")!;
    board.set(t.id ?? "", {
      ...rec,
      isolation: { mode: "worktree", repoRoot: "/repo", worktreePath: "/wt", branch: "lxp/task-x", baseSha: "a", cwd: "/wt" },
    });
    return t.id ?? "";
  }
  const closeDone = async () => {
    const started = registryState.started.at(-1)!;
    await started.onComplete?.("hecho", false);
  };


  it.each([undefined, "failed", "skipped", "running"] as const)(
    "does not recover an orphan as done without confirmed verification (%s)",
    async state => {
      const id = await assignWithVerify();
      const stored = board.get(id)!;
      stored["startedAt"] = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      delete stored["isolation"]; // Reconciliation does not need real Git or shell effects.
      if (state) stored["verify"] = { state, attempts: 1, startedAt: stored["startedAt"] };
      conversationMessages.get(stored.workerConversationId)?.push({
        role: "assistant", content: "Cambios preparados", ts: new Date().toISOString(),
      });
      verifyQueue.push({ ok: true, logTail: "must not execute", durationMs: 1 });

      const [recovered] = await teamTasksService.listForLeaderConversation(executor, "conv-verify");

      expect(recovered).toMatchObject({
        status: "failed",
        resultSummary: "Cambios preparados",
      });
      expect(recovered?.error).toContain("verificación");
      expect(verifyQueue).toHaveLength(1);
      expect(registryState.started).toHaveLength(1);
    },
  );

  it("recovers an already verified answer without executing its verification again", async () => {
    const id = await assignWithVerify();
    const stored = board.get(id)!;
    stored["startedAt"] = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    delete stored["isolation"];
    stored["verify"] = { state: "passed", attempts: 1 };
    conversationMessages.get(stored.workerConversationId)?.push({
      role: "assistant", content: "Cambios verificados", ts: new Date().toISOString(),
    });
    verifyQueue.push({ ok: true, logTail: "must not execute", durationMs: 1 });

    const [recovered] = await teamTasksService.listForLeaderConversation(executor, "conv-verify");

    expect(recovered).toMatchObject({ status: "done", verify: { state: "passed" } });
    expect(verifyQueue).toHaveLength(1);
    expect(registryState.started).toHaveLength(1);
  });

  it.each(["verification", "queued-repair"] as const)(
    "keeps recovery pending while %s is still active",
    async active => {
      const id = await assignWithVerify();
      const stored = board.get(id)!;
      stored["startedAt"] = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      delete stored["isolation"];
      if (active === "verification") {
        stored["verify"] = { state: "running", attempts: 1, startedAt: new Date().toISOString() };
      } else {
        stored["verify"] = { state: "failed", attempts: 1 };
        queuedTurns.push({ conversationId: stored.workerConversationId, auto: true, userText: "Revisar el fallo" });
      }
      conversationMessages.get(stored.workerConversationId)?.push({
        role: "assistant", content: "Cambios preparados", ts: new Date().toISOString(),
      });
      verifyQueue.push({ ok: true, logTail: "must not execute", durationMs: 1 });

      const [recovered] = await teamTasksService.listForLeaderConversation(executor, "conv-verify");

      expect(recovered?.status).toBe("running");
      expect(verifyQueue).toHaveLength(1);
      expect(registryState.started).toHaveLength(1);
    },
  );

  it("verify OK → cierra done con verify passed", async () => {
    const id = await assignWithVerify();
    verifyQueue.push({ ok: true, logTail: "ok", durationMs: 1 });
    await closeDone();
    const closed = board.get(id)!;
    expect(closed.status).toBe("done");
    expect((closed["verify"] as { state: string }).state).toBe("passed");
  });

  it("verify falla con reintentos → la tarea SIGUE running y emite AI_TEAM_TASK_VERIFY_RETRY", async () => {
    const events: Array<Record<string, unknown>> = [];
    const h = (p: Record<string, unknown>) => void events.push(p);
    eventBus.on(Events.AI_TEAM_TASK_VERIFY_RETRY, h);
    const id = await assignWithVerify();
    verifyQueue.push({ ok: false, failedCommand: "npm test", exitCode: 1, logTail: "boom", durationMs: 1 });
    await closeDone();
    eventBus.off(Events.AI_TEAM_TASK_VERIFY_RETRY, h);
    const cur = board.get(id)!;
    expect(cur.status).toBe("running");
    expect(cur["verify"]).toMatchObject({ state: "failed", attempts: 1, failedCommand: "npm test" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ taskId: id, attempt: 1, maxAttempts: 3, forcedCwd: "/wt" });
  });

  it("verify agota los intentos → failed con el log en resultSummary", async () => {
    const id = await assignWithVerify();
    for (const tail of ["b1", "b2", "b3"]) {
      verifyQueue.push({ ok: false, failedCommand: "npm test", exitCode: 1, logTail: tail, durationMs: 1 });
      await closeDone();
    }
    const cur = board.get(id)!;
    expect(cur.status).toBe("failed");
    expect(String(cur["resultSummary"])).toContain("VERIFICACIÓN FALLIDA");
    expect(String(cur["error"])).toContain("3 intento(s)");
  });

  it("cancel salta el gate (skipVerify) y cierra canceled", async () => {
    const id = await assignWithVerify();
    verifyQueue.push({ ok: false, failedCommand: "x", exitCode: 1, logTail: "no debería usarse", durationMs: 1 });
    const res = await teamTasksService.cancelTask(executor, id);
    expect(res?.status).toBe("canceled");
    expect(verifyQueue).toHaveLength(1); // el gate nunca consumió el veredicto
  });
});

describe("AI_TEAM_TASK_UPDATE event (cross-channel task updates)", () => {
  it("emit the event on assign (phase=assigned)", async () => {
    const events: Array<Record<string, unknown>> = [];
    const h = (p: Record<string, unknown>) => void events.push(p);
    eventBus.on(Events.AI_TEAM_TASK_UPDATE, h);
    try {
      const task = await assign();
      expect(events.length).toBeGreaterThanOrEqual(1);
      const last = events[events.length - 1]!;
      expect(last["phase"]).toBe("assigned");
      expect(last["leaderConversationId"]).toBe("conv-leader");
      expect((last["task"] as { id: string }).id).toBe(task.id);
      expect(typeof last["correlationId"]).toBe("string");
    } finally {
      eventBus.off(Events.AI_TEAM_TASK_UPDATE, h);
    }
  });

  it("emits the event with phase=closed when finalizeTask closes a task (survives leader run)", async () => {
    const events: Array<Record<string, unknown>> = [];
    const h = (p: Record<string, unknown>) => void events.push(p);
    eventBus.on(Events.AI_TEAM_TASK_UPDATE, h);
    try {
      const task = await assign();
      events.length = 0; // descartar el del assign
      await registryState.started[0]?.onComplete?.("respuesta", false);
      const closedEvents = events.filter((e) => e["phase"] === "closed");
      expect(closedEvents).toHaveLength(1);
      const closed = closedEvents[0]!;
      expect((closed["task"] as { id: string; status: string }).id).toBe(task.id);
      expect((closed["task"] as { id: string; status: string }).status).toBe("done");
      expect(closed["workerConversationId"]).toBe(task.workerConversationId);
      expect(closed["leaderConversationId"]).toBe("conv-leader");
    } finally {
      eventBus.off(Events.AI_TEAM_TASK_UPDATE, h);
    }
  });

  it("emits the event with phase=closed on cancel as well", async () => {
    const events: Array<Record<string, unknown>> = [];
    const h = (p: Record<string, unknown>) => void events.push(p);
    eventBus.on(Events.AI_TEAM_TASK_UPDATE, h);
    try {
      const task = await assign();
      events.length = 0;
      await teamTasksService.cancelTask(executor, task.id ?? "");
      const closed = events.filter((e) => e["phase"] === "closed");
      expect(closed).toHaveLength(1);
      expect((closed[0]!["task"] as { status: string }).status).toBe("canceled");
    } finally {
      eventBus.off(Events.AI_TEAM_TASK_UPDATE, h);
    }
  });
});

describe("presupuestos de equipo (plan + tarea)", () => {
  const baseAssign = {
    executor,
    leaderConversationId: "conv-leader",
    leaderAgentId: "agent-lead",
    worker,
    title: "Tarea",
    task: "trabaja",
    projectId: null,
    depth: 0,
    runAgent,
  };

  it("rechaza team.assign cuando el plan ya agotó su presupuesto", async () => {
    const t1 = await teamTasksService.assignTask({ ...baseAssign, planId: "plan-x", stepIndex: 0 });
    usageTotals.current = new Map([
      [t1.workerConversationId, { inputTokens: 2_000_000, outputTokens: 0, totalTokens: 2_000_000, estimated: false }],
    ]);
    await expect(
      teamTasksService.assignTask({ ...baseAssign, planId: "plan-x", stepIndex: 1 }),
    ).rejects.toThrow(/Presupuesto del plan agotado/);
  });

  it("anota overBudget al cierre SIN reclasificar el status done", async () => {
    const t = await teamTasksService.assignTask({ ...baseAssign, budgetTokens: 10_000 });
    usageTotals.current = new Map([
      [t.workerConversationId, { inputTokens: 65_000, outputTokens: 6_829, totalTokens: 71_829, estimated: false }],
    ]);
    await registryState.started[0]?.onComplete?.("respuesta del worker", false);
    const stored = board.get(t.id ?? "");
    expect(stored?.status).toBe("done");
    const artifacts = stored?.artifacts as { tokens?: { overBudget?: boolean; totalTokens?: number } } | undefined;
    expect(artifacts?.tokens?.overBudget).toBe(true);
    expect(String(stored?.resultSummary)).toContain("[PRESUPUESTO EXCEDIDO: 71829 de 10000 tokens]");
  });

  it("una tarea dentro de presupuesto cierra sin nota", async () => {
    const t = await teamTasksService.assignTask({ ...baseAssign, budgetTokens: 100_000 });
    usageTotals.current = new Map([
      [t.workerConversationId, { inputTokens: 50_000, outputTokens: 5_000, totalTokens: 55_000, estimated: false }],
    ]);
    await registryState.started[0]?.onComplete?.("respuesta", false);
    const stored = board.get(t.id ?? "");
    expect(stored?.status).toBe("done");
    const artifacts = stored?.artifacts as { tokens?: { overBudget?: boolean } } | undefined;
    expect(artifacts?.tokens?.overBudget).toBeUndefined();
    expect(String(stored?.resultSummary)).not.toContain("PRESUPUESTO EXCEDIDO");
  });

  it("una diferida se cierra failed si el plan agotó presupuesto mientras esperaba cupo", async () => {
    // Llena el cupo de workers (ASSISTANT_MAX_WORKER_RUNS=4) con runs que no completan.
    for (let i = 0; i < 4; i++) await assign();
    const deferred = await teamTasksService.assignTask({ ...baseAssign, planId: "plan-y", stepIndex: 0 });
    expect(deferred.status).toBe("pending");
    // El plan agota su tope mientras la tarea espera en la FIFO.
    usageTotals.current = new Map([
      [deferred.workerConversationId, { inputTokens: 2_000_000, outputTokens: 0, totalTokens: 2_000_000, estimated: false }],
    ]);
    // Completar un run libera cupo → dispatchNext examina la diferida.
    await registryState.started[0]?.onComplete?.("hecho", false);
    await vi.waitFor(() => {
      const cur = board.get(deferred.id ?? "");
      expect(cur?.status).toBe("failed");
      expect(String(cur?.error)).toContain("Presupuesto del plan agotado antes de despachar");
    });
  });
});

describe("dispatchNext no filtra unhandledRejection (concurrencia)", () => {
  const baseAssign = {
    executor,
    leaderConversationId: "conv-leader",
    leaderAgentId: "agent-lead",
    worker,
    title: "Tarea",
    task: "trabaja",
    projectId: null,
    depth: 0,
    runAgent,
  };

  it("un throw del guard síncrono de dispatchNext queda capturado (no crashea el proceso)", async () => {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      // Llena el cupo (ASSISTANT_MAX_WORKER_RUNS=4) con runs que no completan →
      // la 5ª tarea queda diferida en la FIFO de dispatchNext.
      const running = [];
      for (let i = 0; i < 4; i++) running.push(await assign());
      const deferred = await teamTasksService.assignTask({ ...baseAssign });
      expect(deferred.status).toBe("pending");

      // El guard síncrono `hasWorkerSlot` de dispatchNext lanza al liberarse el
      // cupo (queda FUERA del try interno de dispatchNext) → la promesa se
      // rechaza. Sin el `.catch` en el call-site esto sería un unhandledRejection.
      vi.mocked(hasWorkerSlot).mockImplementationOnce(() => {
        throw new Error("boom en el guard de cupo");
      });

      // Completar un run libera cupo → finalizeTaskInner dispara void dispatchNext().
      await registryState.started[0]?.onComplete?.("hecho", false);
      // Un unhandledRejection se entrega de forma diferida (siguiente macrotask).
      await new Promise((r) => setTimeout(r, 20));

      expect(rejections).toHaveLength(0);
      // El cierre que liberó cupo NO se corrompe por el fallo del dispatch.
      expect(board.get(running[0].id ?? "")?.status).toBe("done");
      // La tarea diferida sigue pendiente (su despacho falló limpiamente).
      expect(board.get(deferred.id ?? "")?.status).toBe("pending");
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

it.each(["manual","auto",undefined])("voice workers inherit the conversation mode %s or configured plan mode", async mode => {
  leaderMeta.current = mode ? {approvalMode:mode} : null;
  const task = await teamTasksService.assignTask({
    executor,leaderConversationId:"conv-leader",leaderAgentId:"realtime:conv-leader",
    worker,title:"Revisar",task:"Solo revisar",projectId:null,depth:0,runAgent,
  });
  expect(patchedRuntime).toContainEqual([task.workerConversationId,{approvalMode:mode??"plan"}]);
});

it("does not close a worker or delete its recovery descriptor after a failed history write", async () => {
  const { conversationsRepository } = await import("../repositories/conversations.repository.js");
  const task = await assign();
  const run = registryState.started[0]!;
  run.onEvent?.({ type: "tool_use", id: "cli", name: "claude.cli", input: {} });
  const append = vi.spyOn(conversationsRepository, "appendMessages").mockRejectedValueOnce(new Error("history unavailable"));
  try {
    await expect(run.onComplete?.("Resultado parcial", false)).rejects.toThrow("history unavailable");
    expect(board.get(task.id ?? "")?.status).toBe("running");
    expect(cliJobsDeleted).not.toContain(task.workerConversationId);
  } finally { append.mockRestore(); }
});

it("fails a required verification when its working directory cannot be confirmed", async () => {
  const task = await assign();
  const current = board.get(task.id ?? "")!;
  current["verifyCommands"] = ["npm test"];
  delete current["isolation"];
  const { teamVerifyService } = await import("./team-verify.service.js");
  vi.mocked(teamVerifyService.run).mockClear();
  await registryState.started[0]?.onComplete?.("Hecho", false);
  expect(board.get(task.id ?? "")).toMatchObject({ status: "failed", verify: { state: "skipped" } });
  expect(teamVerifyService.run).not.toHaveBeenCalled();
});

it.each(["running", "queued"] as const)("does not close a newer worker continuation from an older settled event (%s)", async state => {
  const { runWithExecutor } = await import("../../../shared/executor/index.js");
  teamTasksService.init();
  const task = await assign();
  conversationMessages.get(task.workerConversationId)!.push({ role: "user", content: "Corrección pendiente", ts: "2026-10-17" });
  if (state === "running") registryState.isActive.mockImplementation(key => key === task.workerConversationId);
  else queuedTurns.push({ conversationId: task.workerConversationId, userText: "Corrección pendiente", auto: true });
  await runWithExecutor(executor, async () => {
    eventBus.emit(Events.AI_TURN_SETTLED, { conversationId: task.workerConversationId });
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(board.get(task.id ?? "")?.status).toBe("running");
  registryState.isActive.mockReturnValue(false);
  queuedTurns.length = 0;
  conversationMessages.get(task.workerConversationId)!.push({ role: "assistant", content: "Corrección verificada", ts: "2026-10-17" });
  await runWithExecutor(executor, async () => {
    eventBus.emit(Events.AI_TURN_SETTLED, { conversationId: task.workerConversationId });
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(board.get(task.id ?? "")).toMatchObject({ status: "done", resultSummary: "Corrección verificada" });
});

it("propagates an unconfirmed task close instead of accepting the worker's answer as success", async () => {
  const task = await assign();
  const { teamTasksRepository } = await import("../repositories/team-tasks.repository.js");
  const update = vi.spyOn(teamTasksRepository, "updateTask").mockRejectedValueOnce(new Error("task board unavailable"));
  try {
    await expect(registryState.started[0]?.onComplete?.("Respuesta guardada", false)).rejects.toThrow("task board unavailable");
    expect(board.get(task.id ?? "")?.status).toBe("running");
  } finally { update.mockRestore(); }
});
