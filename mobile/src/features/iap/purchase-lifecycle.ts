// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Ciclo de vida ÚNICO de compras IAP (fase B4: N listeners → 1).
 *
 * Antes cada MainTab montaba su propio `initConnection` + par de listeners en
 * `useMainTabController` (N pestañas = N listeners): una compra podía validarse
 * y acreditarse N veces en paralelo, y el unmount de una pestaña cortaba la
 * conexión de todas. Este módulo es el ÚNICO dueño de la conexión y del
 * listener de compras, a nivel de módulo (patrón module-store +
 * `useSyncExternalStore`, como el resto del repo); las pestañas solo adquieren
 * una referencia contada y comparten el estado.
 *
 * Garantías del ciclo (prioridades de QA para dispositivo):
 * - **Acknowledge o reembolso**: `finishTransaction` se llama SOLO tras validar
 *   en el backend. Si el finish falla, la compra queda en `validated` y el
 *   siguiente flush/entrega reintenta SOLO el finish (sin re-acreditar) — una
 *   compra sin acknowledge se autorreembolsa a los 3 días en Play.
 * - **Entrega doble**: dedupe por `purchaseToken` (`finished`/`processing`);
 *   re-registrar deps NUNCA re-registra el listener nativo.
 * - **Compra en background / cold start desde la Store / pendientes al
 *   arrancar**: `flushPendingIapPurchases()` drena `getAvailablePurchases()`
 *   por el MISMO camino que el listener; la resolución de producto no depende
 *   del mapa de packs en compra (cae al catálogo vía `deps.resolveStoreProduct`).
 * - **Compra antes del login**: sin token de sesión la compra espera en
 *   `waitingForAuth` (sin finish); el flush tras autenticar la procesa.
 *
 * PURO: sin imports de react-native-iap ni RN — el nativo entra por
 * `acquireIapConnection(native)` (ver `./native.ts`) y el dominio por
 * `configureIapDeps`. Testeable en vitest.
 */
import { useSyncExternalStore } from "react";
import { registerStoreReset } from "../../lib/store-reset";
import type { TokenPack } from "../../api/billing";
import type { ProductRow } from "../../api/client";

// ── Tipos públicos ───────────────────────────────────────────────────────────

/** Subconjunto del `Purchase` de react-native-iap que consume el ciclo. */
export type IapPurchase = {
  purchaseToken?: string | null;
  productId?: string | null;
  transactionId?: string | null;
  transactionReceipt?: string | null;
};

/** product_id de tienda resuelto a su entidad de negocio. */
export type ResolvedStoreProduct =
  | { kind: "tokens"; pack: TokenPack }
  | { kind: "license"; product: ProductRow };

/** Eventos que el dueño de las deps traduce a UI (alerts / refresh). El
 *  purchaseResult del modal post-compra y el signal ya los mantiene el store. */
export type IapEvent =
  | { type: "credited"; resolved: ResolvedStoreProduct }
  | { type: "validate-failed"; resolved: ResolvedStoreProduct }
  | { type: "unknown-product"; storeProductId: string }
  | { type: "purchase-error"; message: string | null; userCancelled: boolean };

export type IapDeps = {
  /** Token de sesión vigente (null = sin login: la compra espera). */
  getToken: () => string | null;
  /** Resuelve un product_id de tienda a pack/producto. Debe cubrir el cold
   *  start: si el catálogo en memoria aún no está, consultar la API. */
  resolveStoreProduct: (storeProductId: string) => Promise<ResolvedStoreProduct | null>;
  /** Acredita la compra en el backend (lanza si falla). */
  validate: (sessionToken: string, resolved: ResolvedStoreProduct, purchase: IapPurchase) => Promise<void>;
  onEvent: (evt: IapEvent) => void;
};

/** Superficie nativa inyectada (react-native-iap envuelto en `./native.ts`). */
export type IapNative = {
  initConnection: () => Promise<unknown>;
  endConnection: () => Promise<unknown>;
  purchaseUpdatedListener: (cb: (purchase: IapPurchase) => void) => { remove: () => void };
  purchaseErrorListener: (cb: (error: { message: string | null; userCancelled: boolean }) => void) => { remove: () => void };
  finishTransaction: (purchase: IapPurchase, isConsumable: boolean) => Promise<unknown>;
  getAvailablePurchases: () => Promise<IapPurchase[]>;
};

export type IapPurchaseResult = {
  status: "success" | "error";
  kind: "tokens";
  quantity?: number;
  name: string;
} | null;

type IapState = {
  ready: boolean;
  /** Se incrementa al acreditar cualquier compra: las pestañas lo observan
   *  para recargar wallet/pagos. */
  purchaseSignal: number;
  /** Resultado de la última compra de tokens para el modal post-compra
   *  (las licencias no muestran modal, solo refrescan pagos). */
  purchaseResult: IapPurchaseResult;
  /** Id (de negocio) de la compra cuya HOJA DE TIENDA se está abriendo ahora
   *  mismo; `null` = ninguna. La UI deshabilita los botones "Comprar" mientras
   *  no sea null (ver `beginPurchaseLaunch`). */
  launchingId: string | null;
};

// ── Store reactivo ───────────────────────────────────────────────────────────

let state: IapState = { ready: false, purchaseSignal: 0, purchaseResult: null, launchingId: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<IapState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getIapState(): IapState {
  return state;
}

export function useIapState(): IapState {
  return useSyncExternalStore(subscribe, () => state);
}

export function clearIapPurchaseResult(): void {
  if (state.purchaseResult) setState({ purchaseResult: null });
}

// ── Anti doble lanzamiento de compra ─────────────────────────────────────────
//
// El dedupe por `purchaseToken` protege la ENTREGA (no se acredita dos veces la
// misma compra), pero NO el LANZAMIENTO: dos toques seguidos en "Comprar" hacían
// dos `requestPurchase` del mismo SKU. En Android el segundo choca con el flujo
// en curso (error espurio); en iOS StoreKit ENCOLA los dos pagos → dos
// transacciones distintas → el usuario paga DOS VECES un consumible. Este
// cerrojo deja una única compra "en vuelo" y la UI se apaga mientras dure.
//
// Se libera en cuanto la tienda responde (compra entregada o error/cancelación) y,
// como red de seguridad —`requestPurchase` puede fallar en el llamador sin que
// ningún listener dispare—, a lo sumo tras `PURCHASE_LAUNCH_WINDOW_MS`.

const PURCHASE_LAUNCH_WINDOW_MS = 15_000;
let launchTimer: ReturnType<typeof setTimeout> | null = null;

/** Reserva el turno para abrir la hoja de compra de `id` (id de negocio: pack o
 *  producto). Devuelve `false` si ya hay una compra lanzándose → el llamador NO
 *  debe llamar a `requestPurchase`. */
export function beginPurchaseLaunch(id: string): boolean {
  if (state.launchingId !== null) return false;
  if (launchTimer) clearTimeout(launchTimer);
  launchTimer = setTimeout(() => {
    launchTimer = null;
    endPurchaseLaunch();
  }, PURCHASE_LAUNCH_WINDOW_MS);
  setState({ launchingId: id });
  return true;
}

/** Libera el cerrojo (la tienda respondió, o higiene de sesión). Idempotente. */
export function endPurchaseLaunch(): void {
  if (launchTimer) {
    clearTimeout(launchTimer);
    launchTimer = null;
  }
  if (state.launchingId !== null) setState({ launchingId: null });
}

// ── Estado interno del ciclo ─────────────────────────────────────────────────

let native: IapNative | null = null;
let deps: IapDeps | null = null;
let acquireCount = 0;
let purchaseSub: { remove: () => void } | null = null;
let errorSub: { remove: () => void } | null = null;
/** Invalida la resolución de un initConnection que llegue tras el release. */
let connectEpoch = 0;

/** Compras acreditadas Y finalizadas: no volver a tocarlas (entrega doble). */
const finishedKeys = new Set<string>();
/** Acreditadas en backend pero con finish fallido: reintentar SOLO el finish. */
const validatedKeys = new Set<string>();
/** En proceso ahora mismo (el listener puede re-entregar durante la validación). */
const processingKeys = new Set<string>();
/** Compras llegadas sin token de sesión (cold start pre-login). */
let waitingForAuth: IapPurchase[] = [];
/** Packs de tokens en compra (clave = product_id de tienda): resolución rápida
 *  del flujo normal; el cold start NO depende de este mapa. */
let pendingTokenPacks: Record<string, TokenPack> = {};
/** Cola SERIAL: las validaciones/finish no se intercalan entre compras. */
let queue: Promise<void> = Promise.resolve();
let flushing = false;

function purchaseKey(purchase: IapPurchase): string | null {
  return purchase.purchaseToken || purchase.transactionId || null;
}

function enqueuePurchase(purchase: IapPurchase): void {
  queue = queue.then(() => processPurchase(purchase)).catch(() => {});
}

/** Espera a que la cola vacíe lo encolado hasta ahora (tests / flush). */
export function waitForIapIdle(): Promise<void> {
  return queue;
}

function emitCredited(resolved: ResolvedStoreProduct): void {
  if (resolved.kind === "tokens") {
    setState({
      purchaseSignal: state.purchaseSignal + 1,
      purchaseResult: { status: "success", kind: "tokens", quantity: resolved.pack.tokenAmount, name: resolved.pack.name },
    });
  } else {
    // Licencia (app-unlock): sin modal post-compra, solo bumpea el signal para
    // que las pestañas recarguen su estado.
    setState({ purchaseSignal: state.purchaseSignal + 1 });
  }
  deps?.onEvent({ type: "credited", resolved });
}

function emitValidateFailed(resolved: ResolvedStoreProduct): void {
  if (resolved.kind === "tokens") {
    setState({ purchaseResult: { status: "error", kind: "tokens", quantity: resolved.pack.tokenAmount, name: resolved.pack.name } });
  }
  deps?.onEvent({ type: "validate-failed", resolved });
}

async function processPurchase(purchase: IapPurchase): Promise<void> {
  const n = native;
  const d = deps;
  if (!n || !d) return;
  const key = purchaseKey(purchase);
  if (!key) return; // sin token de compra no hay nada que validar ni finalizar
  if (finishedKeys.has(key) || processingKeys.has(key)) return;

  const sessionToken = d.getToken();
  if (!sessionToken) {
    // Cold start antes del login: conservar SIN finish; el flush post-auth la retoma.
    if (!waitingForAuth.some((w) => purchaseKey(w) === key)) waitingForAuth.push(purchase);
    return;
  }

  processingKeys.add(key);
  try {
    const storeProductId = purchase.productId ?? null;
    const pending = storeProductId ? pendingTokenPacks[storeProductId] : undefined;
    const resolved: ResolvedStoreProduct | null = pending
      ? { kind: "tokens", pack: pending }
      : storeProductId
        ? await d.resolveStoreProduct(storeProductId)
        : null;

    if (!resolved) {
      // NO finalizar: consumir algo que no sabemos acreditar perdería la compra.
      d.onEvent({ type: "unknown-product", storeProductId: storeProductId ?? "" });
      return;
    }

    if (!validatedKeys.has(key)) {
      try {
        await d.validate(sessionToken, resolved, purchase);
        validatedKeys.add(key);
      } catch {
        // Sin finish: la tienda re-entrega y el próximo flush reintenta entera.
        emitValidateFailed(resolved);
        return;
      }
    }

    // Los tokens son consumibles (recomprables); las licencias no.
    const isConsumable = resolved.kind !== "license";
    try {
      await n.finishTransaction(purchase, isConsumable);
    } catch {
      // Acreditada pero sin acknowledge: `validatedKeys` hace que la próxima
      // entrega/flush reintente SOLO el finish (sin doble crédito). El usuario
      // ya tiene su compra: se reporta como éxito.
      emitCredited(resolved);
      return;
    }
    finishedKeys.add(key);
    validatedKeys.delete(key);
    if (resolved.kind === "tokens" && storeProductId) delete pendingTokenPacks[storeProductId];
    emitCredited(resolved);
  } finally {
    processingKeys.delete(key);
  }
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Adquiere la conexión IAP compartida (ref-count). La PRIMERA adquisición
 * conecta y registra el único par de listeners; la última liberación los quita
 * y cierra la conexión. Devuelve la función de liberación (cleanup del efecto).
 */
export function acquireIapConnection(n: IapNative): () => void {
  acquireCount += 1;
  if (acquireCount === 1) {
    native = n;
    const epoch = ++connectEpoch;
    // La tienda respondió (entrega o error/cancelación): el cerrojo de lanzamiento
    // se suelta ya, sin esperar al backstop, y los botones "Comprar" reviven.
    purchaseSub = n.purchaseUpdatedListener((purchase) => {
      endPurchaseLaunch();
      enqueuePurchase(purchase);
    });
    errorSub = n.purchaseErrorListener((error) => {
      endPurchaseLaunch();
      deps?.onEvent({ type: "purchase-error", ...error });
    });
    n.initConnection()
      .then(() => {
        if (epoch === connectEpoch) setState({ ready: true });
      })
      .catch(() => {});
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    acquireCount -= 1;
    if (acquireCount > 0) return;
    connectEpoch += 1;
    purchaseSub?.remove();
    errorSub?.remove();
    purchaseSub = null;
    errorSub = null;
    const closing = native;
    native = null;
    // Sin listeners ya nadie soltaría el cerrojo: se libera aquí (y con él su
    // timer, que de otro modo quedaría vivo tras desmontar la última pestaña).
    endPurchaseLaunch();
    if (state.ready) setState({ ready: false });
    void closing?.endConnection();
  };
}

/** Re-configura las deps de dominio SIN tocar el listener nativo (la clave del
 *  fix de entrega doble: cambiar token/catálogo ya no re-registra nada). */
export function configureIapDeps(d: IapDeps): void {
  deps = d;
}

/** Apunta un pack de tokens en compra para resolverlo sin ir al catálogo
 *  (flujo normal en caliente). Se limpia solo al acreditar+finalizar. */
export function registerPendingTokenPack(storeSku: string, pack: TokenPack): void {
  pendingTokenPacks[storeSku] = pack;
}

/** Retira un pack apuntado cuando `requestPurchase` ni siquiera arrancó. */
export function unregisterPendingTokenPack(storeSku: string): void {
  delete pendingTokenPacks[storeSku];
}

/**
 * Drena las compras pendientes: las que esperaban login (`waitingForAuth`) y
 * las que la tienda tenga sin finalizar (`getAvailablePurchases`: compra en
 * background, cold start desde la Store, finish fallido de una sesión
 * anterior). Idempotente: el dedupe por clave hace inocuo llamarlo de más.
 */
export async function flushPendingIapPurchases(): Promise<void> {
  const n = native;
  const d = deps;
  if (!n || !d || !state.ready || flushing) return;
  if (!d.getToken()) return;
  flushing = true;
  try {
    const waited = waitingForAuth;
    waitingForAuth = [];
    for (const purchase of waited) enqueuePurchase(purchase);
    const available = await n.getAvailablePurchases().catch(() => [] as IapPurchase[]);
    for (const purchase of available) enqueuePurchase(purchase);
    await waitForIapIdle();
  } finally {
    flushing = false;
  }
}

// Higiene de sesión (logout / cambio de cuenta): lo que es del usuario saliente
// se descarta. Los sets de dedupe (`finished`/`validated`) se CONSERVAN: son
// estado de la tienda del dispositivo, y olvidarlos permitiría re-acreditar la
// misma compra tras un switch de cuenta.
registerStoreReset(() => {
  pendingTokenPacks = {};
  waitingForAuth = [];
  endPurchaseLaunch();
  if (state.purchaseResult) setState({ purchaseResult: null });
});
