// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * File-history controller — per-file timeline (git + snapshots) (#8).
 */

import { z } from "zod";

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { fileHistoryService } from "../services/index.js";

const showSchema = z.object({ path: z.string().min(1), rev: z.string().min(4).max(64) });

export const fileHistoryController = {
  /** GET /api/files/history?path= — merged git + snapshot timeline. */
  history: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    const data = await fileHistoryService.history(executor, path);
    res.json({ ok: true, data });
  }),

  /** GET /api/files/history/git-show?path=&rev= — content at a git revision. */
  gitShow: asyncHandler(async (req: Request, res: Response) => {
    const { path, rev } = showSchema.parse({ path: req.query["path"], rev: req.query["rev"] });
    const executor = getExecutor(req);
    try {
      const content = await fileHistoryService.gitShow(executor, path, rev);
      res.json({ ok: true, data: { content } });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }),
};
