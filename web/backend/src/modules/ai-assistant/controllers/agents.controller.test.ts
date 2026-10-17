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

interface Agent { id: string; name: string; providerId?: string; ownerId?: number | null; teamId?: string | null; parentAgentId?: string | null; projectIds?: string[]; specialty?: string; technologies?: string[] }

const agents = new Map<string, Agent>();
const teams = new Map<string, { id: string; name: string }>();
const projects = new Map<string, { id: string; title: string }>();
const createCalls: Array<Record<string, unknown>> = [];
const updateCalls: Array<{ id: string; patch: Record<string, unknown> }> = [];

vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    async list() { return [...agents.values()]; },
    async get(id: string) { return agents.get(id) ?? null; },
    async create(data: Record<string, unknown>) {
      createCalls.push(data);
      const doc = { id: "new-agent", ...data } as Agent;
      agents.set(doc.id, doc);
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

let currentUserId: number | null = 1;
vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return {
    ...actual,
    getExecutor: vi.fn(() => ({ target: { id: "target" } }) as never),
    getContextExecutor: vi.fn(() => ({ target: { id: "target" } })),
    getContextUser: vi.fn(() => ({ userId: currentUserId, role: "admin" })),
    getContextUserId: vi.fn(() => currentUserId),
  };
});

const { agentsController } = await import("./agents.controller.js");

async function invoke(
  handler: (req: unknown, res: unknown, next: unknown) => void,
  req: Record<string, unknown>,
): Promise<{ body?: Record<string, unknown>; error?: { statusCode?: number; message: string } }> {
  let body: Record<string, unknown> | undefined;
  let error: { statusCode?: number; message: string } | undefined;
  const res = { json: (b: Record<string, unknown>) => { body = b; return res; }, locals: { locale: "es", user: { userId: currentUserId, role: "admin" } } };
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
  currentUserId = 1;
});

describe("agentsController.list — team leader project annotation", () => {
  function leaderWithReport(leader: Agent, report: Agent) {
    agents.set(leader.id, leader);
    agents.set(report.id, report);
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
