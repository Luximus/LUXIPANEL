// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SCOPED code-graph tools.
 *
 * The `codebase-memory-mcp` binary has no notion of who is asking: every query
 * tool takes a free-form `project` argument and `list_projects` happily lists
 * EVERY graph on the target. Attaching that binary straight to the CLI (which
 * is what the bridge used to do) means any agent can enumerate the other
 * agents' graphs and read their code with a Cypher query. The file jail does
 * not help — the graph is served over stdio, not through the filesystem.
 *
 * So the binary is no longer handed to the model. These tools are, and every
 * call is resolved against `graphScopeService`, whose authority is server-side
 * state (signed conversationId → conversation sidecar → agent sidecar). The
 * model only ever supplies ARGUMENTS, and arguments are exactly what we check.
 *
 * Two properties do the real work:
 *   • `list_projects` is SYNTHETIC — it never reaches the binary and returns
 *     only the caller's own graphs. Without this the model can still discover
 *     that other graphs exist and go ask for them by name.
 *   • Every other tool has its `project` validated; an out-of-scope one goes to
 *     the user for an explicit approval instead of being answered.
 */
import type { AgentTool, ToolInputSchema } from "../../../shared/agent-capability/types.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { graphIndexService, runGraphCli } from "./graph-index.service.js";
import { graphScopeService, type GraphScope } from "./graph-scope.service.js";

const log = createModuleLogger("ai-assistant:graph-tools");

/** Prefix that namespaces these tools on the MCP channel. */
export const GRAPH_TOOL_PREFIX = "graph.";

/** Ask the user whether this run may reach a graph it was not assigned. */
export interface GraphApprovalRequest {
  conversationId: string;
  /** Bare tool name, e.g. "query_graph". */
  tool: string;
  /** The out-of-scope graph the model asked for. */
  graphName: string;
  /** What the run IS allowed to see (for the prompt shown to the user). */
  scope: GraphScope;
}
export type GraphApprovalFn = (req: GraphApprovalRequest) => Promise<boolean>;

export interface BuiltGraphTools {
  tools: AgentTool[];
  /** Graphs advertised to the model (for the system-prompt block). */
  projects: { name: string; path: string }[];
}

/**
 * The read-only surface, with the EXACT argument whitelist of each tool as the
 * binary declares it (probed from its own `tools/list`). Only these keys are
 * forwarded: no spreading of raw model input, so `repo_path`/`root_path`/
 * `target_projects` can never be smuggled into a call that does not take them.
 *
 * The four mutating tools (`index_repository`, `delete_project`, `manage_adr`,
 * `ingest_traces`) are deliberately ABSENT. `index_repository` in particular
 * takes a free `repo_path` — it is a direct escape hatch to indexing (and thus
 * reading) anything on disk, `/var/www` included. Indexing stays an operator
 * action through `POST /api/ai/projects/:id/graph-index`, which already knows
 * the project's own path.
 */
const READ_TOOLS: Record<string, { title: string; description: string; keys: string[]; timeoutMs?: number }> = {
  search_graph: {
    title: "Buscar en el grafo",
    description: "Find functions, classes, routes or symbols in the code graph by name, label or qualified-name pattern.",
    keys: ["query", "label", "name_pattern", "qn_pattern", "file_pattern", "relationship", "min_degree", "max_degree", "exclude_entry_points", "include_connected", "semantic_query", "limit", "offset"],
  },
  search_code: {
    title: "Buscar texto en el código",
    description: "Graph-augmented text search across the indexed source (regex or literal).",
    keys: ["pattern", "file_pattern", "path_filter", "mode", "context", "regex", "limit"],
  },
  get_code_snippet: {
    title: "Leer un símbolo",
    description: "Return the exact source of one symbol by qualified name — read this instead of the whole file.",
    keys: ["qualified_name", "include_neighbors"],
  },
  trace_path: {
    title: "Trazar llamadas",
    description: "Follow call chains, data flow or cross-service paths from a function (impact analysis).",
    keys: ["function_name", "direction", "depth", "mode", "parameter_name", "edge_types", "risk_labels", "include_tests"],
  },
  get_architecture: {
    title: "Arquitectura",
    description: "Structural breakdown of the indexed project (node labels, edge types, routes, totals).",
    keys: ["aspects"],
  },
  query_graph: {
    title: "Consulta Cypher",
    description: "Run a Cypher query against the project's graph for complex relationship patterns.",
    keys: ["query", "max_rows"],
    timeoutMs: 45_000,
  },
  get_graph_schema: {
    title: "Esquema del grafo",
    description: "List the node labels and edge types available in this project's graph.",
    keys: [],
  },
  index_status: {
    title: "Estado del índice",
    description: "Freshness and size of the project's graph index.",
    keys: [],
  },
  detect_changes: {
    title: "Detectar cambios",
    description: "Report source files that changed since the graph was last indexed.",
    keys: ["scope", "depth", "base_branch", "since"],
  },
};

const DEFAULT_TIMEOUT_MS = 25_000;
/** Graph payloads can be enormous (a broad `search_code` or an unbounded
 *  Cypher). The stdio path clamped nothing and could blow the model's context
 *  in one call; brokering lets us cap it. */
const MAX_OUTPUT_CHARS = 28_000;
/** In-flight calls per conversation — a looping model must not exhaust the
 *  target's SSH channels. */
const MAX_INFLIGHT = 3;
const RESULT_TTL_MS = 90_000;
const RESULT_MAX = 200;

/** Approvals the user granted mid-run, so we ask once, not on every call. */
const grants = new Map<string, Set<string>>();
/** Read-result cache: the binary cold-starts on every call (it is a one-shot
 *  CLI invocation), so repeated lookups in one turn are what we must absorb. */
const results = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, number>();

function grantKey(conversationId: string): Set<string> {
  let s = grants.get(conversationId);
  if (!s) {
    s = new Set();
    grants.set(conversationId, s);
  }
  return s;
}

/** Forget a run's approvals and cached reads (run teardown). */
export function clearGraphRunState(conversationId: string): void {
  grants.delete(conversationId);
  graphScopeService.invalidate(conversationId);
}

function cacheGet(key: string): unknown | undefined {
  const hit = results.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > RESULT_TTL_MS) {
    results.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: unknown): void {
  if (results.size >= RESULT_MAX) {
    const oldest = results.keys().next().value;
    if (oldest) results.delete(oldest);
  }
  results.set(key, { at: Date.now(), value });
}

function clamp(value: unknown): unknown {
  const json = JSON.stringify(value);
  if (json === undefined || json.length <= MAX_OUTPUT_CHARS) return value;
  return {
    truncated: true,
    note: `Resultado recortado a ${MAX_OUTPUT_CHARS} caracteres. Acota la consulta (limit, file_pattern, max_rows).`,
    partial: json.slice(0, MAX_OUTPUT_CHARS),
  };
}

/** The `project` a call may run against, or an error/denial for the model. */
async function resolveProject(
  input: Record<string, unknown>,
  scope: GraphScope,
  conversationId: string,
  tool: string,
  requestApproval: GraphApprovalFn | undefined,
): Promise<{ ok: true; project: string } | { ok: false; output: string }> {
  const allowed = scope.projects.map((p) => p.graphName);
  const want = typeof input.project === "string" ? input.project.trim() : "";

  if (!want) {
    // Unambiguous → inject it. This is also what keeps a hardcoded default
    // (like the community module's "var-www-LUXIPANEL") from ever being used.
    if (allowed.length === 1) return { ok: true, project: allowed[0]! };
    return {
      ok: false,
      output: `Falta \`project\`. Proyectos disponibles para este agente: ${allowed.map((a) => `"${a}"`).join(", ")}.`,
    };
  }
  if (graphScopeService.allows(scope, want)) return { ok: true, project: want };

  // Out of scope. Already approved earlier in this run?
  if (grantKey(conversationId).has(want)) return { ok: true, project: want };

  if (!requestApproval) {
    return { ok: false, output: `El proyecto "${want}" no está asignado a este agente. Disponibles: ${allowed.map((a) => `"${a}"`).join(", ") || "ninguno"}.` };
  }

  let approved = false;
  try {
    approved = await requestApproval({ conversationId, tool, graphName: want, scope });
  } catch (err) {
    // Fail-SAFE deny: an approval we could not obtain is not an approval.
    log.warn({ err: (err as Error).message, conversationId, want }, "graph approval failed — denying");
    approved = false;
  }
  if (!approved) {
    return {
      ok: false,
      output: `El usuario no autorizó el acceso al grafo "${want}" (no está asignado a este agente). Disponibles: ${allowed.map((a) => `"${a}"`).join(", ") || "ninguno"}.`,
    };
  }
  grantKey(conversationId).add(want);
  return { ok: true, project: want };
}

/**
 * Build the scoped graph tools for one conversation. Returns `null` when the
 * target has no graph binary or the run has no graph in scope — in both cases
 * the run simply proceeds without the graph (grep/read still work), which is
 * the pre-existing behaviour for an unindexed project.
 */
export async function buildGraphToolsForConversation(args: {
  executor: Executor;
  conversationId: string;
  requestApproval?: GraphApprovalFn;
}): Promise<BuiltGraphTools | null> {
  const { executor, conversationId, requestApproval } = args;
  if (!conversationId) return null;

  const scope = await graphScopeService.resolve(executor, conversationId);
  if (scope.projects.length === 0) return null;

  const avail = await graphIndexService.probeAvailability(executor).catch(() => null);
  if (!avail?.available || !avail.binPath) return null;
  const bin = avail.binPath;

  const tools: AgentTool[] = [];

  // ── list_projects: SYNTHETIC. Never touches the binary. ───────────────────
  // This is the tool that used to be the oracle: pre-approved in the CLI's
  // allowlist and returning every graph on the box. Now it can only ever
  // describe the caller's own scope.
  tools.push({
    name: `${GRAPH_TOOL_PREFIX}list_projects`,
    title: "Proyectos indexados",
    description: "List the code-graph projects this agent may query.",
    kind: "read",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const fresh = await graphScopeService.resolve(executor, conversationId);
      return {
        ok: true,
        output: { projects: fresh.projects.map((p) => ({ name: p.graphName, root_path: p.path })) },
      };
    },
  });

  for (const [tool, spec] of Object.entries(READ_TOOLS)) {
    const properties: ToolInputSchema["properties"] = {
      project: { type: "string", description: `Graph project. One of: ${scope.projects.map((p) => p.graphName).join(", ")}.` },
    };
    for (const k of spec.keys) properties[k] = { type: "string" };

    tools.push({
      name: `${GRAPH_TOOL_PREFIX}${tool}`,
      title: spec.title,
      description: spec.description,
      kind: "read",
      inputSchema: { type: "object", properties },
      async handler(raw) {
        const input = (raw ?? {}) as Record<string, unknown>;
        const fresh = await graphScopeService.resolve(executor, conversationId);
        if (fresh.projects.length === 0) {
          return { ok: false, output: "Este agente no tiene ningún proyecto con grafo indexado." };
        }

        const decided = await resolveProject(input, fresh, conversationId, tool, requestApproval);
        if (!decided.ok) return { ok: false, output: decided.output };

        // Whitelist: only the keys this tool declares, plus the project we
        // decided on (never the one the model asked for, if it differs).
        const call: Record<string, unknown> = { project: decided.project };
        for (const k of spec.keys) {
          if (input[k] !== undefined) call[k] = input[k];
        }

        const key = `${executor.target.id || executor.target.name}|${tool}|${JSON.stringify(call)}`;
        const cached = cacheGet(key);
        if (cached !== undefined) return { ok: true, output: cached };

        const n = inflight.get(conversationId) ?? 0;
        if (n >= MAX_INFLIGHT) {
          return { ok: false, output: "Demasiadas consultas al grafo en paralelo. Reintenta en unos segundos." };
        }
        inflight.set(conversationId, n + 1);
        try {
          const out = await runGraphCli<unknown>(executor, bin, tool, call, spec.timeoutMs ?? DEFAULT_TIMEOUT_MS);
          const clamped = clamp(out);
          cacheSet(key, clamped);
          return { ok: true, output: clamped };
        } catch (err) {
          return { ok: false, output: `graph ${tool}: ${(err as Error).message}`.slice(0, 400) };
        } finally {
          const cur = inflight.get(conversationId) ?? 1;
          if (cur <= 1) inflight.delete(conversationId);
          else inflight.set(conversationId, cur - 1);
        }
      },
    });
  }

  return { tools, projects: scope.projects.map((p) => ({ name: p.graphName, path: p.path })) };
}

/** @internal — tests. */
export function _resetGraphToolState(): void {
  grants.clear();
  results.clear();
  inflight.clear();
}
