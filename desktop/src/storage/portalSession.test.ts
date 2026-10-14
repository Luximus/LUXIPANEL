import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadPortalSession,
  savePortalSession,
  clearPortalSession,
  loadRefreshToken,
  saveRefreshToken,
  clearRefreshToken,
  saveAccountRefreshToken,
  loadAccountRefreshToken,
  removeAccountRefreshToken,
  type PortalSessionRecord,
  type RefreshTokenRecord,
} from "./portalSession";

const KEY = "lp.desktop.portal.session";
const REFRESH_KEY = "lp.desktop.portal.refresh";
const REFRESH_MAP_KEY = "lp.desktop.portal.refresh.byuid";

// Skew de seguridad usado por el módulo: vence 5s antes de expiresAt.
const SKEW = 5_000;

function makeSession(overrides: Partial<PortalSessionRecord> = {}): PortalSessionRecord {
  return {
    token: "access-jwt",
    expiresAt: Date.now() + 60_000,
    customer: { id: "cust-1", email: "a@b.com", name: "A", role: "owner" },
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("portal session (access JWT)", () => {
  it("retorna null cuando no hay nada guardado", () => {
    expect(loadPortalSession()).toBeNull();
  });

  it("save + load hace round-trip de un registro válido (no vencido)", () => {
    const rec = makeSession();
    savePortalSession(rec);
    expect(loadPortalSession()).toEqual(rec);
  });

  it("clear elimina la sesión guardada", () => {
    savePortalSession(makeSession());
    clearPortalSession();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadPortalSession()).toBeNull();
  });

  it("retorna null y purga si el token está vencido (expiresAt en el pasado)", () => {
    const rec = makeSession({ expiresAt: Date.now() - 1_000 });
    savePortalSession(rec);
    expect(loadPortalSession()).toBeNull();
    // se removió de localStorage
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("aplica skew de 5s: vence justo dentro de la ventana de skew", () => {
    // expiresAt 1s en el futuro => Date.now() >= expiresAt - 5000 es true => vencido
    const rec = makeSession({ expiresAt: Date.now() + 1_000 });
    savePortalSession(rec);
    expect(loadPortalSession()).toBeNull();
  });

  it("sigue válido si falta poco pero más que el skew", () => {
    const rec = makeSession({ expiresAt: Date.now() + SKEW + 10_000 });
    savePortalSession(rec);
    expect(loadPortalSession()).toEqual(rec);
  });

  it("retorna null con JSON inválido", () => {
    localStorage.setItem(KEY, "{no es json");
    expect(loadPortalSession()).toBeNull();
  });

  it("retorna null si falta el token", () => {
    localStorage.setItem(KEY, JSON.stringify({ expiresAt: Date.now() + 60_000 }));
    expect(loadPortalSession()).toBeNull();
  });

  it("retorna null si expiresAt no es number", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ token: "t", expiresAt: "pronto" }),
    );
    expect(loadPortalSession()).toBeNull();
  });

  it("una nueva save sobreescribe la anterior", () => {
    savePortalSession(makeSession({ token: "viejo" }));
    const nuevo = makeSession({ token: "nuevo" });
    savePortalSession(nuevo);
    expect(loadPortalSession()).toEqual(nuevo);
  });
});

describe("refresh token activo", () => {
  it("retorna null cuando no hay nada", () => {
    expect(loadRefreshToken()).toBeNull();
  });

  it("save + load round-trip", () => {
    const rec: RefreshTokenRecord = { token: "ref", expiresAt: Date.now() + 90 * 86_400_000 };
    saveRefreshToken(rec);
    expect(loadRefreshToken()).toEqual(rec);
  });

  it("clear elimina el refresh activo", () => {
    saveRefreshToken({ token: "ref", expiresAt: Date.now() + 100_000 });
    clearRefreshToken();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(loadRefreshToken()).toBeNull();
  });

  it("retorna null y purga si está vencido", () => {
    saveRefreshToken({ token: "ref", expiresAt: Date.now() - 1 });
    expect(loadRefreshToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it("retorna null con datos corruptos", () => {
    localStorage.setItem(REFRESH_KEY, "xxx");
    expect(loadRefreshToken()).toBeNull();
  });

  it("retorna null sin token", () => {
    localStorage.setItem(REFRESH_KEY, JSON.stringify({ expiresAt: Date.now() + 100_000 }));
    expect(loadRefreshToken()).toBeNull();
  });
});

describe("refresh tokens por cuenta (mapa por uid)", () => {
  it("save + load por uid round-trip", () => {
    const rec: RefreshTokenRecord = { token: "r-uid1", expiresAt: Date.now() + 100_000 };
    saveAccountRefreshToken("uid1", rec);
    expect(loadAccountRefreshToken("uid1")).toEqual(rec);
  });

  it("guarda múltiples cuentas independientes en el mismo mapa", () => {
    const a: RefreshTokenRecord = { token: "ra", expiresAt: Date.now() + 100_000 };
    const b: RefreshTokenRecord = { token: "rb", expiresAt: Date.now() + 200_000 };
    saveAccountRefreshToken("a", a);
    saveAccountRefreshToken("b", b);
    expect(loadAccountRefreshToken("a")).toEqual(a);
    expect(loadAccountRefreshToken("b")).toEqual(b);
  });

  it("re-guardar el mismo uid reemplaza el registro previo", () => {
    saveAccountRefreshToken("u", { token: "v1", expiresAt: Date.now() + 100_000 });
    saveAccountRefreshToken("u", { token: "v2", expiresAt: Date.now() + 100_000 });
    expect(loadAccountRefreshToken("u")?.token).toBe("v2");
  });

  it("save con uid vacío es no-op", () => {
    saveAccountRefreshToken("", { token: "x", expiresAt: Date.now() + 100_000 });
    expect(localStorage.getItem(REFRESH_MAP_KEY)).toBeNull();
  });

  it("load con uid vacío retorna null", () => {
    expect(loadAccountRefreshToken("")).toBeNull();
  });

  it("load de uid inexistente retorna null", () => {
    saveAccountRefreshToken("otro", { token: "x", expiresAt: Date.now() + 100_000 });
    expect(loadAccountRefreshToken("nope")).toBeNull();
  });

  it("load purga el uid del mapa si está vencido y deja a los demás intactos", () => {
    saveAccountRefreshToken("vivo", { token: "ok", expiresAt: Date.now() + 100_000 });
    saveAccountRefreshToken("muerto", { token: "old", expiresAt: Date.now() - 1 });
    expect(loadAccountRefreshToken("muerto")).toBeNull();
    // muerto fue eliminado del mapa, vivo sigue
    const map = JSON.parse(localStorage.getItem(REFRESH_MAP_KEY)!) as Record<string, RefreshTokenRecord>;
    expect(map.muerto).toBeUndefined();
    expect(map.vivo?.token).toBe("ok");
  });

  it("remove elimina solo el uid indicado", () => {
    saveAccountRefreshToken("a", { token: "ra", expiresAt: Date.now() + 100_000 });
    saveAccountRefreshToken("b", { token: "rb", expiresAt: Date.now() + 100_000 });
    removeAccountRefreshToken("a");
    expect(loadAccountRefreshToken("a")).toBeNull();
    expect(loadAccountRefreshToken("b")?.token).toBe("rb");
  });

  it("remove con uid vacío es no-op y no crea el mapa", () => {
    removeAccountRefreshToken("");
    expect(localStorage.getItem(REFRESH_MAP_KEY)).toBeNull();
  });

  it("remove de uid inexistente no altera el mapa existente", () => {
    saveAccountRefreshToken("a", { token: "ra", expiresAt: Date.now() + 100_000 });
    const before = localStorage.getItem(REFRESH_MAP_KEY);
    removeAccountRefreshToken("nope");
    expect(localStorage.getItem(REFRESH_MAP_KEY)).toBe(before);
  });

  it("retorna null si el registro del uid no tiene expiresAt numérico", () => {
    saveAccountRefreshToken("u", { token: "t", expiresAt: NaN as unknown as number });
    // NaN es typeof number, pero Date.now() >= NaN - 5000 es false => no vence por eso.
    // En su lugar verificamos un valor no-numérico real escribiendo el mapa a mano.
    localStorage.setItem(REFRESH_MAP_KEY, JSON.stringify({ u: { token: "t", expiresAt: "x" } }));
    expect(loadAccountRefreshToken("u")).toBeNull();
  });

  it("mapa corrupto se trata como vacío", () => {
    localStorage.setItem(REFRESH_MAP_KEY, "{roto");
    expect(loadAccountRefreshToken("cualquiera")).toBeNull();
  });
});
