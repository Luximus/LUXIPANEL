// Estilos compartidos del tab Snippets (drawer izquierdo) y sus sub-paneles.
// Extraído de `ServerSnippetsTab.tsx` (refactor conservador: código movido tal cual).
import { StyleSheet } from "react-native";
import { getThemeTokens } from "../../theme/colors";

export type ThemeTokens = ReturnType<typeof getThemeTokens>;

export const styles = StyleSheet.create({
  root: { flex: 1, padding: 12, gap: 10 },
  fill: { flex: 1, gap: 10 },
  // Footer fijo "Nueva consola" (separador arriba + botón con icono), espejo del
  // footer de TabsManagerPanel. Márgenes negativos para romper el padding 12 del
  // cuerpo del tab y que el separador/fondo lleguen a los bordes del drawer.
  consoleFooter: { marginHorizontal: -12, marginBottom: -12, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1 },
  newConsoleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 12 },
  newConsoleLabel: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  histTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  histMeta: { fontSize: 10.5, marginTop: 2 },
  // Paginación del historial (prev · X / Y · next).
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, paddingTop: 2 },
  pagerLabel: { fontSize: 13, fontWeight: "700", minWidth: 54, textAlign: "center" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24 },
  placeholderTitle: { fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  placeholderHint: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 40 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hint: { fontSize: 12, lineHeight: 16 },
  listContent: { gap: 8, paddingBottom: 16 },
  group: { gap: 6 },
  groupLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6 },
  empty: { fontSize: 13, textAlign: "center", paddingVertical: 28 },
  snipRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  snipMain: { flex: 1, gap: 3 },
  snipName: { fontSize: 13.5, fontWeight: "700" },
  snipCmd: { fontSize: 11.5, fontFamily: "monospace" },
  snipTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  tagBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagBadgeText: { fontSize: 10.5, fontWeight: "700" },
  snipActions: { flexDirection: "row", alignItems: "center" },
  simpleRow: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  formRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, minHeight: 40 },
  cmdInput: { minHeight: 90, textAlignVertical: "top", fontFamily: "monospace", fontSize: 13 },
  fieldLabel: { fontSize: 12.5, fontWeight: "700", marginTop: 4 },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 18 },
  modalCard: { borderWidth: 1, borderRadius: 16, maxHeight: "86%", overflow: "hidden" },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  modalTitle: { fontSize: 15, fontWeight: "800" },
  modalBody: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  modalFooter: { flexDirection: "row", gap: 10, padding: 16 },
  flex1: { flex: 1 },
});
