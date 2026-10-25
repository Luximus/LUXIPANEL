// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Custom AI agents (CLI-subagent style) — a user-defined agent with its own
 * system prompt, an allowed-tool subset, and a provider/model. Reused by the
 * chat runtime (`/api/ai/agent`) and by scheduled cron AI-jobs.
 *
 * Profiles and assignments stay in the connected target's contextual sidecar.
 * See docs/agent-market-contract.md; no implicit panel-host fallback.
 */

import { PROVIDER_IDS, type AssistantProviderId } from "./assistant-config.types.js";
import type { AssistantProjectServer } from "../repositories/projects.repository.js";
import type { AssistantSkillsMap } from "./assistant-skills.types.js";
import type { ImportedAgentProfile } from "./global-agent-profile.js";

/**
 * Credencial de PRUEBAS del agente (UNA sola por agente): usuario+clave que el
 * usuario define para los flujos QA que requieren iniciar sesión en la app
 * bajo prueba antes de verificar. Vive en el sidecar 0600 del target
 * (mismo modelo que las API keys del asistente); la API HTTP SIEMPRE la
 * devuelve REDACTADA (`{label?, username, hasSecret:true}` — el secret nunca
 * sale del backend); el runtime la inyecta en el system prompt del agente con
 * reglas estrictas de no-filtración.
 */
export interface AssistantAgentCredential {
  /** Etiqueta opcional ("staging", "cuenta demo"…). */
  label?: string;
  username: string;
  secret: string;
}

/** Credencial desde input no confiable → saneada o null (null = sin/limpiar). */
export function sanitizeAgentCredential(input: unknown): AssistantAgentCredential | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as { label?: unknown; username?: unknown; secret?: unknown };
  const username = typeof obj.username === "string" ? obj.username.trim() : "";
  const secret = typeof obj.secret === "string" ? obj.secret : "";
  if (!username || username.length > 120 || !secret || secret.length > 240) return null;
  if (/[\0\n\r]/.test(username) || /[\0\n\r]/.test(secret)) return null;
  const label = typeof obj.label === "string" ? obj.label.trim().slice(0, 60) : "";
  return { ...(label ? { label } : {}), username, secret };
}

/**
 * Avatar configuration for an agent — the option set of DiceBear's `avataaars`
 * style (`@dicebear/collection`). The avatar is rendered 100% locally in the
 * FRONTEND (`createAvatar(...).toDataUri()`), never via the DiceBear HTTP API.
 * All fields are optional; when the whole object is absent the frontend
 * generates a deterministic avatar seeded with the agent's id (there is NO
 * fallback to the removed `.webp` presets). Keys mirror the avataaars options
 * verbatim so the frontend can spread them straight into `createAvatar`.
 */
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

/** The 12 allowed avataaars option keys — single source of truth for the
 *  sanitizer (repository) and any consumer that must whitelist them. */
export const AVATAR_CONFIG_KEYS: readonly (keyof AvatarConfig)[] = [
  "seed",
  "top",
  "hairColor",
  "eyes",
  "eyebrows",
  "mouth",
  "skinColor",
  "clothing",
  "clothesColor",
  "accessories",
  "facialHair",
  "facialHairColor",
] as const;

/**
 * Compatibility reference for the agents-list API. Present only when exactly
 * one visible direct assignment is active; never selects the first of several.
 * `id` is the project id and `name` its title. */
export interface AssistantAgentProjectRef {
  id: string;
  name: string;
}

export interface AssistantAgent {
  /** All executable agents are private. Public templates use a separate contract/store. */
  profileSchemaVersion?: 1;
  knowledge?: string;
  specialty?: string;
  technologies?: string[];
  /** Explicit project links, including withdrawal markers. Legacy projectIds remain readable. */
  assignments?: AgentProjectAssignment[];
  id?: string;
  /** Display name. */
  name: string;
  /** Short human description (shown in the card / used as a prompt preamble). */
  description: string;
  /** The agent's system-prompt block, injected into every run that uses it. */
  systemPrompt: string;
  /** Primary provider this agent runs on. The API/CLI MODE is inherited from the
   *  global provider config (buildProvider), not stored here. */
  providerId: AssistantProviderId;
  /**
   * Extra providers the agent works with SIMULTANEOUSLY in multi-agent mode: the
   * orchestrator fans sub-agents out across `[providerId, ...providerIds]`
   * round-robin. Ignored in single mode. API-mode providers only at run time.
   */
  providerIds?: AssistantProviderId[];
  /**
   * Execution mode. "multi" forces the multi-agent orchestrator on API
   * providers, regardless of auto-routing. "single" (default) runs one agent.
   * In "multi" mode this SAME agent is replicated `multiAgentCount` times: the
   * task is split into that many parts, each handled by a copy of the agent
   * (same prompt/tools/provider) in parallel, then the results are synthesized.
   */
  agentMode?: "single" | "multi";
  /**
   * Multi mode: how many copies of THIS agent to deploy in parallel (2–8). The
   * orchestrator targets this many independent subtasks. Defaults to 3 when
   * absent. Ignored in single mode.
   */
  multiAgentCount?: number;
  /** Model id for that provider. Empty string = provider default. */
  model: string;
  /**
   * Allowed tool NAMES (e.g. "files.read"). `null`/absent = no restriction (the
   * agent may use every tool already permitted by the module gating). A list
   * (even empty) means EXACTLY that subset — intersected with `allowedTools()`
   * at run time, so it can only ever narrow, never widen, the permitted set.
   */
  allowedTools: string[] | null;
  /** Presentation only. */
  icon?: string;
  color?: string;
  /** Avataaars avatar configuration (DiceBear, rendered locally in the frontend).
   *  Absent = deterministic avatar seeded with the agent id. Shown instead of the
   *  lucide `icon`. See {@link AvatarConfig}. */
  avatarConfig?: AvatarConfig;
  /** Working directories (absolute paths) announced to the agent; the first is
   *  used as the run cwd when no project/cwd already set it. */
  projectPaths?: string[];
  /** Remote servers this agent may act on (servers.* tools), like a project. */
  servers?: AssistantProjectServer[];
  /** Direct active memberships. Runtime resolves ONE selected project; an
   *  assigned ancestor also authorizes its descendants. Never union contexts. */
  projectIds?: string[];
  /**
   * Ids de proyectos cuyo ÍNDICE del grafo de código (codebase-memory-mcp)
   * usa este agente: en cada run se anuncian esos grafos en el prompt (y se
   * monta el MCP en CLI) para que el agente explore código por el grafo en
   * vez de grep/lecturas completas (menos tokens). Acotan los índices del
   * proyecto activo y sus descendientes; no amplían a otra raíz. Solo cuentan proyectos con
   * `graphIndex.status === "ready"` en el target conectado.
   */
  graphProjectIds?: string[];
  /** Save a concise run summary to the attached project's Obsidian vault. */
  autoCapture?: boolean;
  /**
   * NOMBRE de una categoría de snippets de terminal (no id) para pre-filtrar
   * el selector de snippets en el frontend. Backend solo persiste/devuelve.
   * `""`/ausente = sin filtro.
   */
  snippetCategory?: string;
  /**
   * NOMBRES de tags de snippets de terminal (no ids) para pre-filtrar el
   * selector en el frontend. Backend solo persiste/devuelve. `[]`/ausente =
   * sin filtro.
   */
  snippetTags?: string[];
  /** Credencial de pruebas ÚNICA (login QA). Ver AssistantAgentCredential. */
  credential?: AssistantAgentCredential | null;
  /**
   * Per-agent skill override (layered OVER the global per-target skills only in
   * this agent's chats): map of skillId → {enabled, options}. Empty/absent =
   * inherit the global skills unchanged.
   */
  skills?: AssistantSkillsMap;
  /**
   * Assigned role id (reusable profile). At run time the role's system prompt is
   * layered UNDER this agent's prompt and its `allowedTools` narrow the set too.
   * `null`/absent = no role. See assistant-role.types.ts. Fail-open: an unknown
   * id is ignored.
   */
  roleId?: string | null;
  /**
   * Assigned TEAM id (first-class grouping entity). Analogous to `roleId`: this
   * is the SINGLE source of truth of team membership (the frontend must stop
   * inferring the group from the name prefix once this is set). `undefined` =
   * never assigned (candidate for prefix backfill); `null` = explicitly removed
   * from its team (do NOT re-assign via backfill). See assistant-team.types.ts.
   */
  teamId?: string | null;
  /**
   * Superior ("parent") agent id — this agent is subordinate to it. The superior
   * may DELEGATE tasks to this agent at run time (agents.delegate tool). Free-form
   * hierarchy; cycles are rejected on save. `null`/absent = top-level.
   */
  parentAgentId?: string | null;
  /**
   * Peer agent ids this agent is CONNECTED to. Connections are bidirectional
   * channels: either agent may delegate/ask the other at run time so they can
   * exchange information. Deduped, ≤20.
   */
  connections?: string[];
  /**
   * Permission: this agent may act as a SUPERVISOR and create real chats in the
   * Chat tab for its SUBORDINATES (the `chats.create` tool) — spawning autonomous
   * work that shows up as a per-agent log. `true` here OR on its assigned role
   * grants it. Defaults to false. Only effective in API mode + when it has
   * subordinates.
   */
  canSpawnChats?: boolean;
  /**
   * Enable a low-latency REAL-TIME session (bidirectional streaming audio+text)
   * for this agent — only meaningful when its provider exposes a realtime
   * endpoint (OpenAI Realtime API / Gemini Live). Persisted as `true` only when
   * `providerId` is realtime-capable; ignored otherwise. Defaults to false.
   */
  realtime?: boolean;
  /**
   * Team-template provenance markers, written by `team-templates.service.apply`:
   * the blueprint (`templateId`, e.g. "web-generic") and the slot this agent
   * materialised (`templateNodeKey`, e.g. "frontend"). Enable template RESYNC
   * (compare the current tree vs the blueprint and propose missing nodes)
   * without a separate group entity. Absent for hand-made agents and teams
   * created before the markers existed.
   */
  templateId?: string;
  templateNodeKey?: string;
  /**
   * Panel user id that created the agent. The store is GLOBAL (panel host), so
   * `ownerId` distinguishes "yours" from "shared by another admin". `null` =
   * legacy/no-owner (visible to all).
   */
  ownerId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

/** A single agent/role reference from untrusted input → valid slug or null. */
export function sanitizeAgentRef(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const id = input.trim();
  if (!id || id.length > 64 || !/^[A-Za-z0-9._-]+$/.test(id)) return null;
  return id;
}

export function isAssistantProviderId(v: unknown): v is AssistantProviderId {
  return typeof v === "string" && (PROVIDER_IDS as readonly string[]).includes(v);
}

/**
 * Providers that expose a low-latency REAL-TIME session API (bidirectional
 * streaming audio+text): `codex` (OpenAI Realtime API) and `gemini` (Gemini Live
 * API). Claude, DeepSeek, Grok and MiniMax have no realtime endpoint
 * (request/response + SSE only), so the per-agent realtime toggle is gated to
 * these two.
 */
export const REALTIME_CAPABLE_PROVIDERS: readonly AssistantProviderId[] = ["codex", "gemini"] as const;

/** True when a provider supports a real-time bidirectional session. */
export function providerSupportsRealtime(id: unknown): boolean {
  return isAssistantProviderId(id) && (REALTIME_CAPABLE_PROVIDERS as readonly string[]).includes(id);
}

/** Normalize an allowed-tool list from untrusted input → `string[] | null`. */
export function sanitizeAllowedTools(input: unknown): string[] | null {
  if (input == null) return null;
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const name = raw.trim();
    // Tool names are "<module>.<tool>"; keep the charset tight.
    if (!name || name.length > 120 || !/^[A-Za-z0-9._-]+$/.test(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= 500) break;
  }
  return out;
}

/** Provider id list from untrusted input → valid, deduped providers. */
export function sanitizeProviderIds(input: unknown): AssistantProviderId[] {
  if (!Array.isArray(input)) return [];
  const out: AssistantProviderId[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!isAssistantProviderId(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/** Absolute working-dir paths from untrusted input → deduped, ≤20. */
export function sanitizePaths(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const p = raw.trim().replace(/\/+$/, "") || "/";
    if (!p.startsWith("/") || p.length > 500 || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= 20) break;
  }
  return out;
}

/** Project id references (uuid-ish slugs) → deduped, ≤100 (marcar un proyecto
 *  padre en la UI adjunta todo su subárbol; 20 se quedaba corto). */
export function sanitizeProjectIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id || id.length > 64 || !/^[A-Za-z0-9._-]+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 100) break;
  }
  return out;
}

export const PRIVATE_AGENT_FIELDS = [
  "name", "description", "specialty", "technologies", "knowledge", "systemPrompt", "providerId", "providerIds",
  "model", "agentMode", "multiAgentCount", "allowedTools", "icon", "color", "avatarConfig", "projectPaths",
  "servers", "graphProjectIds", "autoCapture", "snippetCategory", "snippetTags", "credential", "skills",
  "roleId", "teamId", "parentAgentId", "connections", "canSpawnChats", "realtime",
] as const;
export type AgentPrivateConfig = Partial<Pick<AssistantAgent, typeof PRIVATE_AGENT_FIELDS[number]>>;
export function privateAgentConfig(agent: AssistantAgent): AgentPrivateConfig {
  return Object.fromEntries(PRIVATE_AGENT_FIELDS.filter(key => agent[key] !== undefined).map(key => [key, agent[key]])) as AgentPrivateConfig;
}
/** Project-owned snapshot plus private execution settings. Never exported. */
export interface AgentProjectAssignment {
  privateConfig?: AgentPrivateConfig;
  sourceProfile?: ImportedAgentProfile;
  revision?: number;
  projectId: string;
  status: "active" | "removed";
  jobTitle?: string;
  parentAgentId?: string | null;
  connections?: string[] | null;
  instructions?: string;
  roleId?: string | null;
  allowedTools?: string[] | null;
  canSpawnChats?: boolean | null;
  projectPaths?: string[] | null;
  serverIds?: string[] | null;
  graphProjectIds?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
  removedAt?: string;
}
export type AssignmentView = AgentProjectAssignment & { source: "legacy" | "explicit" };
export type EffectiveAssignment = AssignmentView & { inheritedFrom: string | null };
export type AssignmentPatch = Partial<Omit<AgentProjectAssignment, "projectId" | "status" | "createdAt" | "updatedAt" | "removedAt" | "privateConfig" | "sourceProfile" | "revision">>;

export function sanitizeTechnologies(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.filter((v): v is string => typeof v === "string")
    .map(v => v.trim().slice(0, 60)).filter(v => {
      const key = v.toLowerCase();
      if (!v || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 40);
}

/** Virtual legacy adapter: reading never migrates or rewrites the store. */
export function agentAssignments(agent: AssistantAgent): AssignmentView[] {
  const explicit = new Map((agent.assignments ?? []).map(a => [a.projectId, a]));
  const legacy = sanitizeProjectIds(agent.projectIds).filter(id => !explicit.has(id))
    .map(projectId => ({ projectId, status: "active" as const, source: "legacy" as const }));
  return [...legacy, ...[...explicit.values()].map(a => ({ ...a, source: "explicit" as const }))];
}
