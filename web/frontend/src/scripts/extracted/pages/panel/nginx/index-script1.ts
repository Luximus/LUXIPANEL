import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
import { watchModuleData } from "/scripts/extracted/lib/live-data.js";
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { switchView, tabDirection } from "/scripts/extracted/lib/dom.js";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { initModuleDeps } from "/scripts/extracted/lib/module-deps.js?v=20260609a";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
const upstreamPages = createTablePages({ tableId: "nginx-upstreams-table", events: window, scope: resolveTargetScope, reload: () => loadUpstreams(), field: "auto", rowKey: row => JSON.stringify([row.name,row.file]) });
const sitePages = createTablePages({ catalog:["name","ssl"], aliases:{estado:"enabled"}, values:()=>({estado:{[t("labels.active","Activo")]:"true",[t("labels.inactive","Inactivo")]:"false"},ssl:{[t("labels.yes","Sí")]:"true",[t("labels.no","No")]:"false"}}), tableId: "nginx-sites-table", events: window, scope: resolveTargetScope, reload: () => loadSites(), field: "auto", rowKey: row => row.name });

const { loadI18n, t, fmt } = createPageI18n("nginx-i18n");

const SITES_TABLE = "nginx-sites-table";
const UPSTREAMS_TABLE = "nginx-upstreams-table";

const ready: Record<string, boolean> = {};
const cache: Record<string, any[]> = {};
let cacheScope = resolveTargetScope();
let latestStatus: any = null;

function publish(tableId: string, rows: any[]) {
  cacheScope = resolveTargetScope();
  cache[tableId] = Array.isArray(rows) ? rows : [];
  // Siempre emitir: si el DataTable ya está montado, recibe; si no, su
  // mount disparará `lxp:data-table:ready` y el handler re-emitirá desde
  // cache. Mantener gate de `ready` aquí abre una race en F5 donde el
  // listener de ready se registra tarde (tras la hidratación de React)
  // y el evento se pierde para siempre.
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_DATA, { detail: { tableId, data: cache[tableId] } }));
}

function unwrap(res: any): any {
  if (!res || !res.ok) return null;
  const body = res.data;
  return body && typeof body === "object" && "data" in body ? body.data : body;
}

function toast(msg: string, ok = true) {
  const t = document.getElementById("toast")!;
  document.getElementById("toast-msg")!.textContent = msg;
  t.className = `fixed bottom-4 right-4 z-50 max-w-md rounded-xl border px-4 py-3 shadow-lg text-sm font-medium ${
    ok ? "border-emerald-500/30 bg-card text-emerald-500" : "border-destructive/30 bg-card text-destructive"
  }`;
  setTimeout(() => t.classList.add("hidden"), 4500);
}

function errMsg(res: any, fallback: string): string {
  const d = res?.data;
  return (d && (d.error || d.message)) || res?.error || fallback;
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type AiPrefs = { submit: "auto" | "prefill"; lines: 50 | 200 | 500 };
const AI_PREFS_KEY = "lxp:nginx:ai:prefs:v1";
function readAiPrefs(): AiPrefs {
  try {
    const value = JSON.parse(localStorage.getItem(AI_PREFS_KEY) || "{}");
    return { submit: value.submit === "prefill" ? "prefill" : "auto", lines: [50, 200, 500].includes(value.lines) ? value.lines : 50 };
  } catch { return { submit: "auto", lines: 50 }; }
}
function writeAiPrefs(value: AiPrefs) { try { localStorage.setItem(AI_PREFS_KEY, JSON.stringify(value)); } catch {} }

type TablePrefs = { pageSize: number; hiddenActions: string[] };
function tablePrefsKey(id: string) { return `lxp:data-table:prefs:${id}`; }
function readTablePrefs(id: string): TablePrefs {
  try {
    const value = JSON.parse(localStorage.getItem(tablePrefsKey(id)) || "{}");
    return { pageSize: [10, 25, 50, 100].includes(value.pageSize) ? value.pageSize : 25,
      hiddenActions: Array.isArray(value.hiddenActions) ? value.hiddenActions.map(String) : [] };
  } catch { return { pageSize: 25, hiddenActions: [] }; }
}
function writeTablePrefs(id: string, value: TablePrefs) {
  try { localStorage.setItem(tablePrefsKey(id), JSON.stringify(value)); } catch {}
  window.dispatchEvent(new CustomEvent("lxp:data-table:apply-prefs", { detail: { tableId: id, ...value } }));
}
function bindSettings(signal: AbortSignal) {
  const navs = [...document.querySelectorAll<HTMLButtonElement>("[data-nginx-settings-nav]")];
  const selectView = (button: HTMLButtonElement) => {
    const selected = button.dataset.nginxSettingsNav;
    document.querySelectorAll<HTMLElement>("[data-nginx-settings-view]").forEach((panel) => {
      const active = panel.dataset.nginxSettingsView === selected;
      panel.classList.toggle("hidden", !active);
      panel.classList.toggle("flex", active);
    });
    navs.forEach((nav) => {
      const active = nav === button;
      nav.setAttribute("aria-selected", String(active));
      nav.tabIndex = active ? 0 : -1;
      nav.classList.toggle("bg-primary/10", active);
      nav.classList.toggle("text-primary", active);
      nav.classList.toggle("text-muted-foreground", !active);
    });
  };
  navs.forEach((button) => {
    button.addEventListener("click", () => selectView(button), { signal });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const index = navs.indexOf(button);
      const next = navs[(index + (event.key === "ArrowDown" ? 1 : -1) + navs.length) % navs.length];
      next?.focus();
      if (next) selectView(next);
      event.preventDefault();
    }, { signal });
  });
  document.querySelectorAll<HTMLElement>("[data-nginx-table]").forEach((container) => {
    const id = container.dataset.nginxTable || "";
    if (!id) return;
    let cfg = readTablePrefs(id);
    const paint = () => {
      container.querySelectorAll<HTMLButtonElement>("[data-nginx-pagesize]").forEach((button) => {
        const active = Number(button.dataset.nginxPagesize) === cfg.pageSize;
        button.classList.toggle("bg-primary", active);
        button.classList.toggle("text-primary-foreground", active);
        button.setAttribute("aria-pressed", String(active));
      });
      container.querySelectorAll<HTMLInputElement>("[data-nginx-action]").forEach((box) => {
        box.checked = !cfg.hiddenActions.includes(box.dataset.nginxAction || "");
      });
    };
    paint();
    writeTablePrefs(id, cfg);
    container.querySelectorAll<HTMLButtonElement>("[data-nginx-pagesize]").forEach((button) => button.addEventListener("click", () => {
      cfg = { ...cfg, pageSize: Number(button.dataset.nginxPagesize) };
      writeTablePrefs(id, cfg); paint();
    }, { signal }));
    container.querySelectorAll<HTMLInputElement>("[data-nginx-action]").forEach((box) => box.addEventListener("change", () => {
      const selected = new Set(cfg.hiddenActions);
      const action = box.dataset.nginxAction || "";
      if (box.checked) selected.delete(action); else selected.add(action);
      cfg = { ...cfg, hiddenActions: [...selected] };
      writeTablePrefs(id, cfg);
    }, { signal }));
  });
  const aiPrefs = readAiPrefs();
  const submit = document.getElementById("nginx-ai-submit") as HTMLSelectElement | null;
  const lines = document.getElementById("nginx-ai-lines") as HTMLSelectElement | null;
  if (submit) submit.value = aiPrefs.submit;
  if (lines) lines.value = String(aiPrefs.lines);
  const save = () => writeAiPrefs({ submit: submit?.value === "prefill" ? "prefill" : "auto", lines: Number(lines?.value) as AiPrefs["lines"] });
  submit?.addEventListener("change", save, { signal });
  lines?.addEventListener("change", save, { signal });
}

async function askAssistant(action: string, prompt: string) {
  const scope = resolveTargetScope();
  const res = await api.get("/api/ai/modules");
  if (scope !== resolveTargetScope() || !document.getElementById("nginx-tabs")) return;
  const modules = unwrap(res)?.modules;
  const nginx = Array.isArray(modules) ? modules.find((entry: any) => entry.moduleId === "nginx") : null;
  if (!nginx?.enabled || !nginx.tools?.some((tool: any) => tool.enabled && tool.kind === "read")) {
    toast(t("overview.aiUnavailable", "Activa Agentes IA y sus herramientas NGINX para usar el diagnóstico."), false);
    return;
  }
  const prefs = readAiPrefs();
  requestAssistant({ kind: "prompt", prompt, submit: prefs.submit, conversation: "new", origin: { module: "nginx", action }, target: { agentId: null, projectId: null } });
}

// ═══ Puente Cloudflare (post-creación guiada de sitio) ═══
// Tras crear un sitio con éxito en modo guiado, si el módulo cloudflare está
// disponible (gate: link en el sidebar), se ofrece crear el registro DNS vía
// deep link /panel/cloudflare?tab=dns&domain=<fqdn>. El banner vive en
// #nginx-cf-banner (encima de la tabla de sitios) y init() lo limpia en cada
// navegación SPA. Es un aviso dismissible: NO toca el flujo de creación.
function showCloudflareDnsBanner(domain: string) {
  const wrap = document.getElementById("nginx-cf-banner");
  if (!wrap) return;
  // Gate del contrato: solo si el sidebar contiene el módulo cloudflare.
  if (!document.querySelector('a[href="/panel/cloudflare"]')) return;
  const d = domain.trim().toLowerCase();
  if (!/^[a-z0-9.-]{1,255}$/i.test(d)) return;
  wrap.innerHTML = `<div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-card px-4 py-3 shadow-sm">
    <p class="text-sm font-medium">${fmt(t("labels.cfBannerMsg", "Sitio creado. ¿Apuntar {domain} a este servidor en Cloudflare?"), { domain: `<span class="font-mono text-emerald-500">${esc(d)}</span>` })}</p>
    <div class="flex items-center gap-2">
      <button type="button" id="nginx-cf-banner-go" class="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 transition-colors">${t("actions.cfBannerCreateDns", "Crear registro DNS")}</button>
      <button type="button" id="nginx-cf-banner-close" class="rounded-lg border border-border px-2.5 py-2 text-xs hover:bg-accent transition-colors" aria-label="${t("actions.cfBannerClose", "Cerrar")}">✕</button>
    </div>
  </div>`;
  // Listeners directos a nodos recién creados: mueren con el innerHTML="" del
  // dismiss o con la limpieza de init() — no necesitan AbortController.
  document.getElementById("nginx-cf-banner-go")?.addEventListener("click", () => {
    window.location.href = "/panel/cloudflare?tab=dns&domain=" + encodeURIComponent(d);
  });
  document.getElementById("nginx-cf-banner-close")?.addEventListener("click", () => { wrap.innerHTML = ""; });
}

// ── Tabs ───────────────────────────────────────────────────────
function availableTabs(): string[] {
  const admin = document.getElementById("nginx-tabs")?.getAttribute("data-admin") === "true";
  return ["tab-overview", "tab-sites", ...(admin ? ["tab-proxy", "tab-perf"] : []), "tab-logs", ...(admin ? ["tab-status"] : [])];
}
function isAdminPage(): boolean { return document.getElementById("nginx-tabs")?.getAttribute("data-admin") === "true"; }
function isHostingPage(): boolean { return document.getElementById("nginx-tabs")?.getAttribute("data-hosting") === "true"; }

let currentNginxTab = "";

function activateTabUI(tabId: string) {
  const TABS = availableTabs();
  const idx = TABS.indexOf(tabId);
  if (idx < 0) return;
  const direction = tabDirection(TABS.indexOf(currentNginxTab), idx);
  currentNginxTab = tabId;
  TABS.forEach((id, i) => {
    const btn = document.getElementById(id);
    const active = i === idx;
    btn?.classList.toggle("bg-card", active);
    btn?.classList.toggle("text-foreground", active);
    btn?.classList.toggle("shadow-sm", active);
    btn?.classList.toggle("text-muted-foreground", !active);
    btn?.setAttribute("aria-selected", String(active));
    btn?.setAttribute("tabindex", active ? "0" : "-1");
  });
  // Entrada animada del panel (preset motion.css).
  const panels = TABS.map((id) => document.getElementById(id.replace("tab-", "panel-")));
  switchView(panels, panels[idx], { direction });
  try { localStorage.setItem("nginx-active-tab", tabId); } catch {}
}

function loadTabData(tabId: string) {
  if (tabId === "tab-overview") { void loadStatus(); void loadSites(); }
  if (tabId === "tab-sites") { void loadSites(true); void loadRenewalStatus(); }
  if (tabId === "tab-proxy") void loadUpstreams();
  if (tabId === "tab-status") void loadStatus();
  if (tabId === "tab-perf") void loadPerf();
  if (tabId === "tab-logs") void loadSites();
}

// activateTab = UI + fetch (used by user clicks).
function activateTab(tabId: string) {
  activateTabUI(tabId);
  loadTabData(tabId);
  const url = new URL(window.location.href);
  if (url.searchParams.has("tab")) { url.searchParams.delete("tab"); history.replaceState(history.state, "", url); }
}

function savedTabId(): string {
  const legacy: Record<string, string> = { "tab-ssl": "tab-sites", "tab-balance": "tab-proxy", ssl: "tab-sites", balance: "tab-proxy", sites: "tab-sites", proxy: "tab-proxy", performance: "tab-perf", logs: "tab-logs", status: "tab-status" };
  const params = new URLSearchParams(window.location.search);
  let tab = params.get("workspaceView") || params.get("tab") || "";
  if (!tab) { try { tab = localStorage.getItem("nginx-active-tab") || ""; } catch {} }
  tab = legacy[tab] ?? (tab.startsWith("tab-") ? tab : `tab-${tab}`);
  return availableTabs().includes(tab) ? tab : "tab-overview";
}

// ═══ DEPENDENCIAS (ModuleDepsBanner) ═══
// nginx es requerido; certbot es opcional (solo habilita SSL/Let's Encrypt:
// instala el binario, el flujo de emisión por sitio sigue siendo el de
// POST /api/nginx/sites/:name/ssl). Tras instalar desde el banner,
// onReady recarga los datos del tab activo con los loaders existentes.
let depsWereMissing = false;

function checkModuleDeps() {
  void initModuleDeps({
    module: "nginx",
    onMissing: () => { depsWereMissing = true; },
    onReady: () => {
      if (!depsWereMissing) return;
      depsWereMissing = false;
      loadTabData(savedTabId());
    },
  });
}

// ═══ SITIOS ═══
let sitesData: any[] = [];
let sitesCatalog: any[] = [];
type SiteRenewal = { state: "active" | "attention" | "external" | "no_https" | "unknown"; lineages: string[]; reason?: string };
let siteRenewalStates: Record<string, SiteRenewal> = {};
let siteRenewalScope = "";
let selectedRenewalSite = "";
let sitesGeneration = 0;

function siteRenewalLabel(status?: SiteRenewal): string {
  switch (status?.state) {
    case "active": return t("table.sites.badges.renewalActive", "Activa");
    case "attention": return t("table.sites.badges.renewalAttention", "Revisar");
    case "external": return t("table.sites.badges.renewalExternal", "Externo");
    case "no_https": return t("table.sites.badges.renewalNoHttps", "Sin HTTPS");
    default: return t("table.sites.badges.renewalUnknown", "Sin datos");
  }
}

function siteRenewalDetail(status?: SiteRenewal): string {
  if (!status) return t("ssl.siteRenewalUnknown", "No se pudo comprobar la renovación de este sitio.");
  if (status.state === "active") return t("ssl.siteRenewalActive", "El certificado de este sitio tiene renovación automática activa.");
  if (status.state === "no_https") return t("ssl.siteRenewalNoHttps", "Este sitio todavía no tiene HTTPS. Habilítalo para emitir un certificado.");
  if (status.state === "external") return t("ssl.siteRenewalExternal", "Este sitio usa un certificado que no está gestionado por Certbot. Revisa su renovación con el proveedor correspondiente.");
  if (status.reason === "renewal_config_missing") return t("ssl.siteRenewalMissingConfig", "Certbot no tiene un archivo de renovación para este certificado. Configurar la tarea global no resolverá este caso.");
  if (status.reason === "certificate_missing") return t("ssl.siteRenewalMissingCertificate", "El archivo del certificado configurado en este sitio no existe en el servidor. Revisa la configuración HTTPS antes de renovar.");
  if (status.reason === "certbot_missing") return t("ssl.siteRenewalCertbotMissing", "Certbot no está instalado en este servidor.");
  if (status.reason === "scheduler_missing") return t("ssl.siteRenewalSchedulerMissing", "El certificado está registrado en Certbot, pero la tarea automática o la recarga de NGINX requieren atención.");
  return t("ssl.siteRenewalUnknown", "No se pudo comprobar la renovación de este sitio.");
}

function siteRow(s: any) {
  return {
    name: s.name,
    domains: (s.domains || []).join(", ") || "—",
    kind: s.kind || "unknown",
    target: s.proxyPass || s.root || "—",
    ssl: s.ssl ? t("labels.yes", "Sí") : t("labels.no", "No"),
    renewal: siteRenewalLabel(siteRenewalStates[s.name]),
    estado: s.enabled ? t("labels.active", "Activo") : t("labels.inactive", "Inactivo"),
    _name: s.name,
    _enabled: s.enabled,
  };
}

async function loadSites(withRenewal = false) {
  const generation = ++sitesGeneration;
  const root = document.getElementById("nginx-tabs");
  const scope = resolveTargetScope();
  const isCurrent = () => generation === sitesGeneration && scope === resolveTargetScope()
    && root === document.getElementById("nginx-tabs") && root !== null;
  if (siteRenewalScope !== scope) {
    siteRenewalStates = {};
    siteRenewalScope = scope;
    selectedRenewalSite = "";
    const dialog = document.getElementById("dialog-site-renewal") as HTMLDialogElement | null;
    if (dialog?.open) dialog.close();
  }
  const sitesRequest = sitePages.read<any[]>(params => api.get("/api/nginx/sites", {params}));
  const renewalRequest = withRenewal ? api.get("/api/nginx/ssl/renewal/sites").catch(() => null) : null;
  const res = await sitesRequest;
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!isCurrent()) return;
  const data = unwrap(res);
  if (!data) { toast(errMsg(res, t("toasts.errorLoadSites", "No se pudieron cargar los sitios")), false); return; }
  sitesData = data;
  publish(SITES_TABLE, data.map(siteRow));
  sitesCatalog = res.meta?.tableWindow?.catalog ?? data;
  fillSiteSelects(sitesCatalog);
  renderOverview();
  if (selectedRenewalSite) paintSiteRenewalDialog();
  if (renewalRequest) void renewalRequest.then((renewalRes) => {
    if (!isCurrent()) return;
    siteRenewalStates = unwrap(renewalRes) || {};
    publish(SITES_TABLE, sitesData.map(siteRow));
    if (selectedRenewalSite) paintSiteRenewalDialog();
  });
}

function paintSiteRenewalDialog() {
  const dialog = document.getElementById("dialog-site-renewal") as HTMLDialogElement | null;
  if (!dialog?.open || !selectedRenewalSite) return;
  const status = siteRenewalStates[selectedRenewalSite];
  const site = sitesData.find((entry) => entry.name === selectedRenewalSite);
  if (!site) { dialog.close(); selectedRenewalSite = ""; return; }
  document.getElementById("site-renewal-name")!.textContent = selectedRenewalSite;
  document.getElementById("site-renewal-detail")!.textContent = siteRenewalDetail(status);
  document.getElementById("site-renewal-scope-help")!.classList.toggle("hidden", !site.ssl || status?.state === "external" || status?.reason === "renewal_config_missing" || status?.reason === "certificate_missing");
  const lineages = document.getElementById("site-renewal-lineages")!;
  lineages.textContent = status?.lineages?.length ? status.lineages.join(", ") : "";
  lineages.classList.toggle("hidden", !status?.lineages?.length);
  const enableHttps = document.getElementById("site-renewal-enable-https")!;
  enableHttps.classList.toggle("hidden", !!site?.ssl);
  const configure = document.getElementById("site-renewal-configure") as HTMLButtonElement | null;
  if (configure) configure.disabled = !status || !site?.ssl || status?.state === "external" || status?.reason === "renewal_config_missing" || status?.reason === "certificate_missing";
  const test = document.getElementById("site-renewal-test") as HTMLButtonElement | null;
  if (test) test.disabled = !status || !site.ssl || status?.state === "external" || status?.reason === "renewal_config_missing" || status?.reason === "certificate_missing";
}

function openSiteRenewalDialog(name: string) {
  selectedRenewalSite = name;
  const dialog = document.getElementById("dialog-site-renewal") as HTMLDialogElement;
  document.getElementById("site-renewal-output")?.classList.add("hidden");
  dialog.showModal();
  paintSiteRenewalDialog();
}

function fillSiteSelects(sites: any[]) {
  const sslSel = document.getElementById("ssl-site") as HTMLSelectElement | null;
  if (sslSel) sslSel.innerHTML = sites.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("");
  const aiSel = document.getElementById("nginx-ai-site-select") as HTMLSelectElement | null;
  if (aiSel) {
    const previous = aiSel.value;
    aiSel.innerHTML = sites.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("");
    if (sites.some((s) => s.name === previous)) aiSel.value = previous;
  }
  const logSel = document.getElementById("log-site") as HTMLSelectElement | null;
  if (logSel) {
    const cur = logSel.value;
    logSel.innerHTML = (isAdminPage() ? `<option value="">${esc(t("logs.optionGlobal", "— Global —"))}</option>` : "") + sites.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("");
    if (isAdminPage() && !cur) logSel.value = "";
    else if (sites.some((s) => s.name === cur)) logSel.value = cur;
  }
}

function renderOverview() {
  const host = document.getElementById("overview-health");
  if (!host || !latestStatus) return;
  const s = latestStatus;
  const https = sitesCatalog.filter((site) => site.ssl).length;
  const items: Array<[string, string, boolean]> = [
    [t("labels.service", "Servicio"), s.running ? t("labels.running", "Activo") : t("labels.stopped", "Detenido"), !!s.running],
    ["nginx -t", s.configTest?.ok ? t("labels.ok", "OK") : t("labels.error", "Error"), !!s.configTest?.ok],
    [t("labels.activeSites", "Sitios activos"), `${s.enabledSites} / ${s.availableSites}`, true],
    ["HTTPS", `${https} / ${sitesCatalog.length}`, true],
  ];
  host.innerHTML = items.map(([label, value, good]) => `<div class="rounded-xl border border-border bg-muted/20 p-4"><p class="text-xs text-muted-foreground">${esc(label)}</p><p class="mt-1 text-lg font-semibold ${good ? "text-foreground" : "text-destructive"}">${esc(value)}</p></div>`).join("");
}

// Dialog refs reasignados en init() porque Astro ClientRouter reemplaza el
// DOM en cada swap; mantener la captura a module-eval dejaría refs a nodos
// huérfanos tras la primera navegación SPA.
let dlgSite: HTMLDialogElement | null = null;
let dlgSsl: HTMLDialogElement | null = null;
let dlgAdv: HTMLDialogElement | null = null;
let upstreamsWrap: HTMLElement | null = null;

let editingSite: string | null = null;
let siteRevision: string | null = null;

function syncSiteKindFields() {
  const kind = (document.getElementById("site-kind") as HTMLSelectElement).value;
  document.getElementById("site-root-field")!.classList.toggle("hidden", kind === "proxy");
  document.getElementById("site-php-field")!.classList.toggle("hidden", kind !== "php");
  document.getElementById("site-proxy-field")!.classList.toggle("hidden", kind !== "proxy");
}

function openSiteDialog(site?: { name: string; form: any; revision: string }) {
  editingSite = site?.name ?? null;
  siteRevision = site?.revision ?? null;
  const form = site?.form;
  document.getElementById("site-dialog-title")!.textContent = site ? fmt(t("titles.editSite", "Editar {name}"), { name: site.name }) : t("siteDialog.titleNew", "Nuevo sitio");
  (document.getElementById("site-kind") as HTMLSelectElement).value = form?.kind ?? "static";
  (document.getElementById("site-domain") as HTMLInputElement).value = form?.domain ?? "";
  (document.getElementById("site-aliases") as HTMLInputElement).value = (form?.aliases || []).join(" ");
  (document.getElementById("site-root") as HTMLInputElement).value = form?.root ?? "";
  (document.getElementById("site-proxypass") as HTMLInputElement).value = form?.proxyPass ?? "";
  (document.getElementById("site-php") as HTMLInputElement).value = form?.phpSocket ?? "unix:/run/php/php-fpm.sock";
  (document.getElementById("site-ws") as HTMLInputElement).checked = !!form?.websocket;
  (document.getElementById("site-https") as HTMLInputElement).checked = !!form?.forceHttps;
  (document.getElementById("site-extra") as HTMLTextAreaElement).value = form?.extraDirectives ?? "";
  document.getElementById("site-error")!.classList.add("hidden");
  document.getElementById("site-preview")!.classList.add("hidden");
  syncSiteKindFields();
  dlgSite?.showModal();
}

async function editSite(name: string) {
  const res = await api.get(`/api/nginx/sites/${encodeURIComponent(name)}/raw`);
  const data = unwrap(res);
  if (!data) { toast(errMsg(res, t("errors.errorReadSiteConf", "No se pudo leer la configuración")), false); return; }
  if (isHostingPage()) {
    if (!data.editableForm) { toast(t("overview.customSiteReadOnly", "Este sitio contiene directivas especiales; pide a un administrador que lo edite."), false); return; }
    openSiteDialog({ name, form: data.editableForm, revision: data.revision });
    return;
  }
  void openAdv({ kind: "site-edit", name, revision: data.revision }, fmt(t("titles.editSiteAdv", "Editar {name} (avanzado)"), { name }), name, data.content ?? "", false);
}

function collectSiteForm() {
  return {
    kind: (document.getElementById("site-kind") as HTMLSelectElement).value,
    domain: (document.getElementById("site-domain") as HTMLInputElement).value.trim(),
    aliases: (document.getElementById("site-aliases") as HTMLInputElement).value.trim().split(/\s+/).filter(Boolean),
    root: (document.getElementById("site-root") as HTMLInputElement).value.trim() || undefined,
    phpSocket: (document.getElementById("site-php") as HTMLInputElement).value.trim() || undefined,
    proxyPass: (document.getElementById("site-proxypass") as HTMLInputElement).value.trim() || undefined,
    websocket: (document.getElementById("site-ws") as HTMLInputElement).checked,
    forceHttps: (document.getElementById("site-https") as HTMLInputElement).checked,
    extraDirectives: (document.getElementById("site-extra") as HTMLTextAreaElement).value.trim() || undefined,
  };
}

// ═══ Monaco advanced editor (single shared instance) ═══
let monacoReady = false;
type AdvCtx =
  | { kind: "site-create" }
  | { kind: "site-edit"; name: string; revision?: string }
  | { kind: "nginx-conf" };
let advCtx: AdvCtx = { kind: "site-create" };

// Lazy-load Monaco: el bundle pesa varios MB y bloquearía el module-eval,
// que es justo lo que abre la race de F5 ("data llega pero no se ve"):
// si la hidratación del DataTable termina antes de que este módulo
// registre `lxp:data-table:ready`, el handshake se pierde.
async function ensureMonaco() {
  if (monacoReady) return;
  const css = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLLinkElement>('link[data-lxp-files-monaco-css]');
    if (existing?.dataset.loaded === "true") { resolve(); return; }
    const link = existing ?? document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/scripts/extracted/pages/panel/files/panel-files-monaco.css?v=20260929-drawer-speed";
    link.dataset.lxpFilesMonacoCss = "";
    link.addEventListener("load", () => { link.dataset.loaded = "true"; resolve(); }, { once: true });
    link.addEventListener("error", () => { link.remove(); resolve(); }, { once: true });
    if (!existing) document.head.appendChild(link);
  });
  const [mod] = await Promise.all([
    import("/scripts/extracted/pages/panel/files/panel-files-monaco.js?v=20260929-drawer-speed"),
    css,
  ]);
  await mod.initFilesMonacoEditor({ hostId: "nginx-adv-host" });
  monacoReady = true;
}

async function openAdv(ctx: AdvCtx, title: string, name: string, content: string, showName: boolean) {
  advCtx = ctx;
  document.getElementById("adv-title")!.textContent = title;
  document.getElementById("adv-error")!.classList.add("hidden");
  const nameRow = document.getElementById("adv-name-row")!;
  nameRow.classList.toggle("hidden", !showName);
  (document.getElementById("adv-name") as HTMLInputElement).value = name;
  dlgAdv?.showModal();
  await ensureMonaco();
  const apiM = (window as any).__lxpFilesMonacoEditor;
  apiM?.openFile({ path: name || "nginx.conf", name: name || "nginx.conf", content, originalContent: content });
  setTimeout(() => apiM?.layout(), 60);
}

async function toggleSite(name: string, enabled: boolean) {
  const action = enabled ? "disable" : "enable";
  const res = await api.post<{ ok?: boolean }>(`/api/nginx/sites/${encodeURIComponent(name)}/${action}`, {});
  if (res.ok && (res.data?.ok ?? true)) { toast(enabled ? t("toasts.siteDisabled", "Sitio desactivado") : t("toasts.siteEnabled", "Sitio activado")); void loadSites(true); }
  else toast(errMsg(res, t("toasts.errorToggleSite", "No se pudo cambiar el estado")), false);
}

async function deleteSite(name: string) {
  const ok = await openConfirm(fmt(t("confirm.deleteSiteBody", "Se eliminará el server block \"{name}\" y su symlink. Esta acción no se puede deshacer."), { name }), { title: t("confirm.deleteSiteTitle", "Eliminar sitio"), variant: "danger" });
  if (!ok) return;
  const res = await api.delete<{ ok?: boolean }>(`/api/nginx/sites/${encodeURIComponent(name)}`);
  if (res.ok && (res.data?.ok ?? true)) { toast(t("toasts.siteDeleted", "Sitio eliminado")); void loadSites(true); }
  else toast(errMsg(res, t("toasts.errorDeleteSite", "No se pudo eliminar")), false);
}

// ═══ REVERSE PROXY ═══
function syncProxyBalance() {
  const count = upstreamsWrap?.querySelectorAll(".proxy-up-row").length ?? 0;
  document.getElementById("proxy-balance-group")?.classList.toggle("hidden", count < 2);
}
function addUpstreamRow(value = "") {
  if (!upstreamsWrap) return;
  const row = document.createElement("div");
  row.className = "flex gap-2 proxy-up-row";
  row.innerHTML = `<input type="text" value="${esc(value)}" placeholder="127.0.0.1:3000" class="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none" />
    <button type="button" class="rounded-lg border border-border px-3 text-xs hover:bg-accent">✕</button>`;
  row.querySelector("button")!.addEventListener("click", () => {
    if (upstreamsWrap!.querySelectorAll(".proxy-up-row").length > 1) { row.remove(); syncProxyBalance(); }
  });
  upstreamsWrap.appendChild(row);
  syncProxyBalance();
}

function collectProxy() {
  const upstreams = [...(upstreamsWrap?.querySelectorAll<HTMLInputElement>(".proxy-up-row input") ?? [])]
    .map((i) => i.value.trim()).filter(Boolean).map((server) => ({ server }));
  return {
    domain: (document.getElementById("proxy-domain") as HTMLInputElement).value.trim(),
    aliases: [],
    upstreams,
    balance: (document.getElementById("proxy-balance") as HTMLSelectElement).value,
    websocket: (document.getElementById("proxy-ws") as HTMLInputElement).checked,
    forceHttps: (document.getElementById("proxy-https") as HTMLInputElement).checked,
    enabled: true,
  };
}

async function loadUpstreams() {
  const scope = resolveTargetScope();
  const res = await upstreamPages.read<any[]>(params => api.get("/api/nginx/upstreams", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (scope !== resolveTargetScope() || !document.getElementById("nginx-tabs")) return;
  const data = unwrap(res) || [];
  publish(UPSTREAMS_TABLE, data.map((u: any) => ({ name: u.name, servers: (u.servers || []).join(", "), file: u.file })));
}

// ═══ SSL ═══
// HTTPS se habilita por sitio; la renovación se comprueba en el servidor
// conectado y se configura con temporizador + deploy hook que recarga NGINX.
async function loadRenewalStatus() {
  const host = document.getElementById("nginx-renewal-status");
  if (!host) return;
  const scope = resolveTargetScope();
  const res = await api.get("/api/nginx/ssl/renewal");
  if (scope !== resolveTargetScope() || !document.getElementById("nginx-renewal-status")) return;
  const status = unwrap(res);
  if (!status) { host.textContent = errMsg(res, t("ssl.renewalFailed", "No se pudo comprobar la renovación.")); return; }
  if (!status.installed) host.textContent = t("ssl.renewalNoCertbot", "Certbot no está instalado en este servidor.");
  else if (status.automatic) host.textContent = `${t("ssl.renewalActive", "Renovación automática activa; NGINX se recargará tras renovar.")} (${status.scheduler})`;
  else if (status.scheduler && !status.reloadHook) host.textContent = t("ssl.renewalMissingHook", "La tarea está activa, pero falta la recarga de NGINX tras renovar.");
  else if (!status.scheduler && status.reloadHook) host.textContent = t("ssl.renewalMissingScheduler", "La recarga está preparada, pero falta programar la renovación.");
  else host.textContent = t("ssl.renewalMissing", "La renovación automática aún no está configurada o activa.");
  host.classList.toggle("text-emerald-500", !!status.automatic);
  host.classList.toggle("text-amber-500", !status.automatic);
}

async function configureRenewal(output: HTMLElement) {
  output.classList.add("hidden");
  const res = await api.post("/api/nginx/ssl/renewal", {});
  const data = unwrap(res);
  if (!data?.automatic) {
    const message = errMsg(res, t("ssl.renewalFailed", "No se pudo configurar la renovación."));
    output.textContent = message;
    output.classList.remove("hidden");
    toast(message, false);
  } else toast(t("ssl.renewalConfigured", "Renovación automática configurada."));
  await Promise.all([loadRenewalStatus(), loadSites(true)]);
}

async function testRenewal(output: HTMLElement) {
  output.classList.remove("hidden");
  output.textContent = t("ssl.renewalTesting", "Probando la renovación…");
  const res = await api.post("/api/nginx/ssl/renewal/dry-run", {});
  const data = unwrap(res);
  output.textContent = data?.output || errMsg(res, t("ssl.renewalTestFailed", "La prueba de renovación falló."));
  toast(data?.ok ? t("ssl.renewalTestSuccess", "Prueba de renovación correcta.") : t("ssl.renewalTestFailed", "La prueba de renovación falló."), !!data?.ok);
}

// ═══ LOGS ═══
let logTimer: any = null;
async function refreshLogs() {
  // Page guard: after an SPA nav away from nginx the log controls are gone but
  // the 5s auto-refresh timer could still fire. Bail (and stop the timer) so we
  // don't throw a TypeError every tick or spam /api/nginx/logs off-page.
  const siteEl = document.getElementById("log-site") as HTMLSelectElement | null;
  if (!siteEl) { if (logTimer) { clearInterval(logTimer); logTimer = null; } return; }
  const site = siteEl.value;
  if (!site && !isAdminPage()) {
    document.getElementById("log-output")!.textContent = t("overview.selectSite", "Selecciona un sitio para consultar sus registros.");
    return;
  }
  const type = (document.getElementById("log-type") as HTMLSelectElement).value;
  const lines = (document.getElementById("log-lines") as HTMLInputElement).value || "200";
  const qs = new URLSearchParams({ type, lines, ...(site ? { site } : {}) }).toString();
  const scope = resolveTargetScope();
  const res = await api.get(`/api/nginx/logs?${qs}`);
  if (scope !== resolveTargetScope() || !document.getElementById("nginx-tabs")) return;
  const data = unwrap(res);
  const out = document.getElementById("log-output")!;
  if (!data) { out.textContent = errMsg(res, t("toasts.errorLoadLogs", "No se pudieron leer los logs")); return; }
  out.textContent = data.lines || t("empty.logsEmpty", "(vacío)");
  document.getElementById("log-path")!.textContent = data.path || "";
  out.scrollTop = out.scrollHeight;
}

// ═══ ESTADO ═══
async function loadStatus() {
  const scope = resolveTargetScope();
  const res = await api.get("/api/nginx/status");
  if (scope !== resolveTargetScope() || !document.getElementById("nginx-tabs")) return;
  const s = unwrap(res);
  const cards = document.getElementById("status-cards")!;
  if (!s) {
    const message = errMsg(res, t("toasts.errorLoadStatus", "No se pudo obtener el estado"));
    cards.textContent = message;
    const overview = document.getElementById("overview-health");
    if (overview) overview.textContent = message;
    return;
  }
  latestStatus = s;
  renderOverview();
  const card = (label: string, value: string, cls = "") =>
    `<div class="rounded-xl border border-border bg-card p-4"><p class="text-xs text-muted-foreground">${esc(label)}</p><p class="mt-1 text-lg font-semibold ${cls}">${esc(value)}</p></div>`;
  cards.innerHTML =
    card(t("labels.service", "Servicio"), s.running ? t("labels.running", "Activo") : t("labels.stopped", "Detenido"), s.running ? "text-emerald-500" : "text-destructive") +
    card(t("labels.version", "Versión"), s.version || "—") +
    card(t("labels.activeSites", "Sitios activos"), `${s.enabledSites} / ${s.availableSites}`) +
    card("nginx -t", s.configTest?.ok ? t("labels.ok", "OK") : t("labels.error", "Error"), s.configTest?.ok ? "text-emerald-500" : "text-destructive");
  if (!isAdminPage()) return;
  const confPrev = document.getElementById("conf-preview")!;
  const cRes = await api.get("/api/nginx/config");
  if (scope !== resolveTargetScope() || !document.getElementById("nginx-tabs")) return;
  const cData = unwrap(cRes);
  confPrev.textContent = cData?.content ?? errMsg(cRes, t("toasts.errorReadConf", "No se pudo leer nginx.conf"));
}

// ═══ RENDIMIENTO ═══
async function loadPerf() {
  const scope = resolveTargetScope();
  const res = await api.get("/api/nginx/performance");
  if (scope !== resolveTargetScope() || !document.getElementById("nginx-tabs")) return;
  const p = unwrap(res);
  if (!p) { toast(errMsg(res, t("toasts.errorLoadPerf", "No se pudo leer el rendimiento")), false); return; }
  (document.getElementById("perf-gzip") as HTMLInputElement).checked = !!p.gzip;
  (document.getElementById("perf-gzip-level") as HTMLInputElement).value = String(p.gzipLevel ?? 5);
  (document.getElementById("perf-sendfile") as HTMLInputElement).checked = !!p.sendfile;
  (document.getElementById("perf-ofc") as HTMLInputElement).checked = !!p.openFileCache;
  (document.getElementById("perf-pcache") as HTMLInputElement).checked = !!p.proxyCache;
  (document.getElementById("perf-cache-days") as HTMLInputElement).value = String(p.staticCacheDays ?? 30);
  (document.getElementById("perf-keepalive") as HTMLInputElement).value = String(p.keepaliveTimeout ?? 65);
  (document.getElementById("perf-workers") as HTMLInputElement).value = String(p.workerProcesses ?? "auto");
  (document.getElementById("perf-conns") as HTMLInputElement).value = String(p.workerConnections ?? 1024);
}

// ── Window listeners (module-eval, persisten cross-nav) ────────
// El cache/ready state vive a nivel de módulo y sobrevive a navegación SPA.
// Los listeners de window se registran UNA vez: el DataTable react se
// re-monta en cada navegación y re-emite `ready` → handler re-emite cache.
window.addEventListener(DATATABLE_EVENTS.READY, (e: Event) => {
  const d = (e as CustomEvent<any>).detail;
  if (!d?.tableId) return;
  ready[d.tableId] = true;
  if (cacheScope === resolveTargetScope() && cache[d.tableId]) window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_DATA, { detail: { tableId: d.tableId, data: cache[d.tableId] } }));
});

window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (e: Event) => {
  if (!document.getElementById("nginx-tabs")) return;
  const d = (e as CustomEvent<any>).detail;
  const row = d?.row;
  if (!row) return;
  if (d.tableId === SITES_TABLE) {
    const full = sitesData.find((s) => s.name === row._name);
    if (d.actionId === "edit") void editSite(full?.name ?? row._name);
    else if (d.actionId === "toggle") void toggleSite(row._name, !!row._enabled);
    else if (d.actionId === "ssl") {
      (document.getElementById("ssl-site") as HTMLSelectElement).value = row._name;
      document.getElementById("ssl-error")!.classList.add("hidden");
      dlgSsl?.showModal();
    } else if (d.actionId === "renewal") openSiteRenewalDialog(row._name);
    else if (d.actionId === "delete") void deleteSite(row._name);
  }
});

// ── Init (re-ejecuta en cada navegación SPA) ───────────────────
// AbortController limpia los listeners del init previo antes de re-atar.
// Cooldown evita que init() se ejecute 3x por entrada (module-eval +
// astro:after-swap + astro:page-load disparan en cadena), lo que en
// versiones previas causaba 3 GET /api/nginx/sites por nav.
let initController: AbortController | null = null;
let initLastAt = 0;
let mountedRoot: HTMLElement | null = null;
const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;

function init() {
  const root = document.getElementById("nginx-tabs");
  if (!root) return;
  if (root !== mountedRoot || cacheScope !== resolveTargetScope()) {
    mountedRoot = root;
    watchModuleData(["nginx/sites"], () => loadSites(), root);
    cacheScope = resolveTargetScope();
    initLastAt = 0;
    latestStatus = null;
    sitesData = [];
    delete cache[SITES_TABLE];
    delete cache[UPSTREAMS_TABLE];
  }
  loadI18n();
  // ⚠ Las bindings + UI DEBEN re-correr en cada init (DOM puede ser fresh
  // tras swap SPA). El cooldown SOLO bloquea fetches duplicados. Antes el
  // cooldown bloqueaba todo el init → tabs y botones quedaban sin
  // listeners en re-entradas rápidas (<4s) y al hacer click "no pasaba
  // nada". AbortController dedupea handlers entre fires del mismo entry.
  initController?.abort();
  initController = new AbortController();
  const { signal } = initController;
  bindSettings(signal);

  // Re-acquire DOM refs (el swap de Astro reemplaza los nodos).
  dlgSite = document.getElementById("dialog-site") as HTMLDialogElement;
  dlgSsl = document.getElementById("dialog-ssl") as HTMLDialogElement;
  dlgAdv = document.getElementById("dialog-adv") as HTMLDialogElement;
  upstreamsWrap = document.getElementById("proxy-upstreams");
  monacoReady = false; // host DOM cambió: forzar reinit en próximo openAdv
  document.getElementById("nginx-cf-banner")?.replaceChildren(); // banner CF: no sobrevive navegación

  // Handshake: si los DataTables ya estaban montados y despacharon `ready`
  // antes de que el listener de este módulo existiera (race de F5), el
  // ping `request-ready` los hace re-emitir `ready` → window listener
  // los marca y publish() vuelca cache.
  for (const tableId of [SITES_TABLE, UPSTREAMS_TABLE]) {
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId } }));
  }

  // Tabs
  availableTabs().forEach((id) =>
    document.getElementById(id)?.addEventListener("click", () => activateTab(id), { signal }),
  );
  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const tabs = availableTabs();
    const current = tabs.indexOf((document.activeElement as HTMLElement)?.id);
    if (current < 0) return;
    const next = tabs[(current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    document.getElementById(next)?.focus();
    activateTab(next);
    event.preventDefault();
  }, { signal });

  document.getElementById("overview-new-site")?.addEventListener("click", () => { activateTab("tab-sites"); openSiteDialog(); }, { signal });
  document.getElementById("overview-open-sites")?.addEventListener("click", () => activateTab("tab-sites"), { signal });
  document.getElementById("overview-test")?.addEventListener("click", async () => {
    const out = document.getElementById("overview-action-result")!;
    out.textContent = t("overview.checking", "Comprobando la configuración…");
    const res = await api.post("/api/nginx/service", { action: "test" });
    const data = unwrap(res);
    out.textContent = data?.output ?? errMsg(res, t("toasts.svcActionFailed", "No se pudo comprobar NGINX"));
    void loadStatus();
  }, { signal });
  document.getElementById("nginx-ai-overview")?.addEventListener("click", () => void askAssistant("overview", t("overview.aiOverviewPrompt", "Analiza el estado y los sitios NGINX del servidor conectado con nginx.status y nginx.list_sites. Si tienes permiso, comprueba nginx -t y el error log. Explica las evidencias, prioriza problemas y propón pasos concretos sin ejecutar cambios.")), { signal });
  document.getElementById("nginx-ai-site")?.addEventListener("click", () => {
    const name = (document.getElementById("nginx-ai-site-select") as HTMLSelectElement).value;
    if (!name) { toast(t("overview.selectSite", "Selecciona un sitio."), false); return; }
    const prompt = fmt(t("overview.aiSitePrompt", "Diagnostica el sitio NGINX {site} del servidor conectado. Usa nginx.inspect_site y nginx.tail_error_log con site={site} y lines={lines}; explica evidencias y propón pasos sin aplicar cambios."), { site: name, lines: String(readAiPrefs().lines) });
    void askAssistant("site", prompt);
  }, { signal });
  document.getElementById("nginx-ai-logs")?.addEventListener("click", () => {
    const site = (document.getElementById("log-site") as HTMLSelectElement).value;
    if (!site && !isAdminPage()) { toast(t("overview.selectSite", "Selecciona un sitio."), false); return; }
    const type = (document.getElementById("log-type") as HTMLSelectElement).value;
    const tool = type === "access" ? "nginx.tail_access_log" : "nginx.tail_error_log";
    const prompt = fmt(t("overview.aiLogsPrompt", "Analiza {lines} líneas recientes del registro {type} de NGINX para {site}. Usa {tool}; identifica causas y propón pasos sin ejecutar cambios."), { lines: String(readAiPrefs().lines), type, site: site || t("overview.aiGlobalSite", "global (omite el parámetro site)"), tool });
    void askAssistant("logs", prompt);
  }, { signal });

  // Sitios
  document.getElementById("site-kind")?.addEventListener("change", syncSiteKindFields, { signal });
  document.getElementById("btn-new-site")?.addEventListener("click", () => openSiteDialog(), { signal });
  document.getElementById("site-close")?.addEventListener("click", () => dlgSite?.close(), { signal });
  document.getElementById("site-cancel")?.addEventListener("click", () => dlgSite?.close(), { signal });
  document.getElementById("site-preview-btn")?.addEventListener("click", async () => {
    const out = document.getElementById("site-preview")!;
    const res = await api.post("/api/nginx/sites/preview", collectSiteForm());
    const data = unwrap(res);
    out.textContent = data?.content ?? errMsg(res, t("toasts.errorPreview", "No se pudo previsualizar"));
    out.classList.remove("hidden");
  }, { signal });
  document.getElementById("site-advanced")?.addEventListener("click", async () => {
    const errBox = document.getElementById("site-error")!;
    errBox.classList.add("hidden");
    if (editingSite) {
      const res = await api.get(`/api/nginx/sites/${encodeURIComponent(editingSite)}/raw`);
      const data = unwrap(res);
      if (!data) { errBox.textContent = errMsg(res, t("errors.errorReadSiteConf", "No se pudo leer la configuración")); errBox.classList.remove("hidden"); return; }
      const name = editingSite;
      dlgSite?.close();
      void openAdv({ kind: "site-edit", name, revision: data.revision }, fmt(t("titles.editSiteAdv", "Editar {name} (avanzado)"), { name }), name, data.content ?? "", false);
    } else {
      const form = collectSiteForm();
      if (!form.domain) { errBox.textContent = t("errors.indicateDomainFirst", "Indica el dominio antes de pasar a avanzado"); errBox.classList.remove("hidden"); return; }
      const pv = await api.post<{ ok?: boolean }>("/api/nginx/sites/preview", form);
      const data = unwrap(pv);
      if (!data?.content) { errBox.textContent = errMsg(pv, t("toasts.errorPreview", "No se pudo previsualizar")); errBox.classList.remove("hidden"); return; }
      const content = data.content;
      dlgSite?.close();
      void openAdv({ kind: "site-create" }, t("titles.newSiteAdv", "Nuevo sitio (avanzado)"), form.domain, content, true);
    }
  }, { signal });

  document.getElementById("form-site")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("site-error")!;
    const form = collectSiteForm();
    if (!form.domain) { errBox.textContent = t("errors.domainRequired", "El dominio es obligatorio"); errBox.classList.remove("hidden"); return; }
    const isCreate = !editingSite;
    const res = editingSite
      ? await api.put<{ ok?: boolean }>(`/api/nginx/sites/${encodeURIComponent(editingSite)}`, { mode: "form", form, expectedRevision: siteRevision || undefined })
      : await api.post<{ ok?: boolean }>("/api/nginx/sites", { mode: "form", enabled: true, form });
    if (res.ok && (res.data?.ok ?? true)) {
      dlgSite?.close();
      toast(isCreate ? t("toasts.siteCreated", "Sitio creado") : t("toasts.siteUpdated", "Sitio actualizado"));
      if (isCreate) showCloudflareDnsBanner(form.domain);
      void loadSites(true);
    } else {
      errBox.textContent = errMsg(res, t("errors.errorSaveSite", "Error al guardar el sitio"));
      errBox.classList.remove("hidden");
    }
  }, { signal });

  // Advanced editor
  document.getElementById("adv-close")?.addEventListener("click", () => dlgAdv?.close(), { signal });
  document.getElementById("adv-cancel")?.addEventListener("click", () => dlgAdv?.close(), { signal });
  document.getElementById("adv-save")?.addEventListener("click", async () => {
    const apiM = (window as any).__lxpFilesMonacoEditor;
    const content = apiM?.getValue() ?? "";
    const errBox = document.getElementById("adv-error")!;
    errBox.classList.add("hidden");
    let res: any;
    if (advCtx.kind === "nginx-conf") {
      res = await api.put<{ ok?: boolean }>("/api/nginx/config", { content });
    } else if (advCtx.kind === "site-edit") {
      res = await api.put<{ ok?: boolean }>(`/api/nginx/sites/${encodeURIComponent(advCtx.name)}`, { mode: "raw", content, expectedRevision: advCtx.revision });
    } else {
      const name = (document.getElementById("adv-name") as HTMLInputElement).value.trim();
      if (!name) { errBox.textContent = t("errors.indicateFileName", "Indica el nombre del archivo"); errBox.classList.remove("hidden"); return; }
      res = await api.post<{ ok?: boolean }>("/api/nginx/sites", { mode: "raw", name, enabled: true, content });
    }
    if (res.ok && (res.data?.ok ?? true)) {
      apiM?.markSaved(content);
      dlgAdv?.close();
      toast(t("toasts.confSaved", "Configuración guardada y validada"));
      if (advCtx.kind === "nginx-conf") void loadStatus();
      else void loadSites(true);
    } else {
      errBox.textContent = errMsg(res, t("errors.nginxTestFailedSave", "nginx -t falló o no se pudo guardar"));
      errBox.classList.remove("hidden");
    }
  }, { signal });

  // Reverse proxy
  if (upstreamsWrap && upstreamsWrap.querySelectorAll(".proxy-up-row").length === 0) addUpstreamRow();
  document.getElementById("proxy-add-upstream")?.addEventListener("click", () => addUpstreamRow(), { signal });
  document.getElementById("proxy-preview-btn")?.addEventListener("click", async () => {
    const res = await api.post<{ ok?: boolean }>("/api/nginx/proxy/preview", collectProxy());
    const data = unwrap(res);
    document.getElementById("proxy-preview")!.textContent = data?.content ?? errMsg(res, t("toasts.errorPreview", "No se pudo previsualizar"));
  }, { signal });
  document.getElementById("form-proxy")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("proxy-error")!;
    errBox.classList.add("hidden");
    const cfg = collectProxy();
    if (!cfg.domain || cfg.upstreams.length === 0) { errBox.textContent = t("errors.domainAndUpstreamRequired", "Dominio y al menos un upstream son obligatorios"); errBox.classList.remove("hidden"); return; }
    const res = await api.post<{ ok?: boolean }>("/api/nginx/proxy", cfg);
    if (res.ok && (res.data?.ok ?? true)) { toast(t("toasts.proxyCreated", "Reverse proxy creado")); void loadUpstreams(); void loadSites(); }
    else { errBox.textContent = errMsg(res, t("errors.errorCreateProxy", "No se pudo crear el proxy")); errBox.classList.remove("hidden"); }
  }, { signal });

  // SSL dialog
  document.getElementById("btn-enable-https")?.addEventListener("click", () => {
    document.getElementById("ssl-error")!.classList.add("hidden");
    dlgSsl?.showModal();
  }, { signal });
  document.getElementById("ssl-close")?.addEventListener("click", () => dlgSsl?.close(), { signal });
  document.getElementById("ssl-cancel")?.addEventListener("click", () => dlgSsl?.close(), { signal });
  document.getElementById("form-ssl")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("ssl-error")!;
    errBox.classList.add("hidden");
    const name = (document.getElementById("ssl-site") as HTMLSelectElement).value;
    const email = (document.getElementById("ssl-email") as HTMLInputElement).value.trim();
    if (!name || !email) { errBox.textContent = t("errors.siteAndEmailRequired", "Sitio y email son obligatorios"); errBox.classList.remove("hidden"); return; }
    toast(t("toasts.issuingCert", "Emitiendo certificado… puede tardar"));
    const res = await api.post<{ ok?: boolean }>(`/api/nginx/sites/${encodeURIComponent(name)}/ssl`, { email });
    if (res.ok && (res.data?.ok ?? true)) {
      dlgSsl?.close();
      const renewal = unwrap(res)?.renewal;
      toast(renewal?.automatic
        ? t("toasts.httpsEnabled", "HTTPS habilitado")
        : `${t("toasts.httpsEnabled", "HTTPS habilitado")}. ${t("ssl.renewalWarning", "La renovación automática requiere atención.")}`, !!renewal?.automatic);
      if (!renewal?.automatic && renewal?.error) {
        const output = document.getElementById("nginx-renewal-result");
        if (output) { output.textContent = renewal.error; output.classList.remove("hidden"); }
      }
      void loadSites(true);
      void loadRenewalStatus();
    }
    else { errBox.textContent = errMsg(res, t("errors.errorIssueCert", "No se pudo emitir el certificado")); errBox.classList.remove("hidden"); }
  }, { signal });
  document.getElementById("nginx-renewal-configure")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const host = document.getElementById("nginx-renewal-status")!;
    button.disabled = true;
    host.textContent = t("ssl.renewalConfiguring", "Configurando la renovación…");
    try { await configureRenewal(document.getElementById("nginx-renewal-result")!); }
    finally { button.disabled = false; }
  }, { signal });
  document.getElementById("nginx-renewal-test")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try { await testRenewal(document.getElementById("nginx-renewal-result")!); }
    finally { button.disabled = false; }
  }, { signal });
  document.getElementById("site-renewal-close")?.addEventListener("click", () => (document.getElementById("dialog-site-renewal") as HTMLDialogElement).close(), { signal });
  document.getElementById("site-renewal-enable-https")?.addEventListener("click", () => {
    (document.getElementById("dialog-site-renewal") as HTMLDialogElement).close();
    (document.getElementById("ssl-site") as HTMLSelectElement).value = selectedRenewalSite;
    dlgSsl?.showModal();
  }, { signal });
  document.getElementById("site-renewal-configure")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try { await configureRenewal(document.getElementById("site-renewal-output")!); }
    finally { paintSiteRenewalDialog(); }
  }, { signal });
  document.getElementById("site-renewal-test")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try { await testRenewal(document.getElementById("site-renewal-output")!); }
    finally { paintSiteRenewalDialog(); }
  }, { signal });

  // Logs
  document.getElementById("log-refresh")?.addEventListener("click", () => void refreshLogs(), { signal });
  document.getElementById("log-auto")?.addEventListener("change", (e) => {
    const on = (e.target as HTMLInputElement).checked;
    if (logTimer) { clearInterval(logTimer); logTimer = null; }
    if (on) { void refreshLogs(); logTimer = setInterval(() => void refreshLogs(), 5000); }
  }, { signal });

  // Status / svc / conf
  document.querySelectorAll<HTMLButtonElement>(".svc-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.svc!;
      const actionLabel = btn.textContent?.trim() || action;
      if (action === "stop" || action === "restart") {
        const ok = await openConfirm(fmt(t("confirm.svcActionBody", "¿Ejecutar «{action}» sobre el servicio nginx?"), { action: actionLabel }), { title: `nginx ${actionLabel}`, variant: action === "stop" ? "danger" : "default" });
        if (!ok) return;
      }
      const res = await api.post<{ ok?: boolean }>("/api/nginx/service", { action });
      const data = unwrap(res);
      const out = document.getElementById("svc-output")!;
      out.classList.remove("hidden");
      out.textContent = (data?.output ?? errMsg(res, t("labels.error", "Error"))) || fmt(t("toasts.svcActionDone", "Acción «{action}» completada"), { action: actionLabel });
      if (res.ok) { toast(fmt(t("toasts.svcActionOk", "nginx: acción «{action}» completada"), { action: actionLabel })); void loadStatus(); }
      else toast(errMsg(res, fmt(t("toasts.svcActionFailed", "Falló la acción «{action}»"), { action: actionLabel })), false);
    }, { signal });
  });
  document.getElementById("btn-edit-conf")?.addEventListener("click", async () => {
    const res = await api.get("/api/nginx/config");
    const data = unwrap(res);
    if (!data) { toast(errMsg(res, t("toasts.errorReadConf", "No se pudo leer nginx.conf")), false); return; }
    void openAdv({ kind: "nginx-conf" }, t("titles.editNginxConf", "Editar nginx.conf"), "nginx.conf", data.content ?? "", false);
  }, { signal });

  // Rendimiento
  document.getElementById("form-perf")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("perf-error")!;
    errBox.classList.add("hidden");
    const workersRaw = (document.getElementById("perf-workers") as HTMLInputElement).value.trim();
    const payload = {
      gzip: (document.getElementById("perf-gzip") as HTMLInputElement).checked,
      gzipLevel: Number((document.getElementById("perf-gzip-level") as HTMLInputElement).value) || 5,
      sendfile: (document.getElementById("perf-sendfile") as HTMLInputElement).checked,
      openFileCache: (document.getElementById("perf-ofc") as HTMLInputElement).checked,
      proxyCache: (document.getElementById("perf-pcache") as HTMLInputElement).checked,
      staticCacheDays: Number((document.getElementById("perf-cache-days") as HTMLInputElement).value) || 0,
      keepaliveTimeout: Number((document.getElementById("perf-keepalive") as HTMLInputElement).value) || 0,
      workerProcesses: workersRaw === "auto" || workersRaw === "" ? "auto" : Number(workersRaw) || "auto",
      workerConnections: Number((document.getElementById("perf-conns") as HTMLInputElement).value) || 1024,
    };
    const res = await api.put<{ ok?: boolean }>("/api/nginx/performance", payload);
    if (res.ok && (res.data?.ok ?? true)) { toast(t("toasts.perfApplied", "Rendimiento aplicado y validado")); void loadPerf(); }
    else { errBox.textContent = errMsg(res, t("errors.nginxTestFailedApply", "nginx -t falló o no se pudo aplicar")); errBox.classList.remove("hidden"); }
  }, { signal });

  // Dependencias: fuera del cooldown a propósito. El banner vive en DOM
  // fresh tras cada swap (oculto y vacío por defecto): si no se re-checa,
  // un nginx faltante quedaría sin aviso en re-entradas rápidas. La llamada
  // es re-entrante (no apila listeners) y el GET de estado es liviano.
  checkModuleDeps();

  // Activación de tab: la parte UI siempre corre (DOM puede ser fresh);
  // el fetch va detrás del cooldown.
  const tabId = savedTabId();
  activateTabUI(tabId);
  if (Date.now() - initLastAt >= INIT_COOLDOWN_MS) {
    initLastAt = Date.now();
    loadTabData(tabId);
  }
}

// SPA teardown: init() only aborts `{signal}` listeners; the log auto-refresh
// setInterval isn't one, so clear it explicitly before the next page mounts.
document.addEventListener("astro:before-swap", () => {
  if (logTimer) { clearInterval(logTimer); logTimer = null; }
  initController?.abort();
});
window.addEventListener("luxipanel:target-changed", () => {
  if (logTimer) { clearInterval(logTimer); logTimer = null; }
  cacheScope = "";
  latestStatus = null;
  sitesData = [];
  delete cache[SITES_TABLE];
  delete cache[UPSTREAMS_TABLE];
  initLastAt = 0;
  setTimeout(() => init(), 0);
});
document.addEventListener("astro:page-load", () => init());
document.addEventListener("astro:after-swap", () => init());
init();
