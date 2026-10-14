// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Wiring de `purchase-lifecycle` (puro) a react-native-iap. ÚNICO punto del
 * repo que importa la librería nativa para el ciclo de compras: el hook
 * adquiere la conexión con `acquireIapConnection(iapNative)` y el resto del
 * ciclo no sabe de react-native-iap (testeable en vitest sin nativo).
 */
import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  getAvailablePurchases,
  ErrorCode,
  type Purchase,
  type PurchaseError,
} from "react-native-iap";
import type { IapNative, IapPurchase } from "./purchase-lifecycle";

export const iapNative: IapNative = {
  initConnection: () => initConnection(),
  endConnection: () => endConnection(),
  purchaseUpdatedListener: (cb) =>
    purchaseUpdatedListener((purchase: Purchase) => cb(purchase as IapPurchase)),
  purchaseErrorListener: (cb) =>
    purchaseErrorListener((error: PurchaseError) =>
      cb({ message: error.message ?? null, userCancelled: error.code === ErrorCode.UserCancelled })),
  finishTransaction: (purchase, isConsumable) =>
    finishTransaction({ purchase: purchase as unknown as Purchase, isConsumable }),
  getAvailablePurchases: () => getAvailablePurchases(),
};
