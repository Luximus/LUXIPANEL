// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
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

  it("Gemini key only → STT via gemini, NO TTS (v1 TTS is OpenAI-only)", () => {
    expect(voiceCapabilities(cfgWith({ gemini: "g-x" }))).toEqual({ stt: "gemini", tts: null });
  });

  it("only a Claude key → audio stays disabled (Claude has no STT/TTS surface)", () => {
    expect(voiceCapabilities(cfgWith({ claude: "ck-x" }))).toEqual({ stt: null, tts: null });
  });

  it("auto STT prefers OpenAI when both keys exist", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x", gemini: "g-x" }))).toEqual({ stt: "openai", tts: "openai" });
  });

  it("explicit gemini STT engine is honored when its key exists", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x", gemini: "g-x" }, { sttEngine: "gemini" }))).toEqual({
      stt: "gemini",
      tts: "openai",
    });
  });

  it("explicit STT engine without its key → no STT", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }, { sttEngine: "gemini" }))).toEqual({
      stt: null,
      tts: "openai",
    });
  });

  it("disabled master switch → nothing available even with keys", () => {
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }, { enabled: false }))).toEqual({ stt: null, tts: null });
  });

  it("ttsProvider 'cli' → TTS = piper, sin depender de ninguna API key", () => {
    expect(voiceCapabilities(cfgWith({}, { ttsProvider: "cli" })).tts).toBe("piper");
    // STT keeps following the API keys (Piper is TTS-only).
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }, { ttsProvider: "cli" }))).toEqual({
      stt: "openai",
      tts: "piper",
    });
  });

  it("ttsProvider 'api' (default) keeps OpenAI-gated TTS", () => {
    expect(voiceCapabilities(cfgWith({}, { ttsProvider: "api" })).tts).toBeNull();
    expect(voiceCapabilities(cfgWith({ codex: "sk-x" }, { ttsProvider: "api" })).tts).toBe("openai");
  });

  it("ttsProvider 'minimax-cli' necesita CLI instalada y auth (login o API key)", () => {
    expect(voiceCapabilities(cfgWith({}, { ttsProvider: "minimax-cli" })).tts).toBeNull();

    const withApiKey = cfgWith({}, { ttsProvider: "minimax-cli" });
    withApiKey.providers.minimax.cli!.installed = true;
    withApiKey.providers.minimax.api!.apiKey = "mmx-sk";
    expect(voiceCapabilities(withApiKey).tts).toBe("minimax");

    const withLogin = cfgWith({}, { ttsProvider: "minimax-cli" });
    withLogin.providers.minimax.cli!.installed = true;
    withLogin.providers.minimax.cli!.loggedIn = true;
    expect(voiceCapabilities(withLogin).tts).toBe("minimax");
  });
});
