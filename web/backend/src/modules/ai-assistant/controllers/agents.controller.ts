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
 * Profiles remain in the contextual connected-target sidecar. Owner name
 * resolution is best-effort against that target\'s user list (display only).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import type { SessionUser } from "../../../shared/types/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { avatarConfigSchema, serverSchema, skillsSchema } from "./shared-schemas.js";
import { getExecutor, getContextUser } from "../../../shared/executor/index.js";
import { ValidationError, AppError } from "../../../shared/errors/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { aiOutputLanguage } from "../../../shared/i18n/ai-output-language.js";
import { agentMarketService, assertAssignmentIdle } from "../services/agent-market.service.js";
import { assertProjectScope, mayUseProject } from "../services/agent-context.service.js";
import { withAssignmentLock } from "../services/agent-assignment-lock.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentTeamsRepository } from "../repositories/agent-teams.repository.js";
import { PROVIDER_IDS } from "../models/assistant-config.types.js";
import { sanitizeAllowedTools, isAssistantProviderId, providerSupportsRealtime, type AssistantAgent } from "../models/assistant-agent.types.js";
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
  knowledge: z.string().max(12000).optional(),
  specialty: z.string().trim().max(200).optional(),
  technologies: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
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

export const privateAgentUpdateSchema = z.object({
  knowledge: z.string().max(12000).optional(),
  specialty: z.string().trim().max(200).optional(),
  technologies: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
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

const assignmentSchema = z.object({
  jobTitle: z.string().trim().max(200).optional(),
  parentAgentId: z.string().max(64).nullable().optional(),
  connections: z.array(z.string().max(64)).max(20).nullable().optional(),
  instructions: z.string().max(20000).optional(),
  roleId: z.string().max(64).nullable().optional(),
  allowedTools: z.array(z.string().max(120)).max(500).nullable().optional(),
  canSpawnChats: z.boolean().nullable().optional(),
  projectPaths: z.array(z.string().startsWith("/").max(500)).max(20).nullable().optional(),
  serverIds: z.array(z.string().min(1).max(128)).max(50).nullable().optional(),
  graphProjectIds: z.array(z.string().min(1).max(64)).max(100).nullable().optional(),
}).strict();

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
export function redactAgent<T extends object>(
  a: T,
): Omit<T, "credential"> & { credential: { label?: string; username: string; hasSecret: true } | null } {
  const { credential, ...rest } = a as T & { credential?: AssistantAgent["credential"] };
  return {
    ...JSON.parse(JSON.stringify(rest, (key, value) => key === "credential" ?
      (value?.username ? { label: value.label, username: value.username, hasSecret: true } : null) : value)),
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

/** Propietario, o administrador de un perfil legado sin dueño. */
function assertCanModify(ownerId: number | null | undefined, locale: unknown): void {
  if (!mayUseProject({ ownerId }, getContextUser())) {
    throw new AppError(apiModuleMessage(locale, "assistantOwnershipDenied"), 403, "ASSISTANT_PROJECT_FORBIDDEN");
  }
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

const catalogQuerySchema = z.object({
  q: z.string().trim().max(500).optional(),
  technology: z.string().trim().max(60).optional(),
  projectId: z.string().trim().min(1).max(64).optional(),
  contextProjectId: z.string().trim().min(1).max(64).optional(),
}).refine(q => !q.projectId || !q.contextProjectId || q.projectId === q.contextProjectId,
  "projectId y contextProjectId deben identificar el mismo proyecto.");

export async function loadAssistantAgents(req: Request, res: Response) {
  const executor = getExecutor(req), user = res.locals["user"] as SessionUser | undefined;
  const parsed = catalogQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError("Consulta de agentes inválida", zodIssues(parsed.error.issues, res.locals.locale));
  const { projectId, contextProjectId } = parsed.data;
  const contextId = contextProjectId ?? projectId;
  const all = await projectsRepository.list(executor);
  if (contextId) assertProjectScope(all, contextId, user);
  // Resolve the roster before search so a name/technology filter cannot change hierarchy.
  const presented = await Promise.all((await agentsRepository.list()).filter(a => mayUseProject(a, user)).map(a =>
    agentMarketService.present(executor, a, user, { contextProjectId: contextId, projects: all })));
  const roster = contextId ? presented.filter(a => a.context?.effectiveConfig) : presented;
  const q = (parsed.data.q ?? "").toLocaleLowerCase();
  const technology = (parsed.data.technology ?? "").toLocaleLowerCase();
  const agents = presented.filter(a =>
    (!projectId || !!a.context?.effectiveAssignment) &&
    (!q || [a.name, a.description, a.specialty, ...a.technologies].join(" ").toLocaleLowerCase().includes(q)) &&
    (!technology || a.technologies.some(t => t.toLocaleLowerCase() === technology)));
  const users = await panelUserRepository.findAll(executor).catch(() => []);
  const nameById = new Map(users.map(u => [u.id, u.displayName || u.username]));
  return agents.map(a => {
    const subordinateIds = roster.filter(b => (contextId ? b.context?.effectiveConfig?.parentAgentId : b.parentAgentId) === a.id && b.id).map(b => b.id!);
    const uniqueId = a.projectIds.length === 1 ? a.projectIds[0] : undefined;
    const project = uniqueId ? all.find(p => p.id === uniqueId) : undefined;
    return {
      ...redactAgent(a), ownerId: a.ownerId ?? null,
      relation: a.capabilities.canEditProfile ? "owner" : "shared",
      ownerName: a.ownerId != null ? nameById.get(a.ownerId) ?? null : null,
      isTeamLeader: subordinateIds.length > 0, subordinateIds,
      project: project ? { id: project.id!, name: project.title } : null,
    };
  });
}

export const agentsController = {
  assignments: asyncHandler(async (req: Request, res: Response) => {
    const result = await agentMarketService.assignments(getExecutor(req), String(req.params["id"]), typeof req.query["projectId"] === "string" ? req.query["projectId"] : undefined, res.locals["user"]);
    res.json({ ok: true, ...redactAgent(result) });
  }),
  putAssignment: asyncHandler(async (req: Request, res: Response) => {
    const parsed = assignmentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const assignment = await agentMarketService.put(getExecutor(req), String(req.params["id"]), String(req.params["projectId"]), parsed.data, res.locals["user"]);
    res.json({ ok: true, assignment: redactAgent(assignment) });
  }),
  removeAssignment: asyncHandler(async (req: Request, res: Response) => {
    await agentMarketService.remove(getExecutor(req), String(req.params["id"]), String(req.params["projectId"]), res.locals["user"]);
    res.json({ ok: true });
  }),
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, agents: await loadAssistantAgents(req, res) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentsRepository.get(String(req.params["id"] ?? ""));
    if (!agent) throw assistantNotFound(res.locals.locale, "agent");
    res.json({ ok: true, agent: redactAgent(await agentMarketService.present(getExecutor(req), agent, res.locals["user"])) });
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
    const projects = await projectsRepository.list(getExecutor(req));
    for (const projectId of new Set([...(parsed.data.projectIds ?? []), ...(parsed.data.graphProjectIds ?? [])])) {
      assertProjectScope(projects, projectId, res.locals["user"]);
    }
    if (req.body?.assignments !== undefined) throw new ValidationError("Usa los endpoints de asignaciones.");
    const agent = await agentsRepository.create(parsed.data);
    res.json({ ok: true, agent: redactAgent(agent) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = privateAgentUpdateSchema.safeParse(req.body);
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
    if (req.body?.assignments !== undefined) throw new ValidationError("Usa los endpoints de asignaciones.");
    if (parsed.data.graphProjectIds?.length) {
      const projects = await projectsRepository.list(getExecutor(req));
      for (const projectId of parsed.data.graphProjectIds) assertProjectScope(projects, projectId, res.locals["user"]);
    }
    const agent = await agentMarketService.updateProfile(getExecutor(req), id, parsed.data, res.locals["user"]);
    res.json({ ok: true, agent: agent ? redactAgent(await agentMarketService.present(getExecutor(req), agent, res.locals["user"])) : agent });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const cur = await agentsRepository.get(id);
    if (!cur) throw assistantNotFound(res.locals.locale, "agent");
    assertCanModify(cur.ownerId, res.locals.locale);
    const executor = getExecutor(req);
    const ok = await withAssignmentLock(executor, id, async () => {
      await assertAssignmentIdle(executor, cur, cur.projectIds ?? []);
      return agentsRepository.delete(id);
    });
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
      "Reglas: el perfil es general y portable; no incluye modelos, proveedores, rutas, jerarquías ni datos privados de proyectos. El systemPrompt debe ser accionable y específico al rol; no inventes nombres de herramientas fuera del catálogo; " +
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


    res.json({
      ok: true,
      suggestion: {
        name: String(obj["name"] ?? "").slice(0, 120),
        description: String(obj["description"] ?? "").slice(0, 500),
        systemPrompt: String(obj["systemPrompt"] ?? "").slice(0, 20000),
        allowedTools,

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
