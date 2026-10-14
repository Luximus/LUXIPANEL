// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Factory: AssistantConfig → constructed TranslationProvider for the configured
 * engine. Mirrors `providers/provider-factory.ts`.
 */

import type {
  AssistantConfig,
  TranslationEngineId,
} from "../../models/assistant-config.types.js";
import { makeAiTranslator } from "./ai-translator.js";
import { makeDeeplTranslator } from "./deepl-translator.js";
import { makeGoogleTranslator } from "./google-translator.js";
import { makeLibreTranslateTranslator } from "./libretranslate-translator.js";
import type { TranslationProvider, TranslationUsageSink } from "./translation.types.js";
import { TranslationError } from "./translation.types.js";

export function buildTranslationProvider(
  config: AssistantConfig,
  engineOverride?: TranslationEngineId,
  onUsage?: TranslationUsageSink,
): TranslationProvider {
  const t = config.translation;
  const engine = engineOverride ?? t.engine;
  switch (engine) {
    case "ai":
      return makeAiTranslator(config, onUsage);
    case "deepl":
      return makeDeeplTranslator(t.deepl ?? { apiKey: "" });
    case "google":
      return makeGoogleTranslator(t.google ?? { apiKey: "" });
    case "libretranslate":
      return makeLibreTranslateTranslator(t.libretranslate ?? { baseUrl: "" });
    default: {
      const _exhaustive: never = engine;
      throw new TranslationError("ai", `Motor de traducción no soportado: ${String(_exhaustive)}`);
    }
  }
}
