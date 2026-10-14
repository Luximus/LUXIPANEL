// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Community module `codebase-graph`.
 *
 * Surfaces the `codebase-memory-mcp` knowledge graph of the CONNECTED server's
 * repository through the LUXIPANEL agent + data panels. All structural queries
 * shell out to the local CLI (`codebase-memory-mcp cli <tool> '<json>'`) over
 * the target executor, so nothing here parses code itself.
 *
 *   • tools:  architecture / search / trace / query / open-graph / reindex
 *   • panel:  overview (nodes, edges, top labels, edge types + graph URL)
 *
 * The interactive graphic view is the binary's own SPA (default
 * http://127.0.0.1:9749, localhost-bound); `open-graph` returns the URL and the
 * SSH-tunnel command for remote viewing instead of exposing the port.
 */
import { defineModule, type ModuleCtx } from "../../../../../shared/module-sdk/index.js";
import { quoteArg } from "../../../../../shared/executor/quote.js";

const BIN = "codebase-memory-mcp";
/**
 * DANGER — this used to be `const DEFAULT_PROJECT = "var-www-LUXIPANEL"`, i.e.
 * any agent that omitted `project` silently got THAT project's graph, whoever
 * it belonged to. These tools take `project` straight from the model with no
 * validation, which is why the assistant now strips them from agent runs
 * (`ASSISTANT_GRAPH_SCOPE_ENFORCED`) and serves the scoped `graph.*` tools
 * instead. Keep this a hard failure so nobody reintroduces a default that
 * points at somebody else's code.
 */
function requireProject(project: unknown): string {
  const p = typeof project === "string" ? project.trim() : "";
  if (!p) throw new Error("Falta `project`: indica el proyecto del grafo (no hay proyecto por defecto).");
  return p;
}
const GRAPH_URL = "http://127.0.0.1:9749";

/** Single-quote a JSON arg for the shell (CLI takes one positional json blob). */
function shArg(obj: unknown): string {
  return quoteArg(JSON.stringify(obj));
}

/** Extract the JSON payload the CLI prints after its `level=info` log lines. */
function parseCliJson(stdout: string): unknown {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`codebase-memory-mcp: no JSON in output: ${stdout.slice(0, 200)}`);
  }
  return JSON.parse(stdout.slice(start, end + 1));
}

/** Run one CLI tool and return its parsed JSON. */
async function runTool(ctx: ModuleCtx, tool: string, args: Record<string, unknown>): Promise<unknown> {
  const r = await ctx.server.exec(`${BIN} cli ${tool} ${shArg(args)}`);
  if (r.exitCode !== 0) {
    throw new Error(`codebase-memory-mcp ${tool} exited ${r.exitCode}: ${r.stderr || r.stdout}`.slice(0, 300));
  }
  return parseCliJson(r.stdout);
}

export default defineModule((m) => {
  m.suggest("Show me the codebase graph architecture of this server's repo");
  m.suggest("Who calls the function X — trace the call chain in the graph");
  m.suggest("Open the interactive codebase graph view");

  m.tool("architecture", {
    title: "Graph architecture",
    description: "Node-label and edge-type breakdown of the indexed repo (totals, routes, functions, classes, imports).",
    kind: "read",
    input: { type: "object", properties: { project: { type: "string", description: "Indexed project name (list_projects)." } } },
    async handler({ project }, ctx) {
      const out = await runTool(ctx, "get_architecture", { project: requireProject(project) });
      return { ok: true, output: out };
    },
  });

  m.tool("search", {
    title: "Search graph",
    description: "Find functions/classes/routes by name pattern, label or qualified-name pattern.",
    kind: "read",
    input: {
      type: "object",
      properties: {
        name_pattern: { type: "string" },
        label: { type: "string", description: "e.g. Function, Class, Route" },
        qn_pattern: { type: "string" },
        project: { type: "string" },
      },
    },
    async handler({ name_pattern, label, qn_pattern, project }, ctx) {
      const args: Record<string, unknown> = { project: requireProject(project) };
      if (name_pattern) args.name_pattern = name_pattern;
      if (label) args.label = label;
      if (qn_pattern) args.qn_pattern = qn_pattern;
      return { ok: true, output: await runTool(ctx, "search_graph", args) };
    },
  });

  m.tool("trace", {
    title: "Trace call path",
    description: "Trace call chains, data flow or cross-service paths from a function.",
    kind: "read",
    input: {
      type: "object",
      properties: {
        function_name: { type: "string" },
        mode: { type: "string", description: "calls | data_flow | cross_service" },
        project: { type: "string" },
      },
      required: ["function_name"],
    },
    async handler({ function_name, mode, project }, ctx) {
      return {
        ok: true,
        output: await runTool(ctx, "trace_path", {
          project: requireProject(project),
          function_name,
          mode: mode || "calls",
        }),
      };
    },
  });

  m.tool("query", {
    title: "Cypher query",
    description: "Run a read-only Cypher pattern against the codebase graph for complex relations.",
    kind: "read",
    input: {
      type: "object",
      properties: { query: { type: "string" }, project: { type: "string" } },
      required: ["query"],
    },
    async handler({ query, project }, ctx) {
      return { ok: true, output: await runTool(ctx, "query_graph", { project: requireProject(project), query }) };
    },
  });

  m.tool("open-graph", {
    title: "Open graph view",
    description: "Return the interactive graph UI URL and the SSH-tunnel command for remote viewing (the UI is localhost-bound).",
    kind: "read",
    input: { type: "object" },
    async handler(_input, ctx) {
      return {
        ok: true,
        output: {
          url: GRAPH_URL,
          note: "The graph UI binds to localhost only (it exposes code structure).",
          remote_access: `ssh -N -L 9749:127.0.0.1:9749 ${ctx.user.linux ?? "<user>"}@${ctx.target.name}`,
          then: `Open ${GRAPH_URL} in your browser.`,
        },
      };
    },
  });

  m.tool("reindex", {
    title: "Re-index repository",
    description: "Re-scan a repo and rebuild its knowledge graph (run after large code changes).",
    kind: "action",
    input: {
      type: "object",
      properties: { path: { type: "string", description: "Repo root to index." } },
      required: ["path"],
    },
    async handler({ path }, ctx) {
      // `path` was defaulted to /var/www/LUXIPANEL, which meant an agent could
      // rebuild (and thereby read) a repo it has nothing to do with just by
      // omitting the argument. There is no default: indexing is an explicit act.
      // Note this whole module is stripped from agent runs while
      // ASSISTANT_GRAPH_SCOPE_ENFORCED is on — indexing belongs to the operator
      // endpoint (POST /api/ai/projects/:id/graph-index), which knows the
      // project's own path.
      const p = typeof path === "string" ? path.trim() : "";
      if (!p.startsWith("/")) throw new Error("`path` es obligatorio y debe ser una ruta absoluta.");
      return { ok: true, output: await runTool(ctx, "index_repository", { repo_path: p }) };
    },
  });

  m.dataPanel("overview", {
    title: "Codebase graph",
    description: "Index status and architecture summary of the connected server's repo.",
    ttlSeconds: 120,
    async collect(ctx) {
      // No hardcoded project here either: this snapshot is folded into the
      // agent's prompt, so pinning it to one repo would quietly hand over a
      // graph the caller may not own. Summarize only when the box has exactly
      // one indexed project; otherwise just say which ones exist.
      const listed = (await runTool(ctx, "list_projects", {})) as { projects?: Array<{ name: string }> };
      const names = (listed.projects ?? []).map((p) => p.name);
      if (names.length !== 1) {
        return { projects: names, note: "Varios proyectos indexados: elige uno con la tool `project`.", graph_url: GRAPH_URL };
      }
      const arch = (await runTool(ctx, "get_architecture", { project: names[0] })) as Record<string, unknown>;
      const labels = (arch.node_labels as Array<{ label: string; count: number }>) ?? [];
      const edges = (arch.edge_types as Array<{ type: string; count: number }>) ?? [];
      const labelCount = (name: string) => labels.find((l) => l.label === name)?.count ?? 0;
      return {
        project: arch.project ?? names[0],
        total_nodes: arch.total_nodes ?? 0,
        total_edges: arch.total_edges ?? 0,
        routes: labelCount("Route"),
        functions: labelCount("Function"),
        classes: labelCount("Class"),
        imports: edges.find((e) => e.type === "IMPORTS")?.count ?? 0,
        top_labels: labels.slice(0, 6),
        top_edges: edges.slice(0, 6),
        graph_url: GRAPH_URL,
      };
    },
  });
});
