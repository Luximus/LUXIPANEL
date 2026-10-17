// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Focused coverage for the agents controller's teamId handling:
 *  - create/update with a non-existent teamId → 400 (ValidationError);
 *  - teamId: null passes (removes the agent from its team).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AssistantProject } from "../repositories/projects.repository.js";
type Agent = Pick<AssistantAgent, "id" | "name"> & Partial<AssistantAgent>;

const { agents, teams, projects, createCalls, updateCalls, identity } = vi.hoisted(() => ({
  agents: new Map<string, Agent>(),
  teams: new Map<string, { id: string; name: string }>(),
  projects: new Map<string, Pick<AssistantProject, "id" | "title"> & Partial<AssistantProject>>(),
  createCalls: [] as Array<Record<string, unknown>>,
  updateCalls: [] as Array<{ id: string; patch: Record<string, unknown> }>,
  identity: { userId: 1 as number | null, role: "admin" },
}));

vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    async list() { return [...agents.values()]; },
    async get(id: string) { return agents.get(id) ?? null; },
    async create(data: Record<string, unknown>) {
      createCalls.push(data);
      const doc = { id: "new-agent", ...data } as Agent;
      agents.set(doc.id!, doc);
      return doc;
    },
    async update(id: string, patch: Record<string, unknown>) {
      updateCalls.push({ id, patch });
      const cur = agents.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      agents.set(id, next);
      return next;
    },
  },
}));

vi.mock("../repositories/agent-teams.repository.js", () => ({
  agentTeamsRepository: {
    async get(id: string) { return teams.get(id) ?? null; },
    async list() { return [...teams.values()]; },
  },
}));

vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: {
    async list() { return [...projects.values()]; },
  },
}));

vi.mock("../../auth/repositories/panel-user.repository.js", () => ({
  panelUserRepository: { findAll: vi.fn(async () => []) },
}));

// Heavy AI/tooling deps imported at module top but not exercised by these tests.
vi.mock("../services/translation/ai-translator.js", () => ({ aiComplete: vi.fn() }));
vi.mock("../services/folder-agents.service.js", () => ({ summarizeFolder: vi.fn() }));
vi.mock("../repositories/assistant-config.repository.js", () => ({
  assistantConfigRepository: { load: vi.fn(async () => ({})) },
}));
vi.mock("../services/assistant-modules.service.js", () => ({
  assistantModulesService: { allowedTools: vi.fn(async () => []) },
}));

vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return {
    ...actual,
    getExecutor: vi.fn(() => ({ target: { id: "target" } }) as never),
    getContextExecutor: vi.fn(() => ({ target: { id: "target" } })),
    getContextUser: vi.fn(() => ({ userId: identity.userId, role: identity.role })),
    getContextUserId: vi.fn(() => identity.userId),
  };
});

vi.mock("../repositories/agent-roles.repository.js", () => ({ agentRolesRepository: { get: vi.fn(async () => null) } }));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: { listActive: vi.fn(async () => []) } }));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: { listPending: vi.fn(async () => []) } }));
vi.mock("../repositories/agent-activity.repository.js", () => ({ agentActivityRepository: { forAssignment: vi.fn(async () => []) } }));
vi.mock("../repositories/agent-messages.repository.js", () => ({ agentMessagesRepository: { listPending: vi.fn(async () => []) } }));

const { agentsController } = await import("./agents.controller.js");

async function invoke(
  handler: (req: unknown, res: unknown, next: unknown) => void,
  req: Record<string, unknown>,
): Promise<{ body?: Record<string, unknown>; error?: { statusCode?: number; message: string } }> {
  let body: Record<string, unknown> | undefined;
  let error: { statusCode?: number; message: string } | undefined;
  const res = { json: (b: Record<string, unknown>) => { body = b; return res; }, locals: { locale: "es", user: { userId: identity.userId, role: identity.role } } };
  const next = (e: { statusCode?: number; message: string }) => { error = e; };
  handler({ params: {}, body: {}, query: {}, ...req }, res, next);
  await new Promise((r) => setImmediate(r));
  return { body, error };
}

beforeEach(() => {
  agents.clear();
  teams.clear();
  projects.clear();
  createCalls.length = 0;
  updateCalls.length = 0;
  identity.userId = 1; identity.role = "admin";
});

describe("agentsController.list — team leader project annotation", () => {
  function leaderWithReport(leader: Agent, report: Agent) {
    agents.set(leader.id!, leader);
    agents.set(report.id!, report);
  }

  it("annotates a unique visible assignment without guessing among multiple projects", async () => {
    projects.set("p-lux", { id: "p-lux", title: "LUXIPANEL" });
    leaderWithReport(
      { id: "martin", name: "Martín", projectIds: ["p-lux"], teamId: "t-lux" },
      { id: "mateo", name: "Mateo", parentAgentId: "martin" },
    );
    const { body } = await invoke(agentsController.list, {});
    const list = body?.["agents"] as Array<Record<string, unknown>>;
    const martin = list.find((a) => a["id"] === "martin")!;
    expect(martin["isTeamLeader"]).toBe(true);
    expect(martin["project"]).toEqual({ id: "p-lux", name: "LUXIPANEL" });
  });

  it("does not infer assignments from matching team and project names", async () => {
    // projectIds points at a deleted project; the team name mirrors a real project.
    projects.set("p-navai", { id: "p-navai", title: "NAVAI" });
    teams.set("t-navai", { id: "t-navai", name: "NAVAI" });
    leaderWithReport(
      { id: "renata", name: "Renata", projectIds: ["ghost-project"], teamId: "t-navai" },
      { id: "sofia", name: "Sofía", parentAgentId: "renata" },
    );
    const { body } = await invoke(agentsController.list, {});
    const list = body?.["agents"] as Array<Record<string, unknown>>;
    const renata = list.find((a) => a["id"] === "renata")!;
    expect(renata["project"]).toBeNull();
  });

  it("annotates a unique assignment for a non-leader profile too", async () => {
    projects.set("p-lux", { id: "p-lux", title: "LUXIPANEL" });
    // The catalog describes every reusable profile, including workers.
    agents.set("solo", { id: "solo", name: "Solo", projectIds: ["p-lux"], teamId: "t-lux" });
    const { body } = await invoke(agentsController.list, {});
    const list = body?.["agents"] as Array<Record<string, unknown>>;
    const solo = list.find((a) => a["id"] === "solo")!;
    expect(solo["isTeamLeader"]).toBe(false);
    expect(solo["project"]).toEqual({ id: "p-lux", name: "LUXIPANEL" });
  });
  it("keeps project null for multiple visible assignments", async () => {
    projects.set("X", { id: "X", title: "X" }); projects.set("Y", { id: "Y", title: "Y" });
    agents.set("a", { id: "a", name: "A", projectIds: ["X", "Y"] });
    const { body, error } = await invoke(agentsController.list, {});
    expect(error).toBeUndefined();
    expect((body?.agents as Agent[] & Array<{ project: unknown }>)[0]?.project).toBeNull();
  });
  it("searches specialty and declared technologies without inspecting source", async () => {
    agents.set("a", { id: "a", name: "A", specialty: "Backend", technologies: ["TypeScript"] });
    agents.set("b", { id: "b", name: "B", specialty: "Diseño", technologies: ["CSS"] });
    const { body } = await invoke(agentsController.list, { query: { q: "back", technology: "typescript" } });
    expect((body?.agents as Agent[]).map(a => a.id)).toEqual(["a"]);
  });

});

describe("agentsController.create — teamId", () => {
  it("rejects a non-existent teamId with 400", async () => {
    const { error, body } = await invoke(agentsController.create, {
      body: { name: "Agente", teamId: "nope" },
    });
    expect(body).toBeUndefined();
    expect(error?.statusCode).toBe(400);
    expect(error?.message).toMatch(/equipo/i);
    expect(createCalls).toHaveLength(0);
  });

  it("accepts teamId: null (no team)", async () => {
    const { error, body } = await invoke(agentsController.create, {
      body: { name: "Agente", teamId: null },
    });
    expect(error).toBeUndefined();
    expect(body?.["ok"]).toBe(true);
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]!["teamId"]).toBeNull();
  });

  it("accepts an existing teamId", async () => {
    teams.set("t1", { id: "t1", name: "Equipo" });
    const { error } = await invoke(agentsController.create, {
      body: { name: "Agente", teamId: "t1" },
    });
    expect(error).toBeUndefined();
    expect(createCalls[0]!["teamId"]).toBe("t1");
  });
});

describe("agentsController.update — teamId", () => {
  it("rejects a non-existent teamId with 400", async () => {
    agents.set("a1", { id: "a1", name: "Agente", providerId: "claude", ownerId: 1 });
    const { error } = await invoke(agentsController.update, {
      params: { id: "a1" },
      body: { teamId: "nope" },
    });
    expect(error?.statusCode).toBe(400);
    expect(updateCalls).toHaveLength(0);
  });

  it("accepts teamId: null (removes from team)", async () => {
    agents.set("a1", { id: "a1", name: "Agente", providerId: "claude", ownerId: 1, teamId: "t1" });
    const { error } = await invoke(agentsController.update, {
      params: { id: "a1" },
      body: { teamId: null },
    });
    expect(error).toBeUndefined();
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.patch["teamId"]).toBeNull();
  });
});


describe("Market HTTP catalog contract", () => {
  beforeEach(() => {
    projects.set("X", { id: "X", title: "X", ownerId: 1, path: "/X" });
    projects.set("Y", { id: "Y", title: "Y", ownerId: 1, path: "/Y" });
    projects.set("child", { id: "child", title: "child", parentId: "X", ownerId: 1, path: "/X/child" });
    agents.set("leader", { id: "leader", name: "Leader", ownerId: 1, projectIds: ["X"] });
    agents.set("a", { id: "a", name: "Backend", ownerId: 1, description: "APIs", specialty: "Platform", technologies: ["TypeScript"], projectIds: ["X", "Y"], parentAgentId: "global-parent",
      assignments: [{ projectId: "X", status: "active", parentAgentId: "leader" }] });
    agents.set("other", { id: "other", name: "Other", ownerId: 1, projectIds: ["Y"] });
    agents.set("shared", { id: "shared", name: "Shared", ownerId: 99, projectIds: ["X"] });
  });
  it("contextProjectId returns the entire catalog while projectId returns inherited members", async () => {
    const contextual = await invoke(agentsController.list, { query: { contextProjectId: "child" } });
    expect(contextual.error).toBeUndefined();
    const all = contextual.body?.agents as any[];
    expect(all.map(a => a.id)).toEqual(["leader", "a", "other", "shared"]);
    expect(all.find(a => a.id === "a")).toMatchObject({ context: { membership: "inherited", effectiveAssignment: { inheritedFrom: "X" }, effectiveConfig: { parentAgentId: "leader" } }, capabilities: { canExecute: true } });
    expect(all.find(a => a.id === "other")).toMatchObject({ context: { membership: "none", effectiveConfig: null }, capabilities: { canExecute: false, canAssign: true } });
    expect(all.find(a => a.id === "shared")).toMatchObject({ relation: "shared", capabilities: { canExecute: false, canEditProfile: false } });
    const members = await invoke(agentsController.list, { query: { projectId: "child" } });
    expect((members.body?.agents as Agent[]).map(a => a.id)).toEqual(["leader", "a", "shared"]);
  });
  it("rejects different project/context IDs and malformed query inputs with 400", async () => {
    for (const query of [{ projectId: "X", contextProjectId: "Y" }, { contextProjectId: ["X", "Y"] }, { projectId: "" }]) {
      const result = await invoke(agentsController.list, { query });
      expect(result.error?.statusCode).toBe(400);
      expect(result.body).toBeUndefined();
    }
    expect((await invoke(agentsController.list, { query: { projectId: "X", contextProjectId: "X" } })).error).toBeUndefined();
  });
  it.each(["backend", "apis", "platform", "typescript"])("q searches %s and composes with technology", async q => {
    const result = await invoke(agentsController.list, { query: { q, technology: "tYpEsCrIpT", contextProjectId: "child" } });
    expect(result.error).toBeUndefined();
    expect((result.body?.agents as Agent[]).map(a => a.id)).toEqual(["a"]);
  });
  it("a search keeps hierarchy computed from all effective contextual members", async () => {
    const result = await invoke(agentsController.list, { query: { contextProjectId: "X", q: "leader" } });
    expect(result.body?.agents).toMatchObject([{ id: "leader", isTeamLeader: true, subordinateIds: ["a"] }]);
  });
  it("fails closed on forbidden ancestors in both catalog modes and profile creation", async () => {
    projects.get("X")!.ownerId = 99;
    for (const query of [{ contextProjectId: "child" }, { projectId: "child" }]) {
      expect((await invoke(agentsController.list, { query })).error?.statusCode).toBe(403);
    }
    const shown = await invoke(agentsController.list, {});
    const a = (shown.body?.agents as any[]).find(a => a.id === "a");
    expect(a.projectIds).toEqual(["Y"]);
    expect((await invoke(agentsController.create, { body: { name: "New", projectIds: ["child"] } })).error?.statusCode).toBe(403);
    expect(createCalls).toHaveLength(0);
  });
  it("reports 404 for an unknown contextual project", async () => {
    expect((await invoke(agentsController.list, { query: { contextProjectId: "missing" } })).error?.statusCode).toBe(404);
  });
  it("redacts credentials in both the profile and the contextual DTO", async () => {
    agents.get("a")!.credential = { username: "qa", secret: "test-only-do-not-return" };
    const result = await invoke(agentsController.list, { query: { contextProjectId: "X", q: "Backend" } });
    expect(JSON.stringify(result.body)).not.toContain("test-only-do-not-return");
    expect((result.body?.agents as any[])[0].credential).toEqual({ username: "qa", hasSecret: true });
  });
  it("rejects editing or deleting an ownerless legacy profile for a non-admin", async () => {
    identity.role = "user";
    agents.set("legacy", { id: "legacy", name: "Legacy", ownerId: null });
    for (const handler of [agentsController.update, agentsController.remove]) {
      expect((await invoke(handler, { params: { id: "legacy" }, body: { name: "Changed" } })).error?.statusCode).toBe(403);
    }
  });
});
