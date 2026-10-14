import { requestRaw } from "./request";

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
  try {
    const result = await requestRaw(`/portal/ssh/metrics`, token, {
      method: "POST",
      body: JSON.stringify({ panelId }),
    });
    const body = result.data as { ok?: boolean; data?: ServerMetrics } | null;
    if (result.ok && body?.data) {
      return { ok: true, metrics: body.data };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Aprueba (TOFU) la huella SSH pendiente del servidor de un panel para habilitar
 *  métricas/asistente. Devuelve true si quedó aprobada. */
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
