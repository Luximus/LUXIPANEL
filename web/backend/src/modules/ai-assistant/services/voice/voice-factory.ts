// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Factory: AssistantConfig → constructed VoiceProvider for STT or TTS, honoring
 * the configured engine ("auto" resolves via `voiceCapabilities`). Mirrors
 * `translation/translation-factory.ts`.
 */

import { voiceCapabilities, type AssistantConfig } from "../../models/assistant-config.types.js";
import { makeOpenAiVoice } from "./openai-voice.js";
import type { VoiceProvider } from "./voice.types.js";
import { VoiceError } from "./voice.types.js";

/** Build the provider that will perform STT, or throw if none is available. */
export function buildSttProvider(config: AssistantConfig): VoiceProvider {
  const { stt } = voiceCapabilities(config);
  if (!stt) throw new VoiceError("openai", "Configura una clave API de OpenAI en Ajustes → Agentes IA → OpenAI para transcribir audio.");
  return makeOpenAiVoice(config);
}

/** Build the provider that will perform TTS, or throw if none is available. */
export function buildTtsProvider(config: AssistantConfig): VoiceProvider {
  const { tts } = voiceCapabilities(config);
  if (!tts) {
    throw new VoiceError(
      "openai",
      "Configura una clave API de OpenAI en Ajustes → Agentes IA → OpenAI para generar audio.",
    );
  }
  return makeOpenAiVoice(config);
}
