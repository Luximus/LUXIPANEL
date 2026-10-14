import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Configuración de los BOTONES FLOTANTES de los bordes del webview de módulo,
 * POR SERVIDOR (panelId). Cada lado (izquierdo/derecho) guarda los ids de
 * módulos/herramientas que el usuario fijó como acceso rápido (además de los
 * botones FIJOS: Más opciones + Regresar en el izq, abrir-drawer-derecho en el der).
 *
 * La config de un servidor aplica a TODAS sus vistas de módulo (todos sus webviews).
 * Todo en una sola clave (mapa panelId → config) para no multiplicar llaves.
 */
const KEY = "lp.app.moduleFloatingButtons.v1";

export type FloatingButtonsConfig = { left: string[]; right: string[] };

/** Selección por defecto: las herramientas (Asistente IA · Terminal) en el lado
 *  derecho, igual que los botones flotantes que ya existían. */
export const DEFAULT_FLOATING_BUTTONS: FloatingButtonsConfig = { left: [], right: ["assistant", "terminal"] };

type Store = Record<string, FloatingButtonsConfig>;

let cache: Store | null = null;

function sanitize(value: unknown): FloatingButtonsConfig {
  const v = value as Partial<FloatingButtonsConfig> | null;
  const arr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);
  return { left: arr(v?.left), right: arr(v?.right) };
}

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

/** Config del servidor, o el DEFAULT si nunca se configuró. */
export async function loadFloatingButtons(panelId: string): Promise<FloatingButtonsConfig> {
  const all = await readAll();
  const cfg = all[panelId];
  return cfg ? sanitize(cfg) : { ...DEFAULT_FLOATING_BUTTONS };
}

export async function saveFloatingButtons(panelId: string, cfg: FloatingButtonsConfig): Promise<void> {
  const all = await readAll();
  await writeAll({ ...all, [panelId]: sanitize(cfg) });
}
