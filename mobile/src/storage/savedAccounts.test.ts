import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.app.saved.accounts";

type Mod = typeof import("./savedAccounts");

// El módulo mantiene un `memoryCache` a nivel de módulo y AsyncStorage es un
// Map en closure (test/setup.ts) que persiste durante toda la corrida. Para
// aislar cada test reseteamos los módulos (nuevo memoryCache) y limpiamos el
// storage mockeado.
async function freshModule(): Promise<Mod> {
  vi.resetModules();
  await (AsyncStorage as unknown as { clear: () => Promise<void> }).clear();
  return import("./savedAccounts");
}

function makeAccount(over: Partial<import("./savedAccounts").SavedAccount> = {}) {
  return {
    uid: "uid-1",
    email: "a@example.com",
    displayName: "Alice",
    photoURL: null,
    lastLogin: 1000,
    ...over,
  };
}

let mod: Mod;

beforeEach(async () => {
  mod = await freshModule();
});

describe("loadSavedAccounts", () => {
  it("devuelve [] cuando no hay nada guardado", async () => {
    const result = await mod.loadSavedAccounts();
    expect(result).toEqual([]);
  });

  it("parsea y devuelve el array guardado", async () => {
    const acc = makeAccount();
    await AsyncStorage.setItem(KEY, JSON.stringify([acc]));
    const result = await mod.loadSavedAccounts();
    expect(result).toEqual([acc]);
  });

  it("usa la cache en memoria en la segunda llamada (no relee storage)", async () => {
    const acc = makeAccount();
    await AsyncStorage.setItem(KEY, JSON.stringify([acc]));
    const first = await mod.loadSavedAccounts();
    // Mutamos el storage subyacente; la cache debe ignorar el cambio.
    await AsyncStorage.setItem(KEY, JSON.stringify([]));
    const second = await mod.loadSavedAccounts();
    expect(second).toBe(first);
    expect(second).toEqual([acc]);
  });

  it("devuelve [] si el JSON guardado no es un array", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ not: "an array" }));
    const result = await mod.loadSavedAccounts();
    expect(result).toEqual([]);
  });

  it("devuelve [] si el JSON es inválido (parse lanza)", async () => {
    await AsyncStorage.setItem(KEY, "{not valid json");
    const result = await mod.loadSavedAccounts();
    expect(result).toEqual([]);
  });
});

describe("loadSavedAccountsSync", () => {
  it("devuelve [] cuando la cache aún no se ha poblado", () => {
    expect(mod.loadSavedAccountsSync()).toEqual([]);
  });

  it("devuelve la cache poblada tras un load async", async () => {
    const acc = makeAccount();
    await AsyncStorage.setItem(KEY, JSON.stringify([acc]));
    await mod.loadSavedAccounts();
    expect(mod.loadSavedAccountsSync()).toEqual([acc]);
  });
});

describe("upsertSavedAccount", () => {
  it("agrega una cuenta nueva al frente", async () => {
    const a = makeAccount({ uid: "u1", email: "a@x.com" });
    const next = await mod.upsertSavedAccount(a);
    expect(next).toEqual([a]);
  });

  it("coloca la cuenta más reciente al frente", async () => {
    const a = makeAccount({ uid: "u1", email: "a@x.com" });
    const b = makeAccount({ uid: "u2", email: "b@x.com" });
    await mod.upsertSavedAccount(a);
    const next = await mod.upsertSavedAccount(b);
    expect(next.map((e) => e.email)).toEqual(["b@x.com", "a@x.com"]);
  });

  it("reemplaza una cuenta existente por uid (dedup) y la mueve al frente", async () => {
    const a = makeAccount({ uid: "u1", email: "a@x.com", displayName: "Alice" });
    const b = makeAccount({ uid: "u2", email: "b@x.com" });
    await mod.upsertSavedAccount(a);
    await mod.upsertSavedAccount(b);
    const updated = makeAccount({ uid: "u1", email: "a-new@x.com", displayName: "Alice2" });
    const next = await mod.upsertSavedAccount(updated);
    expect(next.map((e) => e.email)).toEqual(["a-new@x.com", "b@x.com"]);
    expect(next.length).toBe(2);
  });

  it("reemplaza una cuenta existente por email (dedup)", async () => {
    const a = makeAccount({ uid: "u1", email: "same@x.com", displayName: "old" });
    await mod.upsertSavedAccount(a);
    const updated = makeAccount({ uid: "u2", email: "same@x.com", displayName: "new" });
    const next = await mod.upsertSavedAccount(updated);
    expect(next.length).toBe(1);
    expect(next[0]).toEqual(updated);
  });

  it("persiste en AsyncStorage", async () => {
    const a = makeAccount({ uid: "u1", email: "a@x.com" });
    await mod.upsertSavedAccount(a);
    const raw = await AsyncStorage.getItem(KEY);
    expect(JSON.parse(raw!)).toEqual([a]);
  });
});

describe("removeSavedAccount", () => {
  it("elimina la cuenta con el email dado", async () => {
    await mod.upsertSavedAccount(makeAccount({ uid: "u1", email: "a@x.com" }));
    await mod.upsertSavedAccount(makeAccount({ uid: "u2", email: "b@x.com" }));
    const next = await mod.removeSavedAccount("a@x.com");
    expect(next.map((e) => e.email)).toEqual(["b@x.com"]);
  });

  it("no cambia nada si el email no existe", async () => {
    await mod.upsertSavedAccount(makeAccount({ uid: "u1", email: "a@x.com" }));
    const next = await mod.removeSavedAccount("missing@x.com");
    expect(next.map((e) => e.email)).toEqual(["a@x.com"]);
  });

  it("sobre lista vacía devuelve []", async () => {
    const next = await mod.removeSavedAccount("any@x.com");
    expect(next).toEqual([]);
  });
});

describe("reorderSavedAccounts", () => {
  beforeEach(async () => {
    await mod.upsertSavedAccount(makeAccount({ uid: "u1", email: "a@x.com" }));
    await mod.upsertSavedAccount(makeAccount({ uid: "u2", email: "b@x.com" }));
    await mod.upsertSavedAccount(makeAccount({ uid: "u3", email: "c@x.com" }));
  });

  it("reordena según el orden de emails dado", async () => {
    const next = await mod.reorderSavedAccounts(["a@x.com", "b@x.com", "c@x.com"]);
    expect(next.map((e) => e.email)).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });

  it("anexa al final los emails no mencionados, en su orden actual", async () => {
    // Estado actual tras upserts: c, b, a
    const next = await mod.reorderSavedAccounts(["a@x.com"]);
    expect(next.map((e) => e.email)).toEqual(["a@x.com", "c@x.com", "b@x.com"]);
  });

  it("ignora emails inexistentes en la lista de orden", async () => {
    const next = await mod.reorderSavedAccounts(["zzz@x.com", "b@x.com"]);
    expect(next.map((e) => e.email)).toEqual(["b@x.com", "c@x.com", "a@x.com"]);
  });

  it("con lista de orden vacía conserva el orden actual", async () => {
    const next = await mod.reorderSavedAccounts([]);
    expect(next.map((e) => e.email)).toEqual(["c@x.com", "b@x.com", "a@x.com"]);
  });
});

describe("patchSavedAccount", () => {
  it("aplica el patch a la cuenta con el email dado", async () => {
    await mod.upsertSavedAccount(makeAccount({ uid: "u1", email: "a@x.com", displayName: "Alice" }));
    const next = await mod.patchSavedAccount("a@x.com", { displayName: "Alicia", company: "Acme" });
    expect(next[0].displayName).toBe("Alicia");
    expect(next[0].company).toBe("Acme");
  });

  it("no toca otras cuentas", async () => {
    await mod.upsertSavedAccount(makeAccount({ uid: "u1", email: "a@x.com", displayName: "Alice" }));
    await mod.upsertSavedAccount(makeAccount({ uid: "u2", email: "b@x.com", displayName: "Bob" }));
    const next = await mod.patchSavedAccount("a@x.com", { displayName: "Alicia" });
    const b = next.find((e) => e.email === "b@x.com")!;
    expect(b.displayName).toBe("Bob");
  });

  it("no cambia nada si el email no existe", async () => {
    await mod.upsertSavedAccount(makeAccount({ uid: "u1", email: "a@x.com", displayName: "Alice" }));
    const next = await mod.patchSavedAccount("missing@x.com", { displayName: "X" });
    expect(next[0].displayName).toBe("Alice");
  });

  it("persiste el patch en AsyncStorage", async () => {
    await mod.upsertSavedAccount(makeAccount({ uid: "u1", email: "a@x.com" }));
    await mod.patchSavedAccount("a@x.com", { phone: "+57123" });
    const raw = await AsyncStorage.getItem(KEY);
    expect(JSON.parse(raw!)[0].phone).toBe("+57123");
  });
});
