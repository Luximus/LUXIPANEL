// Bus de eventos para el límite de peticiones (HTTP 429). El cliente API emite
// aquí cuando el backend responde 429; un único modal global (RateLimitProvider)
// lo escucha y muestra el motivo + cuenta atrás. RN no tiene `window`, así que en
// vez de un CustomEvent usamos un emisor a nivel de módulo (Set de listeners),
// el mismo patrón RN-safe que `useTheme`. Desacopla la capa de red (no React) de
// la UI sin pasar callbacks por todo el árbol. Espejo del bus del desktop.

export type RateLimitNotice = {
  /** Segundos hasta poder reintentar (según el backend). */
  retryAfter: number;
  /** Epoch (ms) en que se podrá reintentar. */
  retryAt: number;
};

type Listener = (notice: RateLimitNotice) => void;

const listeners = new Set<Listener>();

/**
 * Saca los segundos de reintento de un 429: primero del body (`retryAfter`), y
 * si no de la cabecera estándar `Retry-After` (segundos o fecha HTTP). Cae a 60s.
 * Idéntico al parser del desktop para mantener el mismo contrato con el backend.
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
  const safe = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60;
  const notice: RateLimitNotice = { retryAfter: safe, retryAt: Date.now() + safe * 1000 };
  listeners.forEach((listener) => listener(notice));
}

/** Suscribe al aviso de 429. Devuelve la función para desuscribir. */
export function onRateLimited(handler: Listener): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}
