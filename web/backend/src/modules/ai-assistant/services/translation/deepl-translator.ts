// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * DeepL translation engine. Free keys end in ":fx" and use api-free.deepl.com;
 * Pro keys use api.deepl.com. A custom baseUrl overrides both.
 */

import type { TranslationConfig } from "../../models/assistant-config.types.js";
import type { TranslationProvider } from "./translation.types.js";
import { TranslationError, TRANSLATE_TIMEOUT_MS } from "./translation.types.js";

// REST translation is awaited on the critical path of a turn — bound every
// request so a hung DeepL endpoint can't freeze the turn.

function resolveBaseUrl(cfg: NonNullable<TranslationConfig["deepl"]>): string {
  if (cfg.baseUrl) return cfg.baseUrl.replace(/\/+$/, "");
  return cfg.apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

/** DeepL target codes need region for English; sources are plain uppercase. */
const TARGET_SPECIAL = { EN: "EN-US", PT: "PT-PT" } as const;
function targetCode(to: string): string {
  const up = to.toUpperCase();
  return TARGET_SPECIAL[up as keyof typeof TARGET_SPECIAL] ?? up;
}

export function makeDeeplTranslator(cfg: NonNullable<TranslationConfig["deepl"]>): TranslationProvider {
  const baseUrl = resolveBaseUrl(cfg);
  async function post(text: string, from: string | "auto", to: string): Promise<string> {
    if (!cfg.apiKey) throw new TranslationError("deepl", "DeepL sin API key.");
    const body = new URLSearchParams();
    body.append("text", text);
    body.append("target_lang", targetCode(to));
    if (from !== "auto") body.append("source_lang", from.toUpperCase());
    const res = await fetch(`${baseUrl}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${cfg.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
    });
    if (!res.ok) throw new TranslationError("deepl", `DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
    const data = (await res.json()) as { translations?: Array<{ text: string; detected_source_language?: string }> };
    return data.translations?.[0]?.text ?? text;
  }
  return {
    id: "deepl",
    async ping() {
      if (!cfg.apiKey) return { ok: false, detail: "DeepL sin API key." };
      try {
        const res = await fetch(`${baseUrl}/v2/usage`, {
          headers: { Authorization: `DeepL-Auth-Key ${cfg.apiKey}` },
          signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
        });
        return res.ok
          ? { ok: true, detail: "deepl · ok" }
          : { ok: false, detail: `DeepL ${res.status}` };
      } catch (err) {
        return { ok: false, detail: (err as Error).message };
      }
    },
    async translate(text, from, to) {
      if (!text.trim()) return text;
      return post(text, from, to);
    },
  };
}
