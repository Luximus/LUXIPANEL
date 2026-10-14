// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mass replace controller — preview and apply find/replace across a tree (#10).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { replaceService } from "../services/index.js";

const replaceSchema = z.object({
  path: z.string().min(1),
  search: z.string().min(1),
  replacement: z.string(),
  mode: z.enum(["text", "regex"]).default("text"),
  caseSensitive: z.boolean().optional(),
  maxFiles: z.number().int().positive().max(500).optional(),
});

export const replaceController = {
  /** POST /api/files/replace/preview — per-line before/after, no writes. */
  preview: asyncHandler(async (req: Request, res: Response) => {
    const body = replaceSchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await replaceService.preview(executor, body);
    res.json({ ok: true, data });
  }),

  /** POST /api/files/replace/apply — write the replacement (snapshots each file first). */
  apply: asyncHandler(async (req: Request, res: Response) => {
    const body = replaceSchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await replaceService.apply(executor, body);
    res.json({ ok: true, data });
  }),
};
