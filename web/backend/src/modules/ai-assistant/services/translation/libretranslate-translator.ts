// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * LibreTranslate (self-hosted, open-source) engine. Zero per-request cost and
 * full privacy; quality below AI/DeepL. Requires a reachable `baseUrl`.
 */

import type { TranslationConfig } from "../../models/assistant-config.types.js";
import type { TranslationProvider } from "./translation.types.js";
import { TranslationError, TRANSLATE_TIMEOUT_MS } from "./translation.types.js";

// REST translation is awaited on the critical path of a turn — bound every
// request so a hung endpoint can't freeze the turn.

export function makeLibreTranslateTranslator(
  cfg: NonNullable<TranslationConfig["libretranslate"]>,
): TranslationProvider {
  const baseUrl = (cfg.baseUrl ?? "").replace(/\/+$/, "");
  return {
    id: "libretranslate",
    async ping() {
      if (!baseUrl) return { ok: false, detail: "LibreTranslate sin URL." };
      try {
        const res = await fetch(`${baseUrl}/languages`, {
          signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
        });
        return res.ok ? { ok: true, detail: "libretranslate · ok" } : { ok: false, detail: `LibreTranslate ${res.status}` };
      } catch (err) {
        return { ok: false, detail: (err as Error).message };
      }
    },
    async translate(text, from, to) {
      if (!baseUrl) throw new TranslationError("libretranslate", "LibreTranslate sin URL.");
      if (!text.trim()) return text;
      const res = await fetch(`${baseUrl}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source: from === "auto" ? "auto" : from,
          target: to,
          format: "text",
          ...(cfg.apiKey ? { api_key: cfg.apiKey } : {}),
        }),
        signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
      });
      if (!res.ok) throw new TranslationError("libretranslate", `LibreTranslate ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
      const data = (await res.json()) as { translatedText?: string };
      return data.translatedText ?? text;
    },
    async detectLanguage(text) {
      if (!baseUrl) throw new TranslationError("libretranslate", "LibreTranslate sin URL.");
      const res = await fetch(`${baseUrl}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text.slice(0, 800), ...(cfg.apiKey ? { api_key: cfg.apiKey } : {}) }),
        signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
      });
      if (!res.ok) throw new TranslationError("libretranslate", `LibreTranslate detect ${res.status}`, res.status);
      const data = (await res.json()) as Array<{ language: string; confidence: number }>;
      return (data?.[0]?.language ?? "en").toLowerCase().slice(0, 2);
    },
  };
}
