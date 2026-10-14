// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hueco visual de una sesión viva (fase B2).
 *
 * Una pantalla (TerminalScreen / ModuleWebViewScreen) monta este componente
 * donde quiere que "se vea" la sesión: publica su rect EN VENTANA en el
 * `surface-registry` mientras está ENFOCADA (`useFocusEffect`) y en la pestaña
 * ACTIVA (`active`), y lo retira al blur/desmontar → la sesión del
 * `SessionHost` vuelve a oculta sin desmontarse.
 *
 * Re-publica el rect en cada cambio de layout (`onLayout`), al abrir/cerrar el
 * teclado (con `softwareKeyboardLayoutMode: "resize"` el área cambia y el
 * terminal debe re-encuadrarse), al rotar/cambiar dimensiones y cuando el host
 * pide re-medición global (su propio layout cambió).
 */
import React, { useCallback, useEffect, useRef } from "react";
import { Dimensions, Keyboard, Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { bindSurface, subscribeSurfaceMeasure, unbindSurface } from "./surface-registry";

export function SessionSurfaceTarget({
  surfaceKey,
  active = true,
  style,
}: {
  /** Clave `tabId:sessionId` (helper `surfaceKey` del registry). */
  surfaceKey: string;
  /** La pestaña dueña está ACTIVA. Con los N MainTab ocultos por `display:none`
   *  el foco de react-navigation es por-árbol (cada pestaña tiene el suyo), así
   *  que el foco solo no basta: sin esto, la pantalla de una pestaña oculta
   *  publicaría su rect y la sesión taparía a la pestaña visible. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const viewRef = useRef<View | null>(null);
  // Vivo mientras la pantalla está enfocada Y la pestaña activa: gate de publish.
  const publishableRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const publish = useCallback(() => {
    if (rafRef.current !== null) return; // coalescer ráfagas (layout + teclado)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!publishableRef.current) return;
      viewRef.current?.measureInWindow((x, y, width, height) => {
        if (!publishableRef.current) return;
        bindSurface(surfaceKey, { x, y, width, height }); // rects vacíos se ignoran
      });
    });
  }, [surfaceKey]);

  // Foco de la pantalla: publica al enfocar; al blur retira la superficie (la
  // sesión sigue viva en el host, solo deja de verse).
  useFocusEffect(
    useCallback(() => {
      publishableRef.current = active;
      if (active) publish();
      return () => {
        publishableRef.current = false;
        unbindSurface(surfaceKey);
      };
    }, [active, publish, surfaceKey]),
  );

  // Desmontaje duro (además del blur): garantiza no dejar superficies colgadas.
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    unbindSurface(surfaceKey);
  }, [surfaceKey]);

  // Teclado (el rect cambia con `resize`), rotación/dimensiones y la señal de
  // re-medición global del host.
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(showEvt, publish);
    const h = Keyboard.addListener(hideEvt, publish);
    const d = Dimensions.addEventListener("change", publish);
    const m = subscribeSurfaceMeasure(publish);
    return () => {
      s.remove();
      h.remove();
      d.remove();
      m();
    };
  }, [publish]);

  return (
    <View
      ref={viewRef}
      // `collapsable={false}`: sin esto Android puede "aplanar" el View (no
      // dibuja nada) y `measureInWindow` no tendría nodo que medir.
      collapsable={false}
      onLayout={publish}
      style={[{ flex: 1 }, style]}
    />
  );
}
