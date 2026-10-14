/**
 * Lazy wrapper around expo-notifications. In Expo Go (SDK 53+) the remote
 * notification stack was removed and importing the module logs a noisy
 * ERROR + WARN at startup. By gating the import behind an Expo-Go check we
 * avoid the noise; in development clients and built APKs the module loads
 * normally and notifications work.
 */
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { registerPushToken, unregisterPushToken } from "../api/client";
import { callServerApi, getDirect } from "../api/serverApi";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Datos (`content.data`) que viajan en una push del servidor. El backend manda
 *  `{ panelId, type, url }` (server-monitor.service / jobs.controller). */
export type NotificationTapData = {
  panelId?: string;
  type?: string;
  url?: string;
  [key: string]: unknown;
};

/** projectId de EAS (necesario para `getExpoPushTokenAsync`). Vive en app config. */
function resolveProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

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

export function setupNotificationHandler(): void {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    /* permission denial is non-fatal */
  }
}

/**
 * Registra este dispositivo para PUSH remoto (monitoreo de servidores en
 * background). Pide permiso, obtiene el token Expo (`getExpoPushTokenAsync`) y lo
 * sube al backend (`POST /portal/push/register`). Requiere un build EAS (en Expo
 * Go el stack remoto no existe → no-op). Fire-and-forget: nunca lanza.
 *
 * Llamar tras el login, cuando ya hay token de portal.
 */
export async function registerForPushNotifications(portalToken: string): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications || !portalToken) return;
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.ios?.status === 2; // 2 = PROVISIONAL
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted || req.ios?.status === 2;
    }
    if (!granted) return;

    // Canal Android (requerido para que el sistema muestre las push).
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => undefined);
    }

    // El projectId de EAS vive en app config (extra.eas.projectId).
    const projectId = resolveProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoPushToken = tokenResponse?.data;
    if (!expoPushToken) return;

    await registerPushToken(portalToken, expoPushToken, Platform.OS === "ios" ? "ios" : "android");
  } catch {
    /* push registration es best-effort; no debe romper el login */
  }
}

/**
 * Desregistra ESTE dispositivo del push remoto. Llamar al CERRAR SESIÓN para que
 * un teléfono que cambió de cuenta no siga recibiendo las push de la cuenta
 * anterior. Re-obtiene el token Expo del dispositivo (mismo que en el registro) y
 * pega `DELETE /portal/push/register`. Best-effort: nunca lanza.
 */
export async function unregisterForPushNotifications(portalToken: string): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications || !portalToken) return;
  try {
    const projectId = resolveProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoPushToken = tokenResponse?.data;
    if (!expoPushToken) return;
    await unregisterPushToken(portalToken, expoPushToken);
  } catch {
    /* unregister es best-effort; no debe romper el logout */
  }
}

/** Register an Expo token with the directly connected panel account. */
export async function registerForPanelPushNotifications(panelId: string): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications || !getDirect(panelId)) return;
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.ios?.status === 2;
    if (!granted) {
      const request = await Notifications.requestPermissionsAsync();
      granted = request.granted || request.ios?.status === 2;
    }
    if (!granted) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "General", importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => undefined);
    }
    const projectId = resolveProjectId();
    const response = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (response?.data) await callServerApi(panelId, "", "POST", "/api/server-alerts/devices/mobile", { token: response.data, panelId });
  } catch {
    /* Permission denial and offline panels must not interrupt connecting. */
  }
}

/** Remove this device from a direct panel before forgetting that panel. */
export async function unregisterForPanelPushNotifications(panelId: string): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications || !getDirect(panelId)) return;
  try {
    const projectId = resolveProjectId();
    const response = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (response?.data) await callServerApi(panelId, "", "DELETE", "/api/server-alerts/devices/mobile", { value: response.data });
  } catch {
    /* Best effort; disconnect remains possible offline. */
  }
}

/**
 * Suscribe el TAP de una notificación (usuario tocó la push). Devuelve una función
 * para desuscribir. En Expo Go es no-op. Lo consume MainScreen para llevar al
 * carousel y enfocar el servidor de la push (`data.panelId`).
 */
export function addNotificationTapListener(handler: (data: NotificationTapData) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response?.notification?.request?.content?.data ?? {}) as NotificationTapData;
    handler(data);
  });
  return () => sub.remove();
}

/**
 * Lee la notificación que ABRIÓ la app desde estado cerrado (cold start). Se llama
 * una vez al montar para hacer el deep-link inicial. Devuelve null si la app no se
 * abrió desde una push.
 */
export async function getInitialNotificationTap(): Promise<NotificationTapData | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    return (response.notification?.request?.content?.data ?? {}) as NotificationTapData;
  } catch {
    return null;
  }
}

export async function scheduleLocalNotification(content: { title: string; body: string }): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  } catch {
    /* swallow — local notification failures shouldn't break the UI */
  }
}
