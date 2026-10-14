/** Settings drawer for the server Monitor. */
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { readMonitorPrefs, saveMonitorPrefs, type MonitorPrefs } from "./monitor-prefs";

const { loadI18n, t, fmt } = createPageI18n("monitor-i18n");
const ui = (key: string, fallback: string) => t(`settingsUi.dynamic.${key}`, fallback);

interface AlertRule {
  id: number;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  sustainedSamples: number;
  enabled: boolean;
  mutedUntil: string | null;
  firing?: boolean;
}
interface AlertEvent {
  id: number;
  ruleId: number;
  state: "firing" | "resolved";
  triggerValue: number;
  firedAt: string;
  resolvedAt: string | null;
}
interface HistoryBucket {
  fromTs: number; toTs: number; sampleCount: number;
  average: Record<string, number>; maximum: Record<string, number>;
}
interface HistoryResponse { buckets: HistoryBucket[]; totalSamples: number; bucketMs: number }

function metricLabels(): Record<string, string> {
  return {
    cpu_usage_percent: t("charts.labelCpu", "CPU %"),
    memory_usage_percent: t("charts.labelRam", "RAM %"),
    disk_usage_percent: t("charts.labelDisk", "Disco %"),
    load_avg_1m: t("settingsUi.load1m", "Carga 1 min"),
    load_avg_5m: t("settingsUi.load5m", "Carga 5 min"),
    rx_bytes_per_sec: t("settingsUi.networkReceived", "Red recibida B/s"),
    tx_bytes_per_sec: t("settingsUi.networkSent", "Red enviada B/s"),
  };
}
const operators: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤" };
let rules = new Map<number, AlertRule>();
let lastSnapshotTs: number | null = null;
let lastProcessesTs: number | null = null;
let bound = false;

function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}
function dateTime(ts: number | string | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(document.documentElement.lang || undefined) : "—";
}
function setText(id: string, value: string): void {
  const node = byId(id);
  if (node) node.textContent = value;
}
function button(label: string, onClick: () => void, danger = false): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.className = `rounded-md border px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${danger
    ? "border-destructive/30 text-destructive hover:bg-destructive/10"
    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`;
  node.addEventListener("click", onClick);
  return node;
}

function showPanel(name: string): void {
  document.querySelectorAll<HTMLElement>("[data-monitor-settings-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.monitorSettingsPanel !== name);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-monitor-settings-nav]").forEach((tab) => {
    const active = tab.dataset.monitorSettingsNav === name;
    tab.setAttribute("aria-selected", String(active));
    tab.classList.toggle("bg-primary/10", active);
    tab.classList.toggle("text-primary", active);
    tab.classList.toggle("text-muted-foreground", !active);
  });
  if (name === "alerts") void loadAlerts();
  if (name === "diagnostics") void refreshDiagnostics();
}

function reflectPrefs(): void {
  const prefs = readMonitorPrefs();
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-monitor-pref]").forEach((field) => {
    const key = field.dataset.monitorPref as keyof MonitorPrefs;
    if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = Boolean(prefs[key]);
    else field.value = String(prefs[key]);
  });
}

function resetForm(): void {
  const form = byId<HTMLFormElement>("monitor-alert-form");
  form?.reset();
  const id = byId<HTMLInputElement>("monitor-alert-id");
  if (id) id.value = "";
  const submit = byId<HTMLButtonElement>("monitor-alert-submit");
  if (submit) submit.textContent = t("alertDialog.submitButton", "Crear regla");
  byId("monitor-alert-cancel")?.classList.add("hidden");
}

function editRule(rule: AlertRule): void {
  const fields: Record<string, string> = {
    "monitor-alert-id": String(rule.id), "monitor-alert-name": rule.name,
    "monitor-alert-metric": rule.metric, "monitor-alert-operator": rule.operator,
    "monitor-alert-threshold": String(rule.threshold),
    "monitor-alert-samples": String(rule.sustainedSamples),
  };
  for (const [id, value] of Object.entries(fields)) {
    const input = byId<HTMLInputElement | HTMLSelectElement>(id);
    if (input) input.value = value;
  }
  const submit = byId<HTMLButtonElement>("monitor-alert-submit");
  if (submit) submit.textContent = ui("saveRule", "Guardar regla");
  byId("monitor-alert-cancel")?.classList.remove("hidden");
  byId("monitor-alert-form")?.scrollIntoView({ block: "nearest" });
}

function renderRules(): void {
  const container = byId("monitor-alert-rules");
  if (!container) return;
  const labels = metricLabels();
  container.replaceChildren();
  if (rules.size === 0) {
    const empty = document.createElement("p");
    empty.className = "rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground";
    empty.textContent = ui("noRulesHint", "Sin reglas. Crea una para recibir avisos cuando un recurso supere su umbral.");
    container.append(empty);
    return;
  }
  for (const rule of [...rules.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const row = document.createElement("article");
    row.className = "rounded-lg border border-border bg-card p-3";
    const head = document.createElement("div");
    head.className = "flex flex-wrap items-center justify-between gap-2";
    const name = document.createElement("strong");
    name.className = "text-sm";
    name.textContent = rule.name;
    const state = document.createElement("span");
    state.className = `rounded-full px-2 py-0.5 text-[11px] font-medium ${rule.firing ? "bg-red-500/10 text-red-600" : rule.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`;
    state.textContent = rule.firing ? ui("firing", "Disparada") : rule.enabled ? t("labels.alertActive", "Activa") : t("labels.alertPaused", "Pausada");
    head.append(name, state);
    const summary = document.createElement("p");
    summary.className = "mt-1 text-xs text-muted-foreground";
    summary.textContent = `${labels[rule.metric] || rule.metric} ${operators[rule.operator] || rule.operator} ${rule.threshold} · ${fmt(ui("consecutiveSamples", "{count} muestras consecutivas"), { count: rule.sustainedSamples })}`;
    row.append(head, summary);
    const muted = rule.mutedUntil && Date.parse(rule.mutedUntil) > Date.now();
    if (muted) {
      const note = document.createElement("p");
      note.className = "mt-1 text-xs text-amber-600";
      note.textContent = fmt(ui("mutedUntil", "Avisos silenciados hasta {time}"), { time: dateTime(rule.mutedUntil) });
      row.append(note);
    }
    const actions = document.createElement("div");
    actions.className = "mt-3 flex flex-wrap gap-1.5";
    actions.append(
      button(ui("edit", "Editar"), () => editRule(rule)),
      button(rule.enabled ? ui("pause", "Pausar") : ui("enable", "Activar"), () => void updateRule(rule.id, { enabled: !rule.enabled })),
      button(muted ? ui("resumeAlerts", "Reanudar avisos") : ui("mute1h", "Silenciar 1 h"), () => void updateRule(rule.id, {
        mutedUntil: muted ? null : new Date(Date.now() + 3600_000).toISOString(),
      })),
      ...(!muted ? [button(ui("mute24h", "Silenciar 24 h"), () => void updateRule(rule.id, {
        mutedUntil: new Date(Date.now() + 24 * 3600_000).toISOString(),
      }))] : []),
      button(ui("delete", "Eliminar"), () => void deleteRule(rule), true),
    );
    row.append(actions);
    container.append(row);
  }
}

function renderEvents(events: AlertEvent[]): void {
  const container = byId("monitor-alert-events");
  if (!container) return;
  container.replaceChildren();
  if (events.length === 0) { container.textContent = ui("noEvents", "Sin eventos registrados."); return; }
  for (const event of events.slice(0, 10)) {
    const row = document.createElement("p");
    row.className = "border-b border-border py-1.5 last:border-0";
    const rule = rules.get(event.ruleId);
    row.textContent = `${dateTime(event.firedAt)} · ${rule?.name || fmt(ui("ruleName", "Regla {id}"), { id: event.ruleId })} · ${event.state === "firing" ? ui("firing", "Disparada") : ui("resolved", "Resuelta")} · ${event.triggerValue}`;
    container.append(row);
  }
}

let alertsGeneration = 0;
async function loadAlerts(): Promise<void> {
  if (!byId("monitor-alert-rules")) return;
  const root = byId("monitor-alert-rules");
  const scope = resolveTargetScope();
  const generation = ++alertsGeneration;
  const isCurrent = () => generation === alertsGeneration && root === byId("monitor-alert-rules")
    && scope === resolveTargetScope();
  setText("monitor-alert-status", t("alertRules.loading", "Cargando reglas..."));
  const ruleRequest = api.get<AlertRule[]>("/api/monitor/alerts/rules");
  const events = api.get<AlertEvent[]>("/api/monitor/alerts/events?limit=10").catch(() => null);
  const ruleResult = await ruleRequest;
  if (!isCurrent()) return;
  if (!ruleResult.ok || !Array.isArray(ruleResult.data)) {
    setText("monitor-alert-status", ruleResult.error || t("alertRules.loadError", "No se pudieron cargar las reglas."));
    return;
  }
  rules = new Map(ruleResult.data.map((rule) => [rule.id, rule]));
  renderRules();
  setText("monitor-alert-status", fmt(ui(rules.size === 1 ? "oneRule" : "manyRules", rules.size === 1 ? "{count} regla en este servidor." : "{count} reglas en este servidor."), { count: rules.size }));
  void events.then((eventResult) => {
    if (isCurrent()) renderEvents(eventResult?.ok && Array.isArray(eventResult.data) ? eventResult.data : []);
  });
}

async function updateRule(id: number, patch: Partial<AlertRule>): Promise<void> {
  const result = await api.put<AlertRule>(`/api/monitor/alerts/rules/${id}`, patch);
  if (!result.ok) { setText("monitor-alert-status", result.error || ui("saveError", "No se pudo guardar la regla.")); return; }
  await loadAlerts();
}

async function deleteRule(rule: AlertRule): Promise<void> {
  const accepted = await openConfirm(fmt(ui("deleteConfirm", "¿Eliminar la regla «{name}»?"), { name: rule.name }), { title: ui("deleteTitle", "Eliminar regla"), confirmText: ui("delete", "Eliminar") });
  if (!accepted) return;
  const result = await api.delete(`/api/monitor/alerts/rules/${rule.id}`);
  if (!result.ok) { setText("monitor-alert-status", result.error || ui("deleteError", "No se pudo eliminar la regla.")); return; }
  resetForm();
  await loadAlerts();
}

async function saveRule(event: Event): Promise<void> {
  event.preventDefault();
  const id = byId<HTMLInputElement>("monitor-alert-id")?.value.trim();
  const name = byId<HTMLInputElement>("monitor-alert-name")?.value.trim() || "";
  const metric = byId<HTMLSelectElement>("monitor-alert-metric")?.value || "";
  const operator = byId<HTMLSelectElement>("monitor-alert-operator")?.value || "";
  const threshold = Number(byId<HTMLInputElement>("monitor-alert-threshold")?.value);
  const sustainedSamples = Number(byId<HTMLInputElement>("monitor-alert-samples")?.value);
  if (name.length < 2 || !Number.isFinite(threshold) || !Number.isInteger(sustainedSamples) || sustainedSamples < 1 || sustainedSamples > 60) {
    setText("monitor-alert-status", ui("validationError", "Revisa el nombre, el umbral y las muestras consecutivas."));
    return;
  }
  const payload = { name, metric, operator, threshold, sustainedSamples };
  const submit = byId<HTMLButtonElement>("monitor-alert-submit");
  if (submit) submit.disabled = true;
  try {
    const result = id
      ? await api.put(`/api/monitor/alerts/rules/${id}`, payload)
      : await api.post("/api/monitor/alerts/rules", payload);
    if (!result.ok) { setText("monitor-alert-status", result.error || ui("saveError", "No se pudo guardar la regla.")); return; }
    resetForm();
    await loadAlerts();
  } finally { if (submit) submit.disabled = false; }
}

async function exportHistory(): Promise<void> {
  const button = byId<HTMLButtonElement>("monitor-export-history");
  if (button) button.disabled = true;
  setText("monitor-history-export-status", ui("preparingFile", "Preparando el archivo..."));
  try {
    const range = readMonitorPrefs().range;
    const to = Date.now();
    const ms = { "1h": 3600e3, "6h": 21600e3, "24h": 86400e3, "7d": 604800e3 }[range];
    const result = await api.get<HistoryResponse>("/api/monitor/history", {
      params: { from: String(to - ms), to: String(to), resolution: "chart" },
    });
    if (!result.ok || !result.data?.buckets) throw new Error(result.error || t("history.loadError", "No se pudo cargar el historial."));
    if (!result.data.buckets.length) throw new Error(ui("noExportSamples", "Este periodo no tiene muestras para exportar."));
    const metrics = ["cpu", "ram", "disk", "rx", "tx"];
    const columns = ["desde_utc", "hasta_utc", "muestras", ...metrics.flatMap((metric) => [`${metric}_promedio`, `${metric}_maximo`])];
    const rows = result.data.buckets.map((bucket) => [
      new Date(bucket.fromTs).toISOString(), new Date(bucket.toTs).toISOString(), bucket.sampleCount,
      ...metrics.flatMap((metric) => [bucket.average[metric], bucket.maximum[metric]]),
    ]);
    const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `monitor-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setText("monitor-history-export-status", fmt(ui("csvDownloaded", "Archivo CSV descargado: {count} intervalos."), { count: result.data.buckets.length }));
  } catch (error) {
    setText("monitor-history-export-status", error instanceof Error ? error.message : ui("exportError", "No se pudo exportar."));
  } finally { if (button) button.disabled = false; }
}

async function refreshDiagnostics(): Promise<void> {
  if (!byId("monitor-settings-diagnostics")) return;
  setText("monitor-diag-status", ui("checkingReadings", "Comprobando lecturas..."));
  const to = Date.now();
  const [snapshot, history] = await Promise.all([
    api.get<{ ts: number }>("/api/monitor/snapshot"),
    api.get<HistoryResponse>("/api/monitor/history", { params: { from: String(to - 3600e3), to: String(to), resolution: "chart" } }),
  ]);
  if (snapshot.ok && snapshot.data?.ts) lastSnapshotTs = snapshot.data.ts;
  setText("monitor-diag-snapshot", dateTime(lastSnapshotTs));
  const processesFromPage = Number(byId("proc-updated")?.dataset.updatedAt);
  setText("monitor-diag-processes", dateTime(lastProcessesTs || (processesFromPage > 0 ? processesFromPage : null)));
  if (history.ok && history.data?.buckets) {
    setText("monitor-diag-samples", String(history.data.totalSamples));
    const expected = Math.ceil(3600e3 / history.data.bucketMs);
    setText("monitor-diag-coverage", `${Math.round(history.data.buckets.length / expected * 100)}%`);
  } else {
    setText("monitor-diag-samples", "—");
    setText("monitor-diag-coverage", "—");
  }
  const age = lastSnapshotTs ? Date.now() - lastSnapshotTs : Infinity;
  setText("monitor-diag-status", !snapshot.ok || !history.ok
    ? snapshot.error || history.error || ui("checkError", "No se pudo comprobar el servidor.")
    : age > 60_000
      ? ui("staleMetric", "La última métrica tiene más de un minuto. Revisa la conexión o la recolección.")
      : ui("recentReading", "Lectura reciente disponible. La cobertura refleja solo las muestras guardadas."));
}

function bind(): void {
  if (bound) return;
  bound = true;
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !byId("monitor-settings-modal")) return;
    const tab = target.closest<HTMLElement>("[data-monitor-settings-nav]");
    if (tab?.dataset.monitorSettingsNav) { showPanel(tab.dataset.monitorSettingsNav); return; }
    if (target.closest("#monitor-alert-cancel")) { resetForm(); return; }
    if (target.closest("#monitor-export-history")) { void exportHistory(); return; }
    if (target.closest("#monitor-diag-refresh")) { void refreshDiagnostics(); return; }
    if (target.closest("#monitor-settings-modal-trigger")) reflectPrefs();
  });
  document.addEventListener("change", (event) => {
    const field = event.target instanceof HTMLElement ? event.target.closest<HTMLInputElement | HTMLSelectElement>("[data-monitor-pref]") : null;
    if (!field || !byId("monitor-settings-modal")) return;
    const key = field.dataset.monitorPref;
    if (key === "compare" && field instanceof HTMLInputElement) saveMonitorPrefs({ compare: field.checked });
    else if (key === "range") saveMonitorPrefs({ range: field.value as MonitorPrefs["range"] });
    else if (key === "metric") saveMonitorPrefs({ metric: field.value as MonitorPrefs["metric"] });
    else if (key === "historyRefreshSeconds") saveMonitorPrefs({ historyRefreshSeconds: Number(field.value) as MonitorPrefs["historyRefreshSeconds"] });
    else if (key === "processesRefreshSeconds") saveMonitorPrefs({ processesRefreshSeconds: Number(field.value) as MonitorPrefs["processesRefreshSeconds"] });
  });
  document.addEventListener("submit", (event) => {
    if (event.target instanceof HTMLFormElement && event.target.id === "monitor-alert-form") void saveRule(event);
  });
  window.addEventListener("lxp:monitor:snapshot", (event) => {
    lastSnapshotTs = (event as CustomEvent<{ ts: number }>).detail.ts;
    setText("monitor-diag-snapshot", dateTime(lastSnapshotTs));
  });
  window.addEventListener("lxp:monitor:processes-updated", (event) => {
    lastProcessesTs = (event as CustomEvent<{ ts: number }>).detail.ts;
    setText("monitor-diag-processes", dateTime(lastProcessesTs));
  });
  window.addEventListener("luxipanel:target-changed", () => {
    rules = new Map();
    lastSnapshotTs = null;
    lastProcessesTs = null;
    renderRules();
    renderEvents([]);
    setText("monitor-diag-snapshot", "—");
    setText("monitor-diag-processes", "—");
    setText("monitor-diag-samples", "—");
    setText("monitor-diag-coverage", "—");
    setTimeout(reflectPrefs, 0);
  });
}

function init(): void {
  if (!byId("monitor-settings-modal")) return;
  loadI18n();
  bind();
  reflectPrefs();
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
