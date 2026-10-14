// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — custom agents (CLI-subagent style).
 *
 *   GET    /api/ai/agents          list
 *   GET    /api/ai/agents/:id      get
 *   POST   /api/ai/agents          create
 *   PUT    /api/ai/agents/:id      update
 *   DELETE /api/ai/agents/:id      delete
 *
 * Agents are PANEL-HOST/global (see agents.repository.ts); the repo pins the
 * panel-host executor itself, so handlers don't pass `getExecutor(req)`. Owner
 * name resolution is best-effort against the per-server user list (display only).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import type { SessionUser } from "../../../shared/types/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { avatarConfigSchema, serverSchema, skillsSchema } from "./shared-schemas.js";
import { assertOwner } from "./ownership.js";
import { getExecutor, getContextUserId } from "../../../shared/executor/index.js";
import { ValidationError, AppError } from "../../../shared/errors/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { aiOutputLanguage } from "../../../shared/i18n/ai-output-language.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentTeamsRepository } from "../repositories/agent-teams.repository.js";
import { PROVIDER_IDS } from "../models/assistant-config.types.js";
import { sanitizeAllowedTools, isAssistantProviderId, providerSupportsRealtime, type AssistantAgent, type AssistantAgentProjectRef } from "../models/assistant-agent.types.js";
import { projectsRepository } from "../repositories/projects.repository.js";
import { normalizeAllowedTools } from "../services/tool-allowlist.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { assistantModulesService } from "../services/assistant-modules.service.js";
import { aiComplete } from "../services/translation/ai-translator.js";
import { summarizeFolder } from "../services/folder-agents.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-agents");
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";

const providerSchema = z.enum(PROVIDER_IDS);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  systemPrompt: z.string().max(20000).default(""),
  providerId: providerSchema.default("claude"),
  model: z.string().max(80).default(""),
  // null = sin restricción (todas las tools permitidas); lista = subconjunto exacto.
  allowedTools: z.array(z.string().max(120)).max(500).nullable().optional(),
  icon: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
  avatarConfig: avatarConfigSchema,
  projectPaths: z.array(z.string().max(500)).max(20).optional(),
  servers: z.array(serverSchema).max(50).optional(),
  // Tope 100 (no 20): marcar un proyecto padre en la UI adjunta TODO su
  // subárbol de subproyectos de una vez (ver AgentsTab "Proyectos adjuntos").
  projectIds: z.array(z.string().max(64)).max(100).optional(),
  graphProjectIds: z.array(z.string().max(64)).max(100).optional(),
  autoCapture: z.boolean().optional(),
  // Pre-filtro del selector de snippets: NOMBRES de categoría/tags (no ids).
  // "" / [] = sin filtro.
  snippetCategory: z.string().trim().max(120).optional(),
  snippetTags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  providerIds: z.array(z.enum(PROVIDER_IDS)).max(6).optional(),
  agentMode: z.enum(["single", "multi"]).optional(),
  multiAgentCount: z.number().int().min(2).max(8).optional(),
  skills: skillsSchema.optional(),
  roleId: z.string().max(64).nullable().optional(),
  teamId: z.string().max(64).nullable().optional(),
  parentAgentId: z.string().max(64).nullable().optional(),
  connections: z.array(z.string().max(64)).max(20).optional(),
  canSpawnChats: z.boolean().optional(),
  realtime: z.boolean().optional(),
  // Credencial de pruebas ÚNICA (login QA): null = sin credencial.
  credential: z
    .object({ label: z.string().max(60).optional(), username: z.string().min(1).max(120), secret: z.string().min(1).max(240) })
    .nullable()
    .optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().max(20000).optional(),
  providerId: providerSchema.optional(),
  model: z.string().max(80).optional(),
  allowedTools: z.array(z.string().max(120)).max(500).nullable().optional(),
  icon: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
  avatarConfig: avatarConfigSchema,
  projectPaths: z.array(z.string().max(500)).max(20).optional(),
  servers: z.array(serverSchema).max(50).optional(),
  // Tope 100 (no 20): marcar un proyecto padre en la UI adjunta TODO su
  // subárbol de subproyectos de una vez (ver AgentsTab "Proyectos adjuntos").
  projectIds: z.array(z.string().max(64)).max(100).optional(),
  graphProjectIds: z.array(z.string().max(64)).max(100).optional(),
  autoCapture: z.boolean().optional(),
  // undefined = no tocar; "" (categoría) / [] (tags) = limpiar el filtro.
  snippetCategory: z.string().trim().max(120).optional(),
  snippetTags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  providerIds: z.array(z.enum(PROVIDER_IDS)).max(6).optional(),
  agentMode: z.enum(["single", "multi"]).optional(),
  multiAgentCount: z.number().int().min(2).max(8).optional(),
  skills: skillsSchema.optional(),
  roleId: z.string().max(64).nullable().optional(),
  teamId: z.string().max(64).nullable().optional(),
  parentAgentId: z.string().max(64).nullable().optional(),
  connections: z.array(z.string().max(64)).max(20).optional(),
  canSpawnChats: z.boolean().optional(),
  realtime: z.boolean().optional(),
  // undefined = no tocar; null = quitar; objeto = reemplazar (una sola).
  credential: z
    .object({ label: z.string().max(60).optional(), username: z.string().min(1).max(120), secret: z.string().min(1).max(240) })
    .nullable()
    .optional(),
});

/** AI-assisted draft: the user picks a quick archetype (or types a brief) and an
 *  LLM fills the whole agent professionally. */
const suggestSchema = z.object({
  brief: z.string().min(1).max(2000),
  providerId: z.enum(PROVIDER_IDS).optional(),
});

/** Propose a TEAM of agents from a folder analysis (no persistence). */
const proposeSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(4096)
    .refine((p) => p.startsWith("/") && !p.split("/").includes(".."), "Ruta absoluta inválida"),
  count: z.number().int().min(2).max(6).optional(),
  providerId: z.enum(PROVIDER_IDS).optional(),
});

const PROPOSE_COLORS = new Set([
  "violet", "blue", "emerald", "amber", "rose", "cyan", "slate", "zinc",
  "green", "orange", "red", "teal", "indigo", "fuchsia",
]);

/** Pull the first JSON object out of an LLM reply (handles ```json fences /
 *  surrounding prose). Returns null if nothing parseable is found. */
function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(s.slice(start, end + 1));
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Pull the first JSON array out of an LLM reply (handles ```json fences /
 *  surrounding prose). Returns null if nothing parseable is found. */
function extractJsonArray(text: string): Record<string, unknown>[] | null {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(s.slice(start, end + 1));
    return Array.isArray(arr)
      ? (arr.filter((x) => x && typeof x === "object") as Record<string, unknown>[])
      : null;
  } catch {
    return null;
  }
}

/** El `secret` de la credencial de pruebas NUNCA sale por la API HTTP: se
 *  sustituye por `{label?, username, hasSecret:true}` (la UI muestra el estado
 *  y solo permite reemplazar/quitar). El valor real solo lo consume el runtime
 *  (system-prompt-builder) leyendo el repo directamente. */
function redactAgent<T extends { credential?: AssistantAgent["credential"] }>(
  a: T,
): Omit<T, "credential"> & { credential: { label?: string; username: string; hasSecret: true } | null } {
  const { credential, ...rest } = a;
  return {
    ...rest,
    credential: credential?.username
      ? { ...(credential.label ? { label: credential.label } : {}), username: credential.username, hasSecret: true as const }
      : null,
  };
}

/** Si `teamId` es un string no vacío, exige que el equipo exista (400 si no).
 *  `null`/undefined pasan sin validar (null = quitar del equipo). */
async function assertTeamExists(teamId: string | null | undefined, locale: unknown): Promise<void> {
  if (typeof teamId !== "string" || teamId.trim() === "") return;
  const team = await agentTeamsRepository.get(teamId);
  if (!team) throw new ValidationError(apiModuleMessage(locale, "assistantTeamMissing"));
}

/** El agente es del usuario actual (o legacy sin dueño) → puede editar/borrar. */
function assertCanModify(ownerId: number | null | undefined, locale: unknown): void {
  assertOwner(ownerId, locale);
}

/**
 * Reject a `parentAgentId` that would create a subordination cycle: walking up
 * the parent chain from the proposed parent must never reach `agentId` (and the
 * parent can't be the agent itself). Best-effort: a load failure won't block.
 */
async function assertNoSubordinationCycle(agentId: string, parentAgentId: string | null | undefined, locale: unknown): Promise<void> {
  if (!parentAgentId) return;
  if (parentAgentId === agentId) throw new ValidationError(apiModuleMessage(locale, "assistantSelfParent"));
  const all = await agentsRepository.list().catch(() => []);
  const parentOf = new Map(all.map((a) => [a.id ?? "", a.parentAgentId ?? null] as const));
  let cur: string | null = parentAgentId;
  let hops = 0;
  while (cur && hops++ < 100) {
    if (cur === agentId) throw new ValidationError(apiModuleMessage(locale, "assistantHierarchyCycle"));
    cur = parentOf.get(cur) ?? null;
  }
}

export async function loadAssistantAgents(req: Request, _res: Response) {
    const uid = getContextUserId();
    const agents = await agentsRepository.list();
    const executor = getExecutor(req);
    const users = await panelUserRepository.findAll(executor).catch(() => []);
    const nameById = new Map(users.map((u) => [u.id, u.displayName || u.username]));
    // Team hierarchy (for the "Agentes IA" view: leaders at the top level, each
    // team's chats nested under it). A subordinate points to its superior via the
    // raw `parentAgentId` (a SINGLE value → an agent belongs to at most ONE
    // leader). Precompute each agent's DIRECT subordinate ids so the frontend
    // renders the tree without re-deriving it client-side. Computed over the FULL
    // list (owner + shared) for a consistent tree regardless of ownership.
    const subordinatesByParent = new Map<string, string[]>();
    for (const a of agents) {
      const parent = a.parentAgentId ?? null;
      if (!parent || !a.id) continue;
      const ids = subordinatesByParent.get(parent) ?? [];
      ids.push(a.id);
      subordinatesByParent.set(parent, ids);
    }
    // Project name lookup (display-only, additive). Projects are per-server;
    // agents/teams are panel-host/global. Resolve the connected server's
    // projects so a TEAM LEADER can be annotated with the project it manages
    // (`project` field below). Fail-open, but LOUD: a swallowed read here would
    // make EVERY leader silently lose its project chip, so surface it — this is
    // the diagnostic that was missing when leaders showed no project.
    let projects: Awaited<ReturnType<typeof projectsRepository.list>> = [];
    try {
      projects = await projectsRepository.list(executor);
    } catch (err) {
      log.warn(
        { err: errMessage(err) },
        "agents.list: could not read assistant projects; team leaders will carry project:null",
      );
    }
    const projectNameById = new Map(projects.map((p) => [p.id ?? "", p.title]));
    // Inverse fallback source: a leader whose `projectIds` is empty or only
    // points at deleted projects can still be annotated via its TEAM. Teams
    // carry no `projectId`, but they mirror a project by NAME (the historical
    // "LUXIPANEL · Rol" grouping), so match team name → project title
    // (case-insensitive, trimmed). Cheap: one panel-host read, a handful of teams.
    const projectByTitleLower = new Map(
      projects.map((p) => [(p.title ?? "").trim().toLowerCase(), { id: p.id ?? "", name: p.title }] as const),
    );
    const teams = await agentTeamsRepository.list().catch((err) => {
      log.warn(
        { err: errMessage(err) },
        "agents.list: could not read agent teams for the project fallback",
      );
      return [] as Awaited<ReturnType<typeof agentTeamsRepository.list>>;
    });
    const teamNameById = new Map(teams.map((t) => [t.id ?? "", t.name ?? ""]));
    const annotated = agents.map((a) => {
      const ownerId = a.ownerId ?? null;
      const relation: "owner" | "shared" = ownerId == null || ownerId === uid ? "owner" : "shared";
      const subordinateIds = (a.id ? subordinatesByParent.get(a.id) : undefined) ?? [];
      const isTeamLeader = subordinateIds.length > 0;
      // `project` is populated ONLY for a team leader, from its first associated
      // project that still resolves to an existing one (its "principal" project).
      let project: AssistantAgentProjectRef | null = null;
      if (isTeamLeader) {
        for (const pid of a.projectIds ?? []) {
          const name = projectNameById.get(pid);
          if (name) {
            project = { id: pid, name };
            break;
          }
        }
        // Fallback: no direct project link resolved (empty/deleted projectIds) →
        // resolve by the leader's team name matching a project title.
        if (!project && a.teamId) {
          const teamName = teamNameById.get(a.teamId);
          const match = teamName ? projectByTitleLower.get(teamName.trim().toLowerCase()) : undefined;
          if (match && match.id) project = { id: match.id, name: match.name };
        }
      }
      return {
        ...redactAgent(a),
        ownerId,
        relation,
        ownerName: ownerId != null ? (nameById.get(ownerId) ?? null) : null,
        // Derived hierarchy hints (additive). `parentAgentId` stays the raw
        // leader id of THIS agent; `subordinateIds` are its direct reports;
        // `isTeamLeader` is true when it leads a team (has ≥1 subordinate).
        isTeamLeader,
        subordinateIds,
        // Team leader's principal project (display-only), else null. See
        // AssistantAgentProjectRef.
        project,
      };
    });
    return annotated;
}

export const agentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, agents: await loadAssistantAgents(req, res) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentsRepository.get(String(req.params["id"] ?? ""));
    if (!agent) throw assistantNotFound(res.locals.locale, "agent");
    res.json({ ok: true, agent: redactAgent(agent) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    // Nombres de tool muertos migran (aliases); desconocidos reales → 400.
    if (Array.isArray(parsed.data.allowedTools)) {
      parsed.data.allowedTools = normalizeAllowedTools(parsed.data.allowedTools, {
        onUnknown: "reject",
        context: "agents.create",
      })!.valid;
    }
    await assertTeamExists(parsed.data.teamId, res.locals.locale);
    const agent = await agentsRepository.create(parsed.data);
    res.json({ ok: true, agent: redactAgent(agent) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const cur = await agentsRepository.get(id);
    if (!cur) throw assistantNotFound(res.locals.locale, "agent");
    assertCanModify(cur.ownerId, res.locals.locale);
    if (Array.isArray(parsed.data.allowedTools)) {
      parsed.data.allowedTools = normalizeAllowedTools(parsed.data.allowedTools, {
        onUnknown: "reject",
        context: "agents.update",
      })!.valid;
    }
    if (parsed.data.parentAgentId !== undefined) {
      await assertNoSubordinationCycle(id, parsed.data.parentAgentId, res.locals.locale);
    }
    if (parsed.data.teamId !== undefined) await assertTeamExists(parsed.data.teamId, res.locals.locale);
    // Realtime is gated by the (possibly newly-set) provider — clear it when the
    // effective provider can't do realtime, so switching providers turns it off.
    const effProvider = parsed.data.providerId ?? cur.providerId;
    if (!providerSupportsRealtime(effProvider)) parsed.data.realtime = false;
    const agent = await agentsRepository.update(id, parsed.data);
    res.json({ ok: true, agent: agent ? redactAgent(agent) : agent });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const cur = await agentsRepository.get(id);
    if (!cur) throw assistantNotFound(res.locals.locale, "agent");
    assertCanModify(cur.ownerId, res.locals.locale);
    const ok = await agentsRepository.delete(id);
    res.json({ ok });
  }),

  /**
   * POST /api/ai/agents/suggest — one-shot LLM that drafts a COMPLETE, professional
   * agent (name, description, system prompt, relevant tool subset) from a short
   * brief / quick archetype. The model is given the real tool catalog so its
   * `allowedTools` are valid; we intersect the result against it server-side so it
   * can never widen access. Does NOT persist — returns a suggestion to prefill the
   * form. Fail: a clean 502 (no API provider configured / bad model output).
   */
  suggest: asyncHandler(async (req: Request, res: Response) => {
    const parsed = suggestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const executor = getExecutor(req);
    const user = res.locals["user"] as SessionUser | undefined;

    const config = await assistantConfigRepository.load(executor);
    const tools = await assistantModulesService.allowedTools(executor, user);
    const toolCatalog = tools.map((t) => `- ${t.name}: ${t.title}`).join("\n") || "(sin herramientas disponibles)";
    const toolNames = new Set(tools.map((t) => t.name));

    const system =
      "Eres un diseñador experto de agentes de IA para administración de servidores Linux (panel tipo cPanel). " +
      "A partir de una breve descripción de rol, defines un agente PROFESIONAL y listo para usar. " +
      "Respondes EXCLUSIVAMENTE con un objeto JSON válido (sin texto adicional, sin markdown) con esta forma:\n" +
      '{ "name": string (≤60 chars, claro y profesional), ' +
      '"description": string (≤200 chars, qué hace el agente), ' +
      '"systemPrompt": string (instrucciones completas, rol, tono, objetivos, límites y buenas prácticas; 600-1500 chars), ' +
      '"allowedTools": string[] (SOLO nombres EXACTOS del catálogo que el rol realmente necesita; [] si ninguna) }\n' +
      "Reglas: el systemPrompt debe ser accionable y específico al rol; no inventes nombres de herramientas fuera del catálogo; " +
      `elige el subconjunto mínimo de herramientas necesario para el rol. Escribe name, description y systemPrompt en ${aiOutputLanguage(res.locals.locale)}.\n\n` +
      `Catálogo de herramientas disponibles:\n${toolCatalog}`;

    let text = "";
    try {
      const out = await aiComplete(config, {
        ...(parsed.data.providerId ? { providerId: parsed.data.providerId } : {}),
        system,
        user: `Rol/objetivo del agente solicitado: ${parsed.data.brief}`,
        signal: AbortSignal.timeout(45_000),
      });
      text = out.text ?? "";
    } catch (err) {
      log.warn({ err: (err as Error).message }, "agent suggest: aiComplete failed");
      throw new AppError(
        apiModuleMessage(res.locals.locale, "assistantSuggestFailed"),
        502,
        "AI_SUGGEST_FAILED",
      );
    }

    const obj = extractJsonObject(text);
    if (!obj) throw new AppError(apiModuleMessage(res.locals.locale, "assistantSuggestBadOutput"), 502, "AI_SUGGEST_BAD_OUTPUT");

    const rawTools = Array.isArray(obj["allowedTools"]) ? (obj["allowedTools"] as unknown[]) : null;
    const allowedTools = rawTools
      ? (sanitizeAllowedTools(rawTools) ?? []).filter((n) => toolNames.has(n))
      : null;
    const providerId = isAssistantProviderId(obj["providerId"]) ? (obj["providerId"] as string) : undefined;

    res.json({
      ok: true,
      suggestion: {
        name: String(obj["name"] ?? "").slice(0, 120),
        description: String(obj["description"] ?? "").slice(0, 500),
        systemPrompt: String(obj["systemPrompt"] ?? "").slice(0, 20000),
        allowedTools,
        ...(providerId ? { providerId } : {}),
      },
    });
  }),

  /**
   * POST /api/ai/agents/propose-from-folder — analyze a folder on the connected
   * server and have the LLM propose a TEAM of specialized agents to manage that
   * project (frontend / backend / DevOps / QA…, per what's actually there). The
   * model gets the real tool catalog so each agent's `allowedTools` are valid
   * (intersected server-side). Does NOT persist — returns editable proposals,
   * each pre-bound to the folder via `projectPaths`. The client edits/selects
   * them and creates the chosen ones via `POST /api/ai/agents`.
   */
  proposeFromFolder: asyncHandler(async (req: Request, res: Response) => {
    const parsed = proposeSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const executor = getExecutor(req);
    const user = res.locals["user"] as SessionUser | undefined;
    const count = parsed.data.count ?? 4;

    const config = await assistantConfigRepository.load(executor);
    const tools = await assistantModulesService.allowedTools(executor, user);
    const toolCatalog = tools.map((t) => `- ${t.name}: ${t.title}`).join("\n") || "(sin herramientas disponibles)";
    const toolNames = new Set(tools.map((t) => t.name));

    const summary = await summarizeFolder(executor, parsed.data.path);

    const system =
      "Eres un arquitecto experto de equipos de agentes de IA para administrar y desarrollar proyectos en un panel de servidores Linux (estilo cPanel). " +
      `A partir del análisis de una carpeta/proyecto, propones un EQUIPO de entre 2 y ${count} agentes ESPECIALIZADOS y complementarios para gestionar/desarrollar ESE proyecto en concreto ` +
      "(por ejemplo: frontend, backend/API, base de datos, DevOps/despliegue, QA/tests, documentación), SEGÚN lo que realmente exista en la carpeta. " +
      "Respondes EXCLUSIVAMENTE con un ARRAY JSON válido (sin texto adicional, sin markdown) de objetos con esta forma:\n" +
      '[{ "name": string (≤60, claro y profesional), ' +
      '"description": string (≤200, qué gestiona en este proyecto), ' +
      '"systemPrompt": string (instrucciones completas: rol, responsabilidades sobre ESTA carpeta, tono, límites y buenas prácticas; 500-1500 chars), ' +
      '"allowedTools": string[] (SOLO nombres EXACTOS del catálogo que el rol necesita; [] si ninguna), ' +
      '"icon": string (un nombre de icono lucide en kebab-case, p. ej. "code", "database", "rocket"), ' +
      '"color": string (uno de: violet, blue, emerald, amber, rose, cyan, slate, teal, indigo) }]\n' +
      "Reglas: agentes DISTINTOS y NO redundantes; cada systemPrompt debe referirse al proyecto de la ruta dada y ser accionable; " +
      `no inventes herramientas fuera del catálogo; elige el subconjunto mínimo de herramientas por agente. Escribe name, description y systemPrompt en ${aiOutputLanguage(res.locals.locale)}.\n\n` +
      `Catálogo de herramientas disponibles:\n${toolCatalog}`;

    const userMsg =
      `Carpeta/proyecto a gestionar: ${parsed.data.path}\n\n` +
      `Análisis de la carpeta:\n${summary}\n\n` +
      `Propón el equipo de agentes (entre 2 y ${count}).`;

    let text = "";
    try {
      const out = await aiComplete(config, {
        ...(parsed.data.providerId ? { providerId: parsed.data.providerId } : {}),
        system,
        user: userMsg,
        signal: AbortSignal.timeout(60_000),
      });
      text = out.text ?? "";
    } catch (err) {
      log.warn({ err: (err as Error).message }, "agent propose-from-folder: aiComplete failed");
      throw new AppError(
        apiModuleMessage(res.locals.locale, "assistantProposeFailed"),
        502,
        "AI_PROPOSE_FAILED",
      );
    }

    const arr = extractJsonArray(text);
    if (!arr || arr.length === 0) {
      throw new AppError(apiModuleMessage(res.locals.locale, "assistantProposeBadOutput"), 502, "AI_PROPOSE_BAD_OUTPUT");
    }

    const defaultProvider = parsed.data.providerId
      ?? (isAssistantProviderId(config.activeProvider) ? config.activeProvider : "claude");

    const agents = arr
      .slice(0, count)
      .map((obj) => {
        const rawTools = Array.isArray(obj["allowedTools"]) ? (obj["allowedTools"] as unknown[]) : null;
        const allowedTools = rawTools
          ? (sanitizeAllowedTools(rawTools) ?? []).filter((n) => toolNames.has(n))
          : null;
        const color = String(obj["color"] ?? "").toLowerCase();
        return {
          name: String(obj["name"] ?? "").slice(0, 120),
          description: String(obj["description"] ?? "").slice(0, 500),
          systemPrompt: String(obj["systemPrompt"] ?? "").slice(0, 20000),
          providerId: defaultProvider,
          model: "",
          allowedTools,
          icon: String(obj["icon"] ?? "robot").slice(0, 60),
          color: PROPOSE_COLORS.has(color) ? color : "violet",
          projectPaths: [parsed.data.path],
        };
      })
      .filter((a) => a.name && a.systemPrompt);

    res.json({ ok: true, path: parsed.data.path, agents });
  }),
};
