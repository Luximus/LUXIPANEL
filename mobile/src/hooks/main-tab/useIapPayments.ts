import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { fetchProducts, requestPurchase } from "react-native-iap";
import {
  getPaymentHistory,
  getPaymentProducts,
  validatePlaySubscription,
  validateAppleSubscription,
  type PaymentRow,
  type ProductRow,
} from "../../api/client";
import { getTokenPacks, verifyTokenIap, type TokenPack } from "../../api/billing";
import {
  acquireIapConnection,
  configureIapDeps,
  endPurchaseLaunch,
  flushPendingIapPurchases,
  registerPendingTokenPack,
  unregisterPendingTokenPack,
  useIapState,
} from "../../features/iap/purchase-lifecycle";
import { iapNative } from "../../features/iap/native";
import type { View } from "../../features/app/types";
import type { Messages } from "../../i18n";
import { IAP_PACKAGE_NAME } from "./helpers";

/**
 * Sub-hook COHESIVO extraído de `useMainTabController` (fase de refactor <1000
 * líneas): dominio PAGOS + IAP — modal de pagos, historial/catálogo, versión de
 * saldos, ciclo de vida IAP compartido (B4) y las compras (plan anual + packs de
 * tokens). Código movido verbatim; el estado compartido entra por parámetros.
 * Sus efectos son autocontenidos (conexión IAP, deps del ciclo, flush y bump de
 * balancesVersion): ningún otro efecto del controlador depende de su orden.
 */
export function useIapPayments({ token, t, setView }: {
  token: string | null;
  t: Messages;
  setView: (view: View) => void;
}) {
  // Pagos (compras de tokens) es un MODAL global (`PaymentsModal`);
  // `paymentsOpen` lo controla y la vista de fondo (dashboard/etc.) no cambia al
  // abrirlo. El modal de compras tiene Tokens/Historial.
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [busyPayments, setBusyPayments] = useState(false);
  // IAP (B4): la conexión, el ÚNICO listener, el dedupe de compras y el
  // resultado del modal post-compra viven en `features/iap/purchase-lifecycle`
  // (module-store compartido por todas las pestañas); aquí solo se consume el
  // estado reactivo. `purchaseSignal` sube al acreditar cualquier compra para
  // que PaymentsScreen recargue su saldo.
  const { ready: iapReady, purchaseSignal: tokenPurchaseSignal, purchaseResult } = useIapState();

  // Versión de saldos que las pantallas con saldo propio (tokens) incluyen en
  // deps para re-consultar. Bumpea tras una compra acreditada.
  const [balancesVersion, setBalancesVersion] = useState(0);

  // Tras una compra acreditada (la IAP de tokens bumpea `tokenPurchaseSignal`)
  // bumpea `balancesVersion` para que las pantallas de saldo re-consulten.
  useEffect(() => {
    if (!tokenPurchaseSignal) return;
    setBalancesVersion((version) => version + 1);
  }, [tokenPurchaseSignal]);

  // Pagos: pantalla de facturación completa (datos/tokens/consumo/desembolso/
  // historial). El desembolso de tokens vive además como pestaña "Pagos" del
  // modal de cuenta (PayoutSection), pero la pantalla amplia sigue siendo una
  // vista propia accesible por el carrusel/recarga/consumo.
  const openPaymentsView = () => {
    if (!token) { setView("login"); return; }
    setPaymentsOpen(true);
    if (paymentRows.length === 0 && productRows.length === 0) {
      setBusyPayments(true);
      Promise.all([
        getPaymentHistory(token),
        getPaymentProducts(token, "app"),
      ]).then(([ph, pp]) => {
        setPaymentRows(ph);
        setProductRows(pp);
      }).catch(() => {}).finally(() => setBusyPayments(false));
    }
  };
  const goToPaymentsView = () => openPaymentsView();
  const closePayments = () => setPaymentsOpen(false);

  const refreshPayments = useCallback(async () => {
    if (!token) return;
    setBusyPayments(true);
    try {
      const [ph, pp] = await Promise.all([
        getPaymentHistory(token),
        getPaymentProducts(token, "app"),
      ]);
      setPaymentRows(ph);
      setProductRows(pp);
    } finally {
      setBusyPayments(false);
    }
  }, [token]);

  // IAP (B4): adquiere la conexión COMPARTIDA del módulo purchase-lifecycle.
  // La primera pestaña conecta y registra el único par de listeners; la última
  // en desmontarse libera. El cleanup es la función de liberación.
  useEffect(() => acquireIapConnection(iapNative), []);

  // Deps de dominio del ciclo IAP. Se re-configuran en cada render (asignación
  // barata) para capturar token/catálogo/i18n frescos SIN re-registrar el
  // listener nativo — re-registrarlo por cambio de token/productRows era el
  // vector de entrega doble. Entre pestañas las deps son equivalentes: gana la
  // última en configurar.
  useEffect(() => {
    const matchStore = <T extends { productId?: string | null; playStoreSku?: string | null; appleStoreSku?: string | null }>(
      rows: T[],
      storeProductId: string,
    ): T | undefined =>
      // Empareja por el MISMO product_id registrado en la tienda (Play
      // "Product ID", separador "_"); fallback a los SKUs legacy por si la
      // fila aún no trae product_id.
      rows.find((r) => (r.productId ?? (Platform.OS === "android" ? r.playStoreSku : r.appleStoreSku)) === storeProductId);

    configureIapDeps({
      getToken: () => token ?? null,
      resolveStoreProduct: async (storeProductId) => {
        // Los únicos productos IAP de app son la suscripción anual "app-unlock"
        // (kind="license"); los packs de datos (MB) se retiraron.
        const inMemory = matchStore(productRows, storeProductId);
        if (inMemory) return { kind: "license", product: inMemory };
        if (!token) return null;
        // Cold start (compra entregada antes de cargar el catálogo en memoria):
        // resolver contra la API, packs de tokens y productos a la vez.
        const [packs, products] = await Promise.all([
          getTokenPacks(token, "mobile").catch(() => [] as TokenPack[]),
          getPaymentProducts(token, "app").catch(() => [] as ProductRow[]),
        ]);
        const pack = matchStore(packs, storeProductId);
        if (pack) return { kind: "tokens", pack };
        const productRow = matchStore(products, storeProductId);
        return productRow ? { kind: "license", product: productRow } : null;
      },
      validate: async (sessionToken, resolved, purchase) => {
        const purchaseToken = purchase.purchaseToken ?? "";
        const storeProductId = purchase.productId ?? "";
        if (resolved.kind === "tokens") {
          // Pack de tokens (modelo nuevo) — validar contra /portal/tokens/iap/verify.
          if (Platform.OS === "android") {
            await verifyTokenIap(sessionToken, {
              platform: "google",
              productId: resolved.pack.id,
              packageName: IAP_PACKAGE_NAME,
              purchaseToken,
              productToken: storeProductId,
            });
          } else {
            await verifyTokenIap(sessionToken, {
              platform: "apple",
              productId: resolved.pack.id,
              receipt: purchase.transactionReceipt ?? "",
              transactionId: purchase.transactionId ?? purchaseToken,
            });
          }
          return;
        }
        // Licencia = suscripción anual "app-unlock" (product_kind="license"): se
        // valida contra los endpoints de SUSCRIPCIÓN del backend. El finish sigue
        // siendo no-consumible (ver `isConsumable` en purchase-lifecycle:
        // kind==="license" → acknowledge).
        if (Platform.OS === "android") {
          await validatePlaySubscription(sessionToken, {
            productId: resolved.product.id,
            packageName: IAP_PACKAGE_NAME,
            purchaseToken,
          });
        } else {
          await validateAppleSubscription(sessionToken, {
            productId: resolved.product.id,
            receiptData: purchase.transactionReceipt ?? "",
          });
        }
      },
      onEvent: (evt) => {
        // El purchaseResult del modal y el purchaseSignal ya los pone el módulo;
        // aquí solo lo que necesita UI/estado de esta capa (alerts + refresh).
        if (evt.type === "credited" && evt.resolved.kind !== "tokens") {
          void refreshPayments(); // la licencia (app-unlock) toca historial/estado de pagos
        } else if (evt.type === "unknown-product") {
          Alert.alert(t.common.error, t.payments.iapProductNotFound);
        } else if (evt.type === "validate-failed" && evt.resolved.kind === "license") {
          // Los tokens ya muestran su error en el modal post-compra.
          Alert.alert(t.common.error, t.payments.iapValidatePurchaseFailed);
        } else if (evt.type === "purchase-error" && !evt.userCancelled) {
          Alert.alert(t.payments.iapPurchaseErrorTitle, evt.message ?? t.payments.iapTryAgain);
        }
      },
    });
  });

  // Compras pendientes: con la tienda lista y sesión puesta, drena lo que la
  // Store tenga sin finalizar (compra en background, cold start desde la Store,
  // finish fallido de una sesión anterior) y lo comprado antes del login.
  // Idempotente: el dedupe por compra hace inocuo que varias pestañas lo llamen.
  useEffect(() => {
    if (iapReady && token) void flushPendingIapPurchases();
  }, [iapReady, token]);

  const purchasePlan = useCallback(async (productId: string, nativePlatform: "ios" | "android") => {
    void nativePlatform;
    if (!iapReady) {
      Alert.alert(t.common.error, t.payments.iapStoreUnavailable);
      return;
    }
    const product = productRows.find((p) => p.id === productId);
    if (!product) return;

    // Usa el product_id de la BD (= Play "Product ID", separador "_") como id de
    // tienda para consultar y comprar; fallback a los SKUs legacy.
    const storeSku = product.productId
      ?? (Platform.OS === "android" ? product.playStoreSku : product.appleStoreSku)
      ?? null;

    if (!storeSku) {
      Alert.alert(t.common.error, t.payments.iapProductUnavailablePlatform);
      return;
    }

    try {
      await fetchProducts({ skus: [storeSku], type: "in-app" });
      await requestPurchase({
        request: Platform.OS === "android"
          ? { android: { skus: [storeSku] } }
          : { apple: { sku: storeSku } },
        type: "in-app",
      });
    } catch (err) {
      // La tienda no llegó a abrir: ningún listener disparará, así que hay que
      // soltar el cerrojo aquí o los botones quedan muertos hasta que expire.
      endPurchaseLaunch();
      const msg = err instanceof Error ? err.message : t.payments.iapPurchaseStartFailed;
      Alert.alert(t.common.error, msg);
    }
  }, [iapReady, productRows]);

  // Compra de un pack de tokens por IAP. El listener valida y acredita.
  const purchaseTokenPack = useCallback(async (pack: TokenPack) => {
    if (!iapReady) {
      Alert.alert(t.common.error, t.payments.iapStoreUnavailable);
      return;
    }
    const storeSku = pack.productId
      ?? (Platform.OS === "android" ? pack.playStoreSku : pack.appleStoreSku)
      ?? null;
    if (!storeSku) {
      Alert.alert(t.common.error, t.payments.iapPackUnavailablePlatform);
      return;
    }
    // Clave = product_id de tienda; el ciclo resuelve el pack por el id que
    // devuelve Play (que es este mismo product_id registrado en Play Console).
    registerPendingTokenPack(storeSku, pack);
    try {
      await fetchProducts({ skus: [storeSku], type: "in-app" });
      await requestPurchase({
        request: Platform.OS === "android"
          ? { android: { skus: [storeSku] } }
          : { apple: { sku: storeSku } },
        type: "in-app",
      });
    } catch (err) {
      unregisterPendingTokenPack(storeSku);
      endPurchaseLaunch();
      const msg = err instanceof Error ? err.message : t.payments.iapPurchaseStartFailed;
      Alert.alert(t.common.error, msg);
    }
  }, [iapReady]);

  return {
    paymentsOpen, openPaymentsView, goToPaymentsView, closePayments,
    balancesVersion,
    paymentRows, productRows, busyPayments, refreshPayments,
    purchasePlan, purchaseTokenPack,
    iapReady, tokenPurchaseSignal, purchaseResult,
  };
}
