// Bus de eventos para el límite de peticiones (HTTP 429). El cliente API y el
// verificador de actualizaciones emiten aquí cuando el backend responde 429; un
// único modal global (RateLimitModal) lo escucha y muestra el motivo + cuenta
// atrás. Se usa un CustomEvent en `window` para desacoplar la capa de red (no
// React) de la UI sin pasar callbacks por todo el árbol.

const EVENT = "lp:rate-limited";

export type RateLimitNotice = {
  /** Segundos hasta poder reintentar (según el backend). */
  retryAfter: number;
  /** Epoch (ms) en que se podrá reintentar. */
  retryAt: number;
};

/**
 * Saca los segundos de reintento de un 429: primero del body (`retryAfter`, que
 * el backend incluye porque el puente de Electron no expone cabeceras), y si no
 * de la cabecera estándar `Retry-After` (segundos o fecha HTTP). Cae a 60s.
 */
export function parseRetryAfterSeconds(body: unknown, header?: string | null): number {
  const fromBody = (body as { retryAfter?: unknown } | null)?.retryAfter;
  if (typeof fromBody === "number" && Number.isFinite(fromBody) && fromBody > 0) return Math.ceil(fromBody);
  if (typeof fromBody === "string" && /^\d+$/.test(fromBody.trim())) return parseInt(fromBody, 10);
  if (header) {
    const trimmed = header.trim();
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    const date = Date.parse(trimmed);
    if (!Number.isNaN(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }
  return 60;
}

/** Anuncia globalmente que una petición recibió 429. Lo escucha el modal global. */
export function emitRateLimited(retryAfter: number): void {
  if (typeof window === "undefined") return;
  const safe = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60;
  const detail: RateLimitNotice = { retryAfter: safe, retryAt: Date.now() + safe * 1000 };
  window.dispatchEvent(new CustomEvent<RateLimitNotice>(EVENT, { detail }));
}

/** Suscribe al aviso de 429. Devuelve la función para desuscribir. */
export function onRateLimited(handler: (notice: RateLimitNotice) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => handler((event as CustomEvent<RateLimitNotice>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
