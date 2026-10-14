import {readTablePageSize} from "/scripts/extracted/lib/table-pages.js";
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { createPageI18n as planI18n } from "/scripts/extracted/lib/page-i18n.js";
import { openConfirm, openAlert } from "/scripts/extracted/lib/confirm.js?v=3";
import { awaitJob } from "/scripts/extracted/lib/job-poll.js";
import { resolvePanelApiPath, scopeHeaders } from "/scripts/extracted/lib/api-client.js";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { highlightBorderTabs, setPaneVisibilityByData, tabDirectionOf } from "/scripts/extracted/lib/tabs.js";
import { MODULES_INSTALLED_PATH } from "/scripts/extracted/lib/api-routes.js";

// F-03/T-08: trío i18n compartido; solo cambia el id del payload.
const { loadI18n, t, fmt } = createPageI18n("hosting-i18n");

const HOSTING_TABLE_ID = "hosting-accounts-table";
let hostingTableIsReady = false;
let hostingTableCachedRows: any[] = [];
let hostingGeneration = 0;
let targetListenerBound = false;
type HostingDefaults = { plan: string; diskQuotaMb: number; bandwidthQuotaMb: number; maxDomains: number; maxEmailAccounts: number; maxDatabases: number; maxSubUsers: number; jailEnabled: boolean; allowedModules: string[] };
let hostingDefaults: HostingDefaults = { plan: "basic", diskQuotaMb: 10240, bandwidthQuotaMb: 102400, maxDomains: 10, maxEmailAccounts: 20, maxDatabases: 0, maxSubUsers: 0, jailEnabled: false, allowedModules: [] };

function showLoadError(message: string) {
  const banner = document.getElementById("hosting-load-error");
  banner?.classList.toggle("hidden", !message);
  const text = document.getElementById("hosting-load-error-text");
  if (text) text.textContent = message;
}

function reflectDefaults() {
  const fields: Record<string, keyof HostingDefaults> = { plan: "plan", disk: "diskQuotaMb", bandwidth: "bandwidthQuotaMb", domains: "maxDomains", emails: "maxEmailAccounts", databases: "maxDatabases", subusers: "maxSubUsers" };
  for (const [field, key] of Object.entries(fields)) {
    const input = document.getElementById(`host-default-${field}`) as HTMLInputElement | HTMLSelectElement | null;
    if (input) input.value = String(hostingDefaults[key]);
  }
  const jail = document.getElementById("host-default-jail") as HTMLInputElement | null;
  if (jail) jail.checked = hostingDefaults.jailEnabled;
  const modules = document.getElementById("host-default-modules") as HTMLInputElement | null;
  if (modules) modules.value = hostingDefaults.allowedModules.join(", ");
}

async function loadDefaults() {
  const run = hostingGeneration;
  try {
    const res = await fetch(apiPath("/api/hosting/defaults"), { headers: { ...scopeHeaders() } });
    const json = await res.json() as { ok: boolean; data?: HostingDefaults; error?: string };
    if (run !== hostingGeneration) return;
    if (!json.ok || !json.data) throw new Error(json.error || t("runtime.defaultsLoadError", "No se pudieron cargar los valores predeterminados."));
    hostingDefaults = json.data;
    reflectDefaults();
  } catch (err) {
    const status = document.getElementById("host-default-status");
    if (status) { status.textContent = (err as Error).message; status.className = "mt-2 text-xs text-destructive"; }
  }
}

async function saveDefaults() {
  const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
  const values: HostingDefaults = {
    plan: (document.getElementById("host-default-plan") as HTMLSelectElement).value,
    diskQuotaMb: num("host-default-disk"), bandwidthQuotaMb: num("host-default-bandwidth"),
    maxDomains: num("host-default-domains"), maxEmailAccounts: num("host-default-emails"),
    maxDatabases: num("host-default-databases"), maxSubUsers: num("host-default-subusers"),
    jailEnabled: (document.getElementById("host-default-jail") as HTMLInputElement).checked,
    allowedModules: (document.getElementById("host-default-modules") as HTMLInputElement).value.split(",").map((s) => s.trim()).filter(Boolean),
  };
  const status = document.getElementById("host-default-status");
  try {
    const res = await fetch(apiPath("/api/hosting/defaults"), { method: "PUT", headers: { "Content-Type": "application/json", ...scopeHeaders(true) }, body: JSON.stringify(values) });
    const json = await res.json() as { ok: boolean; data?: HostingDefaults; error?: string };
    if (!json.ok || !json.data) throw new Error(json.error || t("runtime.defaultsSaveError", "No se pudieron guardar los valores."));
    hostingDefaults = json.data;
    if (status) { status.textContent = t("runtime.defaultsSaved", "Valores guardados en el servidor activo."); status.className = "mt-2 text-xs text-emerald-600"; }
  } catch (err) {
    if (status) { status.textContent = (err as Error).message; status.className = "mt-2 text-xs text-destructive"; }
  }
}

// ── Helpers ────────────────────────────────────────────────────
// SSOT (F7): every call site passes an `/api/...` path, so the canonical
// `resolvePanelApiPath` (which no-ops non-`/api/` paths) is byte-equivalent here.
const apiPath = resolvePanelApiPath;

function estadoLabel(status: string): string {
  const labels: Record<string, string> = {
    active: t("labels.statusActive", "Activa"),
    suspended: t("labels.statusSuspended", "Suspendida"),
    terminated: t("labels.statusTerminated", "Terminada"),
  };
  return labels[status] ?? status;
}

function fmtDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(document.documentElement.lang || navigator.language || "en", { year: "numeric", month: "short", day: "numeric" });
}


// ── Allowed-modules multi-select (populated from the real module catalog) ─────
// Shell-feature modules that make no sense for a hosting tenant; hidden from the
// selector (they are not granted to tenant accounts).
const HOSTING_MODULE_DENYLIST = new Set(["admin", "modules", "search", "server-switcher", "notifications", "hosting"]);
let allAvailableModules: { module: string; label: string }[] = [];
let moduleCatalogLoaded = false;

async function loadModuleCatalog() {
  if (moduleCatalogLoaded) return;
  try {
    // El selector de módulos permitidos se puebla desde el catálogo público de
    // módulos INSTALADOS+habilitados de la instalación ({id,name,enabled}). Es
    // público (sin permisos de roles), refleja toggles de admin en vivo y es la
    // fuente correcta del envelope (sólo módulos realmente habilitados en el panel).
    const res = await fetch(apiPath(MODULES_INSTALLED_PATH), { headers: { ...scopeHeaders() } });
    const json = await res.json() as { ok: boolean; data?: { id: string; name: string; enabled?: boolean }[] };
    if (!json.ok || !Array.isArray(json.data)) return;
    allAvailableModules = json.data
      .filter((m) => m && typeof m.id === "string" && !HOSTING_MODULE_DENYLIST.has(m.id))
      .map((m) => ({ module: m.id, label: m.name || m.id }));
    moduleCatalogLoaded = true;
    // Re-render with the currently-selected values if the modal is open.
    renderAllowedModulesGrid(getAllowedModulesSelected());
  } catch {
    /* fail-open: leave the loading placeholder */
  }
}

function renderAllowedModulesGrid(selected: string[]) {
  const grid = document.getElementById("f-allowed-modules-grid");
  if (!grid) return;
  if (!moduleCatalogLoaded) {
    grid.innerHTML = `<p class="col-span-full text-xs text-muted-foreground" data-modules-loading>${escapeHtml(t("modal.modulesLoading", "Cargando módulos…"))}</p>`;
    return;
  }
  const sel = new Set(selected);
  grid.innerHTML = allAvailableModules.map((m) => `
    <label class="flex items-center gap-2 text-xs cursor-pointer">
      <input type="checkbox" name="hosting-allowed-module" value="${escapeHtml(m.module)}" ${sel.has(m.module) ? "checked" : ""}
        class="rounded border-border text-primary focus:ring-primary/30" />
      <span class="truncate">${escapeHtml(m.label)}</span>
    </label>`).join("");
}

function getAllowedModulesSelected(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("input[name='hosting-allowed-module']:checked")).map((cb) => cb.value);
}

function publishHostingRows(rows: any[]) {
  const safeRows = Array.isArray(rows) ? rows : [];
  hostingTableCachedRows = safeRows;
  if (!hostingTableIsReady) return;
  window.dispatchEvent(
    new CustomEvent(DATATABLE_EVENTS.SET_DATA, {
      detail: { tableId: HOSTING_TABLE_ID, data: safeRows },
    }),
  );
}

// ── Load accounts ──────────────────────────────────────────────
let hostingPage = 1;
let HOSTING_PAGE_SIZE = readTablePageSize(window,HOSTING_TABLE_ID);
let hostingFilters: Record<string, string> = {};
let hostingSorting: Array<{ id: string; desc: boolean }> = [];
let hostingPageState = { window: true, version:0, total: 0, hasMore: true, loading: false, error: null as string | null, canPrev: false, canNext: false, info: "" };
let hostingWindowData: any[] = [];
let hostingWindowLoading = false, hostingWindowVersion=0, hostingWindowScope="";
let hostingLoadSequence = 0;
async function load(append = false) {
  if (append && hostingWindowScope!==resolveTargetScope()) append=false;
  if (append && hostingWindowLoading) return;
  const run = hostingGeneration;
  const sequence = ++hostingLoadSequence;
  const scope = resolveTargetScope();
  hostingWindowScope=scope;
  const current = () => sequence === hostingLoadSequence && run === hostingGeneration && scope === resolveTargetScope();
  showLoadError("");
  hostingWindowLoading = true;
  hostingPageState = { ...hostingPageState, version:append ? hostingWindowVersion : ++hostingWindowVersion, loading: true, error: null };
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId: HOSTING_TABLE_ID, ...hostingPageState } }));
  const params = new URLSearchParams({ page: String(hostingPage), limit: String(HOSTING_PAGE_SIZE) });
  if (hostingFilters.searchHostingUser) params.set("username", hostingFilters.searchHostingUser);
  if (hostingFilters.filterHostingEstado) params.set("status", ({ Activa: "active", Suspendida: "suspended", Terminada: "terminated" } as Record<string, string>)[hostingFilters.filterHostingEstado] ?? "");
  if (hostingFilters.filterHostingPlan) params.set("plan", hostingFilters.filterHostingPlan.toLowerCase());
  const sorting = hostingSorting[0];
  if (sorting) {
    params.set("sortBy", ({ estado: "status", creado: "createdAt", actualizado: "updatedAt" } as Record<string, string>)[sorting.id] ?? sorting.id);
    params.set("sortDir", sorting.desc ? "desc" : "asc");
  }
  let data: any[] = append ? [...hostingWindowData] : [];
  let total = 0;
  let counts: Record<string, number> = {};
  try {
    const firstPage = append ? Math.ceil(data.length / HOSTING_PAGE_SIZE) + 1 : 1;
    for (let page = firstPage; page <= firstPage + 1; page++) {
    params.set("page", String(page));
    const response = await api.get<any>(`/api/hosting/accounts?${params}`, { fresh: true });
    if (!current()) return;
    if (!response.ok) throw new Error(response.error);
    // api.get unwraps data[]; pagination is retained in response.meta.
    const payload = response.meta ?? {};
    const items = Array.isArray(response.data) ? response.data : (response.data as any)?.data ?? [];
    const unique = new Map(data.map(item => [String(item.id), item]));
    for (const item of items) unique.set(String(item.id), item);
    data = [...unique.values()];
    total = Number(payload.total ?? data.length);
    counts = (payload.counts ?? {}) as Record<string, number>;
    hostingPage = page;
    if (!items.length || data.length >= total) break;
    }
    hostingWindowData = data;
    hostingWindowLoading = false;
    hostingPageState = { window: true, version:hostingWindowVersion, total, hasMore: data.length < total, loading: false, error: null, canPrev: false, canNext: data.length < total, info: "" };
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId: HOSTING_TABLE_ID, ...hostingPageState } }));
  } catch {
    if (!current()) return;
    showLoadError(t("toasts.loadError", "Error al cargar las cuentas"));
    hostingWindowLoading = false;
    hostingPageState = { ...hostingPageState, loading: false, error: t("toasts.loadError", "Error al cargar las cuentas") };
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId: HOSTING_TABLE_ID, ...hostingPageState } }));
    return;
  }

  // Stats strip
  document.getElementById("stat-total")!.textContent = String(total || data.length);
  document.getElementById("stat-active")!.textContent = String(counts.active ?? 0);
  document.getElementById("stat-suspended")!.textContent = String(counts.suspended ?? 0);
  document.getElementById("stat-terminated")!.textContent = String(counts.terminated ?? 0);

  const moduleCountLabel = (n: number) => fmt(t("table.modulesCount", "{count} módulos"), { count: n });
  const rows = data.map((a: any) => {
    const modCount = Array.isArray(a.allowedModules) ? a.allowedModules.length : 0;
    return {
      id: a.id,
      username: String(a.username ?? ""),
      plan: String(a.plan ?? "").toUpperCase(),
      estado: estadoLabel(String(a.status ?? "")),
      modulos: moduleCountLabel(modCount),
      tenantGroup: String(a.tenantGroup ?? "—"),
      homeRoot: String(a.homeRoot ?? "—"),
      creado: fmtDate(a.createdAt),
      actualizado: fmtDate(a.updatedAt),
      _raw: a,
    };
  });
  publishHostingRows(rows);
}

// ── Modal helpers ──────────────────────────────────────────────
// Sub-pestañas del formulario del modal (Cuenta / Recursos / Módulos).
// E-03: mismo cuerpo que `setActiveTab` (settings/cred-bindings); compartido en
// /scripts/extracted/lib/tabs.js.
function setHostingTab(name: string) {
  const form = document.getElementById("account-form");
  if (!form) return;
  const prev = form.dataset.hostActiveTab ?? "";
  const direction = tabDirectionOf(form.querySelectorAll<HTMLButtonElement>(".host-tab"), (b) => b.dataset.hostTab === prev, (b) => b.dataset.hostTab === name);
  form.dataset.hostActiveTab = name;
  highlightBorderTabs(".host-tab", (btn) => btn.dataset.hostTab === name, form);
  setPaneVisibilityByData(".host-pane", "hostPane", name, form, direction);
}

const planLocale = planI18n("permissions-i18n");
let accountPlans: any[] = [];
let planGeneration = 0;
async function loadAccountPlans(selected = "", state = "") {
  const ticket = ++planGeneration, scope = resolveTargetScope();
  const select = document.getElementById("f-template-id") as HTMLSelectElement;
  if (!select) return;
  document.getElementById("f-template-reconcile")?.classList.toggle("hidden", !selected || state !== "pending");
  planLocale.loadI18n(); select.disabled = true;
  try {
    const result = await api.get<any[]>("/api/roles/templates");
    if (ticket !== planGeneration || scope !== resolveTargetScope() || !select.isConnected) return;
    if (!result.ok) throw new Error(result.error ?? planLocale.t("loadFailed", ""));
    accountPlans = result.data ?? [];
    const legacy = document.createElement("option"); legacy.value = ""; legacy.textContent = planLocale.t("legacy", ""); legacy.disabled = !!selected;
    select.replaceChildren(legacy, ...accountPlans.map(plan => { const option = document.createElement("option"); option.value = plan.id; option.textContent = `${plan.name} · v${plan.revision}`; return option; }));
    select.value = selected; reflectAccountPlan(false); if (selected && select.value !== selected) throw new Error(planLocale.t("loadFailed", ""));
    document.getElementById("f-template-state")!.textContent = state ? planLocale.t(state, state) : "";
  } catch (error) { document.getElementById("f-template-state")!.textContent = error instanceof Error ? error.message : String(error); }
  finally { if (ticket === planGeneration && scope === resolveTargetScope() && select.isConnected) select.disabled = false; }
}
function reflectAccountPlan(reset = true) {
  const selected = (document.getElementById("f-template-id") as HTMLSelectElement).value;
  const plan = accountPlans.find(p => p.id === selected);
  if (plan) {
    for (const [id, key] of [["disk", "diskQuotaMb"], ["domains", "maxDomains"], ["emails", "maxEmailAccounts"], ["databases", "maxDatabases"], ["maxsubusers", "maxSubUsers"]]) { const input = document.getElementById(`f-${id}`) as HTMLInputElement; if (reset) input.value = String(plan.limits[key]); input.max = String(plan.limits[key]); input.min = key === "diskQuotaMb" ? "256" : "0"; }
    (document.getElementById("f-jail-enabled") as HTMLInputElement).checked = plan.security.shell === "jailed";
  }
  (document.getElementById("f-jail-enabled") as HTMLInputElement).disabled = !!plan;
  document.querySelectorAll<HTMLInputElement>("#f-allowed-modules-grid input").forEach(input => input.disabled = !!plan);
  if (!plan) for (const id of ["disk", "domains", "emails", "databases", "maxsubusers"]) (document.getElementById(`f-${id}`) as HTMLInputElement)?.removeAttribute("max");
}
function openModal() {
  void loadAccountPlans();
  setHostingTab("account");
  (document.getElementById("edit-id") as HTMLInputElement).value = "";
  (document.getElementById("f-username") as HTMLInputElement).value = "";
  (document.getElementById("f-password") as HTMLInputElement).value = "";
  (document.getElementById("f-displayName") as HTMLInputElement).value = "";
  (document.getElementById("f-email") as HTMLInputElement).value = "";
  (document.getElementById("f-plan") as HTMLSelectElement).value = hostingDefaults.plan;
  (document.getElementById("f-disk") as HTMLInputElement).value = String(hostingDefaults.diskQuotaMb);
  (document.getElementById("f-bandwidth") as HTMLInputElement).value = String(hostingDefaults.bandwidthQuotaMb);
  (document.getElementById("f-domains") as HTMLInputElement).value = String(hostingDefaults.maxDomains);
  (document.getElementById("f-emails") as HTMLInputElement).value = String(hostingDefaults.maxEmailAccounts);
  (document.getElementById("f-databases") as HTMLInputElement).value = String(hostingDefaults.maxDatabases);
  (document.getElementById("f-maxsubusers") as HTMLInputElement).value = String(hostingDefaults.maxSubUsers);
  (document.getElementById("f-expires") as HTMLInputElement).value = "";
  (document.getElementById("f-notes") as HTMLTextAreaElement).value = "";
  (document.getElementById("f-jail-enabled") as HTMLInputElement).checked = hostingDefaults.jailEnabled;
  // Identidad del tenant (tenantGroup/homeRoot) se deriva del envelope al crear
  // — aún no existe, así que el bloque de sólo-lectura permanece oculto.
  document.getElementById("f-envelope-readonly")?.classList.add("hidden");
  renderAllowedModulesGrid(hostingDefaults.allowedModules);
  document.getElementById("modal-title")!.textContent = t("modal.titleNew", "Nueva cuenta de hosting");
  (document.getElementById("form-submit") as HTMLButtonElement).textContent = t("modal.btnCreate", "Crear cuenta");
  (document.getElementById("f-username") as HTMLInputElement).disabled = false;
  (document.getElementById("f-password") as HTMLInputElement).required = true;
  document.getElementById("form-error")!.classList.add("hidden");
  document.getElementById("modal-overlay")!.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay")!.classList.add("hidden");
}

function openEdit(a: any) {
  void loadAccountPlans(a.templateId ?? "", a.policyState ?? "");
  setHostingTab("account");
  (document.getElementById("edit-id") as HTMLInputElement).value = a.id;
  (document.getElementById("f-username") as HTMLInputElement).value = a.username;
  (document.getElementById("f-username") as HTMLInputElement).disabled = true;
  (document.getElementById("f-password") as HTMLInputElement).value = "";
  (document.getElementById("f-password") as HTMLInputElement).required = false;
  (document.getElementById("f-displayName") as HTMLInputElement).value = a.displayName ?? "";
  (document.getElementById("f-email") as HTMLInputElement).value = a.email ?? "";
  (document.getElementById("f-plan") as HTMLSelectElement).value = a.plan;
  (document.getElementById("f-disk") as HTMLInputElement).value = a.diskQuotaMb;
  (document.getElementById("f-bandwidth") as HTMLInputElement).value = a.bandwidthQuotaMb;
  (document.getElementById("f-domains") as HTMLInputElement).value = a.maxDomains;
  (document.getElementById("f-emails") as HTMLInputElement).value = a.maxEmailAccounts;
  (document.getElementById("f-databases") as HTMLInputElement).value = String(a.maxDatabases ?? 0);
  (document.getElementById("f-maxsubusers") as HTMLInputElement).value = String(a.maxSubUsers ?? 0);
  (document.getElementById("f-expires") as HTMLInputElement).value = a.expiresAt ? String(a.expiresAt).slice(0, 10) : "";
  (document.getElementById("f-notes") as HTMLTextAreaElement).value = a.notes ?? "";
  (document.getElementById("f-jail-enabled") as HTMLInputElement).checked = a.jailEnabled === true;
  // Identidad del tenant (sólo lectura, derivada del envelope) — visible al editar.
  const envBlock = document.getElementById("f-envelope-readonly");
  const tg = document.getElementById("f-tenant-group");
  const hr = document.getElementById("f-home-root");
  if (tg) tg.textContent = String(a.tenantGroup ?? "—");
  if (hr) hr.textContent = String(a.homeRoot ?? "—");
  envBlock?.classList.remove("hidden");
  renderAllowedModulesGrid(Array.isArray(a.allowedModules) ? a.allowedModules : []);
  document.getElementById("modal-title")!.textContent = fmt(t("modal.titleEdit", "Editar: {username}"), { username: a.username });
  (document.getElementById("form-submit") as HTMLButtonElement).textContent = t("actions.saveChanges", "Guardar cambios");
  document.getElementById("form-error")!.classList.add("hidden");
  document.getElementById("modal-overlay")!.classList.remove("hidden");
}

// ── Account actions ────────────────────────────────────────────
async function suspend(id: number) {
  if (!await openConfirm(t("confirm.suspendBody", "¿Suspender esta cuenta? El cliente perderá acceso."), { title: t("confirm.suspendTitle", "Suspender cuenta"), confirmText: t("confirm.suspendOk", "Sí, suspender"), variant: "danger" })) return;
  await fetch(apiPath(`/api/hosting/accounts/${id}/suspend`), { method: "POST", headers: { ...scopeHeaders(true) } });
  void load();
}

async function unsuspend(id: number) {
  await fetch(apiPath(`/api/hosting/accounts/${id}/unsuspend`), { method: "POST", headers: { ...scopeHeaders(true) } });
  void load();
}

async function confirmDelete(id: number, username: string) {
  if (!await openConfirm(fmt(t("confirm.deleteBody", "¿Eliminar la cuenta \"{username}\" y TODOS sus datos (correos, dominios, archivos)? Esta acción no se puede deshacer."), { username }), { title: t("confirm.deleteTitle", "Eliminar cuenta"), variant: "danger" })) return;
  const res = await fetch(apiPath(`/api/hosting/accounts/${id}`), { method: "DELETE", headers: { ...scopeHeaders(true) } });
  if (res.ok) void load();
}

function openChangePwd(id: number) {
  (document.getElementById("pwd-account-id") as HTMLInputElement).value = String(id);
  (document.getElementById("pwd-input") as HTMLInputElement).value = "";
  document.getElementById("pwd-error")!.classList.add("hidden");
  document.getElementById("pwd-overlay")!.classList.remove("hidden");
}

function showToastUnavailable(msg: string) {
  // hosting page has no toast element; surface via confirm-less console + alertless no-op
  console.warn(`[hosting] ${msg}`);
}

// ── Detalle / uso (stats) ───────────────────────────────────────
function pct(used: number, max: number): number {
  if (!max || max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function usageRow(label: string, used: number | string, max: number | string, percent?: number): string {
  const p = typeof percent === "number" ? percent : null;
  const bar = p === null ? "" : `
    <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div class="h-full rounded-full ${p >= 90 ? "bg-destructive" : p >= 70 ? "bg-amber-500" : "bg-primary"}" style="width:${p}%"></div>
    </div>`;
  return `
    <div class="space-y-1.5">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
        <span class="text-sm font-semibold tabular-nums">${escapeHtml(String(used))} / ${escapeHtml(String(max))}</span>
      </div>
      ${bar}
    </div>`;
}

async function openStats(id: number, username: string) {
  const overlay = document.getElementById("stats-overlay")!;
  const body = document.getElementById("stats-body")!;
  const title = document.getElementById("stats-title")!;
  title.textContent = fmt(t("stats.title", "Uso de {username}"), { username });
  body.innerHTML = `<p class="text-sm text-muted-foreground">${escapeHtml(t("modal.modulesLoading", "Cargando…"))}</p>`;
  overlay.classList.remove("hidden");
  try {
    const res = await fetch(apiPath(`/api/hosting/accounts/${id}/stats`), { headers: { ...scopeHeaders() } });
    const json = await res.json() as { ok: boolean; data?: any; error?: string };
    if (!json.ok || !json.data) {
      body.innerHTML = `<p class="text-sm text-destructive">${escapeHtml(json.error ?? t("errors.generic", "Error"))}</p>`;
      return;
    }
    const d = json.data;
    const warnings = Array.isArray(d.warnings) ? d.warnings : [];
    const methodLabel = d.quotaMethod === "quota-tools"
      ? t("stats.methodQuotaTools", "Cuota del sistema (quota-tools)")
      : t("stats.methodDu", "Estimación por du (best-effort)");
    body.innerHTML = `
      <div class="space-y-4">
        ${usageRow(t("stats.disk", "Disco (MB)"), d.diskUsedMb ?? 0, d.diskQuotaMb ?? 0, typeof d.diskPercentUsed === "number" ? d.diskPercentUsed : pct(d.diskUsedMb ?? 0, d.diskQuotaMb ?? 0))}
        ${usageRow(t("stats.bandwidth", "Ancho de banda (MB)"), d.bandwidthUsedMb ?? 0, d.bandwidthQuotaMb ?? 0)}
        ${usageRow(t("stats.domains", "Dominios"), d.domainsUsed ?? 0, d.maxDomains ?? 0, pct(d.domainsUsed ?? 0, d.maxDomains ?? 0))}
        ${usageRow(t("stats.emails", "Cuentas email"), d.emailAccountsUsed ?? 0, d.maxEmailAccounts ?? 0, pct(d.emailAccountsUsed ?? 0, d.maxEmailAccounts ?? 0))}
        ${usageRow(t("stats.databases", "Bases de datos"), d.databasesUsed ?? 0, d.maxDatabases ?? 0, pct(d.databasesUsed ?? 0, d.maxDatabases ?? 0))}
        ${usageRow(t("stats.subusers", "Sub-usuarios"), d.subUsersUsed ?? 0, d.maxSubUsers ?? 0, pct(d.subUsersUsed ?? 0, d.maxSubUsers ?? 0))}
        <p class="text-[11px] text-muted-foreground border-t border-border pt-3">
          <span class="font-medium">${escapeHtml(t("stats.method", "Método de medición"))}:</span> ${escapeHtml(methodLabel)}
        </p>
        ${warnings.length ? `<div class="rounded-lg bg-amber-500/10 border border-amber-600/30 px-3 py-2 space-y-1">${warnings.map((w: string) => `<p class="text-xs text-amber-700 dark:text-amber-300">${escapeHtml(w)}</p>`).join("")}</div>` : ""}
      </div>`;
  } catch (err: unknown) {
    body.innerHTML = `<p class="text-sm text-destructive">${escapeHtml((err as Error).message)}</p>`;
  }
}

// ── Auditoría del tenant ────────────────────────────────────────
const AUDIT_SEVERITY_CLASS: Record<string, string> = {
  info: "border-blue-600/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  warning: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
};

async function openAudit(id: number, username: string) {
  const overlay = document.getElementById("audit-overlay")!;
  const body = document.getElementById("audit-body")!;
  const title = document.getElementById("audit-title")!;
  title.textContent = fmt(t("audit.title", "Auditoría de {username}"), { username });
  body.innerHTML = `<p class="text-sm text-muted-foreground">${escapeHtml(t("modal.modulesLoading", "Cargando…"))}</p>`;
  overlay.classList.remove("hidden");
  try {
    const res = await fetch(apiPath(`/api/hosting/accounts/${id}/audit?limit=100`), { headers: { ...scopeHeaders() } });
    const json = await res.json() as { ok: boolean; data?: any[]; error?: string };
    if (!json.ok) {
      body.innerHTML = `<p class="text-sm text-destructive">${escapeHtml(json.error ?? t("errors.generic", "Error"))}</p>`;
      return;
    }
    const entries = Array.isArray(json.data) ? json.data : [];
    if (entries.length === 0) {
      body.innerHTML = `<p class="text-sm text-muted-foreground text-center py-6">${escapeHtml(t("audit.empty", "Sin eventos registrados."))}</p>`;
      return;
    }
    const hdr = `
      <div class="grid grid-cols-[1fr_auto_auto] gap-3 px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
        <span>${escapeHtml(t("audit.eventType", "Evento"))}</span>
        <span>${escapeHtml(t("audit.actor", "Actor"))}</span>
        <span>${escapeHtml(t("audit.date", "Fecha"))}</span>
      </div>`;
    const rows = entries.map((e: any) => {
      const sev = String(e.severity ?? "info");
      const sevCls = AUDIT_SEVERITY_CLASS[sev] ?? AUDIT_SEVERITY_CLASS.info;
      const ctx = e.context && typeof e.context === "object" ? Object.entries(e.context).map(([k, v]) => `${k}=${String(v)}`).join(" · ") : "";
      return `
        <div class="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 items-center border-b border-border/50">
          <div class="min-w-0">
            <span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${sevCls}">${escapeHtml(String(e.eventType ?? ""))}</span>
            ${ctx ? `<p class="text-[11px] text-muted-foreground mt-1 truncate" title="${escapeHtml(ctx)}">${escapeHtml(ctx)}</p>` : ""}
          </div>
          <span class="text-xs text-muted-foreground whitespace-nowrap">${escapeHtml(String(e.actor ?? "—"))}</span>
          <span class="text-xs text-muted-foreground whitespace-nowrap">${escapeHtml(fmtDateTime(String(e.createdAt ?? "")))}</span>
        </div>`;
    }).join("");
    body.innerHTML = hdr + `<div>${rows}</div>`;
  } catch (err: unknown) {
    body.innerHTML = `<p class="text-sm text-destructive">${escapeHtml((err as Error).message)}</p>`;
  }
}

function fmtDateTime(d: string): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleString(document.documentElement.lang || navigator.language || "en", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

// ── Jail (Fase 5) ───────────────────────────────────────────────
async function enableJail(id: number) {
  if (!await openConfirm(t("confirm.enableJailBody", "¿Activar la jaula chroot para esta cuenta? Su terminal/SSH quedará confinado a su carpeta."), { title: t("actions.enableJail", "Activar jaula"), confirmText: t("actions.enableJail", "Activar jaula") })) return;
  try {
    const res = await fetch(apiPath(`/api/hosting/accounts/${id}/jail`), { method: "POST", headers: { ...scopeHeaders(true) } });
    const json = await res.json() as { ok: boolean; data?: any; error?: string; job?: any };
    if (!json.ok) {
      await openAlert(json.error ?? t("errors.generic", "Error"), { title: t("actions.enableJail", "Activar jaula"), variant: "danger" });
      return;
    }
    // Provisión puede ir por la cola write-behind → esperar antes de recargar.
    await awaitJob(json);
    if (json.data?.degraded) {
      await openAlert(json.data.reason || t("jail.degraded", "jailkit no está instalado en el servidor; la jaula no quedó activa. Instala jailkit y reintenta."), { title: t("jail.degradedTitle", "Jaula no aplicada"), variant: "danger" });
    } else {
      await openAlert(t("jail.enabledOk", "Jaula activada correctamente."), { title: t("actions.enableJail", "Activar jaula") });
    }
    void load();
  } catch (err: unknown) {
    await openAlert((err as Error).message, { title: t("actions.enableJail", "Activar jaula"), variant: "danger" });
  }
}

async function disableJail(id: number) {
  if (!await openConfirm(t("confirm.disableJailBody", "¿Desactivar la jaula chroot? La cuenta volverá a una shell normal (/bin/bash)."), { title: t("actions.disableJail", "Desactivar jaula"), variant: "danger" })) return;
  try {
    const res = await fetch(apiPath(`/api/hosting/accounts/${id}/jail`), { method: "DELETE", headers: { ...scopeHeaders(true) } });
    const json = await res.json() as { ok: boolean; data?: any; error?: string; job?: any };
    if (!json.ok) {
      await openAlert(json.error ?? t("errors.generic", "Error"), { title: t("actions.disableJail", "Desactivar jaula"), variant: "danger" });
      return;
    }
    await awaitJob(json);
    void load();
  } catch (err: unknown) {
    await openAlert((err as Error).message, { title: t("actions.disableJail", "Desactivar jaula"), variant: "danger" });
  }
}

let hostingEventsBound = false;
function bindHostingTableEvents() {
  if (hostingEventsBound) return;
  window.addEventListener(DATATABLE_EVENTS.LOAD_MORE, (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.tableId !== HOSTING_TABLE_ID || hostingWindowLoading) return;
    void load(true);
  });
  window.addEventListener(DATATABLE_EVENTS.QUERY, (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.tableId !== HOSTING_TABLE_ID) return;
    hostingFilters = detail.filters ?? {}; hostingSorting = detail.sorting ?? []; hostingPage = 1;
    if ([10, 20, 50, 100].includes(Number(detail.pageSize))) HOSTING_PAGE_SIZE = Number(detail.pageSize);
    void load();
  });
  if (hostingEventsBound) return;
  hostingEventsBound = true;
  window.addEventListener(DATATABLE_EVENTS.READY, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (detail?.tableId !== HOSTING_TABLE_ID) return;
    hostingTableIsReady = true;
    publishHostingRows(hostingTableCachedRows);
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId: HOSTING_TABLE_ID, ...hostingPageState } }));
  });
  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (!detail || detail.tableId !== HOSTING_TABLE_ID) return;
    const row = detail.row;
    if (!row) return;
    const acc = row._raw ?? row;
    const id = Number(row.id);
    switch (detail.actionId) {
      case "edit":
        openEdit(acc);
        break;
      case "viewStats":
        void openStats(id, String(acc.username ?? row.username ?? ""));
        break;
      case "viewAudit":
        void openAudit(id, String(acc.username ?? row.username ?? ""));
        break;
      case "password":
        openChangePwd(id);
        break;
      case "suspend":
        if (acc.status === "active") void suspend(id);
        else showToastUnavailable(t("toasts.notActive", "La cuenta no está activa"));
        break;
      case "unsuspend":
        if (acc.status === "suspended") void unsuspend(id);
        else showToastUnavailable(t("toasts.notSuspended", "La cuenta no está suspendida"));
        break;
      case "enableJail":
        if (acc.jailEnabled === true) showToastUnavailable(t("toasts.jailAlready", "La jaula ya está activa"));
        else void enableJail(id);
        break;
      case "disableJail":
        if (acc.jailEnabled === true) void disableJail(id);
        else showToastUnavailable(t("toasts.jailNotActive", "La jaula no está activa"));
        break;
      case "delete":
        void confirmDelete(id, String(row.username));
        break;
    }
  });
}

// ── Form submit ────────────────────────────────────────────────
function bindForms() {
  document.getElementById("account-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("form-error")!;
  errEl.classList.add("hidden");

  const id = (document.getElementById("edit-id") as HTMLInputElement).value;
  const isEdit = !!id;

  const body: Record<string, unknown> = {
    displayName: (document.getElementById("f-displayName") as HTMLInputElement).value.trim() || undefined,
    email: (document.getElementById("f-email") as HTMLInputElement).value.trim() || undefined,
    plan: (document.getElementById("f-plan") as HTMLSelectElement).value,
    allowedModules: getAllowedModulesSelected(),
    diskQuotaMb: Number((document.getElementById("f-disk") as HTMLInputElement).value),
    bandwidthQuotaMb: Number((document.getElementById("f-bandwidth") as HTMLInputElement).value),
    maxDomains: Number((document.getElementById("f-domains") as HTMLInputElement).value),
    maxEmailAccounts: Number((document.getElementById("f-emails") as HTMLInputElement).value),
    maxDatabases: Number((document.getElementById("f-databases") as HTMLInputElement).value),
    maxSubUsers: Number((document.getElementById("f-maxsubusers") as HTMLInputElement).value),
    jailEnabled: (document.getElementById("f-jail-enabled") as HTMLInputElement).checked,
    notes: (document.getElementById("f-notes") as HTMLTextAreaElement).value.trim() || undefined,
  };

  const templateId = (document.getElementById("f-template-id") as HTMLSelectElement)?.value;
  if (templateId) { body.templateId = templateId; delete body.allowedModules; delete body.jailEnabled; }

  // expiresAt: backend validates z.string().datetime() (rejects bare YYYY-MM-DD).
  // Convert the <input type="date"> value to a full ISO datetime; omit if empty.
  const expiresRaw = (document.getElementById("f-expires") as HTMLInputElement).value.trim();
  if (expiresRaw) {
    body["expiresAt"] = new Date(`${expiresRaw}T00:00:00.000Z`).toISOString();
  }

  if (!isEdit) {
    body["username"] = (document.getElementById("f-username") as HTMLInputElement).value.trim();
    body["password"] = (document.getElementById("f-password") as HTMLInputElement).value;
  }

  const submitBtn = document.getElementById("form-submit") as HTMLButtonElement;
  submitBtn.disabled = true;
  const origText = submitBtn.textContent;
  submitBtn.textContent = t("actions.saving", "Guardando…");

  try {
    const res = await fetch(
      apiPath(isEdit ? `/api/hosting/accounts/${id}` : "/api/hosting/accounts"),
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...scopeHeaders(true) },
        body: JSON.stringify(body),
      },
    );
    const json = await res.json() as { ok: boolean; error?: string };
    if (!json.ok) {
      errEl.textContent = json.error ?? t("errors.unknown", "Error desconocido");
      errEl.classList.remove("hidden");
      return;
    }
    closeModal();
    void load();
  } catch (err: unknown) {
    errEl.textContent = (err as Error).message;
    errEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = origText ?? t("actions.save", "Guardar");
  }
});

// ── Change password form ───────────────────────────────────────
document.getElementById("pwd-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("pwd-error")!;
  errEl.classList.add("hidden");
  const id = (document.getElementById("pwd-account-id") as HTMLInputElement).value;
  const pwd = (document.getElementById("pwd-input") as HTMLInputElement).value;
  const res = await fetch(apiPath(`/api/hosting/accounts/${id}/change-password`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...scopeHeaders(true) },
    body: JSON.stringify({ password: pwd }),
  });
  const json = await res.json() as { ok: boolean; error?: string };
  if (!json.ok) {
    errEl.textContent = json.error ?? t("errors.generic", "Error");
    errEl.classList.remove("hidden");
    return;
  }
  document.getElementById("pwd-overlay")!.classList.add("hidden");
  });
}

// ── Event listeners ────────────────────────────────────────────
function bindStaticControls() {
  document.getElementById("btn-new")?.addEventListener("click", openModal);
  document.getElementById("modal-close")?.addEventListener("click", closeModal);
  document.getElementById("modal-cancel")?.addEventListener("click", closeModal);
  // Sub-pestañas del formulario.
  document.querySelectorAll<HTMLButtonElement>("#account-form .host-tab").forEach((btn) => {
    btn.addEventListener("click", () => setHostingTab(btn.dataset.hostTab ?? "account"));
  });
  document.getElementById("pwd-close")?.addEventListener("click", () => document.getElementById("pwd-overlay")!.classList.add("hidden"));
  document.getElementById("pwd-cancel")?.addEventListener("click", () => document.getElementById("pwd-overlay")!.classList.add("hidden"));
  document.getElementById("modal-overlay")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeModal(); });
  const closeStats = () => document.getElementById("stats-overlay")!.classList.add("hidden");
  const closeAudit = () => document.getElementById("audit-overlay")!.classList.add("hidden");
  document.getElementById("stats-close")?.addEventListener("click", closeStats);
  document.getElementById("stats-overlay")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeStats(); });
  document.getElementById("audit-close")?.addEventListener("click", closeAudit);
  document.getElementById("audit-overlay")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeAudit(); });
}

// Cooldown SOLO para fetches. Bindings always en DOM fresh.
let initLastAt = 0;
const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
let lastBoundRoot: Element | null = null;
function init() {
  loadI18n();
  const root = document.getElementById("account-form");
  if (!root) return;
  if (root !== lastBoundRoot) {
    lastBoundRoot = root;
    bindStaticControls();
    bindForms();
    bindHostingTableEvents();
    document.getElementById("host-default-save")?.addEventListener("click", () => void saveDefaults());
    document.getElementById("hosting-retry")?.addEventListener("click", () => void load());
    document.getElementById("f-template-reconcile")?.addEventListener("click", async () => {
      const button = document.getElementById("f-template-reconcile") as HTMLButtonElement;
      const id = (document.getElementById("edit-id") as HTMLInputElement).value;
      const scope = resolveTargetScope();
      if (!id || button.disabled) return;
      button.disabled = true;
      try {
        const result = await api.post<any>(`/api/hosting/accounts/${id}/reconcile`, {});
        if (scope !== resolveTargetScope()) return;
        if (!result.ok) throw new Error(result.error ?? planLocale.t("loadFailed", ""));
        closeModal(); await load();
      } catch (error) {
        if (scope === resolveTargetScope()) document.getElementById("f-template-state")!.textContent = error instanceof Error ? error.message : String(error);
      } finally { button.disabled = false; }
    });
    if (!targetListenerBound) {
      targetListenerBound = true;
      window.addEventListener("luxipanel:target-changed", () => {
        if (!document.getElementById("account-form")) return;
        hostingGeneration += 1;
        hostingPage = 1; hostingFilters = {}; hostingSorting = [];
        planGeneration += 1;
        accountPlans = [];
        closeModal();
        (document.getElementById("edit-id") as HTMLInputElement).value = "";
        hostingDefaults = { plan: "basic", diskQuotaMb: 10240, bandwidthQuotaMb: 102400, maxDomains: 10, maxEmailAccounts: 20, maxDatabases: 0, maxSubUsers: 0, jailEnabled: false, allowedModules: [] };
        void load(); void loadDefaults();
      });
    }
  }
  // Module catalog is static per install; fetch it once (own guard, NOT gated by
  // the data-fetch cooldown) so the allowedModules selector can populate.
  if (!moduleCatalogLoaded) void loadModuleCatalog();
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
  initLastAt = Date.now();
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId: HOSTING_TABLE_ID } }));
  void load();
  void loadDefaults();
}
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();

document.addEventListener("change", event => { if ((event.target as HTMLElement)?.id === "f-template-id") reflectAccountPlan(); });
