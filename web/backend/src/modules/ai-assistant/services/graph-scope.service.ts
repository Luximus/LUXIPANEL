import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { projectsRepository, type AssistantProject } from "../repositories/projects.repository.js";
import { projectClosure } from "./project-closure.js";

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

// Per-conversation cache. Without it every single graph tool call would re-read
// two sidecars over SSH (conversation meta + agent + projects). Short TTL: an
// agent's projects change rarely, and a stale grant window of 60s is acceptable
// because narrowing a scope mid-run is not a security-critical transition (a
// WIDENED scope only takes effect a minute later, which is the safe direction).
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; scope: GraphScope }>();

export const graphScopeService = {
  /**
   * Resolve which code graphs a conversation may query. This is the AUTHORITY:
   * it derives everything from server-side state (the signed conversationId →
   * the conversation's sidecar → the agent's sidecar), never from anything the
   * model can influence. The model supplies only tool ARGUMENTS, and those are
   * what gets validated against this scope.
   *
   * Rules:
   *  • Agent-bound run  → the transitive closure of `agent.projectIds`. If the
   *    conversation ALSO carries a projectId, it must belong to that closure;
   *    otherwise it is ignored (the agent's assignment wins). Letting the
   *    conversation's project widen the scope would reopen the hole from behind.
   *  • Plain chat       → the conversation's project plus its descendants.
   *    ANCESTORS ARE DELIBERATELY EXCLUDED: an ancestor of a subproject is how
   *    the monorepo root (`/var/www`) would end up silently in scope. Reaching
   *    an ancestor's graph now requires an explicit user approval.
   *  • No project / no graph ready → empty scope (fail-closed: no graph at all).
   */
  async resolve(executor: Executor | null | undefined, conversationId: string): Promise<GraphScope> {
    if (!conversationId) return EMPTY;
    const hit = cache.get(conversationId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.scope;

    let scope: GraphScope = EMPTY;
    try {
      const meta = await conversationsRepository.getMeta(executor, conversationId);
      const agentId = meta?.agentId ?? null;
      const all = await projectsRepository.list(executor);

      if (agentId) {
        const agent = await agentsRepository.get(agentId);
        const rootIds = agent?.projectIds ?? [];
        if (rootIds.length > 0) {
          const closure = projectClosure(all, rootIds);
          const projects = toScopeProjects(all.filter((p) => p.id && closure.has(p.id)));
          scope = { agentId, projects, roots: projects.map((p) => p.path) };
        } else {
          // Agent with no projects attached: it inherits the conversation's
          // project (that is where it was told to work), but nothing wider.
          scope = { ...conversationScope(all, meta?.projectId ?? null), agentId };
        }
      } else {
        scope = conversationScope(all, meta?.projectId ?? null);
      }
    } catch (err) {
      // Fail-CLOSED. A scope we cannot prove is a scope we do not grant: the
      // caller turns an empty scope into "no graph for this run", never into
      // "all graphs".
      log.warn({ err: (err as Error).message, conversationId }, "graph scope resolution failed — denying graph access");
      scope = EMPTY;
    }

    cache.set(conversationId, { at: Date.now(), scope });
    return scope;
  },

  /** Is `graphName` inside this scope? */
  allows(scope: GraphScope, graphName: string): boolean {
    return scope.projects.some((p) => p.graphName === graphName);
  },

  /** Drop a conversation's cached scope (project/agent edits, run teardown). */
  invalidate(conversationId: string): void {
    cache.delete(conversationId);
  },

  /** @internal — tests. */
  _clearCache(): void {
    cache.clear();
  },
};

/** Conversation project + its descendants. No ancestors — see `resolve` docs. */
function conversationScope(all: AssistantProject[], projectId: string | null): GraphScope {
  if (!projectId) return EMPTY;
  const closure = projectClosure(all, [projectId]);
  const projects = toScopeProjects(all.filter((p) => p.id && closure.has(p.id)));
  return { agentId: null, projects, roots: projects.map((p) => p.path) };
}
