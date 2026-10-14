import { directAi, directAiOk } from "../../../../api/assistantDirect";

export type AgentResource = {
  id: string;
  name: string;
};

// ----- Tipos compartidos con el portal (assistant agents) -----

export type AssistantProviderId =
  | "claude"
  | "codex"
  | "gemini"
  | "deepseek"
  | "grok"
  | "minimax";

export type AssistantAgent = {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  providerId: AssistantProviderId;
  providerIds?: AssistantProviderId[];
  model?: string;
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  roleId?: string | null;
  teamId?: string | null;
  parentAgentId?: string | null;
  connections?: string[];
  canSpawnChats?: boolean;
  realtime?: boolean;
  relation?: "owner" | "shared";
  ownerName?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AgentPayload = {
  name: string;
  description: string;
  systemPrompt: string;
  providerId: AssistantProviderId;
  providerIds?: AssistantProviderId[];
  model: string;
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  roleId?: string | null;
  teamId?: string | null;
  parentAgentId?: string | null;
  connections?: string[];
  canSpawnChats?: boolean;
  realtime?: boolean;
};

export type AgentRole = {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  canSpawnChats?: boolean;
  relation?: "owner" | "shared";
  ownerName?: string | null;
};

export type AgentRolePayload = {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  canSpawnChats?: boolean;
};

export type AgentTeam = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  memberCount?: number;
  relation?: "owner" | "shared";
  ownerName?: string | null;
};

export type AgentTeamPayload = {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
};

export type TeamTemplateCategory = {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  tags?: Array<{ id: string; label: string; hint?: string }>;
};

export type TeamTemplateSummary = {
  id: string;
  category: string;
  tags?: string[];
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  defaultProvider?: AssistantProviderId;
  defaultModel?: string;
  slotCount?: number;
  slots?: Array<{ slotId: string; name: string; description?: string; parentSlotId?: string | null }>;
};

export type TeamTemplate = TeamTemplateSummary & {
  slots: Array<{
    slotId: string;
    name: string;
    description?: string;
    systemPrompt?: string;
    parentSlotId?: string | null;
    allowedTools?: string[] | null;
  }>;
};

export type ProviderSummary = {
  id: string;
  mode?: string;
  model?: string;
  installed?: boolean;
  loggedIn?: boolean;
  hasApiKey?: boolean;
  apiKeyHint?: string;
  active?: boolean;
};

// ----- Helpers -----

function toResources(value: unknown): AgentResource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const name = [item.name, item.label, item.displayName, item.id]
      .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
    return id && name ? [{ id, name }] : [];
  });
}

async function listResource(
  serverId: string,
  path: `/api/ai/${"agents" | "agent-roles" | "agent-teams" | "providers"}`,
  key: "agents" | "roles" | "teams" | "providers",
): Promise<AgentResource[]> {
  const response = await directAi<Record<string, unknown>>(serverId, "GET", path);
  if (!response) throw new Error(`No se pudo cargar ${key}.`);
  return toResources(response[key]);
}

export function listAgents(serverId: string): Promise<AgentResource[]> {
  return listResource(serverId, "/api/ai/agents", "agents");
}

export function listRoles(serverId: string): Promise<AgentResource[]> {
  return listResource(serverId, "/api/ai/agent-roles", "roles");
}

export function listTeams(serverId: string): Promise<AgentResource[]> {
  return listResource(serverId, "/api/ai/agent-teams", "teams");
}

export function listProviders(serverId: string): Promise<AgentResource[]> {
  return listResource(serverId, "/api/ai/providers", "providers");
}

// ----- CRUD completo (mismas rutas y payloads que el portal, ahora directas al box) -----

export const agentsApi = {
  async list(serverId: string): Promise<AssistantAgent[]> {
    const body = await directAi<{ agents?: AssistantAgent[] }>(serverId, "GET", "/api/ai/agents");
    return Array.isArray(body?.agents) ? body!.agents! : [];
  },
  async create(serverId: string, payload: AgentPayload): Promise<AssistantAgent> {
    const body = await directAi<{ agent?: AssistantAgent }>(serverId, "POST", "/api/ai/agents", payload);
    if (!body?.agent) throw new Error("El panel no devolvió el agente creado.");
    return body.agent;
  },
  async update(serverId: string, id: string, payload: Partial<AgentPayload>): Promise<AssistantAgent> {
    const body = await directAi<{ agent?: AssistantAgent }>(
      serverId,
      "PUT",
      `/api/ai/agents/${encodeURIComponent(id)}`,
      payload,
    );
    if (!body?.agent) throw new Error("El panel no devolvió el agente actualizado.");
    return body.agent;
  },
  async remove(serverId: string, id: string): Promise<void> {
    await directAiOk(serverId, "DELETE", `/api/ai/agents/${encodeURIComponent(id)}`);
  },
};

export const rolesApi = {
  async list(serverId: string): Promise<AgentRole[]> {
    const body = await directAi<{ roles?: AgentRole[] }>(serverId, "GET", "/api/ai/agent-roles");
    return Array.isArray(body?.roles) ? body!.roles! : [];
  },
  async create(serverId: string, payload: AgentRolePayload): Promise<AgentRole> {
    const body = await directAi<{ role?: AgentRole }>(serverId, "POST", "/api/ai/agent-roles", payload);
    if (!body?.role) throw new Error("El panel no devolvió el rol creado.");
    return body.role;
  },
  async update(serverId: string, id: string, payload: Partial<AgentRolePayload>): Promise<AgentRole> {
    const body = await directAi<{ role?: AgentRole }>(
      serverId,
      "PUT",
      `/api/ai/agent-roles/${encodeURIComponent(id)}`,
      payload,
    );
    if (!body?.role) throw new Error("El panel no devolvió el rol actualizado.");
    return body.role;
  },
  async remove(serverId: string, id: string): Promise<void> {
    await directAiOk(serverId, "DELETE", `/api/ai/agent-roles/${encodeURIComponent(id)}`);
  },
};

export const teamsApi = {
  async list(serverId: string): Promise<AgentTeam[]> {
    const body = await directAi<{ teams?: AgentTeam[] }>(serverId, "GET", "/api/ai/agent-teams");
    return Array.isArray(body?.teams) ? body!.teams! : [];
  },
  async create(serverId: string, payload: AgentTeamPayload): Promise<AgentTeam> {
    const body = await directAi<{ team?: AgentTeam }>(serverId, "POST", "/api/ai/agent-teams", payload);
    if (!body?.team) throw new Error("El panel no devolvió el equipo creado.");
    return body.team;
  },
  async update(serverId: string, id: string, payload: Partial<AgentTeamPayload>): Promise<AgentTeam> {
    const body = await directAi<{ team?: AgentTeam }>(
      serverId,
      "PUT",
      `/api/ai/agent-teams/${encodeURIComponent(id)}`,
      payload,
    );
    if (!body?.team) throw new Error("El panel no devolvió el equipo actualizado.");
    return body.team;
  },
  async remove(serverId: string, id: string): Promise<{ detachedCount?: number } | null> {
    const body = await directAi<{ detachedCount?: number }>(
      serverId,
      "DELETE",
      `/api/ai/agent-teams/${encodeURIComponent(id)}`,
    );
    return body ?? null;
  },
};

export const templatesApi = {
  async list(
    serverId: string,
  ): Promise<{ categories: TeamTemplateCategory[]; templates: TeamTemplateSummary[] }> {
    const body = await directAi<{
      categories?: TeamTemplateCategory[];
      templates?: TeamTemplateSummary[];
    }>(serverId, "GET", "/api/ai/team-templates");
    return {
      categories: Array.isArray(body?.categories) ? body!.categories! : [],
      templates: Array.isArray(body?.templates) ? body!.templates! : [],
    };
  },
  async get(serverId: string, id: string): Promise<TeamTemplate | null> {
    const body = await directAi<{ template?: TeamTemplate }>(
      serverId,
      "GET",
      `/api/ai/team-templates/${encodeURIComponent(id)}`,
    );
    return body?.template ?? null;
  },
  async apply(
    serverId: string,
    id: string,
    namePrefix?: string,
  ): Promise<{ agents: AssistantAgent[]; createdIds: string[] }> {
    const body = await directAi<{ agents?: AssistantAgent[]; createdIds?: string[] }>(
      serverId,
      "POST",
      `/api/ai/team-templates/${encodeURIComponent(id)}/apply`,
      namePrefix?.trim() ? { namePrefix: namePrefix.trim() } : {},
    );
    return { agents: body?.agents ?? [], createdIds: body?.createdIds ?? [] };
  },
};
