// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Punto pulsante (aprobación pendiente / sin revisar).
export const styles = StyleSheet.create({
  pulseDotWrap: { width: 8, height: 8, alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 8, height: 8, borderRadius: 999 },
  pulseCore: { width: 8, height: 8, borderRadius: 999 },
});
