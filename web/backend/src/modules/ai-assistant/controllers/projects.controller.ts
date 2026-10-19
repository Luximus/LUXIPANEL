// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — projects (ChatGPT-style folders).
 *
 *   GET    /api/ai/projects          list
 *   POST   /api/ai/projects          create
 *   PATCH  /api/ai/projects/:id      update
 *   DELETE /api/ai/projects/:id      delete
 */

import { z } from "zod";
import path from "node:path";
import type { Request, Response } from "express";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { serverSchema, skillsSchema } from "./shared-schemas.js";
import { assertOwner } from "./ownership.js";
import { getExecutor, getContextUserId } from "../../../shared/executor/index.js";
import { ConflictError, ValidationError } from "../../../shared/errors/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { projectsRepository, STRUCTURE_PROVIDER_IDS, type StructureProviderId } from "../repositories/projects.repository.js";
import { DEFAULT_PROVIDER_ID } from "../models/assistant-config.types.js";
import { projectSuggestionsService } from "../services/project-suggestions.service.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { safePath } from "../../files/services/filesystem.service.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import { projectWorkspaceService } from "../services/project-workspace.service.js";

import { projectDocumentService } from "../services/project-document.service.js";
import { ensureProjectStorage, projectStorageRoot } from "../services/project-storage.service.js";

const providerSchema = z.enum(STRUCTURE_PROVIDER_IDS);
const previewUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}, "La URL de vista previa debe ser HTTPS o una ruta del panel");
const fileProjectRefSchema = z.object({ targetId: z.string().min(1).max(128), path: z.string().startsWith("/").max(512) }).nullable();

function isWithinProjectDirectory(child: string, parent: string): boolean {
  if (!child.startsWith("/") || !parent.startsWith("/") || child.includes("\0") || parent.includes("\0")) return false;
  const base = path.posix.resolve(parent);
  const candidate = path.posix.resolve(child);
  return base === "/" || candidate === base || candidate.startsWith(`${base}/`);
}

const createSchema = z.object({
  profile: z.string().trim().max(2000).optional(),
  technologies: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
  title: z.string().min(1).max(120),
  icon: z.string().max(48).default("folder"),
  path: z.string().max(512).default(""),
  instructions: z.string().max(8192).default(""),
  webPreviewUrl: previewUrlSchema.optional(),
  appPreviewUrl: previewUrlSchema.optional(),
  fileProjectRef: fileProjectRefSchema.optional(),
  provider: providerSchema.default(DEFAULT_PROVIDER_ID as StructureProviderId),
  parentId: z.string().max(64).nullable().optional(),
  teamName: z.string().trim().min(1).max(120).optional(),
  leaderName: z.string().trim().min(1).max(120).optional(),
  creationKey: z.string().uuid().optional(),
  servers: z.array(serverSchema).max(50).optional(),
  skills: skillsSchema.optional(),
  // Pre-filtro del selector de snippets: NOMBRES de categoría/tags (no ids).
  // "" / [] = sin filtro.
  snippetCategory: z.string().trim().max(120).optional(),
  snippetTags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  /** Receta de verificación de tareas de equipo (definition of done). */
  verify: z
    .object({ commands: z.array(z.string().max(400)).max(10), timeoutMs: z.number().int().optional() })
    .nullable()
    .optional(),
  /** Toggle de indexación en el grafo de código — lo ÚNICO del graphIndex que
   *  acepta el cliente; el resto del estado lo escribe graph-index.service. */
  graphIndexEnabled: z.boolean().optional(),
});

const updateSchema = z.object({
  profile: z.string().trim().max(2000).optional(),
  technologies: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
  title: z.string().min(1).max(120).optional(),
  icon: z.string().max(48).optional(),
  path: z.string().max(512).optional(),
  expectedPath: z.string().max(512).optional(),
  instructions: z.string().max(8192).optional(),
  webPreviewUrl: previewUrlSchema.optional(),
  appPreviewUrl: previewUrlSchema.optional(),
  fileProjectRef: fileProjectRefSchema.optional(),
  provider: providerSchema.optional(),
  parentId: z.string().max(64).nullable().optional(),
  sortOrder: z.number().finite().min(-1e12).max(1e12).optional(),
  servers: z.array(serverSchema).max(50).optional(),
  /** Opt-in auto-capture of conversation excerpts to the project vault (B2). */
  autoCapture: z.boolean().optional(),
  skills: skillsSchema.optional(),
  // undefined = no tocar; "" (categoría) / [] (tags) = limpiar el filtro.
  snippetCategory: z.string().trim().max(120).optional(),
  snippetTags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  verify: z
    .object({ commands: z.array(z.string().max(400)).max(10), timeoutMs: z.number().int().optional() })
    .nullable()
    .optional(),
  graphIndexEnabled: z.boolean().optional(),
});

/** El proyecto es del usuario actual (o legacy sin dueño) → puede editar/borrar.
 *  Exportado: graph-index.controller aplica la misma regla. */
export function assertCanModify(ownerId: number | null | undefined, locale: unknown): void {
  assertOwner(ownerId, locale);
}

async function validateFileProjectRef(req: Request, res: Response, ref: { targetId: string; path: string } | null | undefined, exceptId?: string): Promise<{ targetId: string; path: string } | null | undefined> {
  if (ref == null) return ref;
  const executor = getExecutor(req);
  const user = res.locals["user"] as SessionUser | undefined;
  const resolved = safePath(ref.path);
  if (ref.targetId !== executor.target.id || !user || !canAccessPath(user, resolved, "read")) {
    throw new ValidationError(apiModuleMessage(res.locals.locale, "assistantFileProjectOutside"));
  }
  const existing = await projectsRepository.list(executor);
  if (existing.some((project) => project.id !== exceptId && project.fileProjectRef?.targetId === ref.targetId && project.fileProjectRef.path === resolved)) {
    throw new ValidationError(apiModuleMessage(res.locals.locale, "assistantFileProjectLinked"));
  }
  return { targetId: ref.targetId, path: resolved };
}

export async function loadAssistantProjects(req: Request, res: Response) {
    const executor = getExecutor(req);
    const uid = getContextUserId();
    const all = await projectsRepository.list(executor);
    // Visibilidad (el store es global por servidor y un proyecto lleva paths +
    // instrucciones): los admins ven todo; un usuario no-admin SOLO ve los
    // suyos. Los legacy sin `ownerId` quedan visibles solo para admins — antes
    // todos los usuarios veían todos los proyectos (fuga de rutas/contexto).
    const sessionUser = res.locals["user"] as SessionUser | undefined;
    const isAdmin = sessionUser?.kind === "admin";
    const projects = isAdmin ? all : all.filter((p) => (p.ownerId ?? null) === uid);
    // Nombre del dueño para los "compartidos contigo" (creados por otro usuario
    // del servidor). El store de proyectos es global, así que la relación se
    // calcula respecto al solicitante.
    const users = await panelUserRepository.findAll(executor).catch(() => []);
    const nameById = new Map(users.map((u) => [u.id, u.displayName || u.username]));
    const annotated = projects.map((p) => {
      const ownerId = p.ownerId ?? null;
      const relation: "owner" | "shared" = ownerId == null || ownerId === uid ? "owner" : "shared";
      return {
        ...p,
        storagePath: projectStorageRoot(p),
        ownerId,
        relation,
        ownerName: ownerId != null ? (nameById.get(ownerId) ?? null) : null,
      };
    });
    return annotated;
}

export const projectsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, projects: await loadAssistantProjects(req, res) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const executor = getExecutor(req);
    if (parsed.data.creationKey) {
      const existing = (await projectsRepository.list(executor)).find((p) => p.creationKey === parsed.data.creationKey && p.ownerId === getContextUserId());
      if (existing) { res.json({ ok: true, project: existing }); return; }
    }
    if (parsed.data.parentId) {
      const parent = await projectsRepository.get(executor, parsed.data.parentId);
      if (!parent) throw new ValidationError("El proyecto padre ya no existe.");
      assertCanModify(parent.ownerId, res.locals.locale);
      if (!isWithinProjectDirectory(parsed.data.path, parent.path)) {
        throw new ValidationError("El subproyecto debe estar dentro del directorio del proyecto padre.");
      }
    }
    parsed.data.fileProjectRef = await validateFileProjectRef(req, res, parsed.data.fileProjectRef);
    const result = await projectWorkspaceService.create(executor, parsed.data);
    let project = result.project;
    await ensureProjectStorage(executor, project);
    // Toggle del grafo en el create: solo persiste `enabled` (la indexación en
    // sí la dispara el cliente vía POST /projects/:id/graph-index al tener id).
    if (parsed.data.graphIndexEnabled && project.id) {
      project =
        (await projectsRepository.setGraphIndex(executor, project.id, { enabled: true, status: "idle" })) ?? project;
    }
    // Let the Obsidian module mint a context container for this project (it
    // listens; no cross-module import). Best-effort — never blocks the create.
    if (result.created) eventBus.emit(Events.AI_PROJECT_CREATED, {
      executor,
      userId: getContextUserId() ?? undefined,
      project,
    });
    // Pre-generate quick-start suggestions for empty chats (fire-and-forget,
    // fail-open). Captures the executor explicitly — runs after the response.
    if (result.created) void projectSuggestionsService.generateAndStore(executor, project).catch(() => undefined);
    res.json({ ok: true, project });
  }),

  repairWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const result = await projectWorkspaceService.repair(getExecutor(req));
    res.json({ ok: true, ...result });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const executor = getExecutor(req);
    const cur = await projectsRepository.get(executor, id);
    // A missing project must 404 — not silently pass `assertCanModify(undefined)`
    // and return `{ ok: true, project: null }`, masking the error to the client.
    if (!cur) throw assistantNotFound(res.locals.locale, "project");
    assertCanModify(cur.ownerId, res.locals.locale);
    parsed.data.fileProjectRef = await validateFileProjectRef(req, res, parsed.data.fileProjectRef, id);
    if (parsed.data.expectedPath !== undefined && parsed.data.expectedPath !== cur.path) {
      throw new ConflictError("El directorio cambió. Vuelve a abrir el proyecto antes de guardar.");
    }
    const nextParentId = parsed.data.parentId !== undefined ? parsed.data.parentId : cur.parentId;
    if (nextParentId && (parsed.data.parentId !== undefined || parsed.data.path !== undefined)) {
      const all = await projectsRepository.list(executor);
      const byId = new Map(all.map((item) => [item.id, item]));
      const parent = byId.get(nextParentId);
      if (!parent) throw new ValidationError("El proyecto padre ya no existe.");
      assertCanModify(parent.ownerId, res.locals.locale);
      if (!isWithinProjectDirectory(parsed.data.path ?? cur.path, parent.path)) {
        throw new ValidationError("El subproyecto debe estar dentro del directorio del proyecto padre.");
      }
      const seen = new Set([id]);
      let ancestor: typeof parent | undefined = parent;
      while (ancestor) {
        if (!ancestor.id || seen.has(ancestor.id)) throw new ValidationError("La jerarquía de proyectos no puede contener ciclos.");
        seen.add(ancestor.id);
        ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
      }
    }
    if ((parsed.data.path !== undefined && parsed.data.path !== cur.path) || (parsed.data.provider !== undefined && parsed.data.provider !== cur.provider)) {
      // Preserve the OLD directory before committing the new cwd/provider.
      const document = await projectDocumentService.read(executor, cur);
      await projectDocumentService.save(executor, cur, document.content, document.revision);
    }
    let project = await projectsRepository.update(executor, id, parsed.data);
    if (
      parsed.data.graphIndexEnabled !== undefined &&
      parsed.data.graphIndexEnabled !== (cur.graphIndex?.enabled ?? false)
    ) {
      project = (await projectsRepository.setGraphIndex(executor, id, { enabled: parsed.data.graphIndexEnabled })) ?? project;
    }
    // Regenerate suggestions only when a DESCRIPTIVE field changed (not for
    // toggles like autoCapture/servers). Fire-and-forget, fail-open.
    const descriptiveChanged =
      (parsed.data.title !== undefined && parsed.data.title !== cur.title) ||
      (parsed.data.instructions !== undefined && parsed.data.instructions !== cur.instructions) ||
      (parsed.data.path !== undefined && parsed.data.path !== cur.path) ||
      (parsed.data.provider !== undefined && parsed.data.provider !== cur.provider);
    if (project && descriptiveChanged) {
      void projectSuggestionsService.generateAndStore(executor, project).catch(() => undefined);
    }
    res.json({ ok: true, project });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const cur = await projectsRepository.get(executor, id);
    if (!cur) throw assistantNotFound(res.locals.locale, "project");
    assertCanModify(cur.ownerId, res.locals.locale);
    const ok = await projectWorkspaceService.remove(executor, cur);
    res.json({ ok });
  }),
};
