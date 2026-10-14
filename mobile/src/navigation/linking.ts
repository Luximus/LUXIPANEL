// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Stub de deep-linking del navigator — se completa al colapsar a un árbol
 * único (re-secuenciado tras B4; ver navigation/navigationRef.ts).
 *
 * El deep-linking ACTUAL de la app NO pasa por react-navigation y NO debe
 * tocarse en B1: `MainScreen` escucha `Linking.addEventListener("url")` +
 * `Linking.getInitialURL()` y encamina la URL al handler de la pestaña activa
 * (`registerShareLinkHandler` → `ctrl.handleIncomingShareLink`), y las push
 * llegan por `getInitialNotificationTap`/`addNotificationTapListener` →
 * `ctrl.focusServerPanel`. Ambos caminos terminan en `setView(...)`, que el
 * TabNavigator ya refleja (sync ctrl.view → stack), así que los deep links
 * siguen funcionando sin `linking`.
 *
 * Al colapsar, este archivo definirá el `LinkingOptions<RootStackParamList>`
 * real (prefijos + config de rutas) y los listeners manuales de arriba
 * migrarán aquí.
 */
import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/** B1: sin linking declarativo (ver doc de arriba). NO pasar al contenedor aún. */
export const linking: LinkingOptions<RootStackParamList> | undefined = undefined;
