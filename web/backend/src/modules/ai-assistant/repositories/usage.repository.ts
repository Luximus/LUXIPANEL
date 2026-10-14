// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-target token-usage ledger for the assistant.
 *
 * Sidecar: `${LUXIPANEL_CONFIG_DIR}/assistant/usage.json`.
 * One record per provider response (API usage or CLI estimate). Bounded to
 * MAX_RECORDS most-recent entries so the file stays manageable.
 */

import { env } from "../../../config/env.js";
import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-usage");
const MAX_RECORDS = 2000;

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
  /** Input tokens the Headroom layer removed from tool outputs for this record
   *  (already excluded from `inputTokens`). Absent/0 when Headroom didn't apply. */
  headroomSavedTokens?: number;
  conversationId?: string | null;
  projectId?: string | null;
  userId?: string | null;
}

export interface UsageFilter {
  provider?: string;
  mode?: "api" | "cli";
  model?: string;
  /** ISO day (YYYY-MM-DD) lower bound (inclusive). */
  from?: string;
  /** ISO day upper bound (inclusive). */
  to?: string;
  userId?: string;
  conversationId?: string;
  projectId?: string;
  sort?: "asc" | "desc";
  sortBy?: "ts" | "model" | "mode" | "inputTokens" | "outputTokens" | "totalTokens";
  limit?: number;
  offset?: number;
}

const MODULE = "assistant";
const COLLECTION = "usage";

/** One usage window (total / daily / weekly) for the CLI progress bars. */
export interface UsageWindow {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  count: number;
}

export interface UsageSummary {
  provider?: string;
  mode?: "api" | "cli";
  /**
   * Rolling current-session window. Mirrors the provider's session quota
   * (Claude resets every ~5h), so usage ages out and the bar visibly drops
   * back down once you stop — unlike a calendar-day total that only grows.
   */
  session: UsageWindow;
  /** Rolling last 7 days. */
  weekly: UsageWindow;
  /** Length of the rolling session window, in hours (for the UI label). */
  sessionHours: number;
  /** Token budgets the UI fills each bar against (display-only, not plan limits). */
  budgets: { session: number; weekly: number };
  /** True when the counted tokens include estimates (codex/gemini, or legacy). */
  estimated: boolean;
}

/**
 * Rolling session window length, in hours. Mirrors the provider session quota
 * reset cadence (Claude ≈ 5h). Override via env.
 */
const SESSION_WINDOW_HOURS = env.ASSISTANT_USAGE_SESSION_HOURS;

/**
 * Display budgets for the progress bars. These are NOT real provider plan
 * limits (the CLIs don't expose those in headless output) — just sensible
 * denominators so the bars convey relative consumption. Override via env.
 */
const USAGE_BUDGETS = {
  session: env.ASSISTANT_USAGE_BUDGET_SESSION,
  weekly: env.ASSISTANT_USAGE_BUDGET_WEEKLY,
};

function emptyWindow(): UsageWindow {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, count: 0 };
}

function addToWindow(w: UsageWindow, r: UsageRecord): void {
  w.inputTokens += r.inputTokens;
  w.outputTokens += r.outputTokens;
  w.totalTokens += r.totalTokens;
  w.count += 1;
}

function store(executor?: Executor | null) {
  return dataStore<UsageRecord>(executor, MODULE, COLLECTION, { idStrategy: "uuid", timestamps: false });
}

/** Shared record predicate for `query` and `daily` (pagination handled separately). */
function matchesFilter(r: UsageRecord, filter: UsageFilter): boolean {
  if (filter.provider && r.provider.split(":")[0] !== filter.provider) return false;
  if (filter.mode && r.mode !== filter.mode) return false;
  if (filter.model && r.model !== filter.model) return false;
  if (filter.userId && (r.userId ?? "") !== filter.userId) return false;
  if (filter.conversationId && (r.conversationId ?? "") !== filter.conversationId) return false;
  if (filter.projectId && (r.projectId ?? "") !== filter.projectId) return false;
  if (filter.from && r.ts.slice(0, 10) < filter.from) return false;
  if (filter.to && r.ts.slice(0, 10) > filter.to) return false;
  return true;
}

export const usageRepository = {
  async record(rec: Omit<UsageRecord, "id" | "totalTokens">, executor?: Executor | null): Promise<void> {
    try {
      const ds = store(executor);
      await ds.create({ ...rec, totalTokens: rec.inputTokens + rec.outputTokens });
      // Retention trim. Only when over the cap, and then in ONE atomic rewrite
      // of the whole map instead of N per-record deletes (N SFTP round-trips).
      // Same semantics: keep the MAX_RECORDS most-recent by `ts`, drop the rest.
      if ((await ds.count()) > MAX_RECORDS) {
        await ds.transaction(async (current) => {
          const sorted = Object.keys(current)
            .map((id) => ({ id, ts: (current[id] as UsageRecord | undefined)?.ts ?? "" }))
            .sort((a, b) => (a.ts < b.ts ? -1 : 1));
          if (sorted.length <= MAX_RECORDS) return { next: current, result: undefined };
          const next: Record<string, UsageRecord> = {};
          for (const { id } of sorted.slice(sorted.length - MAX_RECORDS)) {
            next[id] = current[id]!;
          }
          return { next, result: undefined };
        });
      }
    } catch (err) {
      log.warn({ err }, "Failed to record usage");
    }
  },

  /** Filtered + sorted records (for the datatable). */
  async query(
    executor: Executor | null | undefined,
    filter: UsageFilter = {},
  ): Promise<{ items: UsageRecord[]; total: number; totals: {input:number;output:number;total:number} }> {
    const all = await store(executor).list();
    const items = all.filter((r) => matchesFilter(r, filter));
    const dir = filter.sort === "asc" ? 1 : -1;
    const key = filter.sortBy ?? "ts";
    items.sort((a, b) => {
      const left=a[key], right=b[key];
      const difference=typeof left === "number" && typeof right === "number" ? left-right : String(left).localeCompare(String(right),undefined,{numeric:true});
      return dir*difference || a.ts.localeCompare(b.ts) || String(a.id).localeCompare(String(b.id));
    });
    const total = items.length;
    const offset = Math.max(0, filter.offset ?? 0);
    const limit = Math.max(1, Math.min(500, filter.limit ?? 100));
    const totals=items.reduce((sum,row)=>({input:sum.input+row.inputTokens,output:sum.output+row.outputTokens,total:sum.total+row.totalTokens}),{input:0,output:0,total:0});
    return { items: items.slice(offset, offset + limit), total, totals };
  },

  /**
   * Token totals per conversation, for a SET of conversations in one sidecar
   * read (the team summary aggregates the leader chat + every worker chat —
   * a per-conversation `query()` would re-read the store N times).
   */
  async totalsForConversations(
    executor: Executor | null | undefined,
    conversationIds: string[],
  ): Promise<Map<string, { inputTokens: number; outputTokens: number; totalTokens: number; count: number; estimated: boolean }>> {
    const wanted = new Set(conversationIds);
    const out = new Map<string, { inputTokens: number; outputTokens: number; totalTokens: number; count: number; estimated: boolean }>();
    const all = await store(executor).list();
    for (const r of all) {
      const cid = r.conversationId ?? "";
      if (!cid || !wanted.has(cid)) continue;
      const e = out.get(cid) ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0, count: 0, estimated: false };
      e.inputTokens += r.inputTokens;
      e.outputTokens += r.outputTokens;
      e.totalTokens += r.totalTokens;
      e.count += 1;
      e.estimated = e.estimated || r.estimated;
      out.set(cid, e);
    }
    return out;
  },

  /**
   * Daily aggregation for charts: { day, inputTokens, outputTokens, total, count }.
   * Honors the same filters (except pagination).
   */
  async daily(
    executor: Executor | null | undefined,
    filter: UsageFilter = {},
  ): Promise<Array<{ day: string; inputTokens: number; outputTokens: number; total: number; count: number }>> {
    // query() caps at 500; for charts pull the full set instead.
    const all = await store(executor).list();
    const filtered = all.filter((r) => matchesFilter(r, filter));
    const byDay = new Map<string, { inputTokens: number; outputTokens: number; total: number; count: number }>();
    for (const r of filtered) {
      const day = r.ts.slice(0, 10);
      const e = byDay.get(day) ?? { inputTokens: 0, outputTokens: 0, total: 0, count: 0 };
      e.inputTokens += r.inputTokens;
      e.outputTokens += r.outputTokens;
      e.total += r.totalTokens;
      e.count += 1;
      byDay.set(day, e);
    }
    return [...byDay.entries()]
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));
  },

  /**
   * Per-(provider, model, mode) token aggregation — feeds the estimated-API-cost
   * view. Honors the same filters (except pagination). Pricing is applied by the
   * controller (token aggregation stays pricing-agnostic here).
   */
  async byModel(
    executor: Executor | null | undefined,
    filter: UsageFilter = {},
  ): Promise<Array<{ provider: string; model: string; mode: "api" | "cli"; inputTokens: number; outputTokens: number; total: number; count: number }>> {
    const all = await store(executor).list();
    const filtered = all.filter((r) => matchesFilter(r, filter));
    const by = new Map<string, { provider: string; model: string; mode: "api" | "cli"; inputTokens: number; outputTokens: number; total: number; count: number }>();
    for (const r of filtered) {
      const provider = r.provider.split(":")[0] ?? r.provider;
      const model = r.model || "(desconocido)";
      const mode = r.mode === "cli" ? "cli" : "api";
      const key = `${provider}|${model}|${mode}`;
      const e = by.get(key) ?? { provider, model, mode, inputTokens: 0, outputTokens: 0, total: 0, count: 0 };
      e.inputTokens += r.inputTokens;
      e.outputTokens += r.outputTokens;
      e.total += r.totalTokens;
      e.count += 1;
      by.set(key, e);
    }
    return [...by.values()].sort((a, b) => b.total - a.total);
  },

  /**
   * Rolling session (≈5h) / weekly (7d) aggregation for the CLI usage bars.
   * Optionally scoped to a provider and/or mode. Computed off ISO `ts`
   * lexicographic comparison (records are UTC ISO). The windows are rolling,
   * so as records age past the cutoff they drop out and the bars fall back
   * down — matching how the provider's session/weekly quotas reset.
   */
  async summary(
    executor: Executor | null | undefined,
    opts: { provider?: string; mode?: "api" | "cli" } = {},
  ): Promise<UsageSummary> {
    const all = await store(executor).list();
    const now = Date.now();
    const sessionCut = new Date(now - SESSION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const weekCut = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const session = emptyWindow();
    const weekly = emptyWindow();
    let estimated = false;
    for (const r of all) {
      if (opts.provider && r.provider.split(":")[0] !== opts.provider) continue;
      if (opts.mode && r.mode !== opts.mode) continue;
      // Estimated flag is window-scoped: only flag it from records that still
      // count toward a visible bar, not ones already aged out of both windows.
      if (r.ts < weekCut) continue;
      if (r.estimated) estimated = true;
      addToWindow(weekly, r);
      if (r.ts >= sessionCut) addToWindow(session, r);
    }
    return {
      provider: opts.provider,
      mode: opts.mode,
      session,
      weekly,
      sessionHours: SESSION_WINDOW_HOURS,
      budgets: USAGE_BUDGETS,
      estimated,
    };
  },

  /**
   * Headroom savings aggregate (honors the same filters as `query`, minus
   * pagination). `sentInput` is what actually went to the model; `rawInput` adds
   * back the tokens Headroom removed → the difference is the saving.
   */
  async savings(
    executor: Executor | null | undefined,
    filter: UsageFilter = {},
  ): Promise<{ rawInput: number; sentInput: number; savedTokens: number; calls: number }> {
    const all = await store(executor).list();
    const acc = { rawInput: 0, sentInput: 0, savedTokens: 0, calls: 0 };
    for (const r of all) {
      if (!matchesFilter(r, filter)) continue;
      const saved = r.headroomSavedTokens ?? 0;
      if (saved <= 0) continue;
      acc.sentInput += r.inputTokens;
      acc.rawInput += r.inputTokens + saved;
      acc.savedTokens += saved;
      acc.calls += 1;
    }
    return acc;
  },

  /** Distinct models seen (for the filter dropdown). */
  async models(executor?: Executor | null): Promise<string[]> {
    const all = await store(executor).list();
    return [...new Set(all.map((r) => r.model))].sort();
  },

  /**
   * Distinct `userId`s recorded in the usage sidecar, optionally scoped to a
   * provider. Feeds the "user" filter on /panel/assistant > Stats so users
   * never see a free-text id input. Skips blank/`null` IDs.
   */
  async users(
    executor: Executor | null | undefined,
    provider?: string,
  ): Promise<string[]> {
    const all = await store(executor).list();
    const set = new Set<string>();
    for (const r of all) {
      const id = (r.userId ?? "").trim();
      if (!id) continue;
      if (provider && r.provider.split(":")[0] !== provider) continue;
      set.add(id);
    }
    return [...set].sort();
  },
};
