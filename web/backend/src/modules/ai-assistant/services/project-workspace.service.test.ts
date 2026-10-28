// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

let uid = 7;
let serial = 0;
let failLink = false;
const projects = new Map<string, Record<string, any>>();
const teams = new Map<string, Record<string, any>>();
const agents = new Map<string, Record<string, any>>();
const chats = new Map<string, Record<string, any>>();
const markers = new Map<string, Record<string, any>>();

vi.mock("../../../shared/executor/index.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return {
    ...actual,
    getContextUserId: () => uid,
    getContextUser: () => ({ userId: uid, username: "admin", displayName: "Admin", role: "admin", kind: "admin", modules: ["admin"] }),
  };
});
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: () => ({
    get: async (id: string) => markers.get(id) ?? null,
    set: async (id: string, data: Record<string, any>) => { markers.set(id, data); return data; },
  }),
}));
vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: {
    list: async () => [...projects.values()],
    get: async (_executor: unknown, id: string) => projects.get(id) ?? null,
    create: async (_executor: unknown, data: Record<string, any>) => {
      const doc = { id: `p${++serial}`, ownerId: uid, ...data };
      projects.set(doc.id, doc);
      return doc;
    },
    update: async (_executor: unknown, id: string, patch: Record<string, any>) => {
      if (failLink) throw new Error("link failed");
      const doc = projects.get(id);
      if (!doc) return null;
      Object.assign(doc, patch);
      return doc;
    },
    setOwner: async (_executor: unknown, id: string, ownerId: number | null) => {
      const doc = projects.get(id);
      if (!doc) return null;
      doc.ownerId = ownerId;
      return doc;
    },
    delete: async (_executor: unknown, id: string) => projects.delete(id),
  },
}));
vi.mock("../repositories/agent-teams.repository.js", () => ({
  agentTeamsRepository: {
    list: async () => [...teams.values()],
    create: async (data: Record<string, any>) => {
      const doc = { id: `t${++serial}`, ownerId: uid, ...data };
      teams.set(doc.id, doc);
      return doc;
    },
    get: async (id: string) => teams.get(id) ?? null,
    setOwner: async (id: string, ownerId: number | null) => {
      const doc = teams.get(id);
      if (!doc) return null;
      doc.ownerId = ownerId;
      return doc;
    },
    delete: async (id: string) => teams.delete(id),
  },
}));
vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    list: async () => [...agents.values()],
    get: async (id: string) => agents.get(id) ?? null,
    create: async (data: Record<string, any>) => {
      const doc = { id: `a${++serial}`, ownerId: uid, ...data };
      agents.set(doc.id, doc);
      return doc;
    },
    update: async (id: string, patch: Record<string, any>) => {
      const doc = agents.get(id);
      if (!doc) return null;
      Object.assign(doc, patch);
      return doc;
    },
    setOwner: async (id: string, ownerId: number | null) => {
      const doc = agents.get(id);
      if (!doc) return null;
      doc.ownerId = ownerId;
      return doc;
    },
    delete: async (id: string) => agents.delete(id),
  },
}));
vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: {
    list: async (_executor: unknown, { offset = 0, limit = 200 }: { offset?: number; limit?: number }) => ({ items: [...chats.values()].slice(offset, offset + limit), total: chats.size }),
    listIds: async () => new Set(chats.keys()),
    getMeta: async (_executor: unknown, id: string) => chats.get(id) ?? null,
    patchRuntime: async (_executor: unknown, id: string, patch: Record<string, any>) => {
      const chat = chats.get(id);
      if (chat) Object.assign(chat, patch);
      return chat ?? null;
    },
    moveToLoose: async (_executor: unknown, id: string) => {
      const chat = chats.get(id);
      if (chat) chat.projectId = null;
      return chat ?? null;
    },
  },
}));
vi.mock("../repositories/agent-activity.repository.js", () => ({
  agentActivityRepository: {
    forAssignment: async (_executor: unknown, agentId: string, projectsInScope: Set<string>) =>
      [...chats.values()]
        .filter((chat) => chat.agentId === agentId && (!chat.projectId || projectsInScope.has(chat.projectId)))
        .map((chat) => ({ conversationId: chat.id, pendingQuestion: false, pendingCliJob: false })),
  },
}));
vi.mock("../repositories/agent-messages.repository.js", () => ({
  agentMessagesRepository: { listPending: async () => [] },
}));
vi.mock("../repositories/agent-queue.repository.js", () => ({
  agentQueueRepository: { listPending: async () => [] },
}));
vi.mock("../repositories/team-tasks.repository.js", () => ({
  teamTasksRepository: { listActive: async () => [] },
}));
vi.mock("./agent-assignment-lock.js", () => ({ hasAssignmentAdmission: () => false }));

const { projectWorkspaceService } = await import("./project-workspace.service.js");
const executor = { target: { id: "server-one" } } as never;

beforeEach(() => {
  uid = 7;
  serial = 0;
  failLink = false;
  projects.clear(); teams.clear(); agents.clear(); chats.clear(); markers.clear();
});

describe("project workspace", () => {
  it("creates exactly one team and leader for a retried root request, and none for its child", async () => {
    const rootInput = { title: "Mi proyecto", icon: "folder", path: "", instructions: "", creationKey: "retry-key" };
    const first = await projectWorkspaceService.create(executor, rootInput);
    const retry = await projectWorkspaceService.create(executor, rootInput);
    expect(retry.project.id).toBe(first.project.id);
    expect(teams.size).toBe(1);
    expect(agents.size).toBe(1);
    expect(first.project.teamId).toBe([...teams.keys()][0]);
    await projectWorkspaceService.create(executor, { ...rootInput, creationKey: "child-key", parentId: first.project.id });
    expect(teams.size).toBe(1);
    expect(agents.size).toBe(1);
  });

  it("creates children under a legacy parent but rejects a parent owned by another user", async () => {
    projects.set("legacy", { id: "legacy", ownerId: null, title: "WEB", path: "/project/web", provider: "codex" });
    const child = await projectWorkspaceService.create(executor, {
      title: "BACKEND", icon: "folder", path: "/project/web/backend", instructions: "", parentId: "legacy",
    });
    expect(child.project.parentId).toBe("legacy");
    expect(child.project.ownerId).toBe(uid);
    projects.set("foreign", { id: "foreign", ownerId: uid + 1, title: "Ajeno", path: "/other", provider: "codex" });
    await expect(projectWorkspaceService.create(executor, {
      title: "No autorizado", icon: "folder", path: "/other/child", instructions: "", parentId: "foreign",
    })).rejects.toThrow("Proyecto padre no encontrado");
  });

  it("repairs agent chats once while preserving a valid explicit project", async () => {
    projects.set("p1", { id: "p1", ownerId: uid, title: "Proyecto", provider: "codex" });
    projects.set("p2", { id: "p2", ownerId: uid, title: "Otro", provider: "codex" });
    agents.set("a1", { id: "a1", ownerId: uid, name: "Líder", providerId: "codex", projectIds: ["p1"] });
    chats.set("c1", { id: "c1", agentId: "a1", projectId: null });
    chats.set("c2", { id: "c2", agentId: "a1", projectId: "p2" });
    const first = await projectWorkspaceService.repair(executor);
    expect(first.repaired).toBe(true);
    expect(chats.get("c1")?.projectId).toBe("p1");
    expect(chats.get("c2")?.projectId).toBe("p2");
    const counts = [projects.size, teams.size, agents.size];
    expect((await projectWorkspaceService.repair(executor)).repaired).toBe(false);
    expect([projects.size, teams.size, agents.size]).toEqual(counts);
  });

  it("uses the ancestor team for agents linked to a child and leaves ambiguous team chats loose", async () => {
    projects.set("root", { id: "root", ownerId: uid, title: "Raíz", provider: "codex" });
    projects.set("child", { id: "child", ownerId: uid, title: "Subproyecto", provider: "codex", parentId: "root" });
    agents.set("child-agent", { id: "child-agent", ownerId: uid, name: "Agente", providerId: "codex", projectIds: ["child"] });
    chats.set("child-chat", { id: "child-chat", agentId: "child-agent", projectId: null });
    await projectWorkspaceService.repair(executor);
    expect(projects.size).toBe(2);
    expect(teams.size).toBe(1);
    expect(chats.get("child-chat")?.projectId).toBe("child");

    projects.clear(); teams.clear(); agents.clear(); chats.clear(); markers.clear();
    teams.set("team", { id: "team", ownerId: uid, name: "Compartido" });
    projects.set("one", { id: "one", ownerId: uid, title: "Uno", provider: "codex", teamId: "team" });
    projects.set("two", { id: "two", ownerId: uid, title: "Dos", provider: "codex", teamId: "team" });
    agents.set("a", { id: "a", ownerId: uid, name: "Agente", providerId: "codex", teamId: "team", projectIds: [] });
    chats.set("ambiguous", { id: "ambiguous", agentId: "a", projectId: null });
    await projectWorkspaceService.repair(executor);
    expect(chats.get("ambiguous")?.projectId).toBeNull();
  });

  it("blocks deletion with children and otherwise keeps chats, agents and team", async () => {
    const root = (await projectWorkspaceService.create(executor, { title: "Raíz", icon: "folder", path: "", instructions: "" })).project;
    projects.set("child", { id: "child", ownerId: uid, title: "Hijo", parentId: root.id });
    await expect(projectWorkspaceService.remove(executor, root)).rejects.toThrow("subproyectos");
    projects.delete("child");
    chats.set("c1", { id: "c1", projectId: root.id, agentId: [...agents.keys()][0] });
    await expect(projectWorkspaceService.remove(executor, root)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_BUSY" });
    expect(projects.has(root.id!)).toBe(true);
    const leader = [...agents.values()][0]!;
    leader.projectIds = [];
    leader.assignments = [{ projectId: root.id, status: "removed" }];
    await projectWorkspaceService.remove(executor, root);
    expect(chats.get("c1")?.projectId).toBe(root.id);
    expect(teams.size).toBe(1);
    expect(agents.size).toBe(1);
    expect([...agents.values()][0]?.projectIds).toEqual([]);
  });

  it("removes the factory-created leader and team when a fresh root is deleted", async () => {
    const root = (await projectWorkspaceService.create(executor, { title: "Temporal", icon: "folder", path: "", instructions: "" })).project;
    await projectWorkspaceService.remove(executor, root);
    expect(projects.has(root.id!)).toBe(false);
    expect(agents.size).toBe(0);
    expect(teams.size).toBe(0);
  });

  it("shares an exclusive root, its descendants, leader and team with administrators", async () => {
    const root = (await projectWorkspaceService.create(executor, { title: "RealityOS", icon: "folder", path: "/var/www/realityos", instructions: "" })).project;
    const child = (await projectWorkspaceService.create(executor, {
      title: "API", icon: "folder", path: "/var/www/realityos/api", instructions: "", parentId: root.id,
    })).project;
    const shared = await projectWorkspaceService.shareWithAdministrators(executor, root);
    expect(shared.ownerId).toBeNull();
    expect(projects.get(root.id!)?.ownerId).toBeNull();
    expect(projects.get(child.id!)?.ownerId).toBeNull();
    expect(agents.get(root.leaderAgentId!)?.ownerId).toBeNull();
    expect(teams.get(root.teamId!)?.ownerId).toBeNull();
  });

  it("does not share a root whose default team has another member", async () => {
    const root = (await projectWorkspaceService.create(executor, { title: "Aislado", icon: "folder", path: "", instructions: "" })).project;
    agents.set("extra", { id: "extra", ownerId: uid, name: "Otro", teamId: root.teamId, projectIds: [] });
    await expect(projectWorkspaceService.shareWithAdministrators(executor, root)).rejects.toThrow("no es exclusivo");
    expect(projects.get(root.id!)?.ownerId).toBe(uid);
    expect(agents.get(root.leaderAgentId!)?.ownerId).toBe(uid);
    expect(teams.get(root.teamId!)?.ownerId).toBe(uid);
  });
});


it("creates a contextual leader once under concurrent retries", async () => {
  const input = { title: "Portal", icon: "folder", path: "/project/portal", provider: "codex" as const, instructions: "Gestiona reservas de clientes", creationKey: "concurrent" };
  const results = await Promise.all([projectWorkspaceService.create(executor, input), projectWorkspaceService.create(executor, input)]);
  expect(results.filter(r => r.created)).toHaveLength(1);
  expect(projects.size).toBe(1);
  expect(agents.size).toBe(1);
  const leader = [...agents.values()][0]!;
  expect(leader.description).toContain(input.instructions);
  expect(leader.systemPrompt).toContain(results[0]!.project.id);
  expect(leader.systemPrompt).toContain("contexto vigente");
  expect(leader.systemPrompt).toContain("servidores asociados");
  expect(leader.systemPrompt).toContain("subproyectos");
  expect(leader.projectIds).toEqual([results[0]!.project.id]);
  expect(leader.providerId).toBe("codex");
});

it("rolls back an incomplete root without leaving a stray team or leader", async () => {
  failLink = true;
  await expect(projectWorkspaceService.create(executor, { title: "Portal", icon: "folder", path: "", instructions: "" })).rejects.toThrow("link failed");
  expect(projects.size).toBe(0);
  expect(teams.size).toBe(0);
  expect(agents.size).toBe(0);
});

it("does not pick the first project or regroup a multiproject profile during legacy repair", async () => {
  projects.set("X", { id: "X", ownerId: uid, title: "X" });
  projects.set("Y", { id: "Y", ownerId: uid, title: "Y" });
  agents.set("a", { id: "a", ownerId: uid, name: "Shared", projectIds: ["X", "Y"] });
  chats.set("chat", { id: "chat", agentId: "a", projectId: null });
  await projectWorkspaceService.repair(executor);
  expect(chats.get("chat")?.projectId).toBeNull();
  expect(agents.size).toBe(1); expect(teams.size).toBe(0);
  expect(agents.get("a")?.projectIds).toEqual(["X", "Y"]);
});
it("does not resurrect a removed Market leader or rewrite its history", async () => {
  projects.set("X", { id: "X", ownerId: uid, title: "X", leaderAgentId: "a", teamId: "team" });
  teams.set("team", { id: "team", ownerId: uid, name: "X" });
  agents.set("a", { id: "a", ownerId: uid, name: "A", teamId: "team", projectIds: [], assignments: [{ projectId: "X", status: "removed" }] });
  chats.set("chat", { id: "chat", agentId: "a", projectId: null });
  await projectWorkspaceService.repair(executor);
  expect(agents.get("a")?.projectIds).toEqual([]);
  expect(agents.size).toBe(1); expect(projects.size).toBe(1); expect(teams.size).toBe(1);
  expect(chats.get("chat")?.projectId).toBeNull();
});
it("does not bypass inherited assignment withdrawal through child project deletion", async () => {
  projects.set("X", { id: "X", ownerId: uid, title: "X" });
  projects.set("child", { id: "child", ownerId: uid, parentId: "X", title: "Child" });
  agents.set("a", { id: "a", ownerId: uid, projectIds: ["X"] });
  await expect(projectWorkspaceService.remove(executor, projects.get("child") as any)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_BUSY" });
  expect(projects.has("child")).toBe(true);
});
