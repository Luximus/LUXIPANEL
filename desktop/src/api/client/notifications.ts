import { request } from "./request";

/** Perfil PÚBLICO de otro cliente (drawer "compartido por X"): solo datos no
 *  sensibles. Gateado por relación de compartición en el backend. */
export interface PublicProfile {
  id: string;
  name: string | null;
  company: string | null;
  photoUrl: string | null;
}

/** Lee el perfil público de un usuario (por id). 403 si no hay relación. */
export async function getPublicProfile(userId: string, token: string): Promise<PublicProfile> {
  const result = await request<{ ok: boolean; data: PublicProfile }>(
    `/portal/users/${encodeURIComponent(userId)}/public-profile`,
    token,
  );
  return result.data;
}

// ─── Historial de notificaciones (toasts en background) ───────────────────
// Espejo del contrato LP-LS: GET /portal/notifications/log?limit=100 →
// { ok, data: [{ id, panelId, panelName, title, body, signals, createdAt }] }.
// Las `signals` clasifican el evento (mismo set que la app móvil:
// status/cpu/ram/disk/mb/access) para pintar el icono correspondiente.
export type NotificationLogEntry = {
  id: string;
  panelId: string | null;
  panelName: string | null;
  title: string;
  body: string;
  signals: string[];
  createdAt: string;
};

/** Lee el historial de notificaciones del usuario (recientes primero, según el
 *  backend). Devuelve [] ante cualquier fallo — nunca lanza. */
export async function getNotificationLog(token: string, limit = 100): Promise<NotificationLogEntry[]> {
  try {
    const data = await request<{ ok?: boolean; data?: Array<Record<string, unknown>> }>(
      `/portal/notifications/log?limit=${limit}`,
      token,
    );
    const rows = Array.isArray(data?.data) ? data.data : [];
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      panelId: typeof r.panelId === "string" ? r.panelId : null,
      panelName: typeof r.panelName === "string" ? r.panelName : null,
      title: typeof r.title === "string" ? r.title : "",
      body: typeof r.body === "string" ? r.body : "",
      signals: Array.isArray(r.signals) ? r.signals.filter((s): s is string => typeof s === "string") : [],
      createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
    }));
  } catch {
    return [];
  }
}
