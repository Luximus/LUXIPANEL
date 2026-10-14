// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Estado vacío "puntos de partida" (chat suelto/proyecto): encabezado + divisor
// + tarjetas con icono de color (réplica de las "starting points" de la web).
export const styles = StyleSheet.create({
  emptyStartWrap: { flexGrow: 1, paddingHorizontal: 4, paddingTop: 72, paddingBottom: 10 },
  emptyStartWrapCompact: { paddingTop: 28 },
  emptyStartInner: { width: "100%", maxWidth: 720, alignSelf: "center", flexGrow: 1 },
  emptyStartHeading: { alignItems: "center", paddingHorizontal: 10 },
  emptyStartLogo: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyStartLogoImage: { width: 58, height: 58 },
  emptyStartTitle: { fontSize: 28, lineHeight: 31, fontWeight: "700", textAlign: "center", letterSpacing: -0.8 },
  emptyStartDesc: { fontSize: 14, lineHeight: 19, marginTop: 10, textAlign: "center" },
  startCards: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginTop: "auto", paddingTop: 22, paddingBottom: 14 },
  startCard: { width: "48.5%", minHeight: 108, alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 16, padding: 13 },
  startCardTile: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  startCardText: { fontSize: 12.5, fontWeight: "500", lineHeight: 18 },
});
