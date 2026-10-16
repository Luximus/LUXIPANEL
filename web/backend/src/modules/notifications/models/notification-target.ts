// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NotificationTarget — "a dónde lleva" una fila de la campana.
 *
 * Mismo shape que `SearchTarget` del super buscador
 * (`frontend/src/lib/search-catalog.ts`): el frontend ejecuta el target con el
 * MISMO runtime que usa el buscador (navegar → esperar el DOM → clic/evento),
 * así una notificación aterriza en el tab/drawer exacto y no solo en la vista.
 *
 * SEGURIDAD (fail-closed). Un `target` viaja dentro del payload de un evento
 * interno y puede acabar persistido en el sidecar: si aceptáramos cualquier
 * cosa, una fila de la campana podría redirigir al operador fuera del panel
 * (`https://…`, `javascript:`, `//evil`) o disparar un evento arbitrario en
 * `window`. Por eso:
 *   - `href` SOLO rutas internas `/panel…`, sin `//`, `\`, `:` ni `..`.
 *   - `query` ≤10 claves, valores string ≤200.
 *   - `hash` `#[A-Za-z0-9_-]{1,64}`.
 *   - `click`/`clickSeq` ≤6 pasos, ≤200 chars, charset de selector CSS.
 *   - `event.name` DEBE estar en `NOTIFICATION_EVENT_ALLOWLIST`; `detail` solo
 *     escalares (≤10 claves).
 * Todo lo que no encaje se descarta (no se "arregla"); si no queda nada útil,
 * `sanitizeNotificationTarget` devuelve `null`.
 */

import { z } from "zod";

export interface NotificationTarget {
  /** Ruta interna destino (`/panel`, `/panel/monitor`, …). */
  href?: string;
  /** Query-string a añadir (deep-link: `?tab=dns`, `?c=<conv>`). */
  query?: Record<string, string>;
  /** Hash a añadir (`#pref-audit`). */
  hash?: string;
  /** Selector CSS a clicar cuando exista en el DOM. */
  click?: string;
  /** Secuencia de selectores a clicar en orden. */
  clickSeq?: string[];
  /** CustomEvent global a despachar tras cargar la página. */
  event?: { name: string; detail?: Record<string, unknown> };
}

/** Únicos CustomEvents que una notificación puede despachar en `window`. */
export const NOTIFICATION_EVENT_ALLOWLIST = [
  "luxipanel:releases-open",
  "luxipanel:assistant-open-conversation",
  "luxipanel:assistant-settings-open",
  "luxipanel:assistant-new-conversation",
] as const;

export type NotificationEventName = (typeof NOTIFICATION_EVENT_ALLOWLIST)[number];

const HREF_RE = /^\/panel(?:\/[A-Za-z0-9_\-./]*)?$/;
const HASH_RE = /^#[A-Za-z0-9_-]{1,64}$/;
const QUERY_KEY_RE = /^[A-Za-z0-9_-]{1,40}$/;
const SELECTOR_RE = /^[\w\s#.[\]="'\-:?|>]+$/;

const MAX_QUERY_KEYS = 10;
const MAX_QUERY_VALUE = 200;
const MAX_CLICK_STEPS = 6;
const MAX_SELECTOR = 200;
const MAX_DETAIL_KEYS = 10;
const MAX_DETAIL_STRING = 200;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Ruta interna válida (fail-closed): sólo `/panel…`, sin escapes ni `..`. */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  const h = href.trim();
  if (!h || h.length > 300) return false;
  if (h.includes("//") || h.includes("\\") || h.includes(":") || h.includes("..")) return false;
  return HREF_RE.test(h);
}

function sanitizeSelector(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s.length > MAX_SELECTOR) return null;
  return SELECTOR_RE.test(s) ? s : null;
}

function sanitizeQuery(value: unknown): Record<string, string> | null {
  if (!isPlainObject(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (Object.keys(out).length >= MAX_QUERY_KEYS) break;
    if (!QUERY_KEY_RE.test(key)) continue;
    if (typeof raw !== "string") continue;
    const v = raw.trim();
    if (!v || v.length > MAX_QUERY_VALUE) continue;
    out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeDetail(value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (Object.keys(out).length >= MAX_DETAIL_KEYS) break;
    if (!QUERY_KEY_RE.test(key)) continue;
    if (typeof raw === "string") {
      const v = raw.trim();
      if (!v || v.length > MAX_DETAIL_STRING) continue;
      out[key] = v;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
    } else if (typeof raw === "boolean") {
      out[key] = raw;
    }
    // objetos / arrays / funciones / null → descartados.
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeEvent(value: unknown): NotificationTarget["event"] | null {
  if (!isPlainObject(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!(NOTIFICATION_EVENT_ALLOWLIST as readonly string[]).includes(name)) return null;
  const detail = sanitizeDetail(value.detail);
  return detail ? { name, detail } : { name };
}

/**
 * Valida + normaliza un target desconocido. Devuelve `null` cuando el `href`
 * es inseguro o cuando no queda ninguna instrucción útil.
 */
export function sanitizeNotificationTarget(input: unknown): NotificationTarget | null {
  if (!isPlainObject(input)) return null;

  const out: NotificationTarget = {};

  if (input.href !== undefined && input.href !== null) {
    // href presente pero inválido ⇒ se rechaza el target ENTERO: dejarlo pasar
    // sin href convertiría una navegación externa en un clic silencioso.
    if (!isSafeHref(input.href)) return null;
    out.href = String(input.href).trim();
  }

  const query = sanitizeQuery(input.query);
  if (query) out.query = query;

  if (typeof input.hash === "string") {
    const h = input.hash.trim();
    if (HASH_RE.test(h)) out.hash = h;
  }

  const click = sanitizeSelector(input.click);
  if (click) out.click = click;

  if (Array.isArray(input.clickSeq)) {
    const steps = input.clickSeq
      .slice(0, MAX_CLICK_STEPS)
      .map((s) => sanitizeSelector(s))
      .filter((s): s is string => !!s);
    if (steps.length) out.clickSeq = steps;
  }

  const event = sanitizeEvent(input.event);
  if (event) out.event = event;

  return Object.keys(out).length ? out : null;
}

/**
 * Target → `link` clásico (`/panel/cloudflare?tab=dns#x`) para clientes que aún
 * no ejecutan targets (app nativa, correo, fallback del drawer).
 */
export function targetToLink(target: NotificationTarget | null | undefined): string | null {
  if (!target) return null;
  const href = target.href ?? (target.query || target.hash ? "/panel" : null);
  if (!href) return null;
  let link = href;
  if (target.query) {
    const qs = Object.entries(target.query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    if (qs) link += `?${qs}`;
  }
  if (target.hash) link += target.hash;
  return link;
}

/** `link` clásico → target equivalente (`null` si el link no es interno). */
export function linkToTarget(link: unknown): NotificationTarget | null {
  if (typeof link !== "string") return null;
  const raw = link.trim();
  if (!raw) return null;
  const hashAt = raw.indexOf("#");
  const hash = hashAt >= 0 ? raw.slice(hashAt) : "";
  const withoutHash = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
  const qAt = withoutHash.indexOf("?");
  const path = qAt >= 0 ? withoutHash.slice(0, qAt) : withoutHash;
  const search = qAt >= 0 ? withoutHash.slice(qAt + 1) : "";

  if (!isSafeHref(path)) return null;
  const target: Record<string, unknown> = { href: path };
  if (search) {
    const query: Record<string, string> = {};
    for (const pair of search.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : "";
      if (k) query[k] = v;
    }
    if (Object.keys(query).length) target.query = query;
  }
  if (hash) target.hash = hash;
  return sanitizeNotificationTarget(target);
}

/**
 * Esquema Zod para la superficie HTTP (`POST /api/notifications`). Delega en el
 * saneador: lo que no pasa se rechaza como error de validación, nunca se
 * "corrige" a medias.
 */
export const notificationTargetSchema = z
  .unknown()
  .transform((value, ctx): NotificationTarget => {
    const target = sanitizeNotificationTarget(value);
    if (!target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "target inválido (href debe ser /panel…, evento en allowlist)",
      });
      return z.NEVER as unknown as NotificationTarget;
    }
    return target;
  });
