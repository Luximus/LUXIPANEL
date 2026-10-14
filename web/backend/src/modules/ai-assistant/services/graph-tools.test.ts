// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";

// ── Mocks (before importing the service) ────────────────────────────────────

const scope = {
  agentId: "agent-a" as string | null,
  projects: [{ graphName: "var-www-LUXIPANEL", path: "/var/www/LUXIPANEL", projectId: "lux" }],
  roots: ["/var/www/LUXIPANEL"],
};
vi.mock("./graph-scope.service.js", () => ({
  graphScopeService: {
    async resolve() {
      return scope;
    },
    allows(s: typeof scope, name: string) {
      return s.projects.some((p) => p.graphName === name);
    },
    invalidate() {},
  },
}));

/** Every call the broker actually made to the binary. */
const cliCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];
vi.mock("./graph-index.service.js", () => ({
  graphIndexService: {
    async probeAvailability() {
      return { available: true, binPath: "/usr/bin/codebase-memory-mcp", moduleInstalled: true, checkedAt: Date.now() };
    },
  },
  async runGraphCli(_e: unknown, _b: string, tool: string, args: Record<string, unknown>) {
    cliCalls.push({ tool, args });
    return { rows: [`result-of-${tool}`] };
  },
}));

const { buildGraphToolsForConversation, _resetGraphToolState } = await import("./graph-tools.js");

const exec = { target: { id: "t1", name: "t1" } } as unknown as Executor;

async function build(approve?: (r: unknown) => Promise<boolean>) {
  const built = await buildGraphToolsForConversation({
    executor: exec,
    conversationId: "conv-1",
    ...(approve ? { requestApproval: approve as never } : {}),
  });
  if (!built) throw new Error("expected tools");
  const byName = new Map(built.tools.map((t) => [t.name, t]));
  return { built, byName };
}

beforeEach(() => {
  cliCalls.length = 0;
  _resetGraphToolState();
});

describe("graph tools — surface", () => {
  it("never exposes the mutating tools", async () => {
    const { byName } = await build();
    for (const forbidden of ["index_repository", "delete_project", "manage_adr", "ingest_traces"]) {
      expect(byName.has(`graph.${forbidden}`)).toBe(false);
    }
    // …and does expose the read ones.
    expect(byName.has("graph.search_graph")).toBe(true);
    expect(byName.has("graph.query_graph")).toBe(true);
  });

  it("answers list_projects from the scope WITHOUT touching the binary", async () => {
    const { byName } = await build();
    const r = await byName.get("graph.list_projects")!.handler({});
    expect(r.ok).toBe(true);
    expect(r.output).toEqual({ projects: [{ name: "var-www-LUXIPANEL", root_path: "/var/www/LUXIPANEL" }] });
    // The oracle is dead: the real list_projects was never invoked.
    expect(cliCalls).toEqual([]);
  });
});

describe("graph tools — project enforcement", () => {
  it("injects the project when the agent has exactly one", async () => {
    const { byName } = await build();
    const r = await byName.get("graph.get_architecture")!.handler({});
    expect(r.ok).toBe(true);
    expect(cliCalls[0]!.args.project).toBe("var-www-LUXIPANEL");
  });

  it("passes through a project that IS in scope", async () => {
    const { byName } = await build();
    const r = await byName.get("graph.search_graph")!.handler({ project: "var-www-LUXIPANEL", name_pattern: "foo" });
    expect(r.ok).toBe(true);
    expect(cliCalls[0]!.args).toMatchObject({ project: "var-www-LUXIPANEL", name_pattern: "foo" });
  });

  it("DENIES an out-of-scope project when the user says no — and never runs it", async () => {
    const approve = vi.fn(async () => false);
    const { byName } = await build(approve);
    const r = await byName.get("graph.query_graph")!.handler({
      project: "var-www-LP-LICENSE-SERVER",
      query: "MATCH (f:File) RETURN f.path",
    });
    expect(r.ok).toBe(false);
    expect(String(r.output)).toContain("no autorizó");
    expect(approve).toHaveBeenCalledOnce();
    expect(cliCalls).toEqual([]); // the other agent's code was never read
  });

  it("allows an out-of-scope project after the user approves, and asks only ONCE per run", async () => {
    const approve = vi.fn(async () => true);
    const { byName } = await build(approve);
    const t = byName.get("graph.search_graph")!;

    const r1 = await t.handler({ project: "var-www-LP-LICENSE-SERVER", name_pattern: "a" });
    const r2 = await t.handler({ project: "var-www-LP-LICENSE-SERVER", name_pattern: "b" });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(approve).toHaveBeenCalledOnce(); // memoised for the rest of the run
    expect(cliCalls).toHaveLength(2);
  });

  it("fails CLOSED when no approval channel is wired", async () => {
    const { byName } = await build(); // no requestApproval
    const r = await byName.get("graph.search_graph")!.handler({ project: "var-www-LP-LICENSE-SERVER" });
    expect(r.ok).toBe(false);
    expect(cliCalls).toEqual([]);
  });

  it("fails CLOSED when the approval channel throws", async () => {
    const approve = vi.fn(async () => {
      throw new Error("no live run");
    });
    const { byName } = await build(approve);
    const r = await byName.get("graph.search_graph")!.handler({ project: "var-www-OTRO" });
    expect(r.ok).toBe(false);
    expect(cliCalls).toEqual([]);
  });
});

describe("graph tools — argument whitelist", () => {
  it("drops undeclared keys so repo_path can never be smuggled in", async () => {
    const { byName } = await build();
    await byName.get("graph.get_architecture")!.handler({
      aspects: "routes",
      repo_path: "/var/www", // not in get_architecture's schema
      target_projects: ["var-www"],
    });
    const sent = cliCalls[0]!.args;
    expect(sent).toEqual({ project: "var-www-LUXIPANEL", aspects: "routes" });
    expect(sent.repo_path).toBeUndefined();
    expect(sent.target_projects).toBeUndefined();
  });
});
