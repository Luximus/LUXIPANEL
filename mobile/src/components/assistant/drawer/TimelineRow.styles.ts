// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Decoración de timeline por chat anidado (espejo de `TimelineRow` web): un
// gutter izquierdo con punto (h-2 w-2 + ring del color de la tarjeta) y línea
// (w-px) que baja hasta el siguiente ítem; la línea se omite en el último.
export const styles = StyleSheet.create({
  timelineRow: { position: "relative", paddingLeft: 16 },
  timelineDot: { position: "absolute", left: 3, top: 13, width: 8, height: 8, borderRadius: 999, borderWidth: 2 },
  timelineLine: { position: "absolute", left: 6, top: 20, bottom: 0, width: 1 },
});
