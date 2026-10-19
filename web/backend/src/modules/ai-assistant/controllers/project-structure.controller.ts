// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — per-project provider structure (CLAUDE.md, .claude/, AGENTS.md…).
 *
 *   GET  /api/ai/projects/:id/structure              scan recommended tree vs disk
 *   POST /api/ai/projects/:id/structure/scaffold     create selected missing nodes
 *   GET  /api/ai/projects/:id/structure/file?rel=…   read a structure file
 *   PUT  /api/ai/projects/:id/structure/file         write a structure file
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { projectsRepository } from "../repositories/projects.repository.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { projectStructureService } from "../services/project-structure/project-structure.service.js";
import { projectDocumentService } from "../services/project-document.service.js";
import { assertOwner } from "./ownership.js";
import { PROVIDER_IDS } from "../models/assistant-config.types.js";

const scaffoldSchema = z.object({
  rels: z.array(z.string().max(256)).min(1).max(64),
});

const writeSchema = z.object({
  rel: z.string().min(1).max(256),
  content: z.string().max(512 * 1024),
});

const improveSchema = z.object({
  rel: z.string().min(1).max(256),
  content: z.string().max(512 * 1024).optional(),
  instruction: z.string().max(2000).optional(),
  providerId: z.enum(PROVIDER_IDS).optional(),
});

async function loadProject(req: Request, locale: unknown) {
  const id = String(req.params["id"] ?? "");
  const executor = getExecutor(req);
  const project = await projectsRepository.get(executor, id);
  if (!project) throw assistantNotFound(locale, "project");
  assertOwner(project.ownerId, locale);
  return { executor, project };
}

export const projectStructureController = {
  context: asyncHandler(async (req: Request, res: Response) => {
    const { executor, project } = await loadProject(req, res.locals.locale);
    res.json({ ok: true, document: await projectDocumentService.read(executor, project) });
  }),
  saveContext: asyncHandler(async (req: Request, res: Response) => {
    const body = z.object({ content: z.string().max(512 * 1024), revision: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.body);
    const { executor, project } = await loadProject(req, res.locals.locale);
    res.json({ ok: true, document: await projectDocumentService.save(executor, project, body.content, body.revision) });
  }),
  scan: asyncHandler(async (req: Request, res: Response) => {
    const { executor, project } = await loadProject(req, res.locals.locale);
    const structure = await projectStructureService.scan(executor, project);
    res.json({ ok: true, structure });
  }),

  scaffold: asyncHandler(async (req: Request, res: Response) => {
    const parsed = scaffoldSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const { executor, project } = await loadProject(req, res.locals.locale);
    const result = await projectStructureService.scaffold(executor, project, parsed.data.rels);
    res.json({ ok: true, ...result });
  }),

  readFile: asyncHandler(async (req: Request, res: Response) => {
    const rel = String(req.query["rel"] ?? "");
    if (!rel) throw new ValidationError(apiModuleMessage(res.locals.locale, "relRequired"));
    const { executor, project } = await loadProject(req, res.locals.locale);
    const content = await projectStructureService.readFile(executor, project, rel);
    res.json({ ok: true, rel, content });
  }),

  writeFile: asyncHandler(async (req: Request, res: Response) => {
    const parsed = writeSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const { executor, project } = await loadProject(req, res.locals.locale);
    await projectStructureService.writeFile(executor, project, parsed.data.rel, parsed.data.content);
    res.json({ ok: true });
  }),

  improve: asyncHandler(async (req: Request, res: Response) => {
    const parsed = improveSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const { executor, project } = await loadProject(req, res.locals.locale);
    const config = await assistantConfigRepository.load(executor);
    const improved = await projectStructureService.improveFile(executor, project, parsed.data.rel, {
      content: parsed.data.content,
      instruction: parsed.data.instruction,
      providerId: parsed.data.providerId,
      config,
    });
    res.json({ ok: true, improved });
  }),
};
