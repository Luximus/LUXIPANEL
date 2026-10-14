/**
 * Monitor charts — Chart.js powered.
 *
 * Replaces the old hand-rolled SVG sparkline with:
 *   - A styled line chart (CPU / RAM / Disk %) over a selectable range, with
 *     optional overlay of the *previous* equivalent period for comparison.
 *   - Peak detection: prominent points are enlarged, and hovering ANY audited
 *     point (peaks included) reveals the processes that were consuming the most
 *     at that instant — sourced from the per-snapshot audit the backend now
 *     records (`StatsSnapshot.topProcesses`). Clicking a point pins that audit
 *     into a side panel.
 *   - Breakdown charts a server admin cares about: memory doughnut, disk
 *     doughnut, a polar-area of the current top processes (CPU/RAM toggle),
 *     and an inbound/outbound network doughnut.
 *
 * Chart.js is bundled inline (offline, no CDN) via build-extracted.mjs; the
 * shared `api` lib stays an external runtime import. Lifecycle mirrors the
 * other extracted scripts: re-init on astro:page-load / astro:after-swap, and
 * every Chart instance is destroyed before re-render and on astro:before-swap
 * (Chart.js refuses to attach twice to the same canvas).
 */
import Chart from "chart.js/auto";
import { bucketPoints, peakPoints, type HistoryChart, type HistoryPoint, type HistoryMetric } from "./history-data";
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { MONITOR_PREFS_EVENT, readMonitorPrefs, saveMonitorPrefs } from "./monitor-prefs";

const { loadI18n, t, fmt } = createPageI18n("monitor-i18n");

interface ProcLite { pid: number; name: string; cpu: number; mem: number }
interface Snap {
  ts: number;
  cpu: { usagePercent: number; loadAvg1m: number };
  memory: { usagePercent: number; usedBytes: number; freeBytes: number; totalBytes: number };
  disk: { usagePercent: number; usedBytes: number; availableBytes: number; totalBytes: number };
  network: { rxBytesPerSec: number; txBytesPerSec: number };
  topProcesses?: { cpu: ProcLite[]; mem: ProcLite[] };
}

const RANGE_MS: Record<string, number> = {
  "1h": 3600e3,
  "6h": 6 * 3600e3,
  "24h": 24 * 3600e3,
  "7d": 7 * 24 * 3600e3,
};

const COLORS = {
  cpu: "#f59e0b",
  ram: "#a855f7",
  disk: "#0ea5e9",
  rx: "#10b981",
  tx: "#6366f1",
  free: "#3f3f4622",
};
// A small palette for the polar-area process chart.
const POLAR = ["#f59e0b", "#a855f7", "#0ea5e9", "#10b981", "#ef4444", "#6366f1", "#ec4899"];

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}
function gridColor(): string {
  return isDark() ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
}
function tickColor(): string {
  return isDark() ? "#a1a1aa" : "#52525b";
}
function isMonitorPage(): boolean {
  return !!document.getElementById("monitor-session") || !!document.getElementById("chart-history");
}
function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function fmtRate(bytesPerSec: number): string {
  return `${fmtBytes(bytesPerSec)}/s`;
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

// --- state -----------------------------------------------------------------
let started = false;
let historyLoaded = false;
let currentRange = "1h";
let compareOn = false;
let historyMetric: MetricFilter = "all";
let polarMetric: "cpu" | "mem" = "cpu";
let lastCurrentSnaps: Snap[] = [];

const charts: Record<string, Chart | null> = {
  history: null, mem: null, disk: null, procs: null, net: null,
};
function destroy(key: string): void {
  if (charts[key]) { charts[key]!.destroy(); charts[key] = null; }
}
function destroyAll(): void {
  Object.keys(charts).forEach(destroy);
}

// --- history data ----------------------------------------------------------
async function fetchWindow(fromTs: number, toTs: number): Promise<HistoryChart<Snap>> {
  const res = await api.get("/api/monitor/history", {
    params: { from: String(fromTs), to: String(toTs), resolution: "chart" },
  });
  if (!res.ok || !res.data || !Array.isArray((res.data as HistoryChart<Snap>).buckets)) {
    throw new Error(res.error ?? "History unavailable");
  }
  return res.data as HistoryChart<Snap>;
}

const METRICS = {
  cpu: { color: COLORS.cpu, label: "charts.labelCpu", fallback: "CPU %" },
  ram: { color: COLORS.ram, label: "charts.labelRam", fallback: "RAM %" },
  disk: { color: COLORS.disk, label: "charts.labelDisk", fallback: "Disco %" },
  rx: { color: COLORS.rx, label: "labels.rx", fallback: "RX" },
  tx: { color: COLORS.tx, label: "labels.tx", fallback: "TX" },
} as const;
type MetricFilter = "all" | "cpu" | "ram" | "disk" | "network";
type HistoryDataset = { metric: HistoryMetric; kind: "average" | "peak" | "previous" };

function activeMetrics(): HistoryMetric[] {
  if (historyMetric === "all") return ["cpu", "ram", "disk"];
  if (historyMetric === "network") return ["rx", "tx"];
  return [historyMetric];
}
function formatMetric(metric: HistoryMetric, value: number): string {
  return metric === "rx" || metric === "tx" ? fmtRate(value) : `${value.toFixed(1)}%`;
}
function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function tickLabel(ts: number): string {
  const date = new Date(ts);
  return currentRange === "7d"
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function setOverlay(message: string | null, isError = false): void {
  const el = document.getElementById("history-overlay");
  if (!el) return;
  el.textContent = message ?? "";
  el.classList.toggle("hidden", !message);
  el.classList.toggle("flex", !!message);
  el.classList.toggle("text-destructive", isError);
}
function setHistoryStatus(message: string): void {
  const el = document.getElementById("history-status");
  if (el) el.textContent = message;
}
function renderSummary(current: HistoryChart<Snap>, previous: HistoryChart<Snap> | null): void {
  const el = document.getElementById("history-summary");
  if (!el) return;
  el.replaceChildren();
  if (!current.summary) return;
  for (const metric of activeMetrics()) {
    const definition = METRICS[metric];
    const summary = current.summary[metric];
    const card = document.createElement("div");
    card.className = "rounded-lg border border-border bg-muted/20 px-3 py-2.5";
    card.style.borderTopColor = definition.color;
    card.style.borderTopWidth = "2px";
    const heading = document.createElement("p");
    heading.className = "text-xs font-semibold";
    heading.textContent = t(definition.label, definition.fallback);
    const valuesRow = document.createElement("div");
    valuesRow.className = "mt-2 grid grid-cols-3 gap-2 text-xs tabular-nums";
    for (const [label, value] of [
      [t("history.latest", "Última"), summary.latest],
      [t("history.average", "Promedio"), summary.average],
      [t("history.maximum", "Máximo"), summary.maximum],
    ] as const) {
      const cell = document.createElement("div");
      const caption = document.createElement("span");
      caption.className = "block text-muted-foreground";
      caption.textContent = label;
      const number = document.createElement("strong");
      number.className = "block truncate font-semibold text-foreground";
      number.textContent = formatMetric(metric, value);
      cell.append(caption, number);
      valuesRow.append(cell);
    }
    card.append(heading, valuesRow);
    if (compareOn && previous?.summary) {
      const comparison = document.createElement("p");
      comparison.className = "mt-2 border-t border-border pt-1.5 text-xs text-muted-foreground";
      comparison.textContent = `${t("history.previousAverage", "Promedio anterior")}: ${formatMetric(metric, previous.summary[metric].average)}`;
      card.append(comparison);
    }
    el.append(card);
  }
}

function renderCoverage(current: HistoryChart<Snap>): number {
  const el = document.getElementById("history-coverage");
  if (!el) return 0;
  el.replaceChildren();
  const slotCount = currentRange === "7d" ? 7 : currentRange === "24h" ? 8 : 6;
  const windowMs = current.toTs - current.fromTs;
  const slotMs = windowMs / slotCount;
  const expected = Math.max(1, Math.ceil(windowMs / current.bucketMs));
  const percent = Math.round(current.buckets.length / expected * 100);
  const caption = document.createElement("p");
  caption.className = "mb-1.5 text-xs font-medium text-muted-foreground";
  caption.textContent = `${t("history.coverageLabel", "Cobertura del historial")}: ${percent}%`;
  const grid = document.createElement("div");
  grid.className = "grid gap-1";
  grid.style.gridTemplateColumns = `repeat(${slotCount}, minmax(0, 1fr))`;
  for (let index = 0; index < slotCount; index++) {
    const start = current.fromTs + slotMs * index;
    const end = start + slotMs;
    const buckets = current.buckets.filter((bucket) => bucket.fromTs < end && bucket.toTs > start);
    const slotExpected = Math.max(1, Math.round(slotMs / current.bucketMs));
    const slotPercent = Math.min(100, Math.round(buckets.length / slotExpected * 100));
    const cell = document.createElement("div");
    cell.className = "min-w-0";
    const bar = document.createElement("div");
    bar.className = `h-2 rounded-full ${buckets.length ? "bg-primary" : "bg-muted"}`;
    bar.style.opacity = buckets.length ? String(Math.max(0.25, slotPercent / 100)) : "1";
    const label = document.createElement("span");
    label.className = "mt-1 block truncate text-[10px] text-muted-foreground";
    label.textContent = tickLabel(start);
    cell.title = `${formatDate(start)} — ${formatDate(end)} · ${slotPercent}%`;
    cell.append(bar, label);
    grid.append(cell);
  }
  el.append(caption, grid);
  if (current.firstTs && current.firstTs - current.fromTs > current.bucketMs * 2) {
    const note = document.createElement("p");
    note.className = "mt-2 text-xs text-amber-600 dark:text-amber-400";
    note.textContent = `${t("history.availableSince", "Datos disponibles desde")}: ${formatDate(current.firstTs)}. ${t("history.missingIntervals", "Los tramos anteriores no tienen muestras registradas.")}`;
    el.append(note);
  }
  return percent;
}

function announceWindow(current: HistoryChart<Snap>, previous: HistoryChart<Snap> | null): void {
  window.dispatchEvent(new CustomEvent("lxp:monitor:history-window", {
    detail: { range: currentRange, fromTs: current.fromTs, toTs: current.toTs,
      buckets: current.buckets, previousBuckets: previous?.buckets ?? [] },
  }));
}

// --- history line chart ----------------------------------------------------
let historyRequest = 0;
async function renderHistory(showLoading = false): Promise<void> {
  const canvas = document.getElementById("chart-history") as HTMLCanvasElement | null;
  if (!canvas) return;
  const request = ++historyRequest;
  const rangeMs = RANGE_MS[currentRange] ?? RANGE_MS["1h"]!;
  const toTs = Date.now();
  const fromTs = toTs - rangeMs;
  const previousFromTs = fromTs - rangeMs;
  const hadChart = !!charts.history;
  setHistoryStatus(t("history.loading", "Cargando historial..."));
  if (!hadChart || showLoading) setOverlay(t("history.loading", "Cargando historial..."));
  let current: HistoryChart<Snap>;
  let previous: HistoryChart<Snap> | null;
  try {
    [current, previous] = await Promise.all([
      fetchWindow(fromTs, toTs),
      compareOn ? fetchWindow(previousFromTs, fromTs) : Promise.resolve(null),
    ]);
  } catch {
    if (request !== historyRequest || !isMonitorPage()) return;
    destroy("history");
    lastCurrentSnaps = [];
    document.getElementById("history-summary")?.replaceChildren();
    document.getElementById("history-coverage")?.replaceChildren();
    setHistoryStatus(t("errors.loadHistory", "Error al cargar historial"));
    setOverlay(t("history.loadError", "No se pudo cargar el historial. Cambia el rango o vuelve a intentarlo."), true);
    return;
  }
  if (request !== historyRequest || !isMonitorPage()) return;
  lastCurrentSnaps = current.latestSnapshot ? [current.latestSnapshot] : [];
  announceWindow(current, previous);
  if (!current.totalSamples && !previous?.totalSamples) {
    destroy("history");
    document.getElementById("history-summary")?.replaceChildren();
    document.getElementById("peak-info")?.classList.add("hidden");
    renderCoverage(current);
    setHistoryStatus(t("history.noData", "Aún no hay muestras en este periodo."));
    setOverlay(t("history.noDataDetail", "El historial aparecerá cuando se registren nuevas muestras."));
    return;
  }
  setOverlay(null);
  renderSummary(current, previous);
  const coverage = renderCoverage(current);
  const compareStatus = compareOn
    ? previous?.totalSamples
      ? ` · ${previous.totalSamples} ${t("history.previousSamples", "anteriores")}`
      : ` · ${t("history.noPrevious", "sin muestras del periodo anterior")}`
    : "";
  const availableSpan = current.firstTs !== null && current.lastTs !== null
    ? ` · ${formatDate(current.firstTs)} — ${formatDate(current.lastTs)}` : "";
  setHistoryStatus(`${current.totalSamples} ${t("history.samples", "muestras")} · ${coverage}%${availableSpan}${compareStatus}`);

  const metricKeys = activeMetrics();
  const datasets: Record<string, unknown>[] = [];
  const datasetMeta: HistoryDataset[] = [];
  for (const metric of metricKeys) {
    const definition = METRICS[metric];
    datasets.push({
      label: `${t(definition.label, definition.fallback)} · ${t("history.average", "Promedio")}`,
      data: bucketPoints<Snap>(current.buckets, fromTs, metric),
      borderColor: definition.color,
      backgroundColor: `${definition.color}20`,
      borderWidth: 2,
      tension: 0.2,
      fill: metricKeys.length === 1,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHitRadius: 12,
      spanGaps: false,
    });
    datasetMeta.push({ metric, kind: "average" });
    const peaks = current.peaks[metric] ?? [];
    if (peaks.length) {
      datasets.push({
        label: `${t(definition.label, definition.fallback)} · ${t("history.peakLabel", "Pico")}`,
        data: peakPoints(peaks, fromTs, metric),
        borderColor: definition.color,
        backgroundColor: definition.color,
        showLine: false,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointStyle: "triangle",
        pointHitRadius: 10,
        isPeak: true,
      });
      datasetMeta.push({ metric, kind: "peak" });
    }
    if (compareOn && previous?.totalSamples) {
      datasets.push({
        label: `${t(definition.label, definition.fallback)} · ${t("history.previous", "anterior")}`,
        data: bucketPoints<Snap>(previous.buckets, previousFromTs, metric),
        borderColor: `${definition.color}99`,
        borderWidth: 1.5,
        tension: 0.2,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 12,
        borderDash: [6, 4],
        spanGaps: false,
      });
      datasetMeta.push({ metric, kind: "previous" });
    }
  }

  destroy("history");
  const periodMinutes = rangeMs / 60_000;
  const tickCount = currentRange === "7d" ? 7 : 6;
  const xTicks = Array.from({ length: tickCount + 1 }, (_, index) => ({ value: periodMinutes * index / tickCount }));
  const networkMode = historyMetric === "network";
  charts.history = new Chart(canvas, {
    type: "line",
    data: { datasets: datasets as never },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: true },
      scales: {
        x: {
          type: "linear", min: 0, max: periodMinutes,
          grid: { color: gridColor() },
          afterBuildTicks: (axis: { ticks: { value: number }[] }) => { axis.ticks = xTicks; },
          ticks: { color: tickColor(), autoSkip: false, maxRotation: 0,
            callback: (value) => tickLabel(fromTs + Number(value) * 60_000) },
        },
        y: {
          min: 0, ...(networkMode ? {} : { max: 100 }),
          grid: { color: gridColor() },
          ticks: { color: tickColor(), callback: (value) => networkMode ? fmtRate(Number(value)) : `${value}%` },
        },
      },
      plugins: {
        legend: { labels: {
          color: tickColor(), usePointStyle: true, boxWidth: 8,
          filter: (item, data) => typeof item.datasetIndex !== "number"
            || !(data.datasets[item.datasetIndex] as { isPeak?: boolean })?.isPeak,
        } },
        tooltip: {
          callbacks: {
            title: (items) => {
              const point = items[0]?.raw as HistoryPoint<Snap> | undefined;
              if (point?.snapshot) return formatDate(point.snapshot.ts);
              if (point?.bucket) return `${formatDate(point.bucket.fromTs)} — ${formatDate(point.bucket.toTs)}`;
              return "";
            },
            label: (item) => {
              const meta = datasetMeta[item.datasetIndex];
              return meta ? `${item.dataset.label}: ${formatMetric(meta.metric, Number(item.parsed.y))}` : "";
            },
            afterBody: (items) => {
              const point = items[0]?.raw as HistoryPoint<Snap> | undefined;
              const meta = datasetMeta[items[0]?.datasetIndex ?? 0];
              if (point?.bucket && meta) {
                return [`${point.bucket.sampleCount} ${t("history.samples", "muestras")}`,
                  `${t("history.maximum", "Máximo")}: ${formatMetric(meta.metric, point.bucket.maximum[meta.metric])}`];
              }
              const processes = point?.snapshot?.topProcesses?.cpu ?? [];
              if (!processes.length) return [];
              return [t("charts.tooltipTopCpu", "Top procesos (CPU):"),
                ...processes.slice(0, 5).map((process) => `  ${process.name} (pid ${process.pid}) · ${process.cpu.toFixed(1)}%`)];
            },
          },
        },
      },
      onClick: (_event, elements) => {
        const element = elements[0];
        if (!element) return;
        const point = charts.history?.data.datasets[element.datasetIndex]?.data[element.index] as HistoryPoint<Snap> | undefined;
        if (!point) return;
        if (point.snapshot) {
          pinPeak(point.snapshot, true);
          window.dispatchEvent(new CustomEvent("lxp:monitor:history-processes", {
            detail: { atTs: point.snapshot.ts, snapshot: point.snapshot,
              period: datasetMeta[element.datasetIndex]?.kind === "previous" ? "previous" : "current" },
          }));
        } else if (point.bucket) {
          window.dispatchEvent(new CustomEvent("lxp:monitor:history-processes", {
            detail: { atTs: (point.bucket.fromTs + point.bucket.toTs) / 2,
              fromTs: point.bucket.fromTs, toTs: point.bucket.toTs, index: point.bucket.index,
              period: datasetMeta[element.datasetIndex]?.kind === "previous" ? "previous" : "current" },
          }));
        }
        switchWorkspaceTab("processes");
      },
    },
  });
}

/** Pin a peak snapshot's audited processes for return visits to the chart. */
function pinPeak(snap: Snap, isPeak: boolean): void {
  const el = document.getElementById("peak-info");
  if (!el) return;
  const cpu = snap.topProcesses?.cpu ?? [];
  const mem = snap.topProcesses?.mem ?? [];
  const row = (process: ProcLite, metric: "cpu" | "mem") =>
    `<div class="flex items-center justify-between gap-2 py-0.5">
      <span class="truncate font-mono text-xs">${escapeHtml(process.name)} <span class="opacity-50">#${Number(process.pid)}</span></span>
      <span class="text-xs font-medium tabular-nums">${(metric === "cpu" ? process.cpu : process.mem).toFixed(1)}%</span>
    </div>`;
  el.innerHTML = `
    <div class="mb-2 flex items-center gap-2 text-sm font-semibold">
      ${isPeak ? '<i class="ti ti-flame text-orange-500"></i>' : '<i class="ti ti-clock text-muted-foreground"></i>'}
      <span>${isPeak ? t("charts.peak", "Pico") : t("charts.sample", "Muestra")} · ${formatDate(snap.ts)}</span>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <p class="mb-1 text-xs uppercase tracking-wide text-muted-foreground">${t("charts.topCpu", "Top CPU")}</p>
        ${cpu.length ? cpu.slice(0, 5).map((process) => row(process, "cpu")).join("") : `<p class="text-xs text-muted-foreground">${t("empty.noAudit", "Sin auditoría")}</p>`}
      </div>
      <div>
        <p class="mb-1 text-xs uppercase tracking-wide text-muted-foreground">${t("charts.topRam", "Top RAM")}</p>
        ${mem.length ? mem.slice(0, 5).map((process) => row(process, "mem")).join("") : `<p class="text-xs text-muted-foreground">${t("empty.noAudit", "Sin auditoría")}</p>`}
      </div>
    </div>`;
  el.classList.remove("hidden");
}

function doughnutOpts(centerColor: string) {
  return {
    responsive: true, maintainAspectRatio: false, cutout: "62%",
    plugins: {
      legend: { position: "bottom" as const, labels: { color: tickColor(), usePointStyle: true, boxWidth: 8, padding: 12 } },
    },
    borderColor: centerColor,
  };
}

function renderBreakdowns(snap: Snap | undefined): void {
  if (!snap) return;
  const bg = isDark() ? "#18181b" : "#ffffff";

  // Memory used vs free.
  const memCanvas = document.getElementById("chart-mem") as HTMLCanvasElement | null;
  if (memCanvas) {
    destroy("mem");
    charts["mem"] = new Chart(memCanvas, {
      type: "doughnut",
      data: {
        labels: [fmt(t("charts.memUsed", "Usada ({size})"), { size: fmtBytes(snap.memory.usedBytes) }), fmt(t("charts.memFree", "Libre ({size})"), { size: fmtBytes(snap.memory.freeBytes) })],
        datasets: [{ data: [snap.memory.usedBytes, snap.memory.freeBytes], backgroundColor: [COLORS.ram, gridColor()], borderColor: bg, borderWidth: 2 }],
      },
      options: doughnutOpts(bg),
    });
  }

  // Disk used vs available.
  const diskCanvas = document.getElementById("chart-disk") as HTMLCanvasElement | null;
  if (diskCanvas) {
    destroy("disk");
    charts["disk"] = new Chart(diskCanvas, {
      type: "doughnut",
      data: {
        labels: [fmt(t("charts.diskUsed", "Usado ({size})"), { size: fmtBytes(snap.disk.usedBytes) }), fmt(t("charts.diskFree", "Libre ({size})"), { size: fmtBytes(snap.disk.availableBytes) })],
        datasets: [{ data: [snap.disk.usedBytes, snap.disk.availableBytes], backgroundColor: [COLORS.disk, gridColor()], borderColor: bg, borderWidth: 2 }],
      },
      options: doughnutOpts(bg),
    });
  }

  // Network inbound vs outbound (current throughput).
  const netCanvas = document.getElementById("chart-net") as HTMLCanvasElement | null;
  if (netCanvas) {
    destroy("net");
    const rx = Math.max(0, snap.network.rxBytesPerSec);
    const tx = Math.max(0, snap.network.txBytesPerSec);
    charts["net"] = new Chart(netCanvas, {
      type: "doughnut",
      data: {
        labels: [fmt(t("charts.netIn", "Entrada ({rate})"), { rate: fmtRate(rx) }), fmt(t("charts.netOut", "Salida ({rate})"), { rate: fmtRate(tx) })],
        datasets: [{ data: [rx || 0.0001, tx || 0.0001], backgroundColor: [COLORS.rx, COLORS.tx], borderColor: bg, borderWidth: 2 }],
      },
      options: doughnutOpts(bg),
    });
  }

  renderPolar(snap);
}

/** Polar-area of the current top processes by the selected metric. */
function renderPolar(snap: Snap): void {
  const canvas = document.getElementById("chart-procs") as HTMLCanvasElement | null;
  if (!canvas) return;
  const procs = ((polarMetric === "cpu" ? snap.topProcesses?.cpu : snap.topProcesses?.mem) ?? []).slice(0, 5);
  destroy("procs");
  if (!procs.length) {
    return;
  }
  charts["procs"] = new Chart(canvas, {
    type: "polarArea",
    data: {
      labels: procs.map((p) => p.name),
      datasets: [{
        data: procs.map((p) => (polarMetric === "cpu" ? p.cpu : p.mem)),
        backgroundColor: procs.map((_, i) => POLAR[i % POLAR.length] + "cc"),
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { r: { grid: { color: gridColor() }, ticks: { color: tickColor(), backdropColor: "transparent" } } },
      plugins: { legend: { position: "right", labels: { color: tickColor(), usePointStyle: true, boxWidth: 8, font: { size: 10 } } } },
    },
  });
}

let breakdownRequest = 0;
async function refreshBreakdowns(): Promise<void> {
  const request = ++breakdownRequest;
  const root = document.getElementById("monitor-panel-history");
  const scope = resolveTargetScope();
  // Prefer the freshest live snapshot; fall back to the last history sample.
  const res = await api.get("/api/monitor/snapshot");
  if (!isMonitorPage() || request !== breakdownRequest || root !== document.getElementById("monitor-panel-history")
    || scope !== resolveTargetScope()) return;
  const snap = (res.ok && res.data ? (res.data as Snap) : undefined) ?? lastCurrentSnaps.at(-1);
  renderBreakdowns(snap);
}

// --- controls --------------------------------------------------------------
function setRangeButtons(active: string): void {
  document.querySelectorAll<HTMLElement>(".range-btn").forEach((b) => {
    const on = b.getAttribute("data-range") === active;
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("bg-primary", on);
    b.classList.toggle("text-primary-foreground", on);
    b.classList.toggle("text-muted-foreground", !on);
    b.classList.toggle("hover:bg-accent", !on);
  });
}

function setMetricButtons(active: MetricFilter): void {
  document.querySelectorAll<HTMLElement>("[data-history-metric]").forEach((button) => {
    const on = button.dataset.historyMetric === active;
    button.setAttribute("aria-pressed", String(on));
    button.classList.toggle("border-primary", on);
    button.classList.toggle("bg-primary/10", on);
    button.classList.toggle("text-foreground", on);
    button.classList.toggle("border-border", !on);
    button.classList.toggle("text-muted-foreground", !on);
  });
}

function setCompareButton(): void {
  const button = document.getElementById("cmp-toggle");
  if (!button) return;
  button.setAttribute("aria-pressed", String(compareOn));
  button.classList.toggle("bg-primary", compareOn);
  button.classList.toggle("text-primary-foreground", compareOn);
  button.classList.toggle("text-muted-foreground", !compareOn);
}

function clearPinnedSample(): void {
  document.getElementById("peak-info")?.classList.add("hidden");
}

function switchWorkspaceTab(tab: "history" | "processes", focus = false): void {
  const historyPanel = document.getElementById("monitor-panel-history");
  const processesPanel = document.getElementById("monitor-panel-processes");
  if (!historyPanel || !processesPanel) return;
  historyPanel.classList.toggle("hidden", tab !== "history");
  processesPanel.classList.toggle("hidden", tab !== "processes");
  for (const name of ["history", "processes"] as const) {
    const button = document.getElementById(`monitor-tab-${name}`);
    if (!button) continue;
    const active = name === tab;
    button.setAttribute("aria-selected", String(active));
    button.setAttribute("tabindex", active ? "0" : "-1");
    button.classList.toggle("border-primary", active);
    button.classList.toggle("border-transparent", !active);
    button.classList.toggle("text-foreground", active);
    button.classList.toggle("text-muted-foreground", !active);
    if (active && focus) button.focus();
  }
  if (tab === "history") requestAnimationFrame(() => Object.values(charts).forEach((chart) => chart?.resize()));
}

function bindControls(): void {
  // Range buttons (delegated so they survive re-render / SPA nav).
  document.addEventListener("click", (event) => {
    if (!isMonitorPage()) return;
    const t = event.target;
    if (!(t instanceof Element)) return;

    if (t.closest("[data-monitor-open-processes]")) {
      switchWorkspaceTab("processes", true);
      document.getElementById("monitor-workspace")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
      return;
    }
    if (t.closest("#monitor-tab-history")) { switchWorkspaceTab("history"); if (!historyLoaded) { historyLoaded = true; void renderHistory(); void refreshBreakdowns(); } syncHistoryTimer(); return; }
    if (t.closest("#monitor-tab-processes")) { switchWorkspaceTab("processes"); syncHistoryTimer(); return; }

    const rangeBtn = t.closest(".range-btn");
    if (rangeBtn) {
      const r = rangeBtn.getAttribute("data-range");
      if (r && Object.hasOwn(RANGE_MS, r) && r !== currentRange) {
        currentRange = r;
        saveMonitorPrefs({ range: r as "1h" | "6h" | "24h" | "7d" });
        setRangeButtons(r);
        clearPinnedSample();
        void renderHistory(true);
      }
      return;
    }
    const metricButton = t.closest<HTMLElement>("[data-history-metric]");
    if (metricButton) {
      const metric = metricButton.dataset.historyMetric as MetricFilter | undefined;
      if (metric && ["all", "cpu", "ram", "disk", "network"].includes(metric) && metric !== historyMetric) {
        historyMetric = metric;
        saveMonitorPrefs({ metric });
        setMetricButtons(metric);
        clearPinnedSample();
        void renderHistory(true);
      }
      return;
    }
    if (t.closest("#cmp-toggle")) {
      compareOn = !compareOn;
      saveMonitorPrefs({ compare: compareOn });
      setCompareButton();
      clearPinnedSample();
      void renderHistory(true);
      return;
    }
    const polarBtn = t.closest<HTMLElement>("[data-polar-metric]");
    if (polarBtn) {
      const m = polarBtn.getAttribute("data-polar-metric") as "cpu" | "mem";
      if (m && m !== polarMetric) {
        polarMetric = m;
        document.querySelectorAll<HTMLElement>("[data-polar-metric]").forEach((b) => {
          const on = b.getAttribute("data-polar-metric") === m;
          b.className = `rounded-md px-3 py-1 text-xs font-medium transition-colors ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`;
        });
        const snap = lastCurrentSnaps.at(-1);
        if (snap) renderPolar(snap);
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (!isMonitorPage()) return;
    if (!(event.target instanceof Element) || !event.target.closest("#monitor-tab-history, #monitor-tab-processes")) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "history" : event.key === "End" ? "processes"
      : event.target.closest("#monitor-tab-history") ? "processes" : "history";
    switchWorkspaceTab(next, true);
  });
}

// --- lifecycle -------------------------------------------------------------
let breakdownTimer: ReturnType<typeof setInterval> | null = null;
let historyTimer: ReturnType<typeof setInterval> | null = null;

function syncHistoryTimer(): void {
  if (historyTimer) clearInterval(historyTimer);
  historyTimer = null;
  const seconds = readMonitorPrefs().historyRefreshSeconds;
  if (started && seconds > 0 && !document.getElementById("monitor-panel-history")?.classList.contains("hidden")) {
    historyTimer = setInterval(() => { if (!document.hidden) void renderHistory(); }, seconds * 1000);
  }
}

window.addEventListener(MONITOR_PREFS_EVENT, () => {
  if (!isMonitorPage() || !started) return;
  const prefs = readMonitorPrefs();
  const changed = currentRange !== prefs.range || historyMetric !== prefs.metric || compareOn !== prefs.compare;
  currentRange = prefs.range;
  historyMetric = prefs.metric;
  compareOn = prefs.compare;
  setRangeButtons(currentRange);
  setMetricButtons(historyMetric);
  setCompareButton();
  syncHistoryTimer();
  if (changed) { clearPinnedSample(); void renderHistory(true); }
});

async function init(): Promise<void> {
  if (!isMonitorPage()) return;
  if (started) return;
  started = true;
  loadI18n();
  const prefs = readMonitorPrefs();
  currentRange = prefs.range;
  historyMetric = prefs.metric;
  compareOn = prefs.compare;
  setRangeButtons(currentRange);
  setMetricButtons(historyMetric);
  setCompareButton();
  if (new URLSearchParams(location.search).get("workspaceView") === "processes") {
    switchWorkspaceTab("processes");
  } else {
    historyLoaded = true;
    // The live breakdown is independent of the historical graph. Install
    // cleanup immediately, including when one of these reads is slow.
    void renderHistory();
    void refreshBreakdowns();
  }

  // Visibility gate: don't poll /api/monitor/history or /api/monitor/snapshot
  // while the tab is hidden (this page already runs ~17 req/min across its
  // timers). renderHistory()/refreshBreakdowns() repaint from the freshest
  // sample as soon as the tab is visible again on the next tick.
  syncHistoryTimer();
  breakdownTimer = setInterval(() => {
    if (!document.hidden && !document.getElementById("monitor-panel-history")?.classList.contains("hidden")) void refreshBreakdowns();
  }, 15e3);

  document.addEventListener("astro:before-swap", () => {
    historyRequest++;
    started = false;
    historyLoaded = false;
    if (historyTimer) clearInterval(historyTimer);
    if (breakdownTimer) clearInterval(breakdownTimer);
    destroyAll();
  }, { once: true });
}

bindControls();
document.addEventListener("astro:page-load", () => void init());
document.addEventListener("astro:after-swap", () => void init());
void init();
