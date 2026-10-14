// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team templates controller — read-only blueprints of agent hierarchies +
 * apply endpoint that materialises the blueprint into real agents.
 *
 *   GET    /api/ai/team-templates          list (categories + slim templates)
 *   GET    /api/ai/team-templates/:id      full template (with systemPrompts)
 *   POST   /api/ai/team-templates/:id/apply  create real agents
 */
import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { avatarConfigSchema } from "./shared-schemas.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { teamTemplatesService } from "../services/team-templates.service.js";
import { teamFeedbackRepository } from "../repositories/team-feedback.repository.js";
import { PROVIDER_IDS } from "../models/assistant-config.types.js";

const slotOverrideSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().max(20000).optional(),
  providerId: z.enum(PROVIDER_IDS).optional(),
  model: z.string().max(80).optional(),
  allowedTools: z.array(z.string().max(120)).max(500).nullable().optional(),
  icon: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
  avatarConfig: avatarConfigSchema,
  projectPaths: z.array(z.string().max(500)).max(20).optional(),
  agentMode: z.enum(["single", "multi"]).optional(),
  multiAgentCount: z.number().int().min(2).max(8).optional(),
  realtime: z.boolean().optional(),
});

const applySchema = z.object({
  slotOverrides: z.record(slotOverrideSchema).optional(),
  defaults: z
    .object({
      providerId: z.enum(PROVIDER_IDS).optional(),
      model: z.string().max(80).optional(),
      projectPaths: z.array(z.string().max(500)).max(20).optional(),
    })
    .optional(),
  rootCanSpawnChats: z.boolean().optional(),
  namePrefix: z.string().max(60).optional(),
});

export const teamTemplatesController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ ok: true, ...teamTemplatesService.list() });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const t = teamTemplatesService.get(id);
    res.json({ ok: true, template: t });
  }),

  apply: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const result = await teamTemplatesService.apply(id, parsed.data);
    res.json({ ok: true, ...result });
  }),

  /** Read-only diff of a materialised team vs its blueprint (proposal only). */
  resync: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = z.object({ rootAgentId: z.string().min(1).max(64) }).safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const result = await teamTemplatesService.resync(id, parsed.data.rootAgentId);
    res.json({ ok: true, ...result });
  }),

  /** Materialise ONLY the missing slots the user accepted after a resync. */
  applyMissing: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = z
      .object({
        rootAgentId: z.string().min(1).max(64),
        slotIds: z.array(z.string().min(1).max(64)).min(1).max(50),
      })
      .safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const result = await teamTemplatesService.applyMissing(id, parsed.data.rootAgentId, parsed.data.slotIds);
    res.json({ ok: true, ...result });
  }),

  /** Calidad agregada de las tareas de esta plantilla (per-server). */
  feedbackStats: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const executor = getExecutor(req);
    const all = await teamFeedbackRepository.listByTemplate(executor, id);
    const up = all.filter((f) => f.rating === "up").length;
    const byNode: Record<string, { up: number; total: number }> = {};
    for (const f of all) {
      const key = f.templateNodeKey ?? "(sin slot)";
      const cur = byNode[key] ?? { up: 0, total: 0 };
      cur.total++;
      if (f.rating === "up") cur.up++;
      byNode[key] = cur;
    }
    res.json({
      ok: true,
      stats: { total: all.length, up, ratio: all.length ? Math.round((up / all.length) * 100) : 0, byNode },
    });
  }),
};