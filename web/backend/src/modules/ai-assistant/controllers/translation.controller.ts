// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — background translation endpoints.
 *
 * GET   /api/ai/translation/config            → redacted translation settings
 * PUT   /api/ai/translation/config            → set engine / keys / target lang
 * POST  /api/ai/translation/test              → validate the chosen engine
 * POST  /api/ai/translation/detect            → detect the language of a sample
 * PATCH /api/ai/conversations/:id/translate   → per-conversation override
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { translationService } from "../services/translation.service.js";
import {
  PROVIDER_IDS,
  TRANSLATION_ENGINE_IDS,
  redactTranslationConfig,
  type AssistantConfig,
} from "../models/assistant-config.types.js";

const translationPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    engine: z.enum(TRANSLATION_ENGINE_IDS).optional(),
    targetLanguage: z.string().max(8).optional(),
    ai: z
      .object({
        providerId: z.enum(PROVIDER_IDS).optional(),
        model: z.string().max(128).optional(),
      })
      .optional(),
    aiFollowActive: z.boolean().optional(),
    deepl: z
      .object({ apiKey: z.string().max(512).optional(), baseUrl: z.string().url().max(512).optional() })
      .optional(),
    google: z
      .object({ apiKey: z.string().max(512).optional(), baseUrl: z.string().url().max(512).optional() })
      .optional(),
    libretranslate: z
      .object({ baseUrl: z.string().max(512).optional(), apiKey: z.string().max(512).optional() })
      .optional(),
  })
  .strict();

const testSchema = z.object({
  engine: z.enum(TRANSLATION_ENGINE_IDS).optional(),
  sampleText: z.string().max(2000).optional(),
  targetLanguage: z.string().max(8).optional(),
});

const detectSchema = z.object({ text: z.string().min(1).max(4000) });

const convTranslateSchema = z.object({
  translate: z.boolean().nullable().optional(),
  lang: z.string().max(8).optional(),
});

export const translationController = {
  /** GET /api/ai/translation/config */
  getConfig: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    res.json({ ok: true, translation: redactTranslationConfig(cfg.translation) });
  }),

  /** PUT /api/ai/translation/config — deep-merged (partial keys never wipe others). */
  setConfig: asyncHandler(async (req: Request, res: Response) => {
    const parsed = translationPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const patch: Partial<AssistantConfig> = { translation: parsed.data as AssistantConfig["translation"] };
    let saved = await assistantConfigRepository.patch(patch, executor);

    let verification:
      | {
          ok: boolean;
          fellBack: boolean;
          disabled: boolean;
          trials: { engine: string; providerId?: string; model?: string; ok: boolean; detail: string }[];
        }
      | undefined;

    // When translation ends up ON, PROVE the chosen engine actually translates;
    // on failure fall back to a working engine; if none work, disable it. Skip
    // the probe when translation is off — disabling never needs verification.
    if (saved.translation.enabled) {
      const result = await translationService.verifyWithFallback(saved, saved.translation);
      verification = { ok: result.enabled, fellBack: result.fellBack, disabled: result.disabled, trials: result.trials };
      const t = saved.translation;
      const changed =
        result.translation.enabled !== t.enabled ||
        result.translation.engine !== t.engine ||
        result.translation.ai?.providerId !== t.ai?.providerId ||
        result.translation.ai?.model !== t.ai?.model ||
        result.translation.aiFollowActive !== t.aiFollowActive;
      if (changed) saved = await assistantConfigRepository.patch({ translation: result.translation }, executor);
    }

    res.json({ ok: true, translation: redactTranslationConfig(saved.translation), verification });
  }),

  /** POST /api/ai/translation/test — prove the engine with a real sample call. */
  test: asyncHandler(async (req: Request, res: Response) => {
    const parsed = testSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError("Invalid body", []);
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    const engine = parsed.data.engine;
    const target = parsed.data.targetLanguage || cfg.translation.targetLanguage || "es";
    // A real EN→target translation that must DIFFER from the sample — catches
    // quota/401/timeout that a plain ping (key/model presence) would miss.
    const cfgForEngine = engine ? { ...cfg, translation: { ...cfg.translation, engine } } : cfg;
    const probe = await translationService.probeConfig(cfgForEngine, target, parsed.data.sampleText);
    res.json({ ok: probe.ok, detail: probe.detail, sample: probe.sample, probedAt: new Date().toISOString() });
  }),

  /** POST /api/ai/translation/detect — language of a sample (ISO 639-1). */
  detect: asyncHandler(async (req: Request, res: Response) => {
    const parsed = detectSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", []);
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    const lang = await translationService.detectLanguage(cfg, parsed.data.text);
    res.json({ ok: true, lang });
  }),

  /** PATCH /api/ai/conversations/:id/translate — per-conversation override. */
  setConversation: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    if (!id) throw new ValidationError(apiModuleMessage(res.locals.locale, "conversationIdRequired"), []);
    const parsed = convTranslateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", []);
    const executor = getExecutor(req);
    const meta = await conversationsRepository.setTranslation(executor, id, {
      // `null` clears the override (→ follow global default); omitted = no change.
      ...(parsed.data.translate !== undefined ? { translate: parsed.data.translate } : {}),
      ...(parsed.data.lang !== undefined ? { lang: parsed.data.lang } : {}),
    });
    res.json({ ok: true, conversation: meta });
  }),
};
