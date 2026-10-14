import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { DATATABLE_EVENTS, createTableFeed } from "/scripts/extracted/lib/datatable-events.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";
import { $ } from "/scripts/extracted/lib/dom.js";
import { tsOf } from "/scripts/extracted/lib/time.js";
import { highlightUnderlineTabs, setPaneVisibilityById } from "/scripts/extracted/lib/tabs.js";
import { tabDirection } from "/scripts/extracted/lib/dom.js";
const rulePages = createTablePages({ aliases:{lastFiredTs:"lastFiredAt",cooldownTs:"cooldownMinutes"},values:()=>({metric:Object.fromEntries(["cpu","ram","disk","load","service-down"].map(metric=>[metricLabel(metric as RuleMetric),metric]))}), tableId: "sa-rules-table", events: window, scope: resolveTargetScope, reload: () => loadRules(), field: "auto" });
const scheduledPages = createTablePages({ aliases:{lastFiredTs:"lastFiredAt"}, tableId: "sa-scheduled-table", events: window, scope: resolveTargetScope, reload: () => loadScheduled(), field: "auto" });

// ── i18n (F-03/T-08: trío compartido, solo cambia el id del payload) ─────────
const { loadI18n, t, fmt } = createPageI18n("server-alerts-i18n");

// ── Types (mirror backend models) ──────────────────────────────────────────
interface AlertPrefs {
  enabled: boolean;
  manual: boolean;
  scheduled: boolean;
  rules: boolean;
  web: boolean;
  mobile: boolean;
}
interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  scheduleAt?: string | null;
  cron?: string | null;
  timeZone?: string | null;
  recurring: boolean;
  enabled: boolean;
  signals?: string[] | null;
  createdAt: string;
  lastFiredAt?: string | null;
}
type RuleMetric = "cpu" | "ram" | "disk" | "load" | "service-down";
type RuleOp = ">=" | "<=" | "==" | "down";
interface MetricRule {
  id: string;
  name: string;
  metric: RuleMetric;
  op: RuleOp;
  threshold?: number | null;
  service?: string | null;
  cooldownMinutes: number;
  enabled: boolean;
  lastFiredAt?: string | null;
  createdAt: string;
}

type Tab = "prefs" | "send" | "scheduled" | "rules" | "history";
type SchedMode = "once" | "cron";

const state = {
  tab: "prefs" as Tab,
  prefs: null as AlertPrefs | null,
  scheduled: [] as ScheduledNotification[],
  rules: [] as MetricRule[],
  schedMode: "once" as SchedMode,
  scheduledLoaded: false,
  rulesLoaded: false,
  editingScheduledId: "" as string,
  editingTimeZone: "" as string,
  editingRuleId: "" as string,
  historyPage: 1,
  historyTotal: 0,
};

// ── Alimentación de los DataTables (cache por tableId + flag ready) ──────────
const SCHEDULED_TABLE_ID = "sa-scheduled-table";
const RULES_TABLE_ID = "sa-rules-table";
const feed = createTableFeed([SCHEDULED_TABLE_ID, RULES_TABLE_ID]);

function publishRows(tableId: string, rows: Record<string, unknown>[]) {
  feed.publish(tableId, rows);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
// F-02: `esc` es ahora el escapador canónico de 5 caracteres (también escapa `'`).
const esc = escapeHtml;

// F-04: toast compartido; esta página usa la variante plana de 3500 ms (default).
const showToast = showSharedToast;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString(document.documentElement.lang || undefined);
}

/** Local <input type="datetime-local"> value → ISO (UTC) string. */
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v); // interpreted as local time
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ── Tabs (estilo modules: underline + count badge) ────────────────────
// E-03: cuerpo compartido en /scripts/extracted/lib/tabs.js.
function highlightTabs() {
  highlightUnderlineTabs(".tab-btn[data-tab]", (b) => b.dataset.tab === state.tab);
  document.querySelectorAll<HTMLButtonElement>(".tab-btn[data-tab]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.tab === state.tab));
  });
}

function updateServerAlertsTabCounts() {
  const prefsBadge = document.getElementById("tab-prefs-count");
  const sendBadge = document.getElementById("tab-send-count");
  const schedBadge = document.getElementById("tab-scheduled-count");
  const rulesBadge = document.getElementById("tab-rules-count");
  // Tabs con tabla → nº de filas. Tabs sin tabla (formularios) → "—".
  if (prefsBadge) prefsBadge.textContent = "—";
  if (sendBadge) sendBadge.textContent = "—";
  if (schedBadge) schedBadge.textContent = String(state.scheduled.length);
  if (rulesBadge) rulesBadge.textContent = String(state.rules.length);
}

function showTab(tab: Tab) {
  const order = ["prefs", "send", "scheduled", "rules", "history"] as const;
  const direction = tabDirection(order.indexOf(state.tab as typeof order[number]), order.indexOf(tab as typeof order[number]));
  state.tab = tab;
  highlightTabs();
  // E-03: mismo cuerpo que cloudflare/tabs.ts `showTab` salvo prefijo y flexPanes.
  setPaneVisibilityById(order, tab, {
    idFor: (id) => `sa-pane-${id}`,
    flexIds: ["prefs", "send"],
    direction,
  });
}

function setTab(tab: Tab) {
  showTab(tab);
  if (tab === "scheduled" && !state.scheduledLoaded) void loadScheduled();
  else if (tab === "rules" && !state.rulesLoaded) void loadRules();
  else if (tab === "history") void loadHistory(1);
}

// ── Own preferences, devices and delivery history ───────────────────────────
function checked(id: string): boolean { return ($(id) as HTMLInputElement | null)?.checked ?? false; }
function setStatus(id: string, message: string) { const el = $(id); if (el) el.textContent = message; }

async function loadPrefs() {
  const res = await api.get<AlertPrefs>("/api/server-alerts/me/preferences");
  if (!res.ok || !res.data) { showToast(res.error ?? t("common.error", "Error"), false); return; }
  state.prefs = res.data;
  applyPrefsUI();
  updateServerAlertsTabCounts();
}

function applyPrefsUI() {
  const p = state.prefs;
  if (!p) return;
  for (const key of ["enabled", "manual", "scheduled", "rules", "web", "mobile"] as const) {
    const el = $(`sa-pref-${key}`) as HTMLInputElement | null;
    if (el) el.checked = p[key] !== false;
  }
  setStatus("sa-overview-prefs", p.enabled ? t("overview.active", "Activos") : t("overview.paused", "Pausados"));
}

async function savePrefs() {
  const body: AlertPrefs = {
    enabled: checked("sa-pref-enabled"), manual: checked("sa-pref-manual"),
    scheduled: checked("sa-pref-scheduled"), rules: checked("sa-pref-rules"),
    web: checked("sa-pref-web"), mobile: checked("sa-pref-mobile"),
  };
  const buttons = [$("sa-prefs-save"), $("sa-channels-save")].filter((el): el is HTMLButtonElement => el instanceof HTMLButtonElement);
  buttons.forEach((btn) => { btn.disabled = true; });
  const res = await api.put<AlertPrefs>("/api/server-alerts/me/preferences", body);
  buttons.forEach((btn) => { btn.disabled = false; });
  if (!res.ok || !res.data) { showToast(res.error ?? t("common.error", "Error"), false); return; }
  state.prefs = res.data;
  applyPrefsUI();
  setStatus("sa-prefs-status", t("prefs.saved", "Preferencias guardadas"));
  showToast(t("prefs.saved", "Preferencias guardadas"));
}

async function loadChannels() {
  const res = await api.get<{ publicKey: string; devices: { web: number; mobile: number } }>("/api/server-alerts/channels");
  if (!res.ok || !res.data) { setStatus("sa-channel-status", res.error ?? t("common.error", "Error")); return; }
  const d = res.data.devices;
  setStatus("sa-channel-status", `${t("settings.web", "Navegadores")}: ${d.web} · ${t("settings.mobile", "Móviles")}: ${d.mobile}`);
  setStatus("sa-overview-devices", `${d.web + d.mobile} (${d.web} web · ${d.mobile} app)`);
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function enableWebPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) { showToast(t("settings.webUnsupported", "Este navegador no admite notificaciones push"), false); return; }
  const key = await api.get<{ publicKey: string }>("/api/server-alerts/channels");
  if (!key.ok || !key.data?.publicKey) { showToast(key.error ?? t("common.error", "Error"), false); return; }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { showToast(t("settings.permissionDenied", "Debes permitir las notificaciones en el navegador"), false); return; }
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key.data.publicKey) });
    const saved = await api.post("/api/server-alerts/devices/web", subscription.toJSON());
    if (!saved.ok) { showToast(saved.error ?? t("common.error", "Error"), false); return; }
    await loadChannels();
    showToast(t("settings.webEnabled", "Navegador activado"));
  } catch (err) { showToast(err instanceof Error ? err.message : t("common.error", "Error"), false); }
}

async function disableWebPush() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) { showToast(t("settings.webDisabled", "Este navegador ya no está registrado")); return; }
    const removed = await api.delete("/api/server-alerts/devices/web", { value: subscription.endpoint });
    if (!removed.ok) { showToast(removed.error ?? t("common.error", "Error"), false); return; }
    await subscription.unsubscribe();
    await loadChannels();
    showToast(t("settings.webDisabled", "Navegador quitado"));
  } catch (err) { showToast(err instanceof Error ? err.message : t("common.error", "Error"), false); }
}

async function sendTest() {
  const btn = $("sa-test-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const res = await api.post<{ panel: number; sent: { web: number; expo: number }; errors: string[] }>("/api/server-alerts/test", {});
  if (btn) btn.disabled = false;
  if (!res.ok || !res.data) { setStatus("sa-test-result", res.error ?? t("common.error", "Error")); return; }
  const d = res.data;
  setStatus("sa-test-result", `${t("history.panel", "Panel")}: ${d.panel} · Web: ${d.sent.web} · App: ${d.sent.expo}${d.errors.length ? ` · ${d.errors.join("; ")}` : ""}`);
  void loadHistory(1);
}

interface DeliveryRow { id: string; title: string; category: string; panel: string; web: string; mobile: string; createdAt: string; webError?: string | null; mobileError?: string | null }
function deliveryStateLabel(value: string): string { return t(`history.states.${value}`, value); }
async function loadHistory(page: number) {
  const res = await api.get<{ data: DeliveryRow[]; total: number }>(`/api/server-alerts/history?page=${page}`);
  const list = $("sa-history-list");
  if (!list) return;
  if (!res.ok || !res.data) { list.textContent = res.error ?? t("common.error", "Error"); return; }
  state.historyPage = page;
  state.historyTotal = res.data.total;
  if (page === 1) list.innerHTML = "";
  if (page === 1 && !res.data.data.length) list.textContent = t("history.empty", "Todavía no hay avisos enviados.");
  for (const row of res.data.data) {
    const item = document.createElement("article");
    item.className = "rounded-xl border border-border bg-card p-4";
    const status = (label: string, value: string) => `<span class="rounded-full border border-border px-2 py-0.5 text-xs">${esc(label)}: ${esc(value)}</span>`;
    item.innerHTML = `<div class="flex flex-wrap items-start justify-between gap-2"><strong class="text-sm text-foreground">${esc(row.title)}</strong><time class="text-xs text-muted-foreground">${esc(fmtDate(row.createdAt))}</time></div><div class="mt-3 flex flex-wrap gap-2">${status(t("history.panel", "Panel"), deliveryStateLabel(row.panel))}${status("Web", deliveryStateLabel(row.web))}${status("App", deliveryStateLabel(row.mobile))}</div>${row.webError || row.mobileError ? `<p class="mt-2 text-xs text-destructive">${esc([row.webError, row.mobileError].filter(Boolean).join(" · "))}</p>` : ""}`;
    list.appendChild(item);
  }
  const more = $("sa-history-more") as HTMLButtonElement | null;
  more?.classList.toggle("hidden", page * 25 >= res.data.total);
  setStatus("sa-overview-last", res.data.data[0] ? fmtDate(res.data.data[0].createdAt) : "—");
}

function showSettingsSection(section: string) {
  document.querySelectorAll<HTMLElement>("[data-salerts-settings-nav]").forEach((btn) => {
    const active = btn.dataset.salertsSettingsNav === section;
    btn.classList.toggle("bg-primary/10", active);
    btn.classList.toggle("text-primary", active);
    btn.classList.toggle("text-muted-foreground", !active);
    btn.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll<HTMLElement>("[data-salerts-settings-view]").forEach((view) => view.classList.toggle("hidden", view.dataset.salertsSettingsView !== section));
  if (section === "channels") void loadChannels();
}

// ── Send now ─────────────────────────────────────────────────────────────────
function parseSignals(id: string): string[] {
  return (($(id) as HTMLInputElement | null)?.value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 16);
}

async function sendNow() {
  const title = ($("sa-send-title") as HTMLInputElement | null)?.value.trim() ?? "";
  const bodyText = ($("sa-send-body") as HTMLTextAreaElement | null)?.value.trim() ?? "";
  if (!title || !bodyText) {
    showToast(t("send.required", "Título y mensaje son obligatorios"), false);
    return;
  }
  const signals = parseSignals("sa-send-signals");
  const body: Record<string, unknown> = { title, body: bodyText };
  if (signals.length) body.signals = signals;

  const btn = $("sa-send-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const res = await api.post("/api/server-alerts/send", body);
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  const delivery = res.data as { panel?: number; sent?: { web?: number; expo?: number } } | undefined;
  if (delivery) showToast(`${t("send.sent", "Notificación enviada")}: ${delivery.panel ?? 0} panel · ${delivery.sent?.web ?? 0} web · ${delivery.sent?.expo ?? 0} app`);
  void loadHistory(1);
  const titleEl = $("sa-send-title") as HTMLInputElement | null;
  const bodyEl = $("sa-send-body") as HTMLTextAreaElement | null;
  const sigEl = $("sa-send-signals") as HTMLInputElement | null;
  if (titleEl) titleEl.value = "";
  if (bodyEl) bodyEl.value = "";
  if (sigEl) sigEl.value = "";
}

// ── Scheduled notifications ────────────────────────────────────────────────
async function loadScheduled() {
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_LOADING, { detail: { tableId: SCHEDULED_TABLE_ID, loading: true } }));
  const res = await scheduledPages.read<ScheduledNotification[]>(params => api.get<ScheduledNotification[]>("/api/server-alerts/scheduled", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    publishRows(SCHEDULED_TABLE_ID, []);
    return;
  }
  state.scheduled = res.data ?? [];
  state.scheduledLoaded = true;
  renderScheduled();
}

function renderScheduled() {
  const rows = state.scheduled.map((s) => ({
    id: s.id,
    title: s.title,
    when: s.cron ? `${s.cron} · ${s.timeZone ?? "UTC"}` : fmtDate(s.scheduleAt),
    recurring: s.recurring,
    enabled: s.enabled,
    lastFired: fmtDate(s.lastFiredAt),
    lastFiredTs: tsOf(s.lastFiredAt),
    // Metadato para el handler de borrado (no es columna).
    _id: s.id,
  }));
  publishRows(SCHEDULED_TABLE_ID, rows);
  updateServerAlertsTabCounts();
}

function setSchedMode(mode: SchedMode) {
  state.schedMode = mode;
  document.querySelectorAll<HTMLButtonElement>(".sa-sched-mode").forEach((b) => {
    const active = b.dataset.schedMode === mode;
    b.classList.toggle("bg-background", active);
    b.classList.toggle("shadow-sm", active);
    b.classList.toggle("text-foreground", active);
    b.classList.toggle("text-muted-foreground", !active);
  });
  $("sa-sched-once-wrap")?.classList.toggle("hidden", mode !== "once");
  $("sa-sched-cron-wrap")?.classList.toggle("hidden", mode !== "cron");
}

function openSchedDialog() {
  const dlg = $("dlg-sa-sched") as HTMLDialogElement | null;
  if (!dlg) return;
  state.editingScheduledId = "";
  state.editingTimeZone = "";
  const titleEl = $("sa-sched-title") as HTMLInputElement | null;
  const bodyEl = $("sa-sched-body") as HTMLTextAreaElement | null;
  const atEl = $("sa-sched-at") as HTMLInputElement | null;
  const cronEl = $("sa-sched-cron") as HTMLInputElement | null;
  const recEl = $("sa-sched-recurring") as HTMLInputElement | null;
  const enEl = $("sa-sched-enabled") as HTMLInputElement | null;
  if (titleEl) titleEl.value = "";
  if (bodyEl) bodyEl.value = "";
  if (atEl) atEl.value = "";
  if (cronEl) cronEl.value = "";
  if (recEl) recEl.checked = false;
  if (enEl) enEl.checked = true;
  setSchedMode("once");
  setStatus("sa-sched-timezone", `${t("scheduled.timeZone", "Zona horaria")}: ${Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"}`);
  if (!dlg.open) dlg.showModal();
}

function editScheduled(id: string) {
  const row = state.scheduled.find((item) => item.id === id);
  if (!row) return;
  openSchedDialog();
  state.editingScheduledId = id;
  state.editingTimeZone = row.timeZone || "UTC";
  setStatus("sa-sched-timezone", `${t("scheduled.timeZone", "Zona horaria")}: ${state.editingTimeZone}`);
  const title = $("sa-sched-title") as HTMLInputElement | null;
  const body = $("sa-sched-body") as HTMLTextAreaElement | null;
  const at = $("sa-sched-at") as HTMLInputElement | null;
  const cron = $("sa-sched-cron") as HTMLInputElement | null;
  const enabled = $("sa-sched-enabled") as HTMLInputElement | null;
  if (title) title.value = row.title;
  if (body) body.value = row.body;
  if (row.cron) { setSchedMode("cron"); if (cron) cron.value = row.cron; }
  else if (at && row.scheduleAt) {
    const d = new Date(row.scheduleAt);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    at.value = local.toISOString().slice(0, 16);
  }
  if (enabled) enabled.checked = row.enabled;
}

async function saveScheduled() {
  const title = ($("sa-sched-title") as HTMLInputElement | null)?.value.trim() ?? "";
  const bodyText = ($("sa-sched-body") as HTMLTextAreaElement | null)?.value.trim() ?? "";
  if (!title || !bodyText) {
    showToast(t("scheduled.required", "Título y mensaje son obligatorios"), false);
    return;
  }
  const body: Record<string, unknown> = {
    title,
    body: bodyText,
    recurring: ($("sa-sched-recurring") as HTMLInputElement | null)?.checked ?? false,
    enabled: ($("sa-sched-enabled") as HTMLInputElement | null)?.checked ?? true,
  };
  if (state.schedMode === "cron") {
    const cron = ($("sa-sched-cron") as HTMLInputElement | null)?.value.trim() ?? "";
    if (!cron) {
      showToast(t("scheduled.cronRequired", "Indica una expresión cron de 5 campos"), false);
      return;
    }
    body.cron = cron;
    body.scheduleAt = null;
    body.timeZone = state.editingTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } else {
    const iso = localInputToIso(($("sa-sched-at") as HTMLInputElement | null)?.value ?? "");
    if (!iso) {
      showToast(t("scheduled.atRequired", "Indica fecha y hora"), false);
      return;
    }
    body.scheduleAt = iso;
    body.cron = null;
    if (new Date(iso).getTime() <= Date.now()) { showToast(t("scheduled.future", "Elige una fecha futura"), false); return; }
    body.timeZone = null;
  }

  const btn = $("sa-sched-save") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const res = state.editingScheduledId
    ? await api.put(`/api/server-alerts/scheduled/${encodeURIComponent(state.editingScheduledId)}`, body)
    : await api.post("/api/server-alerts/scheduled", body);
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  ($("dlg-sa-sched") as HTMLDialogElement | null)?.close();
  showToast(t("scheduled.created", "Notificación programada creada"));
  void loadScheduled();
}

async function toggleScheduled(id: string) {
  const row = state.scheduled.find((item) => item.id === id);
  if (!row) return;
  const res = await api.put(`/api/server-alerts/scheduled/${encodeURIComponent(id)}`, { enabled: !row.enabled });
  if (!res.ok) { showToast(res.error ?? t("common.error", "Error"), false); return; }
  void loadScheduled();
}

async function deleteScheduled(id: string) {
  const s = state.scheduled.find((x) => x.id === id);
  if (!s) return;
  if (!(await openConfirm(fmt(t("scheduled.confirmDelete", "¿Eliminar la notificación {name}?"), { name: s.title }), { title: t("scheduled.confirmDeleteTitle", "Eliminar notificación"), confirmText: t("common.delete", "Eliminar"), variant: "danger" }))) return;
  const res = await api.delete(`/api/server-alerts/scheduled/${encodeURIComponent(s.id)}`);
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("scheduled.deleted", "Notificación eliminada"));
  void loadScheduled();
}

// ── Metric rules ─────────────────────────────────────────────────────────────
async function loadRules() {
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_LOADING, { detail: { tableId: RULES_TABLE_ID, loading: true } }));
  const res = await rulePages.read<MetricRule[]>(params => api.get<MetricRule[]>("/api/server-alerts/rules", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    publishRows(RULES_TABLE_ID, []);
    return;
  }
  state.rules = res.data ?? [];
  state.rulesLoaded = true;
  renderRules();
}

function metricLabel(m: RuleMetric): string {
  switch (m) {
    case "cpu": return t("rules.metricCpu", "CPU");
    case "ram": return t("rules.metricRam", "RAM");
    case "disk": return t("rules.metricDisk", "Disco");
    case "load": return t("rules.metricLoad", "Carga");
    case "service-down": return t("rules.metricServiceDown", "Servicio caído");
  }
}

function ruleCondition(r: MetricRule): string {
  if (r.metric === "service-down") {
    return `${r.service ?? ""} ${t("rules.isDown", "caído")}`.trim();
  }
  const unit = r.metric === "load" ? "" : "%";
  return `${r.op} ${r.threshold ?? ""}${unit}`.trim();
}

function renderRules() {
  const rows = state.rules.map((r) => ({
    id: r.id,
    name: r.name,
    metric: metricLabel(r.metric),
    condition: ruleCondition(r),
    cooldown: `${r.cooldownMinutes} ${t("rules.minutes", "min")}`,
    cooldownTs: Number.isFinite(r.cooldownMinutes) ? r.cooldownMinutes : 0,
    enabled: r.enabled,
    lastFired: fmtDate(r.lastFiredAt),
    lastFiredTs: tsOf(r.lastFiredAt),
    // Metadato para el handler de borrado (no es columna).
    _id: r.id,
  }));
  publishRows(RULES_TABLE_ID, rows);
  updateServerAlertsTabCounts();
}

/** Show/hide threshold vs service fields + force op according to metric. */
function updateRuleFieldVisibility() {
  const metric = (($("sa-rule-metric") as HTMLSelectElement | null)?.value ?? "cpu") as RuleMetric;
  const isDown = metric === "service-down";
  $("sa-rule-threshold-wrap")?.classList.toggle("hidden", isDown);
  $("sa-rule-service-wrap")?.classList.toggle("hidden", !isDown);
  const opSel = $("sa-rule-op") as HTMLSelectElement | null;
  if (opSel) {
    opSel.disabled = isDown;
    if (isDown) opSel.value = "down";
    else if (opSel.value === "down") opSel.value = ">=";
  }
}

function openRuleDialog() {
  const dlg = $("dlg-sa-rule") as HTMLDialogElement | null;
  if (!dlg) return;
  state.editingRuleId = "";
  const nameEl = $("sa-rule-name") as HTMLInputElement | null;
  const metricEl = $("sa-rule-metric") as HTMLSelectElement | null;
  const opEl = $("sa-rule-op") as HTMLSelectElement | null;
  const thEl = $("sa-rule-threshold") as HTMLInputElement | null;
  const svcEl = $("sa-rule-service") as HTMLInputElement | null;
  const cdEl = $("sa-rule-cooldown") as HTMLInputElement | null;
  const enEl = $("sa-rule-enabled") as HTMLInputElement | null;
  if (nameEl) nameEl.value = "";
  if (metricEl) metricEl.value = "cpu";
  if (opEl) opEl.value = ">=";
  if (thEl) thEl.value = "";
  if (svcEl) svcEl.value = "";
  if (cdEl) cdEl.value = "15";
  if (enEl) enEl.checked = true;
  updateRuleFieldVisibility();
  if (!dlg.open) dlg.showModal();
}

function editRule(id: string) {
  const row = state.rules.find((item) => item.id === id);
  if (!row) return;
  openRuleDialog();
  state.editingRuleId = id;
  const values: Record<string, string> = {
    "sa-rule-name": row.name, "sa-rule-metric": row.metric, "sa-rule-op": row.op,
    "sa-rule-threshold": row.threshold == null ? "" : String(row.threshold),
    "sa-rule-service": row.service ?? "", "sa-rule-cooldown": String(row.cooldownMinutes),
  };
  for (const [id, value] of Object.entries(values)) { const el = $(id) as HTMLInputElement | HTMLSelectElement | null; if (el) el.value = value; }
  const enabled = $("sa-rule-enabled") as HTMLInputElement | null;
  if (enabled) enabled.checked = row.enabled;
  updateRuleFieldVisibility();
}

async function saveRule() {
  const name = ($("sa-rule-name") as HTMLInputElement | null)?.value.trim() ?? "";
  const metric = (($("sa-rule-metric") as HTMLSelectElement | null)?.value ?? "cpu") as RuleMetric;
  const op = (($("sa-rule-op") as HTMLSelectElement | null)?.value ?? ">=") as RuleOp;
  if (!name) {
    showToast(t("rules.nameRequired", "Indica un nombre"), false);
    return;
  }
  const body: Record<string, unknown> = { name, metric, op };

  const cdRaw = ($("sa-rule-cooldown") as HTMLInputElement | null)?.value.trim() ?? "";
  if (cdRaw !== "") {
    const cd = Number(cdRaw);
    if (Number.isFinite(cd)) body.cooldownMinutes = Math.trunc(cd);
  }
  body.enabled = ($("sa-rule-enabled") as HTMLInputElement | null)?.checked ?? true;

  if (metric === "service-down") {
    const service = ($("sa-rule-service") as HTMLInputElement | null)?.value.trim() ?? "";
    if (!service) {
      showToast(t("rules.serviceRequired", "Indica el nombre del servicio (unidad systemd)"), false);
      return;
    }
    body.service = service;
    body.op = "down";
  } else {
    const thRaw = ($("sa-rule-threshold") as HTMLInputElement | null)?.value.trim() ?? "";
    if (thRaw === "") {
      showToast(t("rules.thresholdRequired", "Indica un umbral"), false);
      return;
    }
    const th = Number(thRaw);
    if (!Number.isFinite(th)) {
      showToast(t("rules.thresholdRequired", "Indica un umbral"), false);
      return;
    }
    body.threshold = th;
  }

  const btn = $("sa-rule-save") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const res = state.editingRuleId
    ? await api.put(`/api/server-alerts/rules/${encodeURIComponent(state.editingRuleId)}`, body)
    : await api.post("/api/server-alerts/rules", body);
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  ($("dlg-sa-rule") as HTMLDialogElement | null)?.close();
  showToast(t("rules.created", "Regla creada"));
  void loadRules();
}

async function toggleRule(id: string) {
  const row = state.rules.find((item) => item.id === id);
  if (!row) return;
  const res = await api.put(`/api/server-alerts/rules/${encodeURIComponent(id)}`, { enabled: !row.enabled });
  if (!res.ok) { showToast(res.error ?? t("common.error", "Error"), false); return; }
  void loadRules();
}

async function deleteRule(id: string) {
  const r = state.rules.find((x) => x.id === id);
  if (!r) return;
  if (!(await openConfirm(fmt(t("rules.confirmDelete", "¿Eliminar la regla {name}?"), { name: r.name }), { title: t("rules.confirmDeleteTitle", "Eliminar regla"), confirmText: t("common.delete", "Eliminar"), variant: "danger" }))) return;
  const res = await api.delete(`/api/server-alerts/rules/${encodeURIComponent(r.id)}`);
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("rules.deleted", "Regla eliminada"));
  void loadRules();
}

// ── Bind static controls (delegated → survives SPA swaps) ────────────────────
function bindOnce() {
  if ((window as any).__lxpSaBound) return;
  (window as any).__lxpSaBound = true;

  document.addEventListener("click", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el) return;

    // The tab strip renders `.tab-btn[data-tab]` (no `.sa-tab` class) — accept both
    // so clicks (and the super buscador deep-link) actually switch the tab.
    const tabBtn = el.closest<HTMLButtonElement>(".sa-tab, .tab-btn[data-tab]");
    if (tabBtn?.dataset.tab) {
      setTab(tabBtn.dataset.tab as Tab);
      return;
    }

    const settingsNav = el.closest<HTMLButtonElement>("[data-salerts-settings-nav]");
    if (settingsNav?.dataset.salertsSettingsNav) { showSettingsSection(settingsNav.dataset.salertsSettingsNav); return; }

    const schedModeBtn = el.closest<HTMLButtonElement>(".sa-sched-mode");
    if (schedModeBtn?.dataset.schedMode) {
      setSchedMode(schedModeBtn.dataset.schedMode as SchedMode);
      return;
    }

    // Las acciones de fila (borrar) viven ahora en el DataTable: ver
    // bindTableEvents() (`lxp:data-table:row-action`).

    const btn = el.closest<HTMLButtonElement>("button[id]");
    if (!btn) return;
    switch (btn.id) {
      case "sa-prefs-save":
      case "sa-channels-save":
        void savePrefs();
        break;
      case "sa-open-settings":
        ($("server-alerts-settings-modal-trigger") as HTMLButtonElement | null)?.click();
        break;
      case "sa-web-enable":
        void enableWebPush();
        break;
      case "sa-web-disable":
        void disableWebPush();
        break;
      case "sa-test-btn":
        void sendTest();
        break;
      case "sa-history-refresh":
        void loadHistory(1);
        break;
      case "sa-history-more":
        void loadHistory(state.historyPage + 1);
        break;
      case "sa-send-btn":
        void sendNow();
        break;
      // Scheduled dialog
      case "sa-sched-add":
        openSchedDialog();
        break;
      case "sa-sched-save":
        void saveScheduled();
        break;
      case "sa-sched-cancel":
      case "sa-sched-x":
        ($("dlg-sa-sched") as HTMLDialogElement | null)?.close();
        break;
      // Rule dialog
      case "sa-rule-add":
        openRuleDialog();
        break;
      case "sa-rule-save":
        void saveRule();
        break;
      case "sa-rule-cancel":
      case "sa-rule-x":
        ($("dlg-sa-rule") as HTMLDialogElement | null)?.close();
        break;
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target as HTMLElement | null;
    if (el?.id === "sa-rule-metric") updateRuleFieldVisibility();
  });
}

// ── DataTable events (ready + row actions, gateados por tableId) ─────────────
let tableEventsBound = false;
function bindTableEvents() {
  if (tableEventsBound) return;
  tableEventsBound = true;

  feed.bindReady();

  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<{ tableId?: string; actionId?: string; row?: Record<string, unknown> }>).detail;
    const row = detail?.row;
    if (!row || !detail?.actionId) return;
    const id = String(row._id ?? "");
    if (!id) return;
    if (detail.tableId === SCHEDULED_TABLE_ID) {
      if (detail.actionId === "delete") void deleteScheduled(id);
      else if (detail.actionId === "edit") editScheduled(id);
      else if (detail.actionId === "toggle") void toggleScheduled(id);
    } else if (detail.tableId === RULES_TABLE_ID) {
      if (detail.actionId === "delete") void deleteRule(id);
      else if (detail.actionId === "edit") editRule(id);
      else if (detail.actionId === "toggle") void toggleRule(id);
    }
  });
}

// ── SPA-safe init (module-eval + astro:after-swap + astro:page-load) ──────────
let initLastAt = 0;
let lastTargetScope = "";
const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
function init() {
  // Anchor element unique to this page.
  if (!document.querySelector(".tab-btn[data-tab='prefs'],#sa-pane-scheduled,#sa-pane-rules")) return;
  loadI18n();
  bindOnce();
  bindTableEvents();
  wireServerAlertsTableConfig();
  // Handshake con los DataTables: si el componente React despachó `ready`
  // antes de evaluar este script, ese evento se perdió; re-abrimos el canal
  // por cada tableId y él responde con `ready` (→ set-data desde la caché).
  feed.requestReady();
  const requestedView = new URLSearchParams(location.search).get("workspaceView") as Tab | null;
  const drawerTab: Tab = requestedView && ["prefs", "send", "scheduled", "rules", "history"].includes(requestedView) ? requestedView : "prefs";
  showTab(drawerTab);
  showSettingsSection("prefs");
  const targetScope = resolveTargetScope();
  if (targetScope !== lastTargetScope) {
    lastTargetScope = targetScope;
    initLastAt = 0;
    state.prefs = null;
    state.scheduled = [];
    state.rules = [];
    publishRows(SCHEDULED_TABLE_ID, []);
    publishRows(RULES_TABLE_ID, []);
  }
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) {
    // Cooldown: data likely already in memory from the previous mount.
    if (state.prefs) applyPrefsUI();
    return;
  }
  initLastAt = Date.now();
  state.scheduledLoaded = false;
  state.rulesLoaded = false;
  if (drawerTab === "prefs" || drawerTab === "send") { void loadPrefs(); void loadChannels(); }
  if (drawerTab === "scheduled") void loadScheduled();
  if (drawerTab === "rules") void loadRules();
  if (drawerTab === "history") void loadHistory(1);
}
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();

// ── Configuración de tablas (drawer) ────────────────────────────────────────
// Cada bloque [data-sa-table] controla las prefs de una tabla mediante el
// contrato genérico del DataTable: localStorage `lxp:data-table:prefs:<id>` +
// evento `lxp:data-table:apply-prefs`.
function wireServerAlertsTableConfig() {
  const PS_KEY = (id: string) => `lxp:data-table:prefs:${id}`;
  function read(id: string): { pageSize: number; hiddenActions: string[] } {
    try {
      const raw = localStorage.getItem(PS_KEY(id));
      if (raw) {
        const c = JSON.parse(raw);
        return { pageSize: Number(c.pageSize) || 25, hiddenActions: Array.isArray(c.hiddenActions) ? c.hiddenActions.map(String) : [] };
      }
    } catch { /* noop */ }
    return { pageSize: 25, hiddenActions: [] };
  }
  function apply(id: string, cfg: { pageSize: number; hiddenActions: string[] }) {
    try { localStorage.setItem(PS_KEY(id), JSON.stringify(cfg)); } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent("lxp:data-table:apply-prefs", { detail: { tableId: id, pageSize: cfg.pageSize, hiddenActions: cfg.hiddenActions } }));
  }
  document.querySelectorAll<HTMLElement>("[data-sa-table]").forEach((wrap) => {
    if (wrap.dataset.saConfigBound === "1") return;
    wrap.dataset.saConfigBound = "1";
    const id = wrap.dataset.saTable;
    if (!id) return;
    const cfg = read(id);
    const sizeBtns = Array.from(wrap.querySelectorAll<HTMLButtonElement>("[data-sa-pagesize]"));
    const reflectSize = () => sizeBtns.forEach((b) => {
      const on = Number(b.dataset.saPagesize) === cfg.pageSize;
      b.classList.toggle("bg-primary/10", on);
      b.classList.toggle("text-primary", on);
      b.classList.toggle("text-muted-foreground", !on);
    });
    reflectSize();
    sizeBtns.forEach((b) => b.addEventListener("click", () => {
      cfg.pageSize = Number(b.dataset.saPagesize) || 25;
      reflectSize();
      apply(id, cfg);
    }));
    wrap.querySelectorAll<HTMLInputElement>("[data-sa-action]").forEach((cb) => {
      const aid = cb.dataset.saAction!;
      cb.checked = !cfg.hiddenActions.includes(aid);
      cb.addEventListener("change", () => {
        cfg.hiddenActions = cb.checked ? cfg.hiddenActions.filter((x) => x !== aid) : [...new Set([...cfg.hiddenActions, aid])];
        apply(id, cfg);
      });
    });
  });
}
