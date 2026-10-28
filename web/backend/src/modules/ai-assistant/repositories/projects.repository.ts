import { sanitizeTechnologies } from "../models/assistant-agent.types.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Assistant projects (ChatGPT-style) — group conversations under a shared
 * working directory + instructions, per target.
 *
 * Sidecar: `${LUXIPANEL_CONFIG_DIR}/assistant/projects.json`.
 *
 * A project carries:
 *   - title:        display name
 *   - icon:         lucide icon name (e.g. "folder", "rocket")
 *   - path:         working directory on the target the agent operates in
 *                   (CLI runs `cd <path>` first; like starting `claude` there)
 *   - instructions: extra system-prompt context prepended for every chat
 *                   in this project
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import type { AssistantSkillsMap } from "../models/assistant-skills.types.js";
import { assistantSkillsService } from "../services/assistant-skills.service.js";

/** Providers that ship a managed on-disk structure (CLAUDE.md, .claude/, …). */
export const STRUCTURE_PROVIDER_IDS = ["claude", "codex", "gemini"] as const;
export type StructureProviderId = (typeof STRUCTURE_PROVIDER_IDS)[number];

export function isStructureProvider(v: unknown): v is StructureProviderId {
  return typeof v === "string" && (STRUCTURE_PROVIDER_IDS as readonly string[]).includes(v);
}

/**
 * A remote server connection the project is associated with — one of the
 * targets in LUXIPANEL's single SSH vault (`modules/servers`, the same list the
 * bottom-left server selector uses). `id` is that vault's target UUID, which the
 * agent's `servers.exec`/`servers.read_file`/`servers.list_dir` tools resolve
 * via `targetsRepository.getMaterial` (ownership re-checked per call). `name`/
 * `host` are display-only (carried so the chat context can name the server
 * without re-fetching the target list).
 */
export interface AssistantProjectServer {
  id: string;
  name: string;
  host?: string;
}

/** Normalize/validate an associated-servers array from untrusted input. */
export function sanitizeServers(input: unknown): AssistantProjectServer[] {
  if (!Array.isArray(input)) return [];
  const out: AssistantProjectServer[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as { id?: unknown; name?: unknown; host?: unknown };
    const id = String(r.id ?? "").trim();
    // Defensive: ids come from LP (UUID/host-ish); keep the charset tight so a
    // crafted value can never be smuggled into the proxy target field.
    if (!id || id.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const name = String(r.name ?? "").slice(0, 200) || id;
    const host = r.host != null ? String(r.host).slice(0, 255) : undefined;
    out.push(host ? { id, name, host } : { id, name });
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * Nombre de categoría de snippets desde input no confiable → trim, ≤120.
 * `""` = sin filtro (semántica de borrado: guardar string vacío lo limpia).
 * Se guardan NOMBRES (no ids numéricos); el frontend los usa para pre-filtrar
 * el selector de snippets de terminal. Compartida por proyectos y agentes.
 */
export function sanitizeSnippetCategory(input: unknown): string {
  return typeof input === "string" ? input.trim().slice(0, 120) : "";
}

/**
 * Nombres de tags de snippets desde input no confiable → trim ≤60 c/u,
 * dedupe, ≤20. `[]` = sin filtro (guardar array vacío limpia el filtro).
 * Compartida por proyectos y agentes.
 */
export function sanitizeSnippetTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().slice(0, 60);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * Estado de indexación del proyecto en el grafo de código del target
 * (binario `codebase-memory-mcp`). `enabled` es lo único que el cliente puede
 * tocar (toggle del modal); el resto lo escribe SOLO `graph-index.service` vía
 * `setGraphIndex` al terminar/fallar una indexación.
 */
export interface AssistantProjectGraphIndex {
  enabled: boolean;
  /** Nombre del proyecto en el grafo (p.ej. "var-www-LUXIPANEL"), resuelto de list_projects. */
  project?: string;
  status?: "idle" | "indexing" | "ready" | "error";
  lastIndexedAt?: string;
  nodes?: number;
  edges?: number;
  /** Último fallo, truncado. */
  error?: string;
  /** Path que se indexó — si difiere de `path` actual, la UI avisa "reindexar". */
  indexedPath?: string;
}

const GRAPH_STATUSES = ["idle", "indexing", "ready", "error"] as const;

export function sanitizeGraphIndex(input: unknown): AssistantProjectGraphIndex | undefined {
  if (!input || typeof input !== "object") return undefined;
  const r = input as Record<string, unknown>;
  const out: AssistantProjectGraphIndex = { enabled: Boolean(r.enabled) };
  if (typeof r.project === "string" && r.project.trim()) out.project = r.project.trim().slice(0, 200);
  if (typeof r.status === "string" && (GRAPH_STATUSES as readonly string[]).includes(r.status)) {
    out.status = r.status as AssistantProjectGraphIndex["status"];
  }
  if (typeof r.lastIndexedAt === "string") out.lastIndexedAt = r.lastIndexedAt.slice(0, 40);
  if (typeof r.nodes === "number" && Number.isFinite(r.nodes)) out.nodes = Math.max(0, Math.floor(r.nodes));
  if (typeof r.edges === "number" && Number.isFinite(r.edges)) out.edges = Math.max(0, Math.floor(r.edges));
  if (typeof r.error === "string" && r.error.trim()) out.error = r.error.trim().slice(0, 300);
  if (typeof r.indexedPath === "string" && r.indexedPath.trim()) out.indexedPath = r.indexedPath.trim().slice(0, 1024);
  return out;
}

export interface AssistantProject {
  profile?: string;
  technologies?: string[];
  id?: string;
  title: string;
  icon: string;
  path: string;
  instructions: string;
  /** HTTPS or same-origin preview URLs shown in the global chat workspace. */
  webPreviewUrl?: string;
  appPreviewUrl?: string;
  /** Explicit association with one repository discovered in Files. */
  fileProjectRef?: { targetId: string; path: string } | null;
  /**
   * AI provider whose on-disk project structure this project manages
   * (CLAUDE.md/.claude for "claude", AGENTS.md/.codex for "codex", …).
   * Defaults to "claude".
   */
  provider: StructureProviderId;
  /**
   * Optional parent project id. A parent "manages" its subprojects: children
   * inherit the parent's instructions (prepended) at chat time. `null`/absent
   * means a top-level project.
   */
  parentId?: string | null;
  /** Manual position among siblings in the project hierarchy. */
  sortOrder?: number;
  /** Workspace ownership: root projects own a team and its default leader. */
  teamId?: string | null;
  leaderAgentId?: string | null;
  /** Client retry token, only used to make a create request idempotent. */
  creationKey?: string;
  /**
   * Remote server connections this project is associated with (besides the
   * currently-connected server). Each chat in the project is told about them
   * and the agent can run commands / read files on them via the `servers.*`
   * tools. A child project inherits its parent's associated servers (merged).
   */
  servers?: AssistantProjectServer[];
  /**
   * Opt-in (default false): tras cada turno OK del asistente en este proyecto,
   * el módulo Obsidian anexa un bloque conciso (excerpt) a Decisiones.md del
   * vault de contexto del proyecto. Sin llamada extra al LLM. La UI del toggle
   * queda diferida (se actualiza vía PATCH /api/ai/projects/:id).
   */
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
  /**
   * Panel user id que CREÓ el proyecto. El store de proyectos es GLOBAL por
   * servidor (todos los usuarios lo ven), así que `ownerId` distingue "creados
   * por ti" de "compartidos contigo" (creados por otro usuario del servidor).
   * `null`/ausente = proyecto legacy previo a la propiedad (visible/editable por
   * todos, compatibilidad hacia atrás).
   */
  ownerId?: number | null;
  /**
   * Per-project skill override (layered OVER the global per-target skills only in
   * this project's chats): map of skillId → {enabled, options}. Empty/absent =
   * inherit the global skills unchanged.
   */
  skills?: AssistantSkillsMap;
  /**
   * Indexación en el grafo de código del target (codebase-memory-mcp).
   * Ausente = nunca activada / binario no disponible.
   */
  graphIndex?: AssistantProjectGraphIndex;
  /**
   * Pre-generated quick-start questions for an EMPTY chat in this project
   * (produced by `project-suggestions.service` at create/update time via a cheap
   * one-shot LLM call). The UI samples a few at random per new chat so they
   * vary. Up to 50; absent/empty = the UI falls back to generic starters.
   */
  suggestions?: string[];
  /**
   * Receta de VERIFICACIÓN ejecutable de las tareas de equipo sobre este
   * proyecto ("definition of done"): comandos que la plataforma corre (cwd =
   * worktree de la tarea) antes de cerrar una tarea como `done`. Si fallan, el
   * worker recibe un turno automático de corrección (con reintentos acotados).
   * Configurada por el humano (nunca por el modelo, salvo override gateado por
   * ASSISTANT_TEAM_VERIFY_ALLOW_OVERRIDE).
   */
  verify?: { commands: string[]; timeoutMs?: number } | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Receta de verify desde input no confiable → saneada o undefined. */
export function sanitizeVerify(input: unknown): { commands: string[]; timeoutMs?: number } | undefined {
  if (!input || typeof input !== "object") return undefined;
  const obj = input as { commands?: unknown; timeoutMs?: unknown };
  if (!Array.isArray(obj.commands)) return undefined;
  const commands: string[] = [];
  for (const raw of obj.commands) {
    if (typeof raw !== "string") continue;
    const cmd = raw.trim();
    if (!cmd || cmd.length > 400) continue;
    commands.push(cmd);
    if (commands.length >= 10) break;
  }
  if (commands.length === 0) return undefined;
  const out: { commands: string[]; timeoutMs?: number } = { commands };
  if (typeof obj.timeoutMs === "number" && Number.isFinite(obj.timeoutMs)) {
    out.timeoutMs = Math.min(Math.max(Math.round(obj.timeoutMs), 10_000), 1_800_000);
  }
  return out;
}

/** Normalize a generated suggestions list: trim, collapse spaces, dedupe
 *  (case-insensitive), drop empties/overlong, cap at 50. */
export function sanitizeSuggestions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const s = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!s || s.length > 300) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 50) break;
  }
  return out;
}

const MODULE = "assistant";
const COLLECTION = "projects";

const store = makeKvStore<AssistantProject>({ module: MODULE, collection: COLLECTION, idStrategy: "uuid" });

export const projectsRepository = {
  async list(executor?: Executor | null): Promise<AssistantProject[]> {
    const all = await store(executor).list();
    return [...all].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  },

  async get(executor: Executor | null | undefined, id: string): Promise<AssistantProject | null> {
    return store(executor).get(id) as Promise<AssistantProject | null>;
  },

  async create(
    executor: Executor | null | undefined,
    data: Pick<AssistantProject, "title" | "icon" | "path" | "instructions"> &
      Partial<Pick<AssistantProject, "provider" | "parentId" | "teamId" | "leaderAgentId" | "creationKey" | "servers" | "skills" | "verify" | "snippetCategory" | "snippetTags" | "webPreviewUrl" | "appPreviewUrl" | "fileProjectRef" | "profile" | "technologies">>,
  ): Promise<AssistantProject> {
    const verify = sanitizeVerify(data.verify);
    return store(executor).create({
      profile: (data.profile ?? "").trim().slice(0, 2000),
      technologies: sanitizeTechnologies(data.technologies),
      title: data.title.slice(0, 120) || "Proyecto",
      icon: data.icon || "folder",
      path: data.path || "",
      instructions: data.instructions || "",
      webPreviewUrl: data.webPreviewUrl || "",
      appPreviewUrl: data.appPreviewUrl || "",
      fileProjectRef: data.fileProjectRef ?? null,
      provider: isStructureProvider(data.provider) ? data.provider : "claude",
      parentId: data.parentId || null,
      teamId: data.teamId || null,
      leaderAgentId: data.leaderAgentId || null,
      creationKey: data.creationKey || undefined,
      servers: sanitizeServers(data.servers),
      skills: assistantSkillsService.sanitizeMap(data.skills),
      snippetCategory: sanitizeSnippetCategory(data.snippetCategory),
      snippetTags: sanitizeSnippetTags(data.snippetTags),
      ...(verify ? { verify } : {}),
      // Dueño = usuario del contexto (mismo mecanismo que aísla conversaciones).
      ownerId: getContextUserId() ?? null,
    });
  },

  async update(
    executor: Executor | null | undefined,
    id: string,
    patch: Partial<Pick<AssistantProject, "title" | "icon" | "path" | "instructions" | "provider" | "parentId" | "sortOrder" | "teamId" | "leaderAgentId" | "autoCapture" | "servers" | "skills" | "verify" | "snippetCategory" | "snippetTags" | "webPreviewUrl" | "appPreviewUrl" | "fileProjectRef" | "profile" | "technologies">>,
  ): Promise<AssistantProject | null> {
    const clean: Partial<AssistantProject> = {};
    if (patch.profile !== undefined) clean.profile = patch.profile.trim().slice(0, 2000);
    if (patch.technologies !== undefined) clean.technologies = sanitizeTechnologies(patch.technologies);
    if (patch.title !== undefined) clean.title = patch.title.slice(0, 120);
    if (patch.icon !== undefined) clean.icon = patch.icon;
    if (patch.path !== undefined) clean.path = patch.path;
    if (patch.instructions !== undefined) clean.instructions = patch.instructions;
    if (patch.webPreviewUrl !== undefined) clean.webPreviewUrl = patch.webPreviewUrl;
    if (patch.appPreviewUrl !== undefined) clean.appPreviewUrl = patch.appPreviewUrl;
    if (patch.fileProjectRef !== undefined) clean.fileProjectRef = patch.fileProjectRef;
    if (patch.provider !== undefined && isStructureProvider(patch.provider)) clean.provider = patch.provider;
    if (patch.autoCapture !== undefined) clean.autoCapture = Boolean(patch.autoCapture);
    if (patch.servers !== undefined) clean.servers = sanitizeServers(patch.servers);
    if (patch.skills !== undefined) clean.skills = assistantSkillsService.sanitizeMap(patch.skills);
    // Filtros de snippets: undefined = no tocar; "" / [] = limpiar el filtro.
    if (patch.snippetCategory !== undefined) clean.snippetCategory = sanitizeSnippetCategory(patch.snippetCategory);
    if (patch.snippetTags !== undefined) clean.snippetTags = sanitizeSnippetTags(patch.snippetTags);
    // verify: permite limpiar (null/objeto inválido → null persistido).
    if (patch.verify !== undefined) clean.verify = sanitizeVerify(patch.verify) ?? null;
    // parentId: allow clearing (null) but never let a project parent itself.
    if (patch.parentId !== undefined) clean.parentId = patch.parentId === id ? null : patch.parentId || null;
    if (patch.sortOrder !== undefined) clean.sortOrder = patch.sortOrder;
    if (patch.teamId !== undefined) clean.teamId = patch.teamId || null;
    if (patch.leaderAgentId !== undefined) clean.leaderAgentId = patch.leaderAgentId || null;
    return store(executor).update(id, clean);
  },

  /** Merge a graph-index state patch over the stored one (internal: written by
   *  `graph-index.service` — the controller only ever toggles `enabled`). */
  async setGraphIndex(
    executor: Executor | null | undefined,
    id: string,
    patch: Partial<AssistantProjectGraphIndex>,
  ): Promise<AssistantProject | null> {
    const current = (await store(executor).get(id)) as AssistantProject | null;
    if (!current) return null;
    const merged = sanitizeGraphIndex({ ...(current.graphIndex ?? { enabled: false }), ...patch });
    return store(executor).update(id, { graphIndex: merged });
  },

  /** Store the pre-generated quick-start suggestions (internal: written by
   *  `project-suggestions.service`, never from raw client input). */
  async setSuggestions(
    executor: Executor | null | undefined,
    id: string,
    suggestions: string[],
  ): Promise<AssistantProject | null> {
    return store(executor).update(id, { suggestions: sanitizeSuggestions(suggestions) });
  },

  /** Internal ownership transfer used by the workspace sharing service. This
   * intentionally is not part of the client-controlled `update` patch. */
  async setOwner(
    executor: Executor | null | undefined,
    id: string,
    ownerId: number | null,
  ): Promise<AssistantProject | null> {
    return store(executor).update(id, { ownerId });
  },

  async delete(executor: Executor | null | undefined, id: string): Promise<boolean> {
    return store(executor).delete(id);
  },
};
