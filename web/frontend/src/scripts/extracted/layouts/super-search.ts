// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * super-search.ts — Super buscador inteligente del navbar (drawer derecho).
 *
 * Sustituye a la antigua "command palette" (que solo filtraba módulos por
 * label). Ahora:
 *  - Catálogo SSOT (`lib/search-catalog.ts`): vistas, subpáginas, tabs,
 *    secciones de drawers y acciones de TODO el panel, con sinónimos ES/EN.
 *  - Ranking local en lenguaje natural: normaliza (sin acentos), tokeniza,
 *    detecta el verbo de intención (crear/editar/configurar/ver/eliminar),
 *    puntúa por palabra exacta / prefijo / subcadena / fuzzy y agrupa por módulo
 *    mostrando la ruta "Módulo › Tab".
 *  - Fallback IA (`POST /api/search/intent`, fail-open): solo cuando el ranking
 *    local es débil o ambiguo; el resultado se marca "Sugerido por IA".
 *  - Ejecución del destino: navega y, tras cargar la página, clica el tab /
 *    botón, despacha el evento o ejecuta la acción. La intención pendiente viaja
 *    en `sessionStorage["lxp:search-intent"]` y la consume este mismo script
 *    (corre en todas las páginas) en `astro:page-load`.
 *  - "Recientes" en localStorage (últimos 8 ids), atajo ⌘K / Ctrl+K.
 *
 * Standalone respecto al script del layout: solo depende de las libs runtime
 * (`/scripts/extracted/lib/*`). Los módulos de comunidad instalados sin entrada
 * en el catálogo llegan por `window.__lxp_cmd_items` (lo rellena
 * PanelLayout-define-vars-script1.ts) y se muestran como vistas.
 */
import { getClientMessages } from "/scripts/extracted/lib/i18n-client.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { openDialog, closeDialog } from "/scripts/extracted/lib/dom.js";
import { resolvePanelApiPath, getCsrfToken, CSRF_HEADER_NAME } from "/scripts/extracted/lib/api-client.js";
import { SEARCH_CATALOG, findSearchEntry } from "/scripts/extracted/lib/search-catalog.js?v=20260928promptcreate";
import { buildTargetUrl, isSafeNotificationTarget, normalizePath } from "/scripts/extracted/lib/search-target.js";
import type { SearchEntry, SearchIntent, SearchTarget, SearchKind } from "@/lib/search-catalog";

type SearchConfig = {
  locale: string;
  sidebarPermissions: string[];
  isAdminUser: boolean;
  canAccessSettings: boolean;
  canAccessUsers: boolean;
};

type CmdItem = { icon: string; label: string; sub: string; href?: string; action?: () => void };

type I18n = {
  // `superSearch` puede faltar en un JSON de i18n cacheado de un build anterior → todo opcional.
  nav: Record<string, string>;
  superSearch?: {
    placeholder: string;
    triggerLabel: string;
    recent: string;
    suggestions: string;
    aiSuggested: string;
    noResults: string;
    hint: string;
    kinds?: Partial<Record<SearchKind, string>>;
    groups?: { actions: string; views: string };
  };
  searchEntries?: Record<string, string>;
  actions: { navigate: string; open: string; close: string };
};

type Result = { entry: SearchEntry; score: number; ai?: boolean; recent?: boolean; group?: string; snippet?: string };
type AssistantConversationSearchResult = {
  id: string;
  title: string;
  provider?: string;
  agentId?: string | null;
  preview?: string;
  searchMatch?: { snippet: string };
};

type PendingIntent = { id: string; target: SearchTarget; ts: number; path: string };

const INTENT_KEY = "lxp:search-intent";
const RECENT_KEY = "lxp:super-search:recent";
const RECENT_MAX = 8;
const MAX_RESULTS = 40;
const AI_DEBOUNCE_MS = 350;
const AI_MIN_QUERY = 4;
const WEAK_SCORE = 9;

/* ─────────────────────────── Normalización ─────────────────────────── */

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s./-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "quiero", "quisiera", "necesito", "deseo", "puedo", "como", "donde", "de", "del", "la", "el", "los", "las", "un", "una",
  "unos", "unas", "a", "al", "en", "que", "para", "por", "con", "y", "o", "u", "e", "mi", "mis", "me", "se", "lo",
  "le", "ir", "ve", "vamos", "llevame", "llevar", "abrir", "abre", "ver", "mostrar", "muestra", "ensename", "pagina",
  "vista", "seccion", "panel", "the", "to", "i", "want", "need", "my", "me", "go", "open", "show", "page", "view",
  "section", "a", "an", "of", "in", "on", "for", "please", "por favor", "and", "or", "into", "at", "where", "how",
]);

const INTENT_VERBS: Record<SearchIntent, string[]> = {
  create: ["crear", "crea", "nuevo", "nueva", "nuevos", "nuevas", "anadir", "anade", "agregar", "agrega", "alta", "registrar", "registra", "add", "create", "new", "make", "hacer", "generar", "genera"],
  edit: ["editar", "edita", "modificar", "modifica", "gestionar", "gestiona", "administrar", "administra", "cambiar", "cambia", "actualizar", "actualiza", "edit", "manage", "change", "update", "modify", "renombrar", "rename"],
  configure: ["configurar", "configura", "configuracion", "ajustar", "ajusta", "ajustes", "settings", "config", "configure", "setup", "preferencias", "opciones", "activar", "activa", "desactivar", "desactiva", "habilitar", "enable", "disable", "bloquear", "bloquea", "block", "ban", "banear", "permitir", "permite", "allow"],
  view: ["ver", "listar", "lista", "consultar", "consulta", "revisar", "revisa", "monitorear", "view", "list", "see", "check", "estado", "status"],
  delete: ["eliminar", "elimina", "borrar", "borra", "quitar", "quita", "delete", "remove", "purgar", "purge", "limpiar", "clean"],
};

function detectIntents(tokens: string[]): Set<SearchIntent> {
  const found = new Set<SearchIntent>();
  for (const t of tokens) {
    for (const [intent, verbs] of Object.entries(INTENT_VERBS) as [SearchIntent, string[]][]) {
      if (verbs.includes(t)) found.add(intent);
    }
  }
  return found;
}

function tokenize(q: string): { tokens: string[]; intents: Set<SearchIntent> } {
  const all = normalize(q).split(" ").filter(Boolean);
  const intents = detectIntents(all);
  const verbSet = new Set(Object.values(INTENT_VERBS).flat());
  let tokens = all.filter((t) => !STOPWORDS.has(t) && !verbSet.has(t));
  // If the query was ONLY verbs/stopwords ("configurar"), keep the verbs as
  // tokens so "ajustes"/"settings" entries still match by keyword.
  if (tokens.length === 0) tokens = all.filter((t) => !STOPWORDS.has(t));
  return { tokens, intents };
}

/* ───────────────────────────── Fuzzy ───────────────────────────── */

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrams(a);
  const bb = new Map<string, number>();
  for (const g of bigrams(b)) bb.set(g, (bb.get(g) ?? 0) + 1);
  let hits = 0;
  for (const g of ba) {
    const n = bb.get(g) ?? 0;
    if (n > 0) { hits += 1; bb.set(g, n - 1); }
  }
  return (2 * hits) / (ba.length + (b.length - 1));
}

function levenshtein1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Score of ONE query token against ONE field (a normalized string). */
function tokenFieldScore(token: string, field: string): number {
  if (!field) return 0;
  const words = field.split(" ");
  let best = 0;
  for (const w of words) {
    if (w === token) return 10;
    if (w.startsWith(token)) best = Math.max(best, token.length >= 3 ? 7 : 4);
    else if (token.length >= 4 && w.includes(token)) best = Math.max(best, 5);
    else if (token.length >= 5 && w.length >= 5 && levenshtein1(token, w)) best = Math.max(best, 4);
    else if (token.length >= 5 && w.length >= 5 && dice(token, w) >= 0.7) best = Math.max(best, 3);
  }
  // Multi-word phrase containment ("cuenta de correo" inside a keyword).
  if (best < 5 && token.length >= 4 && field.includes(token)) best = Math.max(best, 5);
  return best;
}

/* ─────────────────────────── Catálogo runtime ─────────────────────────── */

type Indexed = {
  entry: SearchEntry;
  label: string; // localized label (display)
  labelN: string; // normalized
  labelEnN: string;
  keywordsN: string[];
  pathN: string; // normalized parent label
  parentLabel: string; // display
};

let CONFIG: SearchConfig = { locale: "es", sidebarPermissions: [], isAdminUser: false, canAccessSettings: false, canAccessUsers: false };
let I18N: I18n | null = null;
let INDEX: Indexed[] = [];
let INDEX_LOCALE = "";

function readConfig(): SearchConfig {
  try {
    const el = document.getElementById("super-search-config");
    if (el?.textContent) {
      const parsed = JSON.parse(el.textContent) as Partial<SearchConfig>;
      CONFIG = {
        locale: String(parsed.locale ?? "es"),
        sidebarPermissions: Array.isArray(parsed.sidebarPermissions) ? parsed.sidebarPermissions.map(String) : [],
        isAdminUser: Boolean(parsed.isAdminUser),
        canAccessSettings: Boolean(parsed.canAccessSettings),
        canAccessUsers: Boolean(parsed.canAccessUsers),
      };
    }
  } catch { /* keep previous */ }
  return CONFIG;
}

function canSee(entry: SearchEntry): boolean {
  const perm = entry.permission ?? entry.module;
  if (perm === "*") return true;
  if (CONFIG.isAdminUser || CONFIG.sidebarPermissions.includes("*")) return true;
  if (perm === "settings") return CONFIG.canAccessSettings;
  if (perm === "users") return CONFIG.canAccessUsers;
  if (perm === "layout") return true;
  return CONFIG.sidebarPermissions.includes(perm);
}

function localized(text: Record<string, string | undefined>, locale: string): string {
  return text[locale] ?? text["en"] ?? Object.values(text).find(Boolean) ?? "";
}

function entryLabel(e: SearchEntry): string {
  if (e.navKey && I18N?.nav?.[e.navKey]) return I18N.nav[e.navKey]!;
  if (I18N?.searchEntries?.[e.id]) return I18N.searchEntries[e.id]!;
  return localized(e.label, CONFIG.locale);
}

/** Module views live in the sidebar only when the module is installed/enabled
 *  (`/api/modules/installed`, mirrored into `window.__lxp_cmd_items` by the
 *  layout script). Hide catalog entries of modules that are NOT installed so the
 *  search never sends the user to a "Page not found" (e.g. NGINX disabled). The
 *  filter only applies once the installed list is known (≥1 module href). */
function moduleInstalled(entry: SearchEntry): boolean {
  if (!entry.navKey && entry.kind === "view") return true;
  const dyn = (window as unknown as { __lxp_cmd_items?: CmdItem[] }).__lxp_cmd_items ?? [];
  const installedHrefs = new Set(dyn.map((i) => i.href).filter((h): h is string => Boolean(h)));
  const moduleHrefs = [...installedHrefs].filter((h) => h.startsWith("/panel/"));
  if (moduleHrefs.length === 0) return true; // not loaded yet → don't hide anything
  const view = SEARCH_CATALOG.find((e) => e.kind === "view" && e.module === entry.module && e.navKey);
  if (!view?.target.href) return true; // tools / layout / preferences: always
  if (view.permission === "*" || view.module === "assistant") return true;
  // Tools (modules/settings/preferences/chat) use bare hrefs in cmd items.
  const href = view.target.href;
  const bare = href === "/panel" ? "/" : href.replace(/^\/panel/, "");
  return installedHrefs.has(href) || installedHrefs.has(bare);
}

function buildIndex(): void {
  const byId = new Map<string, SearchEntry>();
  for (const e of SEARCH_CATALOG) byId.set(e.id, e);
  INDEX = [];
  for (const entry of SEARCH_CATALOG) {
    if (!canSee(entry)) continue;
    if (!moduleInstalled(entry)) continue;
    const parent = entry.parent ? byId.get(entry.parent) : undefined;
    const label = entryLabel(entry);
    const parentLabel = parent ? entryLabel(parent) : "";
    INDEX.push({
      entry,
      label,
      labelN: normalize(label),
      labelEnN: normalize(entry.label.en),
      keywordsN: entry.keywords.map(normalize).concat(entry.label.es ? [normalize(entry.label.es)] : []),
      pathN: normalize(parentLabel),
      parentLabel,
    });
  }
  // Community / dynamically installed modules that have no catalog entry:
  // surface them as plain views (label from the sidebar loader).
  const dyn = (window as unknown as { __lxp_cmd_items?: CmdItem[] }).__lxp_cmd_items ?? [];
  const known = new Set(SEARCH_CATALOG.map((e) => e.target.href).filter(Boolean));
  for (const item of dyn) {
    if (!item.href || known.has(item.href)) continue;
    const entry: SearchEntry = {
      id: `dyn:${item.href}`,
      kind: "view",
      module: "*",
      permission: "*",
      label: { en: item.label },
      icon: item.icon,
      keywords: [normalize(item.label)],
      intents: ["view"],
      target: { href: item.href },
    };
    INDEX.push({ entry, label: item.label, labelN: normalize(item.label), labelEnN: normalize(item.label), keywordsN: [normalize(item.label)], pathN: "", parentLabel: "" });
  }
  INDEX_LOCALE = CONFIG.locale;
}

let INDEX_SIG = "";
/** Signature of the dynamic inputs (installed modules) so the index is rebuilt
 *  when the sidebar loader finishes AFTER the first search render. */
function indexSignature(): string {
  const dyn = (window as unknown as { __lxp_cmd_items?: CmdItem[] }).__lxp_cmd_items ?? [];
  return `${CONFIG.locale}|${dyn.map((i) => i.href ?? "").join(",")}`;
}
function ensureIndex(): void {
  const sig = indexSignature();
  if (INDEX.length === 0 || INDEX_LOCALE !== CONFIG.locale || INDEX_SIG !== sig) { buildIndex(); INDEX_SIG = sig; }
}

/* ───────────────────────────── Ranking ───────────────────────────── */

const KIND_BONUS: Record<SearchKind, number> = { action: 1.5, tab: 1, "drawer-section": 1, subview: 0.5, view: 0 };

function scoreEntry(ix: Indexed, tokens: string[], intents: Set<SearchIntent>): number {
  if (tokens.length === 0) return 0;
  let total = 0;
  let matched = 0;
  let labelHits = 0;
  for (const t of tokens) {
    const sLabel = Math.max(tokenFieldScore(t, ix.labelN), tokenFieldScore(t, ix.labelEnN));
    let sKw = 0;
    for (const k of ix.keywordsN) {
      const s = tokenFieldScore(t, k);
      if (s > sKw) sKw = s;
      if (sKw >= 10) break;
    }
    const sPathRaw = tokenFieldScore(t, ix.pathN);
    // "cloudflare dns": the module word hitting the PARENT label counts fully so
    // the tab (module + tab words) outranks the bare view.
    const sPath = sPathRaw >= 10 ? 10 : sPathRaw * 0.6;
    const best = Math.max(sLabel * 1.2, sKw, sPath);
    if (best > 0) matched += 1;
    if (sLabel > 0) labelHits += 1;
    total += best;
  }
  // Require most tokens to hit something (tolerate one stray word in long queries).
  const needed = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.6);
  if (matched < needed) return 0;
  // Intent boost: the query's verb matches what the entry is for.
  if (intents.size > 0) {
    const mine = new Set(ix.entry.intents ?? []);
    let hit = false;
    for (const i of intents) if (mine.has(i)) hit = true;
    if (hit) total += intents.has("create") && ix.entry.kind === "action" ? 6 : 4;
    else if (intents.has("create") && ix.entry.kind === "action") total -= 2;
  }
  // Full-label match bonus (all tokens found in the label).
  if (labelHits === tokens.length) total += 3;
  // Exact whole-label match ("módulos" → Módulos, not "Dev de módulos").
  if (ix.labelN === tokens.join(" ") || ix.labelEnN === tokens.join(" ")) total += 2;
  // Kind tie-breaker (acción exacta > tab > vista). A single generic word
  // without a verb ("webhooks", "módulos") should land on the module root.
  total += KIND_BONUS[ix.entry.kind];
  if (tokens.length === 1 && intents.size === 0 && ix.entry.kind === "view") total += 1.5;
  // Penalize partial coverage a bit so complete matches rank first.
  total -= (tokens.length - matched) * 2;
  return total;
}

function rank(query: string): { results: Result[]; weak: boolean; tokens: string[] } {
  ensureIndex();
  const { tokens, intents } = tokenize(query);
  if (tokens.length === 0) return { results: [], weak: false, tokens };
  const scored: Result[] = [];
  for (const ix of INDEX) {
    const s = scoreEntry(ix, tokens, intents);
    if (s > 0) scored.push({ entry: ix.entry, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, MAX_RESULTS);
  const top = results[0]?.score ?? 0;
  const second = results[1]?.score ?? 0;
  const sameModule = results[0] && results[1] ? results[0].entry.module === results[1].entry.module : true;
  const weak = results.length === 0 || top < WEAK_SCORE || (!sameModule && second > 0 && top - second < top * 0.1);
  return { results, weak, tokens };
}

/* ──────────────────────────── Recientes ──────────────────────────── */

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

function pushRecent(id: string): void {
  try {
    const list = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* storage unavailable */ }
}

/* ───────────────────────── Ejecución del destino ───────────────────────── */

function waitFor(selector: string, timeoutMs = 5000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const found = document.querySelector<HTMLElement>(selector);
    if (found) { resolve(found); return; }
    let done = false;
    const obs = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && !done) { done = true; obs.disconnect(); resolve(el); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { if (!done) { done = true; obs.disconnect(); resolve(document.querySelector<HTMLElement>(selector)); } }, timeoutMs);
  });
}

function runLayoutAction(action: NonNullable<SearchTarget["action"]>): void {
  const isDark = document.documentElement.classList.contains("dark");
  switch (action) {
    case "theme-dark": if (!isDark) document.getElementById("theme-btn")?.click(); break;
    case "theme-light": if (isDark) document.getElementById("theme-btn")?.click(); break;
    case "theme-toggle": document.getElementById("theme-btn")?.click(); break;
    case "logout": document.getElementById("logout-btn")?.click(); break;
    case "sidebar-toggle": document.getElementById("sidebar-desktop-toggle")?.click(); break;
    case "language": {
      const sel = (document.getElementById("workspace-language-select") ?? document.getElementById("language-select")) as (HTMLSelectElement & { showPicker?: () => void }) | null;
      if (sel) { sel.focus(); try { sel.showPicker?.(); } catch { /* not supported */ } }
      break;
    }
    case "server-switcher": {
      const sel = document.querySelector<HTMLSelectElement & { showPicker?: () => void }>("#sidebar-server-switcher, #server-switcher-wrap select");
      if (sel) {
        const wrap = document.getElementById("server-switcher-wrap");
        if (wrap?.classList.contains("hidden")) wrap.classList.remove("hidden");
        sel.scrollIntoView({ block: "nearest" });
        sel.focus();
        try { sel.showPicker?.(); } catch { /* not supported */ }
      }
      break;
    }
  }
}

function isTabLike(el: HTMLElement): boolean {
  return Boolean(
    el.dataset.tab !== undefined ||
    el.getAttribute("role") === "tab" ||
    /(^|\s)(tab|tab-btn|db-tab|cf-tab|mail-main-tab|nav-tab)(\s|$)/i.test(el.className) ||
    el.hasAttribute("data-mail-main-tab") ||
    el.hasAttribute("data-mail-settings-open"),
  );
}

function looksActive(el: HTMLElement): boolean {
  if (el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-current")) return true;
  return /(border-primary|bg-primary|text-primary|bg-background|is-active|\bactive\b)/.test(el.className);
}

/** Wait until the page's own scripts have wired their handlers. Extracted
 *  module scripts run in document order BEFORE this layout script, but React
 *  islands and pages that init on `astro:page-load` may still be booting. */
async function settle(ms = 150): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function runOnPage(target: SearchTarget): Promise<void> {
  if (target.action) { runLayoutAction(target.action); return; }
  const seq = target.clickSeq ?? (target.click ? [target.click] : []);
  let last: HTMLElement | null = null;
  for (const step of seq) {
    // Conditional step: `?<sel>:open|<toggle>` → click <toggle> only when <sel>
    // is collapsed/hidden (never toggles an already-open container closed).
    if (step.startsWith("?")) {
      const m = /^\?(.+):open\|(.+)$/.exec(step);
      if (!m) continue;
      const container = await waitFor(m[1]!, 4000);
      const collapsed = !container || container.dataset.collapsed === "true" || container.hasAttribute("inert") || container.getClientRects().length === 0;
      if (collapsed) { const toggle = await waitFor(m[2]!, 2000); toggle?.click(); await settle(320); }
      continue;
    }
    const sel = step;
    const el = await waitFor(sel);
    if (!el) return;
    // A tab/menu button that sits inside a collapsed/hidden container may not be
    // clickable yet (e.g. the modal is still opening): wait until it is visible.
    for (let i = 0; i < 20 && el.getClientRects().length === 0; i += 1) await settle(100);
    el.click();
    // Tab-like targets: verify the click took effect (handler may not have been
    // bound yet on a cold load) and retry a few times — re-clicking an active
    // tab is a no-op, so this is safe. Never retry "open dialog"-style buttons.
    if (isTabLike(el)) {
      for (let i = 0; i < 4 && !looksActive(el); i += 1) { await settle(250); el.click(); }
    }
    last = el;
    // Give the page script a tick to react (open dialog / swap tab) before the next step.
    await settle(160);
  }
  if (last) {
    try { last.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }
    // Focus the clicked control so keyboard users land exactly there.
    if (typeof last.focus === "function" && !document.querySelector("dialog[open]")) {
      try { last.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  }
  if (target.hash) {
    const id = target.hash.replace(/^#/, "");
    const el = id ? await waitFor(`#${CSS.escape(id)}`, 2500) : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("lxp-view-enter");
      el.addEventListener("animationend", () => el.classList.remove("lxp-view-enter"), { once: true });
    }
  }
  if (target.event) {
    // The React island that listens may still be hydrating: retry briefly.
    // Listeners acknowledge by setting `detail.__ack = true` (ChatMain,
    // AssistantPanel); a visible dialog/drawer also counts as handled — so a
    // handled event is NEVER re-dispatched (no duplicate "new conversation").
    for (let i = 0; i < 16; i += 1) {
      const detail: Record<string, unknown> = { ...(target.event.detail ?? {}), __ack: false };
      window.dispatchEvent(new CustomEvent(target.event.name, { detail }));
      if (detail.__ack === true) break;
      await settle(250);
      if (document.querySelector('[role="dialog"], dialog[open]')) break;
    }
  }
}

/**
 * Espera (≤`timeoutMs`) a que no quede ningún `<dialog open>` en el documento.
 *
 * Quien nos invoca suele venir de un drawer (buscador, campana de
 * notificaciones) que se cierra ANIMADO (`dialog-motion.ts` retrasa el `close()`
 * real ~200 ms). `runOnPage` corta el reintento del `event` en cuanto ve un
 * `dialog[open]`, así que arrancar antes de que el drawer termine de cerrarse
 * haría que el evento se despachara UNA sola vez contra una isla React que
 * quizá aún no escucha → deep-link perdido.
 */
async function waitForDialogsClosed(timeoutMs = 600): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (document.querySelector("dialog[open]") && Date.now() < deadline) {
    await settle(50);
  }
}

/**
 * Ejecuta un destino: navega si hace falta (dejando la intención en
 * sessionStorage para retomarla tras la carga) o aplica los pasos en la página
 * actual. `intentId` solo se usa para identificar la intención pendiente.
 */
function executeTarget(target: SearchTarget, intentId: string): void {
  if (!target.href) { void waitForDialogsClosed().then(() => runOnPage(target)); return; }
  const samePage = normalizePath(location.pathname) === normalizePath(target.href);
  const needsSteps = Boolean(target.click || target.clickSeq || target.event || target.hash);
  if (samePage) {
    if (needsSteps) void waitForDialogsClosed().then(() => runOnPage(target));
    else location.href = buildTargetUrl(target);
    return;
  }
  if (needsSteps) {
    const intent: PendingIntent = { id: intentId, target, ts: Date.now(), path: normalizePath(target.href) };
    try { sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent)); } catch { /* ignore */ }
  }
  location.href = buildTargetUrl(target);
}

function execute(entry: SearchEntry): void {
  pushRecent(entry.id);
  executeTarget(entry.target, entry.id);
}

function consumePendingIntent(): void {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(INTENT_KEY); } catch { return; }
  if (!raw) return;
  let intent: PendingIntent | null = null;
  try { intent = JSON.parse(raw) as PendingIntent; } catch { intent = null; }
  if (!intent || Date.now() - intent.ts > 60_000) { try { sessionStorage.removeItem(INTENT_KEY); } catch { /* ignore */ } return; }
  if (normalizePath(location.pathname) !== intent.path) return; // not there yet (redirect chain)
  try { sessionStorage.removeItem(INTENT_KEY); } catch { /* ignore */ }
  void runOnPage(intent.target);
}

/* ─────────────────────────── Fallback IA ─────────────────────────── */

let aiUnavailable = false;
let aiAbort: AbortController | null = null;
let aiTimer: number | null = null;

async function askAi(query: string, local: Result[]): Promise<{ id: string; confidence: number } | null> {
  if (aiUnavailable) return null;
  aiAbort?.abort();
  aiAbort = new AbortController();
  const ids = new Set<string>();
  const candidates: Array<{ id: string; label: string; path?: string; keywords: string[] }> = [];
  const push = (e: SearchEntry) => {
    if (ids.has(e.id) || candidates.length >= 300) return;
    ids.add(e.id);
    const ix = INDEX.find((x) => x.entry.id === e.id);
    candidates.push({ id: e.id, label: ix?.label ?? e.label.en, ...(ix?.parentLabel ? { path: ix.parentLabel } : {}), keywords: e.keywords.slice(0, 12) });
  };
  for (const r of local) push(r.entry);
  for (const ix of INDEX) push(ix.entry);
  try {
    const res = await fetch(resolvePanelApiPath("/api/search/intent"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "application/json", [CSRF_HEADER_NAME]: getCsrfToken() ?? "" },
      body: JSON.stringify({ query, locale: CONFIG.locale, candidates }),
      signal: aiAbort.signal,
    });
    if (res.status === 503 || res.status === 403 || res.status === 404) { aiUnavailable = true; return null; }
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; id?: string | null; confidence?: number };
    if (!json?.ok || !json.id) return null;
    return { id: json.id, confidence: Number(json.confidence ?? 0) };
  } catch { return null; }
}

/* ────────────────────────────── UI ────────────────────────────── */

let dialog: HTMLDialogElement | null = null;
let input: HTMLInputElement | null = null;
let list: HTMLElement | null = null;
let activeIdx = 0;
let flat: Result[] = [];
let lastQuery = "";
let renderSeq = 0;

function kindLabel(kind: SearchKind): string {
  return I18N?.superSearch?.kinds?.[kind] ?? kind;
}

function highlight(text: string, tokens: string[]): string {
  const safe = escapeHtml(text);
  if (tokens.length === 0) return safe;
  const parts = tokens.filter((t) => t.length >= 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (parts.length === 0) return safe;
  // Match accent-insensitively: build a regex over the escaped display text by
  // testing normalized characters (approximation: plain regex on display text).
  try {
    const re = new RegExp(`(${parts.join("|")})`, "gi");
    return safe.replace(re, '<mark class="rounded-sm bg-primary/20 text-primary">$1</mark>');
  } catch { return safe; }
}

function itemHtml(r: Result, idx: number, tokens: string[]): string {
  const ix = INDEX.find((x) => x.entry.id === r.entry.id);
  const label = ix?.label ?? r.entry.label.en;
  const path = ix?.parentLabel ? `${escapeHtml(ix.parentLabel)} › ` : "";
  const badge = r.ai
    ? `<span class="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">✨ ${escapeHtml(I18N?.superSearch?.aiSuggested ?? "AI")}</span>`
    : "";
  const active = idx === activeIdx;
  const typeLabel = r.entry.id.startsWith("chat:") ? "Chat" : kindLabel(r.entry.kind);
  return `<li role="option" aria-selected="${active}" data-idx="${idx}"
      class="ss-item flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-200 ease-out ${active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"}">
      <i class="ti ${escapeHtml(r.entry.icon)} shrink-0 text-base ${active ? "text-primary" : "text-muted-foreground"}"></i>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">${path}${highlight(label, tokens)}${badge}</p>
        ${r.snippet ? `<p class="truncate text-[11px] text-muted-foreground">${escapeHtml(r.snippet)}</p>` : ""}
      </div>
      <span class="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">${escapeHtml(typeLabel)}</span>
    </li>`;
}

function groupKey(r: Result): string {
  if (r.group) return r.group;
  if (r.entry.kind === "action" && (r.entry.permission === "*" && r.entry.module === "layout")) return "__actions";
  const ix = INDEX.find((x) => x.entry.id === r.entry.id);
  return ix?.parentLabel || ix?.label || r.entry.module;
}

function renderList(results: Result[], tokens: string[], heading?: string): void {
  if (!list) return;
  flat = results;
  if (results.length === 0) {
    list.innerHTML = `<li class="px-4 py-8 text-center text-sm text-muted-foreground">${escapeHtml(I18N?.superSearch?.noResults ?? "No results")}${lastQuery ? ` «${escapeHtml(lastQuery)}»` : ""}</li>`;
    return;
  }
  // Group by module keeping global score order (group order = first appearance).
  const groups = new Map<string, Result[]>();
  for (const r of results) {
    const k = heading ? heading : groupKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  let idx = 0;
  const html: string[] = [];
  for (const [k, items] of groups) {
    const title = k === "__actions" ? (I18N?.superSearch?.groups?.actions ?? "Actions") : k;
    html.push(`<li class="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">${escapeHtml(title)}</li>`);
    for (const r of items) { html.push(itemHtml(r, idx, tokens)); idx += 1; }
  }
  // Flatten in the same order as rendered.
  flat = Array.from(groups.values()).flat();
  list.innerHTML = html.join("");
  list.querySelectorAll<HTMLElement>(".ss-item").forEach((el) => {
    el.addEventListener("click", () => exec(Number(el.dataset.idx)));
    el.addEventListener("mouseenter", () => setActive(Number(el.dataset.idx)));
  });
}

function setActive(idx: number): void {
  if (!list) return;
  activeIdx = Math.max(0, Math.min(idx, flat.length - 1));
  list.querySelectorAll<HTMLElement>(".ss-item").forEach((el, i) => {
    const active = i === activeIdx;
    el.setAttribute("aria-selected", String(active));
    el.className = `ss-item flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-200 ease-out ${active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"}`;
    const icon = el.querySelector("i");
    if (icon) icon.className = `ti ${flat[i]?.entry.icon ?? ""} shrink-0 text-base ${active ? "text-primary" : "text-muted-foreground"}`;
    if (active) el.scrollIntoView({ block: "nearest" });
  });
}

function exec(idx: number): void {
  const r = flat[idx];
  if (!r) return;
  close();
  execute(r.entry);
}

function renderEmpty(): void {
  ensureIndex();
  const recent = readRecent()
    .map((id) => INDEX.find((x) => x.entry.id === id)?.entry)
    .filter((e): e is SearchEntry => Boolean(e))
    .map((entry) => ({ entry, score: 0, recent: true }));
  const suggestions = INDEX.filter((x) => x.entry.kind === "view").slice(0, 12).map((x) => ({ entry: x.entry, score: 0 }));
  if (!list) return;
  const html: string[] = [];
  let idx = 0;
  flat = [];
  if (recent.length) {
    html.push(`<li class="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">${escapeHtml(I18N?.superSearch?.recent ?? "Recent")}</li>`);
    for (const r of recent) { html.push(itemHtml(r, idx, [])); flat.push(r); idx += 1; }
  }
  html.push(`<li class="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">${escapeHtml(I18N?.superSearch?.suggestions ?? "Suggestions")}</li>`);
  for (const r of suggestions) { html.push(itemHtml(r, idx, [])); flat.push(r); idx += 1; }
  list.innerHTML = html.join("");
  list.querySelectorAll<HTMLElement>(".ss-item").forEach((el) => {
    el.addEventListener("click", () => exec(Number(el.dataset.idx)));
    el.addEventListener("mouseenter", () => setActive(Number(el.dataset.idx)));
  });
  activeIdx = 0;
}

function render(query: string): void {
  lastQuery = query.trim();
  activeIdx = 0;
  const seq = ++renderSeq;
  if (aiTimer) { window.clearTimeout(aiTimer); aiTimer = null; }
  aiAbort?.abort();
  if (!lastQuery) { renderEmpty(); return; }
  const { results, weak, tokens } = rank(lastQuery);
  let catalogResults = results;
  let chatResults: Result[] = [];
  const showResults = () => { if (seq === renderSeq) renderList([...chatResults, ...catalogResults], tokens); };
  showResults();
  // The active assistant pane supplies history matches for the project shown
  // in its Prompt Bar. Search shares this one query and result list with the
  // module/action catalog, so there is no second search field in the rail.
  window.setTimeout(async () => {
    if (seq !== renderSeq) return;
    const detail: {
      query: string;
      scopeLabel?: string;
      promise?: Promise<AssistantConversationSearchResult[]>;
    } = { query: lastQuery };
    window.dispatchEvent(new CustomEvent("luxipanel:assistant-search", { detail }));
    if (!detail.promise) return;
    try {
      const chats = await detail.promise;
      if (seq !== renderSeq) return;
      const group = `Chats · ${detail.scopeLabel ?? "Proyecto"}`;
      chatResults = chats.map((chat) => ({
        entry: {
          id: `chat:${chat.id}`,
          kind: "view",
          module: "assistant",
          permission: "*",
          label: { en: chat.title || "Chat" },
          icon: "ti-message-circle",
          keywords: [],
          target: { event: { name: "luxipanel:assistant-open-conversation", detail: {
            conversationId: chat.id,
            ...(chat.provider ? { provider: chat.provider } : {}),
            ...(chat.agentId ? { agentId: chat.agentId } : {}),
          } } },
        },
        score: 100,
        group,
        snippet: chat.searchMatch?.snippet ?? chat.preview,
      }));
      showResults();
    } catch { /* assistant search is optional outside the chat */ }
  }, 250);
  if (weak && lastQuery.length >= AI_MIN_QUERY && !aiUnavailable) {
    aiTimer = window.setTimeout(async () => {
      const ai = await askAi(lastQuery, results);
      if (seq !== renderSeq || !ai || ai.confidence < 0.4) return;
      const entry = findSearchEntry(ai.id) ?? INDEX.find((x) => x.entry.id === ai.id)?.entry;
      if (!entry || !canSee(entry)) return;
      const rest = results.filter((r) => r.entry.id !== entry.id);
      const merged: Result[] = [{ entry, score: 999, ai: true }, ...rest];
      catalogResults = merged;
      showResults();
    }, AI_DEBOUNCE_MS);
  }
}

function open(): void {
  if (!dialog) return;
  readConfig();
  ensureIndex();
  if (dialog.open) { input?.focus(); return; }
  openDialog("super-search");
  if (input) { input.value = ""; }
  render("");
  requestAnimationFrame(() => input?.focus());
}

function close(): void {
  if (dialog?.open) closeDialog("super-search");
}

function bindUi(): void {
  dialog = document.getElementById("super-search") as HTMLDialogElement | null;
  input = document.getElementById("super-search-input") as HTMLInputElement | null;
  list = document.getElementById("super-search-results");
  if (!dialog || !input || !list) return;
  if ((dialog as HTMLElement & { dataset: DOMStringMap }).dataset.bound === "1") return;
  dialog.dataset.bound = "1";

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeIdx + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIdx - 1); }
    else if (e.key === "Enter") { e.preventDefault(); exec(activeIdx); }
  });
  input.addEventListener("input", () => render(input!.value));
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
  document.getElementById("super-search-close")?.addEventListener("click", close);
}

/* ───────────────────────────── Bootstrap ───────────────────────────── */

async function init(): Promise<void> {
  const w = window as unknown as { __lxpSuperSearch?: boolean };
  readConfig();
  if (!I18N || INDEX_LOCALE !== CONFIG.locale) {
    try {
      const msgs = (await getClientMessages(CONFIG.locale, ["panelLayout"])) as { panelLayout?: I18n };
      I18N = msgs.panelLayout ?? null;
    } catch { I18N = null; }
    INDEX = [];
  }
  bindUi();
  if (w.__lxpSuperSearch) { consumePendingIntent(); return; }
  w.__lxpSuperSearch = true;
  // First run (module eval): page scripts may still be binding their handlers.
  // Consume the queued intent on `astro:page-load` (fired on the initial load
  // too when the ClientRouter is active); fall back to a short delay otherwise.
  let consumed = false;
  const consumeOnce = () => { if (consumed) return; consumed = true; consumePendingIntent(); };
  document.addEventListener("astro:page-load", consumeOnce, { once: true });
  window.setTimeout(consumeOnce, 1200);
  // Test/automation hook: execute a catalog entry by id (same path as Enter/click).
  (window as unknown as { __lxpSuperSearchExecute?: (id: string) => boolean }).__lxpSuperSearchExecute = (id: string) => {
    ensureIndex();
    const entry = INDEX.find((x) => x.entry.id === id)?.entry ?? findSearchEntry(id);
    if (!entry) return false;
    execute(entry);
    return true;
  };

  // Motor de navegación compartido: cualquier consumidor de destinos REMOTOS
  // (hoy las notificaciones, `layouts/notifications.js`) pasa por aquí. Valida
  // fail-closed con las MISMAS reglas del backend antes de tocar el DOM o
  // `location`, y reutiliza el runtime de pasos del buscador (tabs, hash,
  // eventos con ack). Devuelve `false` si el destino no es seguro → el llamante
  // aplica su fallback.
  (window as unknown as { __lxpNavigate?: (target: unknown) => boolean }).__lxpNavigate = (target: unknown) => {
    if (!isSafeNotificationTarget(target)) return false;
    executeTarget(target as SearchTarget, "notification");
    return true;
  };

  // Trigger lives in the per-module topbar (re-rendered on SPA nav) → delegation.
  document.addEventListener("click", (e) => {
    const t = (e.target as Element | null)?.closest?.("#cmd-trigger");
    if (t) { e.preventDefault(); open(); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (dialog?.open) close(); else open();
    }
  });
  // Re-bind after SPA swaps (dialog is transition:persist, but be safe) and
  // consume intents queued before navigation.
  document.addEventListener("astro:page-load", () => { void init(); });
  window.addEventListener("luxipanel:modules-changed", () => { INDEX = []; });
}

void init();

export {};
