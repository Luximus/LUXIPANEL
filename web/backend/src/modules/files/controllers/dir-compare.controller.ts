// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Folder-compare controller — diff two directory trees (#6).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { dirCompareService } from "../services/index.js";

const schema = z.object({ from: z.string().min(1), to: z.string().min(1) });

export const dirCompareController = {
  /** GET /api/files/compare?from=&to= — added/removed/modified + same count. */
  compare: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = schema.parse({ from: req.query["from"], to: req.query["to"] });
    const executor = getExecutor(req);
    const data = await dirCompareService.compare(executor, from, to);
    res.json({ ok: true, data });
  }),
};
