// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Gemini voice engine — reuses the `gemini` provider slot's API key/baseUrl.
 *   - STT: POST /v1beta/models/<model>:generateContent with inline audio + a
 *     "transcribe verbatim" instruction. Returns the transcript text.
 *   - TTS: NOT implemented in v1 (Gemini returns raw PCM that needs WAV framing;
 *     OpenAI is the TTS engine). `speak` is intentionally absent.
 */

import type { AssistantConfig } from "../../models/assistant-config.types.js";
import { STT_MODEL } from "../providers/audio.js";
import type { VoiceProvider } from "./voice.types.js";
import { VoiceError } from "./voice.types.js";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";

interface ResolvedGemini {
  apiKey: string;
  baseUrl: string;
}

function resolve(config: AssistantConfig): ResolvedGemini {
  const slot = config.providers.gemini;
  return {
    apiKey: slot?.api?.apiKey ?? "",
    baseUrl: (slot?.api?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

export function makeGeminiVoice(config: AssistantConfig): VoiceProvider {
  const cfg = resolve(config);
  return {
    id: "gemini",
    async ping() {
      if (!cfg.apiKey) return { ok: false, detail: "Gemini sin API key." };
      return { ok: true, detail: "gemini · voz (STT)" };
    },

    async transcribe(audioBase64, mimeType, signal) {
      if (!cfg.apiKey) throw new VoiceError("gemini", "Gemini sin API key.");
      const model = STT_MODEL.gemini;
      const endpoint = `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${cfg.apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: "Transcribe this audio verbatim. Output ONLY the transcription, with no commentary." },
                { inline_data: { mime_type: mimeType || "audio/webm", data: audioBase64 } },
              ],
            },
          ],
        }),
        signal,
      });
      if (!res.ok) {
        throw new VoiceError("gemini", `Gemini STT ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      return { text };
    },
  };
}
