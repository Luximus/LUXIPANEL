// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap, assertApiOk } from "@/lib/api-client";
import { audioUrl } from "./conversations";

export type VoiceEngineId = "openai" | "gemini";
/** TTS can also use the local Piper engine (offline, "cli" provider). */
export type TtsEngineId = VoiceEngineId | "piper" | "minimax";

/** Audio output backend: cloud API, local Piper, or MiniMax CLI on target. */
export type TtsProvider = "api" | "cli" | "minimax-cli";

/** Redacted voice (audio in/out) settings + derived availability. */
export interface VoiceConfigState {
  realtimeEnabled?: boolean;
  enabled: boolean;
  sttEngine: VoiceEngineId | "auto";
  ttsEngine: VoiceEngineId | "auto";
  /** Audio output backend: "api" (OpenAI), "cli" (Piper), or MiniMax CLI. */
  ttsProvider: TtsProvider;
  autoSpeak: boolean;
  voice: string;
  /** Which engine (if any) can actually run, per configured provider keys.
   *  `piperInstalled` reports whether the local engine is usable on the host. */
  capabilities: {
    stt: VoiceEngineId | null;
    tts: TtsEngineId | null;
    ttsProvider?: TtsProvider;
    piperInstalled?: boolean;
  };
}

export interface VoiceConfigPatch {
  realtimeEnabled?: boolean;
  enabled?: boolean;
  sttEngine?: "openai" | "auto";
  ttsEngine?: "openai" | "auto";
  ttsProvider?: "api";
  autoSpeak?: boolean;
  voice?: string;
}

// ── Voice (audio in/out) ─────────────────────────────────────────────────────

export interface VoiceCapabilities {
  stt: VoiceEngineId | null;
  tts: TtsEngineId | null;
  /** Selected audio backend echoed back by the server. */
  ttsProvider?: TtsProvider;
  /** Whether the local Piper engine is usable on the panel host. */
  piperInstalled?: boolean;
}

/** Base64-encode a Blob (browser) without the data-URL prefix. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Decode a base64 string (no data-URL prefix) to raw bytes. */
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const voiceApi = {
  /** Which engine (if any) can do STT / TTS for the connected target. */
  async capabilities(): Promise<VoiceCapabilities> {
    const res = await api.get<{ ok: boolean; capabilities: VoiceCapabilities }>("/api/ai/voice/capabilities");
    return unwrap(res, "Failed to load voice capabilities").capabilities;
  },

  /** Transcribe a recorded audio Blob to text (server-side STT). */
  async transcribe(blob: Blob, signal?: AbortSignal): Promise<string> {
    const audioBase64 = await blobToBase64(blob);
    const res = await api.post<{ ok: boolean; text: string }>("/api/ai/voice/transcribe", {
      audioBase64,
      mimeType: blob.type || "audio/webm",
    }, { signal });
    return unwrap(res, "Transcription failed").text;
  },

  /**
   * Synthesize text to speech and return a playable URL.
   *
   * The normal path returns a SERVED url (`/api/ai/audio/:id`): the clip is
   * persisted on the target (keyed by conversation + voice + text), so replaying
   * the same reply streams it from disk and never regenerates the audio. When no
   * target is connected the server returns inline base64 and we fall back to an
   * object URL (caller revokes `blob:` urls; served urls need no cleanup).
   */
  async speak(text: string, opts?: { voice?: string; conversationId?: string }): Promise<string> {
    const res = await api.post<{ ok: boolean; audioId?: string; audioBase64?: string; mimeType: string }>(
      "/api/ai/voice/speak",
      {
        text,
        ...(opts?.voice ? { voice: opts.voice } : {}),
        ...(opts?.conversationId ? { conversationId: opts.conversationId } : {}),
      },
    );
    assertApiOk(res, "Speech synthesis failed");
    if (res.data.audioId) return audioUrl(res.data.audioId);
    const bytes = base64ToBytes(res.data.audioBase64 ?? "");
    return URL.createObjectURL(new Blob([bytes], { type: res.data.mimeType || "audio/mpeg" }));
  },
};
