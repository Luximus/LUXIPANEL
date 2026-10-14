import { beforeEach, describe, expect, it } from "vitest";
import { getDefaultServer, saveDefaultServer } from "./defaultServer";

const KEY = "lp.desktop.default.server";

describe("defaultServer storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getDefaultServer devuelve null cuando no hay nada guardado", async () => {
    expect(await getDefaultServer()).toBeNull();
  });

  it("saveDefaultServer persiste el panelId en localStorage bajo la clave canónica", async () => {
    await saveDefaultServer("panel-123");
    expect(localStorage.getItem(KEY)).toBe("panel-123");
  });

  it("getDefaultServer recupera el valor previamente guardado", async () => {
    await saveDefaultServer("srv-abc");
    expect(await getDefaultServer()).toBe("srv-abc");
  });

  it("saveDefaultServer sobrescribe el valor anterior (no duplica)", async () => {
    await saveDefaultServer("primero");
    await saveDefaultServer("segundo");
    expect(await getDefaultServer()).toBe("segundo");
    expect(localStorage.length).toBe(1);
  });

  it("guarda string vacío tal cual y getDefaultServer lo devuelve como ''", async () => {
    await saveDefaultServer("");
    // localStorage almacena el string vacío; no es null porque la clave existe.
    expect(await getDefaultServer()).toBe("");
    expect(localStorage.getItem(KEY)).toBe("");
  });

  it("conserva valores con caracteres especiales sin transformarlos", async () => {
    const id = "uuid-9f8e:7d/6c?#x ñ";
    await saveDefaultServer(id);
    expect(await getDefaultServer()).toBe(id);
  });

  it("usa exactamente la clave 'lp.desktop.default.server' y no contamina otras claves", async () => {
    await saveDefaultServer("xyz");
    expect(Object.keys(localStorage)).toEqual([KEY]);
  });
});
