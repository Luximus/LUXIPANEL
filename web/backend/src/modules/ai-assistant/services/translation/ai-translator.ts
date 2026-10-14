// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI translation engine — reuses an existing provider's API key/baseUrl but
 * forces a CHEAP model and a single, non-streaming, no-tools call. This is the
 * default engine: high quality, very low cost, no extra integration/keys.
 */

import { createModuleLogger } from "../../../../shared/logger/index.js";
import type {
  AssistantConfig,
  AssistantProviderId,
} from "../../models/assistant-config.types.js";
import { DEFAULT_TRANSLATION_MODEL, TRANSLATION_PROVIDER_PRIORITY } from "../../models/assistant-config.types.js";
import { langName } from "./lang-name.js";
import type {
  TranslationProvider,
  TranslationUsage,
  TranslationUsageSink,
} from "./translation.types.js";
import { TranslationError } from "./translation.types.js";

const log = createModuleLogger("translation-ai");

// Socket-level safety net so a hung provider call aborts instead of blocking
// the run forever. Sits a bit above the service's per-attempt race timeout, so
// the service drives the retry while this guarantees the orphaned socket dies.
const TRANSLATION_AI_TIMEOUT_MS = 25_000;

const DEFAULT_BASE_URL: Record<AssistantProviderId, string> = {
  claude: "https://api.anthropic.com",
  codex: "https://api.openai.com",
  deepseek: "https://api.deepseek.com",
  grok: "https://api.x.ai",
  gemini: "https://generativelanguage.googleapis.com",
  // MiniMax's Anthropic-compatible surface (same wire format as Claude).
  minimax: "https://api.minimax.io/anthropic",
};

interface ResolvedAi {
  providerId: AssistantProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
}

/**
 * Resolve the effective translation provider/key/model. When `aiFollowActive`
 * is on (default), translation FOLLOWS the active/main chat provider with that
 * provider's cheap translation model — so it tracks whatever the user runs by
 * default. A manual override (`aiFollowActive === false`) uses the pinned
 * `translation.ai`. Either way the provider's API key/baseUrl come from its slot
 * (translation is REST-only; a slot with no key fails and the caller falls back).
 */
export function resolveEffectiveTranslationProvider(config: AssistantConfig): { providerId: AssistantProviderId; model: string } {
  const t = config.translation;
  const hasKey = (id: AssistantProviderId): boolean => !!config.providers[id]?.api?.apiKey?.trim();
  if (t.aiFollowActive !== false) {
    const active = config.activeProvider;
    // Follow the active provider when it can actually translate (REST = needs a
    // key). When it's CLI-only/keyless, fall to the first keyed provider so
    // runtime matches verify-on-save (which skips keyless candidates).
    const providerId = hasKey(active) ? active : (TRANSLATION_PROVIDER_PRIORITY.find(hasKey) ?? active);
    return { providerId, model: DEFAULT_TRANSLATION_MODEL[providerId] };
  }
  const providerId = (t.ai?.providerId ?? "claude") as AssistantProviderId;
  return { providerId, model: t.ai?.model || "" };
}

function resolveAiConfig(config: AssistantConfig): ResolvedAi {
  const eff = resolveEffectiveTranslationProvider(config);
  const providerId = eff.providerId;
  const slot = config.providers[providerId];
  const apiKey = slot?.api?.apiKey ?? "";
  const selectedModel = eff.model || slot?.api?.model || "";
  // Saved translation choices can outlive provider aliases.
  const model = providerId === "deepseek" && (selectedModel === "deepseek-chat" || selectedModel === "deepseek-reasoner")
    ? "deepseek-flash"
    : providerId === "minimax" && selectedModel === "MiniMax-M3[1m]"
      ? "MiniMax-M3"
      : selectedModel;
  const baseUrl = (slot?.api?.baseUrl ?? DEFAULT_BASE_URL[providerId]).replace(/\/+$/, "");
  return { providerId, apiKey, model, baseUrl };
}

function systemPrompt(from: string | "auto", to: string): string {
  const src = from === "auto" ? "the source language" : langName(from);
  return (
    `You are a professional translation engine. Translate the user's text from ${src} to ${langName(to)}. ` +
    `Preserve all Markdown, code, inline code, fenced code blocks, file paths, URLs, placeholders and whitespace EXACTLY as-is — never translate or alter them. ` +
    `Do not add commentary, quotes, notes or explanations. Output ONLY the translated text.`
  );
}

/** Translated text plus the real token usage the provider reported (if any). */
interface OneShotResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callClaude(cfg: ResolvedAi, system: string, text: string, signal?: AbortSignal): Promise<OneShotResult> {
  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: text }],
    }),
    signal,
  });
  if (!res.ok) throw new TranslationError("ai", `Claude ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    text: (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join(""),
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

async function callOpenAi(cfg: ResolvedAi, system: string, text: string, signal?: AbortSignal): Promise<OneShotResult> {
  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new TranslationError("ai", `${cfg.providerId} ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callGemini(cfg: ResolvedAi, system: string, text: string, signal?: AbortSignal): Promise<OneShotResult> {
  // API key por header (no en el query string): `?key=…` se filtra a logs de
  // acceso y proxies. Igual que ya hace el provider de Gemini.
  const endpoint = `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text }] }],
      // Translation is a mechanical task — disable Gemini "thinking" so each
      // call is ~1.4s instead of ~7s (and burns ~1300 fewer tokens). The slow
      // thinking path was overrunning the 15s per-attempt timeout, silently
      // degrading the answer back to its English source.
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal,
  });
  if (!res.ok) throw new TranslationError("ai", `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  return {
    text: (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function oneShot(cfg: ResolvedAi, system: string, text: string, signal?: AbortSignal): Promise<OneShotResult> {
  switch (cfg.providerId) {
    case "claude":
    case "minimax": // Anthropic-compatible wire format
      return callClaude(cfg, system, text, signal);
    case "codex":
    case "deepseek":
    case "grok":
      return callOpenAi(cfg, system, text, signal);
    case "gemini":
      return callGemini(cfg, system, text, signal);
    default:
      throw new TranslationError("ai", `Provider de traducción no soportado: ${String(cfg.providerId)}`);
  }
}

/** Resolve a provider's API slot (apiKey/model/baseUrl) for a one-shot call. */
function resolveProviderApiConfig(config: AssistantConfig, providerId: AssistantProviderId): ResolvedAi {
  const slot = config.providers[providerId];
  const apiKey = slot?.api?.apiKey ?? "";
  const model = slot?.api?.model || "";
  const baseUrl = (slot?.api?.baseUrl ?? DEFAULT_BASE_URL[providerId]).replace(/\/+$/, "");
  return { providerId, apiKey, model, baseUrl };
}

/**
 * Generic single, non-streaming, no-tools completion. Reuses the same provider
 * dispatch as the translation engine. Prefers the requested provider's API slot
 * (its key/model); if that slot has no API key/model, falls back to the
 * translation-configured engine (which the user has already set up). Throws a
 * TranslationError when no usable API credentials exist.
 */
export async function aiComplete(
  config: AssistantConfig,
  opts: {
    providerId?: AssistantProviderId;
    system: string;
    user: string;
    signal?: AbortSignal;
    /** When the chosen provider has no API key/model, fall back to the
     *  translation-configured engine. Default true. Pass false when the user
     *  explicitly picked a provider (we want a clear error, not a silent swap). */
    allowFallback?: boolean;
  },
): Promise<OneShotResult> {
  let cfg = opts.providerId ? resolveProviderApiConfig(config, opts.providerId) : resolveAiConfig(config);
  // CLI-only provider (no API key) or unconfigured → optionally fall back to the
  // translation engine, which is the default API-backed path.
  if ((!cfg.apiKey || !cfg.model) && opts.allowFallback !== false) cfg = resolveAiConfig(config);
  if (!cfg.apiKey) throw new TranslationError("ai", `El proveedor "${cfg.providerId}" no tiene API key configurada (¿está en modo CLI?). Elige otro proveedor.`);
  if (!cfg.model) throw new TranslationError("ai", `El proveedor "${cfg.providerId}" no tiene modelo configurado.`);
  return oneShot(cfg, opts.system, opts.user, opts.signal);
}

export function makeAiTranslator(config: AssistantConfig, onUsage?: TranslationUsageSink): TranslationProvider {
  const cfg = resolveAiConfig(config);
  const report = (r: OneShotResult): void => {
    if (!onUsage) return;
    if (r.inputTokens <= 0 && r.outputTokens <= 0) return; // provider didn't report usage
    const usage: TranslationUsage = {
      providerId: cfg.providerId,
      model: cfg.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
    };
    onUsage(usage);
  };
  return {
    id: "ai",
    async ping() {
      if (!cfg.apiKey) return { ok: false, detail: `Proveedor "${cfg.providerId}" sin API key.` };
      if (!cfg.model) return { ok: false, detail: "Modelo de traducción vacío." };
      return { ok: true, detail: `ai · ${cfg.providerId} · ${cfg.model}` };
    },
    async translate(text, from, to) {
      if (!cfg.apiKey) throw new TranslationError("ai", `Proveedor "${cfg.providerId}" sin API key.`);
      if (!text.trim()) return text;
      const out = await oneShot(cfg, systemPrompt(from, to), text, AbortSignal.timeout(TRANSLATION_AI_TIMEOUT_MS));
      report(out);
      const result = out.text.trim();
      // Empty output for non-empty input = a failed call. Throw so the service
      // retries instead of silently emitting the untranslated original.
      if (!result) throw new TranslationError("ai", "empty translation output");
      return result;
    },
    async detectLanguage(text) {
      if (!cfg.apiKey) throw new TranslationError("ai", `Proveedor "${cfg.providerId}" sin API key.`);
      const system =
        "Detect the language of the user's text. Respond with ONLY the ISO 639-1 two-letter lowercase code (e.g. en, es, fr). No other text.";
      const out = await oneShot(cfg, system, text.slice(0, 800), AbortSignal.timeout(TRANSLATION_AI_TIMEOUT_MS));
      report(out);
      const code = out.text.trim().toLowerCase().slice(0, 2);
      if (!/^[a-z]{2}$/.test(code)) {
        log.warn({ out: out.text }, "AI detectLanguage returned unexpected output");
        return "en";
      }
      return code;
    },
  };
}
