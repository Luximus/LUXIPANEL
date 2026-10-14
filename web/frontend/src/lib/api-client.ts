import { browserVersionedData, resourceForPath } from "./versioned-data";
import { browserReadScheduler } from "./read-scheduler";
import { startupSeed, invalidateStartup } from "./startup-state";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * API client — fetch wrapper with automatic CSRF token injection.
 *
 * Usage (browser):
 *   import { api } from "@/lib/api-client";
 *   const data = await api.get("/api/monitor/stats");
 *   const result = await api.post("/api/accounts", { address: "x@y.com", ... });
 */
import { browserReadCache, listReadTtl } from "./read-cache";
import { readStoredString, writeStoredString } from "@/lib/prefs-store";
import { getClientMessages } from "@/i18n/client";
import { normalizeLocale } from "@/i18n/config";

/** Name of the CSRF cookie set by the backend (also the OpenAPI spec source). */
export const CSRF_COOKIE_NAME = "luxipanel_csrf";
/** Name of the session cookie set by the backend (also the WS token fallback). */
export const SESSION_COOKIE_NAME = "luxipanel_session";
/** Request header carrying the double-submit CSRF token (mutating requests). */
export const CSRF_HEADER_NAME = "X-CSRF-Token";
/** Request header carrying this tab's active bridge session id (per-server isolation). */
export const BRIDGE_HEADER_NAME = "X-Bridge-Session-Id";

export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))
      ?.split("=")[1] ?? ""
  );
}

/** sessionStorage key holding this tab's active target scope (per-server isolation). */
export const TARGET_SCOPE_SESSION_KEY = "panel-active-target-scope";
/** Sentinel scope value = the panel host itself (no bridged server). */
export const LOCAL_TARGET_SCOPE = "local";
/** sessionStorage key holding this tab's active bridge session id. */
export const BRIDGE_SESSION_SESSION_KEY = "panel-active-bridge-session";

/** Raw string read from sessionStorage; `null` on SSR / missing / blocked. */
function readSession(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Raw string write to sessionStorage. No-op on SSR / blocked storage. */
function writeSession(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore (SSR, private mode, restricted policies) */
  }
}

/** Translated error messages produced by the request layer when the upstream
 *  body is not valid JSON (HTML error page from a gateway timeout / proxy) or
 *  the request is superseded (target-scope change). These defaults are in
 *  Spanish (the canonical source locale); call `setApiClientErrorMessages()`
 *  once at boot to switch to the active locale.
 *
 *  IMPORTANT: the request layer never surfaces a raw opaque token like
 *  `SERVER_ERROR:504` or `TARGET_SCOPE_CHANGED`. Every failure is reduced to a
 *  stable *code* and resolved to a human sentence via `resolveApiErrorMessage`
 *  with the fallback chain: override(code) → built-in default(code) →
 *  generic `SERVER_ERROR` template → the raw code (last resort). Because a
 *  built-in Spanish default always exists, users see a readable message even
 *  when `setApiClientErrorMessages()` was never called. */
export interface ApiClientErrorMessages {
  /** Shown when the response body is non-JSON AND the HTTP status is non-OK.
   *  Use {status} as a placeholder for the HTTP status code. Acts as the
   *  GENERIC fallback for any `SERVER_ERROR:<status>` code that has no more
   *  specific per-status message. */
  serverErrorWithStatus: string;
  /** Shown when the response body is non-JSON AND the HTTP status is OK. */
  invalidResponse: string;
  /** Shown when fetch itself fails before receiving an HTTP response. */
  connectionFailed: string;
  /** Shown when the active target scope changed while a request was in flight
   *  (the user switched servers mid-request; the stale reply is dropped). */
  targetScopeChanged: string;
  /** Shown when a per-server read failed because there is no bridged session for
   *  the connected server (typed 428 `BRIDGE_SESSION_REQUIRED`, e.g. after a
   *  backend restart dropped the in-memory bridges). Actionable: reselect/
   *  reconnect the server. */
  bridgeSessionRequired?: string;
  /** Optional per-code overrides (e.g. `{ "SERVER_ERROR:504": "…" }`). Wins over
   *  the built-in defaults for fully localized, status-specific messages. */
  byCode?: Record<string, string>;
}

const DEFAULT_API_ERRORS: ApiClientErrorMessages = {
  serverErrorWithStatus: "The server returned error {status} (the operation may have timed out).",
  invalidResponse: "Invalid server response.",
  connectionFailed: "Could not connect to the server. Check your connection and try again.",
  targetScopeChanged: "The selected server changed; reload this view.",
};

/** Prefix shared by every HTTP-status failure code (`SERVER_ERROR:<status>`). */
const SERVER_ERROR_PREFIX = "SERVER_ERROR:";
/** Stable code for a request superseded by a target-scope switch. */
export const CODE_TARGET_SCOPE_CHANGED = "TARGET_SCOPE_CHANGED";
/** Stable code for a non-JSON body on an otherwise-OK response. */
export const CODE_INVALID_RESPONSE = "INVALID_RESPONSE";
/** Stable code (typed 428 from the backend) for a per-server read that has no
 *  bridged session for the connected server — recoverable by reselecting the
 *  server. Shared by GET /api/settings, /api/settings/:category and
 *  /api/admin/system/timezone. */
export const CODE_BRIDGE_SESSION_REQUIRED = "BRIDGE_SESSION_REQUIRED";

/** Built-in, human-readable defaults keyed by failure code. In English (the
 *  default locale) so the panel NEVER shows a raw token even when no
 *  locale override was registered. Covers the common HTTP failures plus the two
 *  synthetic codes the request layer can emit. */
const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  "SERVER_ERROR:401": "Session expired. Sign in again.",
  "SERVER_ERROR:403": "You do not have permission for this action.",
  "SERVER_ERROR:404": "Resource not found.",
  "SERVER_ERROR:409": "The resource changed while you were working. Reload and try again.",
  "SERVER_ERROR:429": "Too many requests. Try again shortly.",
  "SERVER_ERROR:500": "Internal server error.",
  "SERVER_ERROR:502": "The server is unavailable right now.",
  "SERVER_ERROR:503": "The server is unavailable right now.",
  "SERVER_ERROR:504": "Timed out waiting for the server.",
  [CODE_TARGET_SCOPE_CHANGED]: "The selected server changed; reload this view.",
  [CODE_INVALID_RESPONSE]: "Invalid server response.",
  [CODE_BRIDGE_SESSION_REQUIRED]: "Select or reconnect a server to continue.",
};

let activeApiErrors: ApiClientErrorMessages = DEFAULT_API_ERRORS;
/** Per-code overrides explicitly registered via `setApiClientErrorMessages`.
 *  Empty by default → the built-in English defaults are used verbatim. */
let overrideErrorMessages: Record<string, string> = {};

/** Override the error messages the request layer surfaces. Call this from page
 *  scripts that have already loaded the active locale so the user sees errors in
 *  their own language instead of the Spanish source defaults. Only the fields
 *  you pass are treated as overrides — anything omitted keeps the built-in
 *  per-code defaults (so partial localization never regresses to raw codes). */
export function setApiClientErrorMessages(messages: Partial<ApiClientErrorMessages>): void {
  activeApiErrors = { ...DEFAULT_API_ERRORS, ...messages };
  const next: Record<string, string> = {};
  // The two synthetic codes map 1:1 to named fields.
  if (typeof messages.invalidResponse === "string") next[CODE_INVALID_RESPONSE] = messages.invalidResponse;
  if (typeof messages.targetScopeChanged === "string") next[CODE_TARGET_SCOPE_CHANGED] = messages.targetScopeChanged;
  if (typeof messages.bridgeSessionRequired === "string") next[CODE_BRIDGE_SESSION_REQUIRED] = messages.bridgeSessionRequired;
  // `serverErrorWithStatus` stays a per-status template resolved lazily (it is
  // NOT a per-code override); explicit per-status overrides go through `byCode`.
  if (messages.byCode && typeof messages.byCode === "object") {
    for (const [code, text] of Object.entries(messages.byCode)) {
      if (typeof text === "string") next[code] = text;
    }
  }
  overrideErrorMessages = next;
}

let loadedErrorLocale: string | null = null;
let loadingErrorLocale: Promise<void> | null = null;

/** Keep shared API failures in the same locale as the page. This is loaded
 * once per document language; individual module scripts need no setup call. */
async function ensureApiErrorLocale(): Promise<void> {
  if (typeof document === "undefined") return;
  const locale = normalizeLocale(document.documentElement.lang);
  if (loadedErrorLocale === locale) return;
  if (loadingErrorLocale) {
    await loadingErrorLocale;
    if (loadedErrorLocale === locale) return;
  }
  loadingErrorLocale = getClientMessages(locale, ["errors"])
    .then((messages) => {
      const errors = messages.errors;
      if (!errors?.networkError) return;
      const n = errors.networkError;
      setApiClientErrorMessages({
        serverErrorWithStatus: n.serverError,
        invalidResponse: n.invalidResponse,
        connectionFailed: n.connectionFailed,
        targetScopeChanged: n.targetScopeChanged,
        bridgeSessionRequired: n.bridgeSessionRequired,
        byCode: {
          "SERVER_ERROR:400": errors.error400.description,
          "SERVER_ERROR:401": errors.error401.description,
          "SERVER_ERROR:403": errors.error403.description,
          "SERVER_ERROR:404": errors.error404.description,
          "SERVER_ERROR:500": errors.error500.title,
          "SERVER_ERROR:503": errors.error503.title,
        },
      });
      loadedErrorLocale = locale;
    })
    .catch(() => { /* Keep readable built-in messages while offline. */ })
    .finally(() => { loadingErrorLocale = null; });
  await loadingErrorLocale;
}

function formatApiError(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/** True for the opaque tokens the request layer (or a backend) may emit as an
 *  `error` string and that we know how to turn into a human sentence. */
function isKnownErrorCode(value: string): boolean {
  return (
    value.startsWith(SERVER_ERROR_PREFIX) ||
    value === CODE_TARGET_SCOPE_CHANGED ||
    value === CODE_INVALID_RESPONSE ||
    Object.prototype.hasOwnProperty.call(DEFAULT_ERROR_MESSAGES, value)
  );
}

/**
 * Resolve a failure *code* to the message shown to the user.
 *
 * Fallback chain (per B1 spec):
 *   override(code) ?? default(code) ?? default(generic SERVER_ERROR) ?? code
 *
 * The generic branch formats `serverErrorWithStatus` with the status parsed
 * from a `SERVER_ERROR:<status>` code, so an unmapped status (e.g. 418) still
 * yields a readable sentence. The final `?? code` guarantees we never crash and,
 * in the worst case, surface the code itself instead of undefined.
 */
export function resolveApiErrorMessage(code: string): string {
  const override = overrideErrorMessages[code];
  if (override) return override;
  const builtIn = DEFAULT_ERROR_MESSAGES[code];
  if (builtIn) return builtIn;
  if (code.startsWith(SERVER_ERROR_PREFIX)) {
    const status = code.slice(SERVER_ERROR_PREFIX.length);
    return formatApiError(activeApiErrors.serverErrorWithStatus, { status });
  }
  return code;
}
/** localStorage key holding per-target UI prefs (theme/locale). */
export const TARGET_UI_PREFS_STORAGE_KEY = "panel-target-ui-prefs-v1";

/** DOM id of the sidebar server switcher + the SSR data-attributes it exposes. */
export const SERVER_SWITCHER_ID = "sidebar-server-switcher";
export const ATTR_CURRENT_TARGET_ID = "data-current-target-id";
export const ATTR_CURRENT_BRIDGE_SESSION_ID = "data-current-bridge-session-id";

/**
 * Resuelve el `bridgeSessionId` de ESTA pestaña.
 *
 * Lee `sessionStorage["panel-active-bridge-session"]`; si está vacío lo siembra
 * desde el atributo SSR `data-current-bridge-session-id` del switcher de
 * servidor y lo persiste para que las demás requests de la pestaña lo reusen.
 * Devuelve "" si no hay nada (cae al comportamiento por-cookie del backend).
 * Tolerante a modo privado / storage restringido (try/catch → "").
 */
function resolveTabBridge(): string {
  if (typeof window === "undefined") return "";
  const stored = (readSession(BRIDGE_SESSION_SESSION_KEY) || "").trim();
  if (stored) return stored;
  let seed = "";
  if (typeof document !== "undefined") {
    seed = (document.getElementById(SERVER_SWITCHER_ID)?.getAttribute(ATTR_CURRENT_BRIDGE_SESSION_ID) || "").trim();
  }
  if (seed) {
    writeSession(BRIDGE_SESSION_SESSION_KEY, seed);
  }
  return seed;
}

/**
 * Cabeceras de aislamiento por-pestaña para peticiones que NO pasan por
 * `request()`/`uploadFile()` (p.ej. SSE/`fetch` crudo del asistente IA).
 *
 * Siempre adjunta `X-Bridge-Session-Id` cuando hay un bridge activo (para que el
 * backend resuelva el target por sesión y no por la cookie compartida por host);
 * con `mutating === true` añade además `X-CSRF-Token` (POST/PUT/PATCH/DELETE).
 * Reutiliza `resolveTabBridge`/`getCsrfToken`; los valores vacíos se omiten para
 * fusionarse sin pisar cabeceras existentes.
 */
export function scopeHeaders(mutating = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const tabBridge = resolveTabBridge();
  if (tabBridge) headers[BRIDGE_HEADER_NAME] = tabBridge;
  if (mutating) {
    const csrf = getCsrfToken();
    if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  }
  return headers;
}

export function resolvePanelApiPath(path: string): string {
  if (typeof window === "undefined") return path;
  if (!path.startsWith("/api/")) return path;

  const pathname = window.location.pathname;
  if (pathname === "/panel" || pathname.startsWith("/panel/")) {
    return `/panel${path}`;
  }
  return path;
}

function readTargetScopeFromSwitcher(): string | null {
  if (typeof document === "undefined") return null;
  const switcher = document.getElementById(SERVER_SWITCHER_ID);
  if (!switcher) return null;
  const targetId = (switcher.getAttribute(ATTR_CURRENT_TARGET_ID) || "").trim();
  return targetId || LOCAL_TARGET_SCOPE;
}

function readTargetScopeFromSession(): string | null {
  const scope = (readSession(TARGET_SCOPE_SESSION_KEY) || "").trim();
  return scope || null;
}

export function resolveTargetScope(): string {
  return readTargetScopeFromSwitcher() ?? readTargetScopeFromSession() ?? LOCAL_TARGET_SCOPE;
}

function persistTargetScope(scope: string): void {
  writeSession(TARGET_SCOPE_SESSION_KEY, scope);
}

export type TargetUiPrefs = {
  locale?: string;
  theme?: "light" | "dark";
};

type TargetUiPrefsMap = Record<string, TargetUiPrefs>;

function normalizeTargetScope(scope: string | null | undefined): string {
  const normalized = (scope ?? "").trim();
  return normalized || LOCAL_TARGET_SCOPE;
}

function readTargetUiPrefsMap(): TargetUiPrefsMap {
  const raw = readStoredString(TARGET_UI_PREFS_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as TargetUiPrefsMap : {};
  } catch {
    return {};
  }
}

function writeTargetUiPrefsMap(map: TargetUiPrefsMap): void {
  writeStoredString(TARGET_UI_PREFS_STORAGE_KEY, JSON.stringify(map));
}

export function readTargetUiPrefs(scope: string | null | undefined): TargetUiPrefs | null {
  const key = normalizeTargetScope(scope);
  const prefs = readTargetUiPrefsMap()[key];
  if (!prefs || typeof prefs !== "object") return null;
  const locale = typeof prefs.locale === "string" ? prefs.locale.trim() : "";
  const theme = prefs.theme === "dark" || prefs.theme === "light" ? prefs.theme : undefined;
  if (!locale && !theme) return null;
  return {
    ...(locale ? { locale } : {}),
    ...(theme ? { theme } : {}),
  };
}

export function writeTargetUiPrefs(scope: string | null | undefined, prefs: TargetUiPrefs): void {
  const key = normalizeTargetScope(scope);
  const current = readTargetUiPrefsMap();
  const next: TargetUiPrefs = {
    ...(current[key] ?? {}),
    ...(typeof prefs.locale === "string" && prefs.locale.trim() ? { locale: prefs.locale.trim() } : {}),
    ...(prefs.theme === "dark" || prefs.theme === "light" ? { theme: prefs.theme } : {}),
  };
  if (!next.locale && !next.theme) return;
  current[key] = next;
  writeTargetUiPrefsMap(current);
}

interface ApiOptions extends Omit<RequestInit, "method" | "body"> {
  fresh?: boolean;
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  /** Human-readable message (already resolved from a code when applicable). */
  error?: string;
  /** Stable failure code when the request layer (or backend) signalled one —
   *  e.g. `"TARGET_SCOPE_CHANGED"`, `"INVALID_RESPONSE"`, `"SERVER_ERROR:504"`.
   *  Consumers should branch on this instead of string-matching `error`. */
  code?: string;
  status: number;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiOptions = {},
): Promise<ApiResponse<T>> {
  // Translate failures in parallel with the request so successful module reads
  // can render while the error namespace is still downloading.
  const errorLocaleReady = ensureApiErrorLocale().catch(() => undefined);
  const requestScope = resolveTargetScope();
  persistTargetScope(requestScope);
  const { params, fresh: _fresh, ...fetchOptions } = options;

  let url = resolvePanelApiPath(path);
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
  }

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Aislamiento de sesión por pestaña: el backend resuelve el target desde
  // este id (validando propiedad) en vez de la cookie compartida por host.
  const tabBridge = resolveTabBridge();
  if (tabBridge) headers[BRIDGE_HEADER_NAME] = tabBridge;

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // Inject CSRF token for mutating requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    invalidateStartup();
    const csrf = getCsrfToken();
    if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  }

  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers,
      cache: fetchOptions.cache ?? "no-store",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...fetchOptions,
    });

    // Handle empty responses (e.g. 204 No Content)
    const text = await res.text();
    let json: { ok?: boolean; data?: unknown; meta?: Record<string, unknown>; error?: string; message?: string; code?: string };
    try {
      json = text ? JSON.parse(text) : { ok: res.ok };
    } catch {
      // Non-JSON body — e.g. an HTML error page from a gateway timeout (504/524)
      // or proxy. Reduce to a stable code and resolve it to a human sentence,
      // never a raw "Unexpected token '<'" NOR an opaque `SERVER_ERROR:504`.
      const code = res.ok ? CODE_INVALID_RESPONSE : `${SERVER_ERROR_PREFIX}${res.status}`;
      await errorLocaleReady;
      return {
        ok: false,
        error: resolveApiErrorMessage(code),
        code,
        status: res.status,
      };
    }

    const responseScope = resolveTargetScope();
    if (responseScope !== requestScope) {
      await errorLocaleReady;
      return {
        ok: false,
        error: resolveApiErrorMessage(CODE_TARGET_SCOPE_CHANGED),
        code: CODE_TARGET_SCOPE_CHANGED,
        status: 409,
      };
    }

    // Backend may itself return an opaque code as `error` (e.g. a 409 whose body
    // is `{ error: "TARGET_SCOPE_CHANGED" }`). Translate known codes so no raw
    // token reaches a toast; unknown backend messages pass through untouched.
    const rawError = json.error ?? json.message;
    const code =
      typeof json.code === "string" && json.code
        ? json.code
        : typeof rawError === "string" && isKnownErrorCode(rawError)
          ? rawError
          : undefined;
    // A backend `code` we know how to translate wins; an unknown code (the
    // typed AppError codes, e.g. `MAIL_CREDENTIAL_INVALID`) must NOT replace
    // the backend's human message with the raw token — keep the message and
    // expose the code alongside so consumers can branch on it.
    const translatable = !!code && isKnownErrorCode(code);
    if (translatable || !res.ok || json.ok === false) await errorLocaleReady;
    // A failed response may wait for translations while the user switches.
    if (resolveTargetScope() !== requestScope) {
      return { ok: false, error: resolveApiErrorMessage(CODE_TARGET_SCOPE_CHANGED), code: CODE_TARGET_SCOPE_CHANGED, status: 409 };
    }
    const error = translatable
      ? resolveApiErrorMessage(code)
      : typeof rawError === "string" && rawError
        ? rawError
        : code
          ? resolveApiErrorMessage(code)
          : undefined;
    return {
      ok: res.ok && json.ok !== false,
      data: (json.data ?? json) as T,
      ...(json.meta ? { meta: json.meta } : {}),
      error,
      ...(code ? { code } : {}),
      status: res.status,
    };
  } catch (err) {
    await errorLocaleReady;
    return {
      ok: false,
      error: activeApiErrors.connectionFailed,
      status: 0,
    };
  }
}

/**
 * Unwrap an `ApiResponse` or throw (F-15).
 *
 * Replaces the ~64 hand-written copies of
 *   `if (!res.ok || !res.data) throw new Error(res.error ?? "…")`
 * with the exact same semantics: the request must be `ok` AND carry a truthy
 * `data`; the thrown message prefers the (already localized) `res.error` and
 * falls back to the caller's literal.
 */
export function unwrap<T>(res: ApiResponse<T>, fallbackMessage: string): NonNullable<T> {
  if (!res.ok || !res.data) throw new Error(res.error ?? fallbackMessage);
  return res.data as NonNullable<T>;
}

/**
 * Assertion flavor of {@link unwrap} for call sites that keep reading `res.data`
 * afterwards (or read a nested field): narrows `res.data` to non-nullable
 * instead of returning it.
 */
export function assertApiOk<T>(
  res: ApiResponse<T>,
  fallbackMessage: string,
): asserts res is ApiResponse<T> & { data: NonNullable<T> } {
  if (!res.ok || !res.data) throw new Error(res.error ?? fallbackMessage);
}

async function coordinatedRequest<T>(method: string, path: string, body?: unknown, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  if (typeof window === "undefined") return request<T>(method, path, body, options);
  const cache = browserReadCache();
  if (method !== "GET") {
    browserVersionedData().invalidate(() => true);
    cache.clear();
    try { return await request<T>(method, path, body, options); }
    finally { browserVersionedData().invalidate(() => true); cache.clear(); }
  }
  const scheduler = browserReadScheduler();
  const scope = () => JSON.stringify([resolveTargetScope(), resolveTabBridge(), getCsrfToken(),
    document.getElementById("messenger-link")?.getAttribute("data-me"), document.documentElement.lang, scheduler.version()]);
  const initialScope = scope();
  const resource = resourceForPath(path), targetScope = resolveTargetScope();
  const mailTarget = new Headers(options.headers).get("X-Mail-Target-Id") ?? "";
  const report = (result: ApiResponse<T>) => {
    if (resource) window.dispatchEvent(new CustomEvent("lxp:data:freshness", {detail: {resource, targetScope, mailTarget, freshness: result.meta?.freshness, ok: result.ok}}));
    return result;
  };
  const changed = (): ApiResponse<T> => ({ok: false, code: CODE_TARGET_SCOPE_CHANGED, error: resolveApiErrorMessage(CODE_TARGET_SCOPE_CHANGED), status: 409});
  const load = () => scheduler.run(async () => {
    if (scope() !== initialScope) return changed();
    const versionKey = JSON.stringify([initialScope, path, options.params, [...new Headers(options.headers).entries()].sort()]);
    const result = resource && !options.signal
      ? await browserVersionedData().read(versionKey, knownVersion => request<T>(method, path, body, {...options, params: {...options.params, ...(knownVersion ? {knownVersion} : {})}}))
      : await request<T>(method, path, body, options);
    if (scope() !== initialScope) return changed();
    return result;
  }, options.signal);
  const ttl = listReadTtl(path);
  if (ttl === null || options.signal) {
    try { const result = await load(); return scope() === initialScope ? report(result) : changed(); }
    catch {
      if (scope() !== initialScope) return changed();
      await ensureApiErrorLocale();
      return scope() === initialScope ? report({ok: false, error: activeApiErrors.connectionFailed, status: 0}) : changed();
    }
  }
  const key = JSON.stringify([initialScope, path, options.params, [...new Headers(options.headers).entries()].sort()]);
  // Restoring a chat marks it reviewed while its history is still loading.
  // Mutations discard that pending snapshot; reload it within the same scope
  // instead of treating cache invalidation as a server switch.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (scope() !== initialScope) break;
    try {
      const result = await cache.read(key, load, ttl, options.fresh);
      if (scope() === initialScope) return report(result);
      break;
    } catch (error) {
      if (scope() !== initialScope) break;
      if (error instanceof Error && error.message === "READ_INVALIDATED" && attempt < 2) continue;
      await ensureApiErrorLocale();
      if (scope() !== initialScope) break;
      return report({ ok: false, error: activeApiErrors.connectionFailed, status: 0 });
    }
  }
  return { ok: false, code: CODE_TARGET_SCOPE_CHANGED, error: resolveApiErrorMessage(CODE_TARGET_SCOPE_CHANGED), status: 409 };
}
async function catalogRequest<T>(path: string): Promise<ApiResponse<T>> {
 const seed=startupSeed();
 if(path==="/api/ai/config" && seed?.assistant) return {ok:true,status:200,data:{ok:true,config:seed.assistant} as T};
 return coordinatedRequest<T>("GET",path);
}
export const api = {
  catalog: catalogRequest,
  get<T = unknown>(path: string, options?: ApiOptions) { return coordinatedRequest<T>("GET", path, undefined, options); },
  post<T = unknown>(path: string, body?: unknown, options?: ApiOptions) { return coordinatedRequest<T>("POST", path, body, options); },
  put<T = unknown>(path: string, body?: unknown, options?: ApiOptions) { return coordinatedRequest<T>("PUT", path, body, options); },
  patch<T = unknown>(path: string, body?: unknown, options?: ApiOptions) { return coordinatedRequest<T>("PATCH", path, body, options); },
  delete<T = unknown>(path: string, body?: unknown, options?: ApiOptions) { return coordinatedRequest<T>("DELETE", path, body, options); },
};

// ── UI preferences (theme + language) — backend is the source of truth ──────
// The panel used to keep theme/language ONLY in localStorage/cookies, which are
// per-origin and are lost as the user hops across the dynamic login subdomains
// (and never sync across devices). The authoritative store is now the
// per-user+per-server sidecar exposed by `GET/PUT /api/preferences/ui`; the
// cookies/localStorage stay purely as an anti-flash cache the SSR can read.

export type UiPreferences = {
  theme: "light" | "dark" | "system";
  /** i18n code (e.g. "es"|"en"); null means "let the frontend decide". */
  language: string | null;
};

/**
 * Read the authoritative UI preferences for the current session. Returns null
 * when there is no session, the endpoint is unreachable, or the payload is
 * unusable — callers keep their local cache in that case (fail-open).
 */
export async function fetchUiPreferences(): Promise<UiPreferences | null> {
  try {
    const seeded=startupSeed()?.preferences;
    const res = seeded ? {ok:true,data:seeded as Partial<UiPreferences>} : await api.get<Partial<UiPreferences>>("/api/preferences/ui");
    if (!res.ok || !res.data || typeof res.data !== "object") return null;
    const rawTheme = res.data.theme;
    const theme: UiPreferences["theme"] =
      rawTheme === "dark" || rawTheme === "light" || rawTheme === "system" ? rawTheme : "system";
    const language = typeof res.data.language === "string" && res.data.language.trim()
      ? res.data.language.trim()
      : null;
    return { theme, language };
  } catch {
    return null;
  }
}

/**
 * Persist a partial UI-preference change. Fire-and-forget with silent errors:
 * the caller already applied the local effect (dark class / locale cookie), so
 * a network failure must not undo it. Uses `keepalive` so the request still
 * completes when the language change triggers an immediate reload.
 */
export function putUiPreferences(patch: { theme?: "light" | "dark" | "system"; language?: string }): void {
  try {
    const csrf = getCsrfToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrf) headers[CSRF_HEADER_NAME] = csrf;
    const tabBridge = resolveTabBridge();
    if (tabBridge) headers[BRIDGE_HEADER_NAME] = tabBridge;
    void fetch(resolvePanelApiPath("/api/preferences/ui"), {
      method: "PUT",
      credentials: "include",
      headers,
      body: JSON.stringify(patch),
      keepalive: true,
      cache: "no-store",
    }).catch(() => {
      // Silent: local effect already applied; backend will resync on next load.
    });
  } catch {
    // Ignore (e.g. document/fetch unavailable in non-browser contexts).
  }
}

/** Upload a raw binary file (multipart not needed — uses octet-stream). */
export async function uploadFile(
  path: string,
  file: File,
): Promise<ApiResponse> {
  const errorLocaleReady = ensureApiErrorLocale().catch(() => undefined);
  const requestScope = resolveTargetScope();
  persistTargetScope(requestScope);
  const csrf = getCsrfToken();
  const tabBridge = resolveTabBridge();
  const targetPath = resolvePanelApiPath(path);
  try {
    const res = await fetch(targetPath, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Filename": encodeURIComponent(file.name),
        ...(csrf ? { [CSRF_HEADER_NAME]: csrf } : {}),
        ...(tabBridge ? { [BRIDGE_HEADER_NAME]: tabBridge } : {}),
      },
      body: file,
    });
    const raw = await res.text();
    let json: { ok?: boolean; data?: unknown; error?: string; message?: string; code?: string };
    try {
      json = raw ? JSON.parse(raw) : { ok: res.ok };
    } catch {
      const code = res.ok ? CODE_INVALID_RESPONSE : `${SERVER_ERROR_PREFIX}${res.status}`;
      await errorLocaleReady;
      return { ok: false, error: resolveApiErrorMessage(code), code, status: res.status };
    }
    const responseScope = resolveTargetScope();
    if (responseScope !== requestScope) {
      await errorLocaleReady;
      return {
        ok: false,
        error: resolveApiErrorMessage(CODE_TARGET_SCOPE_CHANGED),
        code: CODE_TARGET_SCOPE_CHANGED,
        status: 409,
      };
    }
    const rawError = json.error ?? json.message;
    const code = typeof json.code === "string" && json.code
      ? json.code
      : typeof rawError === "string" && isKnownErrorCode(rawError)
        ? rawError
        : undefined;
    const translatable = !!code && isKnownErrorCode(code);
    if (translatable || !res.ok || json.ok === false) await errorLocaleReady;
    if (resolveTargetScope() !== requestScope) {
      return { ok: false, error: resolveApiErrorMessage(CODE_TARGET_SCOPE_CHANGED), code: CODE_TARGET_SCOPE_CHANGED, status: 409 };
    }
    const error = translatable
      ? resolveApiErrorMessage(code)
      : typeof rawError === "string" && rawError
        ? rawError
        : code ? resolveApiErrorMessage(code) : undefined;
    return { ok: res.ok && json.ok !== false, data: json, ...(error ? { error } : {}), ...(code ? { code } : {}), status: res.status };
  } catch {
    await errorLocaleReady;
    return { ok: false, error: activeApiErrors.connectionFailed, status: 0 };
  }
}
