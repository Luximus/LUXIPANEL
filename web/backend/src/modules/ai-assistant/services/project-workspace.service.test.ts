// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

let uid = 7;
let serial = 0;
const projects = new Map<string, Record<string, any>>();
const teams = new Map<string, Record<string, any>>();
const agents = new Map<string, Record<string, any>>();
const chats = new Map<string, Record<string, any>>();
const markers = new Map<string, Record<string, any>>();

vi.mock("../../../shared/executor/index.js", () => ({ getContextUserId: () => uid }));
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
      const doc = projects.get(id);
      if (!doc) return null;
      Object.assign(doc, patch);
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
    delete: async (id: string) => teams.delete(id),
  },
}));
vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    list: async () => [...agents.values()],
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

const { projectWorkspaceService } = await import("./project-workspace.service.js");
const executor = { target: { id: "server-one" } } as never;

beforeEach(() => {
  uid = 7;
  serial = 0;
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
    await projectWorkspaceService.remove(executor, root);
    expect(chats.get("c1")?.projectId).toBeNull();
    expect(teams.size).toBe(1);
    expect(agents.size).toBe(1);
    expect([...agents.values()][0]?.projectIds).toEqual([]);
  });
});
