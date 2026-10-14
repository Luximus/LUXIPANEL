import { ENV } from "../config/env";

/**
 * Conexión SSE persistente al backend LP-LS para notificaciones en background.
 *
 * El control plane expone `GET /portal/notifications/stream?access_token=<jwt>`
 * como un EventSource. Como `EventSource` no permite cabeceras, el token de la
 * sesión del portal viaja por query (el backend también acepta Authorization
 * Bearer, pero EventSource no lo soporta). Eventos emitidos:
 *   - `event: ready`         → el stream quedó conectado (handshake).
 *   - `event: notification`  → `data:` = JSON `{ title, body, data }`.
 *   - comentarios `: ping`   → heartbeats que EventSource ignora.
 *
 * Ante un corte (`onerror`) reconectamos con backoff exponencial acotado. La app
 * vive en bandeja, así que esta conexión sobrevive a la ventana oculta y dispara
 * un toast NATIVO de Windows vía `window.electronApi.notify` por cada evento.
 */

export type NotificationPayload = {
  title?: string;
  body?: string;
  data?: unknown;
};

export type NotificationStreamHandle = {
  /** Cierra el stream (logout / desmontaje) y cancela cualquier reconexión. */
  close: () => void;
};

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Abre (y mantiene) una conexión SSE de notificaciones para `token`. Cada evento
 * `notification` se reenvía a `onNotification` (por defecto, dispara el toast
 * nativo de Electron). Devuelve un handle con `close()` idempotente.
 *
 * Robustez: un solo `EventSource` activo a la vez; la reconexión por backoff se
 * cancela en `close()`; los `data` malformados se ignoran sin tumbar el stream.
 */
export function startNotificationStream(
  token: string,
  onNotification?: (payload: NotificationPayload) => void,
): NotificationStreamHandle {
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let closed = false;

  const fireToast = (payload: NotificationPayload) => {
    if (onNotification) {
      onNotification(payload);
      return;
    }
    const title = typeof payload.title === "string" ? payload.title : "LUXIPANEL";
    const body = typeof payload.body === "string" ? payload.body : "";
    // El toast nativo solo existe en el shell Electron; fuera de él (dev web)
    // se ignora silenciosamente.
    void window.electronApi?.notify({ title, body });
  };

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const teardownSource = () => {
    if (source) {
      try { source.close(); } catch { /* ignore */ }
      source = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (closed) return;
    teardownSource();

    const url = `${ENV.apiUrl}/portal/notifications/stream?access_token=${encodeURIComponent(token)}`;
    let es: EventSource;
    try {
      es = new EventSource(url);
    } catch {
      // Construcción fallida (URL/entorno) → reintenta con backoff.
      scheduleReconnect();
      return;
    }
    source = es;

    es.addEventListener("ready", () => {
      // Conectado: reinicia el backoff para que el próximo corte vuelva a probar
      // rápido.
      attempt = 0;
    });

    es.addEventListener("notification", (event) => {
      const raw = (event as MessageEvent).data;
      if (typeof raw !== "string" || !raw.trim()) return;
      try {
        const payload = JSON.parse(raw) as NotificationPayload;
        fireToast(payload);
      } catch {
        // Evento malformado: ignóralo, no tumbes el stream.
      }
    });

    es.onerror = () => {
      // EventSource intenta reconectar solo, pero su política no usa backoff y
      // puede martillar el backend. Lo cerramos y reconectamos con backoff.
      if (closed) return;
      teardownSource();
      scheduleReconnect();
    };
  };

  connect();

  return {
    close: () => {
      closed = true;
      clearReconnect();
      teardownSource();
    },
  };
}
