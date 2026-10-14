import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Historial de COMANDOS ejecutados en el terminal nativo, POR PANEL (servidor).
 *
 * El terminal nativo (`buildTerminalHtml`) captura cada comando enviado al PTY y
 * lo publica al host RN, que lo persiste aquí (ring buffer, más reciente primero).
 * El tab "Historial" del drawer lo lista junto a las conversaciones del proveedor
 * IA activo; tocar un comando lo reejecuta en la consola. Espejo del
 * `terminal-history` (localStorage) del módulo terminal de LUXIPANEL.
 *
 * Todo en una sola clave (mapa panelId → comandos[]) para no multiplicar llaves.
 */
const KEY = "lp.app.terminalCommandHistory.v1";
const MAX = 200;

type Store = Record<string, string[]>;

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

export async function loadCommandHistory(panelId: string): Promise<string[]> {
  const all = await readAll();
  return all[panelId] ?? [];
}

/** Inserta un comando (deduplicado, más reciente primero, tope MAX). */
export async function pushCommandHistory(panelId: string, command: string): Promise<void> {
  const cmd = command.trim();
  if (!cmd) return;
  const all = await readAll();
  const prev = all[panelId] ?? [];
  const next = [cmd, ...prev.filter((c) => c !== cmd)].slice(0, MAX);
  await writeAll({ ...all, [panelId]: next });
}

/** Elimina un comando del historial del panel. */
export async function removeCommandHistory(panelId: string, command: string): Promise<void> {
  const all = await readAll();
  const prev = all[panelId];
  if (!prev) return;
  await writeAll({ ...all, [panelId]: prev.filter((c) => c !== command) });
}
