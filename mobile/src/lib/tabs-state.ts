import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppTab, View } from "../features/app/types";

// v2 (B3): añade `restoreChatPanelId` (pantalla `Chat` apilada) al estado por
// pestaña. La clave cambia de versión y `loadPersistedTabs` migra la v1 en
// caliente (una sola vez: la persiste como v2 y borra la clave vieja).
const KEY = "lp.app.tabs.v2";
const LEGACY_KEY_V1 = "lp.app.tabs.v1";

export type PersistedTabsState = {
  tabs: AppTab[];
  activeTabId: string;
};

export type TabSession = {
  view: View;
  sshUrl: string;
  panelId: string | null;
};

const VALID_VIEWS: View[] = ["splash", "login", "loading-panel", "dashboard", "support", "security", "ssh"];

function isValidView(value: unknown): value is View {
  return typeof value === "string" && (VALID_VIEWS as string[]).includes(value);
}

function sanitizeTab(raw: unknown): AppTab | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const tab: AppTab = {
    id: r.id,
    autoLabel: typeof r.autoLabel === "string" && r.autoLabel ? r.autoLabel : "Servers",
  };
  if (typeof r.customLabel === "string" && r.customLabel) tab.customLabel = r.customLabel;
  if (typeof r.autoConnect === "boolean") tab.autoConnect = r.autoConnect;
  if (r.fixed === true) tab.fixed = true;
  // Legacy tabs may still point at the old embedded panel. Resume at the
  // native server dashboard instead of reopening an official module WebView.
  if (r.restoreView === "ssh") tab.restoreView = "dashboard";
  else if (isValidView(r.restoreView)) tab.restoreView = r.restoreView;
  if (r.restoreView !== "ssh" && typeof r.restoreSshUrl === "string" && r.restoreSshUrl) tab.restoreSshUrl = r.restoreSshUrl;
  if (typeof r.restorePanelId === "string" && r.restorePanelId) tab.restorePanelId = r.restorePanelId;
  if (typeof r.restoreChatPanelId === "string" && r.restoreChatPanelId) tab.restoreChatPanelId = r.restoreChatPanelId;
  return tab;
}

function parsePersisted(raw: string | null): PersistedTabsState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const list = Array.isArray((parsed as { tabs?: unknown }).tabs) ? (parsed as { tabs: unknown[] }).tabs : [];
    const tabs = list.map(sanitizeTab).filter((tab): tab is AppTab => tab !== null);
    if (tabs.length === 0) return null;
    const activeRaw = (parsed as { activeTabId?: unknown }).activeTabId;
    const activeTabId = typeof activeRaw === "string" && tabs.some((tab) => tab.id === activeRaw)
      ? activeRaw
      : tabs[0].id;
    return { tabs, activeTabId };
  } catch {
    return null;
  }
}

export async function loadPersistedTabs(): Promise<PersistedTabsState | null> {
  try {
    const current = parsePersisted(await AsyncStorage.getItem(KEY));
    if (current) return current;
    // Migración v1 → v2 (una sola vez): mismo shape, sin `restoreChatPanelId`.
    const legacy = parsePersisted(await AsyncStorage.getItem(LEGACY_KEY_V1));
    if (!legacy) return null;
    await persistTabs(legacy);
    // La v1 se borra SOLO tras VERIFICAR (read-back) que la v2 quedó escrita
    // con el mismo contenido: `persistTabs` traga errores (storage lleno /
    // no disponible) y borrar la v1 sin la v2 persistida perdería las pestañas
    // para siempre. Si la escritura falló, se conserva la v1 y la migración se
    // reintenta en el próximo arranque.
    const migrated = parsePersisted(await AsyncStorage.getItem(KEY));
    if (migrated && JSON.stringify(migrated) === JSON.stringify(legacy)) {
      try {
        await AsyncStorage.removeItem(LEGACY_KEY_V1);
      } catch {
        // v1 residual: inofensiva, la v2 ya tiene prioridad al cargar.
      }
    }
    return legacy;
  } catch {
    return null;
  }
}

export async function persistTabs(state: PersistedTabsState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

export async function clearPersistedTabs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
    await AsyncStorage.removeItem(LEGACY_KEY_V1);
  } catch {
    /* ignore */
  }
}
