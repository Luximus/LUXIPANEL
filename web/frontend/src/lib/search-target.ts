// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * search-target.ts — Destino navegable (`NotificationTarget`) + validación
 * fail-closed compartida por el super buscador y las notificaciones.
 *
 * El backend (`modules/notifications/models/notification-target.ts`) emite en
 * cada notificación un `target` con EXACTAMENTE el mismo shape que
 * `SearchTarget` del catálogo del buscador (`lib/search-catalog.ts`), menos
 * `action` (las notificaciones no ejecutan acciones del layout). El runtime del
 * buscador sabe ejecutar ese shape (navegar + clicar tabs + hash + evento), así
 * que las notificaciones reutilizan el MISMO motor vía `window.__lxpNavigate`.
 *
 * Todo lo que llega aquí es dato REMOTO: se valida fail-closed antes de tocar
 * el DOM o `location` (nunca `innerHTML`/`eval`; `href` siempre interno
 * `/panel/...`; `event.name` de una allowlist cerrada; `detail` solo escalares).
 * Las mismas reglas viven en el backend: si una cambia, cambia la otra.
 *
 * Este fichero es STANDALONE (sin imports): se compila como lib runtime a
 * `/scripts/extracted/lib/search-target.js` (ver scripts/build-extracted.mjs)
 * y lo importan por URL los scripts extraídos del layout.
 */

/** Destino navegable de una notificación (subconjunto de `SearchTarget`). */
export interface NotificationTarget {
  /** Página destino en forma interna `/panel/...` (o `/panel` para la home). */
  href?: string;
  /** Query-string a añadir (páginas con deep-link `?tab=` / `?c=`). */
  query?: Record<string, string>;
  /** Hash a añadir (`#pref-audit`). */
  hash?: string;
  /** Selector CSS a clicar cuando exista en el DOM. */
  click?: string;
  /** Secuencia de selectores a clicar en orden (≤6 pasos). */
  clickSeq?: string[];
  /** CustomEvent global a despachar tras cargar la página. */
  event?: { name: string; detail?: Record<string, unknown> };
}

/** Eventos que una notificación puede despachar. Allowlist CERRADA. */
export const NOTIFICATION_EVENT_ALLOWLIST = [
  "luxipanel:releases-open",
  "luxipanel:assistant-open-conversation",
  "luxipanel:assistant-settings-open",
  "luxipanel:assistant-new-conversation",
] as const;

export type NotificationEventName = (typeof NOTIFICATION_EVENT_ALLOWLIST)[number];

/* ─────────────────────────── Reglas (espejo backend) ─────────────────────────── */

/** Solo rutas internas del panel. Sin esquema, sin host, sin `..`. */
const HREF_RE = /^\/panel(?:\/[A-Za-z0-9_\-./]*)?$/;
const HASH_RE = /^#[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9_-]{1,40}$/;
/** Charset conservador para selectores CSS (incluye el paso condicional `?sel:open|toggle`). */
const SELECTOR_RE = /^[A-Za-z0-9 _\-#.[\]='":,>~+*()|?$^\/]{1,200}$/;

const MAX_CLICK_STEPS = 6;
const MAX_QUERY_ENTRIES = 10;
const MAX_QUERY_VALUE = 200;
const MAX_DETAIL_ENTRIES = 20;
const MAX_DETAIL_STRING = 500;

const TARGET_KEYS = new Set(["href", "query", "hash", "click", "clickSeq", "event"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isSafeHref(v: unknown): boolean {
  return typeof v === "string" && HREF_RE.test(v) && !v.includes("..");
}

function isSafeSelector(v: unknown): boolean {
  return typeof v === "string" && v.length > 0 && SELECTOR_RE.test(v);
}

function isSafeQuery(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  const entries = Object.entries(v);
  if (entries.length > MAX_QUERY_ENTRIES) return false;
  return entries.every(([k, val]) =>
    KEY_RE.test(k) &&
    typeof val === "string" &&
    val.length > 0 &&
    val.length <= MAX_QUERY_VALUE &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f\u007f]/.test(val));
}

/** `detail` SOLO escalares (string acotado / number finito / boolean / null). */
function isSafeDetail(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  const entries = Object.entries(v);
  if (entries.length > MAX_DETAIL_ENTRIES) return false;
  return entries.every(([k, val]) => {
    if (!KEY_RE.test(k)) return false;
    if (val === null || typeof val === "boolean") return true;
    if (typeof val === "number") return Number.isFinite(val);
    if (typeof val === "string") return val.length <= MAX_DETAIL_STRING;
    return false;
  });
}

function isSafeEvent(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  for (const k of Object.keys(v)) if (k !== "name" && k !== "detail") return false;
  if (!(NOTIFICATION_EVENT_ALLOWLIST as readonly string[]).includes(v.name as string)) return false;
  if (v.detail === undefined) return true;
  return isSafeDetail(v.detail);
}

/**
 * Validador fail-closed: cualquier clave desconocida, tipo inesperado o valor
 * fuera de las reglas invalida el target COMPLETO (nunca se ejecuta a medias).
 * Un target sin ningún campo accionable también es inválido.
 */
export function isSafeNotificationTarget(value: unknown): value is NotificationTarget {
  if (!isPlainObject(value)) return false;
  for (const k of Object.keys(value)) if (!TARGET_KEYS.has(k)) return false;

  const { href, query, hash, click, clickSeq, event } = value;

  if (href !== undefined && !isSafeHref(href)) return false;
  if (query !== undefined && !isSafeQuery(query)) return false;
  if (hash !== undefined && !(typeof hash === "string" && HASH_RE.test(hash))) return false;
  if (click !== undefined && !isSafeSelector(click)) return false;
  if (clickSeq !== undefined) {
    if (!Array.isArray(clickSeq) || clickSeq.length === 0 || clickSeq.length > MAX_CLICK_STEPS) return false;
    if (!clickSeq.every(isSafeSelector)) return false;
  }
  if (event !== undefined && !isSafeEvent(event)) return false;

  // Al menos un campo accionable (un objeto vacío no navega a ninguna parte).
  return href !== undefined || hash !== undefined || click !== undefined || clickSeq !== undefined || event !== undefined;
}

/* ─────────────────────────── Conversión legado ─────────────────────────── */

/**
 * `link` legado (`/panel/preferences?tab=x#pref-audit`) → `NotificationTarget`.
 * Devuelve `null` si el enlace no cumple las reglas (externo, esquema raro…).
 */
export function linkToTarget(link: unknown): NotificationTarget | null {
  if (typeof link !== "string" || link.length === 0 || link.length > 2048) return null;
  if (!link.startsWith("/panel")) return null;
  const hashIdx = link.indexOf("#");
  const rawHash = hashIdx >= 0 ? link.slice(hashIdx) : "";
  const withoutHash = hashIdx >= 0 ? link.slice(0, hashIdx) : link;
  const qIdx = withoutHash.indexOf("?");
  const path = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const rawQuery = qIdx >= 0 ? withoutHash.slice(qIdx + 1) : "";
  if (!isSafeHref(path)) return null;

  const target: NotificationTarget = { href: path };
  if (rawQuery) {
    const query: Record<string, string> = {};
    for (const part of rawQuery.split("&")) {
      if (!part) continue;
      const eq = part.indexOf("=");
      const k = decodeSafe(eq >= 0 ? part.slice(0, eq) : part);
      const v = eq >= 0 ? decodeSafe(part.slice(eq + 1)) : "";
      if (!k || !v) continue;
      query[k] = v;
    }
    if (Object.keys(query).length > 0) {
      if (!isSafeQuery(query)) return null;
      target.query = query;
    }
  }
  if (rawHash) {
    if (!HASH_RE.test(rawHash)) return null;
    target.hash = rawHash;
  }
  return isSafeNotificationTarget(target) ? target : null;
}

function decodeSafe(s: string): string {
  try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; }
}

/* ─────────────────────────── URL / rutas ─────────────────────────── */

function originOf(): string {
  return typeof location !== "undefined" && location.origin ? location.origin : "http://localhost";
}

/** `target` → URL relativa lista para `location.href` (`/panel/x?a=b#c`). */
export function buildTargetUrl(target: { href?: string; query?: Record<string, string>; hash?: string }): string {
  const href = target.href ?? "/panel";
  const url = new URL(href, originOf());
  for (const [k, v] of Object.entries(target.query ?? {})) url.searchParams.set(k, v);
  if (target.hash) url.hash = target.hash;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Ruta canónica para comparar "¿estoy ya en esta página?". Quita el prefijo
 * `/panel` (el panel se sirve tanto en `/` como bajo `/panel`), la query, el
 * hash y la barra final.
 */
export function normalizePath(p: string): string {
  let s = (p || "").split(/[?#]/)[0] ?? "";
  if (s === "/panel" || s === "/panel/") return "/";
  if (s.startsWith("/panel/")) s = s.slice("/panel".length);
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}
