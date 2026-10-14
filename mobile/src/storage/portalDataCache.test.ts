import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

// `expo-secure-store` no se mockea en test/setup.ts (solo lo usa este módulo
// vía secureStorage). Lo mockeamos aquí con un Map en memoria que respeta el
// contrato de SecureStore (get/set/delete por clave). El segmentado en chunks
// de secureStorage opera sobre este mismo store, de modo que el round-trip
// load/save es fidedigno incluso para payloads grandes.
const secureStore = new Map<string, string>();
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (k: string) => (secureStore.has(k) ? secureStore.get(k)! : null)),
  setItemAsync: vi.fn(async (k: string, v: string) => void secureStore.set(k, v)),
  deleteItemAsync: vi.fn(async (k: string) => void secureStore.delete(k)),
}));

type Mod = typeof import("./portalDataCache");

// El módulo mantiene Maps a nivel de módulo (panelsMemory/ticketsMemory). Para
// aislar cada test reseteamos los módulos (nuevos Maps), limpiamos el
// AsyncStorage mockeado (Map en closure de test/setup.ts) y el secureStore.
async function freshModule(): Promise<Mod> {
  vi.resetModules();
  secureStore.clear();
  await (AsyncStorage as unknown as { clear: () => Promise<void> }).clear();
  return import("./portalDataCache");
}

let mod: Mod;

beforeEach(async () => {
  mod = await freshModule();
});

function makePanel(id: string) {
  // El módulo no inspecciona la forma de Panel; usamos un objeto mínimo.
  return { id } as unknown as import("../types/models").Panel;
}

function makeTicket(id: string) {
  return { id } as unknown as import("../types/models").Ticket;
}

describe("loadPanelsCache / savePanelsCache", () => {
  it("devuelve null cuando no hay nada guardado", async () => {
    expect(await mod.loadPanelsCache("user@example.com")).toBeNull();
  });

  it("guarda y recupera panels e invitations (round-trip)", async () => {
    const panels = [makePanel("p1"), makePanel("p2")];
    const invitations = [{ id: "i1" } as unknown as import("../types/models").PanelInvitation];
    await mod.savePanelsCache("user@example.com", { panels, invitations });
    const got = await mod.loadPanelsCache("user@example.com");
    expect(got).not.toBeNull();
    expect(got!.panels).toEqual(panels);
    expect(got!.invitations).toEqual(invitations);
    expect(typeof got!.updatedAt).toBe("number");
  });

  it("save sella updatedAt con Date.now()", async () => {
    const before = Date.now();
    await mod.savePanelsCache("u@e.com", { panels: [], invitations: [] });
    const after = Date.now();
    const got = await mod.loadPanelsCache("u@e.com");
    expect(got!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(got!.updatedAt).toBeLessThanOrEqual(after);
  });

  it("sirve desde memoria sin tocar secureStore en la segunda lectura", async () => {
    const SecureStore = (await import("expo-secure-store")) as unknown as {
      getItemAsync: ReturnType<typeof vi.fn>;
    };
    await mod.savePanelsCache("mem@e.com", { panels: [makePanel("x")], invitations: [] });
    await mod.loadPanelsCache("mem@e.com"); // primera lectura: hit de memoria
    SecureStore.getItemAsync.mockClear();
    const got = await mod.loadPanelsCache("mem@e.com");
    expect(got!.panels).toEqual([makePanel("x")]);
    // memoria devuelve antes de consultar SecureStore
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it("lee desde secureStore cuando no hay copia en memoria (módulo recién importado)", async () => {
    await mod.savePanelsCache("persist@e.com", { panels: [makePanel("p")], invitations: [] });
    // Nuevo módulo => memoria vacía, pero el secureStore (Map externo) persiste
    // porque NO lo limpiamos aquí.
    vi.resetModules();
    const fresh = (await import("./portalDataCache")) as Mod;
    const got = await fresh.loadPanelsCache("persist@e.com");
    expect(got).not.toBeNull();
    expect(got!.panels).toEqual([makePanel("p")]);
  });

  it("devuelve null si el JSON persistido es inválido", async () => {
    const SecureStore = (await import("expo-secure-store")) as unknown as {
      setItemAsync: (k: string, v: string) => Promise<void>;
    };
    // Escribir basura bajo la clave normalizada (safeKey) para forzar el
    // JSON.parse fallido dentro de loadPanelsCache.
    await SecureStore.setItemAsync("lp.app.cache.panels_bad_e.com", "no-es-json{");
    const got = await mod.loadPanelsCache("bad@e.com");
    expect(got).toBeNull();
  });

  it("devuelve null si panels no es array", async () => {
    const SecureStore = (await import("expo-secure-store")) as unknown as {
      setItemAsync: (k: string, v: string) => Promise<void>;
    };
    await SecureStore.setItemAsync(
      "lp.app.cache.panels_shape_e.com",
      JSON.stringify({ panels: "nope", invitations: [], updatedAt: 1 }),
    );
    const got = await mod.loadPanelsCache("shape@e.com");
    expect(got).toBeNull();
  });

  it("devuelve null si invitations no es array", async () => {
    const SecureStore = (await import("expo-secure-store")) as unknown as {
      setItemAsync: (k: string, v: string) => Promise<void>;
    };
    await SecureStore.setItemAsync(
      "lp.app.cache.panels_shape2_e.com",
      JSON.stringify({ panels: [], invitations: 5, updatedAt: 1 }),
    );
    const got = await mod.loadPanelsCache("shape2@e.com");
    expect(got).toBeNull();
  });

  it("usa Date.now() cuando updatedAt persistido no es number", async () => {
    const SecureStore = (await import("expo-secure-store")) as unknown as {
      setItemAsync: (k: string, v: string) => Promise<void>;
    };
    // secureStorage normaliza la clave con safeKey (`:`/`@` -> `_`). Sin
    // manifest, secureGetItem hace fallback a getItemAsync(safeKey). Escribimos
    // bajo la forma normalizada para que la lectura la encuentre.
    await SecureStore.setItemAsync(
      "lp.app.cache.panels_upd_e.com",
      JSON.stringify({ panels: [], invitations: [], updatedAt: "ayer" }),
    );
    const got = await mod.loadPanelsCache("upd@e.com");
    expect(got).not.toBeNull();
    expect(typeof got!.updatedAt).toBe("number");
  });

  it("round-trip de payload grande (>2KB, fuerza segmentado en chunks)", async () => {
    const panels = Array.from({ length: 500 }, (_, i) => makePanel(`panel-${i}-xxxxxxxxxx`));
    await mod.savePanelsCache("big@e.com", { panels, invitations: [] });
    // Nuevo módulo => fuerza lectura desde secureStore (reensamblando chunks).
    vi.resetModules();
    const fresh = (await import("./portalDataCache")) as Mod;
    const got = await fresh.loadPanelsCache("big@e.com");
    expect(got).not.toBeNull();
    expect(got!.panels).toHaveLength(500);
    expect(got!.panels).toEqual(panels);
  });
});

describe("loadTicketsCache / saveTicketsCache", () => {
  it("devuelve null cuando no hay nada guardado", async () => {
    expect(await mod.loadTicketsCache("user@example.com")).toBeNull();
  });

  it("guarda y recupera tickets (round-trip)", async () => {
    const tickets = [makeTicket("t1"), makeTicket("t2")];
    await mod.saveTicketsCache("user@example.com", tickets);
    const got = await mod.loadTicketsCache("user@example.com");
    expect(got).not.toBeNull();
    expect(got!.tickets).toEqual(tickets);
    expect(typeof got!.updatedAt).toBe("number");
  });

  it("tickets se persisten en AsyncStorage, no en secureStore", async () => {
    await mod.saveTicketsCache("askey@e.com", [makeTicket("t")]);
    const raw = await (AsyncStorage as unknown as {
      getItem: (k: string) => Promise<string | null>;
    }).getItem("lp.app.cache.tickets:askey@e.com");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).tickets).toEqual([makeTicket("t")]);
    // El secureStore NO debe contener la clave de tickets.
    expect(secureStore.has("lp.app.cache.tickets:askey@e.com")).toBe(false);
  });

  it("sirve desde memoria en la segunda lectura sin tocar AsyncStorage", async () => {
    await mod.saveTicketsCache("memt@e.com", [makeTicket("a")]);
    await mod.loadTicketsCache("memt@e.com");
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockClear();
    const got = await mod.loadTicketsCache("memt@e.com");
    expect(got!.tickets).toEqual([makeTicket("a")]);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it("devuelve null si el JSON persistido es inválido", async () => {
    await (AsyncStorage as unknown as {
      setItem: (k: string, v: string) => Promise<void>;
    }).setItem("lp.app.cache.tickets:badt@e.com", "{{{nope");
    const got = await mod.loadTicketsCache("badt@e.com");
    expect(got).toBeNull();
  });

  it("devuelve null si tickets no es array", async () => {
    await (AsyncStorage as unknown as {
      setItem: (k: string, v: string) => Promise<void>;
    }).setItem(
      "lp.app.cache.tickets:shapet@e.com",
      JSON.stringify({ tickets: { not: "array" }, updatedAt: 1 }),
    );
    const got = await mod.loadTicketsCache("shapet@e.com");
    expect(got).toBeNull();
  });

  it("usa Date.now() cuando updatedAt persistido no es number", async () => {
    await (AsyncStorage as unknown as {
      setItem: (k: string, v: string) => Promise<void>;
    }).setItem(
      "lp.app.cache.tickets:updt@e.com",
      JSON.stringify({ tickets: [], updatedAt: null }),
    );
    const got = await mod.loadTicketsCache("updt@e.com");
    expect(got).not.toBeNull();
    expect(typeof got!.updatedAt).toBe("number");
  });
});

describe("getCacheScope (normalización del email, vía aislamiento de caches)", () => {
  it("normaliza mayúsculas y espacios: el mismo email se mapea al mismo scope", async () => {
    await mod.savePanelsCache("User@Example.COM", { panels: [makePanel("p")], invitations: [] });
    // Variante con espacios y otra capitalización => mismo scope normalizado.
    const got = await mod.loadPanelsCache("  user@example.com  ");
    expect(got).not.toBeNull();
    expect(got!.panels).toEqual([makePanel("p")]);
  });

  it("emails distintos NO comparten cache", async () => {
    await mod.savePanelsCache("a@e.com", { panels: [makePanel("A")], invitations: [] });
    await mod.savePanelsCache("b@e.com", { panels: [makePanel("B")], invitations: [] });
    expect((await mod.loadPanelsCache("a@e.com"))!.panels).toEqual([makePanel("A")]);
    expect((await mod.loadPanelsCache("b@e.com"))!.panels).toEqual([makePanel("B")]);
  });

  it("null, undefined y cadena vacía caen en el scope 'anonymous' (comparten cache)", async () => {
    await mod.savePanelsCache(null, { panels: [makePanel("anon")], invitations: [] });
    expect((await mod.loadPanelsCache(undefined))!.panels).toEqual([makePanel("anon")]);
    expect((await mod.loadPanelsCache(""))!.panels).toEqual([makePanel("anon")]);
    expect((await mod.loadPanelsCache("   "))!.panels).toEqual([makePanel("anon")]);
  });

  it("panels y tickets usan scopes independientes pero misma normalización de email", async () => {
    await mod.savePanelsCache("Mix@E.com", { panels: [makePanel("p")], invitations: [] });
    await mod.saveTicketsCache("mix@e.com", [makeTicket("t")]);
    expect((await mod.loadPanelsCache("mix@e.com"))!.panels).toEqual([makePanel("p")]);
    expect((await mod.loadTicketsCache("MIX@e.com "))!.tickets).toEqual([makeTicket("t")]);
  });
});
