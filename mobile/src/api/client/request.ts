import { ENV } from "../../config/env";
import { promptStepUp } from "../../lib/step-up-bridge";
import { emitRateLimited, parseRetryAfterSeconds } from "../../lib/rate-limit-notice";
import { createRequestCache } from "../../lib/request-cache";
import { refreshAccessToken } from "../auth-bridge";

export function getObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function getStringField(value: unknown, field: string): string | null {
  const obj = getObject(value);
  const fieldValue = obj?.[field];
  return typeof fieldValue === "string" ? fieldValue : null;
}

/**
 * Timeout de cliente POR DEFECTO de toda petición al control plane. Sin él, una
 * petición que atraviesa el túnel SSH y se queda colgada (proxy caído, red que
 * cambia sin cortar el socket) NUNCA rechazaba: la pantalla se quedaba con el
 * spinner para siempre y ni siquiera se podía reintentar. 60s es holgado para
 * el peor caso del túnel; las operaciones LARGAS de verdad (instalar paquetes,
 * builds EAS) lo desactivan explícitamente con `timeoutMs: 0`.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

/** `RequestInit` + timeout de cliente (`0` = sin timeout). */
export type ApiRequestInit = RequestInit & { timeoutMs?: number };

/** Error de timeout de cliente. El mensaje contiene "timeout" a propósito:
 *  `localizeCommonError` lo cae en el bucket de error de red. */
export class RequestTimeoutError extends Error {
  constructor(path: string) {
    super(`Request timeout: ${path}`);
    this.name = "RequestTimeoutError";
  }
}

/**
 * `fetch` con timeout de cliente. Si el llamador ya trae su propio `signal`
 * (métricas, test-connection: tienen su propio presupuesto) se respeta tal cual
 * y no añadimos otro.
 */
async function fetchWithTimeout(url: string, path: string, init: ApiRequestInit, headers: Record<string, string>): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  const budget = timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (rest.signal || budget <= 0) return fetch(url, { ...rest, headers });
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, budget);
  try {
    return await fetch(url, { ...rest, headers, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError(path);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function request<T>(path: string, token: string, init?: ApiRequestInit, _retriedScope?: string, _retriedAuth = false): Promise<T> {
  const url = `${ENV.apiUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "x-client-platform": "app",
    ...(init?.headers ?? {}),
  } as Record<string, string>;

  const response = await fetchWithTimeout(url, path, init ?? {}, headers);
  // Parseo defensivo: un cuerpo VACÍO o NO-JSON (timeout/502/proxy caído cuando la
  // conexión SSH en background falla) hacía que `response.json()` lanzara
  // `SyntaxError: JSON Parse error` sin manejar. Caemos a `{}` y dejamos que el flujo
  // de error normal (abajo) lo trate como fallo de petición.
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Límite de peticiones (HTTP 429): anuncia globalmente el reintento para que
    // el modal global (RateLimitProvider) muestre la cuenta atrás. Es un aviso
    // fire-and-forget; igual lanzamos el error abajo para no romper el caller.
    if (response.status === 429) {
      emitRateLimited(parseRetryAfterSeconds(data, response.headers.get("Retry-After")));
    }
    // Sesión expirada (access JWT vencido) → renueva con el refresh token (sin
    // re-autenticar el proveedor) y reintenta UNA vez con el token nuevo.
    if (response.status === 401 && !_retriedAuth) {
      const fresh = await refreshAccessToken();
      if (fresh) {
        return request<T>(path, fresh, init, _retriedScope, true);
      }
    }
    // Gate 2FA: si el backend exige step-up para esta acción (según las
    // preferencias del usuario), responde 403 con code STEP_UP_REQUIRED + scope.
    // Pedimos el código TOTP (una vez por scope, cacheado ~5 min) y reintentamos
    // adjuntando el token. Centraliza el 2FA de TODAS las acciones en un punto.
    if (
      response.status === 403 &&
      getStringField(data, "code") === "STEP_UP_REQUIRED" &&
      getStringField(data, "scope") &&
      _retriedScope !== getStringField(data, "scope")
    ) {
      const scope = getStringField(data, "scope") as string;
      const stepUpToken = await promptStepUp(scope);
      if (stepUpToken) {
        return request<T>(
          path,
          token,
          { ...init, headers: { ...(init?.headers ?? {}), "X-Step-Up-Token": stepUpToken } },
          scope,
          _retriedAuth,
        );
      }
    }
    throw new Error(getStringField(data, "error") ?? "Request failed");
  }
  invalidateAfterMutation(path, init?.method ?? "GET");
  return data as T;
}


// ── Caché de LECTURAS del portal (TTL + single-flight) ──────────────────────
// Un `useMainTabController` POR PESTAÑA + pantallas que se remontan (carousel,
// drawer, chat, modales de cuenta) hacían salir el MISMO GET 3-5 veces en el
// arranque. Aquí se colapsan: la primera llamada vuela, las demás se le unen o
// leen memoria. Las claves llevan el token → cambiar de cuenta no cruza datos
// (y `store-reset` vacía el caché en el logout de todos modos).
export const readCache = createRequestCache();

export const TTL = {
  /** `/portal/me` — rol/límites del usuario: cambia rara vez. */
  me: 60_000,
  /** `/portal/licenses` — lista de paneles: el refresco explícito usa `force`. */
  panels: 15_000,
  /** Taxonomía (categorías/etiquetas) y llaves SSH: casi estáticas en sesión. */
  taxonomy: 300_000,
  sshKeys: 300_000,
  /** Branding/paleta del panel: estático salvo que se edite (se invalida al guardar). */
  branding: 600_000,
  /** Módulos permitidos del usuario SSH: cuesta un round-trip por el TÚNEL SSH. */
  modulePerms: 300_000,
  /** Tickets de soporte: `0` = SOLO dedupe. La bandeja debe reflejar la respuesta
   *  del admin en cuanto el usuario refresca, así que nunca se sirve de memoria;
   *  lo único que se evita es que N pestañas/paneles la pidan a la vez. */
  tickets: 0,
} as const;

/** Opciones comunes de las lecturas cacheadas: `force` = refresco explícito
 *  del usuario (pull-to-refresh / recargar) → salta la caché. */
export type ReadOptions = { force?: boolean };

/** Tira las lecturas cacheadas de la cuenta (tras editar el perfil/avatar). */
export function invalidateCurrentCustomer(): void {
  readCache.invalidatePrefix("me|");
}

/** Tira la lista de paneles cacheada (tras crear/editar/borrar un panel). */
export function invalidatePanelsCache(): void {
  readCache.invalidatePrefix("panels|");
}

/** Tira las lecturas cacheadas de un panel (branding, permisos de módulos). */
export function invalidatePanelCache(panelId: string): void {
  readCache.invalidateWhere((key) => key.includes(`|${panelId}|`));
}

/**
 * Invalidación AUTOMÁTICA tras una mutación con éxito. Va en el funnel de
 * `request`/`requestRaw` a propósito: si dependiera de que cada mutación se
 * acuerde de invalidar, una nueva se olvidaría y serviría datos rancios. Las
 * dos mutaciones que NO pasan por el funnel (multipart con `fetch` directo:
 * `configurePanelSsh`, `uploadAvatar`) invalidan a mano.
 */
function invalidateAfterMutation(path: string, method: string): void {
  if (method === "GET") return;
  const route = path.split("?")[0];
  // Branding de un panel concreto: `/portal/panels/<id>/branding`.
  const branding = /^\/portal\/panels\/([^/]+)\/branding$/.exec(route);
  if (branding) {
    readCache.invalidatePrefix(`branding|${branding[1]}|`);
    return;
  }
  if (route.startsWith("/portal/me")) invalidateCurrentCustomer();
  // Llaves SSH: cambian también la ficha del panel (sshKeyIds / panelsCount).
  if (route.startsWith("/portal/ssh-keys")) {
    readCache.invalidatePrefix("sshKeys|");
    invalidatePanelsCache();
  }
  // Categorías/etiquetas: cambian la taxonomía Y las etiquetas de los paneles.
  if (route.startsWith("/portal/panel-categories") || route.startsWith("/portal/panel-tags")) {
    readCache.invalidatePrefix("taxonomy|");
    invalidatePanelsCache();
  }
  if (route.startsWith("/portal/panels") || route.startsWith("/portal/licenses")) invalidatePanelsCache();
}

/** Like `request` but preserves status + structured body on non-2xx so the
 *  caller can handle the 409 host-fingerprint (TOFU) approval flow. */
export async function requestRaw(
  path: string,
  token: string,
  init?: ApiRequestInit,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${ENV.apiUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "x-client-platform": "app",
    ...(init?.headers ?? {}),
  } as Record<string, string>;
  const response = await fetchWithTimeout(url, path, init ?? {}, headers);
  const data: unknown = await response.json().catch(() => ({}));
  // Mismo aviso global de 429 que en `request`: este funnel preserva status/body
  // para el TOFU de huella, así que también debe disparar el modal global.
  if (response.status === 429) {
    emitRateLimited(parseRetryAfterSeconds(data, response.headers.get("Retry-After")));
  }
  const okFlag = response.ok && (data as { ok?: boolean })?.ok !== false;
  if (okFlag) invalidateAfterMutation(path, init?.method ?? "GET");
  return { ok: okFlag, status: response.status, data };
}
