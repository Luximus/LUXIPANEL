// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — module access endpoints.
 *
 * GET  /api/ai/modules                       → resolved capability list
 * PUT  /api/ai/modules/:id                   → enable/disable a module
 * PUT  /api/ai/modules/:id/tools/:tool       → toggle a single tool
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/index.js";
import { assistantModuleAccessRepository } from "../repositories/assistant-module-access.repository.js";
import { assistantModulesService } from "../services/assistant-modules.service.js";

const moduleToggleSchema = z.object({
  enabled: z.boolean(),
});

const toolPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    requireConfirm: z.boolean().optional(),
  })
  .refine(
    (v) => v.enabled !== undefined || v.requireConfirm !== undefined,
    { message: "At least one of enabled / requireConfirm must be provided" },
  );

export const assistantModulesController = {
  /** GET /api/ai/modules */
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    // Pasar el usuario de sesión para que los módulos PREVIEW del marketplace
    // (module-dev) sean visibles para su dueño (sin user → ocultos fail-closed).
    const sessionUser = res.locals["user"] as SessionUser | undefined;
    const modules = await assistantModulesService.describe(executor, sessionUser);
    res.json({ ok: true, modules });
  }),

  /** PUT /api/ai/modules/:id */
  setModule: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    if (!agentCapabilityRegistry.get(id)) {
      throw new AppError(apiModuleMessage(res.locals.locale, "assistantModuleCapabilityMissing").replace("{id}", () => id), 404, ErrorCodes.NOT_FOUND);
    }
    const parsed = moduleToggleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const executor = getExecutor(req);
    await assistantModuleAccessRepository.setModule(
      id,
      { enabled: parsed.data.enabled },
      executor,
    );
    const modules = await assistantModulesService.describe(
      executor,
      res.locals["user"] as SessionUser | undefined,
    );
    res.json({ ok: true, modules });
  }),

  /** PUT /api/ai/modules/:id/tools/:tool */
  setTool: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const tool = String(req.params["tool"] ?? "");
    if (!agentCapabilityRegistry.get(id)) {
      throw new AppError(apiModuleMessage(res.locals.locale, "assistantModuleNotFound").replace("{id}", () => id), 404, ErrorCodes.NOT_FOUND);
    }
    const fullName = tool.includes(".") ? tool : `${id}.${tool}`;
    const found = agentCapabilityRegistry.findTool(fullName);
    if (!found || found.moduleId !== id) {
      throw new AppError(apiModuleMessage(res.locals.locale, "assistantToolNotFound")
        .replace("{tool}", () => fullName).replace("{id}", () => id), 404, ErrorCodes.NOT_FOUND);
    }
    const parsed = toolPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const executor = getExecutor(req);
    await assistantModuleAccessRepository.setTool(
      id,
      fullName,
      parsed.data,
      executor,
    );
    const modules = await assistantModulesService.describe(
      executor,
      res.locals["user"] as SessionUser | undefined,
    );
    res.json({ ok: true, modules });
  }),
};
