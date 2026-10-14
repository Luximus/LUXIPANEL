// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap, resolveTargetScope, scopeHeaders } from "@/lib/api-client";
import { browserReadCache } from "@/lib/read-cache";
import type { ConversationMeta } from "./conversations";

// ── Usage statistics ──────────────────────────────────────────────────────

export interface UsageRecord {
  id?: string;
  ts: string;
  provider: string;
  mode: "api" | "cli";
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated: boolean;
  conversationId?: string | null;
  projectId?: string | null;
  userId?: string | null;
}

export interface UsageDaily {
  day: string;
  inputTokens: number;
  outputTokens: number;
  total: number;
  count: number;
}

export interface UsageSavings {
  /** Input tokens that WOULD have been sent without Headroom. */
  rawInput: number;
  /** Input tokens actually sent (after compression). */
  sentInput: number;
  /** rawInput − sentInput. */
  savedTokens: number;
  /** Number of usage records where Headroom applied. */
  calls: number;
}

export interface UsageCostModel {
  provider: string;
  model: string;
  mode: "api" | "cli";
  inputTokens: number;
  outputTokens: number;
  total: number;
  count: number;
  inputUsd: number;
  outputUsd: number;
  usd: number;
  /** USD per 1M input/output tokens (the rate applied). */
  inputPerM: number;
  outputPerM: number;
  /** false = fell back to a provider/global default rate (rougher estimate). */
  known: boolean;
}

export interface UsageCost {
  /** Estimated metered-API cost in USD across all matched usage. */
  totalUsd: number;
  models: UsageCostModel[];
  byProvider: Array<{ provider: string; usd: number; inputTokens: number; outputTokens: number }>;
}

export interface UsageStatsFilter {
  provider?: string;
  mode?: "api" | "cli";
  model?: string;
  from?: string;
  to?: string;
  userId?: string;
  conversationId?: string;
  projectId?: string;
  sort?: "asc" | "desc";
  sortBy?: "ts" | "model" | "mode" | "inputTokens" | "outputTokens" | "totalTokens";
  limit?: number;
  offset?: number;
}

function statsQs(f: UsageStatsFilter): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  return p.toString();
}

export const assistantStatsApi = {
  async usage(f: UsageStatsFilter = {}): Promise<{ items: UsageRecord[]; total: number; totals?: {input:number;output:number;total:number} }> {
    const res = await api.get<{ ok: boolean; items: UsageRecord[]; total: number; totals?: {input:number;output:number;total:number} }>(`/api/ai/stats/usage?${statsQs(f)}`);
    const data = unwrap(res, "Failed to load usage");
    return { items: data.items, total: data.total, totals:data.totals };
  },
  async daily(f: UsageStatsFilter = {}): Promise<UsageDaily[]> {
    const res = await api.get<{ ok: boolean; series: UsageDaily[] }>(`/api/ai/stats/daily?${statsQs(f)}`);
    return unwrap(res, "Failed to load daily stats").series;
  },
  async models(): Promise<string[]> {
    const res = await api.get<{ ok: boolean; models: string[] }>("/api/ai/stats/models");
    return unwrap(res, "Failed to load models").models;
  },
  /** Headroom token-savings aggregate. Returns zeros when Headroom never applied. */
  async savings(f: UsageStatsFilter = {}): Promise<UsageSavings> {
    const res = await api.get<{ ok: boolean; savings: UsageSavings }>(`/api/ai/stats/savings?${statsQs(f)}`);
    if (!res.ok || !res.data) return { rawInput: 0, sentInput: 0, savedTokens: 0, calls: 0 };
    return res.data.savings;
  },
  /** Estimated metered-API cost (USD) per model. Zeros when no usage. */
  async cost(f: UsageStatsFilter = {}): Promise<UsageCost> {
    const res = await api.get<{ ok: boolean } & UsageCost>(`/api/ai/stats/cost?${statsQs(f)}`);
    if (!res.ok || !res.data) return { totalUsd: 0, models: [], byProvider: [] };
    return { totalUsd: res.data.totalUsd, models: res.data.models, byProvider: res.data.byProvider };
  },
  async summary(provider?: string, mode?: "api" | "cli"): Promise<UsageSummary> {
    const qs = statsQs({ provider, ...(mode ? { mode } : {}) } as UsageStatsFilter & { mode?: string });
    const res = await api.get<{ ok: boolean; summary: UsageSummary }>(`/api/ai/stats/usage-summary?${qs}`);
    return unwrap(res, "Failed to load usage summary").summary;
  },
  /** Real account quota (Claude `/usage`). Null when unavailable → caller falls back to `summary`. */
  async cliQuota(provider?: string, fresh = false): Promise<CliQuota | null> {
    const qs = statsQs({ provider } as UsageStatsFilter);
    const path = `/api/ai/stats/cli-quota?${qs}`;
    const scope = () => JSON.stringify([resolveTargetScope(), scopeHeaders(true),
      document.getElementById("messenger-link")?.getAttribute("data-me"), document.documentElement.lang]);
    const initialScope = typeof window !== "undefined" ? scope() : "ssr";
    const load = () => api.get<{ ok: boolean; quota: CliQuota | null }>(path);
    // Share successful AND unavailable readings for one minute; no persistence.
    // Explicit refresh bypasses settled values while sharing an in-flight read.
    const res = typeof window === "undefined" ? await load() : await browserReadCache().read(
      JSON.stringify(["cli-quota-v1", initialScope, path]), load, 60_000, fresh);
    if (typeof window !== "undefined" && scope() !== initialScope) return null;
    if (!res.ok || !res.data) return null;
    return res.data.quota;
  },
};

export interface CliQuotaWindow {
  /** 0–100 utilization percentage, as reported by the account. */
  utilization: number;
  /** ISO reset time, or null when the window doesn't report one. */
  resetsAt: string | null;
}

export interface CliQuota {
  provider: string;
  /** Rolling session window (Claude ≈ 5h). */
  fiveHour: CliQuotaWindow | null;
  /** Rolling 7-day window (all models). */
  sevenDay: CliQuotaWindow | null;
  sevenDayOpus: CliQuotaWindow | null;
  sevenDaySonnet: CliQuotaWindow | null;
  source: "account";
}

export interface UsageWindow {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  count: number;
}

export interface UsageSummary {
  provider?: string;
  mode?: "api" | "cli";
  /** Rolling current-session window (resets as usage ages past `sessionHours`). */
  session: UsageWindow;
  /** Rolling last 7 days. */
  weekly: UsageWindow;
  /** Length of the rolling session window, in hours. */
  sessionHours: number;
  budgets: { session: number; weekly: number };
  estimated: boolean;
}

// ── Distinct users + chats seen (for stats filters) ──────────────────────

/**
 * One option for the "user" filter on the stats tab. Backed by the distinct
 * `userId` values that the usage ledger has actually seen, scoped to the
 * current provider so irrelevant users don't clutter the picker.
 */
export interface AssistantUserOption {
  id: string;
  username: string;
}

export const assistantUsersApi = {
  /**
   * Distinct userIds observed in the usage sidecar for this provider. Same
   * field that the `userId` filter passes straight through to the backend.
   */
  async list(provider?: string): Promise<AssistantUserOption[]> {
    const qs = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    const res = await api.get<{ ok: boolean; users: string[] }>(`/api/ai/stats/users${qs}`).catch(() => null);
    if (!res?.ok || !Array.isArray(res.data?.users)) return [];
    return res.data.users.map((id: string) => ({ id, username: id }));
  },
};

/**
 * Lightweight chat option for the "chat" filter on /panel/assistant > Stats.
 * Backed by `/api/ai/conversations`, optionally scoped to a project so the
 * picker only lists chats the user could plausibly match.
 */
export interface AssistantChatOption {
  id: string;
  title: string;
}

export const assistantChatsApi = {
  /**
   * List conversations for the picker. `projectId === undefined` → all;
   * `projectId === null` → only loose chats (no project); any string →
   * chats belonging to that project. Same conventions as the backend
   * route. The provider scope is honored so the picker doesn't show
   * Claude chats while the user filters by Gemini.
   */
  async list(opts: { provider?: string; projectId?: string | null; search?: string } = {}): Promise<AssistantChatOption[]> {
    const params = new URLSearchParams();
    if (opts.provider) params.set("provider", opts.provider);
    if (opts.projectId !== undefined) params.set("projectId", opts.projectId ?? "none");
    if (opts.search) params.set("q", opts.search);
    params.set("limit", "200");
    const res = await api.get<{ ok: boolean; items: ConversationMeta[]; total: number }>(
      `/api/ai/conversations?${params.toString()}`,
    ).catch(() => null);
    if (!res?.ok || !Array.isArray(res.data?.items)) return [];
    return res.data.items.map((c) => ({ id: String(c.id ?? ""), title: c.title || "(sin título)" }));
  },
};
