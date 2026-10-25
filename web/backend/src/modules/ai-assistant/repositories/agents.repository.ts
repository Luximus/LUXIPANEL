// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Custom AI agents repository — CRUD over a PER-SERVER sidecar
 * (`${LUXIPANEL_CONFIG_DIR}/assistant/agents.json` on the CONNECTED server).
 *
 * Agents are per-server state, like conversations/projects: each server the
 * panel manages keeps its OWN agents, so connecting to a different server shows
 * a different (independent) set. `store()` passes no executor, so it resolves
 * the request/run's context executor via AsyncLocalStorage (fail-closed: throws
 * if there is no executor in context — never silently falls back to the panel
 * host). The cron AI-scheduler pins `localExecutor` explicitly, so its jobs
 * read/write the panel host's own agents.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import { getContextUserId } from "../../../shared/executor/index.js";
import {
  AVATAR_CONFIG_KEYS,
  privateAgentConfig,
  agentAssignments,
  type AssistantAgent,
  type AvatarConfig,
  isAssistantProviderId,
  providerSupportsRealtime,
  sanitizeAgentCredential,
  sanitizeAgentRef,
  sanitizeAllowedTools,
  sanitizePaths,
  sanitizeProjectIds,
  sanitizeProviderIds,
  sanitizeTechnologies,
  type AgentProjectAssignment,
} from "../models/assistant-agent.types.js";
import { sanitizeServers, sanitizeSnippetCategory, sanitizeSnippetTags } from "./projects.repository.js";
import { DEFAULT_PROVIDER_ID } from "../models/assistant-config.types.js";
import { assistantSkillsService } from "../services/assistant-skills.service.js";

const MODULE = "assistant";
const COLLECTION = "agents";

/** Per-server store — pass no executor so it resolves the context executor of
 *  the current request/run (the connected server), or the cron-pinned one. */
function store() {
  return dataStore<AssistantAgent>(undefined, MODULE, COLLECTION, { idStrategy: "uuid" });
}

type CtxFields = "knowledge" | "specialty" | "technologies" | "projectPaths" | "servers" | "projectIds" | "graphProjectIds" | "autoCapture" | "providerIds" | "agentMode" | "skills" | "roleId" | "teamId" | "parentAgentId" | "connections" | "canSpawnChats" | "multiAgentCount" | "realtime" | "templateId" | "templateNodeKey" | "credential" | "snippetCategory" | "snippetTags";

/** Clamp the multi-agent copy count to a sane range (2–8); default 3. */
function sanitizeMultiCount(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 3;
  return Math.max(2, Math.min(8, n));
}
type CreateInput = Pick<AssistantAgent, "name" | "description" | "systemPrompt" | "model"> &
  Partial<Pick<AssistantAgent, "providerId" | "allowedTools" | "icon" | "color" | "avatarConfig" | CtxFields>>;

type UpdateInput = Partial<
  Pick<
    AssistantAgent,
    "name" | "description" | "systemPrompt" | "model" | "providerId" | "allowedTools" | "icon" | "color" | "avatarConfig" | CtxFields
  >
>;

/** Avataaars config from untrusted input → plain object with ONLY the 12 allowed
 *  keys, each a safe short string. Anything else is dropped. Empty result (no
 *  usable key) → undefined so the frontend falls back to the deterministic
 *  id-seeded avatar. */
function sanitizeAvatarConfig(v: unknown): AvatarConfig | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const src = v as Record<string, unknown>;
  const out: AvatarConfig = {};
  for (const key of AVATAR_CONFIG_KEYS) {
    const raw = src[key];
    if (typeof raw !== "string") continue;
    const val = raw.trim();
    if (!val || !/^[a-zA-Z0-9_-]{1,60}$/.test(val)) continue;
    out[key] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Old sidecars may still carry the removed `avatar` webp slug — drop it on read
 *  so it never leaks into the API or the typed model (silent, non-breaking). */
function stripLegacy(doc: AssistantAgent): AssistantAgent {
  if (doc && typeof doc === "object" && "avatar" in doc) {
    const { avatar: _legacy, ...rest } = doc as AssistantAgent & { avatar?: unknown };
    return rest;
  }
  return doc;
}

export const agentsRepository = {
  async list(): Promise<AssistantAgent[]> {
    const all = await store().list();
    return [...all].map(stripLegacy).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  },

  async get(id: string): Promise<AssistantAgent | null> {
    if (!id) return null;
    const doc = (await store().get(id)) as AssistantAgent | null;
    // Belt-and-braces: the caller's id is canonical. A hand-edited sidecar may
    // lack the embedded `id`; identity comparisons (parentAgentId === agent.id)
    // must never silently fail on that.
    return doc ? stripLegacy({ ...doc, id: doc.id ?? id }) : null;
  },

  async create(data: CreateInput, internal?: { id: string; assignments: AgentProjectAssignment[] }): Promise<AssistantAgent> {
    const clean: AssistantAgent = {
        knowledge: (data.knowledge ?? "").slice(0, 12000),
        specialty: (data.specialty ?? "").trim().slice(0, 200),
        technologies: sanitizeTechnologies(data.technologies),
        name: (data.name || "").slice(0, 120) || "Agente",
        description: (data.description || "").slice(0, 500),
        systemPrompt: (data.systemPrompt || "").slice(0, 20000),
        providerId: isAssistantProviderId(data.providerId) ? data.providerId : DEFAULT_PROVIDER_ID,
        model: (data.model || "").slice(0, 80),
        allowedTools: sanitizeAllowedTools(data.allowedTools),
        icon: (data.icon || "robot").slice(0, 60),
        color: (data.color || "violet").slice(0, 30),
        // Only persisted when it yields a usable config; else omitted (frontend
        // renders a deterministic id-seeded avatar).
        ...(sanitizeAvatarConfig(data.avatarConfig) ? { avatarConfig: sanitizeAvatarConfig(data.avatarConfig)! } : {}),
        projectPaths: sanitizePaths(data.projectPaths),
        servers: sanitizeServers(data.servers),
        projectIds: sanitizeProjectIds(data.projectIds),
        graphProjectIds: sanitizeProjectIds(data.graphProjectIds),
        autoCapture: Boolean(data.autoCapture),
        // Pre-filtro del selector de snippets (nombres, no ids); ""/[] = sin filtro.
        snippetCategory: sanitizeSnippetCategory(data.snippetCategory),
        snippetTags: sanitizeSnippetTags(data.snippetTags),
        credential: sanitizeAgentCredential(data.credential),
        providerIds: sanitizeProviderIds(data.providerIds),
        agentMode: data.agentMode === "multi" ? "multi" : "single",
        multiAgentCount: sanitizeMultiCount(data.multiAgentCount),
        skills: assistantSkillsService.sanitizeMap(data.skills),
        roleId: sanitizeAgentRef(data.roleId),
        teamId: sanitizeAgentRef(data.teamId),
        parentAgentId: sanitizeAgentRef(data.parentAgentId),
        connections: sanitizeProjectIds(data.connections),
        canSpawnChats: Boolean(data.canSpawnChats),
        // Realtime only sticks when the chosen provider actually supports it.
        realtime: Boolean(data.realtime) && providerSupportsRealtime(data.providerId),
        // Template provenance markers (resync): safe slugs or dropped.
        ...(sanitizeAgentRef(data.templateId) ? { templateId: sanitizeAgentRef(data.templateId)! } : {}),
        ...(sanitizeAgentRef(data.templateNodeKey) ? { templateNodeKey: sanitizeAgentRef(data.templateNodeKey)! } : {}),
        ownerId: getContextUserId() ?? null,
      };
    const now = new Date().toISOString();
    return store().create({ ...clean, ...(internal ? { id: internal.id } : {}), profileSchemaVersion: 1,
      assignments: internal?.assignments ?? (clean.projectIds ?? []).map(projectId => ({ projectId, status: "active", privateConfig: privateAgentConfig(clean), parentAgentId: clean.parentAgentId ?? null, revision: 1, createdAt: now, updatedAt: now })),
    });
  },

  async update(id: string, patch: UpdateInput, links?: { assignments: AgentProjectAssignment[]; projectIds: string[] }): Promise<AssistantAgent | null> {
    const clean: Partial<AssistantAgent> = {};
    if (patch.knowledge !== undefined) clean.knowledge = patch.knowledge.slice(0, 12000);
    if (patch.specialty !== undefined) clean.specialty = patch.specialty.trim().slice(0, 200);
    if (patch.technologies !== undefined) clean.technologies = sanitizeTechnologies(patch.technologies);
    if (patch.name !== undefined) clean.name = patch.name.slice(0, 120);
    if (patch.description !== undefined) clean.description = patch.description.slice(0, 500);
    if (patch.systemPrompt !== undefined) clean.systemPrompt = patch.systemPrompt.slice(0, 20000);
    if (patch.providerId !== undefined && isAssistantProviderId(patch.providerId)) clean.providerId = patch.providerId;
    if (patch.model !== undefined) clean.model = patch.model.slice(0, 80);
    if (patch.allowedTools !== undefined) clean.allowedTools = sanitizeAllowedTools(patch.allowedTools);
    if (patch.icon !== undefined) clean.icon = patch.icon.slice(0, 60);
    if (patch.color !== undefined) clean.color = patch.color.slice(0, 30);
    // undefined = no tocar; objeto (in)válido = reemplazar/limpiar (undefined se
    // omite al serializar → vuelve al avatar determinístico por id).
    if (patch.avatarConfig !== undefined) clean.avatarConfig = sanitizeAvatarConfig(patch.avatarConfig);
    if (patch.projectPaths !== undefined) clean.projectPaths = sanitizePaths(patch.projectPaths);
    if (patch.servers !== undefined) clean.servers = sanitizeServers(patch.servers);
    if (patch.projectIds !== undefined) clean.projectIds = sanitizeProjectIds(patch.projectIds);
    if (patch.graphProjectIds !== undefined) clean.graphProjectIds = sanitizeProjectIds(patch.graphProjectIds);
    if (patch.autoCapture !== undefined) clean.autoCapture = Boolean(patch.autoCapture);
    // Filtros de snippets: undefined = no tocar; "" / [] = limpiar el filtro.
    if (patch.snippetCategory !== undefined) clean.snippetCategory = sanitizeSnippetCategory(patch.snippetCategory);
    if (patch.snippetTags !== undefined) clean.snippetTags = sanitizeSnippetTags(patch.snippetTags);
    // undefined = no tocar; null/objeto inválido = limpiar; objeto válido = reemplazar.
    if (patch.credential !== undefined) clean.credential = sanitizeAgentCredential(patch.credential);
    if (patch.providerIds !== undefined) clean.providerIds = sanitizeProviderIds(patch.providerIds);
    if (patch.agentMode !== undefined) clean.agentMode = patch.agentMode === "multi" ? "multi" : "single";
    if (patch.multiAgentCount !== undefined) clean.multiAgentCount = sanitizeMultiCount(patch.multiAgentCount);
    if (patch.skills !== undefined) clean.skills = assistantSkillsService.sanitizeMap(patch.skills);
    if (patch.roleId !== undefined) clean.roleId = sanitizeAgentRef(patch.roleId);
    // teamId: undefined = no tocar; string válido = asignar; null/inválido =
    // PERSISTIR null (quitado explícito), no borrar la clave — así el backfill
    // distingue "quitado" (null) de "nunca asignado" (undefined).
    if (patch.teamId !== undefined) clean.teamId = sanitizeAgentRef(patch.teamId);
    if (patch.parentAgentId !== undefined) clean.parentAgentId = sanitizeAgentRef(patch.parentAgentId);
    if (patch.connections !== undefined) clean.connections = sanitizeProjectIds(patch.connections);
    if (patch.canSpawnChats !== undefined) clean.canSpawnChats = Boolean(patch.canSpawnChats);
    // Realtime is gated by the provider; if the patch changes provider to a
    // non-realtime one, force it off (the controller also clears it).
    if (patch.realtime !== undefined) {
      clean.realtime = Boolean(patch.realtime) && (patch.providerId === undefined || providerSupportsRealtime(patch.providerId));
    }
    if (patch.templateId !== undefined) clean.templateId = sanitizeAgentRef(patch.templateId) ?? "";
    if (patch.templateNodeKey !== undefined) clean.templateNodeKey = sanitizeAgentRef(patch.templateNodeKey) ?? "";
    const prior = await this.get(id);
    const assignments = links?.assignments ?? prior?.assignments;
    const active = assignments?.filter(a => a.status === "active") ?? [];
    if (links) Object.assign(clean, links);
    if (prior && active.length === 1) clean.assignments = assignments!.map(a => {
      if (a !== active[0]) return a;
      const previous = { ...privateAgentConfig(prior), ...a.privateConfig };
      const next = { ...a, privateConfig: { ...previous, ...privateAgentConfig(clean as AssistantAgent) },
        revision: (a.revision ?? 1) + 1, updatedAt: new Date().toISOString() };
      for (const key of ["parentAgentId", "connections", "roleId", "allowedTools", "canSpawnChats", "projectPaths", "graphProjectIds"] as const) {
        if (clean[key] !== undefined && JSON.stringify(clean[key]) !== JSON.stringify(previous[key])) Object.assign(next, { [key]: clean[key] });
      }
      if (clean.servers !== undefined && JSON.stringify(clean.servers) !== JSON.stringify(previous.servers)) next.serverIds = clean.servers.map(s => s.id);
      return next;
    });
    return store().update(id, clean) as Promise<AssistantAgent | null>;
  },

  async updateWithAssignments(id: string, patch: UpdateInput, assignments: AgentProjectAssignment[], projectIds: string[]) {
    return this.update(id, patch, { assignments, projectIds });
  },

  /** Internal only: service authorizes and serializes before this atomic profile update. */
  async setAssignments(id: string, assignments: AgentProjectAssignment[], projectIds: string[]): Promise<AssistantAgent | null> {
    return store().update(id, { assignments, projectIds });
  },

  /** Called under the assignment lock after authorization and idle checks. */
  async migratePrivate(agent: AssistantAgent): Promise<AssistantAgent> {
    if (agent.profileSchemaVersion === 1) return agent;
    const backups = dataStore<AssistantAgent>(undefined, MODULE, "agent-profile-migration-backups", { idStrategy: "uuid" });
    if (!await backups.get(agent.id!)) await backups.set(agent.id!, agent);
    const assignments = agentAssignments(agent).map(({ source, ...a }) => ({ ...a,
      privateConfig: a.privateConfig ?? { ...privateAgentConfig(agent), teamId: source === "legacy" ? agent.teamId ?? null : null },
      revision: a.revision ?? 1,
      ...(a.parentAgentId === undefined && source === "legacy" ? { parentAgentId: agent.parentAgentId ?? null } : {}),
    }));
    return (await store().update(agent.id!, { assignments, profileSchemaVersion: 1 }))!;
  },

  async delete(id: string): Promise<boolean> {
    return store().delete(id);
  },
};
