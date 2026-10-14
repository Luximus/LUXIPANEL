// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
// Type-only (erased at build): the runtime Chart is dynamically imported inside
// the effect so chart.js is not bundled into every panel page.
import type ChartJs from "chart.js/auto";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableI18n,
  type DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { type UsageDaily } from "../assistant-api";
import { useAssistantI18n } from "../i18n";
import { type UsageChartType } from "./helpers";

export function BarChart({ series }: { series: UsageDaily[] }) {
  const t = useAssistantI18n().statsTab;
  const max = Math.max(1, ...series.map((s) => s.total));
  const W = 480;
  const H = 120;
  const pad = 4;
  const bw = Math.max(2, (W - pad * 2) / series.length - 2);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" preserveAspectRatio="none">
      {series.map((s, i) => {
        const x = pad + i * ((W - pad * 2) / series.length);
        const inH = (s.inputTokens / max) * H;
        const outH = (s.outputTokens / max) * H;
        return (
          <g key={s.day}>
            <title>{`${s.day}: ${s.total.toLocaleString()} ${t.chartTokens} (${s.count} ${t.callsSuffix})`}</title>
            <rect x={x} y={H - outH} width={bw} height={outH} className="fill-emerald-500/70" />
            <rect x={x} y={H - outH - inH} width={bw} height={inH} className="fill-primary/70" />
          </g>
        );
      })}
      {series.length <= 14 && series.map((s, i) => {
        const x = pad + i * ((W - pad * 2) / series.length) + bw / 2;
        return (
          <text key={s.day} x={x} y={H + 12} textAnchor="middle" className="fill-muted-foreground text-[7px]">
            {s.day.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Multi-mode usage chart for assistant stats: stacked bars, trend line, or
 * GitHub-style 365-day heatmap. Mirrors the data-usage chart pattern so the
 * three visualisation modes feel consistent across settings and stats.
 *
 * - `bar`/`line`: rendered via Chart.js (one instance kept on a ref, recreated
 *   when the series or the active type changes).
 * - `heatmap`: pure CSS grid (52–53 week columns × 7 day rows), with explicit
 *   `grid-column`/`grid-row` per cell to avoid any browser reflow ambiguity.
 *   Cells outside the `rangeFrom` filter are dimmed so the active filter is
 *   visible at a glance.
 */
export function UsageChart({ series, type, rangeFrom }: { series: UsageDaily[]; type: UsageChartType; rangeFrom: string | null }) {
  const t = useAssistantI18n().statsTab;
  if (type === "heatmap") return <Heatmap series={series} rangeFrom={rangeFrom} />;
  return <BarLineChart series={series} type={type} />;
}

export function BarLineChart({ series, type }: { series: UsageDaily[]; type: "bar" | "line" }) {
  const t = useAssistantI18n().statsTab;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartJs | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void (async () => {
      // Lazy-load chart.js (~208 KB) only when a bar/line chart actually mounts
      // (Settings → Estadísticas). It used to be a static top-level import
      // pulled into every panel page bundle via the FloatingAssistant island.
      const { default: Chart } = await import("chart.js/auto");
      if (cancelled) return;
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      const labels = series.map((s) => s.day.slice(5));
      const inputData = series.map((s) => s.inputTokens);
      const outputData = series.map((s) => s.outputTokens);
      const totalData = series.map((s) => s.total);

    if (type === "line") {
      chartRef.current = new Chart(canvasEl, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: t.chartTotalLabel, data: totalData, borderColor: "rgba(14,165,233,1)", backgroundColor: "rgba(14,165,233,0.10)", borderWidth: 2, tension: 0.35, fill: true, pointRadius: 2, pointHoverRadius: 5 },
            { label: t.chartInputLabel, data: inputData, borderColor: "rgba(99,102,241,1)", backgroundColor: "rgba(99,102,241,0.05)", borderWidth: 1.5, borderDash: [4, 3], tension: 0.3, fill: false, pointRadius: 0, pointHoverRadius: 4 },
            { label: t.chartOutputLabel, data: outputData, borderColor: "rgba(16,185,129,1)", backgroundColor: "rgba(16,185,129,0.05)", borderWidth: 1.5, borderDash: [4, 3], tension: 0.3, fill: false, pointRadius: 0, pointHoverRadius: 4 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 }, grid: { display: false } },
            y: { beginAtZero: true, title: { display: true, text: t.chartTokens } },
          },
          plugins: { legend: { position: "top" } },
        },
      });
    } else {
      chartRef.current = new Chart(canvasEl, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: t.chartInputLabel, data: inputData, backgroundColor: "rgba(14,165,233,0.7)", stack: "d" },
            { label: t.chartOutputLabel, data: outputData, backgroundColor: "rgba(16,185,129,0.7)", stack: "d" },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 }, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, title: { display: true, text: t.chartTokens } },
          },
          plugins: { legend: { position: "top" } },
        },
      });
    }
    })();

    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [series, type, t]);

  return (
    <div className="h-48 w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}

export function Heatmap({ series, rangeFrom }: { series: UsageDaily[]; rangeFrom: string | null }) {
  const t = useAssistantI18n().statsTab;
  // Aggregate by day (the API already gives us a YYYY-MM-DD bucket per series entry).
  const daily = new Map<string, number>();
  for (const s of series) {
    daily.set(s.day, (daily.get(s.day) ?? 0) + s.total);
  }

  // Year range (Jan 1 → Dec 31) with column alignment starting on Monday of ISO week 1.
  const now = new Date();
  const year = now.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const yearStart = new Date(jan4.getTime() - jan4Day * 86_400_000);
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const totalDays = Math.floor((yearEnd.getTime() - yearStart.getTime()) / 86_400_000) + 1;
  const totalWeeks = Math.ceil(totalDays / 7);

  // Quantile buckets for the intensity ramp (same thresholds as data-usage).
  const values = Array.from(daily.values()).filter((v) => v > 0).sort((a, b) => a - b);
  const quantile = (q: number): number => {
    if (values.length === 0) return 0;
    const i = Math.min(values.length - 1, Math.max(0, Math.floor(q * (values.length - 1))));
    return values[i];
  };
  const q33 = quantile(0.33);
  const q66 = quantile(0.66);
  const q90 = quantile(0.90);

  // Month label per week column (placed on the column that contains day 1 of each month).
  const monthByCol: (string | null)[] = new Array(totalWeeks).fill(null);
  for (let w = 0; w < totalWeeks; w++) {
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      if (idx >= totalDays) break;
      const day = new Date(yearStart.getTime() + idx * 86_400_000);
      if (day.getUTCDate() === 1) {
        monthByCol[w] = day.toLocaleDateString(undefined, { month: "short" });
        break;
      }
    }
  }

  const dayKeys = ["heatmapDayMon", "heatmapDayTue", "heatmapDayWed", "heatmapDayThu", "heatmapDayFri", "heatmapDaySat", "heatmapDaySun"] as const;
  const dayLabels = dayKeys.map((k) => t[k]);

  const fromTs = rangeFrom ? Date.parse(rangeFrom + "T00:00:00Z") : null;
  const cellGap = 3;
  const monthRowH = 14;
  const dayColW = 28;

  const totalYearTokens = [...daily.values()].reduce((a, b) => a + b, 0);

  // Build cell styles explicitly so each cell knows its column/row (no auto-flow ambiguity).
  const cells: ReactElement[] = [];
  for (let idx = 0; idx < totalDays; idx++) {
    const day = new Date(yearStart.getTime() + idx * 86_400_000);
    const k = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
    const v = daily.get(k) ?? 0;
    const cellTs = day.getTime();
    const isFuture = cellTs > Date.now();
    const inRange = fromTs === null || cellTs >= fromTs;

    let bg = "rgba(244,63,94,0.10)";
    if (!inRange) bg = "rgba(127,127,127,0.05)";
    else if (isFuture) bg = "rgba(0,0,0,0.04)";
    else if (v > 0) {
      if (v <= q33) bg = "rgba(244,63,94,0.25)";
      else if (v <= q66) bg = "rgba(244,63,94,0.45)";
      else if (v <= q90) bg = "rgba(244,63,94,0.70)";
      else bg = "rgba(244,63,94,1)";
    }
    const title = `${k}: ${v.toLocaleString()} ${t.chartTokens}${inRange ? "" : ` (${t.heatmapOutOfRange})`}`;
    cells.push(
      <div
        key={k}
        title={title}
        style={{
          gridColumn: Math.floor(idx / 7) + 1,
          gridRow: (idx % 7) + 1,
          aspectRatio: "1",
          borderRadius: 3,
          background: bg,
          minWidth: 0,
          minHeight: 0,
        }}
        data-day={k}
        data-tokens={v}
      />
    );
  }
  // Pad the last week with empty cells if needed.
  const padCells = Array.from({ length: totalWeeks * 7 - totalDays }, (_, i) => <div key={`pad-${i}`} />);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{t.heatmapTitle}</span>
        <span className="tabular-nums">{totalYearTokens.toLocaleString()} {t.heatmapTotalSuffix}</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        {/* Left column: 7 day labels (Mon..Sun), aligned to the cells' 7 rows. */}
        <div style={{ display: "grid", gridTemplateRows: `${monthRowH}px repeat(7, 1fr)`, rowGap: cellGap, fontSize: 10, color: "var(--muted-foreground, #71717a)", flexShrink: 0, fontWeight: 500, width: dayColW }}>
          <div />
          {dayLabels.map((lbl, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden" }}>{lbl}</div>
          ))}
        </div>
        {/* Right column: month labels row + cells grid. */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: cellGap }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))`, columnGap: cellGap, height: monthRowH, fontSize: 10, color: "var(--muted-foreground, #71717a)", fontWeight: 500 }}>
            {monthByCol.map((m, i) => (
              <div key={i} style={{ overflow: "hidden", whiteSpace: "nowrap", lineHeight: 1, textAlign: "left", minWidth: 0 }}>{m ?? ""}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, minmax(0, 1fr))", columnGap: cellGap, rowGap: cellGap }}>
            {cells}
            {padCells}
          </div>
        </div>
      </div>
    </div>
  );
}
