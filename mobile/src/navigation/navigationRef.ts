// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Registro de `NavigationContainerRef` POR PESTAÑA (fase B1).
 *
 * Cada `MainTab` monta su PROPIO árbol de navegación independiente
 * (NavigationIndependentTree > NavigationContainer), así que NO hay un ref
 * global único: se expone una factoría/registro por `tabId`. El ref se crea
 * perezosamente al pedirlo y se libera al cerrar la pestaña
 * (`disposeNavigationRef`, lo llama TabNavigator al desmontar).
 *
 * B3 movió las pestañas al `tab-sessions-store` module-level, pero el colapso a
 * un ref/árbol único se re-secuenció DESPUÉS de B4: mientras el estado por
 * pestaña viva en `useMainTabController` (montado por MainTab), desmontar tabs
 * inactivos relanzaría su bootstrap (splash + refetch) y mataría el webview de
 * la vista ssh. Con los stores por dominio de B4 el colapso es seguro.
 */
import { createNavigationContainerRef, type NavigationContainerRefWithCurrent } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

const refsByTab = new Map<string, NavigationContainerRefWithCurrent<RootStackParamList>>();

/** Devuelve (creándolo si no existe) el ref del árbol de navegación del tab. */
export function getNavigationRef(tabId: string): NavigationContainerRefWithCurrent<RootStackParamList> {
  let ref = refsByTab.get(tabId);
  if (!ref) {
    ref = createNavigationContainerRef<RootStackParamList>();
    refsByTab.set(tabId, ref);
  }
  return ref;
}

/** Libera el ref del tab (al desmontar su árbol; p. ej. al cerrar la pestaña). */
export function disposeNavigationRef(tabId: string): void {
  refsByTab.delete(tabId);
}
