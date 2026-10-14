import { describe, it, expect } from "vitest";
import { loadPersistedTabs, persistTabs, clearPersistedTabs } from "./tabs-state";

describe("tabs-state (localStorage)", () => {
  it("devuelve null sin nada persistido", () => {
    expect(loadPersistedTabs()).toBeNull();
  });

  it("persiste y recupera pestañas válidas", () => {
    persistTabs({ tabs: [{ id: "t1", autoLabel: "Servers" }], activeTabId: "t1" });
    const loaded = loadPersistedTabs();
    expect(loaded?.tabs).toHaveLength(1);
    expect(loaded?.activeTabId).toBe("t1");
  });

  it("descarta tabs sin id y vistas restore inválidas", () => {
    localStorage.setItem(
      "lp.desktop.tabs.v1",
      JSON.stringify({
        tabs: [{ autoLabel: "x" }, { id: "ok", restoreView: "no-existe" }],
        activeTabId: "ok",
      }),
    );
    const loaded = loadPersistedTabs();
    expect(loaded?.tabs).toHaveLength(1);
    expect(loaded?.tabs[0].id).toBe("ok");
    expect(loaded?.tabs[0].restoreView).toBeUndefined();
  });

  it("cae al primer tab si activeTabId no existe", () => {
    persistTabs({ tabs: [{ id: "a", autoLabel: "A" }], activeTabId: "zzz" });
    expect(loadPersistedTabs()?.activeTabId).toBe("a");
  });

  it("clear borra el estado", () => {
    persistTabs({ tabs: [{ id: "a", autoLabel: "A" }], activeTabId: "a" });
    clearPersistedTabs();
    expect(loadPersistedTabs()).toBeNull();
  });

  it("JSON corrupto => null sin lanzar", () => {
    localStorage.setItem("lp.desktop.tabs.v1", "{no-json");
    expect(loadPersistedTabs()).toBeNull();
  });

  it("rechaza restoreView 'security' (ya no es una vista válida)", () => {
    localStorage.setItem(
      "lp.desktop.tabs.v1",
      JSON.stringify({
        tabs: [{ id: "sec", autoLabel: "Servers", restoreView: "security" }],
        activeTabId: "sec",
      }),
    );
    const loaded = loadPersistedTabs();
    expect(loaded?.tabs).toHaveLength(1);
    expect(loaded?.tabs[0].restoreView).toBeUndefined();
  });

  it("rechaza restoreView 'payments' (pagos no es una vista)", () => {
    localStorage.setItem(
      "lp.desktop.tabs.v1",
      JSON.stringify({
        tabs: [{ id: "pay", autoLabel: "Servers", restoreView: "payments" }],
        activeTabId: "pay",
      }),
    );
    expect(loadPersistedTabs()?.tabs[0].restoreView).toBeUndefined();
  });

  it("conserva restoreView 'dashboard' (vista válida)", () => {
    localStorage.setItem(
      "lp.desktop.tabs.v1",
      JSON.stringify({
        tabs: [{ id: "d", autoLabel: "Servers", restoreView: "dashboard" }],
        activeTabId: "d",
      }),
    );
    expect(loadPersistedTabs()?.tabs[0].restoreView).toBe("dashboard");
  });

  it("borra URLs de handoff heredadas al leer y nunca vuelve a persistirlas", () => {
    localStorage.setItem("lp.desktop.tabs.v1", JSON.stringify({
      tabs: [{ id: "old", autoLabel: "Box", restoreView: "ssh", restorePanelId: "p1", restoreSshUrl: "https://box.example/api/auth/sso/handoff?ticket=secret" }],
      activeTabId: "old",
    }));
    const loaded = loadPersistedTabs();
    expect(loaded?.tabs[0].restoreSshUrl).toBeUndefined();
    expect(localStorage.getItem("lp.desktop.tabs.v1")).not.toContain("secret");
    persistTabs({ tabs: [{ id: "new", autoLabel: "Box", restoreSshUrl: "https://box.example?ticket=again" }], activeTabId: "new" });
    expect(localStorage.getItem("lp.desktop.tabs.v1")).not.toContain("again");
  });
});
