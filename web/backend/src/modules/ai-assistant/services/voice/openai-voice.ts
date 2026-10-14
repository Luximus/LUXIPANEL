// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAI voice engine — reuses the `codex` provider slot's API key/baseUrl.
 *   - STT: POST /v1/audio/transcriptions  (multipart, gpt-4o-mini-transcribe)
 *   - TTS: POST /v1/audio/speech          (JSON → mp3 bytes, gpt-4o-mini-tts)
 *
 * Uses raw fetch + Node 22 global FormData/Blob (no SDK), matching the chat
 * providers. The API key never leaves this module.
 */

import type { AssistantConfig } from "../../models/assistant-config.types.js";
import { STT_MODEL, TTS_MODEL, TTS_DEFAULT_VOICE } from "../providers/audio.js";
import type { VoiceProvider } from "./voice.types.js";
import { VoiceError } from "./voice.types.js";

const DEFAULT_BASE_URL = "https://api.openai.com";

interface ResolvedOpenAi {
  apiKey: string;
  baseUrl: string;
}

function resolve(config: AssistantConfig): ResolvedOpenAi {
  const slot = config.providers.codex;
  return {
    apiKey: slot?.api?.apiKey ?? "",
    baseUrl: (slot?.api?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

/** Map a recorded MIME type to a filename extension OpenAI accepts. */
function extFor(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "mp4";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export function makeOpenAiVoice(config: AssistantConfig): VoiceProvider {
  const cfg = resolve(config);
  return {
    id: "openai",
    async ping() {
      if (!cfg.apiKey) return { ok: false, detail: "OpenAI (slot codex) sin API key." };
      return { ok: true, detail: "openai · voz" };
    },

    async transcribe(audioBase64, mimeType, signal) {
      if (!cfg.apiKey) throw new VoiceError("openai", "OpenAI (slot codex) sin API key.");
      const bytes = Buffer.from(audioBase64, "base64");
      const form = new FormData();
      form.append("model", STT_MODEL.openai);
      form.append("response_format", "json");
      form.append(
        "file",
        new Blob([bytes], { type: mimeType || "audio/webm" }),
        `audio.${extFor(mimeType)}`,
      );
      const res = await fetch(`${cfg.baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        body: form,
        signal,
      });
      if (!res.ok) {
        throw new VoiceError("openai", `OpenAI STT ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
      }
      const data = (await res.json()) as { text?: string };
      return { text: (data.text ?? "").trim() };
    },

    async speak(text, voice, signal) {
      if (!cfg.apiKey) throw new VoiceError("openai", "OpenAI (slot codex) sin API key.");
      const res = await fetch(`${cfg.baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: voice || TTS_DEFAULT_VOICE,
          input: text,
          response_format: "mp3",
        }),
        signal,
      });
      if (!res.ok) {
        throw new VoiceError("openai", `OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { audioBase64: buf.toString("base64"), mimeType: "audio/mpeg" };
    },
  };
}
