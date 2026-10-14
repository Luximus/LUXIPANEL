// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Project-info controller — detect a directory's stack and logical map (#4).
 */

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { projectTypeService } from "../services/index.js";


export const projectInfoController = {
  /** GET /api/files/project-info?path= — detected type + logical sections. */
  detect: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    const data = await projectTypeService.detect(executor, path);
    res.json({ ok: true, data });
  }),
};
