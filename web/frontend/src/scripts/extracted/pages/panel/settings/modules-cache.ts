/**
 * modules-cache.ts — drives the Ajustes → Módulos tab.
 *
 * Fetches the per-target cache-engine schedule + cost panel from
 * /api/admin/cache-modules and lets the operator toggle entries on/off and
 * adjust their interval. Persisting goes through PUT
 * /api/admin/cache-modules/:module/:collection; the dispatcher on the
 * customer server reads the updated schedule.json on its next 60s tick.
 */

import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";

// ── i18n ────────────────────────────────────────────────────────────────────
const { loadI18n, t } = createPageI18n("settings-i18n");
// NOTE: this page keeps its own `fmt` (missing key → "" instead of the shared
// helper's "keep {key}") — every call site here supplies all keys, so output is
// unchanged, but the semantics differ from the shared trio's `fmt`.
function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

interface RowDTO {
  module: string;
  collection: string;
  source: "sidecar-mirror" | "system-collector";
  collector?: string;
  defaultIntervalSeconds: number;
  enabled: boolean;
  intervalSeconds: number;
  lastCollectedAt: number | null;
  engineStat: {
    bytes?: number;
    durationMs?: number;
    wallMs?: number;
    count?: number;
    version?: string;
  } | null;
  panelMetrics: {
    hitRatio: number;
    avgDurationMs: number;
    counts: Record<string, number>;
    lastOutcome: string | null;
    observed: number;
  };
}

const MIN_S = 30;
const MAX_S = 86_400;
const ENDPOINT = "/api/admin/cache-modules";

function $<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function fmtAgo(unixSec: number | null): string {
  if (!unixSec) return "—";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSec));
  if (diff < 60) return fmt(t("modulesCache.agoSeconds", "hace {n}s"), { n: diff });
  if (diff < 3600) return fmt(t("modulesCache.agoMinutes", "hace {n}m"), { n: Math.floor(diff / 60) });
  if (diff < 86400) return fmt(t("modulesCache.agoHours", "hace {n}h"), { n: Math.floor(diff / 3600) });
  return fmt(t("modulesCache.agoDays", "hace {n}d"), { n: Math.floor(diff / 86400) });
}

function fmtBytes(n: number | undefined): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function fmtHitRatio(ratio: number, observed: number): string {
  if (observed <= 0) return "—";
  return `${(ratio * 100).toFixed(0)}%`;
}

// ── Agrupación por módulo con collapse ──────────────────────────────────────
// Las colecciones se agrupan bajo una fila-cabecera por módulo (chevron +
// resumen). El set de módulos expandidos persiste por pestaña.
const EXPANDED_KEY = "lxp-cache-modules-expanded";

function loadExpandedGroups(): Set<string> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(EXPANDED_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

const expandedGroups = loadExpandedGroups();

function persistExpandedGroups() {
  try {
    sessionStorage.setItem(EXPANDED_KEY, JSON.stringify([...expandedGroups]));
  } catch {
    /* sessionStorage no disponible — el estado vive solo en memoria */
  }
}

function toggleGroup(module: string, header: HTMLTableRowElement) {
  const wasOpen = expandedGroups.has(module);
  if (wasOpen) expandedGroups.delete(module);
  else expandedGroups.add(module);
  persistExpandedGroups();
  const chevron = header.querySelector(".cache-group-chevron");
  if (chevron) {
    chevron.className = `ti ti-chevron-${wasOpen ? "right" : "down"} cache-group-chevron text-xs text-muted-foreground`;
  }
  document
    .querySelectorAll<HTMLTableRowElement>(`#cache-modules-rows tr[data-group-member="${module}"]`)
    .forEach((row) => row.classList.toggle("hidden", wasOpen));
}

function makeGroupRow(module: string, rows: RowDTO[]): HTMLTableRowElement {
  const open = expandedGroups.has(module);
  const active = rows.filter((r) => r.enabled).length;
  const bytes = rows.reduce((acc, r) => acc + (r.engineStat?.bytes ?? 0), 0);

  const tr = document.createElement("tr");
  tr.className = "cache-group-row cursor-pointer select-none border-b border-border/40 bg-muted/30 hover:bg-muted/50";
  tr.dataset.group = module;

  const td = document.createElement("td");
  td.colSpan = SKELETON_CELLS;
  td.className = "py-2 pr-3";
  td.innerHTML = `<div class="flex items-center gap-2">
    <i class="ti ti-chevron-${open ? "down" : "right"} cache-group-chevron text-xs text-muted-foreground"></i>
    <span class="text-xs font-semibold capitalize">${module}</span>
    <span class="text-[10px] text-muted-foreground">${rows.length} ${rows.length === 1 ? t("modulesCache.collectionSingular", "colección") : t("modulesCache.collectionPlural", "colecciones")} · ${active} ${active === 1 ? t("modulesCache.activeSingular", "activa") : t("modulesCache.activePlural", "activas")}${bytes > 0 ? ` · ${fmtBytes(bytes)}` : ""}</span>
  </div>`;
  tr.appendChild(td);
  tr.addEventListener("click", () => toggleGroup(module, tr));
  return tr;
}

function makeRow(row: RowDTO): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = "border-b border-border/40 last:border-0";
  tr.dataset.module = row.module;
  tr.dataset.collection = row.collection;
  // Miembro de su grupo: nace oculto si el módulo está colapsado (también
  // cubre el replaceWith() tras guardar una fila).
  tr.dataset.groupMember = row.module;
  if (!expandedGroups.has(row.module)) tr.classList.add("hidden");

  const cellLabel = document.createElement("td");
  cellLabel.className = "py-2.5 pr-3";
  cellLabel.innerHTML = `<div class="font-medium">${row.module}/${row.collection}</div>
    <div class="text-[10px] text-muted-foreground">default ${row.defaultIntervalSeconds}s</div>`;
  tr.appendChild(cellLabel);

  const cellSource = document.createElement("td");
  cellSource.className = "py-2.5 pr-3";
  if (row.source === "system-collector") {
    cellSource.innerHTML = `<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
      <i class="ti ti-cpu text-[10px]"></i>${row.collector ?? "collector"}</span>`;
  } else {
    cellSource.innerHTML = `<span class="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-600">
      <i class="ti ti-copy text-[10px]"></i>sidecar</span>`;
  }
  tr.appendChild(cellSource);

  // Badge informativo. El estado enabled deriva del módulo padre
  // (/api/admin/modules → toggle en /panel/modules) y NO es editable
  // desde aquí. Si se desactiva el módulo en el catálogo, la recolección
  // se apaga automáticamente; al reactivarlo, se vuelve a programar.
  const cellEnabled = document.createElement("td");
  cellEnabled.className = "py-2.5 pr-3";
  cellEnabled.innerHTML = row.enabled
    ? `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400" title="${t("modulesCache.enabledTitle", "Recolección programada vía dispatcher del servidor cliente")}"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>${t("modulesCache.badgeEnabled", "Activa")}</span>`
    : `<span class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" title="${t("modulesCache.disabledTitle", "Módulo padre desactivado en /panel/modules — la recolección queda pausada")}"><span class="h-1.5 w-1.5 rounded-full bg-muted-foreground"></span>${t("modulesCache.badgeDisabled", "Inactiva")}</span>`;
  tr.appendChild(cellEnabled);

  const cellInterval = document.createElement("td");
  cellInterval.className = "py-2.5 pr-3";
  cellInterval.innerHTML = `<input type="number" class="interval-input h-7 w-24 rounded-md border border-input bg-background px-2 text-xs text-right"
    min="${MIN_S}" max="${MAX_S}" step="30" value="${row.intervalSeconds}">`;
  tr.appendChild(cellInterval);

  const cellLast = document.createElement("td");
  cellLast.className = "py-2.5 pr-3 text-muted-foreground";
  cellLast.textContent = fmtAgo(row.lastCollectedAt);
  tr.appendChild(cellLast);

  const cellDuration = document.createElement("td");
  cellDuration.className = "py-2.5 pr-3 text-muted-foreground";
  cellDuration.textContent = fmtDuration(row.engineStat?.wallMs ?? row.engineStat?.durationMs);
  tr.appendChild(cellDuration);

  const cellBytes = document.createElement("td");
  cellBytes.className = "py-2.5 pr-3 text-muted-foreground";
  cellBytes.textContent = fmtBytes(row.engineStat?.bytes);
  tr.appendChild(cellBytes);

  const cellHit = document.createElement("td");
  cellHit.className = "py-2.5 pr-3 text-muted-foreground";
  cellHit.textContent = fmtHitRatio(row.panelMetrics.hitRatio, row.panelMetrics.observed);
  tr.appendChild(cellHit);

  const cellActions = document.createElement("td");
  cellActions.className = "py-2.5 text-right";
  cellActions.innerHTML = `<button type="button" class="save-row inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
    <i class="ti ti-device-floppy text-[11px]"></i>${t("modulesCache.buttonSave", "Guardar")}</button>`;
  tr.appendChild(cellActions);
  return tr;
}

function setStatus(message: string, kind: "info" | "error" | "ok" = "info") {
  const el = $<HTMLDivElement>("cache-modules-status");
  if (!el) return;
  el.textContent = message;
  el.className = `text-xs mb-3 ${
    kind === "error" ? "text-red-500" :
    kind === "ok"    ? "text-emerald-500" :
                        "text-muted-foreground"
  }`;
}

function wireRowEvents(tr: HTMLTableRowElement, row: RowDTO) {
  // El toggle de enabled ya no existe — solo intervalSeconds es editable.
  const intervalEl = tr.querySelector<HTMLInputElement>(".interval-input");
  const save = tr.querySelector<HTMLButtonElement>(".save-row");
  if (!intervalEl || !save) return;

  const markDirty = () => { save.disabled = false; };
  intervalEl.addEventListener("input", markDirty);

  save.addEventListener("click", async () => {
    const interval = Math.max(MIN_S, Math.min(MAX_S, Math.round(Number(intervalEl.value) || 0)));
    intervalEl.value = String(interval);
    save.disabled = true;
    save.innerHTML = `<i class="ti ti-loader-2 animate-spin text-[11px]"></i>${t("modulesCache.saving", "Guardando…")}`;
    try {
      const res = await api.put<RowDTO>(
        `${ENDPOINT}/${encodeURIComponent(row.module)}/${encodeURIComponent(row.collection)}`,
        { intervalSeconds: interval },
      );
      if (!res || !res.ok || !res.data) throw new Error(res?.error || "save failed");
      const fresh = makeRow(res.data);
      wireRowEvents(fresh, res.data);
      tr.replaceWith(fresh);
      setStatus(fmt(t("modulesCache.savedStatus", "{module}/{collection} actualizado"), { module: row.module, collection: row.collection }), "ok");
    } catch (err) {
      save.disabled = false;
      save.innerHTML = `<i class="ti ti-device-floppy text-[11px]"></i>${t("modulesCache.buttonSave", "Guardar")}`;
      const message = err instanceof Error ? err.message : String(err);
      setStatus(fmt(t("modulesCache.saveError", "Error guardando {module}/{collection}: {message}"), { module: row.module, collection: row.collection, message }), "error");
    }
  });
}

const SKELETON_ROWS = 8;
const SKELETON_CELLS = 9; // # de columnas reales en la tabla

function showSkeletonRows() {
  const tbody = $<HTMLTableSectionElement>("cache-modules-rows");
  if (!tbody) return;
  let html = "";
  for (let i = 0; i < SKELETON_ROWS; i++) {
    html += '<tr class="border-b border-border/40 last:border-0">';
    for (let c = 0; c < SKELETON_CELLS; c++) {
      const w = c === 0 ? "w-40" : c === 1 ? "w-20" : c === 8 ? "w-16" : "w-14";
      html += `<td class="py-3 pr-3"><div class="h-3.5 ${w} rounded bg-muted animate-pulse"></div></td>`;
    }
    html += "</tr>";
  }
  tbody.innerHTML = html;
}

let loadInFlight: Promise<void> | null = null;

async function loadModules() {
  // Coalesce concurrent calls — if a fetch is already in flight, return
  // the same promise instead of starting another. Esto blinda contra
  // múltiples triggers (page-load + custom event + click) que dispararon
  // 2 GET al mismo endpoint en SPA-nav.
  if (loadInFlight) return loadInFlight;
  loadInFlight = (async () => {
    loadI18n();
    const tbody = $<HTMLTableSectionElement>("cache-modules-rows");
    if (!tbody) return;
    // Skeleton visual en vez de texto "Cargando…".
    showSkeletonRows();
    setStatus("");
    try {
      const res = await api.get<RowDTO[]>(ENDPOINT);
      if (!res || !res.ok || !Array.isArray(res.data)) throw new Error(res?.error || "no data");
      const sorted = [...res.data].sort((a, b) => {
        if (a.module === b.module) return a.collection.localeCompare(b.collection);
        return a.module.localeCompare(b.module);
      });
      tbody.innerHTML = "";
      const byModule = new Map<string, RowDTO[]>();
      for (const row of sorted) {
        const list = byModule.get(row.module) ?? [];
        list.push(row);
        byModule.set(row.module, list);
      }
      for (const [module, rows] of byModule) {
        tbody.appendChild(makeGroupRow(module, rows));
        for (const row of rows) {
          const tr = makeRow(row);
          tbody.appendChild(tr);
          wireRowEvents(tr, row);
        }
      }
      setStatus(
        fmt(t("modulesCache.loadedSummary", "{count} colecciones cacheables en {modules} módulos. Los cambios se aplican en la siguiente vuelta del recolector (≤60s)."), { count: sorted.length, modules: byModule.size }),
      );
    } catch (err) {
      tbody.innerHTML = "";
      const message = err instanceof Error ? err.message : String(err);
      setStatus(fmt(t("modulesCache.loadError", "Error: {message}"), { message }), "error");
    } finally {
      loadInFlight = null;
    }
  })();
  return loadInFlight;
}

// Cooldown evita refetch en clicks rápidos sobre el mismo tab. El
// emptiness-check del tbody asegura que un DOM fresco post-swap SPA
// (sin filas reales — el skeleton no cuenta como dato) sí se refetcha.
// `loadInFlight` blinda contra múltiples triggers concurrentes (antes
// había 2 GET / entrada: uno de `lxp:settings-tab:activated` con
// force=true + otro de astro:page-load encontrando el grid vacío).
let lastLoadedAt = 0;

function isModulesTabVisible(): boolean {
  const panel = $<HTMLDivElement>("panel-modules");
  return !!panel && !panel.classList.contains("hidden");
}

function hasRealData(): boolean {
  const tbody = $<HTMLTableSectionElement>("cache-modules-rows");
  if (!tbody || tbody.children.length === 0) return false;
  // Skeleton rows tienen `.animate-pulse` adentro → no cuentan como data.
  return !tbody.querySelector(".animate-pulse");
}

function maybeLoad(): void {
  if (!isModulesTabVisible()) return;
  if (loadInFlight) return; // ya está corriendo
  const hasData = hasRealData();
  if (hasData && Date.now() - lastLoadedAt < SCRIPT_INIT_COOLDOWN_MS) return;
  lastLoadedAt = Date.now();
  void loadModules();
}

// Tab activation (event delegation a document — sobrevive al swap SPA).
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const btn = target?.closest<HTMLButtonElement>('.tab-btn[data-tab="modules"]');
  if (btn) setTimeout(maybeLoad, 0);
});

// Custom event de settings/index-script1.ts cuando activateTab() corre
// (incluye restauración de tab desde sessionStorage en F5/SPA-nav).
// MUST match settings/tabs.ts SETTINGS_TAB_EVENT (este entry es bundle:false y
// no puede importar el símbolo sibling; mantener el literal en lockstep).
window.addEventListener("lxp:settings-tab:activated", (event: Event) => {
  const ce = event as CustomEvent<{ tabId: string }>;
  if (ce.detail?.tabId === "modules") setTimeout(maybeLoad, 0);
});

// Auto-load al entrar a /panel/settings si el tab "modules" ya está activo
// (p.ej. restaurado desde sessionStorage). astro:page-load/after-swap
// disparan en cada entrada SPA + F5; el cooldown + inFlight + emptiness
// check garantizan exactamente 1 fetch por entrada.
document.addEventListener("astro:page-load", maybeLoad);
document.addEventListener("astro:after-swap", maybeLoad);
if (window.location.hash === "#modules") setTimeout(maybeLoad, 200);
maybeLoad();
