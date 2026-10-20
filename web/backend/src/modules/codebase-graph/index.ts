// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Request, type Response } from "express";
import type { ModuleRegistrar } from "../../shared/types/index.js";
import { asyncHandler } from "../../shared/types/index.js";
import { requireAuth } from "../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../auth/middlewares/require-module.middleware.js";
import { getExecutor, LOCAL_TARGET_ID } from "../../shared/executor/index.js";
import { getContextUserId } from "../../shared/executor/context.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { projectsRepository } from "../ai-assistant/repositories/projects.repository.js";
import { graphIndexService, runGraphCli } from "../ai-assistant/services/graph-index.service.js";

const router = Router();
router.use("/api/codebase-graph", requireAuth, requireModule("codebase-graph"));

router.get("/api/codebase-graph/original-authorize", (req, res) => {
  const user = res.locals["user"];
  if (user?.kind !== "admin" || getExecutor(req).target.id !== LOCAL_TARGET_ID) {
    throw new ForbiddenError("El visor original está disponible solo para administradores del servidor local");
  }
  res.status(204).end();
});

function canView(ownerId: number | null | undefined, res: Response): boolean {
  return res.locals["user"]?.kind === "admin" || (ownerId != null && ownerId === getContextUserId());
}

router.get("/api/codebase-graph/projects", asyncHandler(async (req: Request, res: Response) => {
  const executor = getExecutor(req);
  const availability = await graphIndexService.probeAvailability(executor);
  const projects = (await projectsRepository.list(executor))
    .filter((project) => canView(project.ownerId, res))
    .map(({ id, title, path, parentId, graphIndex }) => ({ id, title, path, parentId, graphIndex }));
  res.json({ ok: true, data: { availability, projects } });
}));

const TOOL_KEYS: Record<string, string[]> = {
  get_architecture: ["aspects"],
  search_graph: ["query", "label", "name_pattern", "qn_pattern", "file_pattern", "limit"],
  trace_path: ["function_name", "direction", "depth", "mode"],
  get_code_snippet: ["qualified_name", "include_neighbors"],
  index_status: [],
  detect_changes: ["scope", "depth"],
};

router.post("/api/codebase-graph/projects/:id/query", csrfProtection, asyncHandler(async (req: Request, res: Response) => {
  const tool = String(req.body?.tool ?? "");
  const keys = TOOL_KEYS[tool];
  if (!keys) throw new ValidationError("Consulta de grafo no admitida");
  const executor = getExecutor(req);
  const project = await projectsRepository.get(executor, String(req.params["id"] ?? ""));
  if (!project || !canView(project.ownerId, res)) throw new NotFoundError("Proyecto no encontrado");
  if (!project.path || !project.graphIndex?.enabled) throw new ValidationError("El proyecto no tiene índice de grafo activo");
  const availability = await graphIndexService.probeAvailability(executor);
  if (!availability.available || !availability.binPath) throw new ValidationError("El grafo no está disponible en este servidor");
  const resolved = await graphIndexService.resolveGraphProject(executor, availability.binPath, project.path);
  if (!resolved) throw new NotFoundError("Índice del proyecto no encontrado");
  const raw = req.body?.args;
  if (raw != null && (typeof raw !== "object" || Array.isArray(raw))) throw new ValidationError("Argumentos inválidos");
  const supplied = (raw ?? {}) as Record<string, unknown>;
  const args: Record<string, unknown> = { project: resolved.name };
  for (const key of keys) {
    const value = supplied[key];
    if (typeof value === "string") args[key] = value.slice(0, 300);
    else if (typeof value === "boolean") args[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) args[key] = Math.min(100, Math.max(0, value));
    else if (Array.isArray(value)) args[key] = value.filter((item) => typeof item === "string").slice(0, 10);
  }
  const result = await runGraphCli<unknown>(executor, availability.binPath, tool, args);
  const encoded = JSON.stringify(result);
  res.json({ ok: true, data: encoded.length > 100_000 ? { truncated: true, partial: encoded.slice(0, 100_000) } : result });
}));

export const registerCodebaseGraphModule: ModuleRegistrar = (app) => { app.use(router); };
