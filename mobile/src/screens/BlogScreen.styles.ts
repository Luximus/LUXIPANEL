import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  sectionRoot: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  searchWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, minHeight: 42 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "600" },
  newBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  scopeRow: { paddingHorizontal: 12, paddingTop: 4 },
  scopeBtn: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  scopeText: { fontSize: 12.5, fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  listContent: { padding: 12, paddingBottom: 32 },

  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 140 },
  coverEmpty: { alignItems: "center", justifyContent: "center", borderBottomWidth: 1 },
  cardBody: { padding: 14, gap: 6 },
  cardTitle: { fontSize: 15.5, fontWeight: "800" },
  cardMeta: { fontSize: 12.5 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },

  tabs: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabText: { fontSize: 13.5, fontWeight: "800" },

  fieldLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, marginBottom: 6 },

  tagChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },

  aiBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 10 },
  aiBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  coverPreviewWrap: { position: "relative", marginBottom: 8 },
  coverPreview: { width: "100%", height: 150, borderRadius: 10 },
  coverRemoveBtn: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  uploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 8 },

  inlineRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  mgrRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10 },

  errorBox: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
});
