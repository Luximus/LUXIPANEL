// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Background translation engine contract.
 *
 * Every engine (cheap AI model, DeepL, Google, LibreTranslate) implements this.
 * Implementations translate RAW text — code-span protection, caching and
 * language detection orchestration live in `translation.service.ts`. Language
 * codes are ISO 639-1 lowercase ("es", "en", …); each engine maps them to its
 * own wire format internally. `from` may be the sentinel "auto".
 */

import type { AssistantProviderId, TranslationEngineId } from "../../models/assistant-config.types.js";
import { EngineError } from "../engine-error.js";

/**
 * Real token usage reported by an AI translation call, so background
 * translation shows up in the assistant's usage statistics just like a chat
 * turn does. Non-LLM engines (DeepL/Google/LibreTranslate) don't report this.
 */
export interface TranslationUsage {
  providerId: AssistantProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Sink the AI engine calls with the token usage of each real (non-cached) call. */
export type TranslationUsageSink = (usage: TranslationUsage) => void;

export interface TranslationProvider {
  id: TranslationEngineId;
  /** Translate `text` from `from` (or "auto") into `to`. Returns the translation. */
  translate(text: string, from: string | "auto", to: string): Promise<string>;
  /** Optional engine-side language detection (ISO 639-1). */
  detectLanguage?(text: string): Promise<string>;
  /** Cheap health-check — validates keys/reachability without real cost where possible. */
  ping(): Promise<{ ok: boolean; detail?: string }>;
}

export class TranslationError extends EngineError<TranslationEngineId> {
  constructor(engine: TranslationEngineId, message: string, status?: number) {
    super(engine, message, status);
    this.name = "TranslationError";
  }
}

/** Per-request timeout (ms) for outbound HTTP translation calls. Shared by the
 *  LibreTranslate, Google and DeepL providers (single source of truth). */
export const TRANSLATE_TIMEOUT_MS = 15_000;
