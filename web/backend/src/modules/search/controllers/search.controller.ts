// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { ValidationError, AppError, ErrorCodes } from "../../../shared/errors/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { assistantConfigRepository } from "../../ai-assistant/repositories/assistant-config.repository.js";
import { searchIntentRequestSchema } from "../models/search-intent.types.js";
import { searchIntentService, NoAiProviderError } from "../services/search-intent.service.js";

export const searchController = {
  /**
   * POST /api/search/intent — fallback IA del super buscador. Fail-open: 503
   * limpio cuando no hay proveedor API configurado (el cliente silencia y no
   * vuelve a preguntar en la sesión).
   */
  intent: asyncHandler(async (req: Request, res: Response) => {
    const parsed = searchIntentRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const executor = getExecutor(req);
    const config = await assistantConfigRepository.load(executor);
    try {
      const result = await searchIntentService.resolve(config, parsed.data);
      res.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof NoAiProviderError) {
        throw new AppError("No hay un proveedor de IA con API key configurado.", 503, ErrorCodes.SERVICE_UNAVAILABLE);
      }
      throw err;
    }
  }),
};
