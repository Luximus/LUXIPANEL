// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Google Cloud Translation (v2 REST) engine. The API key is sent in the
 * `X-Goog-Api-Key` header (NOT the query string), so it never lands in access
 * logs, proxies or a `Referer`. Broad language coverage, fast and cheap.
 */

import type { TranslationConfig } from "../../models/assistant-config.types.js";
import type { TranslationProvider } from "./translation.types.js";
import { TranslationError, TRANSLATE_TIMEOUT_MS } from "./translation.types.js";

const DEFAULT_BASE = "https://translation.googleapis.com";
// REST translation sits on the critical path of a turn (awaited before the
// message is persisted + the run starts), so a hung endpoint must not freeze
// the turn. Bound every request.

export function makeGoogleTranslator(cfg: NonNullable<TranslationConfig["google"]>): TranslationProvider {
  const baseUrl = (cfg.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
  const keyHeaders = (): Record<string, string> => ({ "X-Goog-Api-Key": cfg.apiKey });
  return {
    id: "google",
    async ping() {
      if (!cfg.apiKey) return { ok: false, detail: "Google Translate sin API key." };
      try {
        const res = await fetch(`${baseUrl}/language/translate/v2/languages`, {
          headers: keyHeaders(),
          signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
        });
        return res.ok ? { ok: true, detail: "google · ok" } : { ok: false, detail: `Google ${res.status}` };
      } catch (err) {
        return { ok: false, detail: (err as Error).message };
      }
    },
    async translate(text, from, to) {
      if (!cfg.apiKey) throw new TranslationError("google", "Google Translate sin API key.");
      if (!text.trim()) return text;
      const payload: Record<string, string> = { q: text, target: to, format: "text" };
      if (from !== "auto") payload.source = from;
      const res = await fetch(`${baseUrl}/language/translate/v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...keyHeaders() },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
      });
      if (!res.ok) throw new TranslationError("google", `Google ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
      const data = (await res.json()) as { data?: { translations?: Array<{ translatedText: string }> } };
      return data.data?.translations?.[0]?.translatedText ?? text;
    },
    async detectLanguage(text) {
      if (!cfg.apiKey) throw new TranslationError("google", "Google Translate sin API key.");
      const res = await fetch(`${baseUrl}/language/translate/v2/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...keyHeaders() },
        body: JSON.stringify({ q: text.slice(0, 800) }),
        signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
      });
      if (!res.ok) throw new TranslationError("google", `Google detect ${res.status}`, res.status);
      const data = (await res.json()) as { data?: { detections?: Array<Array<{ language: string }>> } };
      return (data.data?.detections?.[0]?.[0]?.language ?? "en").toLowerCase().slice(0, 2);
    },
  };
}
