import type { AppTab, View } from "../features/app/types";

const KEY = "lp.desktop.tabs.v1";

export type PersistedTabsState = {
  tabs: AppTab[];
  activeTabId: string;
};

export type TabSession = {
  view: View;
  sshUrl: string;
  panelId: string | null;
};

const VALID_VIEWS: View[] = ["splash", "login", "loading-panel", "dashboard", "support", "ssh"];

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
  if (isValidView(r.restoreView)) tab.restoreView = r.restoreView;
  // v1 stored SSO handoff URLs with one-use tickets. Discard them on migration.
  if (typeof r.restorePanelId === "string" && r.restorePanelId) tab.restorePanelId = r.restorePanelId;
  return tab;
}

export function loadPersistedTabs(): PersistedTabsState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const list = Array.isArray((parsed as { tabs?: unknown }).tabs) ? (parsed as { tabs: unknown[] }).tabs : [];
    const tabs = list.map(sanitizeTab).filter((tab): tab is AppTab => tab !== null);
    if (tabs.length === 0) return null;
    const activeRaw = (parsed as { activeTabId?: unknown }).activeTabId;
    const activeTabId = typeof activeRaw === "string" && tabs.some((tab) => tab.id === activeRaw)
      ? activeRaw
      : tabs[0].id;
    const state = { tabs, activeTabId };
    if (list.some((entry) => entry && typeof entry === "object" && "restoreSshUrl" in entry)) persistTabs(state);
    return state;
  } catch {
    return null;
  }
}

export function persistTabs(state: PersistedTabsState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      ...state,
      tabs: state.tabs.map((tab) => { const next = { ...tab }; delete next.restoreSshUrl; return next; }),
    }));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

export function clearPersistedTabs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
