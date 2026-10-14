// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Factory: AssistantConfig → constructed VoiceProvider for STT or TTS, honoring
 * the configured engine ("auto" resolves via `voiceCapabilities`). Mirrors
 * `translation/translation-factory.ts`.
 */

import {
  voiceCapabilities,
  type AssistantConfig,
  type TtsEngineId,
} from "../../models/assistant-config.types.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { makeOpenAiVoice } from "./openai-voice.js";
import { makeGeminiVoice } from "./gemini-voice.js";
import { makePiperVoice } from "./piper-voice.js";
import { makeMiniMaxCliVoice } from "./minimax-cli-voice.js";
import type { VoiceProvider } from "./voice.types.js";
import { VoiceError } from "./voice.types.js";

function makeEngine(config: AssistantConfig, engine: TtsEngineId, executor?: Executor | null): VoiceProvider {
  if (engine === "piper") return makePiperVoice(config);
  if (engine === "minimax") return makeMiniMaxCliVoice(config, executor);
  return engine === "openai" ? makeOpenAiVoice(config) : makeGeminiVoice(config);
}

/** Build the provider that will perform STT, or throw if none is available. */
export function buildSttProvider(config: AssistantConfig): VoiceProvider {
  const { stt } = voiceCapabilities(config);
  if (!stt) throw new VoiceError("openai", "No hay motor de transcripción disponible (configura una API key de OpenAI o Gemini).");
  return makeEngine(config, stt);
}

/** Build the provider that will perform TTS, or throw if none is available. */
export function buildTtsProvider(config: AssistantConfig, executor?: Executor | null): VoiceProvider {
  const { tts } = voiceCapabilities(config);
  if (!tts) {
    throw new VoiceError(
      "openai",
      "No hay motor de voz disponible (configura OpenAI, activa Piper local o prepara MiniMax CLI).",
    );
  }
  return makeEngine(config, tts, executor);
}
