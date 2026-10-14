import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadPersistedTabs,
  persistTabs,
  clearPersistedTabs,
  type PersistedTabsState,
} from "./tabs-state";

const KEY = "lp.app.tabs.v2";
const LEGACY_KEY_V1 = "lp.app.tabs.v1";

beforeEach(async () => {
  // El mock de AsyncStorage usa un Map compartido entre tests.
  await AsyncStorage.clear();
});

describe("loadPersistedTabs", () => {
  it("devuelve null cuando no hay nada almacenado", async () => {
    expect(await loadPersistedTabs()).toBeNull();
  });

  it("devuelve null cuando el JSON es inválido (parse falla)", async () => {
    await AsyncStorage.setItem(KEY, "{ not json");
    expect(await loadPersistedTabs()).toBeNull();
  });

  it("devuelve null cuando el valor no es un objeto", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(42));
    expect(await loadPersistedTabs()).toBeNull();
  });

  it("devuelve null cuando tabs está vacío", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ tabs: [], activeTabId: "x" }));
    expect(await loadPersistedTabs()).toBeNull();
  });

  it("devuelve null cuando tabs no es un array (sanitiza a lista vacía)", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ tabs: "nope", activeTabId: "x" }));
    expect(await loadPersistedTabs()).toBeNull();
  });

  it("devuelve null cuando todos los tabs son inválidos", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ tabs: [null, 5, {}, { id: "" }, { autoLabel: "x" }], activeTabId: "a" }),
    );
    expect(await loadPersistedTabs()).toBeNull();
  });

  it("carga un tab válido mínimo aplicando autoLabel por defecto 'Servers'", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ tabs: [{ id: "t1" }], activeTabId: "t1" }));
    const state = await loadPersistedTabs();
    expect(state).not.toBeNull();
    expect(state!.tabs).toEqual([{ id: "t1", autoLabel: "Servers" }]);
    expect(state!.activeTabId).toBe("t1");
  });

  it("conserva los campos opcionales válidos del tab", async () => {
    const stored = {
      tabs: [
        {
          id: "t1",
          autoLabel: "My Server",
          customLabel: "Prod",
          autoConnect: true,
          fixed: true,
          restoreView: "dashboard",
          restoreSshUrl: "ssh://example",
          restorePanelId: "panel-9",
          restoreChatPanelId: "panel-9",
        },
      ],
      activeTabId: "t1",
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
    const state = await loadPersistedTabs();
    expect(state!.tabs[0]).toEqual({
      id: "t1",
      autoLabel: "My Server",
      customLabel: "Prod",
      autoConnect: true,
      fixed: true,
      restoreView: "dashboard",
      restoreSshUrl: "ssh://example",
      restorePanelId: "panel-9",
      restoreChatPanelId: "panel-9",
    });
  });

  it("descarta campos opcionales inválidos pero conserva el tab", async () => {
    const stored = {
      tabs: [
        {
          id: "t1",
          autoLabel: "",
          customLabel: "",
          autoConnect: "yes",
          fixed: "true",
          restoreView: "payments", // no está en VALID_VIEWS de tabs-state
          restoreSshUrl: "",
          restorePanelId: 123,
          restoreChatPanelId: "",
        },
      ],
      activeTabId: "t1",
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
    const state = await loadPersistedTabs();
    // autoLabel vacío => default "Servers"; el resto se omite.
    expect(state!.tabs[0]).toEqual({ id: "t1", autoLabel: "Servers" });
  });

  it("rechaza restoreView no listado en VALID_VIEWS (blogfeed/payments)", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ tabs: [{ id: "t1", restoreView: "blogfeed" }], activeTabId: "t1" }),
    );
    const state = await loadPersistedTabs();
    expect(state!.tabs[0]).not.toHaveProperty("restoreView");
  });

  it("acepta fixed solo cuando es estrictamente true", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ tabs: [{ id: "t1", fixed: 1 }], activeTabId: "t1" }),
    );
    const state = await loadPersistedTabs();
    expect(state!.tabs[0]).not.toHaveProperty("fixed");
  });

  it("filtra tabs inválidos y conserva los válidos", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        tabs: [{ id: "ok1" }, null, { id: "" }, { id: "ok2", autoLabel: "Two" }],
        activeTabId: "ok2",
      }),
    );
    const state = await loadPersistedTabs();
    expect(state!.tabs.map((t) => t.id)).toEqual(["ok1", "ok2"]);
    expect(state!.activeTabId).toBe("ok2");
  });

  it("fuerza activeTabId al primer tab cuando el activo no existe", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ tabs: [{ id: "a" }, { id: "b" }], activeTabId: "zzz" }),
    );
    const state = await loadPersistedTabs();
    expect(state!.activeTabId).toBe("a");
  });

  it("fuerza activeTabId al primero cuando activeTabId no es string", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ tabs: [{ id: "a" }, { id: "b" }], activeTabId: 7 }),
    );
    const state = await loadPersistedTabs();
    expect(state!.activeTabId).toBe("a");
  });
});

describe("migración v1 → v2", () => {
  it("carga la v1 cuando no hay v2, la persiste como v2 y borra la clave v1", async () => {
    const v1 = { tabs: [{ id: "t1", restoreView: "ssh", restoreSshUrl: "ssh://x" }], activeTabId: "t1" };
    await AsyncStorage.setItem(LEGACY_KEY_V1, JSON.stringify(v1));
    const state = await loadPersistedTabs();
    expect(state!.tabs[0]).toEqual({ id: "t1", autoLabel: "Servers", restoreView: "dashboard" });
    // Migrada: v2 escrita, v1 eliminada.
    expect(await AsyncStorage.getItem(LEGACY_KEY_V1)).toBeNull();
    const migrated = JSON.parse((await AsyncStorage.getItem(KEY))!);
    expect(migrated.tabs[0].id).toBe("t1");
  });

  it("restaura una pestaña v2 antigua de WebView en el dashboard nativo", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ tabs: [{ id: "t1", restoreView: "ssh", restoreSshUrl: "https://panel.example/terminal" }], activeTabId: "t1" }));
    const state = await loadPersistedTabs();
    expect(state!.tabs[0]).toEqual({ id: "t1", autoLabel: "Servers", restoreView: "dashboard" });
  });

  it("prefiere la v2 aunque exista una v1 residual", async () => {
    await AsyncStorage.setItem(LEGACY_KEY_V1, JSON.stringify({ tabs: [{ id: "old" }], activeTabId: "old" }));
    await AsyncStorage.setItem(KEY, JSON.stringify({ tabs: [{ id: "new" }], activeTabId: "new" }));
    const state = await loadPersistedTabs();
    expect(state!.tabs[0].id).toBe("new");
  });

  it("conserva la v1 cuando la escritura v2 FALLA y reintenta en el próximo arranque", async () => {
    const v1 = { tabs: [{ id: "t1" }], activeTabId: "t1" };
    await AsyncStorage.setItem(LEGACY_KEY_V1, JSON.stringify(v1));
    // La escritura v2 falla (storage lleno / no disponible): persistTabs la traga.
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("disk full"));
    const state = await loadPersistedTabs();
    // La carga en memoria de esta sesión no se pierde…
    expect(state!.tabs[0].id).toBe("t1");
    // …y la v1 NO se borra (la v2 no quedó persistida): nada de perder tabs.
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_KEY_V1)).toBe(JSON.stringify(v1));
    // Próximo arranque: la migración se reintenta y ahora sí completa.
    const retry = await loadPersistedTabs();
    expect(retry!.tabs[0].id).toBe("t1");
    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_KEY_V1)).toBeNull();
  });

  it("conserva la v1 cuando la escritura v2 se pierde en silencio (read-back no coincide)", async () => {
    const v1 = { tabs: [{ id: "t1" }], activeTabId: "t1" };
    await AsyncStorage.setItem(LEGACY_KEY_V1, JSON.stringify(v1));
    // setItem "resuelve" pero no persiste nada (write perdido a mitad).
    vi.mocked(AsyncStorage.setItem).mockImplementationOnce(async () => {});
    const state = await loadPersistedTabs();
    expect(state!.tabs[0].id).toBe("t1");
    expect(await AsyncStorage.getItem(LEGACY_KEY_V1)).toBe(JSON.stringify(v1));
  });
});

describe("persistTabs", () => {
  it("serializa y guarda el estado tal cual bajo la clave canónica", async () => {
    const state: PersistedTabsState = {
      tabs: [{ id: "t1", autoLabel: "Servers" }],
      activeTabId: "t1",
    };
    await persistTabs(state);
    const raw = await AsyncStorage.getItem(KEY);
    expect(raw).toBe(JSON.stringify(state));
  });

  it("hace round-trip: lo persistido se vuelve a cargar igual", async () => {
    const state: PersistedTabsState = {
      tabs: [
        { id: "t1", autoLabel: "Servers", fixed: true },
        { id: "t2", autoLabel: "Box", autoConnect: false, restoreView: "dashboard" },
      ],
      activeTabId: "t2",
    };
    await persistTabs(state);
    const loaded = await loadPersistedTabs();
    expect(loaded).toEqual(state);
  });
});

describe("clearPersistedTabs", () => {
  it("elimina el estado almacenado", async () => {
    await persistTabs({ tabs: [{ id: "t1", autoLabel: "Servers" }], activeTabId: "t1" });
    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();
    await clearPersistedTabs();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(await loadPersistedTabs()).toBeNull();
  });

  it("no lanza cuando no hay nada que limpiar", async () => {
    await expect(clearPersistedTabs()).resolves.toBeUndefined();
  });
});
