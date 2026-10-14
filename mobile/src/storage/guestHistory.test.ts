import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

// guestHistory mantiene un memoryCache a nivel de módulo y persiste en
// AsyncStorage (mockeado en memoria en test/setup.ts). El store del mock es
// único (la factoría de vi.mock no se re-ejecuta con resetModules), así que
// hay que limpiarlo a mano además de resetear el módulo para que memoryCache
// arranque vacío en cada test.
async function freshModule() {
  await AsyncStorage.clear();
  vi.resetModules();
  return await import("./guestHistory");
}

describe("guestHistory · access links (solo enlaces compartibles)", () => {
  let mod: typeof import("./guestHistory");
  beforeEach(async () => {
    mod = await freshModule();
  });

  it("empieza vacío", async () => {
    expect(await mod.loadGuestHistory()).toEqual([]);
  });

  it("push agrega al frente, sin duplicar por token", async () => {
    await mod.pushGuestAccessLink({ token: "tok-uno" });
    await mod.pushGuestAccessLink({ token: "tok-dos" });
    await mod.pushGuestAccessLink({ token: "tok-uno" }); // duplicado por token
    const list = await mod.loadGuestHistory();
    expect(list.map((e) => e.token)).toEqual(["tok-uno", "tok-dos"]);
  });

  it("remove elimina por token", async () => {
    await mod.pushGuestAccessLink({ token: "alpha" });
    await mod.pushGuestAccessLink({ token: "beta" });
    await mod.removeGuestEntry("alpha");
    expect((await mod.loadGuestHistory()).map((e) => e.token)).toEqual(["beta"]);
  });

  it("descarta enlaces vencidos al cargar", async () => {
    await mod.pushGuestAccessLink({ token: "vigente", expiresAt: Date.now() + 60_000 });
    await mod.pushGuestAccessLink({ token: "vencido", expiresAt: Date.now() - 1 });
    const list = await mod.loadGuestHistory();
    expect(list.map((e) => e.token)).toEqual(["vigente"]);
  });

  it("limita a 12 entradas", async () => {
    for (let i = 0; i < 20; i++) await mod.pushGuestAccessLink({ token: `t${i}` });
    expect(await mod.loadGuestHistory()).toHaveLength(12);
  });
});
