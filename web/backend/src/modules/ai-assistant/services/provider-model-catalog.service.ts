// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createHash } from "node:crypto";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import {
  DEFAULT_PROVIDER_MODEL,
  PROVIDER_IDS,
  PROVIDER_MODEL_TIERS,
  type AssistantConfig,
  type AssistantProviderId,
} from "../models/assistant-config.types.js";

export type ProviderModelOption = {
  id: string;
  label: string;
  reasoningEfforts?: Array<"low" | "medium" | "high" | "xhigh" | "max">;
  available: boolean;
};

export type ProviderModelCatalog = {
  providerId: AssistantProviderId;
  mode: "api" | "cli";
  status: "verified" | "unverified" | "unavailable";
  source: "provider-api" | "curated";
  checkedAt: string;
  models: ProviderModelOption[];
  reason?: "provider_not_configured" | "provider_authorization_failed" | "provider_unavailable";
};

const TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 7_000;
const MAX_PAGES = 10;
const cache = new Map<string, { expiresAt: number; catalog: ProviderModelCatalog }>();

function labelForModel(id: string): string {
  return id
    .replace(/^models\//, "")
    .split(/[-_/]+/)
    .map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

function reasoningEffortsForModel(id: string): ProviderModelOption["reasoningEfforts"] {
  if (/gpt-6-(?:astra|sol)|gpt-5|grok-4/i.test(id)) return ["low", "medium", "high", "xhigh", "max"];
  if (/gpt-6-luna|o[134]/i.test(id)) return ["low", "medium", "high", "xhigh"];
  return undefined;
}

function curatedModels(providerId: AssistantProviderId, config: AssistantConfig): ProviderModelOption[] {
  const ids = new Set<string>([
    DEFAULT_PROVIDER_MODEL[providerId],
    ...Object.values(PROVIDER_MODEL_TIERS[providerId]),
  ]);
  const slot = config.providers[providerId];
  const configuredModel = slot.mode === "api" ? slot.api?.model : slot.cli?.model;
  if (configuredModel?.trim()) ids.add(configuredModel.trim());
  return [...ids].filter(Boolean).map((id) => ({
    id,
    label: labelForModel(id),
    ...(reasoningEffortsForModel(id) ? { reasoningEfforts: reasoningEffortsForModel(id) } : {}),
    available: false,
  }));
}

function modelIsChatCapable(providerId: AssistantProviderId, item: Record<string, unknown>): boolean {
  const id = typeof item.id === "string" ? item.id : typeof item.name === "string" ? item.name : "";
  if (!id) return false;
  const methods = item.supportedGenerationMethods;
  if (Array.isArray(methods)) return methods.includes("generateContent");
  const capabilities = item.capabilities;
  if (Array.isArray(capabilities)) {
    const normalized = capabilities.map((value) => String(value).toLowerCase());
    if (normalized.some((value) => ["chat", "text", "messages", "generatecontent", "responses"].includes(value))) return true;
    if (normalized.length) return false;
  }
  if (/embedding|whisper|audio|speech|transcri|tts|image|video|moderation|rerank|realtime|safety|guard|search/i.test(id)) return false;
  if (providerId === "codex") return /^(gpt-|o[1345](?:-|$)|chatgpt-|codex-)/i.test(id);
  if (providerId === "deepseek") return /^deepseek-/i.test(id);
  if (providerId === "grok") return /^grok-/i.test(id);
  if (providerId === "minimax") return /^minimax-/i.test(id);
  return true;
}

function endpointBase(providerId: AssistantProviderId, baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/+$/, "");
  switch (providerId) {
    case "claude": return "https://api.anthropic.com";
    case "codex": return "https://api.openai.com";
    case "gemini": return "https://generativelanguage.googleapis.com/v1beta";
    case "deepseek": return "https://api.deepseek.com";
    case "grok": return "https://api.x.ai";
    case "minimax": return "https://api.minimax.io/anthropic";
  }
}

async function readJson(url: string, headers: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    const error = new Error(`provider_catalog_http_${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return await response.json() as Record<string, unknown>;
}

function responseModels(payload: Record<string, unknown>): Record<string, unknown>[] {
  const candidate = payload.data ?? payload.models;
  return Array.isArray(candidate)
    ? candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function modelId(item: Record<string, unknown>): string | undefined {
  const raw = typeof item.id === "string" ? item.id : typeof item.name === "string" ? item.name : undefined;
  const id = raw?.replace(/^models\//, "").trim();
  return id && id.length <= 160 ? id : undefined;
}

async function listApiModels(providerId: AssistantProviderId, config: AssistantConfig): Promise<string[]> {
  const api = config.providers[providerId].api;
  if (!api?.apiKey) throw Object.assign(new Error("provider_not_configured"), { status: 401 });
  const base = endpointBase(providerId, api.baseUrl);
  const headers: Record<string, string> = { Accept: "application/json" };
  let url: string;
  let pageToken: string | undefined;
  const ids = new Set<string>();

  switch (providerId) {
    case "claude":
      headers["x-api-key"] = api.apiKey;
      headers["anthropic-version"] = "2023-06-01";
      url = `${base}/v1/models?limit=100`;
      break;
    case "codex":
    case "grok":
      headers.Authorization = `Bearer ${api.apiKey}`;
      url = providerId === "grok" && !api.baseUrl
        ? `${base}/v1/language-models`
        : `${base}/v1/models`;
      break;
    case "deepseek":
      headers.Authorization = `Bearer ${api.apiKey}`;
      url = `${base.replace(/\/v1$/, "")}/models`;
      break;
    case "minimax":
      headers["x-api-key"] = api.apiKey;
      headers["anthropic-version"] = "2023-06-01";
      url = `${base}/v1/models?limit=100`;
      break;
    case "gemini":
      headers["x-goog-api-key"] = api.apiKey;
      url = `${base}/models?pageSize=100`;
      break;
  }

  for (let page = 0; page < MAX_PAGES; page++) {
    const target = pageToken
      ? `${url}${url.includes("?") ? "&" : "?"}${providerId === "gemini" ? "pageToken" : "after_id"}=${encodeURIComponent(pageToken)}`
      : url;
    const payload = await readJson(target, headers);
    for (const item of responseModels(payload)) {
      const id = modelId(item);
      if (id && modelIsChatCapable(providerId, { ...item, id })) ids.add(id);
    }
    const next = typeof payload.nextPageToken === "string" ? payload.nextPageToken
      : typeof payload.next_page === "string" ? payload.next_page
        : payload.has_more === true && typeof payload.last_id === "string" ? payload.last_id
          : undefined;
    if (!next || ids.size >= 500) break;
    pageToken = next;
  }
  return [...ids];
}

function cacheKey(executor: Executor, config: AssistantConfig, providerId: AssistantProviderId): string {
  const slot = config.providers[providerId];
  // A catalogue may include the configured model when the provider cannot list
  // its own inventory. Keep CLI login/install state and both configured model
  // values in the cache identity so a credentials or `/model` change takes
  // effect immediately instead of inheriting a stale five-minute catalogue.
  const identity = slot.mode === "api"
    ? `${slot.api?.apiKey ?? ""}\0${slot.api?.baseUrl ?? ""}\0${slot.api?.model ?? ""}`
    : `${slot.cli?.installed ? "1" : "0"}\0${slot.cli?.loggedIn ? "1" : "0"}\0${slot.cli?.model ?? ""}\0${slot.cli?.binPath ?? ""}`;
  const configIdentity = createHash("sha256").update(identity).digest("hex");
  return [executor.target.id, getContextUserId() ?? "shared", providerId, slot.mode, configIdentity].join(":");
}

function statusReason(error: unknown): ProviderModelCatalog["reason"] {
  if ((error as Error | null)?.message === "provider_not_configured") return "provider_not_configured";
  const status = (error as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return "provider_authorization_failed";
  return "provider_unavailable";
}

export async function providerModelCatalog(
  executor: Executor,
  config: AssistantConfig,
  providerId: AssistantProviderId,
  options: { refresh?: boolean } = {},
): Promise<ProviderModelCatalog> {
  if (!PROVIDER_IDS.includes(providerId)) throw new Error("assistant_provider_not_found");
  const slot = config.providers[providerId];
  const key = cacheKey(executor, config, providerId);
  const cached = cache.get(key);
  if (!options.refresh && cached && cached.expiresAt > Date.now()) return cached.catalog;

  const checkedAt = new Date().toISOString();
  if (slot.mode === "cli") {
    // A detected binary is not a usable provider until its account/session is
    // authenticated. The chat UI and provider picker must never advertise
    // models that will only fail on the first prompt.
    const ready = Boolean(slot.cli?.installed && slot.cli?.loggedIn);
    const catalog: ProviderModelCatalog = {
      providerId, mode: slot.mode, status: ready ? "unverified" : "unavailable",
      source: "curated", checkedAt,
      models: curatedModels(providerId, config).map((model) => ({ ...model, available: ready })),
      ...(!ready ? { reason: slot.cli?.installed ? "provider_authorization_failed" as const : "provider_unavailable" as const } : {}),
    };
    cache.set(key, { expiresAt: Date.now() + TTL_MS, catalog });
    return catalog;
  }

  try {
    const ids = await listApiModels(providerId, config);
    const models = ids.map((id) => ({
      id,
      label: labelForModel(id),
      ...(reasoningEffortsForModel(id) ? { reasoningEfforts: reasoningEffortsForModel(id) } : {}),
      available: true,
    }));
    const catalog: ProviderModelCatalog = {
      providerId, mode: slot.mode, status: "verified", source: "provider-api", checkedAt, models,
    };
    cache.set(key, { expiresAt: Date.now() + TTL_MS, catalog });
    return catalog;
  } catch (error) {
    const reason = statusReason(error);
    const catalog: ProviderModelCatalog = {
      providerId, mode: slot.mode, status: "unverified", source: "curated", checkedAt,
      models: curatedModels(providerId, config), reason,
    };
    cache.set(key, { expiresAt: Date.now() + Math.min(TTL_MS, 30_000), catalog });
    return catalog;
  }
}

export function resolveCatalogModel(
  preferredModel: string | undefined,
  catalog: ProviderModelCatalog,
  providerId: AssistantProviderId,
): { model: string | undefined; fallback: boolean } {
  const preferred = preferredModel?.trim();
  if (catalog.status !== "verified") return { model: preferred, fallback: false };
  if (preferred && catalog.models.some((entry) => entry.id === preferred)) return { model: preferred, fallback: false };
  const providerDefault = DEFAULT_PROVIDER_MODEL[providerId];
  const fallback = catalog.models.find((entry) => entry.id === providerDefault)?.id ?? catalog.models[0]?.id;
  return { model: fallback, fallback: Boolean(fallback && fallback !== preferred) };
}

export function fallbackModelIds(catalog: ProviderModelCatalog, providerId: AssistantProviderId, excluded: readonly string[] = []): string[] {
  const excludedSet = new Set(excluded);
  const candidates = catalog.status === "verified"
    ? catalog.models.filter((entry) => entry.available).map((entry) => entry.id)
    : catalog.models.map((entry) => entry.id);
  const providerDefault = DEFAULT_PROVIDER_MODEL[providerId];
  const ordered = [...(candidates.includes(providerDefault) ? [providerDefault] : []), ...candidates];
  return [...new Set(ordered.filter((id) => id && !excludedSet.has(id)))].slice(0, 2);
}

export function isExplicitModelUnavailable(message: string): boolean {
  return /(?:model|deployment|engine).{0,80}(?:not found|does not exist|unavailable|not available|unsupported|not supported|unknown)|(?:not found|does not exist|unavailable|not available|unsupported|not supported|unknown).{0,80}(?:model|deployment|engine)/i.test(message);
}
