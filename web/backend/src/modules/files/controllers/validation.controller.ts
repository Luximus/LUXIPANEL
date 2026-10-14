// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Validation controller — check editor content before saving (#7).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { validationService } from "../services/index.js";
import { localizeFileValidation } from "./validation-i18n.js";

const schema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const validationController = {
  /** POST /api/files/validate — { valid, validator, errors[], skipped? }. */
  validate: asyncHandler(async (req: Request, res: Response) => {
    const body = schema.parse(req.body);
    const executor = getExecutor(req);
    const data = await validationService.validate(executor, body.path, body.content);
    res.json({ ok: true, data: localizeFileValidation(res.locals.locale, data) });
  }),
};
