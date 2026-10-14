// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // `toolBlock` es la caja base compartida también por ModifiedFilesView.
  toolBlock: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  toolHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  toolName: { fontSize: 11.5, fontFamily: "monospace", flex: 1 },
  // Enlace "Ver historial" al final de la cabecera de un turno CLI terminado.
  toolHistLink: { fontSize: 10, fontWeight: "600" },
  toolBody: { borderTopWidth: 1 },
  // Output terminal: paleta fija oscura (un terminal no cambia con el tema).
  toolOutput: { color: "#b8c4d4", fontSize: 11.5, lineHeight: 16, padding: 8, fontFamily: "monospace", backgroundColor: "#06090d" },
  toolParamLabel: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", paddingHorizontal: 8, paddingTop: 6, paddingBottom: 2 },
});
