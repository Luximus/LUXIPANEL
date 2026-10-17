// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectClosure } from "./project-closure.js";

// ── Mocks (before importing the service) ────────────────────────────────────

interface AnyProject {
  id: string;
  title: string;
  path: string;
  parentId?: string | null;
  graphIndex?: { enabled: boolean; project?: string; status?: string };
}
const projects: AnyProject[] = [];
const agents = new Map<string, { id: string; name: string; projectIds?: string[] }>();
const metas = new Map<string, { agentId?: string | null; projectId?: string | null }>();

vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: {
    async list() {
      return projects;
    },
  },
}));
vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    async get(id: string) {
      return agents.get(id) ?? null;
    },
  },
}));
vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: {
    async getMeta(_e: unknown, id: string) {
      return metas.get(id) ?? null;
    },
  },
}));

vi.mock("../../../shared/executor/index.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, getContextUser: () => ({ userId: 7, role: "admin" }), getContextUserId: () => 7,
    getContextExecutor: () => ({ target: { id: "target" } }) };
});
vi.mock("../repositories/agent-roles.repository.js", () => ({ agentRolesRepository: { get: async () => null } }));

const { graphScopeService } = await import("./graph-scope.service.js");

/** A project with a READY graph. */
function ready(id: string, path: string, graph: string, parentId?: string): AnyProject {
  return { id, title: id, path, parentId: parentId ?? null, graphIndex: { enabled: true, project: graph, status: "ready" } };
}

const exec = { target: { id: "target" } } as never;

beforeEach(() => {
  projects.length = 0;
  agents.clear();
  metas.clear();
  graphScopeService._clearCache();
});

describe("projectClosure", () => {
  it("includes the roots and every descendant, but never an ancestor", () => {
    const all = [
      { id: "root", title: "root", path: "/var/www" },
      { id: "lux", title: "lux", path: "/var/www/LUXIPANEL", parentId: "root" },
      { id: "lux-be", title: "be", path: "/var/www/LUXIPANEL/backend", parentId: "lux" },
      { id: "lp", title: "lp", path: "/var/www/LP", parentId: "root" },
    ] as never;
    const closure = projectClosure(all, ["lux"]);
    expect([...closure].sort()).toEqual(["lux", "lux-be"]);
    // The monorepo root is the PARENT of "lux" — it must not be reachable.
    expect(closure.has("root")).toBe(false);
    expect(closure.has("lp")).toBe(false);
  });

  it("survives a parentId cycle instead of hanging", () => {
    const all = [
      { id: "a", title: "a", path: "/a", parentId: "b" },
      { id: "b", title: "b", path: "/b", parentId: "a" },
    ] as never;
    expect([...projectClosure(all, ["a"])].sort()).toEqual(["a", "b"]);
  });
});

describe("graphScopeService.resolve — agent isolation", () => {
  it("gives an agent ONLY the graphs of its own closure", async () => {
    projects.push(
      ready("root", "/var/www", "var-www"),
      ready("lux", "/var/www/LUXIPANEL", "var-www-LUXIPANEL", "root"),
      ready("lux-be", "/var/www/LUXIPANEL/backend", "var-www-LUXIPANEL-backend", "lux"),
      ready("lp", "/var/www/LP", "var-www-LP", "root"),
    );
    agents.set("agent-a", { id: "agent-a", name: "A", projectIds: ["lux"] });
    metas.set("conv-a", { agentId: "agent-a" });

    const scope = await graphScopeService.resolve(exec, "conv-a");
    const names = scope.projects.map((p) => p.graphName).sort();

    expect(names).toEqual(["var-www-LUXIPANEL", "var-www-LUXIPANEL-backend"]);
    // The whole point: no other agent's graph, and NOT the monorepo root.
    expect(graphScopeService.allows(scope, "var-www-LP")).toBe(false);
    expect(graphScopeService.allows(scope, "var-www")).toBe(false);
  });

  it("does NOT let the conversation's project widen an agent's scope", async () => {
    projects.push(
      ready("lux", "/var/www/LUXIPANEL", "var-www-LUXIPANEL"),
      ready("lp", "/var/www/LP", "var-www-LP"),
    );
    agents.set("agent-a", { id: "agent-a", name: "A", projectIds: ["lux"] });
    // The conversation claims a project the agent does NOT own — the back door.
    metas.set("conv-a", { agentId: "agent-a", projectId: "lp" });

    const scope = await graphScopeService.resolve(exec, "conv-a");
    expect(scope.projects).toEqual([]);
    expect(graphScopeService.allows(scope, "var-www-LP")).toBe(false);
  });

  it("excludes ancestors for a plain (non-agent) chat", async () => {
    projects.push(
      ready("root", "/var/www", "var-www"),
      ready("lux", "/var/www/LUXIPANEL", "var-www-LUXIPANEL", "root"),
    );
    metas.set("conv-h", { projectId: "lux" });

    const scope = await graphScopeService.resolve(exec, "conv-h");
    expect(scope.agentId).toBeNull();
    expect(scope.projects.map((p) => p.graphName)).toEqual(["var-www-LUXIPANEL"]);
    // The monorepo root is an ancestor — it must not come for free.
    expect(graphScopeService.allows(scope, "var-www")).toBe(false);
  });

  it("skips projects whose graph is not ready", async () => {
    projects.push(
      ready("lux", "/var/www/LUXIPANEL", "var-www-LUXIPANEL"),
      { id: "wip", title: "wip", path: "/var/www/WIP", parentId: "lux", graphIndex: { enabled: true, project: "var-www-WIP", status: "indexing" } },
      { id: "off", title: "off", path: "/var/www/OFF", parentId: "lux", graphIndex: { enabled: false, project: "var-www-OFF", status: "ready" } },
    );
    agents.set("a", { id: "a", name: "A", projectIds: ["lux"] });
    metas.set("c", { agentId: "a" });

    const scope = await graphScopeService.resolve(exec, "c");
    expect(scope.projects.map((p) => p.graphName)).toEqual(["var-www-LUXIPANEL"]);
  });

  it("fails CLOSED when the scope cannot be resolved", async () => {
    metas.set("c", { agentId: "ghost" }); // agent does not exist
    const scope = await graphScopeService.resolve(exec, "c");
    expect(scope.projects).toEqual([]);
    expect(graphScopeService.allows(scope, "var-www-LUXIPANEL")).toBe(false);
  });

  it("gives no graph at all to a conversation with no project and no agent", async () => {
    projects.push(ready("lux", "/var/www/LUXIPANEL", "var-www-LUXIPANEL"));
    metas.set("c", {});
    const scope = await graphScopeService.resolve(exec, "c");
    expect(scope.projects).toEqual([]);
  });
});
