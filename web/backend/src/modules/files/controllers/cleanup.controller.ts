// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cleanup controller — smart cleanup scan (#11). Read-only; deletion reuses
 * the normal DELETE /api/files endpoint (which snapshots first).
 */

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { cleanupService } from "../services/index.js";


export const cleanupController = {
  /** GET /api/files/cleanup/scan?path= */
  scan: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const data = await cleanupService.scan(getExecutor(req), path);
    res.json({ ok: true, data });
  }),
};
