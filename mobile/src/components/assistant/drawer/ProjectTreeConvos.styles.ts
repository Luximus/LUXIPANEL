// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Árbol "Sueltos / Proyectos": cabecera de carpeta colapsable + caja anidada.
// `treeCount`/`treeCountText` los comparte la lista plana de proyectos del
// `ConversationsDrawer`.
export const styles = StyleSheet.create({
  treeGroupHead: { flexDirection: "row", alignItems: "center", borderRadius: 8 },
  treeGroupHeadMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 9 },
  treeGroupHeadNameWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  treeGroupHeadName: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  treeGroupHeadAdd: { padding: 6, marginRight: 2 },
  treeNestBox: { marginLeft: 12, borderLeftWidth: 1, paddingLeft: 4 },
  treeEmptyNested: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 4 },
  treeCount: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  treeCountText: { fontSize: 11, fontWeight: "800" },
});
