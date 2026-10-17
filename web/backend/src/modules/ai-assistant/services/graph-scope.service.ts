import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { type AssistantProject } from "../repositories/projects.repository.js";
import { resolveAgentContext } from "./agent-context.service.js";

const log = createModuleLogger("ai-assistant:graph-scope");

/** A graph the run is allowed to query, and the project it came from. */
export interface GraphScopeProject {
  /** Project name inside the code graph (e.g. "var-www-LUXIPANEL"). */
  graphName: string;
  /** Filesystem root of that project on the target. */
  path: string;
  /** Assistant project id that owns it. */
  projectId: string;
}

export interface GraphScope {
  /** Agent the conversation is bound to, or null for a plain human chat. */
  agentId: string | null;
  /** Graphs this run may query WITHOUT asking the user. */
  projects: GraphScopeProject[];
  /** Filesystem roots of `projects` (path validation for anything path-shaped). */
  roots: string[];
}

const EMPTY: GraphScope = { agentId: null, projects: [], roots: [] };

/** Only projects with a graph that is actually built and queryable. */
function toScopeProjects(projects: AssistantProject[]): GraphScopeProject[] {
  const out: GraphScopeProject[] = [];
  const seen = new Set<string>();
  for (const p of projects) {
    const gi = p.graphIndex;
    if (!gi?.enabled || gi.status !== "ready" || !gi.project || !p.path || !p.id) continue;
    if (seen.has(gi.project)) continue;
    seen.add(gi.project);
    out.push({ graphName: gi.project, path: p.path, projectId: p.id });
  }
  return out;
}

// Scope is revalidated per call; revocation never waits for a TTL.
export const graphScopeService = {
  /**
   * Resolve which code graphs a conversation may query. This is the AUTHORITY:
   * it derives everything from server-side state (the signed conversationId →
   * the conversation's sidecar → the agent's sidecar), never from anything the
   * model can influence. The model supplies only tool ARGUMENTS, and those are
   * what gets validated against this scope.
   *
   * Rules:
   *  • One active project and its authorized descendants, subject to profile
   *    and assignment graph limits. Conflicting/removed scopes fail closed.
   *  • Ancestor and other-root graphs are never implicitly included.
   *  • No project / no ready graph yields an empty scope.
   */
  async resolve(executor: Executor | null | undefined, conversationId: string): Promise<GraphScope> {
    if (!conversationId) return EMPTY;
    let scope: GraphScope = EMPTY;
    try {
      const meta = await conversationsRepository.getMeta(executor, conversationId);
      const agentId = meta?.agentId ?? null;
      const context = await resolveAgentContext(executor, agentId, meta?.projectId);
      const projects = toScopeProjects(context.contextProjects.filter(p => !context.agent || context.agent.graphProjectIds?.includes(p.id!)));
      scope = { agentId, projects, roots: projects.map(p => p.path) };
    } catch (err) {
      // Fail-CLOSED. A scope we cannot prove is a scope we do not grant: the
      // caller turns an empty scope into "no graph for this run", never into
      // "all graphs".
      log.warn({ err: (err as Error).message, conversationId }, "graph scope resolution failed — denying graph access");
      scope = EMPTY;
    }

    return scope;
  },

  /** Is `graphName` inside this scope? */
  allows(scope: GraphScope, graphName: string): boolean {
    return scope.projects.some((p) => p.graphName === graphName);
  },

  /** Drop a conversation's cached scope (project/agent edits, run teardown). */
  invalidate(_conversationId: string): void {},

  /** @internal — tests. */
  _clearCache(): void {},
};
