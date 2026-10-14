// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Voice engine contract — speech-to-text (STT) and text-to-speech (TTS).
 *
 * Every engine (OpenAI, Gemini) implements the parts it supports. Engines work
 * with RAW audio/text; size guards, base64 handling and capability gating live
 * in `voice.service.ts`. Audio is exchanged as base64 with an explicit MIME
 * type. Engines reuse an existing provider's API key (no separate key store).
 */

import type { TtsEngineId } from "../../models/assistant-config.types.js";
import { EngineError } from "../engine-error.js";

export interface SttResult {
  text: string;
}

export interface TtsResult {
  /** Synthesized audio, base64-encoded. */
  audioBase64: string;
  /** MIME type of the audio (e.g. "audio/mpeg"). */
  mimeType: string;
}

export interface VoiceProvider {
  id: TtsEngineId;
  /** Transcribe spoken audio to text. Absent → engine has no STT. */
  transcribe?(audioBase64: string, mimeType: string, signal?: AbortSignal): Promise<SttResult>;
  /** Synthesize text to speech. Absent → engine has no TTS. */
  speak?(text: string, voice: string | undefined, signal?: AbortSignal): Promise<TtsResult>;
  /** Cheap reachability/key check. */
  ping(): Promise<{ ok: boolean; detail?: string }>;
}

export class VoiceError extends EngineError<TtsEngineId> {
  constructor(engine: TtsEngineId, message: string, status?: number) {
    super(engine, message, status);
    this.name = "VoiceError";
  }
}
