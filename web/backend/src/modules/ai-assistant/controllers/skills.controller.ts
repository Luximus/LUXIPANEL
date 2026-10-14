// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — skills/methods endpoints.
 *
 * GET  /api/ai/skills          → resolved skills list
 * PUT  /api/ai/skills/:id      → enable/disable a skill or change its options
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { assistantSkillsService } from "../services/assistant-skills.service.js";

const skillPatchSchema = z.object({
  enabled: z.boolean().optional(),
  options: z.record(z.string()).optional(),
});

export const assistantSkillsController = {
  /** GET /api/ai/skills */
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    res.json({ ok: true, skills: await assistantSkillsService.list(executor) });
  }),

  /** PUT /api/ai/skills/:id */
  setSkill: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = skillPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const skills = await assistantSkillsService.setSkill(
      id,
      parsed.data,
      getExecutor(req),
    );
    res.json({ ok: true, skills });
  }),
};
