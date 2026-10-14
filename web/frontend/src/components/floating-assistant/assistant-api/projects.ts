import { shareAssistantReads } from "./load-coordinator";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";
import { SERVERS_PATH } from "@/lib/api-routes";
import type { AssistantSkillsMap } from "./skills";

// ── Projects (ChatGPT-style) ──────────────────────────────────────────────

/** Providers that ship a managed on-disk project structure. */
export type StructureProviderId = "claude" | "codex" | "gemini";

export const STRUCTURE_PROVIDERS: { id: StructureProviderId; label: string; rootDoc: string }[] = [
  { id: "claude", label: "Claude Code", rootDoc: "CLAUDE.md" },
  { id: "codex", label: "Codex (OpenAI)", rootDoc: "AGENTS.md" },
  { id: "gemini", label: "Gemini CLI", rootDoc: "GEMINI.md" },
];

/** A remote server connection associated with a project (one of the targets
 *  from the bottom-left server selector). `id` is the LP target id used to
 *  route the agent's cross-server tools; `name`/`host` are display-only. */
export interface AssistantProjectServer {
  id: string;
  name: string;
  host?: string;
}

export interface AssistantProject {
  id: string;
  title: string;
  icon: string;
  path: string;
  instructions: string;
  webPreviewUrl?: string;
  appPreviewUrl?: string;
  fileProjectRef?: { targetId: string; path: string } | null;
  provider: StructureProviderId;
  parentId?: string | null;
  teamId?: string | null;
  leaderAgentId?: string | null;
  /** Other server connections this project's chats may act on (servers.* tools). */
  servers?: AssistantProjectServer[];
  /** Opt-in: persist run summaries to the project's Obsidian vault (Decisiones.md). */
  autoCapture?: boolean;
  /** Per-project skill override (only in this project's chats), layered over global. */
  skills?: AssistantSkillsMap;
  /** Pre-generated quick-start questions for empty chats in this project (the UI
   *  samples a few at random per new chat). Up to 50; absent = generic starters. */
  suggestions?: string[];
  createdAt?: string;
  updatedAt?: string;
  /** Propiedad (el store de proyectos es global por servidor): `owner` = creado
   *  por ti; `shared` = creado por otro usuario del servidor. Anotado por el
   *  backend respecto al solicitante. */
  ownerId?: number | null;
  relation?: "owner" | "shared";
  ownerName?: string | null;
  /** Estado de indexación en el grafo de código del target (solo si el binario existe). */
  graphIndex?: AssistantProjectGraphIndex;
  /** Receta de verificación ("definition of done"): comandos que la plataforma
   *  ejecuta al cerrar cada tarea de equipo (≤10, ≤400 caracteres c/u). */
  verify?: AssistantProjectVerify | null;
  /** Pre-filtro de snippets de terminal: NOMBRE de categoría. Vacío/ausente = sin filtro. */
  snippetCategory?: string;
  /** Pre-filtro de snippets de terminal: NOMBRES de tags de esa categoría. */
  snippetTags?: string[];
}

export interface AssistantProjectVerify {
  commands: string[];
  timeoutMs?: number;
}

export interface AssistantProjectGraphIndex {
  enabled: boolean;
  project?: string;
  status?: "idle" | "indexing" | "ready" | "error";
  lastIndexedAt?: string;
  nodes?: number;
  edges?: number;
  error?: string;
  indexedPath?: string;
}

type ProjectPayload = {
  title: string;
  icon: string;
  path: string;
  instructions: string;
  webPreviewUrl?: string;
  appPreviewUrl?: string;
  fileProjectRef?: { targetId: string; path: string } | null;
  provider: StructureProviderId;
  parentId?: string | null;
  teamName?: string;
  leaderName?: string;
  creationKey?: string;
  servers?: AssistantProjectServer[];
  autoCapture?: boolean;
  skills?: AssistantSkillsMap;
  /** Toggle de indexación en el grafo de código (el estado lo gestiona el backend). */
  graphIndexEnabled?: boolean;
  /** Comandos de verificación (definition of done); null borra la receta. */
  verify?: AssistantProjectVerify | null;
  /** Pre-filtro de snippets de terminal (nombre de categoría; "" = sin filtro). */
  snippetCategory?: string;
  /** Pre-filtro de snippets de terminal (nombres de tags de la categoría). */
  snippetTags?: string[];
};

/** One target in the single SSH vault (`GET /api/servers`), no secrets. */
interface VaultTargetView {
  id: string;
  name: string;
  host: string;
}

/**
 * Servers a project can be associated with = the targets in LUXIPANEL's single
 * SSH vault (Ajustes → Servidores / `GET /api/servers`, the same registry the
 * sidebar selector and the agent's servers.* tools use). The backend already
 * filters to the targets this user may see (globals + own privates). Returns []
 * on error.
 */
export async function fetchAssociatableConnections(): Promise<AssistantProjectServer[]> {
  // `api.get` already unwraps the `{ ok, data }` envelope (returns `json.data`),
  // so for GET /api/servers `res.data` IS the TargetView[] array.
  const res = await api.get<VaultTargetView[]>(SERVERS_PATH);
  if (!res.ok || !Array.isArray(res.data)) return [];
  return res.data.map((s) => ({ id: s.id, name: s.name, host: s.host }));
}

// ── Terminal snippets (pre-filter selects for agents/projects) ──────────────

/** Snippet category as returned by `GET /api/terminal/snippets`. */
export interface TerminalSnippetCategoryRef {
  id: number;
  name: string;
}

/** Snippet tag as returned by `GET /api/terminal/snippets` (scoped to a category). */
export interface TerminalSnippetTagRef {
  id: number;
  categoryId: number;
  name: string;
}

/** Options for the snippet pre-filter selects (agent/project editors).
 *  `ok:false` = the user cannot read the terminal snippets (no terminal
 *  permission / fetch error) — render the fields disabled with a hint. */
export interface TerminalSnippetFilterOptions {
  ok: boolean;
  categories: TerminalSnippetCategoryRef[];
  tags: TerminalSnippetTagRef[];
}

/** Loads the terminal snippet categories/tags for the pre-filter selects.
 *  Never throws: on 401/403 or any error it resolves `{ ok: false, … }`. */
export async function fetchTerminalSnippetFilterOptions(): Promise<TerminalSnippetFilterOptions> {
  try {
    const res = await api.get<{
      ok: boolean;
      data?: { categories?: TerminalSnippetCategoryRef[]; tags?: TerminalSnippetTagRef[] };
    }>("/api/terminal/snippets");
    if (!res.ok || !res.data?.data) return { ok: false, categories: [], tags: [] };
    return {
      ok: true,
      categories: res.data.data.categories ?? [],
      tags: res.data.data.tags ?? [],
    };
  } catch {
    return { ok: false, categories: [], tags: [] };
  }
}

export const assistantProjectsApi = {
  async repairWorkspace(): Promise<void> {
    const res = await api.post<{ ok: boolean }>("/api/ai/projects/repair-workspace", {});
    unwrap(res, "No se pudo organizar el historial de proyectos");
  },
  async list(): Promise<AssistantProject[]> {
    const res = await api.catalog<{ ok: boolean; projects: AssistantProject[] }>("/api/ai/projects");
    return unwrap(res, "Failed to load projects").projects;
  },
  async create(data: ProjectPayload): Promise<AssistantProject> {
    const res = await api.post<{ ok: boolean; project: AssistantProject }>("/api/ai/projects", data);
    const project = unwrap(res, "Failed to create project").project;
    if (!data.parentId && typeof window !== "undefined") window.dispatchEvent(new Event("lxp:assistant:agents-updated"));
    return project;
  },
  async update(id: string, data: Partial<ProjectPayload>): Promise<AssistantProject> {
    const res = await api.patch<{ ok: boolean; project: AssistantProject }>(`/api/ai/projects/${id}`, data);
    return unwrap(res, "Failed to update project").project;
  },
  async remove(id: string): Promise<void> {
    const res = await api.delete(`/api/ai/projects/${id}`);
    if (!res.ok) throw new Error(res.error ?? "Failed to delete project");
  },
};

// ── Codebase graph (per-project indexing; only when the target ships the binary) ──

/** Disponibilidad del grafo en el target conectado. `available:false` ⇒ ocultar la UI. */
export async function fetchGraphAvailability(refresh = false): Promise<{ available: boolean; version?: string }> {
  const res = await api
    .get<{ ok: boolean; available: boolean; version?: string }>(
      `/api/ai/graph/status${refresh ? "?refresh=1" : ""}`,
    )
    .catch(() => null);
  if (!res || !res.ok || !res.data) return { available: false };
  return { available: !!res.data.available, version: res.data.version };
}

export async function startProjectGraphIndex(id: string): Promise<{ jobId: string }> {
  const res = await api.post<{ ok: boolean; jobId: string }>(`/api/ai/projects/${id}/graph-index`, {});
  return { jobId: unwrap(res, "Failed to start graph index").jobId };
}

export async function fetchProjectGraphIndex(id: string): Promise<AssistantProjectGraphIndex | null> {
  const res = await api
    .get<{ ok: boolean; graphIndex: AssistantProjectGraphIndex | null }>(`/api/ai/projects/${id}/graph-index`)
    .catch(() => null);
  if (!res || !res.ok || !res.data) return null;
  return res.data.graphIndex ?? null;
}

shareAssistantReads(assistantProjectsApi, "assistantProjectsApi");
