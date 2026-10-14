// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Voice (audio) capability per configured provider — the backend's source of
 * truth for whether speech-to-text (STT) and text-to-speech (TTS) can run, and
 * with which engine. Mirrors the shape of `vision.ts`. The frontend mirrors the
 * gating in `frontend/src/components/floating-assistant/audio-support.ts`.
 *
 * Both engines REUSE an existing provider's API key (no separate key store):
 *   - OpenAI engine → `providers.codex` slot  (Whisper/gpt-4o-transcribe, tts-*)
 *   - Gemini engine → `providers.gemini` slot (generateContent w/ inline audio)
 *
 * The canonical availability function lives in `assistant-config.types.ts`
 * (`voiceCapabilities`) so redaction can use it without a runtime import cycle;
 * it's re-exported here as the "providers" mirror location.
 */

import type { VoiceEngineId } from "../../models/assistant-config.types.js";

export { voiceCapabilities } from "../../models/assistant-config.types.js";

/** Default STT model per engine. */
export const STT_MODEL: Record<VoiceEngineId, string> = {
  openai: "gpt-4o-mini-transcribe",
  gemini: "gemini-2.5-flash",
};

/** Default TTS model + voice (OpenAI only in v1). */
export const TTS_MODEL = "gpt-4o-mini-tts";
export const TTS_DEFAULT_VOICE = "alloy";

/** OpenAI built-in TTS voices, surfaced in the settings picker. */
export const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
] as const;
