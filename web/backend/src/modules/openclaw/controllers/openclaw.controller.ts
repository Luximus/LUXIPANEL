// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenClaw controller — REST endpoints for the /panel/openclaw view.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { openclawService } from "../services/index.js";
import { localizeOpenClawTestMessage } from "../../../shared/i18n/module-messages.js";

const saveConfigSchema = z.object({
  apiKey: z.string().max(512).optional(),
  endpoint: z
    .string()
    .trim()
    .url("La URL debe ser absoluta (https://…)")
    .max(255)
    .refine((v) => /^https?:$/i.test(new URL(v).protocol), "La URL debe usar http(s)")
    .optional()
    .or(z.literal("")),
  defaultModel: z.string().trim().max(120).optional(),
});

export const openclawController = {
  /** GET /api/openclaw/config */
  getConfig: asyncHandler(async (_req: Request, res: Response) => {
    const config = await openclawService.getConfig();
    res.json({ ok: true, data: config });
  }),

  /** PUT /api/openclaw/config */
  saveConfig: asyncHandler(async (req: Request, res: Response) => {
    const body = saveConfigSchema.parse(req.body);
    await openclawService.saveConfig({
      apiKey: body.apiKey,
      endpoint: body.endpoint === "" ? undefined : body.endpoint,
      defaultModel: body.defaultModel,
    });
    const config = await openclawService.getConfig();
    res.json({ ok: true, data: config });
  }),

  /** DELETE /api/openclaw/api-key */
  clearApiKey: asyncHandler(async (_req: Request, res: Response) => {
    await openclawService.clearApiKey();
    res.json({ ok: true });
  }),

  /** POST /api/openclaw/test */
  testConnection: asyncHandler(async (_req: Request, res: Response) => {
    const result = await openclawService.testConnection();
    res.json({ ok: result.ok, data: { ...result, message: localizeOpenClawTestMessage(res.locals.locale, result.message) } });
  }),
};
