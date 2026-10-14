// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Pantalla-cáscara de una CONSOLA tmux (fase B2).
 *
 * La sesión viva (`NativeTerminalSession`: WebSocket + emulador + su chrome —
 * tabs superiores Terminal/Chat/Ajustes y barra de teclas, acoplados al socket)
 * vive SIEMPRE montada en el `SessionHost` global; esta pantalla solo publica
 * el hueco donde debe verse (`SessionSurfaceTarget`). Navegar fuera (goBack =
 * minimizar) deja la sesión viva; volver a entrar re-publica el rect.
 *
 * Params (solo ids serializables): `panelId` + `consoleId` (= sessionId del
 * reattach tmux). Los datos viven en `console-sessions-store`.
 */
import React from "react";
import { View } from "react-native";
import { SessionSurfaceTarget } from "../sessions/SessionSurfaceTarget";
import { surfaceKey } from "../sessions/surface-registry";
import { styles } from "./TerminalScreen.styles";

export function TerminalScreen({
  tabId,
  consoleId,
  active,
}: {
  tabId: string;
  consoleId: string;
  /** La pestaña dueña es la ACTIVA de MainScreen (los MainTab inactivos siguen
   *  montados con display:none y su árbol de navegación conserva el foco). */
  active: boolean;
}) {
  return (
    <View style={styles.root}>
      <SessionSurfaceTarget surfaceKey={surfaceKey(tabId, consoleId)} active={active} />
    </View>
  );
}
