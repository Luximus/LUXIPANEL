/**
 * standaloneServers — registro persistido de servidores LUXIPANEL **standalone**
 * gestionados por conexión DIRECTA (sin LP-LS de puente).
 *
 * Separación por sensibilidad:
 *  - **Metadatos** (id/name/baseUrl/username/savePassword) → AsyncStorage
 *    (`lp.app.standaloneServers.v1`): no son secretos y deben listarse rápido.
 *  - **Sesión** (JWT + CSRF + exp) y **contraseña** (opt-in) → SecureStore
 *    (Keychain/Keystore) vía `secureStorage` (cifrado en reposo). El JWT es un
 *    bearer; la contraseña permite re-login silencioso al vencer la sesión.
 *
 * El `id` es un UUID local (no viene del box): identifica el servidor en el
 * registro directo de `serverApi` y en el overlay nativo.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { secureGetItem, secureSetItem, secureRemoveItem } from "./secureStorage";

const LIST_KEY = "lp.app.standaloneServers.v1";
const SESSION_KEY = (id: string) => `lp.app.standalone.session.${id}`;
const PASSWORD_KEY = (id: string) => `lp.app.standalone.pw.${id}`;

/** Metadato NO sensible de un servidor standalone (lo que se lista). */
export interface StandaloneServer {
  id: string;
  name: string;
  /** Origen normalizado (sin barra final ni `/api`). */
  baseUrl: string;
  username: string;
  /** ¿Guardar la contraseña en SecureStore para re-login silencioso? */
  savePassword: boolean;
}

/** Sesión persistida (espejo de las cookies del panel). */
export interface StoredSession {
  jwt: string;
  csrf: { name: string; value: string } | null;
  exp: number;
}

interface ListStore {
  servers: StandaloneServer[];
}

let cache: ListStore | null = null;

async function readAll(): Promise<ListStore> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cache = parsed && Array.isArray(parsed.servers) ? (parsed as ListStore) : { servers: [] };
  } catch {
    cache = { servers: [] };
  }
  return cache;
}

async function writeAll(store: ListStore): Promise<void> {
  cache = store;
  try {
    await AsyncStorage.setItem(LIST_KEY, JSON.stringify(store));
  } catch {
    /* storage lleno / no disponible — best-effort */
  }
}

/** Lista los servidores standalone registrados (metadatos, sin secretos). */
export async function listStandaloneServers(): Promise<StandaloneServer[]> {
  const all = await readAll();
  return all.servers.map((s) => ({ ...s }));
}

/** Añade un servidor; devuelve el registro creado (con su `id` nuevo). */
export async function addStandaloneServer(input: {
  name: string;
  baseUrl: string;
  username: string;
  savePassword: boolean;
  password?: string;
  session?: StoredSession;
}): Promise<StandaloneServer> {
  const all = await readAll();
  const server: StandaloneServer = {
    id: `sa-${Crypto.randomUUID()}`,
    name: input.name.trim() || input.baseUrl,
    baseUrl: input.baseUrl,
    username: input.username,
    savePassword: input.savePassword,
  };
  await writeAll({ servers: [...all.servers, server] });
  if (input.session) await setStandaloneSession(server.id, input.session);
  if (input.savePassword && input.password) await setStandalonePassword(server.id, input.password);
  return server;
}

/** Actualiza metadatos de un servidor (merge superficial). */
export async function updateStandaloneServer(id: string, patch: Partial<Omit<StandaloneServer, "id">>): Promise<void> {
  const all = await readAll();
  await writeAll({ servers: all.servers.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}

/** Elimina un servidor y purga su sesión y contraseña del SecureStore. */
export async function removeStandaloneServer(id: string): Promise<void> {
  const all = await readAll();
  await writeAll({ servers: all.servers.filter((s) => s.id !== id) });
  await secureRemoveItem(SESSION_KEY(id));
  await secureRemoveItem(PASSWORD_KEY(id));
}

/** Lee la sesión guardada (o null si no hay / corrupta). */
export async function getStandaloneSession(id: string): Promise<StoredSession | null> {
  const raw = await secureGetItem(SESSION_KEY(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed?.jwt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Guarda/actualiza la sesión de un servidor. */
export async function setStandaloneSession(id: string, session: StoredSession): Promise<void> {
  await secureSetItem(SESSION_KEY(id), JSON.stringify(session));
}

/** Lee la contraseña guardada (opt-in) o null. */
export async function getStandalonePassword(id: string): Promise<string | null> {
  return secureGetItem(PASSWORD_KEY(id));
}

/** Guarda (o borra, con `null`) la contraseña opt-in. */
export async function setStandalonePassword(id: string, password: string | null): Promise<void> {
  if (password == null || password === "") {
    await secureRemoveItem(PASSWORD_KEY(id));
    return;
  }
  await secureSetItem(PASSWORD_KEY(id), password);
}

export async function clearStandaloneSession(id: string): Promise<void> { await secureRemoveItem(SESSION_KEY(id)); await secureRemoveItem(PASSWORD_KEY(id)); }
