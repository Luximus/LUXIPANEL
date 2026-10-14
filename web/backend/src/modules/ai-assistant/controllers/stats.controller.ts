// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — usage statistics.
 *
 *   GET /api/ai/stats/usage   filtered + sorted usage records (datatable)
 *   GET /api/ai/stats/daily   daily token aggregation (chart)
 *   GET /api/ai/stats/models  distinct model names (filter dropdown)
 *
 * Filters (query params): provider, model, from (YYYY-MM-DD), to,
 * userId, conversationId, projectId, sort (asc|desc), limit, offset.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { usageRepository, type UsageFilter } from "../repositories/usage.repository.js";
import { fetchCliAccountUsage } from "../services/cli-account-usage.service.js";
import { estimateCost } from "../services/pricing.js";

/** A query param as a string, or undefined when absent/non-string. */
function strQuery(req: Request, key: string): string | undefined {
  return typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;
}

function parseFilter(req: Request): UsageFilter {
  const q = req.query;
  const str = (k: string) => (typeof q[k] === "string" && q[k] ? (q[k] as string) : undefined);
  return {
    provider: str("provider"),
    mode: str("mode") === "api" ? "api" : str("mode") === "cli" ? "cli" : undefined,
    model: str("model"),
    from: str("from"),
    to: str("to"),
    userId: str("userId"),
    conversationId: str("conversationId"),
    projectId: str("projectId"),
    sortBy: ["ts","model","mode","inputTokens","outputTokens","totalTokens"].includes(str("sortBy") ?? "") ? str("sortBy") as UsageFilter["sortBy"] : undefined,
    sort: str("sort") === "asc" ? "asc" : "desc",
    limit: q["limit"] ? Number(q["limit"]) : undefined,
    offset: q["offset"] ? Number(q["offset"]) : undefined,
  };
}

export const statsController = {
  usage: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const result = await usageRepository.query(executor, parseFilter(req));
    res.json({ ok: true, ...result });
  }),

  daily: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const series = await usageRepository.daily(executor, parseFilter(req));
    res.json({ ok: true, series });
  }),

  models: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const models = await usageRepository.models(executor);
    res.json({ ok: true, models });
  }),

  /**
   * Estimated metered-API cost ("ClaudeBar" style): per-(provider,model,mode)
   * token totals × the model's USD rate. Honors the same filters as the rest.
   * Costs ALL usage (api + cli) so the value answers "what this would cost on the
   * paid API" even when running through a CLI/subscription. Rates are estimates.
   */
  cost: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const groups = await usageRepository.byModel(executor, parseFilter(req));
    const models = groups.map((g) => {
      const c = estimateCost(g.provider, g.model, g.inputTokens, g.outputTokens);
      return {
        provider: g.provider,
        model: g.model,
        mode: g.mode,
        inputTokens: g.inputTokens,
        outputTokens: g.outputTokens,
        total: g.total,
        count: g.count,
        inputUsd: c.inputUsd,
        outputUsd: c.outputUsd,
        usd: c.usd,
        inputPerM: c.rate.inputPerM,
        outputPerM: c.rate.outputPerM,
        known: c.known,
      };
    });
    const totalUsd = models.reduce((s, m) => s + m.usd, 0);
    const byProviderMap = new Map<string, { provider: string; usd: number; inputTokens: number; outputTokens: number }>();
    for (const m of models) {
      const e = byProviderMap.get(m.provider) ?? { provider: m.provider, usd: 0, inputTokens: 0, outputTokens: 0 };
      e.usd += m.usd;
      e.inputTokens += m.inputTokens;
      e.outputTokens += m.outputTokens;
      byProviderMap.set(m.provider, e);
    }
    res.json({
      ok: true,
      totalUsd,
      models: [...models].sort((a, b) => b.usd - a.usd),
      byProvider: [...byProviderMap.values()].sort((a, b) => b.usd - a.usd),
    });
  }),

  /** Headroom token-savings aggregate (raw vs sent input + tokens saved). */
  savings: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const savings = await usageRepository.savings(executor, parseFilter(req));
    res.json({ ok: true, savings });
  }),

  /** Rolling total / daily / weekly summary for the CLI usage bars. */
  summary: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const provider = strQuery(req, "provider");
    const modeQ = strQuery(req, "mode");
    const mode = modeQ === "api" || modeQ === "cli" ? modeQ : undefined;
    const summary = await usageRepository.summary(executor, { provider, mode });
    res.json({ ok: true, summary });
  }),

  /**
   * Real account quota for the CLI usage bars — the actual session (≈5h) and
   * weekly utilization Claude Code shows in `/usage`, fetched live from the
   * connected server's authenticated `claude`. `quota` is null for providers
   * with no equivalent (codex/gemini) or when the box isn't logged in; the
   * frontend then falls back to the local estimate bars.
   */
  cliQuota: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const provider = strQuery(req, "provider") ?? "claude";
    const quota = await fetchCliAccountUsage(executor, provider);
    res.json({ ok: true, quota });
  }),

  /**
   * Distinct `userId`s observed in the usage sidecar, optionally scoped to a
   * provider. Drives the "user" filter combobox on /panel/assistant > Stats.
   * Reads straight from the same data the rest of /stats/* reads so it
   * inherits executor tenant scoping and stays in sync without any extra
   * permission path.
   */
  users: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const users = await usageRepository.users(executor, strQuery(req, "provider"));
    res.json({ ok: true, users });
  }),
};
