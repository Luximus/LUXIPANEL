import { shareAssistantReads } from "./load-coordinator";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";
import type { AssistantProviderId } from "./providers";
import type { AssistantProjectServer } from "./projects";
import type { AssistantSkillsMap } from "./skills";

// ── Custom agents (CLI-subagent style): system prompt + tool subset + model ──

/** Avataaars (DiceBear) avatar configuration — generated locally, never via
 *  HTTP. Attribute names/values follow the `avataaars` style schema of
 *  `@dicebear/avataaars`; unset attributes derive deterministically from the
 *  seed (or the agent id when there is no config at all). */
export interface AvatarConfig {
  seed?: string;
  top?: string;
  hairColor?: string;
  eyes?: string;
  eyebrows?: string;
  mouth?: string;
  skinColor?: string;
  clothing?: string;
  clothesColor?: string;
  accessories?: string;
  facialHair?: string;
  facialHairColor?: string;
}

export interface AssistantAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: AssistantProviderId;
  /** Extra providers for multi-agent fan-out (work with several at once). */
  providerIds?: AssistantProviderId[];
  /** "multi" replicates this same agent N times in parallel; "single" = one. */
  agentMode?: "single" | "multi";
  /** Multi mode: number of copies of this agent to deploy in parallel (2–8). */
  multiAgentCount?: number;
  model: string;
  /** Allowed tool names; null = no restriction (every permitted tool). */
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  /** Avataaars configuration (locally generated); absent = derived from id. */
  avatarConfig?: AvatarConfig;
  /** Working directories (absolute paths) announced to the agent. */
  projectPaths?: string[];
  /** Remote servers the agent may act on (servers.* tools). */
  servers?: AssistantProjectServer[];
  /** Attached projects — any node of the tree; a parent implies its subtree. */
  projectIds?: string[];
  /** Proyectos cuyo índice del grafo de código usa este agente (solo cuentan
   *  los que tengan graphIndex.status === "ready" en el target). */
  graphProjectIds?: string[];
  /** Save run summaries to the attached project's Obsidian vault. */
  autoCapture?: boolean;
  /** Per-agent skill override (only in this agent's chats), layered over global. */
  skills?: AssistantSkillsMap;
  /** Assigned role id (reusable profile layered under the agent). null = none. */
  roleId?: string | null;
  /** Assigned first-class team id. `undefined` = never assigned (backfill
   *  candidate); `null` = explicitly removed; string = member of that team. */
  teamId?: string | null;
  /** Superior ("parent") agent id — this agent is subordinate to it. null = top. */
  parentAgentId?: string | null;
  /** True if this agent has ≥1 direct subordinate (server-derived). */
  isTeamLeader?: boolean;
  /** Ids of this agent's DIRECT subordinates (server-derived). */
  subordinateIds?: string[];
  /** Owning project (id + display name), server-populated ONLY for a team/project
   *  leader (Líder de Proyecto). `undefined`/`null` for subordinates and loose
   *  agents. Additive contract: consume defensively (`agent.project?.name`). */
  project?: { id: string; name: string } | null;
  /** Connected peer agent ids (bidirectional channel for delegation/info). */
  connections?: string[];
  /** Supervisor permission: may open real chats for its subordinates (chats.create).
   *  Effective if this OR its role grants it. */
  canSpawnChats?: boolean;
  /** Low-latency real-time session enabled (only for realtime-capable providers). */
  realtime?: boolean;
  /** Provenance: team template this agent was materialised from (if any). */
  templateId?: string;
  /** Provenance: the template slot/node this agent covers. */
  templateNodeKey?: string;
  /** Credencial de pruebas ÚNICA (login QA) — SIEMPRE redactada por la API:
   *  el secret nunca viaja al cliente, solo `hasSecret`. */
  credential?: { label?: string; username: string; hasSecret: true } | null;
  /** Pre-filtro de snippets de terminal: NOMBRE de categoría. Vacío/ausente = sin filtro. */
  snippetCategory?: string;
  /** Pre-filtro de snippets de terminal: NOMBRES de tags de esa categoría. */
  snippetTags?: string[];
  createdAt?: string;
  updatedAt?: string;
  ownerId?: number | null;
  relation?: "owner" | "shared";
  ownerName?: string | null;
}

/**
 * Derive a "work group" key from an agent's display name. Convention: a name
 * shaped as "Team · Role" (e.g. "PTFL · Arquitecto Backend") belongs to the
 * "PTFL" work group; the part before " · " (U+00B7, surrounded by single
 * spaces) is the group label. Names without that separator fall back to
 * "General". This lets the Dashboard and Agents tabs bucket agents by their
 * work team without persisting an extra field.
 */
export function agentWorkGroupKey(agent: Pick<AssistantAgent, "name"> | { name?: string | null }): string {
  const name = (agent?.name ?? "").trim();
  if (!name) return "General";
  // Match the explicit " · " (middle dot, single spaces) separator used by
  // existing agents. This avoids false positives from regular names like
  // "Bell · Roy" only by requiring BOTH spaces — tight enough for our data.
  const idx = name.indexOf(" · ");
  if (idx <= 0) return "General";
  const prefix = name.slice(0, idx).trim();
  return prefix || "General";
}

/** Stable display order for known work groups (alphabetical, "General" last). */
export function orderWorkGroupKeys(keys: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (k !== "General") out.push(k);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (seen.has("General")) out.push("General");
  return out;
}

/**
 * Rank agents within a single work group by hierarchy depth so the UI can show
 * a small numeric badge ("1" = head of the group, "2" = direct subordinate,
 * etc.) without persisting anything new. BFS over `parentAgentId` edges
 * scoped to the supplied list:
 *   - A "root" is any agent with no `parentAgentId` OR whose parent lives
 *     OUTSIDE this group (e.g. an external supervisor) — so the head of the
 *     group is always `1`, never an outside boss.
 *   - Ties at the same level (multiple roots, or siblings under the same
 *     parent) break alphabetically by `name` for a stable, predictable order.
 *   - Defensive: cycles and orphans (parent in-group but unreachable from any
 *     root) get the next free rank after BFS, again alphabetically, so they
 *     still appear instead of being dropped.
 */
export function rankAgentsInGroup(agents: AssistantAgent[]): Map<string, number> {
  const ranks = new Map<string, number>();
  if (agents.length === 0) return ranks;
  const byId = new Map<string, AssistantAgent>();
  for (const a of agents) byId.set(a.id, a);
  const groupIds = new Set(byId.keys());

  // Roots: no parent, or parent outside this group.
  const roots = agents
    .filter((a) => !a.parentAgentId || !groupIds.has(a.parentAgentId))
    .map((a) => a.id)
    .sort((x, y) =>
      (byId.get(x)?.name ?? "").localeCompare(byId.get(y)?.name ?? "", undefined, { sensitivity: "base" }),
    );

  // BFS: rank 1 = root, 2 = child of root, etc.
  const queue: { id: string; rank: number }[] = roots.map((id) => ({ id, rank: 1 }));
  // Pre-index children-by-parent for O(1) lookups instead of N scans per node.
  const childrenOf = new Map<string, string[]>();
  for (const a of agents) {
    if (a.parentAgentId && groupIds.has(a.parentAgentId)) {
      const arr = childrenOf.get(a.parentAgentId) ?? [];
      arr.push(a.id);
      childrenOf.set(a.parentAgentId, arr);
    }
  }
  for (const [, arr] of childrenOf) {
    arr.sort((x, y) =>
      (byId.get(x)?.name ?? "").localeCompare(byId.get(y)?.name ?? "", undefined, { sensitivity: "base" }),
    );
  }

  while (queue.length) {
    const { id, rank } = queue.shift()!;
    if (ranks.has(id)) continue; // cycle guard — keep first rank we assigned
    ranks.set(id, rank);
    for (const childId of childrenOf.get(id) ?? []) {
      if (!ranks.has(childId)) queue.push({ id: childId, rank: rank + 1 });
    }
  }

  // Orphans / unreachable (parent in group but in a cycle that excluded them):
  // append after BFS, alphabetic, with the next free rank so they still render.
  const orphans = agents.filter((a) => !ranks.has(a.id));
  if (orphans.length > 0) {
    const maxRank = Math.max(0, ...Array.from(ranks.values()));
    orphans
      .map((a) => a.id)
      .sort((x, y) =>
        (byId.get(x)?.name ?? "").localeCompare(byId.get(y)?.name ?? "", undefined, { sensitivity: "base" }),
      )
      .forEach((id, i) => ranks.set(id, maxRank + 1 + i));
  }
  return ranks;
}

/**
 * The "leader" agent(s) of every work group: rank-1 agents per group (by
 * `agentWorkGroupKey` + `rankAgentsInGroup`). Named teams ("PTFL · X") yield
 * their head; the "General" bucket (ungrouped agents with no hierarchy) yields
 * each standalone agent as its own leader. Ordered by `orderWorkGroupKeys`,
 * then alphabetically within a group. Powers the Dashboard leader buttons and
 * the "Líderes de proyecto" tab.
 */
export function leaderAgentsOf(agents: AssistantAgent[]): AssistantAgent[] {
  const groups = new Map<string, AssistantAgent[]>();
  for (const a of agents) {
    const key = agentWorkGroupKey(a);
    const arr = groups.get(key) ?? [];
    arr.push(a);
    groups.set(key, arr);
  }
  const out: AssistantAgent[] = [];
  for (const key of orderWorkGroupKeys(groups.keys())) {
    const list = groups.get(key) ?? [];
    if (list.length === 0) continue;
    const ranks = rankAgentsInGroup(list);
    const leaders = list
      .filter((a) => ranks.get(a.id) === 1)
      .sort((x, y) => (x.name ?? "").localeCompare(y.name ?? "", undefined, { sensitivity: "base" }));
    out.push(...leaders);
  }
  return out;
}

export type AgentPayload = {
  name: string;
  description: string;
  systemPrompt: string;
  providerId: AssistantProviderId;
  providerIds?: AssistantProviderId[];
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
  model: string;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  avatarConfig?: AvatarConfig;
  projectPaths?: string[];
  servers?: AssistantProjectServer[];
  projectIds?: string[];
  graphProjectIds?: string[];
  autoCapture?: boolean;
  skills?: AssistantSkillsMap;
  roleId?: string | null;
  teamId?: string | null;
  parentAgentId?: string | null;
  connections?: string[];
  canSpawnChats?: boolean;
  realtime?: boolean;
  /** Credencial de pruebas: objeto = reemplazar, null = quitar, ausente = conservar. */
  credential?: { label?: string; username: string; secret: string } | null;
  /** Pre-filtro de snippets de terminal (nombre de categoría; "" = sin filtro). */
  snippetCategory?: string;
  /** Pre-filtro de snippets de terminal (nombres de tags de la categoría). */
  snippetTags?: string[];
};

/** Provider ids with a low-latency real-time session API (OpenAI Realtime via
 *  `codex`, Gemini Live). Mirrors REALTIME_CAPABLE_PROVIDERS in the backend. */
export const REALTIME_PROVIDERS: readonly AssistantProviderId[] = ["codex", "gemini"];

/** El error de validación del backend ("Invalid body") llega con `details:
 *  [{field, message}]` en el cuerpo; anexarlos al mensaje para que el editor
 *  muestre QUÉ campo falló en vez de un genérico. */
function agentApiError(res: { error?: string; data?: unknown }, fallback: string): string {
  const base = res.error ?? fallback;
  const details = (res.data as { details?: Array<{ field?: string; message?: string }> } | undefined)?.details;
  const fields = Array.isArray(details)
    ? details.map((d) => [d.field, d.message].filter(Boolean).join(": ")).filter(Boolean).join(" · ")
    : "";
  return fields ? `${base} — ${fields}` : base;
}

export const assistantAgentsApi = {
  async list(): Promise<AssistantAgent[]> {
    const res = await api.catalog<{ ok: boolean; agents: AssistantAgent[] }>("/api/ai/agents");
    return unwrap(res, "Failed to load agents").agents;
  },
  async create(data: AgentPayload): Promise<AssistantAgent> {
    const res = await api.post<{ ok: boolean; agent: AssistantAgent }>("/api/ai/agents", data);
    if (!res.ok || !res.data) throw new Error(agentApiError(res, "Failed to create agent"));
    return res.data.agent;
  },
  async update(id: string, data: Partial<AgentPayload>): Promise<AssistantAgent> {
    const res = await api.put<{ ok: boolean; agent: AssistantAgent }>(`/api/ai/agents/${id}`, data);
    if (!res.ok || !res.data) throw new Error(agentApiError(res, "Failed to update agent"));
    return res.data.agent;
  },
  async remove(id: string): Promise<void> {
    const res = await api.delete(`/api/ai/agents/${id}`);
    if (!res.ok) throw new Error(res.error ?? "Failed to delete agent");
  },
  /** AI-assisted draft from a short brief / quick archetype. */
  async suggest(brief: string, providerId?: AssistantProviderId): Promise<AgentSuggestion> {
    const res = await api.post<{ ok: boolean; suggestion: AgentSuggestion }>(
      "/api/ai/agents/suggest",
      { brief, ...(providerId ? { providerId } : {}) },
    );
    return unwrap(res, "No se pudo generar el agente").suggestion;
  },
};

export interface AgentSuggestion {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[] | null;
  providerId?: AssistantProviderId;
}

// ── Agent ROLES (reusable profile assigned to agents) ────────────────────────

export interface AssistantAgentRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  /** Default allowed tool names; null = no cap from the role. */
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  /** Cargo permission: agents with this role may open chats for subordinates. */
  canSpawnChats?: boolean;
  createdAt?: string;
  updatedAt?: string;
  ownerId?: number | null;
  relation?: "owner" | "shared";
  ownerName?: string | null;
}

export type AgentRolePayload = {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  canSpawnChats?: boolean;
};

export const assistantAgentRolesApi = {
  async list(): Promise<AssistantAgentRole[]> {
    const res = await api.catalog<{ ok: boolean; roles: AssistantAgentRole[] }>("/api/ai/agent-roles");
    return unwrap(res, "Failed to load roles").roles;
  },
  async create(data: AgentRolePayload): Promise<AssistantAgentRole> {
    const res = await api.post<{ ok: boolean; role: AssistantAgentRole }>("/api/ai/agent-roles", data);
    return unwrap(res, "Failed to create role").role;
  },
  async update(id: string, data: Partial<AgentRolePayload>): Promise<AssistantAgentRole> {
    const res = await api.put<{ ok: boolean; role: AssistantAgentRole }>(`/api/ai/agent-roles/${id}`, data);
    return unwrap(res, "Failed to update role").role;
  },
  async remove(id: string): Promise<void> {
    const res = await api.delete(`/api/ai/agent-roles/${id}`);
    if (!res.ok) throw new Error(res.error ?? "Failed to delete role");
  },
};

// ── Agent TEAMS (first-class grouping of agents) ─────────────────────────────
// Named teams the user creates to bucket agents in the Agents tab, replacing the
// legacy name-prefix convention (`agentWorkGroupKey`) with a real, persisted
// entity. Membership lives on the agent (`teamId`); deleting a team only
// detaches its members (never deletes agents). Calco de assistantAgentRolesApi.

export interface AgentTeam {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  /** null = global (visible to everyone); a user id = owned by that user. */
  ownerId?: number | null;
  relation?: "owner" | "shared";
  ownerName?: string | null;
  /** Server-derived count of agents currently assigned to this team. */
  memberCount?: number;
}

export type AgentTeamPayload = {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
};

export const assistantAgentTeamsApi = {
  async list(): Promise<AgentTeam[]> {
    const res = await api.get<{ ok: boolean; teams: AgentTeam[] }>("/api/ai/agent-teams");
    return unwrap(res, "Failed to load teams").teams;
  },
  async get(id: string): Promise<AgentTeam> {
    const res = await api.get<{ ok: boolean; team: AgentTeam }>(`/api/ai/agent-teams/${id}`);
    return unwrap(res, "Failed to load team").team;
  },
  async create(data: AgentTeamPayload): Promise<AgentTeam> {
    const res = await api.post<{ ok: boolean; team: AgentTeam }>("/api/ai/agent-teams", data);
    return unwrap(res, "Failed to create team").team;
  },
  async update(id: string, data: Partial<AgentTeamPayload>): Promise<AgentTeam> {
    const res = await api.put<{ ok: boolean; team: AgentTeam }>(`/api/ai/agent-teams/${id}`, data);
    return unwrap(res, "Failed to update team").team;
  },
  async remove(id: string): Promise<number> {
    const res = await api.delete<{ ok: boolean; detachedCount: number }>(`/api/ai/agent-teams/${id}`);
    if (!res.ok) throw new Error(res.error ?? "Failed to delete team");
    return res.data?.detachedCount ?? 0;
  },
};

/**
 * Bucket an agent for the Agents-tab grouping. First-class teams take
 * precedence: if the agent has a `teamId` present in `teamsById`, it lands in
 * the `team:${id}` bucket (label = the team's name, and a ref to the team).
 * Otherwise it falls back to the legacy name-prefix `agentWorkGroupKey`. NEVER
 * mutate `agentWorkGroupKey` — DashboardTab and ChatPane still consume it.
 */
export function agentGroupBucket(
  agent: Pick<AssistantAgent, "name" | "teamId">,
  teamsById: Map<string, AgentTeam>,
): { key: string; label: string; team?: AgentTeam } {
  const teamId = agent.teamId;
  if (teamId && teamsById.has(teamId)) {
    const team = teamsById.get(teamId)!;
    return { key: `team:${teamId}`, label: team.name, team };
  }
  const legacy = agentWorkGroupKey(agent);
  return { key: legacy, label: legacy };
}

/**
 * Group an arbitrary SUBSET of agents into ordered, NON-EMPTY buckets for the
 * agent-editor pickers (connections checklist, "superior" selector) and the
 * team member pickers. Uses the SAME bucketing as the main Agents-tab list
 * (`agentGroupBucket` → first-class `teamId`, else legacy name-prefix) so the
 * editor never diverges from the list — but here EMPTY teams are omitted (they
 * only add noise in a picker; the caller passes the exact candidate subset).
 * Order mirrors the list: teams/legacy groups alphabetical by label, and the
 * ungrouped legacy "General" bucket ("Sueltos") always last.
 */
export function groupAgentsForPicker(
  agents: AssistantAgent[],
  teamsById: Map<string, AgentTeam>,
): { key: string; label: string; team?: AgentTeam; agents: AssistantAgent[] }[] {
  const groups = new Map<string, { key: string; label: string; team?: AgentTeam; agents: AssistantAgent[] }>();
  for (const a of agents) {
    const b = agentGroupBucket(a, teamsById);
    const existing = groups.get(b.key);
    if (existing) existing.agents.push(a);
    else groups.set(b.key, { key: b.key, label: b.label, team: b.team, agents: [a] });
  }
  return [...groups.values()].sort((x, y) => {
    const xGen = x.key === "General";
    const yGen = y.key === "General";
    if (xGen !== yGen) return xGen ? 1 : -1;
    return x.label.localeCompare(y.label, undefined, { sensitivity: "base" });
  });
}

shareAssistantReads(assistantAgentsApi, "assistantAgentsApi");
shareAssistantReads(assistantAgentRolesApi, "assistantAgentRolesApi");
