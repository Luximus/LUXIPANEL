// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";
import type { AssistantProviderId } from "./providers";
import type { ConversationMeta } from "./conversations";

// ── Background translation ────────────────────────────────────────────────

export type TranslationEngineId = "ai" | "deepl" | "google" | "libretranslate";

export interface RedactedTranslationConfig {
  enabled: boolean;
  engine: TranslationEngineId;
  targetLanguage: string;
  ai: { providerId: AssistantProviderId; model: string };
  /** When true, translation follows the active/main provider (default). */
  aiFollowActive: boolean;
  deepl: { hasApiKey: boolean; apiKeyHint: string; baseUrl?: string };
  google: { hasApiKey: boolean; apiKeyHint: string; baseUrl?: string };
  libretranslate: { baseUrl: string; hasApiKey: boolean; apiKeyHint: string };
}

/** One candidate engine the backend probed while saving. */
export interface TranslationTrial {
  engine: TranslationEngineId;
  providerId?: AssistantProviderId;
  model?: string;
  ok: boolean;
  detail: string;
}

/**
 * Outcome of the backend's verify-on-save: it proves the chosen engine works,
 * falls back to a working one if not, or disables translation if all fail.
 */
export interface TranslationVerification {
  ok: boolean;
  fellBack: boolean;
  disabled: boolean;
  trials: TranslationTrial[];
}

export interface TranslationConfigPatch {
  enabled?: boolean;
  engine?: TranslationEngineId;
  targetLanguage?: string;
  ai?: { providerId?: AssistantProviderId; model?: string };
  aiFollowActive?: boolean;
  deepl?: { apiKey?: string; baseUrl?: string };
  google?: { apiKey?: string; baseUrl?: string };
  libretranslate?: { baseUrl?: string; apiKey?: string };
}

/** Languages offered in the target-language picker (ISO 639-1 → label). */
export const TRANSLATION_LANGUAGES: { code: string; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

export const assistantTranslationApi = {
  async getConfig(): Promise<RedactedTranslationConfig> {
    const res = await api.get<{ ok: boolean; translation: RedactedTranslationConfig }>("/api/ai/translation/config");
    return unwrap(res, "Failed to load translation config").translation;
  },
  async setConfig(
    patch: TranslationConfigPatch,
  ): Promise<{ translation: RedactedTranslationConfig; verification?: TranslationVerification }> {
    const res = await api.put<{ ok: boolean; translation: RedactedTranslationConfig; verification?: TranslationVerification }>(
      "/api/ai/translation/config",
      patch,
    );
    const data = unwrap(res, "Failed to update translation config");
    return { translation: data.translation, verification: data.verification };
  },
  async test(p: { engine?: TranslationEngineId; sampleText?: string; targetLanguage?: string } = {}): Promise<{ ok: boolean; detail?: string; sample?: string }> {
    const res = await api.post<{ ok: boolean; detail?: string; sample?: string }>("/api/ai/translation/test", p);
    // NOTE: deliberately checks only `!res.data` (not `!res.ok`): the api-client
    // folds the body's `ok` into `res.ok`, so a probe FAILURE ({ok:false,detail})
    // would otherwise throw instead of being returned for the UI to surface.
    if (!res.data) throw new Error(res.error ?? "Probe failed");
    return res.data;
  },
  async detect(text: string): Promise<string> {
    const res = await api.post<{ ok: boolean; lang: string }>("/api/ai/translation/detect", { text });
    return unwrap(res, "Detect failed").lang;
  },
  /** Per-conversation override. `translate: null` clears it (→ global default). */
  async setConversation(id: string, patch: { translate?: boolean | null; lang?: string }): Promise<ConversationMeta> {
    const res = await api.patch<{ ok: boolean; conversation: ConversationMeta }>(
      `/api/ai/conversations/${id}/translate`,
      patch,
    );
    return unwrap(res, "Failed to update conversation translation").conversation;
  },
};
