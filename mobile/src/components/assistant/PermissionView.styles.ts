// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // Detalle monoespaciado (comando / ruta) del permiso.
  permDetail: { fontSize: 11, lineHeight: 16, fontFamily: "monospace", borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  permToolRow: { fontSize: 11 },
  permBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  permBtnText: { fontSize: 12, fontWeight: "700" },
});
