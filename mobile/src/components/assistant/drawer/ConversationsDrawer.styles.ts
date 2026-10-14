// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // ── Drawer de conversaciones ──────────────────────────────────────────────
  drawer: { borderBottomWidth: 1, maxHeight: 300 },
  drawerList: { paddingHorizontal: 6, paddingBottom: 6 },
  // Ancla el contenido al fondo en listas cortas (thumb-reach, paridad con el
  // sidebar del chat web): con pocas conversaciones quedan pegadas abajo; con
  // muchas, `flexGrow` no estorba y la lista scrollea normal.
  drawerListContent: { flexGrow: 1, justifyContent: "flex-end" },
  drawerEmpty: { fontSize: 12, textAlign: "center", marginVertical: 12 },

  // ── Árbol de proyectos + chats (estilo ChatGPT) ──
  treeSection: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", paddingHorizontal: 8, marginTop: 12, marginBottom: 4 },
  treeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 10 },
  treeRowChild: { paddingLeft: 26 },
  treeLabel: { flex: 1, fontSize: 14, fontWeight: "600" },

  // ── Barra inferior fija del drawer (thumb-reach): scope tabs + buscador ──
  drawerBottomBar: { borderTopWidth: 1, padding: 8, gap: 8 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10 },
  searchInput: { flex: 1, minHeight: 38, fontSize: 13, paddingVertical: 8, textAlignVertical: "center" },

  // ── Sección "Sin revisar" ──
  unreviewedHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, marginTop: 12, marginBottom: 4 },
  unreviewedDot: { width: 8, height: 8, borderRadius: 999 },
  unreviewedCount: { minWidth: 20, height: 16, borderRadius: 8, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  unreviewedCountText: { fontSize: 10.5, fontWeight: "800" },

  // ── "Cargar más conversaciones" ──
  loadMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 9, paddingVertical: 9, marginHorizontal: 6, marginVertical: 8 },
  loadMoreText: { fontSize: 11.5, fontWeight: "600" },
});
