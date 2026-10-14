// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Content-search controller — recursive grep inside files (#9).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { contentSearchService } from "../services/index.js";

const grepSchema = z.object({
  path: z.string().min(1),
  q: z.string().optional(),
  mode: z
    .enum(["text", "regex", "email", "url", "apikey", "import", "function", "endpoint", "variable"])
    .default("text"),
  caseSensitive: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  maxResults: z.coerce.number().int().positive().max(5000).optional(),
});

export const contentSearchController = {
  /** GET /api/files/grep?path=&q=&mode=&caseSensitive=&maxResults= */
  grep: asyncHandler(async (req: Request, res: Response) => {
    const params = grepSchema.parse({
      path: req.query["path"],
      q: req.query["q"],
      mode: req.query["mode"] ?? "text",
      caseSensitive: req.query["caseSensitive"],
      maxResults: req.query["maxResults"],
    });
    const executor = getExecutor(req);
    const result = await contentSearchService.search(executor, {
      path: params.path,
      query: params.q,
      mode: params.mode,
      caseSensitive: params.caseSensitive,
      maxResults: params.maxResults,
    });
    res.json({ ok: true, data: result });
  }),
};
