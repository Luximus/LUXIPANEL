// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** StatsTab pure helpers + chart-type union — extracted verbatim. */
import { fmtTokens } from "@/lib/format";
import type { UsageStatsFilter } from "../assistant-api";

export type UsageChartType = "bar" | "line" | "heatmap";

export function fmtUsd(usd: number): string {
  if (!usd) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact token counts: 1234 → 1.2K, 1_200_000 → 1.2M (F-20: shared impl,
 *  one decimal and the uppercase "K" this tab has always used). */
export function compact(n: number): string {
  return fmtTokens(n, { decimals: 1, kilo: "K" });
}


export function previousPeriodFilter(
  from: string,
  other: Omit<UsageStatsFilter, "from" | "to">,
  now: Date = new Date(),
): UsageStatsFilter {
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let curStart: number;
  let curEnd: number;
  if (from) {
    const [y, m, d] = from.split("-").map(Number);
    curStart = Date.UTC(y, m - 1, d);
    curEnd = todayMs;
  } else {
    curEnd = todayMs;
    curStart = curEnd - 30 * 86_400_000;
  }
  const length = Math.max(curEnd - curStart, 86_400_000);
  const prevEnd = curStart - 86_400_000;
  const prevStart = prevEnd - length;
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  return {
    ...other,
    from: fmt(prevStart),
    to: fmt(prevEnd),
    limit: 1,
  };
}

/**
 * Provider-token usage history table. Built on top of the LUXIPANEL
 * `DataTable` component (sorting, filtering, totals, pagination, value
 * badges) so this view inherits the rest of the panel's interaction
 * patterns automatically.
 *
 * Keyed by provider so switching Claude→Codex resets pagination and
 * column config without leaking state across providers.
 */
