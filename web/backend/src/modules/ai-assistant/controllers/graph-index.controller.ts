// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — codebase-graph indexing per project.
 *
 *   GET    /api/ai/graph/status                  target availability (probe, cached)
 *   POST   /api/ai/projects/:id/graph-index      start an index run (async job)
 *   GET    /api/ai/projects/:id/graph-index      current index state
 *   DELETE /api/ai/projects/:id/graph-index      disable toggle (?purge=1 drops the graph project)
 *
 * Only meaningful when the connected target ships the `codebase-memory-mcp`
 * binary — the UI hides itself when availability is false.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { projectsRepository } from "../repositories/projects.repository.js";
import { graphIndexService } from "../services/graph-index.service.js";
import { assertCanModify } from "./projects.controller.js";

export const graphIndexController = {
  availability: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const refresh = String(req.query["refresh"] ?? "") === "1";
    const a = await graphIndexService.probeAvailability(executor, { refresh });
    res.json({ ok: true, available: a.available, version: a.version, moduleInstalled: a.moduleInstalled });
  }),

  start: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const project = await projectsRepository.get(executor, id);
    if (!project) throw assistantNotFound(res.locals.locale, "project");
    assertCanModify(project.ownerId, res.locals.locale);
    const { jobId } = await graphIndexService.startIndex(executor, project);
    res.json({ ok: true, jobId });
  }),

  status: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const project = await projectsRepository.get(executor, id);
    if (!project) throw assistantNotFound(res.locals.locale, "project");
    const graphIndex = await graphIndexService.getStatus(executor, project);
    res.json({ ok: true, graphIndex });
  }),

  disable: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const project = await projectsRepository.get(executor, id);
    if (!project) throw assistantNotFound(res.locals.locale, "project");
    assertCanModify(project.ownerId, res.locals.locale);
    const purge = String(req.query["purge"] ?? "") === "1";
    await graphIndexService.disable(executor, project, purge);
    res.json({ ok: true });
  }),
};
