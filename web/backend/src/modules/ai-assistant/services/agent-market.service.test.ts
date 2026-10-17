// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AssistantProject } from "../repositories/projects.repository.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

const state = vi.hoisted(() => ({
  agents: new Map<string, any>(), projects: [] as any[], roles: new Map<string, any>(),
  queue: [] as any[], tasks: [] as any[], jobs: [] as any[], metas: [] as any[],
  messages: new Map<string, any[]>(), handoffs: [] as any[], active: new Set<string>(),
  user: { userId: 7, role: "admin" } as any, target: { target: { id: "target-X" } } as any,
  waitTasks: undefined as undefined | (() => Promise<void>),
}));
vi.mock("../../../shared/executor/index.js", () => ({
  getContextExecutor: () => state.target, getContextUser: () => state.user, getContextUserId: () => state.user?.userId ?? null,
}));
vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    list: async () => [...state.agents.values()],
    get: async (id: string) => state.agents.get(id) ?? null,
    update: async (id: string, patch: any) => { const value = { ...state.agents.get(id), ...patch }; state.agents.set(id, value); return value; },
    setAssignments: async (id: string, assignments: any, projectIds: any) => { const value = { ...state.agents.get(id), assignments, projectIds }; state.agents.set(id, value); return value; },
    updateWithAssignments: async (id: string, patch: any, assignments: any, projectIds: any) => { const value = { ...state.agents.get(id), ...patch, assignments, projectIds }; state.agents.set(id, value); return value; },
  },
}));
vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: { list: async () => state.projects, get: async (_e: unknown, id: string) => state.projects.find(p => p.id === id) ?? null },
}));
vi.mock("../repositories/agent-roles.repository.js", () => ({ agentRolesRepository: { get: async (id: string) => state.roles.get(id) ?? null } }));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: {
  listPending: async () => state.queue,
  enqueue: async (_e: unknown, item: any) => { state.queue.push(item); return item; },
} }));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: { listActive: async () => { await state.waitTasks?.(); return state.tasks; } } }));
vi.mock("../repositories/cli-jobs.repository.js", () => ({ cliJobsRepository: { list: async () => state.jobs } }));
vi.mock("../repositories/agent-messages.repository.js", () => ({ agentMessagesRepository: { listPending: async () => state.handoffs } }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: {
  getMeta: async (_e: unknown, id: string) => state.metas.find(m => m.id === id) ?? null,
  listActivity: async () => state.metas,
  messages: async (_e: unknown, id: string) => ({ items: state.messages.get(id) ?? [] }),
} }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: { isActive: (id: string) => state.active.has(id) } }));
vi.mock("./permission-broker.js", () => ({ permissionBroker: { pendingCount: (id: string) => state.active.has("approval:" + id) ? 1 : 0 } }));
vi.mock("./tool-allowlist.js", () => ({ normalizeAllowedTools: (values: string[]) => ({ valid: values }) }));
vi.mock("./team-tools.js", () => ({ buildTeamTools: async () => null, TEAM_TOOL_WIRE_NAMES: {} }));
vi.mock("./agent-messages.service.js", () => ({ buildSendMessageTool: () => null, buildAgentMessagePromptBlock: () => "", SEND_MESSAGE_TOOL_WIRE_NAME: "" }));
vi.mock("./system-prompt/delegation-tools.js", () => ({ buildDelegateTool: () => null, buildSpawnChatsTool: () => null }));
vi.mock("../repositories/assistant-skills.repository.js", () => ({ assistantSkillsRepository: { load: async () => ({}) } }));
vi.mock("./assistant-skills.service.js", () => ({ assistantSkillsService: { resolveFromMap: () => ({ isEnabled: () => false, promptBlocks: () => "" }) } }));
vi.mock("../../../../shared/marketplace-link/index.js", () => ({}));
vi.mock("../../../shared/marketplace-link/index.js", () => ({ marketplaceLinkRepository: { getByProjectId: async () => null } }));
vi.mock("./graph-index.service.js", () => ({ graphIndexService: { probeAvailability: async () => ({ available: true, binPath: "/graph" }) } }));
vi.mock("./providers/cli/cli-sudo-askpass.js", () => ({ hasSudoCredential: async () => false }));
vi.mock("./system-prompt/blocks.js", () => ({
  BASE_SYSTEM_PROMPT: "BASE", PROJECT_LEAF_INSTRUCTIONS_MAX: 9999, PROJECT_ANCESTOR_INSTRUCTIONS_MAX: 9999,
  buildCliModeBlock: () => "CLI", buildGraphPromptBlock: (graphs: any[]) => JSON.stringify(graphs),
  buildAssociatedServersBlock: (servers: any[]) => JSON.stringify(servers),
  collectGraphProjects: (projects: any[]) => projects.filter(p => p.graphIndex?.status === "ready").map(p => ({ name: p.graphIndex.project, path: p.path })),
  collectSystemContext: async () => "", capText: (s: string) => s,
}));

import { agentMarketService } from "./agent-market.service.js";
import { resolveAgentContext, admitAgentWork, effectiveAssignment, resolveConversationBinding, scopedAgents } from "./agent-context.service.js";
import { agentAssignments } from "../models/assistant-agent.types.js";
import { hasAssignmentAdmission } from "./agent-assignment-lock.js";
import { enqueueAgentTurn } from "./queued-turn-admission.js";
import { graphScopeService } from "./graph-scope.service.js";
import { buildSystemPrompt } from "./system-prompt/build.js";

const executor = state.target as Executor;
const user = state.user as SessionUser;
function profile(over: Partial<AssistantAgent> = {}): AssistantAgent {
  return { id: "a", ownerId: 7, name: "Mateo", description: "", systemPrompt: "PERSONA", providerId: "claude", model: "", allowedTools: null, projectIds: ["X", "Y"], ...over };
}
function project(id: string, over: Partial<AssistantProject> = {}): AssistantProject {
  return { id, ownerId: 7, title: id, path: "/" + id, icon: "folder", instructions: "CONTEXT_" + id, provider: "claude",
    servers: [{ id: "server-" + id, name: "server-" + id }], graphIndex: { enabled: true, status: "ready", project: "graph-" + id }, ...over };
}
beforeEach(() => {
  state.agents.clear(); state.roles.clear(); state.messages.clear(); state.active.clear();
  for (const name of ["queue", "tasks", "jobs", "metas", "handoffs", "projects"] as const) state[name].length = 0;
  state.projects.push(project("X"), project("Y"), project("child", { parentId: "X", path: "/X/child" }));
  state.agents.set("a", profile()); state.waitTasks = undefined;
  state.user = { userId: 7, role: "admin" }; state.target = executor;
});

describe("profile and project assignment contract", () => {
  it("edits one shared persona across X/Y without duplicating the id", async () => {
    await agentMarketService.updateProfile(executor, "a", { name: "Nuevo", specialty: "API", technologies: ["TS"] }, user);
    expect((await resolveAgentContext(executor, "a", "X", user)).agent?.name).toBe("Nuevo");
    expect((await resolveAgentContext(executor, "a", "Y", user)).agent?.name).toBe("Nuevo");
    expect(state.agents.size).toBe(1);
  });
  it("editing X leaves Y virtual and does not change its instructions", async () => {
    await agentMarketService.put(executor, "a", "X", { jobTitle: "Backend X", instructions: "SOLO_X" }, user);
    expect((await resolveAgentContext(executor, "a", "X", user)).agent?.systemPrompt).toContain("SOLO_X");
    expect((await resolveAgentContext(executor, "a", "Y", user)).agent?.systemPrompt).toBe("PERSONA");
    expect(agentAssignments(state.agents.get("a")).find(a => a.projectId === "Y")?.source).toBe("legacy");
  });
  it("adapts legacy projectIds without writing or dropping ids", async () => {
    const before = JSON.stringify(state.agents.get("a"));
    const result = await agentMarketService.assignments(executor, "a", "X", user);
    expect(result.assignments).toHaveLength(2); expect(result.effective?.source).toBe("legacy");
    expect(JSON.stringify(state.agents.get("a"))).toBe(before);
  });
  it("requires a project for a multiproject agent", async () => {
    await expect(resolveAgentContext(executor, "a", null, user)).rejects.toMatchObject({ statusCode: 400, code: "ASSISTANT_PROJECT_REQUIRED" });
  });
  it("resolves only a unique assignment", async () => {
    state.agents.set("a", profile({ projectIds: ["X"] }));
    expect((await resolveAgentContext(executor, "a", null, user)).projectId).toBe("X");
  });
  it("preserves genuinely unassigned chats", async () => {
    state.agents.set("a", profile({ projectIds: [] }));
    expect((await resolveAgentContext(executor, "a", null, user)).projectId).toBeNull();
  });
  it("never executes unknown profiles without their restrictions", async () => {
    await expect(resolveAgentContext(executor, "missing", null, user)).rejects.toMatchObject({ code: "ASSISTANT_AGENT_NOT_FOUND" });
  });
  it("rejects another user's project even for an admin", async () => {
    state.projects.find(p => p.id === "Y").ownerId = 99;
    await expect(agentMarketService.put(executor, "a", "Y", {}, user)).rejects.toMatchObject({ statusCode: 403 });
    await expect(resolveAgentContext(executor, "a", "Y", user)).rejects.toMatchObject({ statusCode: 403 });
    expect((await agentMarketService.present(executor, state.agents.get("a"), user)).assignments.map(a => a.projectId)).toEqual(["X"]);
  });
  it("rejects another user's profile mutations", async () => {
    state.agents.get("a").ownerId = 99;
    await expect(agentMarketService.put(executor, "a", "X", {}, user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("incorporation and reincorporation keep a single link", async () => {
    state.agents.set("a", profile({ projectIds: [] }));
    await agentMarketService.put(executor, "a", "X", { instructions: "X" }, user);
    const before = JSON.stringify(state.agents.get("a"));
    await agentMarketService.put(executor, "a", "X", { instructions: "X" }, user);
    expect(JSON.stringify(state.agents.get("a"))).toBe(before);
    await agentMarketService.remove(executor, "a", "X", user);
    await agentMarketService.put(executor, "a", "X", {}, user);
    expect(agentAssignments(state.agents.get("a"))).toHaveLength(1);
  });
  it("withdrawal keeps history and blocks subsequent runs", async () => {
    state.metas.push({ id: "history", agentId: "a", projectId: "X" });
    state.messages.set("history", [{ role: "assistant", content: "Finished" }]);
    await agentMarketService.remove(executor, "a", "X", user);
    await agentMarketService.remove(executor, "a", "X", user);
    expect(state.messages.get("history")).toHaveLength(1);
    await expect(resolveAgentContext(executor, "a", "X", user)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_REMOVED" });
    await agentMarketService.put(executor, "a", "X", {}, user);
    expect((await resolveAgentContext(executor, "a", "X", user)).projectId).toBe("X");
    expect(state.messages.get("history")).toHaveLength(1);
  });
  it("a fully withdrawn profile does not become a loose agent", async () => {
    state.agents.set("a", profile({ projectIds: ["X"] }));
    await agentMarketService.remove(executor, "a", "X", user);
    await expect(resolveAgentContext(executor, "a", null, user)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_REMOVED" });
  });
  it("legacy projectIds cannot bypass withdrawal busy checks or authorize foreign additions", async () => {
    state.queue.push({ agentId: "a", projectId: "X" });
    await expect(agentMarketService.updateProfile(executor, "a", { projectIds: ["Y"] }, user)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_BUSY" });
    expect(state.agents.get("a").projectIds).toEqual(["X","Y"]);
    state.projects.find(p => p.id === "Y").ownerId = 99;
    await expect(agentMarketService.updateProfile(executor, "a", { projectIds: ["Y"] }, user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("inherits a root assignment in its child and rejects hidden exclusions", async () => {
    const a = state.agents.get("a");
    expect(effectiveAssignment(a, state.projects, "child")?.inheritedFrom).toBe("X");
    await expect(agentMarketService.remove(executor, "a", "child", user)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_INHERITED" });
    await agentMarketService.put(executor, "a", "child", { instructions: "CHILD" }, user);
    expect((await resolveAgentContext(executor, "a", "child", user)).agent?.systemPrompt).toContain("CHILD");
    expect((await resolveAgentContext(executor, "a", "X", user)).agent?.systemPrompt).not.toContain("CHILD");
  });
  it("never grants a sibling or an unrelated root from a child link", async () => {
    state.agents.set("a", profile({ projectIds: ["child"] }));
    await expect(resolveAgentContext(executor, "a", "X", user)).rejects.toMatchObject({ statusCode: 403 });
    await expect(resolveAgentContext(executor, "a", "Y", user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("rejects cycles and an unauthorized ancestor", async () => {
    state.projects.find(p => p.id === "X").parentId = "child";
    await expect(resolveAgentContext(executor, "a", "child", user)).rejects.toMatchObject({ statusCode: 403 });
    state.projects.find(p => p.id === "X").parentId = null;
    state.projects.find(p => p.id === "X").ownerId = 99;
    await expect(resolveAgentContext(executor, "a", "child", user)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("admission, retirement and durable activity", () => {
  it.each(["pending", "running"])("blocks a %s task", async status => {
    state.tasks.push({ workerAgentId: "a", projectId: "X", status });
    await expect(agentMarketService.remove(executor, "a", "X", user)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_BUSY" });
  });
  it.each(["run", "approval", "ask", "job", "queue", "message"])("blocks %s while preserving the assignment", async kind => {
    state.metas.push({ id: "chat", agentId: "a", projectId: "X" });
    if (kind === "run") state.active.add("chat");
    if (kind === "approval") state.active.add("approval:chat");
    if (kind === "ask") state.messages.set("chat", [{ role: "assistant", ask: [{ id: "q" }] }]);
    if (kind === "job") state.jobs.push({ conversationId: "chat" });
    if (kind === "queue") state.queue.push({ agentId: "a", projectId: "X" });
    if (kind === "message") state.handoffs.push({ toAgentId: "a", projectId: "X", status: "pending" });
    await expect(agentMarketService.remove(executor, "a", "X", user)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_BUSY" });
    expect(state.agents.get("a").projectIds).toContain("X");
  });
  it("an admitted run wins the race; removal returns 409", async () => {
    const admission = await admitAgentWork(executor, "a", "X", user);
    try {
      await expect(agentMarketService.remove(executor, "a", "X", user)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_BUSY" });
      expect(hasAssignmentAdmission({ target: { id: "target-Y" } } as Executor, "a", new Set(["X"]))).toBe(false);
    } finally { admission.release(); }
    await agentMarketService.remove(executor, "a", "X", user);
  });
  it("removal wins the race; a waiting admission revalidates and refuses", async () => {
    let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>(r => { release = r; });
    const started = new Promise<void>(r => { entered = r; });
    state.waitTasks = async () => { entered(); await blocked; };
    const removal = agentMarketService.remove(executor, "a", "X", user);
    await started;
    const run = admitAgentWork(executor, "a", "X", user);
    const rejected = expect(run).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_REMOVED" });
    release(); await removal; await rejected;
  });
  it("revalidates before enqueue and never queues a withdrawn assignment", async () => {
    state.metas.push({ id: "chat", agentId: "a", projectId: "X", messageCount: 2 });
    await agentMarketService.remove(executor, "a", "X", user);
    await expect(enqueueAgentTurn(executor, { conversationId: "chat", userText: "go", withContext: true, user })).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_REMOVED" });
    expect(state.queue).toHaveLength(0);
  });
  it("pins chat identity instead of carrying X history into Y", async () => {
    state.metas.push({ id: "chat", agentId: "a", projectId: "X", messageCount: 2 });
    await expect(resolveConversationBinding(executor, { conversationId: "chat", projectId: "Y" }, user)).rejects.toMatchObject({ code: "ASSISTANT_CONTEXT_MISMATCH" });
    expect((await resolveConversationBinding(executor, { conversationId: "chat" }, user)).projectId).toBe("X");
  });
});

describe("effective runtime scope", () => {
  it("X paths, servers and graphs exclude Y even with broad legacy resources", async () => {
    state.agents.set("a", profile({ projectPaths: ["/"], servers: [{ id: "server-X", name: "X" }, { id: "server-Y", name: "Y" }] }));
    const context = await resolveAgentContext(executor, "a", "X", user);
    expect(context.agent?.projectPaths).toEqual(["/X","/X/child"]);
    expect(context.agent?.servers?.map(s => s.id)).toEqual(["server-X"]);
    expect(context.agent?.graphProjectIds).toEqual(["X","child"]);
  });
  it("assignment tools, roles and spawn permissions only narrow the profile", async () => {
    state.agents.set("a", profile({ roleId: "base", allowedTools: ["files.read","files.write"], canSpawnChats: false }));
    state.roles.set("base", { id: "base", name: "base", systemPrompt: "base", allowedTools: ["files.read"], canSpawnChats: false });
    state.roles.set("local", { id: "local", ownerId: 7, name: "local", systemPrompt: "local", allowedTools: ["files.read","admin.bash"], canSpawnChats: true });
    await agentMarketService.put(executor, "a", "X", { allowedTools: ["files.read","admin.bash"], roleId: "local", canSpawnChats: true }, user);
    const context = await resolveAgentContext(executor, "a", "X", user);
    expect(context.agent?.allowedTools).toEqual(["files.read"]);
    expect(context.role?.allowedTools).toEqual(["files.read"]);
    expect(context.agent?.canSpawnChats).toBe(false); expect(context.role?.canSpawnChats).toBe(false);
  });
  it("explicit empty resource lists stay empty", async () => {
    await agentMarketService.put(executor, "a", "X", { projectPaths: [], serverIds: [], graphProjectIds: [], allowedTools: [] }, user);
    const { agent } = await resolveAgentContext(executor, "a", "X", user);
    expect(agent?.projectPaths).toEqual([]); expect(agent?.servers).toEqual([]);
    expect(agent?.graphProjectIds).toEqual([]); expect(agent?.allowedTools).toEqual([]);
  });
  it("filters a team roster by active project and owner", async () => {
    state.agents.set("other", profile({ id: "other", projectIds: ["Y"] }));
    const roster = await scopedAgents(executor, [...state.agents.values()], "X", user);
    expect(roster.map(a => a.id)).toEqual(["a"]);
  });
  it("actual prompt contains X instructions/servers/graphs and no Y", async () => {
    const context = await resolveAgentContext(executor, "a", "X", user);
    const built = await buildSystemPrompt({
      executor, user, userId: "7", config: { approval: { mode: "manual" } },
      provider: { id: "claude", mode: "api" }, tools: [{ name: "codebase-graph.search" }],
      agent: context.agent, role: context.role, projectId: "X", context, withContext: false, delegationDepth: 3,
      runAgent: async function* () {},
    } as never);
    expect(built.systemPrompt).toContain("CONTEXT_X");
    expect(built.systemPrompt).toContain("server-X");
    expect(built.systemPrompt).not.toContain("CONTEXT_Y"); expect(built.systemPrompt).not.toContain("server-Y");
    expect(built.systemPrompt).not.toContain("graph-Y"); expect(built.jailPaths).not.toContain("/Y");
  });
  it("graph authority is target/project scoped and revalidates without stale grants", async () => {
    state.metas.push({ id: "chat", agentId: "a", projectId: "X" });
    expect((await graphScopeService.resolve(executor, "chat")).projects.map(p => p.graphName)).toEqual(["graph-X", "graph-child"]);
    await agentMarketService.remove(executor, "a", "X", user);
    expect((await graphScopeService.resolve(executor, "chat")).projects).toEqual([]);
  });
});
