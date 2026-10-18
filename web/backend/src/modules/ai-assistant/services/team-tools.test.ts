import { decodeCoordination } from "../models/agent-envelope.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import type { TeamTask } from "../models/team-task.types.js";

const svc = vi.hoisted(() => ({
  assignTask: vi.fn(),
  listForLeaderConversation: vi.fn(),
  waitForTasks: vi.fn(),
  markCollected: vi.fn(async () => undefined),
}));
vi.mock("./team-tasks.service.js", () => ({
  teamTasksService: svc,
  validateWorkerProject: vi.fn(async (_e: unknown, _w: unknown, want: string) => {
    if (!want) return null;
    if (want === "proj-ok") return "proj-ok";
    throw new Error(`El proyecto "${want}" no pertenece al agente.`);
  }),
}));
vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: { list: vi.fn(async () => [{ id: "proj-ok", title: "LUXIPANEL" }]) },
}));

const repoMocks = vi.hoisted(() => ({
  convMeta: vi.fn(),
  agentGet: vi.fn(),
  agentList: vi.fn(),
  rolesList: vi.fn(),
}));
vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: { getMeta: repoMocks.convMeta },
}));
vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: { get: repoMocks.agentGet, list: repoMocks.agentList },
}));
vi.mock("../repositories/agent-roles.repository.js", () => ({
  agentRolesRepository: { list: repoMocks.rolesList, get: async (id: string) => (await repoMocks.rolesList())?.find((r: { id: string }) => r.id === id) ?? null },
}));

vi.mock("../../../shared/executor/index.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, getContextUser: () => ({ userId: 7, role: "admin" }), getContextUserId: () => 7,
    getContextExecutor: () => ({ target: { id: "target" } }) };
});

import { buildTeamTools, buildTeamToolsForConversation, TEAM_TOOL_WIRE_NAMES } from "./team-tools.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";

const executor = { target: { id: "target" } } as Executor;

const leader: AssistantAgent = {
  id: "lead-1",
  name: "Líder",
  projectIds: ["proj-ok"],
  description: "coordina",
  systemPrompt: "",
  providerId: "claude",
  model: "",
  allowedTools: null,
  canSpawnChats: true,
};
const workerA: AssistantAgent = {
  id: "w-a",
  name: "Backend",
  description: "APIs y datos",
  systemPrompt: "",
  providerId: "claude",
  model: "",
  allowedTools: ["files.read", "bash.exec"],
  parentAgentId: "lead-1",
  roleId: "r-1",
  projectIds: ["proj-ok"],
};
const workerB: AssistantAgent = {
  id: "w-b",
  name: "Frontend",
  projectIds: ["proj-ok"],
  description: "UI",
  systemPrompt: "",
  providerId: "gemini",
  model: "gemini-2.5-pro",
  allowedTools: null,
  parentAgentId: "lead-1",
};
const stranger: AssistantAgent = {
  id: "x-1",
  name: "Otro",
  description: "",
  systemPrompt: "",
  providerId: "claude",
  model: "",
  allowedTools: null,
};

function task(id: string, status: TeamTask["status"], over: Partial<TeamTask> = {}): TeamTask {
  return {
    id,
    leaderConversationId: "conv-leader",
    leaderAgentId: "lead-1",
    workerAgentId: "w-a",
    workerAgentName: "Backend",
    workerConversationId: `conv-${id}`,
    title: `T ${id}`,
    task: "trabajo",
    status,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

async function build() {
  const built = await buildTeamTools({
    agent: leader,
    allAgents: [leader, workerA, workerB, stranger],
    roles: [{ id: "r-1", name: "Ingeniero Backend", description: "", systemPrompt: "", allowedTools: null }],
    executor,
    user: undefined,
    userId: undefined,
    depth: 0,
    maxDepth: 3,
    conversationId: "conv-leader",
    signal: undefined,
    runAgent: () => (async function* () { /* never used */ })() as never,
  });
  expect(built).not.toBeNull();
  return built!;
}

beforeEach(() => {
  vi.clearAllMocks();
  repoMocks.convMeta.mockResolvedValue({ id: "conv-leader", projectId: "proj-ok" });
  repoMocks.agentGet.mockImplementation(async (id: string) => [leader, workerA, workerB, stranger].find(a => a.id === id) ?? null);
  repoMocks.rolesList.mockResolvedValue([{ id: "r-1", name: "Ingeniero Backend", description: "", systemPrompt: "", allowedTools: null }]);
});

describe("buildTeamTools", () => {
  it("returns null when the agent has no subordinates", async () => {
    const built = await buildTeamTools({
      agent: stranger,
      allAgents: [leader, workerA, stranger],
      roles: [],
      executor,
      user: undefined,
      userId: undefined,
      depth: 0,
      maxDepth: 3,
      conversationId: "conv-x",
      signal: undefined,
      runAgent: () => (async function* () { /* never used */ })() as never,
    });
    expect(built).toBeNull();
  });

  it("exposes the 6 tools and an enriched roster + protocol block", async () => {
    const { tools, promptBlock } = await build();
    expect(tools.map((t) => t.name).sort()).toEqual(["team.assign", "team.collect", "team.integrate", "team.note", "team.plan", "team.status"]);
    // Roster is enriched: role name, provider/model, tools, project titles.
    expect(promptBlock).toContain("Ingeniero Backend");
    expect(promptBlock).toContain("claude/default");
    expect(promptBlock).toContain("gemini/gemini-2.5-pro");
    expect(promptBlock).toContain("files.read, bash.exec");
    expect(promptBlock).toContain("LUXIPANEL");
    expect(promptBlock).toContain("Protocolo de coordinación de equipo");
  });
});

describe("team.assign", () => {
  it("rejects a target that is not a direct subordinate", async () => {
    const { tools } = await build();
    const assign = tools.find((t) => t.name === "team.assign")!;
    const res = await assign.handler({ agentId: "x-1", task: "algo" });
    expect(res.ok).toBe(false);
    expect(svc.assignTask).not.toHaveBeenCalled();
  });

  it("rejects a project outside the worker's closure", async () => {
    const { tools } = await build();
    const assign = tools.find((t) => t.name === "team.assign")!;
    const res = await assign.handler({ agentId: "w-a", task: "algo", projectId: "proj-ajeno" });
    expect(res.ok).toBe(false);
    expect(String(res.output)).toContain("proyecto activo");
    expect(svc.assignTask).not.toHaveBeenCalled();
  });

  it("assigns and returns taskId + conversationId", async () => {
    svc.assignTask.mockResolvedValue(task("t1", "running"));
    const { tools } = await build();
    const assign = tools.find((t) => t.name === "team.assign")!;
    const res = await assign.handler({ agentId: "w-a", task: "arregla el endpoint", title: "Fix endpoint", projectId: "proj-ok" });
    expect(res.ok).toBe(true);
    expect((res.output as { taskId: string }).taskId).toBe("t1");
    expect(svc.assignTask).toHaveBeenCalledWith(
      expect.objectContaining({
        leaderConversationId: "conv-leader",
        title: "Fix endpoint",
        projectId: "proj-ok",
      }),
    );
  });
});

describe("team.collect", () => {
  it("reports 'nothing to collect' on an empty board", async () => {
    svc.listForLeaderConversation.mockResolvedValue([]);
    const { tools } = await build();
    const collect = tools.find((t) => t.name === "team.collect")!;
    const res = await collect.handler({});
    expect(res.ok).toBe(true);
    expect(String(res.output)).toContain("No hay tareas");
  });

  it("collects finished tasks, marks them collected, and lists pending on timeout", async () => {
    const done = task("t1", "done", { resultSummary: "hecho A" });
    const running = task("t2", "running");
    svc.listForLeaderConversation.mockResolvedValue([done, running]);
    svc.waitForTasks.mockResolvedValue({ tasks: [done, running], timedOut: true });
    const { tools } = await build();
    const collect = tools.find((t) => t.name === "team.collect")!;
    const res = await collect.handler({ waitSeconds: 0 });
    expect(res.ok).toBe(true);
    const out = (typeof res.output === "string" ? decodeCoordination(res.output) : res.output) as { results: Array<{ taskId?: string; result?: string }>; pending: unknown[]; note: string };
    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.result).toBe("hecho A");
    expect(out.pending).toHaveLength(1);
    expect(out.note).toContain("despertado automáticamente");
    expect(svc.markCollected).toHaveBeenCalledWith(executor, ["t1"]);
  });

  it("un taskId INEXISTENTE devuelve error explícito con snapshot del tablero (no 'nada pendiente')", async () => {
    // Incidente 2026-07-20: el líder transcribió mal un uuid y el "No hay
    // tareas pendientes" le hizo creer que la tarea ya estaba entregada.
    const real = task("18d9f468-f7be", "running");
    svc.listForLeaderConversation.mockResolvedValue([real]);
    const { tools } = await build();
    const collect = tools.find((t) => t.name === "team.collect")!;
    const res = await collect.handler({ taskIds: ["18d9f468-f7f2"] });
    expect(res.ok).toBe(false);
    const out = (typeof res.output === "string" ? decodeCoordination(res.output) : res.output) as { error: string; board: Array<{ taskId?: string; status?: string }> };
    expect(out.error).toContain("18d9f468-f7f2");
    expect(out.error).toContain("desconocidos");
    expect(out.board.some((b) => b.taskId === "18d9f468-f7be")).toBe(true);
    expect(svc.waitForTasks).not.toHaveBeenCalled();
  });

  it("recogida PARCIAL: ids válidos se entregan y los desconocidos se señalan", async () => {
    const done = task("t-ok", "done", { resultSummary: "hecho" });
    svc.listForLeaderConversation.mockResolvedValue([done]);
    svc.waitForTasks.mockResolvedValue({ tasks: [done], timedOut: false });
    const { tools } = await build();
    const collect = tools.find((t) => t.name === "team.collect")!;
    const res = await collect.handler({ taskIds: ["t-ok", "t-typo"] });
    expect(res.ok).toBe(true);
    const out = (typeof res.output === "string" ? decodeCoordination(res.output) : res.output) as { results: unknown[]; unknownTaskIds?: string[]; unknownNote?: string };
    expect(out.results).toHaveLength(1);
    expect(out.unknownTaskIds).toEqual(["t-typo"]);
    expect(out.unknownNote).toContain("no existen");
  });

  it("los resultados llevan planId y assignedAt para distinguir tareas de planes viejos", async () => {
    const old = task("t-old", "done", { resultSummary: "viejo", planId: "plan-antiguo" });
    svc.listForLeaderConversation.mockResolvedValue([old]);
    svc.waitForTasks.mockResolvedValue({ tasks: [old], timedOut: false });
    const { tools } = await build();
    const collect = tools.find((t) => t.name === "team.collect")!;
    const res = await collect.handler({});
    const out = (typeof res.output === "string" ? decodeCoordination(res.output) : res.output) as { results: Array<{ planId?: string; assignedAt?: string }> };
    expect(out.results[0]?.planId).toBe("plan-antiguo");
    expect(out.results[0]?.assignedAt).toBeTruthy();
  });

  it("caps the TOTAL payload across many finished tasks (budget)", async () => {
    const big = "y".repeat(4000);
    const tasks = Array.from({ length: 6 }, (_, i) => task(`t${i}`, "done", { resultSummary: big }));
    svc.listForLeaderConversation.mockResolvedValue(tasks);
    svc.waitForTasks.mockResolvedValue({ tasks, timedOut: false });
    const { tools } = await build();
    const collect = tools.find((t) => t.name === "team.collect")!;
    const res = await collect.handler({});
    const out = (typeof res.output === "string" ? decodeCoordination(res.output) : res.output) as { results: Array<{ result?: string; error?: string; detail?: { required: boolean; conversationId: string } }> };
    const total = out.results.reduce((n, r) => n + (r.result ?? r.error ?? "").length, 0);
    // 6 × 4000 = 24000 raw → capped near 16000 (+ truncation markers).
    expect(total).toBeLessThan(17_000);
    expect(out.results.every(r => (r.result ?? "").length <= 240 && r.detail?.required === true)).toBe(true);
  });

  it("collects compact structured findings and keeps blocked verification distinct from success", async () => {
    const packet = { kind: "result", summary: "Cambio preparado; falta desplegar.", data: { deployed: false, tests: ["unit passed"] }, refs: ["report.txt"] };
    const done = task("json-result", "done", { resultSummary: JSON.stringify(packet), verify: { state: "failed", attempts: 1 } as never });
    svc.listForLeaderConversation.mockResolvedValue([done]);
    svc.waitForTasks.mockResolvedValue({ tasks: [done], timedOut: false });
    const { tools } = await build();
    const response = await tools.find(t => t.name === "team.collect")!.handler({});
    expect(decodeCoordination(String(response.output))).toMatchObject({ protocol: "lxp.agent.v1", results: [{ data: packet.data, refs: packet.refs, detail: { required: false }, verify: "failed (intentos: 1)" }] });
  });
});

describe("buildTeamToolsForConversation (per-run cross MCP channel / CLI leaders)", () => {
  it("resolves the toolkit for a conversation bound to a leader agent", async () => {
    repoMocks.convMeta.mockResolvedValue({ id: "conv-leader", agentId: "lead-1" });
    repoMocks.agentList.mockResolvedValue([leader, workerA, workerB]);
    const built = await buildTeamToolsForConversation({
      executor,
      user: undefined,
      userId: undefined,
      conversationId: "conv-leader",
      runAgent: () => (async function* () { /* never used */ })() as never,
      maxCollectWaitS: 240,
    });
    expect(built).not.toBeNull();
    expect(built!.tools.map((t) => t.name).sort()).toEqual(["team.assign", "team.collect", "team.integrate", "team.note", "team.plan", "team.status"]);
  });

  it("returns null for loose/non-leader chats and rejects missing bound agents", async () => {
    const base = {
      executor,
      user: undefined,
      userId: undefined,
      conversationId: "conv-x",
      runAgent: () => (async function* () { /* never used */ })() as never,
    };
    // Loose chat (no bound agent).
    repoMocks.convMeta.mockResolvedValue({ id: "conv-x", agentId: null });
    expect(await buildTeamToolsForConversation(base)).toBeNull();
    // Bound agent without supervisor permission.
    repoMocks.convMeta.mockResolvedValue({ id: "conv-x", agentId: "w-a" });
    repoMocks.agentList.mockResolvedValue([leader, workerA]);
    repoMocks.rolesList.mockResolvedValue([{ id: "r-1", name: "Ingeniero Backend", systemPrompt: "", allowedTools: null }]);
    expect(await buildTeamToolsForConversation(base)).toBeNull();
    // Deleted agent.
    repoMocks.agentGet.mockResolvedValue(null);
    await expect(buildTeamToolsForConversation(base)).rejects.toMatchObject({ code: "ASSISTANT_AGENT_NOT_FOUND" });
  });

  it("renders the CLI prompt block with the MCP wire names", async () => {
    const built = await buildTeamTools({
      agent: leader,
      allAgents: [leader, workerA],
      roles: [],
      executor,
      user: undefined,
      userId: undefined,
      depth: 0,
      maxDepth: 3,
      conversationId: "conv-leader",
      signal: undefined,
      runAgent: () => (async function* () { /* never used */ })() as never,
      promptToolNames: TEAM_TOOL_WIRE_NAMES,
      cliPrompt: true,
    });
    expect(built).not.toBeNull();
    expect(built!.promptBlock).toContain("mcp__luxipanel-servers__team__assign");
    expect(built!.promptBlock).toContain("mcp__luxipanel-servers__team__collect");
    // CLI variant omits the API-only notes about agents.delegate/chats.create.
    expect(built!.promptBlock).not.toContain("agents.delegate");
    expect(built!.promptBlock).not.toContain("chats.create");
  });
});

describe("team.status", () => {
  it("returns a compact snapshot with elapsed and permission flags", async () => {
    svc.listForLeaderConversation.mockResolvedValue([
      task("t1", "running", { pendingPermission: true, startedAt: new Date(Date.now() - 60_000).toISOString() }),
    ]);
    const { tools } = await build();
    const status = tools.find((t) => t.name === "team.status")!;
    const res = await status.handler({});
    expect(res.ok).toBe(true);
    const rows = res.output as Array<{ status: string; pendingPermission?: boolean; elapsedSeconds: number }>;
    expect(rows[0]?.status).toContain("esperando aprobación");
    expect(rows[0]?.pendingPermission).toBe(true);
    expect(rows[0]?.elapsedSeconds).toBeGreaterThanOrEqual(59);
  });
});
