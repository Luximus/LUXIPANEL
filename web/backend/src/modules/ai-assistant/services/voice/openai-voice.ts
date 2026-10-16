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
    apiKey: (slot?.api?.apiKey ?? "").trim(),
    // Accept either an origin or the conventional /v1 API base URL.
    baseUrl: (slot?.api?.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "").replace(/\/v1$/, ""),
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

async function openAiRequestError(response: Response, action = "el audio"): Promise<VoiceError> {
  const status = response.status;
  // Read only a known error code; upstream messages can contain credentials.
  const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null;
  const code = payload?.error?.code;
  if (status === 401 && code === "ip_not_authorized") {
    return new VoiceError("openai", "OpenAI no autorizó la IP de este servidor. Revisa la lista de IP permitidas de tu proyecto en OpenAI.", status);
  }
  if (status === 401 && code === "invalid_api_key") {
    return new VoiceError("openai", "OpenAI rechazó la clave API guardada. Sustitúyela en Ajustes → Agentes IA → OpenAI y pulsa Probar. La sesión de Codex CLI es independiente del audio.", status);
  }
  if (status === 401) {
    return new VoiceError("openai", "OpenAI no autenticó la clave API. Revisa la clave guardada en Ajustes → Agentes IA → OpenAI y su organización en OpenAI.", status);
  }
  if (status === 403) {
    return new VoiceError("openai", `OpenAI denegó el acceso de esta clave para ${action}. Revisa los permisos y restricciones del proyecto en OpenAI.`, status);
  }
  if (status === 429) {
    return new VoiceError("openai", "OpenAI limitó las solicitudes o agotó la cuota. Revisa el uso y la facturación de tu cuenta.", status);
  }
  return new VoiceError("openai", `OpenAI no pudo procesar ${action} (respuesta ${status}). Inténtalo de nuevo.`, status);
}

export function makeOpenAiVoice(config: AssistantConfig): VoiceProvider {
  const cfg = resolve(config);
  return {
    id: "openai",
    async ping() {
      if (!cfg.apiKey) return { ok: false, detail: "Configura una clave API de OpenAI en Ajustes → Agentes IA → OpenAI para usar audio. La sesión de Codex CLI es independiente." };
      try {
        // No generation or audio upload: authenticate the saved credential.
        const res = await fetch(`${cfg.baseUrl}/v1/models`, {
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
          signal: AbortSignal.timeout(15_000),
          redirect: "error",
        });
        if (!res.ok) return { ok: false, detail: (await openAiRequestError(res, "la consulta de modelos para verificar la clave")).message };
        const data = await res.json().catch(() => null) as { object?: string; data?: unknown[] } | null;
        if (data?.object !== "list" || !Array.isArray(data.data)) {
          return { ok: false, detail: "OpenAI no devolvió una respuesta válida. No se pudo verificar la clave API; revisa la URL del proveedor." };
        }
        return { ok: true, detail: "OpenAI autenticó la clave API guardada. El audio también requiere permisos y cuota disponibles en el proyecto." };
      } catch (err) {
        return { ok: false, detail: err instanceof Error && err.name === "TimeoutError"
          ? "OpenAI no respondió a tiempo. No se pudo verificar la clave API; vuelve a intentarlo."
          : "No se pudo conectar con OpenAI para verificar la clave API. Comprueba la conexión y la URL del proveedor." };
      }
    },

    async transcribe(audioBase64, mimeType, signal) {
      if (!cfg.apiKey) throw new VoiceError("openai", "Configura una clave API de OpenAI en Ajustes → Agentes IA → OpenAI para usar audio.");
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
        throw await openAiRequestError(res);
      }
      const data = (await res.json()) as { text?: string };
      return { text: (data.text ?? "").trim() };
    },

    async speak(text, voice, signal) {
      if (!cfg.apiKey) throw new VoiceError("openai", "Configura una clave API de OpenAI en Ajustes → Agentes IA → OpenAI para usar audio.");
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
        throw await openAiRequestError(res);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { audioBase64: buf.toString("base64"), mimeType: "audio/mpeg" };
    },
  };
}
