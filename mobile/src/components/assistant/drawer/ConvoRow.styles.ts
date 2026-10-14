// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Fila de conversación (ConvoRow) con indicadores + acciones.
export const styles = StyleSheet.create({
  convoRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10 },
  convoMain: { flex: 1, minWidth: 0, gap: 1 },
  convoTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  convoTitle: { fontSize: 13.5, fontWeight: "600", flexShrink: 1 },
  convoPreview: { fontSize: 11 },
  convoMetaLine: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  convoMetaText: { fontSize: 9.5 },
  convoRenameInput: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 13 },
  convoAction: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
});
