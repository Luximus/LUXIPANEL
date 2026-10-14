import { MODULE_ICON_SVGS } from "/scripts/extracted/lib/module-icons.generated.js";
import { animateViewEnter, tabDirection } from "/scripts/extracted/lib/dom.js";
import { getCsrfToken, resolvePanelApiPath, CSRF_HEADER_NAME, scopeHeaders } from "/scripts/extracted/lib/api-client.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { bindShredderOrder } from "/scripts/reactbits-controls.20261004-1.js";
// The `/api/admin/modules` endpoints below MUST match lib/api-routes.ts
// ADMIN_MODULES_PATH (this entry is bundle:false and only resolves runtime-URL
// shared libs; api-routes.ts is not emitted as a runtime lib, so keep the
// literals in lockstep).

const { loadI18n, t, fmt } = createPageI18n("modules-i18n");
// Título + descripción de los módulos CORE traducidos (namespace moduleCatalog,
// embebido por la página en el idioma activo). Mapa { [code]: { name, description } }.
let CATALOG_I18N: Record<string, { name?: string; description?: string }> = {};
function loadCatalogI18n() { try { const el = document.getElementById("modules-catalog-i18n"); if (el?.textContent) CATALOG_I18N = JSON.parse(el.textContent) as Record<string, { name?: string; description?: string }>; } catch { CATALOG_I18N = {}; } }
// Idioma activo del panel (cookie lxp-locale) para pedir a la API los módulos de
// comunidad ya localizados por LP.
// MUST match i18n/config.ts localeCookieName (bundle:false extracted module).
function activeLocale(): string { try { const m = document.cookie.match(/(?:^|;\s*)lxp-locale=([^;]+)/); return m?.[1] ? decodeURIComponent(m[1]) : ""; } catch { return ""; } }

const ICON_MAP = {
  users: "ti-users",
  mail: "ti-mail",
  webhooks: "ti-webhook",
  dns: "ti-server",
  backups: "ti-archive",
  cron: "ti-clock",
  ssl: "ti-certificate",
  monitor: "ti-activity",
  files: "ti-folder",
  firewall: "ti-shield-lock",
  assistant: "ti-robot",
  "repository-store": "ti-brand-github",
  openclaw: "ti-brain",
  hosting: "ti-building",
  terminal: "ti-terminal-2",
  bitninja: "ti-shield-check",
  databases: "ti-database",
  obsidian: "ti-notebook",
  cloudflare: "ti-brand-cloudflare",
  "server-alerts": "ti-bell-ringing",
  expo: "ti-brand-expo",
  "security-audit": "ti-shield-search",
  "filesystem-mcp": "ti-folder-cog",
  "github-mcp": "ti-brand-github",
  "google-drive": "ti-brand-google-drive",
  onedrive: "ti-brand-onedrive",
  dropbox: "ti-brand-dropbox",
  notion: "ti-brand-notion",
};
const COLOR_MAP = {
  users: { bg: "bg-blue-500/10", text: "text-blue-500" },
  mail: { bg: "bg-sky-500/10", text: "text-sky-500" },
  webhooks: { bg: "bg-violet-500/10", text: "text-violet-500" },
  dns: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  backups: { bg: "bg-amber-500/10", text: "text-amber-500" },
  cron: { bg: "bg-orange-500/10", text: "text-orange-500" },
  ssl: { bg: "bg-green-500/10", text: "text-green-500" },
  monitor: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  files: { bg: "bg-amber-500/10", text: "text-amber-500" },
  firewall: { bg: "bg-red-500/10", text: "text-red-500" },
  assistant: { bg: "bg-violet-500/10", text: "text-violet-500" },
  "repository-store": { bg: "bg-slate-500/10", text: "text-slate-500" },
  openclaw: { bg: "bg-violet-500/10", text: "text-violet-500" },
  hosting: { bg: "bg-blue-500/10", text: "text-blue-500" },
  terminal: { bg: "bg-slate-500/10", text: "text-slate-500" },
  bitninja: { bg: "bg-teal-500/10", text: "text-teal-500" },
  databases: { bg: "bg-cyan-500/10", text: "text-cyan-500" },
  obsidian: { bg: "bg-purple-500/10", text: "text-purple-500" },
  cloudflare: { bg: "bg-orange-500/10", text: "text-orange-500" },
  "server-alerts": { bg: "bg-red-500/10", text: "text-red-500" },
  expo: { bg: "bg-slate-500/10", text: "text-slate-500" },
  "security-audit": { bg: "bg-rose-500/10", text: "text-rose-500" },
  "filesystem-mcp": { bg: "bg-slate-500/10", text: "text-slate-500" },
  "github-mcp": { bg: "bg-slate-500/10", text: "text-slate-500" },
  "google-drive": { bg: "bg-yellow-500/10", text: "text-yellow-500" },
  onedrive: { bg: "bg-sky-500/10", text: "text-sky-500" },
  dropbox: { bg: "bg-blue-500/10", text: "text-blue-500" },
  notion: { bg: "bg-zinc-500/10", text: "text-zinc-500" },
};
function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    communication: t("categories.communication", "Comunicación"),
    infrastructure: t("categories.infrastructure", "Infraestructura"),
    security: t("categories.security", "Seguridad"),
    developer: t("categories.developer", "Desarrollador"),
  };
  return map[cat] ?? cat;
}
// Forma normalizada de un módulo tal como la usa esta vista. Los campos
// `name`/`description`/`category` siempre acaban siendo string tras el mapeo de
// `fetchModules`; el resto son opcionales según lo que devuelva la API (core vs
// comunidad). El origen (`/api/admin/modules`) es dinámico, de ahí que se lea
// como esta forma laxa y se normalice.
interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  kind?: string;
  enabled?: boolean;
  installed?: boolean;
  position?: number;
  features?: string[];
  version?: string;
  installs?: number;
  rating?: number;
  author?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  tag?: string;
  supportsFloatingButton?: boolean;
  showFloatingButton?: boolean;
}
type TabKey = "all" | "modules" | "integrations" | "installed";

let allModules: ModuleInfo[] = [];
let activeTab = "all";
let categoryFilter = "all";
let statusFilter = "all";
// Refs DOM mutables — Astro ClientRouter reemplaza el DOM en cada swap,
// así que la captura `const x = document.getElementById(...)` a module-eval
// dejaba refs huérfanas y `grid.innerHTML = ...` escribía a un nodo
// removido → la tarjeta nueva quedaba en skeleton para siempre (bug
// reportado 2026-05-20). init() reasigna estas refs en cada entrada.
let grid: HTMLElement | null, empty: HTMLElement | null, search: HTMLInputElement | null;
let tabAll: HTMLElement | null, tabModules: HTMLElement | null, tabIntegrations: HTMLElement | null, tabInstalled: HTMLElement | null;
let tabAllCount: HTMLElement | null, tabModulesCount: HTMLElement | null, tabIntegrationsCount: HTMLElement | null, tabInstalledCount: HTMLElement | null;
// Categorías y estado son un único <select> cada uno (visible a todos
// los anchos); los recuentos vivos se reflejan en cada <option> con
// setOptionCount, que antepone la etiqueta localizada vía data-label.
let categoryFilterSelect: HTMLSelectElement | null, statusFilterSelect: HTMLSelectElement | null;

function acquireDomRefs() {
  grid = document.getElementById("mod-grid");
  empty = document.getElementById("mod-empty");
  search = document.getElementById("mod-search") as HTMLInputElement | null;
  tabAll = document.getElementById("tab-all");
  tabModules = document.getElementById("tab-modules");
  tabIntegrations = document.getElementById("tab-integrations");
  tabInstalled = document.getElementById("tab-installed");
  tabAllCount = document.getElementById("tab-all-count");
  tabModulesCount = document.getElementById("tab-modules-count");
  tabIntegrationsCount = document.getElementById("tab-integrations-count");
  tabInstalledCount = document.getElementById("tab-installed-count");
  categoryFilterSelect = document.getElementById("category-filter-select") as HTMLSelectElement | null;
  statusFilterSelect = document.getElementById("status-filter-select") as HTMLSelectElement | null;
}
function setOptionCount(select: HTMLSelectElement | null, value: string, count: number) {
  const opt = select?.querySelector<HTMLOptionElement>(`option[value="${value}"]`);
  if (!opt) return;
  const base = opt.dataset.label ?? opt.textContent;
  // "All (N)" / "Visible (N)" / etc. — con espacio, igual al estilo previo.
  opt.textContent = `${base} (${count})`;
}
function normalizeText(value: unknown) {
  return String(value ?? "").toLowerCase().trim();
}
function isEnabled(module: ModuleInfo) {
  return Boolean(module.enabled ?? module.installed);
}
function setButtonState(buttons: Array<HTMLElement | null>, activeButton: HTMLElement | null) {
  buttons.forEach((btn) => {
    if (!btn) return;
    const active = btn === activeButton;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
    btn.parentElement?.setAttribute("role", "tablist");
    btn.classList.toggle("border-primary", active);
    btn.classList.toggle("bg-primary", active);
    btn.classList.toggle("text-primary-foreground", active);
    btn.classList.toggle("text-muted-foreground", !active);
    btn.classList.toggle("border-border", !active);
    btn.classList.toggle("bg-card", !active);
  });
}
function setTab(tab: TabKey) {
  const order: TabKey[] = ["all", "modules", "integrations", "installed"];
  const direction = tabDirection(order.indexOf(activeTab as TabKey), order.indexOf(tab));
  activeTab = tab;
  setButtonState([tabAll, tabModules, tabIntegrations, tabInstalled], { all: tabAll, modules: tabModules, integrations: tabIntegrations, installed: tabInstalled }[tab]);
  renderGrid();
  // El tab filtra la MISMA rejilla: entrada animada del contenido re-renderizado.
  animateViewEnter(grid, direction);
}
function setCategory(filterValue: string) {
  categoryFilter = filterValue;
  if (categoryFilterSelect && categoryFilterSelect.value !== filterValue) categoryFilterSelect.value = filterValue;
  renderGrid();
}
function setStatus(filterValue: string) {
  statusFilter = filterValue;
  if (statusFilterSelect && statusFilterSelect.value !== filterValue) statusFilterSelect.value = filterValue;
  renderGrid();
}
function updateCounts() {
  const total = allModules.length;
  const modules = allModules.filter((m) => (m.kind ?? "module") === "module").length;
  const integrations = total - modules;
  const enabled = allModules.filter((m) => isEnabled(m)).length;
  const disabled = total - enabled;
  const byCat = (cat: string) => allModules.filter((m) => m.category === cat).length;
  if (tabAllCount) tabAllCount.textContent = String(total);
  if (tabModulesCount) tabModulesCount.textContent = String(modules);
  if (tabIntegrationsCount) tabIntegrationsCount.textContent = String(integrations);
  if (tabInstalledCount) tabInstalledCount.textContent = String(enabled);
  // Conteo vivo en cada <option>: "Todas (13)", "Comunicación (2)", …
  setOptionCount(categoryFilterSelect, "all", total);
  setOptionCount(categoryFilterSelect, "communication", byCat("communication"));
  setOptionCount(categoryFilterSelect, "infrastructure", byCat("infrastructure"));
  setOptionCount(categoryFilterSelect, "security", byCat("security"));
  setOptionCount(categoryFilterSelect, "developer", byCat("developer"));
  setOptionCount(statusFilterSelect, "all", total);
  setOptionCount(statusFilterSelect, "installed", enabled);
  setOptionCount(statusFilterSelect, "not-installed", disabled);
}
let moduleFetchGeneration = 0;
async function fetchModules() {
  const epoch = ++moduleFetchGeneration, headers = scopeHeaders(), scope = JSON.stringify(headers);
  try {
    const lc = activeLocale();
    const res = await fetch(resolvePanelApiPath(`/api/admin/modules${lc ? `?lang=${encodeURIComponent(lc)}` : ""}`), { credentials: "include", headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (epoch !== moduleFetchGeneration || scope !== JSON.stringify(scopeHeaders())) return;
    allModules = Array.isArray(json.data)
      ? (json.data as ModuleInfo[])
          .map((mod) => {
            // Para módulos core el título/descripción salen del namespace i18n
            // (cambia al instante con el idioma); el resto cae al valor de la API
            // (módulos de comunidad ya localizados por LP).
            const tr = CATALOG_I18N[mod.id] ?? null;
            return {
              ...mod,
              name: (tr?.name && tr.name.trim()) ? tr.name : mod.name,
              description: (tr?.description && tr.description.trim()) ? tr.description : mod.description,
              enabled: Boolean(mod.enabled ?? mod.installed),
              installed: Boolean(mod.enabled ?? mod.installed),
              position: typeof mod.position === "number" ? mod.position : Number.MAX_SAFE_INTEGER,
            };
          })
          .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      : [];
    updateCounts();
    renderGrid();
  } catch {
    if (epoch !== moduleFetchGeneration || scope !== JSON.stringify(scopeHeaders())) return;
    if (grid) grid.innerHTML = `<div class="col-span-full flex flex-col items-center py-16 text-center">
      <i class="ti ti-alert-circle text-3xl text-destructive mb-3"></i>
      <p class="font-medium text-destructive">${t("errors.loadTitle", "Error al cargar los módulos")}</p>
      <p class="text-sm text-muted-foreground mt-1">${t("errors.loadSubtitle", "No se pudo obtener la lista de módulos")}</p>
    </div>`;
  }
}
function renderGrid() {
  if (!grid || !empty) return;
  const gridEl = grid;
  const emptyEl = empty;
  const q = normalizeText(search?.value);
  const visible = allModules.filter((m) => {
    const textMatch = !q || normalizeText(m.name).includes(q) || normalizeText(m.description).includes(q);
    const categoryMatch = categoryFilter === "all" || m.category === categoryFilter;
    const enabled = isEnabled(m);
    const statusMatch =
      statusFilter === "all"
        ? true
        : statusFilter === "installed"
          ? enabled
          : !enabled;
    const kind = m.kind ?? "module";
    const tabMatch =
      activeTab === "all"
        ? true
        : activeTab === "modules"
          ? kind === "module"
          : activeTab === "integrations"
            ? kind === "mcp_server"
            : enabled;
    return textMatch && categoryMatch && statusMatch && tabMatch;
  });
  if (!visible.length) {
    gridEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    emptyEl.classList.add("flex");
    return;
  }
  emptyEl.classList.add("hidden");
  emptyEl.classList.remove("flex");
  gridEl.innerHTML = visible.map(renderCard).join("");
  gridEl.querySelectorAll("[data-toggle-id]").forEach((el) => {
    el.addEventListener("change", async (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const id = input.dataset.toggleId;
      if (!id) return;
      await toggleModule(id, input.checked);
    });
  });
  gridEl.querySelectorAll("[data-toggle-fab-id]").forEach((el) => {
    el.addEventListener("change", async (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const id = input.dataset.toggleFabId;
      if (!id) return;
      await toggleFloatingButton(id, input.checked);
    });
  });
  attachDragAndDrop();
}
function renderCard(module: ModuleInfo) {
  // `id` es un string arbitrario del catálogo; los mapas son objetos const con
  // claves concretas, de ahí el cast a `keyof` (el `|| fallback` cubre el caso
  // de que el módulo no esté en el mapa).
  const icon = ICON_MAP[module.id as keyof typeof ICON_MAP] || "ti-puzzle";
  const color = COLOR_MAP[module.id as keyof typeof COLOR_MAP] || { bg: "bg-primary/10", text: "text-primary" };
  // Módulos que SON una marca (nginx/dns, cloudflare, obsidian) llevan su logo
  // simple-icons inline; el resto, su icono Tabler del ICON_MAP.
  const brandSvg = MODULE_ICON_SVGS[module.id];
  const iconHtml = brandSvg
    ? `<span class="text-2xl ${color.text} leading-none" aria-hidden="true">${brandSvg}</span>`
    : `<i class="ti ${icon} text-2xl ${color.text}"></i>`;
  const kind = module.kind ?? "module";
  const enabled = isEnabled(module);
  const features = (module.features ?? [])
    .map((feature) => `<li class="flex items-center gap-1.5 text-xs text-muted-foreground"><i class="ti ti-check text-emerald-500 text-xs shrink-0"></i>${escapeHtml(feature)}</li>`)
    .join("");
  const fmtDate = (v?: string | number) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(document.documentElement.lang || undefined);
  };
  const metaItems = [
    module.version ? `<span class="inline-flex items-center gap-1" title="${t("labels.metaVersion", "Versión")}"><i class="ti ti-tag text-xs"></i>v${escapeHtml(module.version)}</span>` : "",
    module.installs != null ? `<span class="inline-flex items-center gap-1" title="${t("labels.metaInstalls", "Instalaciones")}"><i class="ti ti-download text-xs"></i>${Number(module.installs).toLocaleString(document.documentElement.lang || undefined)}</span>` : "",
    module.rating != null ? `<span class="inline-flex items-center gap-1" title="${t("labels.metaRating", "Valoración")}"><i class="ti ti-star-filled text-xs text-amber-500"></i>${Number(module.rating).toFixed(1)}</span>` : "",
    module.author ? `<span class="inline-flex items-center gap-1" title="${t("labels.metaAuthor", "Autor")}"><i class="ti ti-user text-xs"></i>${escapeHtml(module.author)}</span>` : "",
    fmtDate(module.createdAt) ? `<span class="inline-flex items-center gap-1" title="${t("labels.metaCreatedAt", "Fecha de creación")}"><i class="ti ti-calendar-plus text-xs"></i>${fmtDate(module.createdAt)}</span>` : "",
    fmtDate(module.updatedAt) ? `<span class="inline-flex items-center gap-1" title="${t("labels.metaUpdatedAt", "Última actualización")}"><i class="ti ti-calendar-up text-xs"></i>${fmtDate(module.updatedAt)}</span>` : "",
  ].filter(Boolean).join("");
  const metaRow = metaItems
    ? `<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground border-t border-border/60 pt-3">${metaItems}</div>`
    : "";
  const typeBadge = `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${kind === "mcp_server" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}">${kind === "mcp_server" ? t("labels.kindIntegration", "INTEGRACIÓN") : t("labels.kindModule", "MÓDULO")}</span>`;
  const licenseBadge = module.tag === "free"
    ? `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>${t("labels.tagFree", "Gratis")}</span>`
    : `<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"><span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>${t("labels.tagLicense", "Licencia requerida")}</span>`;
  const statusBadge = enabled
    ? `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>${t("labels.statusVisible", "Visible en el menú")}</span>`
    : `<span class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"><span class="h-1.5 w-1.5 rounded-full bg-muted-foreground"></span>${t("labels.statusHidden", "Oculto")}</span>`;
  return `<div class="mod-card flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20" draggable="true" data-module-id="${escapeHtml(module.id)}">
    <div class="flex items-start gap-3">
      <button type="button" class="mod-drag-handle mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground cursor-grab active:cursor-grabbing" title="${t("labels.dragHandle", "Arrastrar para reordenar")}" aria-label="${t("labels.dragHandle", "Arrastrar para reordenar")}">
        <i class="ti ti-grip-vertical text-base"></i>
      </button>
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color.bg}">
        ${iconHtml}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-sm font-semibold">${escapeHtml(module.name)}</h3>
          ${typeBadge}
          ${licenseBadge}
          ${statusBadge}
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">${escapeHtml(getCategoryLabel(module.category))}</p>
      </div>
    </div>
    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">${escapeHtml(module.description)}</p>
    <ul class="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 flex-1">${features}</ul>
    ${metaRow}
    <div class="mt-5 flex flex-col gap-2 pt-4 border-t border-border">
      <label class="inline-flex items-center gap-2 text-sm text-muted-foreground select-none">
        <input type="checkbox" data-toggle-id="${escapeHtml(module.id)}" ${enabled ? "checked" : ""} class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20">
        <span>${t("labels.menuToggle", "Mostrar en el menú lateral")}</span>
      </label>
      ${module.supportsFloatingButton ? `<label class="inline-flex items-center gap-2 text-sm text-muted-foreground select-none">
        <input type="checkbox" data-toggle-fab-id="${escapeHtml(module.id)}" ${module.showFloatingButton ? "checked" : ""} class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20">
        <span>${t("labels.fabToggle", "Mostrar botón flotante")}</span>
      </label>` : ""}
    </div>
  </div>`;
}
async function toggleModule(id: string, enabled: boolean) {
  const csrf = getCsrfToken();
  const mod = allModules.find((item) => item.id === id);
  if (!mod) return;
  try {
    const res = await fetch(resolvePanelApiPath(`/api/admin/modules/${encodeURIComponent(id)}`), {
      method: "PATCH",
      credentials: "include",
      headers: {
        ...scopeHeaders(true),
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: csrf,
      },
      body: JSON.stringify({ enabled }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
    // Apply state for the toggled module and any dependencies that were
    // co-enabled (backend returns affected:[{id,enabled}]).
    const affected: Array<{ id: string; enabled: boolean }> = Array.isArray(json.data?.affected)
      ? json.data.affected
      : [{ id, enabled: Boolean(json.data?.enabled) }];
    for (const { id: aid, enabled: aEnabled } of affected) {
      const m = allModules.find((item) => item.id === aid);
      if (m) { m.enabled = aEnabled; m.installed = aEnabled; }
    }
    updateCounts();
    renderGrid();
    notifyModulesChanged();
    const deps = affected.filter((a) => a.id !== id && a.enabled);
    const depNames = deps.map((a) => allModules.find((m) => m.id === a.id)?.name ?? a.id).join(", ");
    if (depNames) {
      const tplKey = mod.enabled ? "toasts.moduleVisibleWithDeps" : "toasts.moduleHiddenWithDeps";
      const tplFallback = mod.enabled ? "{name} visible (también activado: {deps})" : "{name} oculto (también activado: {deps})";
      showToast(fmt(t(tplKey, tplFallback), { name: mod.name, deps: depNames }), "success");
    } else {
      const tplKey = mod.enabled ? "toasts.moduleVisible" : "toasts.moduleHidden";
      const tplFallback = mod.enabled ? "{name} visible" : "{name} oculto";
      showToast(fmt(t(tplKey, tplFallback), { name: mod.name }), "success");
    }
  } catch {
    showToast(fmt(t("toasts.moduleUpdateError", "No se pudo actualizar {name}"), { name: mod.name }), "error");
    await fetchModules();
  }
}
// Toggle del FAB flotante (assistant / terminal). Es independiente del master
// `enabled`: sólo persiste `showFloatingButton` y no toca el estado del módulo.
async function toggleFloatingButton(id: string, checked: boolean) {
  const csrf = getCsrfToken();
  const mod = allModules.find((item) => item.id === id);
  if (!mod) return;
  try {
    const res = await fetch(resolvePanelApiPath(`/api/admin/modules/${encodeURIComponent(id)}`), {
      method: "PATCH",
      credentials: "include",
      headers: { ...scopeHeaders(true), "Content-Type": "application/json", [CSRF_HEADER_NAME]: csrf },
      body: JSON.stringify({ showFloatingButton: checked }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
    mod.showFloatingButton = Boolean(json.data?.showFloatingButton ?? checked);
    notifyModulesChanged();
    const key = checked ? "toasts.fabShown" : "toasts.fabHidden";
    const fallback = checked ? "{name}: botón flotante activado" : "{name}: botón flotante desactivado";
    showToast(fmt(t(key, fallback), { name: mod.name }), "success");
  } catch {
    showToast(fmt(t("toasts.moduleUpdateError", "No se pudo actualizar {name}"), { name: mod.name }), "error");
    await fetchModules();
  }
}

// ── Drag & drop reordering ──────────────────────────────────────────
function attachDragAndDrop() {
  if (!grid) return;
  bindShredderOrder(grid, (sourceId, targetId) => {
    reorderLocal(sourceId, targetId);
    void persistOrder();
  });
  grid.querySelectorAll<HTMLElement>(".mod-card").forEach((card) => {
    card.draggable = false;
  });
}
function reorderLocal(srcId: string, targetId: string) {
  const srcIdx = allModules.findIndex((m) => m.id === srcId);
  const targetIdx = allModules.findIndex((m) => m.id === targetId);
  if (srcIdx < 0 || targetIdx < 0) return;
  const [moved] = allModules.splice(srcIdx, 1);
  allModules.splice(targetIdx, 0, moved);
  allModules.forEach((m, idx) => { m.position = idx; });
  renderGrid();
}
async function persistOrder() {
  const csrf = getCsrfToken();
  const order = allModules.map((m) => m.id);
  try {
    const res = await fetch(resolvePanelApiPath("/api/admin/modules/order"), {
      method: "PUT",
      credentials: "include",
      headers: {
        ...scopeHeaders(true),
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: csrf,
      },
      body: JSON.stringify({ order }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      showToast(json.error ?? fmt(t("toasts.orderHttpError", "No se pudo guardar el orden ({status})"), { status: res.status }), "error");
      await fetchModules();
      return;
    }
    showToast(t("toasts.orderSaved", "Orden actualizado"), "success");
    notifyModulesChanged();
  } catch (err) {
    showToast(t("toasts.orderError", "No se pudo guardar el orden"), "error");
    await fetchModules();
  }
}
function notifyModulesChanged() {
  // Tell the sidebar (PanelLayout) to refresh its module group order.
  // MUST match lib/use-module-gate.ts MODULES_CHANGED_EVENT (bundle:false module).
  window.dispatchEvent(new CustomEvent("luxipanel:modules-changed"));
}

function showToast(message: string, type: "success" | "error") {
  const toast = document.createElement("div");
  toast.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl transition-all duration-300 translate-y-4 opacity-0 ${type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-destructive/20 bg-destructive/10 text-destructive"}`;
  toast.innerHTML = `<i class="ti ${type === "success" ? "ti-circle-check" : "ti-circle-x"} text-base shrink-0"></i>${message}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove("translate-y-4", "opacity-0"));
  setTimeout(() => {
    toast.classList.add("translate-y-4", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
// Cooldown + emptiness check: dedupea module-eval + after-swap + page-load
// (3 fires/entrada) PERO si el grid está vacío (SPA-nav volvió a una
// página fresca con skeleton) forzamos refetch aunque el cooldown esté
// activo — sin esto el skeleton quedaba pegado al re-entrar rápido.
let lastFetchAt = 0;
const FETCH_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
let listenersController: AbortController | null = null;

function init() {
  if (!document.getElementById("mod-grid")) return;
  loadI18n();
  loadCatalogI18n();
  acquireDomRefs();

  // Re-atar listeners en cada init (DOM nuevo tras swap). AbortController
  // descarta los del init previo para no acumular handlers duplicados.
  listenersController?.abort();
  listenersController = new AbortController();
  const { signal } = listenersController;

  tabAll?.addEventListener("click", () => setTab("all"), { signal });
  tabModules?.addEventListener("click", () => setTab("modules"), { signal });
  for (const event of ["luxipanel:modules-changed", "luxipanel:target-changed", "luxipanel:permissions-changed"]) window.addEventListener(event, () => { void fetchModules(); }, { signal });
  tabIntegrations?.addEventListener("click", () => setTab("integrations"), { signal });
  tabInstalled?.addEventListener("click", () => setTab("installed"), { signal });
  categoryFilterSelect?.addEventListener("change", (e) => setCategory((e.currentTarget as HTMLSelectElement).value), { signal });
  statusFilterSelect?.addEventListener("change", (e) => setStatus((e.currentTarget as HTMLSelectElement).value), { signal });
  search?.addEventListener("input", renderGrid, { signal });

  const isGridEmpty = !grid || grid.children.length === 0
    || (grid.children.length === 1 && grid.firstElementChild?.classList?.contains("animate-pulse"));
  const cooldownActive = Date.now() - lastFetchAt < FETCH_COOLDOWN_MS;
  if (cooldownActive && !isGridEmpty) {
    // Datos vivos del visit anterior siguen renderizados → re-pintar
    // sobre el DOM nuevo desde memoria sin volver a fetchear.
    renderGrid();
    updateCounts();
    return;
  }
  lastFetchAt = Date.now();
  fetchModules();
}

init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
