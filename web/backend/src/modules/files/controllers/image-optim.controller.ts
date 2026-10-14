// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Image optimization controller (#22).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { localizeImageOptimMessage } from "../../../shared/i18n/module-messages.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { imageOptimService } from "../services/index.js";

const scanSchema = z.object({ path: z.string().min(1), minBytes: z.coerce.number().int().positive().optional() });
const processSchema = z.object({
  path: z.string().min(1),
  op: z.enum(["webp", "compress", "resize", "responsive"]),
  quality: z.number().int().min(1).max(100).optional(),
  width: z.number().int().min(1).max(10_000).optional(),
  widths: z.array(z.number().int().min(1).max(10_000)).max(8).optional(),
});

export const imageOptimController = {
  /** GET /api/files/images/capabilities */
  capabilities: asyncHandler(async (req: Request, res: Response) => {
    const data = await imageOptimService.capabilities(getExecutor(req));
    res.json({ ok: true, data });
  }),

  /** GET /api/files/images/scan?path=&minBytes= */
  scan: asyncHandler(async (req: Request, res: Response) => {
    const { path, minBytes } = scanSchema.parse({ path: req.query["path"], minBytes: req.query["minBytes"] });
    const data = await imageOptimService.scanLarge(getExecutor(req), path, minBytes);
    res.json({ ok: true, data });
  }),

  /** POST /api/files/images/process */
  process: asyncHandler(async (req: Request, res: Response) => {
    const body = processSchema.parse(req.body);
    const executor = getExecutor(req);
    const caps = await imageOptimService.capabilities(executor);
    let result;
    switch (body.op) {
      case "webp": result = await imageOptimService.toWebp(executor, body.path, body.quality ?? 80, caps); break;
      case "compress": result = await imageOptimService.compress(executor, body.path, body.quality ?? 82, caps); break;
      case "resize": result = await imageOptimService.resize(executor, body.path, body.width ?? 1280, caps); break;
      case "responsive": result = await imageOptimService.responsive(executor, body.path, body.widths ?? [480, 768, 1280], caps); break;
    }
    const message = result.message ? localizeImageOptimMessage(res.locals.locale, result.message) : undefined;
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: { ...result, message }, error: result.ok ? undefined : message });
  }),
};
