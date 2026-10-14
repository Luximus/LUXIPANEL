// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — voice (audio in/out) endpoints. They never touch the chat
 * pipeline: STT returns text the client drops into the composer, TTS returns
 * audio the client plays on demand.
 *
 * GET  /api/ai/voice/capabilities  → which engine (if any) can do STT / TTS
 * POST /api/ai/voice/transcribe    → { audioBase64, mimeType } → { text }
 * POST /api/ai/voice/speak         → { text, voice?, conversationId? }
 *                                     → { audioId, mimeType, cached } (or
 *                                       { audioBase64, mimeType } with no target)
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { audioRepository } from "../repositories/audio.repository.js";
import { voiceService, VoiceError } from "../services/voice.service.js";

/** Chars synthesized per call — mirror of voice.service MAX_TTS_CHARS, so the
 *  dedup key hashes the SAME text that actually gets turned into audio. */
const TTS_HASH_CHARS = 4_000;

/** Stable content key for the cached clip: a given (conversation, engine, voice,
 *  text) always resolves to the same file, so replaying a reply never re-runs
 *  the TTS call. */
function audioKey(parts: { convId: string; engine: string; voice: string; text: string }): string {
  return createHash("sha256")
    .update(`v1\u001f${parts.convId}\u001f${parts.engine}\u001f${parts.voice}\u001f${parts.text.trim().slice(0, TTS_HASH_CHARS)}`)
    .digest("hex");
}

// Base64 audio cap mirrors voice.service MAX_AUDIO_BASE64 (~20 MB raw).
const transcribeSchema = z.object({
  audioBase64: z.string().min(1).max(28_000_000),
  mimeType: z.string().max(128).default("audio/webm"),
});

const speakSchema = z.object({
  text: z.string().min(1).max(8_000),
  voice: z.string().max(64).optional(),
  /** Conversation the reply belongs to — scopes the on-disk cache folder. */
  conversationId: z.string().max(128).optional(),
});

/** A VoiceError has no statusCode; map it so the global handler responds cleanly. */
function mapVoiceError(err: unknown): never {
  if (err instanceof VoiceError) {
    // Upstream provider failures (carry a status) → 502; config gaps → 409.
    const status = err.status ? 502 : 409;
    throw new AppError(err.message, status, "VOICE_ERROR", { engine: err.engine });
  }
  throw err as Error;
}

export const voiceController = {
  /** GET /api/ai/voice/capabilities */
  capabilities: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    const caps = voiceService.capabilities(cfg);
    const piperInstalled = (await voiceService.piperStatus()).installed;
    // If the local engine is selected but not installed, don't advertise TTS —
    // the UI hides the speaker and the settings show an install hint instead.
    const tts = caps.tts === "piper" && !piperInstalled ? null : caps.tts;
    res.json({
      ok: true,
      capabilities: {
        ...caps,
        tts,
        ttsProvider: cfg.voice?.ttsProvider ?? "api",
        piperInstalled,
      },
    });
  }),

  /** POST /api/ai/voice/transcribe */
  transcribe: asyncHandler(async (req: Request, res: Response) => {
    const parsed = transcribeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    try {
      const out = await voiceService.transcribe(cfg, parsed.data.audioBase64, parsed.data.mimeType);
      res.json({ ok: true, text: out.text });
    } catch (err) {
      mapVoiceError(err);
    }
  }),

  /** POST /api/ai/voice/speak */
  speak: asyncHandler(async (req: Request, res: Response) => {
    const parsed = speakSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    const { text, voice, conversationId } = parsed.data;
    const convId = conversationId?.trim() || "_loose";
    const engine = voiceService.capabilities(cfg).tts ?? "openai";
    const effVoice =
      voice ?? cfg.voice?.voice ?? (engine === "openai" ? "alloy" : "");
    const key = audioKey({ convId, engine, voice: effVoice, text });

    try {
      // Cache hit: a previously-synthesized clip for this exact reply+voice —
      // return its id without paying for / regenerating the TTS call.
      if (executor) {
        const hit = await audioRepository.findByKey(executor, key);
        if (hit?.id) {
          res.json({ ok: true, audioId: hit.id, mimeType: hit.mimeType, cached: true });
          return;
        }
      }
      const out = await voiceService.speak(cfg, text, voice, executor);
      // No connected target → can't persist; fall back to the inline payload.
      if (!executor) {
        res.json({ ok: true, audioBase64: out.audioBase64, mimeType: out.mimeType });
        return;
      }
      const rec = await audioRepository.store(executor, {
        convId,
        key,
        voice: effVoice,
        mimeType: out.mimeType,
        dataBase64: out.audioBase64,
      });
      res.json({ ok: true, audioId: rec.id, mimeType: rec.mimeType, cached: false });
    } catch (err) {
      mapVoiceError(err);
    }
  }),
};
