// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // Capa del host: cubre el área del cuerpo (bajo el navbar superior, sobre el
  // contenido de pestañas). No captura toques por sí misma (box-none).
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 35,
    elevation: 35,
  },
  fill: { flex: 1 },
  // Sesión VISIBLE: posicionada absoluta sobre el rect publicado por su
  // SessionSurfaceTarget (left/top/width/height se fijan inline).
  bound: {
    position: "absolute",
    zIndex: 2,
  },
  // Consola OCULTA (minimizada / pestaña inactiva): mismo truco que el overlay
  // previo (`display:none`) — no se pinta ni se re-layouta (el emulador no
  // recalcula la grilla ni manda resize al PTY), pero el WebSocket sigue vivo.
  hiddenNone: {
    display: "none",
  },
  // Webview de módulo OCULTA en la pestaña ACTIVA (pre-warm / "atrás"): a
  // tamaño completo con opacity 0 —NO display:none, que no cargaría— para
  // cargar/seguir viva en segundo plano (mismo truco de pre-warm previo).
  hiddenGhost: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    zIndex: 0,
  },
});
