// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createHash } from "node:crypto";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import { loginShell, quoteArg } from "./providers/cli/shell.js";
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
  /** Provider-native default, when its inventory exposes one. */
  isDefault?: boolean;
  available: boolean;
};

export type ProviderModelCatalog = {
  providerId: AssistantProviderId;
  mode: "api" | "cli";
  status: "verified" | "unverified" | "unavailable";
  source: "provider-api" | "cli" | "curated";
  checkedAt: string;
  models: ProviderModelOption[];
  reason?: "provider_not_configured" | "provider_authorization_failed" | "provider_unavailable";
};

const TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 7_000;
const MAX_PAGES = 10;
const MAX_CLI_MODELS = 500;
const cache = new Map<string, { expiresAt: number; catalog: ProviderModelCatalog }>();

/**
 * The native Codex app-server is the authority for the account's actual model
 * entitlements. Do not replace this with the auto-routing tier table: those
 * tiers are product preferences, not an entitlement list.
 *
 * The probe writes exactly one JSON record to stdout, uses no threads/tools,
 * and stops the temporary app-server immediately after `model/list` finishes.
 */
const CODEX_MODEL_LIST_PROBE = String.raw`
const { spawn } = require("node:child_process");
const bin = process.argv[1] || "codex";
const child = spawn(bin, ["app-server", "-c", "features.fast_mode=true"], { stdio: ["pipe", "pipe", "pipe"] });
let buffer = "";
let nextId = 1;
let initialized = false;
let completed = false;
let pages = 0;
const models = [];
const MAX_PAGES = 10;
const finish = (payload, code = 0) => {
  if (completed) return;
  completed = true;
  clearTimeout(timeout);
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exitCode = code;
  child.kill("SIGTERM");
  const kill = setTimeout(() => child.kill("SIGKILL"), 500);
  kill.unref();
};
const fail = (reason) => finish({ ok: false, reason: String(reason || "cli_catalog_failed").slice(0, 180) }, 1);
const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");
const requestModels = (cursor) => {
  if (++pages > MAX_PAGES) return fail("cli_catalog_page_limit");
  send({ id: ++nextId, method: "model/list", params: { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) } });
};
const timeout = setTimeout(() => fail("cli_catalog_timeout"), 6500);
child.on("error", (error) => fail(error.message));
child.on("exit", (code) => { if (!completed) fail("cli_catalog_exit_" + String(code)); });
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf("\n");
    if (newline < 0) break;
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let message;
    try { message = JSON.parse(line); } catch { continue; }
    if (message.id === 1 && !initialized) {
      if (message.error) return fail(message.error.message || "cli_initialize_failed");
      initialized = true;
      send({ method: "initialized", params: {} });
      requestModels(null);
      continue;
    }
    if (message.id !== nextId || !initialized) continue;
    if (message.error) return fail(message.error.message || "cli_model_list_failed");
    const result = message.result || {};
    if (!Array.isArray(result.data)) return fail("cli_model_list_invalid");
    models.push(...result.data);
    if (typeof result.nextCursor === "string" && result.nextCursor) requestModels(result.nextCursor);
    else finish({ ok: true, models });
  }
});
send({ id: 1, method: "initialize", params: { clientInfo: { name: "luxipanel", title: "LUXIPANEL", version: "1.0.0" }, capabilities: { experimentalApi: true } } });
`;

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

const CLI_EFFORTS = new Set<NonNullable<ProviderModelOption["reasoningEfforts"]>[number]>([
  "low", "medium", "high", "xhigh", "max",
]);

function cliModelId(item: Record<string, unknown>): string | undefined {
  const raw = typeof item.model === "string" ? item.model : typeof item.id === "string" ? item.id : undefined;
  const id = raw?.trim();
  return id && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(id) ? id : undefined;
}

function cliReasoningEfforts(item: Record<string, unknown>): ProviderModelOption["reasoningEfforts"] {
  if (!Array.isArray(item.supportedReasoningEfforts)) return undefined;
  const values = item.supportedReasoningEfforts
    .map((entry) => typeof entry === "string"
      ? entry
      : entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).reasoningEffort === "string"
        ? (entry as Record<string, string>).reasoningEffort
        : undefined)
    .filter((entry): entry is NonNullable<ProviderModelOption["reasoningEfforts"]>[number] => Boolean(entry) && CLI_EFFORTS.has(entry as NonNullable<ProviderModelOption["reasoningEfforts"]>[number]));
  return values.length ? [...new Set(values)] : undefined;
}

function parseCodexCliModels(stdout: string): ProviderModelOption[] {
  // Login shells are allowed to print benign diagnostics. The probe itself emits
  // one JSON line, so accept the last valid record instead of assuming stdout is
  // completely silent on every supported Linux distribution.
  const payload = [...stdout.split("\n")].reverse().map((line) => {
    try { return JSON.parse(line) as Record<string, unknown>; } catch { return undefined; }
  }).find((entry): entry is Record<string, unknown> => Boolean(entry));
  if (!payload?.ok || !Array.isArray(payload.models)) {
    throw new Error(typeof payload?.reason === "string" ? payload.reason : "cli_catalog_invalid");
  }

  const seen = new Set<string>();
  const models: ProviderModelOption[] = [];
  for (const candidate of payload.models) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    if (entry.hidden === true) continue;
    const id = cliModelId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const displayName = typeof entry.displayName === "string" && entry.displayName.trim().length <= 160
      ? entry.displayName.trim()
      : labelForModel(id);
    models.push({
      id,
      label: displayName,
      ...(cliReasoningEfforts(entry) ? { reasoningEfforts: cliReasoningEfforts(entry) } : {}),
      ...(entry.isDefault === true ? { isDefault: true } : {}),
      available: true,
    });
    if (models.length >= MAX_CLI_MODELS) break;
  }
  if (!models.length) throw new Error("cli_catalog_empty");
  return models;
}

async function listCliModels(
  executor: Executor,
  providerId: AssistantProviderId,
  binPath: string | undefined,
): Promise<ProviderModelOption[]> {
  // Codex exposes `model/list` on its authenticated app-server. Other supported
  // CLIs do not expose a reliable non-interactive entitlement inventory, so they
  // must remain unavailable rather than inheriting a marketing/static list.
  if (providerId !== "codex") throw new Error("cli_catalog_not_supported");
  const bin = binPath?.trim() || "codex";
  const command = `node -e ${quoteArg(CODEX_MODEL_LIST_PROBE)} ${quoteArg(bin)}`;
  const result = await executor.exec(loginShell(command), { timeoutMs: REQUEST_TIMEOUT_MS + 2_000 });
  if (result.exitCode !== 0) throw new Error(`cli_catalog_exit_${result.exitCode}`);
  return parseCodexCliModels(result.stdout);
}

function cacheKey(executor: Executor, config: AssistantConfig, providerId: AssistantProviderId): string {
  const slot = config.providers[providerId];
  // A catalogue may include the configured model when the provider cannot list
  // its own inventory. Keep CLI login/install state and both configured model
  // values in the cache identity so a credentials or `/model` change takes
  // effect immediately instead of inheriting a stale five-minute catalogue.
  const identity = slot.mode === "api"
    ? `${slot.api?.apiKey ?? ""}\0${slot.api?.baseUrl ?? ""}\0${slot.api?.model ?? ""}`
    : `${slot.cli?.installed ? "1" : "0"}\0${slot.cli?.loggedIn ? "1" : "0"}\0${slot.cli?.model ?? ""}\0${slot.cli?.binPath ?? ""}\0${slot.cli?.version ?? ""}`;
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
    const ready = Boolean(slot.cli?.installed && slot.cli?.loggedIn);
    if (!ready) {
      const catalog: ProviderModelCatalog = {
        providerId, mode: slot.mode, status: "unavailable", source: "cli", checkedAt, models: [],
        reason: slot.cli?.installed ? "provider_authorization_failed" : "provider_unavailable",
      };
      cache.set(key, { expiresAt: Date.now() + TTL_MS, catalog });
      return catalog;
    }
    try {
      const models = await listCliModels(executor, providerId, slot.cli?.binPath);
      const catalog: ProviderModelCatalog = {
        providerId, mode: slot.mode, status: "verified", source: "cli", checkedAt, models,
      };
      cache.set(key, { expiresAt: Date.now() + TTL_MS, catalog });
      return catalog;
    } catch {
      // A configured/default CLI model is not proof of entitlement. Do not
      // advertise it when the target CLI cannot produce its own inventory.
      const catalog: ProviderModelCatalog = {
        providerId, mode: slot.mode, status: "unavailable", source: "cli", checkedAt, models: [],
        reason: "provider_unavailable",
      };
      cache.set(key, { expiresAt: Date.now() + Math.min(TTL_MS, 30_000), catalog });
      return catalog;
    }
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
  const available = catalog.status === "verified"
    ? catalog.models.filter((entry) => entry.available)
    : [];
  if (preferred && available.some((entry) => entry.id === preferred)) return { model: preferred, fallback: false };
  const providerDefault = DEFAULT_PROVIDER_MODEL[providerId];
  const fallback = available.find((entry) => entry.isDefault)?.id
    ?? available.find((entry) => entry.id === providerDefault)?.id
    ?? available[0]?.id;
  return { model: fallback, fallback: Boolean(fallback && fallback !== preferred) };
}

export function fallbackModelIds(catalog: ProviderModelCatalog, providerId: AssistantProviderId, excluded: readonly string[] = []): string[] {
  const excludedSet = new Set(excluded);
  const candidates = catalog.status === "verified"
    ? catalog.models.filter((entry) => entry.available).map((entry) => entry.id)
    : [];
  const providerDefault = DEFAULT_PROVIDER_MODEL[providerId];
  const nativeDefault = catalog.models.find((entry) => entry.available && entry.isDefault)?.id;
  const ordered = [...(nativeDefault ? [nativeDefault] : []), ...(candidates.includes(providerDefault) ? [providerDefault] : []), ...candidates];
  return [...new Set(ordered.filter((id) => id && !excludedSet.has(id)))].slice(0, 2);
}

export function isExplicitModelUnavailable(message: string): boolean {
  return /(?:model|deployment|engine).{0,80}(?:not found|does not exist|unavailable|not available|unsupported|not supported|unknown)|(?:not found|does not exist|unavailable|not available|unsupported|not supported|unknown).{0,80}(?:model|deployment|engine)/i.test(message);
}
