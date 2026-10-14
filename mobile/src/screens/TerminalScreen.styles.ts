// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // Fondo del terminal (mismo #0b1220 de NativeTerminalSession): evita el flash
  // de la vista anterior mientras la superficie publica su rect y el host
  // posiciona la sesión encima.
  root: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
});
