// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Factory: AssistantConfig + provider id → constructed AgentProvider.
 *
 * CLI providers throw an explicit error for now (F4 ships the API mode
 * end-to-end; CLI bridge is the next sub-pass).
 */

import { makeClaudeApiProvider } from "./claude-api.provider.js";
import { makeOpenAiCompatibleProvider } from "./openai-api.provider.js";
import { makeOpenAiResponsesProvider } from "./openai-responses.provider.js";
import { makeGeminiApiProvider } from "./gemini-api.provider.js";
import { makeCliBridgeProvider } from "./cli-bridge.provider.js";
import type { AgentProvider } from "./provider.types.js";
import type {
  AssistantConfig,
  AssistantProviderId,
} from "../../models/assistant-config.types.js";

const CODEX_DEFAULT_BASE_URL = "https://api.openai.com";
const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
const GROK_DEFAULT_BASE_URL = "https://api.x.ai";
// MiniMax has no native wire format — it exposes Anthropic- and OpenAI-compatible
// layers and marks the Anthropic one as recommended. Route it through the
// Anthropic-format provider with MiniMax's base URL.
const MINIMAX_DEFAULT_BASE_URL = "https://api.minimax.io/anthropic";

export class ProviderUnavailableError extends Error {
  constructor(public readonly providerId: AssistantProviderId, message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export function buildProvider(
  config: AssistantConfig,
  providerId?: AssistantProviderId,
  /**
   * Force a specific model for THIS provider instance only (does not mutate
   * config). Used by the multi-agent orchestrator to run sub-agents at
   * different model tiers from one config. Applies to API mode only.
   */
  modelOverride?: string,
): AgentProvider {
  const id = providerId ?? config.activeProvider;
  const slot = config.providers[id];

  if (slot.mode === "cli") {
    if (id === "deepseek") {
      // DeepSeek has no headless CLI — API mode only.
      throw new ProviderUnavailableError(
        id,
        `CLI de ${id} no disponible en el asistente — usa el modo API.`,
      );
    }
    if (!slot.cli?.installed) {
      throw new ProviderUnavailableError(
        id,
        `CLI de ${id} no instalado en el target. Instálalo desde la pestaña Proveedores.`,
      );
    }
    return makeCliBridgeProvider({
      id,
      // MiniMax must resolve `claude-minimax` from PATH so the bridge can
      // prefer the freshly synced per-user wrapper in `~/.local/bin/` over a
      // stale system-wide `/usr/local/bin/claude-minimax`.
      binOverride: id === "minimax" ? undefined : slot.cli?.binPath,
      // The old M3[1m] alias is no longer documented by MiniMax.
      model:
        id === "minimax" &&
        (slot.cli as { model?: string } | undefined)?.model === "MiniMax-M3[1m]"
          ? "MiniMax-M3"
          : (slot.cli as { model?: string } | undefined)?.model,
      // Codex CLI uses its own login. Never inject the panel's metered API key
      // as an implicit fallback when the user selected CLI mode.
      // MiniMax/Grok retain their provider-specific key authentication.
      apiKey:
        id === "minimax" || id === "grok"
          ? slot.api?.apiKey
          : undefined,
    });
  }

  const slotApi = slot.api;
  if (!slotApi || !slotApi.apiKey) {
    throw new ProviderUnavailableError(id, `Proveedor "${id}" sin API key configurada.`);
  }
  // Normalize discontinued DeepSeek aliases and MiniMax's undocumented old M3 alias.
  const chosenModel = modelOverride ?? slotApi.model;
  const apiModel = id === "minimax" && chosenModel === "MiniMax-M3[1m]"
    ? "MiniMax-M3"
    : id === "deepseek" && (chosenModel === "deepseek-chat" || chosenModel === "deepseek-reasoner")
      ? "deepseek-flash"
      : chosenModel;
  const api = apiModel === slotApi.model ? slotApi : { ...slotApi, model: apiModel };
  if (!api.model) {
    throw new ProviderUnavailableError(id, `Proveedor "${id}" sin modelo configurado.`);
  }

  switch (id) {
    case "claude":
      return makeClaudeApiProvider({ id: "claude", api });
    case "minimax":
      return makeClaudeApiProvider({
        id: "minimax",
        api,
        defaultBaseUrl: MINIMAX_DEFAULT_BASE_URL,
      });
    case "codex":
      return /^gpt-6-/i.test(api.model)
        ? makeOpenAiResponsesProvider(api)
        : makeOpenAiCompatibleProvider({
            id: "codex",
            api,
            defaultBaseUrl: CODEX_DEFAULT_BASE_URL,
          });
    case "deepseek":
      return makeOpenAiCompatibleProvider({
        id: "deepseek",
        api,
        defaultBaseUrl: DEEPSEEK_DEFAULT_BASE_URL,
      });
    case "grok":
      return makeOpenAiCompatibleProvider({
        id: "grok",
        api,
        defaultBaseUrl: GROK_DEFAULT_BASE_URL,
      });
    case "gemini":
      return makeGeminiApiProvider(api);
    default: {
      const _exhaustive: never = id;
      throw new ProviderUnavailableError(id, `Provider id no manejado: ${String(_exhaustive)}`);
    }
  }
}
