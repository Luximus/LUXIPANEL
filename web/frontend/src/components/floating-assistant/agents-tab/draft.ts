// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Agent/role editor draft shapes + draft⇄payload converters — extracted verbatim from AgentsTab.tsx. */
import type {
  AssistantProviderId,
  AvatarConfig,
  AssistantProjectServer,
  AssistantSkillsMap,
  AssistantAgent,
  AgentPayload,
  AssistantAgentRole,
  AgentRolePayload,
} from "../assistant-api";
import { randomAvatarSeed } from "../agent-avataaars";

export interface DraftAgent {
  id?: string;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: AssistantProviderId;
  model: string;
  allowAllTools: boolean;
  allowedTools: Set<string>;
  icon: string;
  color: string;
  avatarConfig: AvatarConfig;
  projectPaths: string[];
  servers: AssistantProjectServer[];
  projectIds: string[];
  graphProjectIds: string[];
  autoCapture: boolean;
  providerIds: AssistantProviderId[];
  agentMode: "single" | "multi";
  multiAgentCount: number;
  skills: AssistantSkillsMap;
  roleId: string | null;
  teamId: string | null;
  parentAgentId: string | null;
  connections: string[];
  canSpawnChats: boolean;
  realtime: boolean;
  /** Pre-filtro de snippets de terminal: nombre de categoría ("" = sin filtro). */
  snippetCategory: string;
  /** Pre-filtro de snippets de terminal: nombres de tags de esa categoría. */
  snippetTags: string[];
  /** Estado guardado (redactado por la API: sin secret). */
  credentialSaved: { label?: string; username: string } | null;
  /** Credencial NUEVA en edición (se envía solo si tiene usuario+clave). */
  credentialInput: { label: string; username: string; secret: string } | null;
  /** "Quitar" pulsado → al guardar se envía credential: null. */
  credentialClear: boolean;
}

export function emptyDraft(): DraftAgent {
  return {
    name: "",
    description: "",
    systemPrompt: "",
    providerId: "claude",
    model: "",
    allowAllTools: true,
    allowedTools: new Set(),
    icon: "Zap",
    color: "violet",
    avatarConfig: { seed: randomAvatarSeed() },
    projectPaths: [],
    servers: [],
    projectIds: [],
    graphProjectIds: [],
    autoCapture: false,
    providerIds: [],
    agentMode: "single",
    multiAgentCount: 3,
    skills: {},
    roleId: null,
    teamId: null,
    parentAgentId: null,
    connections: [],
    canSpawnChats: false,
    realtime: false,
    snippetCategory: "",
    snippetTags: [],
    credentialSaved: null,
    credentialInput: null,
    credentialClear: false,
  };
}

export function toDraft(a: AssistantAgent): DraftAgent {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    systemPrompt: a.systemPrompt,
    providerId: a.providerId,
    model: a.model,
    allowAllTools: a.allowedTools == null,
    allowedTools: new Set(a.allowedTools ?? []),
    icon: a.icon || "Zap",
    color: a.color || "violet",
    avatarConfig: a.avatarConfig ?? { seed: a.id },
    projectPaths: a.projectPaths ?? [],
    servers: a.servers ?? [],
    projectIds: a.projectIds ?? [],
    graphProjectIds: a.graphProjectIds ?? [],
    autoCapture: Boolean(a.autoCapture),
    providerIds: a.providerIds ?? [],
    agentMode: a.agentMode === "multi" ? "multi" : "single",
    multiAgentCount: a.multiAgentCount ?? 3,
    skills: a.skills ?? {},
    roleId: a.roleId ?? null,
    teamId: a.teamId ?? null,
    parentAgentId: a.parentAgentId ?? null,
    connections: a.connections ?? [],
    canSpawnChats: Boolean(a.canSpawnChats),
    realtime: Boolean(a.realtime),
    snippetCategory: a.snippetCategory ?? "",
    snippetTags: a.snippetTags ?? [],
    credentialSaved: a.credential?.username
      ? { ...(a.credential.label ? { label: a.credential.label } : {}), username: a.credential.username }
      : null,
    credentialInput: null,
    credentialClear: false,
  };
}

export function toPayload(d: DraftAgent): AgentPayload {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    systemPrompt: d.systemPrompt,
    providerId: d.providerId,
    model: d.model.trim(),
    allowedTools: d.allowAllTools ? null : [...d.allowedTools],
    icon: d.icon,
    color: d.color,
    avatarConfig: d.avatarConfig,
    projectPaths: d.projectPaths,
    servers: d.servers,
    projectIds: d.projectIds,
    graphProjectIds: d.graphProjectIds,
    autoCapture: d.autoCapture,
    providerIds: d.providerIds.filter((p) => p !== d.providerId),
    agentMode: d.agentMode,
    multiAgentCount: d.multiAgentCount,
    skills: d.skills,
    roleId: d.roleId,
    teamId: d.teamId,
    parentAgentId: d.parentAgentId,
    connections: d.connections,
    canSpawnChats: d.canSpawnChats,
    realtime: d.realtime,
    // Siempre presentes (vacío = sin filtro) para que "quitar el filtro" persista.
    snippetCategory: d.snippetCategory.trim(),
    snippetTags: d.snippetCategory.trim() ? d.snippetTags.slice(0, 20) : [],
    // Credencial: objeto = reemplazar, null = quitar, ausente = conservar.
    ...(d.credentialInput && d.credentialInput.username.trim() && d.credentialInput.secret
      ? {
          credential: {
            ...(d.credentialInput.label.trim() ? { label: d.credentialInput.label.trim() } : {}),
            username: d.credentialInput.username.trim(),
            secret: d.credentialInput.secret,
          },
        }
      : d.credentialClear
        ? { credential: null }
        : {}),
  };
}

// ── Role editor draft ───────────────────────────────────────────────────────
export interface DraftRole {
  id?: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowAllTools: boolean;
  allowedTools: Set<string>;
  icon: string;
  color: string;
  canSpawnChats: boolean;
}

export function emptyRole(): DraftRole {
  return { name: "", description: "", systemPrompt: "", allowAllTools: true, allowedTools: new Set(), icon: "Shield", color: "blue", canSpawnChats: false };
}

export function roleToDraft(r: AssistantAgentRole): DraftRole {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    systemPrompt: r.systemPrompt,
    allowAllTools: r.allowedTools == null,
    allowedTools: new Set(r.allowedTools ?? []),
    icon: r.icon || "Shield",
    color: r.color || "indigo",
    canSpawnChats: Boolean(r.canSpawnChats),
  };
}

export function roleToPayload(d: DraftRole): AgentRolePayload {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    systemPrompt: d.systemPrompt,
    allowedTools: d.allowAllTools ? null : [...d.allowedTools],
    icon: d.icon,
    color: d.color,
    canSpawnChats: d.canSpawnChats,
  };
}
