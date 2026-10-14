// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableI18n,
  type DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { type UsageStatsFilter } from "../assistant-api";
import { useAssistantI18n } from "../i18n";

export function CostDelta({
  current,
  prev,
  t,
}: {
  current: number;
  prev: number | null;
  t: ReturnType<typeof useAssistantI18n>["statsTab"];
}) {
  const hasPrev = prev !== null && Number.isFinite(prev) && (prev as number) > 0;
  if (!hasPrev) {
    return null;
  }
  const pct = ((current - (prev as number)) / (prev as number)) * 100;
  const abs = Math.abs(pct);
  let text = pct >= 0
    ? (t.deltaUp ?? "+{pct}%").replace("{pct}", abs.toFixed(2))
    : (t.deltaDown ?? "{pct}%").replace("{pct}", abs.toFixed(2));
  let cls = "bg-muted text-muted-foreground";
  let arrow = "";
  if (pct > 0) {
    cls = "bg-rose-500/15 text-rose-600"; // cost ↑ = bad (rose)
    arrow = "↑";
  } else if (pct < 0) {
    cls = "bg-emerald-500/15 text-emerald-600"; // cost ↓ = good (emerald)
    arrow = "↓";
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${cls}`}>
      {arrow && <span aria-hidden>{arrow}</span>}
      <span>{text}</span>
    </span>
  );
}

/**
 * Compact KPI card with a delta-vs-prior-period pill, matching the
 * "Total Subscribers / Avg. Open Rate" pattern: label on top, big value,
 * "from {prev}" + green ↑ or red ↓ pill on the right.
 *
 * `format` controls how `current` and `prev` render (defaults to a token
 * integer with thousands separators). When the previous period is empty /
 * unknown we HIDE both the pill and the "from {prev}" footer — the card
 * just shows the current value alone instead of a placeholder label.
 */
export function StatDelta({
  label,
  current,
  prev,
  highlight,
  format,
  t,
}: {
  label: string;
  current: number;
  prev: number | null;
  highlight?: boolean;
  format?: (n: number) => string;
  t: ReturnType<typeof useAssistantI18n>["statsTab"];
}) {
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const hasPrev = prev !== null && Number.isFinite(prev) && (prev as number) > 0;
  let pctText = "";
  let pillClass = "bg-muted text-muted-foreground";
  let arrow = "";
  if (hasPrev) {
    const pct = ((current - (prev as number)) / (prev as number)) * 100;
    const abs = Math.abs(pct);
    pctText = pct >= 0
      ? (t.deltaUp ?? "+{pct}%").replace("{pct}", abs.toFixed(2))
      : (t.deltaDown ?? "{pct}%").replace("{pct}", abs.toFixed(2));
    if (pct > 0) {
      pillClass = "bg-emerald-500/15 text-emerald-600";
      arrow = "↑";
    } else if (pct < 0) {
      pillClass = "bg-rose-500/15 text-rose-600";
      arrow = "↓";
    } else {
      pillClass = "bg-muted text-muted-foreground";
    }
  }
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-base font-semibold tabular-nums">{fmt(current)}</p>
        {hasPrev && (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${pillClass}`}>
            <span aria-hidden>{arrow}</span>
            <span>{pctText}</span>
          </span>
        )}
      </div>
      {hasPrev && (
        <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
          {(t.deltaFrom ?? "vs {prev}").replace("{prev}", fmt(prev as number))}
        </p>
      )}
    </div>
  );
}

/**
 * Build a `UsageStatsFilter` for the period that ends the day BEFORE `from`
 * and has the same length as the current window (today − from). Used to
 * render the "from X, ↑Y%" pills on the KPI cards.
 *
 * If `from` is empty we treat the current window as the trailing 30 days and
 * the previous window as the 30 days before that — so the comparison always
 * exists, even without an explicit filter.
 */
