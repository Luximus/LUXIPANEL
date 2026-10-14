// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cliente de red del módulo "Agentes IA" (réplica nativa). TODA llamada a
 * `/api/ai/*` pasa por `luxAssistantProxy` (túnel SSO al backend del asistente
 * de LUXIPANEL). Cada objeto agrupa un recurso; sus funciones son
 * `(panelId, token, ...args)` y devuelven el cuerpo ya desenvuelto del backend
 * web (el proxy retorna `{ ok, ... }` o `null` en fallo).
 *
 * Los payloads CALCAN el schema del backend web (ver WEB/assistant-api.ts):
 * en `AgentPayload.credential`, objeto = reemplazar, null = quitar, ausente =
 * conservar.
 */
import { luxAssistantProxy } from "../../../api/client";
import type {
  AssistantAgent,
  AgentPayload,
  AgentRole,
  AgentRolePayload,
  AgentSuggestion,
  AgentTeam,
  AgentTeamPayload,
  AssistantProviderId,
  AssistantProject,
  AssistantProjectGraphIndex,
  AgentResolvedModule,
  RegisteredServerView,
  RegisteredServerPayload,
  TeamTemplateCategoryDef,
  TeamTemplateSummary,
  TeamTemplate,
  ApplyRequest,
  ApplyResult,
  TeamTemplateResyncResult,
  TeamTemplateFeedbackStats,
} from "../types";
import type { AssistantSkill } from "../types";

// ── Agentes ──────────────────────────────────────────────────────────────────

export const agentsApi = {
  async list(panelId: string, token: string): Promise<AssistantAgent[]> {
    const body = await luxAssistantProxy<{ agents?: AssistantAgent[] }>(panelId, token, "GET", "/api/ai/agents");
    return Array.isArray(body?.agents) ? body!.agents : [];
  },
  async create(panelId: string, token: string, data: AgentPayload): Promise<AssistantAgent | null> {
    const body = await luxAssistantProxy<{ agent?: AssistantAgent }>(panelId, token, "POST", "/api/ai/agents", data);
    return body?.agent ?? null;
  },
  async update(
    panelId: string,
    token: string,
    id: string,
    data: Partial<AgentPayload>,
  ): Promise<AssistantAgent | null> {
    const body = await luxAssistantProxy<{ agent?: AssistantAgent }>(
      panelId,
      token,
      "PUT",
      `/api/ai/agents/${id}`,
      data,
    );
    return body?.agent ?? null;
  },
  /** Borra un agente. Devuelve `true` si el proxy no fue null (éxito). */
  async remove(panelId: string, token: string, id: string): Promise<boolean> {
    const body = await luxAssistantProxy(panelId, token, "DELETE", `/api/ai/agents/${id}`);
    return body !== null;
  },
  /** Borrador asistido por IA desde un brief corto / arquetipo rápido. */
  async suggest(
    panelId: string,
    token: string,
    brief: string,
    providerId?: AssistantProviderId,
  ): Promise<AgentSuggestion | null> {
    const body = await luxAssistantProxy<{ suggestion?: AgentSuggestion }>(
      panelId,
      token,
      "POST",
      "/api/ai/agents/suggest",
      { brief, ...(providerId ? { providerId } : {}) },
    );
    return body?.suggestion ?? null;
  },
};

// ── Roles de agente ──────────────────────────────────────────────────────────

export const agentRolesApi = {
  async list(panelId: string, token: string): Promise<AgentRole[]> {
    const body = await luxAssistantProxy<{ roles?: AgentRole[] }>(panelId, token, "GET", "/api/ai/agent-roles");
    return Array.isArray(body?.roles) ? body!.roles : [];
  },
  async create(panelId: string, token: string, data: AgentRolePayload): Promise<AgentRole | null> {
    const body = await luxAssistantProxy<{ role?: AgentRole }>(panelId, token, "POST", "/api/ai/agent-roles", data);
    return body?.role ?? null;
  },
  async update(
    panelId: string,
    token: string,
    id: string,
    data: Partial<AgentRolePayload>,
  ): Promise<AgentRole | null> {
    const body = await luxAssistantProxy<{ role?: AgentRole }>(
      panelId,
      token,
      "PUT",
      `/api/ai/agent-roles/${id}`,
      data,
    );
    return body?.role ?? null;
  },
  /** Borra un rol. Devuelve `true` si el proxy no fue null (éxito). */
  async remove(panelId: string, token: string, id: string): Promise<boolean> {
    const body = await luxAssistantProxy(panelId, token, "DELETE", `/api/ai/agent-roles/${id}`);
    return body !== null;
  },
};

// ── Equipos de agente (primera clase) ────────────────────────────────────────

export const agentTeamsApi = {
  async list(panelId: string, token: string): Promise<AgentTeam[]> {
    const body = await luxAssistantProxy<{ teams?: AgentTeam[] }>(panelId, token, "GET", "/api/ai/agent-teams");
    return Array.isArray(body?.teams) ? body!.teams : [];
  },
  async get(panelId: string, token: string, id: string): Promise<AgentTeam | null> {
    const body = await luxAssistantProxy<{ team?: AgentTeam }>(panelId, token, "GET", `/api/ai/agent-teams/${id}`);
    return body?.team ?? null;
  },
  async create(panelId: string, token: string, data: AgentTeamPayload): Promise<AgentTeam | null> {
    const body = await luxAssistantProxy<{ team?: AgentTeam }>(panelId, token, "POST", "/api/ai/agent-teams", data);
    return body?.team ?? null;
  },
  async update(
    panelId: string,
    token: string,
    id: string,
    data: Partial<AgentTeamPayload>,
  ): Promise<AgentTeam | null> {
    const body = await luxAssistantProxy<{ team?: AgentTeam }>(
      panelId,
      token,
      "PUT",
      `/api/ai/agent-teams/${id}`,
      data,
    );
    return body?.team ?? null;
  },
  /** Elimina el equipo (solo desasocia a sus miembros); devuelve cuántos
   *  desasoció, o `null` si el proxy falló (para distinguir fallo de un equipo
   *  vacío con 0 miembros). */
  async remove(panelId: string, token: string, id: string): Promise<number | null> {
    const body = await luxAssistantProxy<{ detachedCount?: number }>(
      panelId,
      token,
      "DELETE",
      `/api/ai/agent-teams/${id}`,
    );
    return body ? (body.detachedCount ?? 0) : null;
  },
};

// ── Plantillas de equipo ─────────────────────────────────────────────────────

export const teamTemplatesApi = {
  async list(
    panelId: string,
    token: string,
  ): Promise<{ categories: TeamTemplateCategoryDef[]; templates: TeamTemplateSummary[] }> {
    const body = await luxAssistantProxy<{
      categories?: TeamTemplateCategoryDef[];
      templates?: TeamTemplateSummary[];
    }>(panelId, token, "GET", "/api/ai/team-templates");
    return { categories: body?.categories ?? [], templates: body?.templates ?? [] };
  },
  async get(panelId: string, token: string, id: string): Promise<TeamTemplate | null> {
    const body = await luxAssistantProxy<{ template?: TeamTemplate }>(
      panelId,
      token,
      "GET",
      `/api/ai/team-templates/${id}`,
    );
    return body?.template ?? null;
  },
  async apply(panelId: string, token: string, id: string, req: ApplyRequest): Promise<ApplyResult | null> {
    const body = await luxAssistantProxy<{ agents?: AssistantAgent[]; createdIds?: string[] }>(
      panelId,
      token,
      "POST",
      `/api/ai/team-templates/${id}/apply`,
      req,
    );
    if (!body) return null;
    return { agents: body.agents ?? [], createdIds: body.createdIds ?? [] };
  },
  async resync(
    panelId: string,
    token: string,
    id: string,
    rootAgentId: string,
  ): Promise<TeamTemplateResyncResult | null> {
    const body = await luxAssistantProxy<TeamTemplateResyncResult>(
      panelId,
      token,
      "POST",
      `/api/ai/team-templates/${id}/resync`,
      { rootAgentId },
    );
    return body ?? null;
  },
  async applyMissing(
    panelId: string,
    token: string,
    id: string,
    rootAgentId: string,
    slotIds: string[],
  ): Promise<ApplyResult | null> {
    const body = await luxAssistantProxy<{ agents?: AssistantAgent[]; createdIds?: string[] }>(
      panelId,
      token,
      "POST",
      `/api/ai/team-templates/${id}/apply-missing`,
      { rootAgentId, slotIds },
    );
    if (!body) return null;
    return { agents: body.agents ?? [], createdIds: body.createdIds ?? [] };
  },
  async feedbackStats(
    panelId: string,
    token: string,
    id: string,
  ): Promise<TeamTemplateFeedbackStats | null> {
    const body = await luxAssistantProxy<{ stats?: TeamTemplateFeedbackStats }>(
      panelId,
      token,
      "GET",
      `/api/ai/team-templates/${id}/feedback-stats`,
    );
    return body?.stats ?? null;
  },
};

// ── Módulos (con sus tools) ──────────────────────────────────────────────────

export const modulesApi = {
  async list(panelId: string, token: string): Promise<AgentResolvedModule[]> {
    const body = await luxAssistantProxy<{ modules?: AgentResolvedModule[] }>(
      panelId,
      token,
      "GET",
      "/api/ai/modules",
    );
    return Array.isArray(body?.modules) ? body!.modules : [];
  },
  /** Alterna el módulo completo (habilita/deshabilita sus tools). Devuelve la
   *  lista resuelta refrescada (o null si el proxy falló). */
  async setModule(panelId: string, token: string, moduleId: string, enabled: boolean): Promise<AgentResolvedModule[] | null> {
    const body = await luxAssistantProxy<{ modules?: AgentResolvedModule[] }>(
      panelId,
      token,
      "PUT",
      `/api/ai/modules/${encodeURIComponent(moduleId)}`,
      { enabled },
    );
    return Array.isArray(body?.modules) ? body!.modules : null;
  },
  /** Alterna una tool concreta (enabled / requireConfirm). */
  async setTool(
    panelId: string,
    token: string,
    moduleId: string,
    toolName: string,
    patch: { enabled?: boolean; requireConfirm?: boolean },
  ): Promise<AgentResolvedModule[] | null> {
    const body = await luxAssistantProxy<{ modules?: AgentResolvedModule[] }>(
      panelId,
      token,
      "PUT",
      `/api/ai/modules/${encodeURIComponent(moduleId)}/tools/${encodeURIComponent(toolName)}`,
      patch,
    );
    return Array.isArray(body?.modules) ? body!.modules : null;
  },
};

// ── Proyectos + grafo de código ──────────────────────────────────────────────

export const projectsApi = {
  async list(panelId: string, token: string): Promise<AssistantProject[]> {
    const body = await luxAssistantProxy<{ projects?: AssistantProject[] }>(
      panelId,
      token,
      "GET",
      "/api/ai/projects",
    );
    return Array.isArray(body?.projects) ? body!.projects : [];
  },
  /** Disponibilidad del grafo en el target conectado (oculta la UI si no existe). */
  async graphStatus(panelId: string, token: string): Promise<{ available: boolean; version?: string }> {
    const body = await luxAssistantProxy<{ available?: boolean; version?: string }>(
      panelId,
      token,
      "GET",
      "/api/ai/graph/status",
    );
    return { available: !!body?.available, version: body?.version };
  },
  async graphIndex(panelId: string, token: string, id: string): Promise<AssistantProjectGraphIndex | null> {
    const body = await luxAssistantProxy<{ graphIndex?: AssistantProjectGraphIndex | null }>(
      panelId,
      token,
      "GET",
      `/api/ai/projects/${id}/graph-index`,
    );
    return body?.graphIndex ?? null;
  },
  async startGraphIndex(panelId: string, token: string, id: string): Promise<{ jobId: string } | null> {
    const body = await luxAssistantProxy<{ jobId?: string }>(
      panelId,
      token,
      "POST",
      `/api/ai/projects/${id}/graph-index`,
      {},
    );
    return body?.jobId ? { jobId: body.jobId } : null;
  },
};

// ── Skills ───────────────────────────────────────────────────────────────────

export const skillsApi = {
  async list(panelId: string, token: string): Promise<AssistantSkill[]> {
    const body = await luxAssistantProxy<{ skills?: AssistantSkill[] }>(panelId, token, "GET", "/api/ai/skills");
    return Array.isArray(body?.skills) ? body!.skills : [];
  },
};

// ── Servidores registrados ───────────────────────────────────────────────────

export const registeredServersApi = {
  async list(panelId: string, token: string): Promise<RegisteredServerView[]> {
    const body = await luxAssistantProxy<{ servers?: RegisteredServerView[] }>(
      panelId,
      token,
      "GET",
      "/api/ai/registered-servers",
    );
    return Array.isArray(body?.servers) ? body!.servers : [];
  },
  async create(panelId: string, token: string, data: RegisteredServerPayload): Promise<RegisteredServerView | null> {
    const body = await luxAssistantProxy<{ server?: RegisteredServerView }>(
      panelId,
      token,
      "POST",
      "/api/ai/registered-servers",
      data,
    );
    return body?.server ?? null;
  },
  async update(panelId: string, token: string, id: string, data: Partial<RegisteredServerPayload>): Promise<RegisteredServerView | null> {
    const body = await luxAssistantProxy<{ server?: RegisteredServerView }>(
      panelId,
      token,
      "PATCH",
      `/api/ai/registered-servers/${encodeURIComponent(id)}`,
      data,
    );
    return body?.server ?? null;
  },
  async remove(panelId: string, token: string, id: string): Promise<void> {
    await luxAssistantProxy(panelId, token, "DELETE", `/api/ai/registered-servers/${encodeURIComponent(id)}`);
  },
};
