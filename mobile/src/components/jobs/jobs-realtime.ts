import Constants, { ExecutionEnvironment } from "expo-constants";

// Suscriptor de PUSH para el canal de un requerimiento (Fase 7 §D: realtime =
// push Expo + refetch, NO SSE — RN no trae EventSource). Reusa el MISMO guardado
// anti-ruido que `lib/notifications.ts` (en Expo Go el stack remoto fue removido
// y `require("expo-notifications")` escupe ERROR+WARN), cargando el módulo de
// forma perezosa solo fuera de Expo Go. El payload del backend es SOLO señal
// (`{ kind:"jobs_channel", requirementId }`); el contenido SIEMPRE se re-trae
// autenticado con `getChannelMessages`/`getGrants` — nunca se pinta del push.

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import("expo-notifications");

let cached: NotificationsModule | null | undefined;

function loadNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (isExpoGo) {
    cached = null;
    return null;
  }
  try {
    cached = require("expo-notifications") as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached ?? null;
}

/** Extrae los datos del payload de una notificación recibida (sin pintar nada). */
function extractData(notification: unknown): Record<string, unknown> | null {
  const req = (notification as { request?: { content?: { data?: unknown } } } | null)?.request;
  const data = req?.content?.data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

/**
 * Registra un listener de push mientras el canal del requerimiento esté montado.
 * Si llega una señal `kind:"jobs_channel"` para `requirementId`, invoca `onSignal`
 * (la pantalla hace el refetch autenticado). Devuelve una función de limpieza.
 * No-op seguro en Expo Go o si el módulo no carga.
 */
export function subscribeJobsChannelPush(
  requirementId: string,
  onSignal: () => void,
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};
  try {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = extractData(notification);
      if (!data) return;
      if (data.kind === "jobs_channel" && String(data.requirementId ?? "") === requirementId) {
        onSignal();
      }
    });
    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => {};
  }
}
