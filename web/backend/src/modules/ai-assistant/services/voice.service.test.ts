// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, describe, it, expect, vi } from "vitest";
import { voiceService } from "./voice.service.js";
import {
  defaultAssistantConfig,
  voiceCapabilities,
  type AssistantConfig,
} from "../models/assistant-config.types.js";

/** Build a config with the given provider keys set (and voice enabled by default). */
function cfgWith(keys: Partial<Record<"codex" | "gemini" | "claude", string>>, voicePatch = {}): AssistantConfig {
  const c = defaultAssistantConfig();
  for (const [id, key] of Object.entries(keys)) {
    c.providers[id as "codex" | "gemini" | "claude"].api!.apiKey = key;
  }
  c.voice = { ...c.voice, ...voicePatch };
  return c;
}

describe("voiceCapabilities (gating: según motor configurado)", () => {
  it("no keys → nothing available", () => {
    expect(voiceCapabilities(cfgWith({}))).toEqual({ stt: null, tts: null });
  });

  it("OpenAI (codex) key → STT + TTS via openai", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }))).toEqual({ stt: "openai", tts: "openai" });
  });

  it("Gemini key only does not enable voice", () => {
    expect(voiceCapabilities(cfgWith({ gemini: "g-x" }))).toEqual({ stt: null, tts: null });
  });

  it("only a Claude key → audio stays disabled (Claude has no STT/TTS surface)", () => {
    expect(voiceCapabilities(cfgWith({ claude: "ck-x" }))).toEqual({ stt: null, tts: null });
  });

  it("auto STT prefers OpenAI when both keys exist", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x", gemini: "g-x" }))).toEqual({ stt: "openai", tts: "openai" });
  });

  it("legacy Gemini preference cannot divert voice from OpenAI", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x", gemini: "g-x" }, { sttEngine: "gemini" }))).toEqual({
      stt: "openai",
      tts: "openai",
    });
  });

  it("legacy engine preference cannot disable configured OpenAI transcription", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }, { sttEngine: "gemini" }))).toEqual({
      stt: "openai",
      tts: "openai",
    });
  });

  it("disabled master switch → nothing available even with keys", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }, { enabled: false }))).toEqual({ stt: null, tts: null });
  });

  it("legacy Piper selection uses OpenAI when available", () => {
    expect(voiceCapabilities(cfgWith({}, { ttsProvider: "cli" })).tts).toBeNull();
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }, { ttsProvider: "cli" }))).toEqual({
      stt: "openai",
      tts: "openai",
    });
  });

  it("ttsProvider 'api' (default) keeps OpenAI-gated TTS", () => {
    expect(voiceCapabilities(cfgWith({}, { ttsProvider: "api" })).tts).toBeNull();
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }, { ttsProvider: "api" })).tts).toBe("openai");
  });

  it("legacy MiniMax selection never enables voice without OpenAI", () => {
    expect(voiceCapabilities(cfgWith({}, { ttsProvider: "minimax-cli" })).tts).toBeNull();

    const withApiKey = cfgWith({}, { ttsProvider: "minimax-cli" });
    withApiKey.providers.minimax.cli!.installed = true;
    withApiKey.providers.minimax.api!.apiKey = "mmx-sk";
    expect(voiceCapabilities(withApiKey).tts).toBeNull();

    const withLogin = cfgWith({}, { ttsProvider: "minimax-cli" });
    withLogin.providers.minimax.cli!.installed = true;
    withLogin.providers.minimax.cli!.loggedIn = true;
    expect(voiceCapabilities(withLogin).tts).toBeNull();
  });
});

afterEach(() => vi.unstubAllGlobals());

it("sends recorded audio to OpenAI and returns the transcript", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: "  mensaje dictado  " }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
  const text = await voiceService.transcribe(cfgWith({ codex: "test-key" }), Buffer.from("audio").toString("base64"), "audio/webm");
  expect(text.text).toBe("mensaje dictado");
  expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/audio/transcriptions", expect.objectContaining({ method: "POST" }));
});

it("explains rejected OpenAI credentials without exposing the upstream response", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"message":"raw provider detail"}}', { status: 401 })));
  await expect(
    voiceService.transcribe(cfgWith({ codex: "test-key" }), Buffer.from("audio").toString("base64"), "audio/webm"),
  ).rejects.toThrow("OpenAI no autenticó la clave API. Revisa la clave guardada en Ajustes → Agentes IA → OpenAI y su organización en OpenAI.");
});

it("does not send speech to Gemini when OpenAI is not configured", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(voiceService.transcribe(cfgWith({ gemini: "gemini-key" }), "YXVkaW8=", "audio/webm"))
    .rejects.toThrow(/OpenAI/);
  expect(fetchMock).not.toHaveBeenCalled();
});
