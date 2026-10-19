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
vi.mock("../repositories/agent-activity.repository.js", () => ({ agentActivityRepository: {
  forAssignment: async (_e: unknown, agentId: string, projects: Set<string>) => state.metas
    .filter(m => m.agentId === agentId && (!m.projectId || projects.has(m.projectId)))
    .map(m => ({ conversationId: m.id, pendingQuestion: !!state.messages.get(m.id)?.at(-1)?.ask?.length,
      pendingCliJob: state.jobs.some(j => j.conversationId === m.id) })),
} }));
vi.mock("../repositories/agent-messages.repository.js", () => ({ agentMessagesRepository: { listPending: async () => state.handoffs } }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: {
  getMeta: async (_e: unknown, id: string) => state.metas.find(m => m.id === id) ?? null,
  listActivity: async () => state.metas,
  messages: async (_e: unknown, id: string) => ({ items: state.messages.get(id) ?? [] }),
} }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: { isActive: (id: string) => state.active.has(id) } }));
vi.mock("./permission-broker.js", () => ({ permissionBroker: { pendingCount: (id: string) => state.active.has("approval:" + id) ? 1 : 0 } }));
// Exercise the real alias normalizer against a populated capability catalog.
vi.mock("../../../shared/agent-capability/index.js", () => {
  const names = ["files.read", "files.write", "files.list_dir", "files.grep", "admin.bash"];
  return { agentCapabilityRegistry: {
    list: () => [{ tools: names.map(name => ({ name })) }],
    findTool: (name: string) => names.includes(name) ? { tool: { name } } : undefined,
  } };
});
vi.mock("./project-document.service.js", () => ({ projectDocumentService: {
  prompt: async (_executor: Executor, project: AssistantProject) => `${project.instructions}\nDOCUMENT_${project.id}`,
} }));
vi.mock("./team-tools.js", () => ({ buildTeamTools: async () => null, TEAM_TOOL_WIRE_NAMES: {} }));
vi.mock("./agent-messages.service.js", () => ({ buildSendMessageTool: () => null, buildAgentMessagePromptBlock: () => "", SEND_MESSAGE_TOOL_WIRE_NAME: "" }));
vi.mock("./system-prompt/delegation-tools.js", () => ({ buildDelegateTool: () => null, buildSpawnChatsTool: () => null }));
vi.mock("../repositories/assistant-skills.repository.js", () => ({ assistantSkillsRepository: { load: async () => ({}) } }));
vi.mock("./assistant-skills.service.js", () => ({ assistantSkillsService: { resolveFromMap: () => ({ isEnabled: () => false, promptBlocks: () => "" }) } }));
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
import * as agentContext from "./agent-context.service.js";
import { resolveAgentContext, admitAgentWork, effectiveAssignment, resolveConversationBinding, scopedAgents } from "./agent-context.service.js";
import { agentAssignments } from "../models/assistant-agent.types.js";
import { agentRolesRepository } from "../repositories/agent-roles.repository.js";
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
    expect(built.systemPrompt).toContain("DOCUMENT_X");
    expect(built.systemPrompt).not.toContain("DOCUMENT_Y");
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

describe("assignment hierarchy and access validation", () => {
  it("changes the superior in X while keeping the hierarchy in Y", async () => {
    state.agents.get("a").parentAgentId = "leader-Y";
    state.agents.set("leader-Y", profile({ id: "leader-Y", projectIds: ["Y"] }));
    state.agents.set("leader-X", profile({ id: "leader-X", projectIds: ["X"] }));
    await agentMarketService.put(executor, "a", "X", { parentAgentId: "leader-X", connections: [] }, user);
    expect((await resolveAgentContext(executor, "a", "X", user)).agent?.parentAgentId).toBe("leader-X");
    expect((await resolveAgentContext(executor, "a", "Y", user)).agent?.parentAgentId).toBe("leader-Y");
  });
  it("rejects references to another root and hierarchy cycles", async () => {
    state.agents.set("only-Y", profile({ id: "only-Y", projectIds: ["Y"] }));
    await expect(agentMarketService.put(executor, "a", "X", { connections: ["only-Y"] }, user)).rejects.toMatchObject({ statusCode: 403 });
    state.agents.set("cyclic", profile({ id: "cyclic", projectIds: ["X"], parentAgentId: "a" }));
    await expect(agentMarketService.put(executor, "a", "X", { parentAgentId: "cyclic" }, user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("rejects graph/server references outside the active root", async () => {
    await expect(agentMarketService.put(executor, "a", "X", { graphProjectIds: ["Y"] }, user)).rejects.toMatchObject({ statusCode: 403 });
    await expect(agentMarketService.put(executor, "a", "X", { serverIds: ["server-Y"] }, user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("does not reveal or incorporate a child under an unauthorized root", async () => {
    state.projects.find(p => p.id === "X").ownerId = 99;
    await expect(agentMarketService.put(executor, "a", "child", {}, user)).rejects.toMatchObject({ statusCode: 403 });
    await expect(agentMarketService.assignments(executor, "a", "child", user)).rejects.toMatchObject({ statusCode: 403 });
  });
});

it("fails closed when an explicit target differs from the contextual executor", async () => {
  await expect(resolveAgentContext({ target: { id: "other-target" } } as Executor, "a", "X", user))
    .rejects.toMatchObject({ code: "ASSISTANT_PROJECT_FORBIDDEN" });
  await expect(agentMarketService.remove({ target: { id: "other-target" } } as Executor, "a", "X", user))
    .rejects.toMatchObject({ code: "ASSISTANT_PROJECT_FORBIDDEN" });
  expect(state.agents.get("a").projectIds).toContain("X");
});

it("preserves a legacy superior when configuring or reincorporating its assignment", async () => {
  state.agents.get("a").parentAgentId = "legacy-superior";
  state.agents.set("legacy-superior", profile({ id: "legacy-superior" }));
  state.projects.find(p => p.id === "X").leaderAgentId = "new-project-leader";
  await agentMarketService.put(executor, "a", "X", { jobTitle: "Backend" }, user);
  expect((await resolveAgentContext(executor, "a", "X", user)).agent?.parentAgentId).toBe("legacy-superior");
  await agentMarketService.remove(executor, "a", "Y", user);
  await agentMarketService.put(executor, "a", "Y", {}, user);
  expect((await resolveAgentContext(executor, "a", "Y", user)).agent?.parentAgentId).toBe("legacy-superior");
});
it("preserves actionable status and code in the shared HTTP envelope", async () => {
  const { mapErrorToResponse } = await import("../../../shared/errors/error-handler.js");
  const error = await resolveAgentContext(executor, "a", null, user).catch(error => error);
  expect(mapErrorToResponse(error, "es")).toMatchObject({
    statusCode: 400, body: { ok: false, code: "ASSISTANT_PROJECT_REQUIRED", error: expect.any(String) },
  });
});


describe("Market capability parity and immutable conversation binding", () => {
  it.each(["foreign", "missing", "cycle"])("hides assignments and graphs with %s ancestry", async kind => {
    state.agents.set("a", profile({ projectIds: ["child"], graphProjectIds: ["child"] }));
    if (kind === "foreign") state.projects.find(p => p.id === "X").ownerId = 99;
    if (kind === "missing") state.projects.find(p => p.id === "child").parentId = "gone";
    if (kind === "cycle") state.projects.find(p => p.id === "X").parentId = "child";
    const shown = await agentMarketService.present(executor, state.agents.get("a"), user);
    expect(shown.assignments).toEqual([]);
    expect(shown.projectIds).toEqual([]);
    expect(shown.graphProjectIds).toEqual([]);
    expect(shown.capabilities.canExecute).toBe(false);
    await expect(resolveAgentContext(executor, "a", "child", user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("preserves shared catalog visibility without granting execution or editing", async () => {
    state.agents.get("a").ownerId = 99;
    const shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "X" });
    expect(shown.id).toBe("a");
    expect(Object.values(shown.capabilities).every(v => v === false)).toBe(true);
    expect(shown.context?.effectiveConfig).toBeNull();
    expect(shown.execution.error).toMatchObject({ code: "ASSISTANT_PROJECT_FORBIDDEN", statusCode: 403 });
    await expect(resolveAgentContext(executor, "a", "X", user)).rejects.toMatchObject(shown.execution.error!);
    await expect(agentMarketService.remove(executor, "a", "X", user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("legacy shared profiles remain executable and editable by an admin only", async () => {
    state.agents.set("a", profile({ ownerId: null, projectIds: [] }));
    const admin = await agentMarketService.present(executor, state.agents.get("a"), user);
    expect(admin.capabilities).toMatchObject({ canExecute: true, canEditProfile: true });
    state.user = { userId: 8, role: "user" };
    const viewer = await agentMarketService.present(executor, state.agents.get("a"), state.user);
    expect(viewer.capabilities).toMatchObject({ canExecute: false, canEditProfile: false });
    await expect(agentMarketService.put(executor, "a", "X", {}, state.user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("uses the supplied identity for profile mutations, not an unrelated ambient admin", async () => {
    await expect(agentMarketService.updateProfile(executor, "a", { name: "Wrong user" }, { userId: 8, role: "user" } as SessionUser))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(state.agents.get("a").name).toBe("Mateo");
  });
  it("reports inherited config and prevents removing a child override with an active parent", async () => {
    await agentMarketService.put(executor, "a", "X", { jobTitle: "API", instructions: "LOCAL", connections: [], parentAgentId: null }, user);
    let shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "child" });
    expect(shown.context).toMatchObject({ membership: "inherited", directAssignment: null, effectiveAssignment: { inheritedFrom: "X" } });
    expect(shown.capabilities).toMatchObject({ canAssign: true, canUpdateAssignment: false, canRemoveAssignment: false, canExecute: true });
    expect(shown.context?.effectiveConfig).toMatchObject({ parentAgentId: null, connections: [], projectPaths: ["/X/child"] });
    await agentMarketService.put(executor, "a", "child", { instructions: "CHILD" }, user);
    shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "child" });
    expect(shown.context?.membership).toBe("direct");
    expect(shown.capabilities).toMatchObject({ canAssign: false, canUpdateAssignment: true, canRemoveAssignment: false });
    await expect(agentMarketService.remove(executor, "a", "child", user)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_INHERITED" });
  });
  it("reports the actual intersection of local and base roles and assignment limits", async () => {
    state.agents.get("a").roleId = "base";
    state.roles.set("base", { id: "base", allowedTools: ["files.read", "files.write"], canSpawnChats: true });
    state.roles.set("local", { id: "local", ownerId: 7, allowedTools: ["files.read"], canSpawnChats: true });
    await agentMarketService.put(executor, "a", "X", { roleId: "local", canSpawnChats: false }, user);
    const shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "X" });
    const run = await admitAgentWork(executor, "a", "X", user);
    try {
      expect(shown.context?.effectiveConfig).toMatchObject({ allowedTools: ["files.read"], canSpawnChats: false });
      expect(shown.context?.effectiveConfig?.allowedTools).toEqual(run.agent?.allowedTools);
      expect(shown.context?.effectiveConfig?.canSpawnChats).toBe(run.agent?.canSpawnChats);
    } finally { run.release(); }
  });
  it("reports missing and removed links without hiding the profile", async () => {
    state.agents.set("a", profile({ projectIds: ["X"] }));
    let shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "Y" });
    expect(shown.context?.membership).toBe("none");
    expect(shown.capabilities).toMatchObject({ canAssign: true, canExecute: false });
    await agentMarketService.remove(executor, "a", "X", user);
    shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "X" });
    expect(shown.context?.membership).toBe("removed");
    expect(shown.execution.error?.code).toBe("ASSISTANT_ASSIGNMENT_REMOVED");
    expect(shown.capabilities).toMatchObject({ canAssign: true, canExecute: false, canRemoveAssignment: false });
  });
  it.each([0, 2])("never infers a new project for a persisted loose chat with %s messages", async messageCount => {
    state.agents.set("a", profile({ projectIds: [] }));
    state.metas.push({ id: "loose", agentId: "a", projectId: null, messageCount });
    expect((await resolveConversationBinding(executor, { conversationId: "loose" }, user)).projectId).toBeNull();
    await agentMarketService.put(executor, "a", "X", {}, user);
    for (const input of [{ conversationId: "loose" }, { conversationId: "loose", projectId: "X" }]) {
      await expect(resolveConversationBinding(executor, input, user)).rejects.toMatchObject({ code: "ASSISTANT_CONTEXT_MISMATCH" });
    }
    await expect(enqueueAgentTurn(executor, { conversationId: "loose", userText: "go", withContext: true, user }))
      .rejects.toMatchObject({ code: "ASSISTANT_CONTEXT_MISMATCH" });
    expect(state.queue).toEqual([]);
    expect(state.metas[0].projectId).toBeNull();
    expect((await resolveConversationBinding(executor, { agentId: "a" }, user)).projectId).toBe("X");
  });
  it("does not bind an agent or project to an existing empty general chat", async () => {
    state.metas.push({ id: "empty", agentId: null, projectId: null, messageCount: 0 });
    for (const input of [{ agentId: "a" }, { projectId: "X" }]) {
      await expect(resolveConversationBinding(executor, { conversationId: "empty", ...input }, user))
        .rejects.toMatchObject({ code: "ASSISTANT_CONTEXT_MISMATCH" });
    }
    expect((await resolveConversationBinding(executor, { conversationId: "empty" }, user)).projectId).toBeNull();
  });
  it("rejects a different target before attempting to bind conversation history", async () => {
    await expect(resolveConversationBinding({ target: { id: "target-Y" } } as Executor, { conversationId: "loose" }, user))
      .rejects.toMatchObject({ code: "ASSISTANT_PROJECT_FORBIDDEN" });
  });
});


describe("post-review admission and contextual parity regressions", () => {
  it("a concurrent first assignment cannot rebind a waiting admission from null", async () => {
    state.agents.set("a", profile({ projectIds: [] }));
    state.metas.push({ id: "loose", agentId: "a", projectId: null });
    const binding = await resolveConversationBinding(executor, { conversationId: "loose" }, user);
    let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    state.waitTasks = async () => { entered(); await blocked; };
    const incorporation = agentMarketService.put(executor, "a", "X", {}, user);
    await started;
    const outcome = admitAgentWork(executor, binding.agentId, binding.projectId, user).then(
      admission => { admission.release(); return { admitted: true }; },
      error => ({ code: error.code, statusCode: error.statusCode }),
    );
    release();
    await incorporation;
    expect(await outcome).toEqual({ code: "ASSISTANT_CONTEXT_MISMATCH", statusCode: 409 });
    expect(hasAssignmentAdmission(executor, "a", new Set(["X"]))).toBe(false);
    expect(state.metas[0].projectId).toBeNull();
  });
  it("an admitted null context blocks incorporation until its work releases", async () => {
    state.agents.set("a", profile({ projectIds: [] }));
    const run = await admitAgentWork(executor, "a", null, user);
    try {
      expect(run.projectId).toBeNull();
      await expect(agentMarketService.put(executor, "a", "X", {}, user))
        .rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_BUSY" });
      expect(agentAssignments(state.agents.get("a"))).toEqual([]);
    } finally { run.release(); }
    await agentMarketService.put(executor, "a", "X", {}, user);
  });
  it("enqueue refuses a first assignment committed after binding a persisted null chat", async () => {
    state.agents.set("a", profile({ projectIds: [] }));
    state.metas.push({ id: "loose", agentId: "a", projectId: null });
    const resolveBinding = agentContext.resolveConversationBinding;
    const bindingSpy = vi.spyOn(agentContext, "resolveConversationBinding").mockImplementationOnce(async (...args) => {
      const binding = await resolveBinding(...args);
      await agentMarketService.put(executor, "a", "X", {}, user);
      return binding;
    });
    try {
      await expect(enqueueAgentTurn(executor, { conversationId: "loose", userText: "go", withContext: true, user }))
        .rejects.toMatchObject({ code: "ASSISTANT_CONTEXT_MISMATCH" });
      expect(state.queue).toEqual([]);
      expect(state.metas[0].projectId).toBeNull();
      expect(hasAssignmentAdmission(executor, "a", new Set(["X"]))).toBe(false);
    } finally { bindingSpy.mockRestore(); }
  });
  it.each([
    { role: ["files.list"], agent: ["files.list_dir"], expected: ["files.list_dir"] },
    { role: ["terminal.run"], agent: ["admin.bash"], expected: ["admin.bash"] },
    { role: ["files.list"], agent: ["files.read"], expected: [] },
    { role: ["files.list"], agent: [], expected: [] },
    { role: null, agent: null, expected: null },
  ])("DTO tools match admission with legacy role $role and profile $agent", async ({ role, agent, expected }) => {
    state.agents.set("a", profile({ roleId: "base", allowedTools: agent }));
    state.roles.set("base", { id: "base", allowedTools: role });
    const shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "X" });
    const run = await admitAgentWork(executor, "a", "X", user);
    try {
      expect(shown.context?.effectiveConfig?.allowedTools).toEqual(expected);
      expect(run.agent?.allowedTools).toEqual(expected);
      expect(shown.context?.effectiveConfig?.allowedTools).toEqual(run.agent?.allowedTools);
      expect(state.roles.get("base").allowedTools).toEqual(role);
    } finally { run.release(); }
  });
  it.each(["legacy", "explicit", "inherited"])("filters %s hierarchy to executable peers in the selected context", async source => {
    const projectId = source === "inherited" ? "child" : "X";
    const excluded = ["only-Y", "other-owner", "removed", "missing-role", "missing", "a"];
    const peers = ["peer-X", ...excluded, "peer-X"];
    state.agents.set("peer-X", profile({ id: "peer-X", projectIds: ["X"] }));
    state.agents.set("only-Y", profile({ id: "only-Y", projectIds: ["Y"] }));
    state.agents.set("other-owner", profile({ id: "other-owner", ownerId: 99, projectIds: ["X"] }));
    state.agents.set("removed", profile({ id: "removed", projectIds: [], assignments: [{ projectId: "X", status: "removed" }] }));
    state.agents.set("missing-role", profile({ id: "missing-role", projectIds: ["X"], roleId: "absent" }));
    state.agents.set("a", profile({ parentAgentId: "only-Y", connections: peers,
      ...(source !== "legacy" ? { assignments: [{ projectId: "X", status: "active", parentAgentId: "only-Y", connections: peers }] } : {}),
    }));
    const saved = JSON.stringify(state.agents.get("a"));
    const runtime = await resolveAgentContext(executor, "a", projectId, user);
    const shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: projectId });
    const roster = await scopedAgents(executor, [...state.agents.values()], projectId, user);
    expect(runtime.agent).toMatchObject({ parentAgentId: null, connections: ["peer-X"] });
    expect(shown.context?.effectiveConfig).toMatchObject({ parentAgentId: null, connections: ["peer-X"] });
    expect(roster.map(agent => agent.id).sort()).toEqual(["a", "peer-X"]);
    expect(roster.find(agent => agent.id === "a")).toMatchObject({ parentAgentId: null, connections: ["peer-X"] });
    expect(JSON.stringify(state.agents.get("a"))).toBe(saved);
    expect((await agentMarketService.present(executor, state.agents.get("other-owner"), user, { contextProjectId: projectId })).capabilities.canExecute).toBe(false);
  });
  it("retains a valid inherited superior and excludes the root leader once withdrawn", async () => {
    state.agents.set("leader", profile({ id: "leader", projectIds: ["X"] }));
    state.projects.find(p => p.id === "X").leaderAgentId = "leader";
    state.agents.set("a", profile({ assignments: [{ projectId: "X", status: "active" }] }));
    expect((await resolveAgentContext(executor, "a", "child", user)).agent?.parentAgentId).toBe("leader");
    await agentMarketService.remove(executor, "leader", "X", user);
    const shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "child" });
    expect(shown.capabilities.canExecute).toBe(true);
    expect(shown.context?.effectiveConfig?.parentAgentId).toBeNull();
    expect((await resolveAgentContext(executor, "a", "child", user)).agent?.parentAgentId).toBeNull();
  });
  it("rejects a stored cycle that a new assignment would make executable", async () => {
    state.agents.set("a", profile({ projectIds: [] }));
    state.agents.set("cyclic", profile({ id: "cyclic", projectIds: ["X"], parentAgentId: "a" }));
    expect((await resolveAgentContext(executor, "cyclic", "X", user)).agent?.parentAgentId).toBeNull();
    await expect(agentMarketService.put(executor, "a", "X", { parentAgentId: "cyclic" }, user))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(agentAssignments(state.agents.get("a"))).toEqual([]);
  });
  it("a loose chat cannot expose connections assigned to another project", async () => {
    state.agents.set("a", profile({ projectIds: [], parentAgentId: "scoped", connections: ["scoped", "loose"] }));
    state.agents.set("scoped", profile({ id: "scoped", projectIds: ["X"] }));
    state.agents.set("loose", profile({ id: "loose", projectIds: [] }));
    expect((await resolveAgentContext(executor, "a", null, user)).agent)
      .toMatchObject({ parentAgentId: null, connections: ["loose"] });
  });
});

describe("role-read concurrency and real allowlist regressions", () => {
  function gate() {
    let resume!: () => void, entered!: () => void;
    const waiting = new Promise<void>(resolve => { resume = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    return { resume, started, pause: async () => { entered(); await waiting; } };
  }

  it.each(["incorporation", "withdrawal"] as const)(
    "rejects enqueue when %s commits while the real binding waits for its role",
    async change => {
      const projectId = change === "incorporation" ? null : "X";
      state.agents.set("a", profile({ projectIds: projectId ? [projectId] : [], roleId: "base" }));
      state.roles.set("base", { id: "base", allowedTools: ["files.list"] });
      state.metas.push({ id: "loose", agentId: "a", projectId, messageCount: 2 });
      state.messages.set("loose", [{ role: "user", content: "Earlier history" }, { role: "assistant", content: "Earlier reply" }]);
      const saved = JSON.stringify({ metas: state.metas, messages: [...state.messages] });
      const barrier = gate();
      const readRole = agentRolesRepository.get;
      const roleSpy = vi.spyOn(agentRolesRepository, "get").mockImplementationOnce(async roleId => {
        await barrier.pause();
        return readRole(roleId);
      });
      const queued = enqueueAgentTurn(executor, { conversationId: "loose", userText: "go", withContext: true, user });
      const rejected = expect(queued).rejects.toMatchObject({
        code: change === "incorporation" ? "ASSISTANT_CONTEXT_MISMATCH" : "ASSISTANT_ASSIGNMENT_REMOVED",
        statusCode: 409,
      });
      try {
        await barrier.started;
        if (change === "incorporation") await agentMarketService.put(executor, "a", "X", {}, user);
        else await agentMarketService.remove(executor, "a", "X", user);
        barrier.resume();
        await rejected;
        expect(state.queue).toEqual([]);
        expect(JSON.stringify({ metas: state.metas, messages: [...state.messages] })).toBe(saved);
        expect(hasAssignmentAdmission(executor, "a", new Set(["X"]))).toBe(false);
      } finally { barrier.resume(); await queued.catch(() => undefined); roleSpy.mockRestore(); }
    },
  );

  it.each(["incorporation", "withdrawal"] as const)(
    "blocks concurrent %s if admission acquires the lock before its role read",
    async change => {
      const projectId = change === "incorporation" ? null : "X";
      state.agents.set("a", profile({ projectIds: projectId ? [projectId] : [], roleId: "base" }));
      state.roles.set("base", { id: "base", allowedTools: ["files.list"] });
      state.metas.push({ id: "loose", agentId: "a", projectId, messageCount: 2 });
      const barrier = gate();
      const readRole = agentRolesRepository.get;
      const roleSpy = vi.spyOn(agentRolesRepository, "get")
        .mockImplementationOnce(readRole) // binding completes; admission then owns the lock
        .mockImplementationOnce(async roleId => { await barrier.pause(); return readRole(roleId); });
      const queued = enqueueAgentTurn(executor, { conversationId: "loose", userText: "go", withContext: true, user });
      try {
        await barrier.started;
        const mutation = change === "incorporation"
          ? agentMarketService.put(executor, "a", "X", {}, user)
          : agentMarketService.remove(executor, "a", "X", user);
        const rejected = expect(mutation).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_BUSY" });
        barrier.resume();
        await queued;
        await rejected;
        expect(state.queue).toHaveLength(1);
        expect(state.queue[0]).toMatchObject({ agentId: "a", projectId });
        expect(state.metas[0]).toMatchObject({ agentId: "a", projectId, messageCount: 2 });
        expect(state.agents.get("a").projectIds).toEqual(projectId ? [projectId] : []);
        expect(hasAssignmentAdmission(executor, "a", new Set(["X"]))).toBe(false);
      } finally { barrier.resume(); await queued.catch(() => undefined); roleSpy.mockRestore(); }
    },
  );

  it.each([
    { local: ["files.list", "files.write", "missing.tool"], limit: ["files.list_dir", "files.write"], expected: ["files.list_dir"] },
    { local: ["missing.tool"], limit: null, expected: [] },
    { local: ["files.list"], limit: ["missing.tool"], expected: [] },
    { local: null, limit: ["files.list", "missing.tool"], expected: ["files.list_dir"] },
  ])("normalizes local roles and drops unknown tools without widening $expected", async ({ local, limit, expected }) => {
    state.agents.set("a", profile({ roleId: "base", allowedTools: null,
      assignments: [{ projectId: "X", status: "active", roleId: "local", allowedTools: limit }],
    }));
    state.roles.set("base", { id: "base", allowedTools: ["files.list", "files.read", "missing.tool"] });
    state.roles.set("local", { id: "local", ownerId: 7, allowedTools: local });
    const saved = JSON.stringify({ agents: [...state.agents], roles: [...state.roles] });
    const shown = await agentMarketService.present(executor, state.agents.get("a"), user, { contextProjectId: "X" });
    const admission = await admitAgentWork(executor, "a", "X", user);
    try {
      expect(shown.context?.effectiveConfig?.allowedTools).toEqual(expected);
      expect(admission.agent?.allowedTools).toEqual(expected);
      expect(JSON.stringify({ agents: [...state.agents], roles: [...state.roles] })).toBe(saved);
    } finally { admission.release(); }
  });

  it("preserves global legacy references and exposes B only in its authorized Y roster", async () => {
    const original = profile({ parentAgentId: "b", connections: ["b"] });
    state.agents.set("a", original);
    state.agents.set("b", profile({ id: "b", projectIds: ["Y"] }));
    const saved = JSON.stringify([...state.agents]);
    for (const projectId of ["X", "Y"]) {
      const shown = await agentMarketService.present(executor, original, user, { contextProjectId: projectId });
      const runtime = await resolveAgentContext(executor, "a", projectId, user);
      const roster = await scopedAgents(executor, [...state.agents.values()], projectId, user);
      const hierarchy = projectId === "X" ? { parentAgentId: null, connections: [] } : { parentAgentId: "b", connections: ["b"] };
      expect(shown).toMatchObject({ parentAgentId: "b", connections: ["b"] });
      expect(shown.context?.effectiveConfig).toMatchObject(hierarchy);
      expect(runtime.agent).toMatchObject(hierarchy);
      expect(roster.map(agent => agent.id).sort()).toEqual(projectId === "X" ? ["a"] : ["a", "b"]);
    }
    expect(JSON.stringify([...state.agents])).toBe(saved);
  });
});
