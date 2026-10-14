/**
 * directPanelSession — sesión persistida de la conexión DIRECTA (nativa) a un
 * panel del **directorio LP** (registro de servidores de la cuenta).
 *
 * A diferencia de `standaloneServers` (que mantiene su propia LISTA de boxes con
 * id local `sa-*`), aquí la clave es el **`panelId` del directorio** — el MISMO
 * id que usan las pantallas nativas y el registro directo de `serverApi`. Así el
 * botón "Conectar" de un panel puede reusar la sesión (reconexión un-tap) sin
 * duplicar el servidor en el gestor standalone.
 *
 * Sensibilidad: sesión (JWT+CSRF+exp), usuario Linux y contraseña (opt-in) van a
 * SecureStore (Keychain/Keystore) vía `secureStorage`. No hay metadatos en claro:
 * el panel ya existe en el directorio (AsyncStorage lo maneja `client`/cache).
 */
import { secureGetItem, secureSetItem, secureRemoveItem } from "./secureStorage";
import type { StoredSession } from "./standaloneServers";

const SESSION_KEY = (id: string) => `lp.app.directpanel.session.${id}`;
const PASSWORD_KEY = (id: string) => `lp.app.directpanel.pw.${id}`;
const USER_KEY = (id: string) => `lp.app.directpanel.user.${id}`;

/** Credenciales/sesión persistidas de un panel conectado en directo. */
export interface DirectPanelCreds {
  /** Usuario Linux con el que se autenticó (para re-login silencioso). */
  username: string;
  /** ¿La contraseña quedó guardada (opt-in) para reconexión un-tap? */
  savePassword: boolean;
}

/** Lee la sesión directa guardada de un panel (o null). */
export async function getDirectPanelSession(panelId: string): Promise<StoredSession | null> {
  const raw = await secureGetItem(SESSION_KEY(panelId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed?.jwt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Guarda/actualiza la sesión directa de un panel. */
export async function setDirectPanelSession(panelId: string, session: StoredSession): Promise<void> {
  await secureSetItem(SESSION_KEY(panelId), JSON.stringify(session));
}

/** Lee el usuario Linux guardado (o null). */
export async function getDirectPanelUsername(panelId: string): Promise<string | null> {
  return secureGetItem(USER_KEY(panelId));
}

/** Guarda (o borra con null/"") el usuario Linux. */
export async function setDirectPanelUsername(panelId: string, username: string | null): Promise<void> {
  if (!username) { await secureRemoveItem(USER_KEY(panelId)); return; }
  await secureSetItem(USER_KEY(panelId), username);
}

/** Lee la contraseña guardada (opt-in) o null. */
export async function getDirectPanelPassword(panelId: string): Promise<string | null> {
  return secureGetItem(PASSWORD_KEY(panelId));
}

/** Guarda (o borra con null/"") la contraseña opt-in. */
export async function setDirectPanelPassword(panelId: string, password: string | null): Promise<void> {
  if (password == null || password === "") { await secureRemoveItem(PASSWORD_KEY(panelId)); return; }
  await secureSetItem(PASSWORD_KEY(panelId), password);
}

/** ¿Hay una sesión directa persistida para este panel? (gate barato de un-tap). */
export async function hasDirectPanelSession(panelId: string): Promise<boolean> {
  return Boolean(await getDirectPanelSession(panelId));
}

/** Purga por completo sesión + usuario + contraseña de un panel (olvidar). */
export async function clearDirectPanel(panelId: string): Promise<void> {
  await secureRemoveItem(SESSION_KEY(panelId));
  await secureRemoveItem(USER_KEY(panelId));
  await secureRemoveItem(PASSWORD_KEY(panelId));
}
