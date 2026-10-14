// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — third-party integration credentials (ElevenLabs).
 *
 * The key lives in the SAME per-target `0600` config sidecar as the provider
 * keys (`assistantConfigRepository`), under `integrations.elevenlabs`. It never
 * leaves the target: every read that reaches HTTP goes through
 * `redactIntegrationsConfig` (presence + `••••abcd` preview only) and the key
 * is NEVER logged, not even truncated.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { fetchWithTimeout } from "../../../shared/http/fetch-timeout.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import {
  redactIntegrationsConfig,
  type AssistantConfig,
  type RedactedElevenLabsIntegration,
} from "../models/assistant-config.types.js";

/** ElevenLabs account probe — cheapest authenticated endpoint. */
const ELEVENLABS_USER_URL = "https://api.elevenlabs.io/v1/user";
/** Network budget for the probe; the UI must never hang on a dead endpoint. */
const PROBE_TIMEOUT_MS = 8000;

export interface ElevenLabsTestResult {
  valid: boolean;
  message: string;
}

/**
 * Credentials the audio-call layer (F3) needs, resolved from the assistant
 * config of the connected target. Only keys that are actually present and
 * non-empty appear in the result — a missing provider is simply absent.
 *
 * - `openai.apiKey`     ← `config.providers.codex.api.apiKey`
 * - `elevenlabs.apiKey` ← `config.integrations.elevenlabs.apiKey`
 * - `elevenlabs.voiceId`← `config.integrations.elevenlabs.defaultVoiceId`
 *
 * STABLE CONTRACT: callers may rely on the shape below; new providers are only
 * ever ADDED as further optional keys.
 *
 * @param executor Target executor whose sidecar holds the config (the same
 *                 `Executor` the module's other services take).
 */
export async function resolveCallProviderCredentials(executor: Executor): Promise<{
  openai?: { apiKey: string };
  elevenlabs?: { apiKey: string; voiceId?: string };
}> {
  const cfg = await assistantConfigRepository.load(executor);
  const out: {
    openai?: { apiKey: string };
    elevenlabs?: { apiKey: string; voiceId?: string };
  } = {};

  const openaiKey = (cfg.providers?.codex?.api?.apiKey ?? "").trim();
  if (openaiKey) out.openai = { apiKey: openaiKey };

  const elevenKey = (cfg.integrations?.elevenlabs?.apiKey ?? "").trim();
  if (elevenKey) {
    const voiceId = (cfg.integrations?.elevenlabs?.defaultVoiceId ?? "").trim();
    out.elevenlabs = { apiKey: elevenKey, ...(voiceId ? { voiceId } : {}) };
  }
  return out;
}

export const assistantIntegrationsService = {
  /** Public (redacted) ElevenLabs state for the credentials card. */
  async getElevenLabs(executor?: Executor | null): Promise<RedactedElevenLabsIntegration> {
    const cfg = await assistantConfigRepository.load(executor);
    return redactIntegrationsConfig(cfg.integrations).elevenlabs;
  },

  /**
   * Save the ElevenLabs credential. An absent/empty `apiKey` KEEPS the stored
   * one (the card sends the key only when the admin types a new value); an
   * absent `defaultVoiceId` keeps the stored one, an empty string clears it.
   */
  async setElevenLabs(
    patch: { apiKey?: string; defaultVoiceId?: string },
    executor?: Executor | null,
  ): Promise<RedactedElevenLabsIntegration> {
    const current = await assistantConfigRepository.load(executor);
    const stored = current.integrations?.elevenlabs;
    const apiKey = (patch.apiKey ?? "").trim() || stored?.apiKey || "";
    const voiceId =
      patch.defaultVoiceId !== undefined ? patch.defaultVoiceId.trim() : (stored?.defaultVoiceId ?? "");
    const saved = await assistantConfigRepository.patch(
      { integrations: { elevenlabs: { apiKey, ...(voiceId ? { defaultVoiceId: voiceId } : {}) } } },
      executor,
    );
    return redactIntegrationsConfig(saved.integrations).elevenlabs;
  },

  /** Remove `integrations.elevenlabs` entirely. */
  async clearElevenLabs(executor?: Executor | null): Promise<RedactedElevenLabsIntegration> {
    const current = await assistantConfigRepository.load(executor);
    const integrations = { ...(current.integrations ?? {}) };
    delete integrations.elevenlabs;
    const next: AssistantConfig = { ...current, integrations };
    const saved = await assistantConfigRepository.save(next, executor);
    return redactIntegrationsConfig(saved.integrations).elevenlabs;
  },

  /**
   * Probe a key against ElevenLabs. Uses the supplied key when given, else the
   * stored one. NEVER throws on a network/HTTP failure and NEVER logs the key:
   * a failure comes back as `{ valid: false, message }` so the endpoint stays
   * 200 and the card can show a toast.
   */
  async testElevenLabs(apiKeyRaw?: string, executor?: Executor | null): Promise<ElevenLabsTestResult> {
    let apiKey = (apiKeyRaw ?? "").trim();
    if (!apiKey) {
      const cfg = await assistantConfigRepository.load(executor);
      apiKey = (cfg.integrations?.elevenlabs?.apiKey ?? "").trim();
    }
    if (!apiKey) return { valid: false, message: "No hay ninguna API key de ElevenLabs configurada" };
    try {
      const res = await fetchWithTimeout(
        ELEVENLABS_USER_URL,
        { method: "GET", headers: { "xi-api-key": apiKey, accept: "application/json" } },
        PROBE_TIMEOUT_MS,
      );
      if (res.ok) return { valid: true, message: "Credencial de ElevenLabs válida" };
      if (res.status === 401 || res.status === 403) {
        return { valid: false, message: "ElevenLabs rechazó la API key (no autorizada)" };
      }
      return { valid: false, message: `ElevenLabs respondió ${res.status}` };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      return {
        valid: false,
        message: timedOut
          ? "Tiempo de espera agotado al contactar con ElevenLabs"
          : "No se pudo contactar con ElevenLabs",
      };
    }
  },
};
