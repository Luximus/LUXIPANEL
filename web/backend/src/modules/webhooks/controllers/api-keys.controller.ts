// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * API keys controller — generate, list, revoke API keys.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { apiKeyService } from "../services/api-key.service.js";
import { NotFoundError } from "../../../shared/errors/index.js";

const createSchema = z.object({
  name: z.string().min(2).max(128).trim(),
  scopes: z.array(z.string()).nullable().optional(),
  expiresAt: z.string().datetime().optional().transform((v) => v ? new Date(v) : undefined),
});

export const apiKeysController = {
  /** GET /api/api-keys — list all API keys (prefix shown, hash hidden). */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const keys = await apiKeyService.list();
    const data = keys.map(({ keyHash: _h, ...k }) => k);
    res.json({ ok: true, data });
  }),

  /** POST /api/api-keys — generate a new key (shown only once). */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createSchema.parse(req.body);
    const { key, record } = await apiKeyService.generate(body);
    const { keyHash: _h, ...safe } = record;
    res.status(201).json({ ok: true, data: { ...safe, key } });
  }),

  /** DELETE /api/api-keys/:id — revoke an API key. */
  revoke: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const ok = await apiKeyService.revoke(id);
    if (!ok) throw new NotFoundError("API key");
    res.json({ ok: true });
  }),
};
