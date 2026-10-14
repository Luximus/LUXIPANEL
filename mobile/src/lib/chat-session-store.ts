import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerStoreReset } from "./store-reset";

/**
 * Persistencia A DISCO del hilo de chat activo POR PANEL (conversación + proveedor).
 *
 * En segundo plano normal basta el `CHAT_STORE` en memoria del pane (sobrevive
 * mientras el SO no mate el proceso). Esto cubre el caso duro: si el SO descarta
 * la app (presión de memoria / cierre total), al relanzar el pane reabre el mismo
 * hilo en vez de arrancar vacío — "encontrarlo tal cual venía trabajando".
 *
 * Se guarda todo en una sola clave (mapa panelId → sesión) para no multiplicar
 * llaves de AsyncStorage. La conversación en sí ya vive en el servidor
 * (LUXIPANEL, conversaciones "decoupled"); aquí solo persiste a CUÁL reenganchar.
 */
const KEY = "lp.app.chatSessions.v1";

export type PersistedChatSession = {
  conversationId: string | null;
  provider: string;
};

type Store = Record<string, PersistedChatSession>;

let cache: Store | null = null;

async function readAll(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function writeAll(store: Store): Promise<void> {
  cache = store;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage lleno / no disponible — ignorar */
  }
}

export async function loadChatSession(panelId: string): Promise<PersistedChatSession | null> {
  const all = await readAll();
  return all[panelId] ?? null;
}

export async function saveChatSession(panelId: string, session: PersistedChatSession): Promise<void> {
  const all = await readAll();
  const cur = all[panelId];
  if (cur && cur.conversationId === session.conversationId && cur.provider === session.provider) return;
  await writeAll({ ...all, [panelId]: session });
}

// Higiene de sesión: los `conversationId` por panel son datos del usuario
// saliente; sin esto quedarían en disco tras el logout y el siguiente login
// intentaría reenganchar hilos de otra cuenta. El borrado de disco es
// best-effort (mismo contrato que writeAll); la caché en memoria se vacía ya.
registerStoreReset(() => {
  cache = {};
  void AsyncStorage.removeItem(KEY);
});
