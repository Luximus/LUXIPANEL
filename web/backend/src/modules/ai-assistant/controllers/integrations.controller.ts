// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — third-party integration credentials (ElevenLabs).
 *
 * GET    /api/ai/integrations/elevenlabs        → { apiKeySet, apiKeyPreview, defaultVoiceId }
 * PUT    /api/ai/integrations/elevenlabs        → save key / default voice
 * DELETE /api/ai/integrations/elevenlabs        → remove the credential
 * POST   /api/ai/integrations/elevenlabs/test   → probe the key against the API
 *
 * Same gate as `PUT /api/ai/config`: mounted on the ai router's
 * `protectedRouter` (lpPanelCredentialAuth → requireAuth → requireModule
 * ("assistant")). The API key is NEVER returned and NEVER logged — the public
 * shape carries only presence plus a `••••abcd` preview.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { assistantIntegrationsService } from "../services/integrations.service.js";

// ── Schemas ────────────────────────────────────────────────────────────────

const elevenLabsPutSchema = z
  .object({
    // Trimmed first: a whitespace-only value is "not provided" (keep stored).
    apiKey: z.string().trim().min(8).max(512).optional(),
    defaultVoiceId: z.string().trim().max(64).optional(),
  })
  .strict();

const elevenLabsTestSchema = z
  .object({
    apiKey: z.string().trim().max(512).optional(),
  })
  .strict();

// ── Controllers ────────────────────────────────────────────────────────────

export const assistantIntegrationsController = {
  /** GET /api/ai/integrations/elevenlabs */
  getElevenLabs: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await assistantIntegrationsService.getElevenLabs(executor);
    res.json({ ok: true, data });
  }),

  /** PUT /api/ai/integrations/elevenlabs */
  setElevenLabs: asyncHandler(async (req: Request, res: Response) => {
    const parsed = elevenLabsPutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const data = await assistantIntegrationsService.setElevenLabs(parsed.data, executor);
    res.json({ ok: true, data });
  }),

  /** DELETE /api/ai/integrations/elevenlabs */
  clearElevenLabs: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await assistantIntegrationsService.clearElevenLabs(executor);
    res.json({ ok: true, data });
  }),

  /**
   * POST /api/ai/integrations/elevenlabs/test
   *
   * Always 200: a network/auth failure is reported as `valid:false` with a
   * human message, never as a 5xx (the card only shows a toast).
   */
  testElevenLabs: asyncHandler(async (req: Request, res: Response) => {
    const parsed = elevenLabsTestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const data = await assistantIntegrationsService.testElevenLabs(parsed.data.apiKey, executor);
    res.json({ ok: true, data });
  }),
};
