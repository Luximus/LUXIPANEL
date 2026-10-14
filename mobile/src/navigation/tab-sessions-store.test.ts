import { describe, it, expect, beforeEach } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  __resetTabSessionsForTests,
  closeTab,
  getTabSessions,
  hydrateTabSessions,
  openNewTab,
  renameTab,
  setActiveTab,
  setTabAutoLabel,
  updateTabChatRoute,
  updateTabSession,
} from "./tab-sessions-store";

const KEY = "lp.app.tabs.v2";

/** Deja pasar el persistTabs fire-and-forget del store. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetTabSessionsForTests();
});

describe("hydrateTabSessions", () => {
  it("sin persistencia: queda el default (fija 'Servers') y marca hydrated", async () => {
    await hydrateTabSessions();
    const s = getTabSessions();
    expect(s.hydrated).toBe(true);
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0]).toMatchObject({ id: "tab-1", fixed: true, autoLabel: "Servers", autoConnect: false });
  });

  it("carga lo persistido reparando la pestaña fija (primera y marcada)", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({
      tabs: [{ id: "a", autoLabel: "Uno" }, { id: "b", autoLabel: "Dos", customLabel: "Mía" }],
      activeTabId: "b",
    }));
    await hydrateTabSessions();
    const s = getTabSessions();
    expect(s.tabs.map((t) => t.id)).toEqual(["a", "b"]);
    expect(s.tabs[0]).toMatchObject({ fixed: true, autoLabel: "Servers", autoConnect: false });
    expect(s.tabs[1].fixed).toBe(false);
    expect(s.activeTabId).toBe("b");
  });

  it("es idempotente: una segunda llamada no pisa mutaciones posteriores", async () => {
    await hydrateTabSessions();
    const id = openNewTab();
    await hydrateTabSessions();
    expect(getTabSessions().tabs.some((t) => t.id === id)).toBe(true);
  });
});

describe("mutaciones", () => {
  beforeEach(async () => {
    await hydrateTabSessions();
  });

  it("openNewTab crea, activa y persiste la pestaña nueva", async () => {
    const id = openNewTab();
    expect(getTabSessions().activeTabId).toBe(id);
    await flush();
    const persisted = JSON.parse((await AsyncStorage.getItem(KEY))!);
    expect(persisted.tabs.some((t: { id: string }) => t.id === id)).toBe(true);
  });

  it("setActiveTab ignora ids inexistentes", () => {
    setActiveTab("nope");
    expect(getTabSessions().activeTabId).toBe("tab-1");
  });

  it("closeTab no cierra la fija ni la última; al cerrar la activa salta a otra", () => {
    closeTab("tab-1");
    expect(getTabSessions().tabs).toHaveLength(1);
    const id = openNewTab();
    closeTab(id);
    const s = getTabSessions();
    expect(s.tabs).toHaveLength(1);
    expect(s.activeTabId).toBe("tab-1");
  });

  it("renameTab fija/borra customLabel (vacío vuelve al auto-rótulo)", () => {
    renameTab("tab-1", "  Mi server  ");
    expect(getTabSessions().tabs[0].customLabel).toBe("Mi server");
    renameTab("tab-1", "   ");
    expect(getTabSessions().tabs[0].customLabel).toBeUndefined();
  });

  it("setTabAutoLabel actualiza solo si cambia (guard de identidad)", () => {
    const before = getTabSessions();
    setTabAutoLabel("tab-1", "Servers");
    expect(getTabSessions()).toBe(before);
    setTabAutoLabel("tab-1", "Panel X");
    expect(getTabSessions().tabs[0].autoLabel).toBe("Panel X");
  });

  it("updateTabSession escribe restoreView/sshUrl/panelId y no re-emite sin cambios", () => {
    updateTabSession("tab-1", { view: "ssh", sshUrl: "ssh://x", panelId: "p1" });
    expect(getTabSessions().tabs[0]).toMatchObject({ restoreView: "ssh", restoreSshUrl: "ssh://x", restorePanelId: "p1" });
    const before = getTabSessions();
    updateTabSession("tab-1", { view: "ssh", sshUrl: "ssh://x", panelId: "p1" });
    expect(getTabSessions()).toBe(before);
  });

  it("updateTabChatRoute persiste el panel del chat abierto y lo limpia con null", async () => {
    updateTabChatRoute("tab-1", "panel-7");
    expect(getTabSessions().tabs[0].restoreChatPanelId).toBe("panel-7");
    await flush();
    let persisted = JSON.parse((await AsyncStorage.getItem(KEY))!);
    expect(persisted.tabs[0].restoreChatPanelId).toBe("panel-7");
    updateTabChatRoute("tab-1", null);
    expect(getTabSessions().tabs[0].restoreChatPanelId).toBeUndefined();
    await flush();
    persisted = JSON.parse((await AsyncStorage.getItem(KEY))!);
    expect(persisted.tabs[0]).not.toHaveProperty("restoreChatPanelId");
  });
});
