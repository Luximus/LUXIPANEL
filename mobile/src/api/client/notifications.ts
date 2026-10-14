import { request } from "./request";

/** Preferencias de notificaciones de un servidor (1 fila por panel). Espejo de
 *  la tabla `panel_notification_prefs` del backend. */
export interface PanelNotificationPrefs {
  enabled: boolean;
  statusEnabled: boolean;
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  accessEnabled: boolean;
}

/** Entrada del historial de notificaciones enviadas (tab "Registro"). Espejo de
 *  la tabla `panel_notification_log` del backend. */
export interface NotificationLogEntry {
  id: string;
  panelId: string | null;
  panelName: string | null;
  title: string;
  body: string;
  signals: string[];
  createdAt: string;
}

/** Historial de notificaciones del cliente (todos sus paneles), recientes primero. */
export async function getNotificationLog(token: string, limit = 100): Promise<NotificationLogEntry[]> {
  const result = await request<{ ok: boolean; data: NotificationLogEntry[] }>(
    `/portal/notifications/log?limit=${limit}`,
    token,
  );
  return Array.isArray(result.data) ? result.data : [];
}

/** Perfil PÚBLICO de otro cliente (drawer "compartido por X"): solo datos no
 *  sensibles (sin email/teléfono/saldos). Gateado por relación en el backend. */
export interface PublicProfile {
  id: string;
  name: string | null;
  company: string | null;
  photoUrl: string | null;
}

/** Lee el perfil público de un usuario (por id). Requiere relación de
 *  compartición aceptada (el backend devuelve 403 si no la hay). */
export async function getPublicProfile(userId: string, token: string): Promise<PublicProfile> {
  const result = await request<{ ok: boolean; data: PublicProfile }>(
    `/portal/users/${encodeURIComponent(userId)}/public-profile`,
    token,
  );
  return result.data;
}

/** Lee las preferencias de notificaciones de un panel (crea defaults si no existen). */
export async function getPanelNotificationPrefs(panelId: string, token: string): Promise<PanelNotificationPrefs> {
  const result = await request<{ ok: boolean; data: PanelNotificationPrefs }>(
    `/portal/panels/${panelId}/notification-prefs`,
    token,
  );
  return result.data;
}

/** Actualiza (parcial) las preferencias de notificaciones de un panel. */
export async function updatePanelNotificationPrefs(
  panelId: string,
  patch: Partial<PanelNotificationPrefs>,
  token: string,
): Promise<PanelNotificationPrefs> {
  const result = await request<{ ok: boolean; data: PanelNotificationPrefs }>(
    `/portal/panels/${panelId}/notification-prefs`,
    token,
    { method: "PUT", body: JSON.stringify(patch) },
  );
  return result.data;
}
