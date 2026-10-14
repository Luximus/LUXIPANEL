// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Voice orchestration — sits between the voice controller and the STT/TTS
 * engines (mirror of `translation.service.ts`).
 *
 * Responsibilities:
 *   - resolve the configured engine from per-target config (reusing provider keys)
 *   - enforce size guards (audio in / text in) so a single request can't blow up
 *   - surface typed `VoiceError`s the controller maps to clean HTTP responses
 *
 * Audio is exchanged as base64 + MIME. The chat pipeline is untouched: STT
 * returns text the client drops into the composer, TTS returns audio the client
 * plays on demand. TTS may run via cloud API, local Piper, or MiniMax CLI.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { AssistantConfig } from "../models/assistant-config.types.js";
import { voiceCapabilities } from "../models/assistant-config.types.js";
import { buildSttProvider, buildTtsProvider } from "./voice/voice-factory.js";
import { isPiperInstalled } from "./voice/piper-voice.js";
import { VoiceError } from "./voice/voice.types.js";
import type { SttResult, TtsResult } from "./voice/voice.types.js";

const log = createModuleLogger("voice-service");

/** Max base64 audio payload accepted for transcription (~20 MB raw). */
const MAX_AUDIO_BASE64 = 28_000_000;
/** Max characters synthesized in one TTS call. */
const MAX_TTS_CHARS = 4_000;

export const voiceService = {
  capabilities(config: AssistantConfig) {
    return voiceCapabilities(config);
  },

  /** Whether the local Piper engine (the "cli" audio provider) is usable on the
   *  panel host — binary present + at least one voice model installed. */
  async piperStatus(): Promise<{ installed: boolean }> {
    return { installed: await isPiperInstalled() };
  },

  async transcribe(
    config: AssistantConfig,
    audioBase64: string,
    mimeType: string,
    signal?: AbortSignal,
  ): Promise<SttResult> {
    if (!audioBase64) throw new VoiceError("openai", "Audio vacío.");
    if (audioBase64.length > MAX_AUDIO_BASE64) {
      throw new VoiceError("openai", "El audio supera el tamaño máximo permitido.");
    }
    const provider = buildSttProvider(config);
    if (!provider.transcribe) {
      throw new VoiceError(provider.id, `El motor ${provider.id} no soporta transcripción.`);
    }
    const out = await provider.transcribe(audioBase64, mimeType, signal);
    log.info({ engine: provider.id, chars: out.text.length }, "voice transcribe ok");
    return out;
  },

  async speak(
    config: AssistantConfig,
    text: string,
    voice?: string,
    executor?: Executor | null,
    signal?: AbortSignal,
  ): Promise<TtsResult> {
    const clean = text.trim();
    if (!clean) throw new VoiceError("openai", "Texto vacío.");
    const provider = buildTtsProvider(config, executor);
    if (!provider.speak) {
      throw new VoiceError(provider.id, `El motor ${provider.id} no soporta síntesis de voz.`);
    }
    const out = await provider.speak(clean.slice(0, MAX_TTS_CHARS), voice ?? config.voice?.voice, signal);
    log.info({ engine: provider.id, bytes: out.audioBase64.length }, "voice speak ok");
    return out;
  },
};

export { VoiceError };
