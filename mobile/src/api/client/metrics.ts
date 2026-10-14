import { request, requestRaw } from "./request";

/** Disponibilidad de las métricas EN VIVO (CPU/RAM/disco). El tráfico acumulado
 *  (4ª tarjeta) viene de la DB y se devuelve siempre, aun con el host offline. */
export type ServerMetricsLiveStatus = "ok" | "no_credentials" | "fingerprint_pending" | "unreachable";

/** Métricas del servidor de un panel. CPU/RAM/disco son nulos cuando no hay
 *  credenciales/huella o el host no responde; `traffic` (datos consumidos por el
 *  gateway con ese servidor) está siempre presente. */
export type ServerMetrics = {
  cpu: { percent: number; cores: number; load1: number } | null;
  ram: { usedBytes: number; totalBytes: number; percent: number } | null;
  disk: { usedBytes: number; totalBytes: number; percent: number } | null;
  traffic: { usedBytes: number };
  /** Usuarios Linux conectados al servidor (sesiones de login activas vía `who`),
   *  deduplicados por usuario. `null` cuando el sondeo no corrió (servidor sin
   *  `who` o payload de una versión anterior del backend). */
  connectedUsers?: { count: number; users: Array<{ name: string; sessions: number }> } | null;
  liveStatus: ServerMetricsLiveStatus;
  at: string;
};

export type ServerMetricsResult =
  | { ok: true; metrics: ServerMetrics }
  | { ok: false };

/**
 * Lee métricas del servidor del panel (POST /portal/ssh/metrics). Nunca lanza:
 * el backend siempre responde con `traffic` y un `liveStatus`; sólo devolvemos
 * `{ ok:false }` ante un fallo de red/HTTP real.
 */
export async function getServerMetrics(panelId: string, token: string): Promise<ServerMetricsResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await requestRaw(`/portal/ssh/metrics`, token, {
      method: "POST",
      body: JSON.stringify({ panelId }),
      signal: controller.signal,
    });
    const body = result.data as { ok?: boolean; data?: ServerMetrics } | null;
    if (result.ok && body?.data) {
      return { ok: true, metrics: body.data };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Aprueba (TOFU) la huella SSH pendiente del servidor de un panel para habilitar
 *  métricas/asistente. Devuelve `{ok:true}` si quedó aprobada. Mismo contrato
 *  que web (`server-assistant.ts`) y desktop (`approvePanelFingerprint`). */
export async function approvePanelFingerprint(panelId: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await requestRaw(`/portal/ssh/fingerprint/approve`, token, {
      method: "POST",
      body: JSON.stringify({ panelId }),
    });
    const body = result.data as { ok?: boolean; error?: string; code?: string } | null;
    if (result.ok && body?.ok) return { ok: true };
    return { ok: false, error: body?.error || body?.code || `HTTP ${result.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

/** Registra el token Expo de este dispositivo para recibir push (monitoreo de
 *  servidores en background). Fire-and-forget: nunca lanza. */
export async function registerPushToken(token: string, expoPushToken: string, platform = "android"): Promise<void> {
  try {
    await request(`/portal/push/register`, token, {
      method: "POST",
      body: JSON.stringify({ token: expoPushToken, platform }),
    });
  } catch {
    /* el registro de push no debe romper el flujo de login */
  }
}

/** Da de baja el token Expo (logout). Fire-and-forget. */
export async function unregisterPushToken(token: string, expoPushToken: string): Promise<void> {
  try {
    await request(`/portal/push/register`, token, {
      method: "DELETE",
      body: JSON.stringify({ token: expoPushToken }),
    });
  } catch {
    /* best-effort */
  }
}
