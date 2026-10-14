// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del ciclo ÚNICO de compras IAP (B4: N listeners → 1), sobre el módulo
// puro con nativo/deps falsos. Cubre las prioridades de QA para dispositivo:
// acknowledge-tras-validar (y solo-finish en reintentos), entrega doble,
// compra en background / cold start desde la Store (flush de pendientes),
// compra antes del login y re-configuración de deps sin re-registrar listener.
//
// El módulo es un singleton (a propósito: esa es la garantía bajo test), así
// que cada test usa CLAVES DE COMPRA ÚNICAS — el dedupe `finished` es global
// y no se resetea ni en logout (evita re-acreditar tras cambiar de cuenta).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TokenPack } from "../../api/billing";
import type { ProductRow } from "../../api/client";
import {
  acquireIapConnection,
  beginPurchaseLaunch,
  clearIapPurchaseResult,
  configureIapDeps,
  endPurchaseLaunch,
  flushPendingIapPurchases,
  getIapState,
  registerPendingTokenPack,
  waitForIapIdle,
  type IapDeps,
  type IapEvent,
  type IapNative,
  type IapPurchase,
} from "./purchase-lifecycle";
import { resetAllStores } from "../../lib/store-reset";

const pack = (over: Partial<TokenPack> = {}): TokenPack =>
  ({ id: "pk-1", sku: "TOKENS_500", name: "Pack 500", tokenAmount: 500, productId: "tokens_500", ...over }) as TokenPack;

const product = (over: Partial<ProductRow> = {}): ProductRow =>
  ({ id: "pr-1", sku: "APP_UNLOCK", name: "Desbloqueo de app", productId: "app_unlock", ...over }) as ProductRow;

function makeNative() {
  let purchaseCb: ((p: IapPurchase) => void) | null = null;
  let errorCb: ((e: { message: string | null; userCancelled: boolean }) => void) | null = null;
  const native: IapNative = {
    initConnection: vi.fn(async () => true),
    endConnection: vi.fn(async () => true),
    purchaseUpdatedListener: vi.fn((cb) => {
      purchaseCb = cb;
      return { remove: vi.fn(() => { purchaseCb = null; }) };
    }),
    purchaseErrorListener: vi.fn((cb) => {
      errorCb = cb;
      return { remove: vi.fn(() => { errorCb = null; }) };
    }),
    finishTransaction: vi.fn(async () => true),
    getAvailablePurchases: vi.fn(async () => [] as IapPurchase[]),
  };
  return {
    native,
    deliver: (p: IapPurchase) => purchaseCb?.(p),
    fail: (e: { message: string | null; userCancelled: boolean }) => errorCb?.(e),
    hasListener: () => purchaseCb != null,
  };
}

function makeDeps(over: Partial<IapDeps> = {}) {
  const events: IapEvent[] = [];
  const deps: IapDeps = {
    getToken: () => "sess-tok",
    resolveStoreProduct: vi.fn(async () => null),
    validate: vi.fn(async () => undefined),
    onEvent: (e) => events.push(e),
    ...over,
  };
  return { deps, events };
}

/** Conecta con nativo fresco, deps dadas, y espera el ready. */
async function boot(depsOver: Partial<IapDeps> = {}) {
  const fake = makeNative();
  const made = makeDeps(depsOver);
  configureIapDeps(made.deps);
  const release = acquireIapConnection(fake.native);
  await vi.waitFor(() => expect(getIapState().ready).toBe(true));
  return { ...fake, ...made, release };
}

let seq = 0;
const freshKey = () => `pt-${Date.now()}-${(seq += 1)}`;

let releaseCurrent: (() => void) | null = null;
beforeEach(() => {
  releaseCurrent?.();
  releaseCurrent = null;
  resetAllStores();
  clearIapPurchaseResult();
});

describe("conexión compartida (N pestañas → 1 listener)", () => {
  it("varias adquisiciones registran UN solo listener; la última liberación lo quita", async () => {
    const ctx = await boot();
    const release2 = acquireIapConnection(ctx.native);
    const release3 = acquireIapConnection(ctx.native);
    expect(ctx.native.initConnection).toHaveBeenCalledTimes(1);
    expect(ctx.native.purchaseUpdatedListener).toHaveBeenCalledTimes(1);

    release3();
    release2();
    expect(ctx.hasListener()).toBe(true); // aún queda una pestaña viva
    ctx.release();
    expect(ctx.hasListener()).toBe(false);
    expect(ctx.native.endConnection).toHaveBeenCalledTimes(1);
    expect(getIapState().ready).toBe(false);
  });

  it("re-configurar deps (token/catálogo nuevos) NO re-registra el listener nativo", async () => {
    const ctx = await boot();
    releaseCurrent = ctx.release;
    configureIapDeps(ctx.deps);
    configureIapDeps(ctx.deps);
    expect(ctx.native.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
    expect(ctx.native.purchaseErrorListener).toHaveBeenCalledTimes(1);
  });
});

describe("acknowledge tras validar (autorreembolso a los 3 días sin finish)", () => {
  it("valida en backend ANTES de finishTransaction; tokens/datos consumibles, licencia no", async () => {
    const order: string[] = [];
    const p = product({ id: "pr-lic", sku: "LIC_PRO", name: "Licencia Pro", productId: "lic_pro" });
    const ctx = await boot({
      resolveStoreProduct: vi.fn(async () => ({ kind: "license", product: p }) as const),
      validate: vi.fn(async () => { order.push("validate"); }),
    });
    releaseCurrent = ctx.release;
    (ctx.native.finishTransaction as ReturnType<typeof vi.fn>).mockImplementation(async () => order.push("finish"));

    ctx.deliver({ purchaseToken: freshKey(), productId: "lic_pro" });
    await waitForIapIdle();

    expect(order).toEqual(["validate", "finish"]);
    expect(ctx.native.finishTransaction).toHaveBeenCalledWith(expect.anything(), false); // licencia: NO consumible
    expect(ctx.events).toContainEqual({ type: "credited", resolved: { kind: "license", product: p } });
  });

  it("si la validación falla NO hay finish (la tienda re-entrega) y el flush posterior reintenta entera", async () => {
    const pk = pack();
    const validate = vi.fn(async (): Promise<void> => undefined);
    validate.mockRejectedValueOnce(new Error("backend caído"));
    const ctx = await boot({
      resolveStoreProduct: vi.fn(async () => ({ kind: "tokens", pack: pk }) as const),
      validate,
    });
    releaseCurrent = ctx.release;

    const purchase = { purchaseToken: freshKey(), productId: "tokens_500" };
    ctx.deliver(purchase);
    await waitForIapIdle();

    expect(ctx.native.finishTransaction).not.toHaveBeenCalled();
    expect(getIapState().purchaseResult).toMatchObject({ status: "error", kind: "tokens", quantity: 500 });

    // Reintento: la compra sigue "available" en la tienda → el flush la retoma
    // (el mock de validate solo fallaba la primera vez).
    (ctx.native.getAvailablePurchases as ReturnType<typeof vi.fn>).mockResolvedValue([purchase]);
    await flushPendingIapPurchases();

    expect(validate).toHaveBeenCalledTimes(2);
    expect(ctx.native.finishTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.native.finishTransaction).toHaveBeenCalledWith(expect.anything(), true); // tokens: consumible
    expect(getIapState().purchaseResult).toMatchObject({ status: "success", kind: "tokens" });
  });

  it("si el finish falla tras acreditar, la re-entrega reintenta SOLO el finish (sin doble crédito)", async () => {
    const pk = pack({ productId: "tokens_800", tokenAmount: 800 });
    const ctx = await boot({
      resolveStoreProduct: vi.fn(async () => ({ kind: "tokens", pack: pk }) as const),
    });
    releaseCurrent = ctx.release;
    const finish = ctx.native.finishTransaction as ReturnType<typeof vi.fn>;
    finish.mockRejectedValueOnce(new Error("Play no responde"));

    const purchase = { purchaseToken: freshKey(), productId: "tokens_800" };
    ctx.deliver(purchase);
    await waitForIapIdle();
    // Acreditada (el usuario tiene sus tokens) aunque el acknowledge quedó pendiente.
    expect(ctx.deps.validate).toHaveBeenCalledTimes(1);
    expect(getIapState().purchaseResult).toMatchObject({ status: "success", kind: "tokens" });

    // La tienda re-entrega (sigue sin acknowledge): NO se re-valida, solo se finaliza.
    ctx.deliver(purchase);
    await waitForIapIdle();
    expect(ctx.deps.validate).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(2);

    // Ya finalizada: una tercera entrega es un no-op total.
    ctx.deliver(purchase);
    await waitForIapIdle();
    expect(finish).toHaveBeenCalledTimes(2);
  });
});

describe("entrega doble", () => {
  it("la misma compra entregada dos veces se valida y finaliza UNA vez", async () => {
    const pr = product();
    const ctx = await boot({
      resolveStoreProduct: vi.fn(async () => ({ kind: "license", product: pr }) as const),
    });
    releaseCurrent = ctx.release;

    const purchase = { purchaseToken: freshKey(), productId: "app_unlock" };
    ctx.deliver(purchase);
    ctx.deliver(purchase); // re-entrega inmediata (p. ej. listener disparado doble)
    await waitForIapIdle();
    ctx.deliver(purchase); // y otra tardía, ya finalizada
    await waitForIapIdle();

    expect(ctx.deps.validate).toHaveBeenCalledTimes(1);
    expect(ctx.native.finishTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.events.filter((e) => e.type === "credited")).toHaveLength(1);
  });
});

describe("compras pendientes al arrancar / background / cold start desde la Store", () => {
  it("el flush drena getAvailablePurchases por el mismo camino (resuelve por catálogo, sin mapa en memoria)", async () => {
    const pk = pack({ productId: "tokens_cold", name: "Pack cold" });
    const pr = product({ id: "pr-cold", productId: "license_cold", name: "Licencia cold" });
    const resolveStoreProduct = vi.fn(async (id: string) =>
      id === "tokens_cold" ? ({ kind: "tokens", pack: pk } as const)
      : id === "license_cold" ? ({ kind: "license", product: pr } as const)
      : null);
    const ctx = await boot({ resolveStoreProduct });
    releaseCurrent = ctx.release;
    (ctx.native.getAvailablePurchases as ReturnType<typeof vi.fn>).mockResolvedValue([
      { purchaseToken: freshKey(), productId: "tokens_cold" },
      { purchaseToken: freshKey(), productId: "license_cold" },
    ]);

    await flushPendingIapPurchases();

    // Cold start real: nadie llamó registerPendingTokenPack; resolvió por catálogo.
    expect(resolveStoreProduct).toHaveBeenCalledWith("tokens_cold");
    expect(ctx.deps.validate).toHaveBeenCalledTimes(2);
    expect(ctx.native.finishTransaction).toHaveBeenCalledTimes(2);
    expect(ctx.events.filter((e) => e.type === "credited")).toHaveLength(2);
  });

  it("una compra llegada ANTES del login espera sin finish y se acredita tras autenticar", async () => {
    const pr = product({ id: "pr-pre", productId: "license_pre", name: "Licencia pre-login" });
    let token: string | null = null;
    const ctx = await boot({
      getToken: () => token,
      resolveStoreProduct: vi.fn(async () => ({ kind: "license", product: pr }) as const),
    });
    releaseCurrent = ctx.release;

    ctx.deliver({ purchaseToken: freshKey(), productId: "license_pre" });
    await waitForIapIdle();
    expect(ctx.deps.validate).not.toHaveBeenCalled();
    expect(ctx.native.finishTransaction).not.toHaveBeenCalled();

    token = "sess-nueva"; // login completado → el flush post-auth retoma la compra
    await flushPendingIapPurchases();
    expect(ctx.deps.validate).toHaveBeenCalledWith("sess-nueva", expect.anything(), expect.anything());
    expect(ctx.native.finishTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("resolución y errores", () => {
  it("un pack apuntado con registerPendingTokenPack se resuelve sin ir al catálogo", async () => {
    const pk = pack({ productId: "tokens_hot", name: "Pack hot" });
    const resolveStoreProduct = vi.fn(async () => null);
    const ctx = await boot({ resolveStoreProduct });
    releaseCurrent = ctx.release;

    registerPendingTokenPack("tokens_hot", pk);
    ctx.deliver({ purchaseToken: freshKey(), productId: "tokens_hot" });
    await waitForIapIdle();

    expect(resolveStoreProduct).not.toHaveBeenCalled();
    expect(getIapState().purchaseResult).toMatchObject({ status: "success", kind: "tokens", name: "Pack hot" });
  });

  it("producto desconocido: evento y SIN finish (no consumir lo que no se sabe acreditar)", async () => {
    const ctx = await boot({ resolveStoreProduct: vi.fn(async () => null) });
    releaseCurrent = ctx.release;

    ctx.deliver({ purchaseToken: freshKey(), productId: "sku_fantasma" });
    await waitForIapIdle();

    expect(ctx.events).toContainEqual({ type: "unknown-product", storeProductId: "sku_fantasma" });
    expect(ctx.native.finishTransaction).not.toHaveBeenCalled();
  });

  it("los errores de compra llegan como evento con el flag de cancelación del usuario", async () => {
    const ctx = await boot();
    releaseCurrent = ctx.release;
    ctx.fail({ message: "tarjeta rechazada", userCancelled: false });
    ctx.fail({ message: null, userCancelled: true });
    expect(ctx.events).toEqual([
      { type: "purchase-error", message: "tarjeta rechazada", userCancelled: false },
      { type: "purchase-error", message: null, userCancelled: true },
    ]);
  });

  it("logout → resetAllStores limpia packs apuntados, compras en espera y el resultado del modal", async () => {
    const pk = pack({ productId: "tokens_out", name: "Pack out" });
    let token: string | null = null;
    const resolveStoreProduct = vi.fn(async () => null);
    const ctx = await boot({ getToken: () => token, resolveStoreProduct });
    releaseCurrent = ctx.release;

    registerPendingTokenPack("tokens_out", pk);
    ctx.deliver({ purchaseToken: freshKey(), productId: "tokens_out" }); // queda esperando login

    resetAllStores();

    token = "sess-entrante";
    await flushPendingIapPurchases();
    // La compra en espera era de la sesión saliente: ya no se procesa…
    expect(ctx.deps.validate).not.toHaveBeenCalled();
    // …y el pack apuntado tampoco sobrevive: una compra nueva iría al catálogo.
    ctx.deliver({ purchaseToken: freshKey(), productId: "tokens_out" });
    await waitForIapIdle();
    expect(resolveStoreProduct).toHaveBeenCalledWith("tokens_out");
    expect(getIapState().purchaseResult).toBeNull();
  });
});

// El dedupe por purchaseToken protege la ENTREGA, no el LANZAMIENTO: dos toques
// en "Comprar" abrían dos hojas de tienda (en iOS = dos transacciones = doble
// cobro de un consumible). El cerrojo deja una sola compra en vuelo.
describe("cerrojo anti doble lanzamiento de compra", () => {
  it("el segundo toque NO obtiene turno mientras el primero sigue en vuelo", () => {
    expect(beginPurchaseLaunch("pack:pk-1")).toBe(true);
    expect(getIapState().launchingId).toBe("pack:pk-1");
    // Mismo botón (doble toque) y otro botón distinto: ambos rechazados.
    expect(beginPurchaseLaunch("pack:pk-1")).toBe(false);
    expect(beginPurchaseLaunch("data:pr-9")).toBe(false);
    expect(getIapState().launchingId).toBe("pack:pk-1");
  });

  it("la respuesta de la tienda (compra entregada) suelta el cerrojo", async () => {
    const ctx = await boot({
      resolveStoreProduct: vi.fn(async () => ({ kind: "tokens" as const, pack: pack({ productId: "tokens_lock" }) })),
    });
    releaseCurrent = ctx.release;

    expect(beginPurchaseLaunch("pack:pk-1")).toBe(true);
    ctx.deliver({ purchaseToken: freshKey(), productId: "tokens_lock" });
    await waitForIapIdle();

    expect(getIapState().launchingId).toBeNull();
    expect(beginPurchaseLaunch("pack:pk-2")).toBe(true);
  });

  it("un error/cancelación de la tienda suelta el cerrojo (no deja el botón muerto)", async () => {
    const ctx = await boot();
    releaseCurrent = ctx.release;

    expect(beginPurchaseLaunch("data:pr-1")).toBe(true);
    ctx.fail({ message: null, userCancelled: true });

    expect(getIapState().launchingId).toBeNull();
  });

  it("backstop: si la tienda NUNCA responde, el cerrojo caduca solo", () => {
    vi.useFakeTimers();
    try {
      expect(beginPurchaseLaunch("pack:pk-1")).toBe(true);
      vi.advanceTimersByTime(14_999);
      expect(getIapState().launchingId).toBe("pack:pk-1");
      vi.advanceTimersByTime(2);
      expect(getIapState().launchingId).toBeNull();
      expect(beginPurchaseLaunch("pack:pk-1")).toBe(true);
    } finally {
      endPurchaseLaunch();
      vi.useRealTimers();
    }
  });

  it("logout suelta el cerrojo (la cuenta entrante puede comprar de inmediato)", () => {
    expect(beginPurchaseLaunch("pack:pk-1")).toBe(true);
    resetAllStores();
    expect(getIapState().launchingId).toBeNull();
    expect(beginPurchaseLaunch("pack:pk-1")).toBe(true);
    endPurchaseLaunch();
  });
});
