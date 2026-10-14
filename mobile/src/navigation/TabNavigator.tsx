// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Núcleo de navegación POR PESTAÑA (fase B1, transicional).
 *
 * Monta un árbol react-navigation INDEPENDIENTE por cada `MainTab`:
 * NavigationIndependentTree > NavigationContainer > native-stack con las vistas
 * actuales de `ctrl.view` registradas como screens. `ctrl.view` sigue siendo la
 * FUENTE DE VERDAD: un efecto sincroniza view → stack (`resetRoot` a la ruta
 * equivalente), de modo que TODA la lógica existente (setView del controller,
 * deep links, push, restore de pestañas) sigue funcionando sin tocar
 * `useMainTabController`.
 *
 * B3 sacó las pestañas al `tab-sessions-store` (persistencia v2 + persistedRoute
 * del chat). El colapso de los N árboles independientes a UN contenedor se
 * re-secuenció tras B4 (ver navigation/navigationRef.ts): requiere que el
 * estado por pestaña salga del god-hook para no rehacer su bootstrap al
 * desmontar tabs inactivos.
 *
 * Decisiones de fase (revisar al colapsar):
 * - El stack vive con UNA ruta de VISTA (reset, nunca push) y, desde B2, puede
 *   apilar ENCIMA una ruta de SESIÓN (`Terminal` / `ModuleWebView`) mientras
 *   hay una consola tmux o un webview de módulo activos. El BackHandler manual
 *   de `MainTab` sigue resolviendo el botón atrás ÍNTEGRO (modales →
 *   overlays/drawers → sesión activa → vista ssh → historial de vistas →
 *   dashboard); la ruta de sesión se sincroniza desde los stores de sesión
 *   (efecto en MainTab) y NUNCA la pop-ea react-navigation por su cuenta antes
 *   que los handlers manuales. Si `ctrl.view` cambia con una sesión apilada,
 *   el reset la desmonta (la sesión sigue viva en el SessionHost) y el
 *   listener de reconciliación de MainTab la marca inactiva.
 * - `headerShown: false` + `animation: "none"`: las vistas actuales no esperan
 *   transiciones del stack (`RouteTransition` ya anima el contenido); activar
 *   transiciones nativas es decisión de B3.
 * - `freezeOnBlur` DESACTIVADO (default): con una sola ruta no hay screens
 *   blureadas que congelar, y los MainTab inactivos ya van ocultos con
 *   `display:none` desde MainScreen; activarlo aquí no aporta y añade riesgo.
 * - Fondo TRANSPARENTE (tema + contentStyle): las vistas pintan sobre el fondo
 *   del SafeAreaView de MainScreen (tokens del tema), igual que antes de
 *   introducir el navigator (el fondo por defecto del stack lo taparía).
 * - Cada screen renderiza EXACTAMENTE el JSX que antes vivía en los
 *   early-returns / montajes condicionales de `MainTab`: llega como closure en
 *   `renderers` (render-props) para NO mover lógica del controller.
 */
import React, { useCallback, useEffect } from "react";
import { DefaultTheme, NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { View } from "../features/app/types";
import { disposeNavigationRef, getNavigationRef } from "./navigationRef";
import { ALL_ROUTE_NAMES, VIEW_TO_ROUTE, type RootRouteName, type RootStackParamList, type RootStackScreenProps } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Tema con fondo transparente: el color de fondo real lo sigue poniendo el
// SafeAreaView de MainScreen (paleta del panel activo incluida).
const TRANSPARENT_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "transparent" },
};

/** Una closure de render por ruta: el JSX exacto de la vista (vive en MainTab).
 *  Recibe las props de la screen para que las rutas de SESIÓN (B2: `Terminal`,
 *  `ModuleWebView`) lean sus params (ids serializables); las rutas de vista
 *  (B1) las ignoran. */
export type TabRouteRenderers = {
  [K in RootRouteName]: (props: RootStackScreenProps<K>) => React.ReactNode;
};

export function TabNavigator({
  tabId,
  view,
  renderers,
}: {
  tabId: string;
  /** Vista actual del controller (fuente de verdad); el stack solo la refleja. */
  view: View;
  renderers: TabRouteRenderers;
}) {
  const navigationRef = getNavigationRef(tabId);

  // ctrl.view → stack: reset a la ruta equivalente (el stack queda SIEMPRE con
  // una sola ruta). `onReady` cubre el caso de que la vista cambie antes de que
  // el contenedor esté listo (arranque: splash → login/dashboard).
  const syncRoute = useCallback(() => {
    if (!navigationRef.isReady()) return;
    const target = VIEW_TO_ROUTE[view];
    if (navigationRef.getCurrentRoute()?.name === target) return;
    navigationRef.resetRoot({ index: 0, routes: [{ name: target }] });
  }, [navigationRef, view]);
  useEffect(() => {
    syncRoute();
  }, [syncRoute]);

  // Al desmontar el árbol (cerrar la pestaña) se libera su ref del registro.
  useEffect(() => () => disposeNavigationRef(tabId), [tabId]);

  return (
    <NavigationIndependentTree>
      <NavigationContainer ref={navigationRef} theme={TRANSPARENT_THEME} onReady={syncRoute}>
        <Stack.Navigator
          initialRouteName={VIEW_TO_ROUTE[view]}
          screenOptions={{
            headerShown: false,
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        >
          {ALL_ROUTE_NAMES.map((name) => (
            <Stack.Screen key={name} name={name}>
              {/* Cast: TS no correlaciona el name del map con el genérico de la
                  screen; el registro name→renderer sí es 1:1 (TabRouteRenderers). */}
              {(props) => renderers[name](props as never)}
            </Stack.Screen>
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}
