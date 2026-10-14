import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  drawerOverlay: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  drawerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.42)" },
  drawerPanel: { height: "100%", borderLeftWidth: 1, elevation: 18, shadowColor: "#0f172a", shadowOpacity: 0.22, shadowRadius: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderLeftWidth: 3,
  },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  headerHeading: { flex: 1, minWidth: 0 },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },

  hubContent: { padding: 14, gap: 12 },
  hubSubtitle: { fontSize: 13, marginBottom: 4 },
  hubCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  hubIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  hubLabel: { fontSize: 16, fontWeight: "800" },
  hubDesc: { fontSize: 12.5, marginTop: 2 },

  sectionRoot: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  searchWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, minHeight: 42 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "600" },
  newBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  listContent: { padding: 12, paddingBottom: 32 },

  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardMeta: { fontSize: 12.5 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },

  fieldLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, marginBottom: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 2 },
  toggleLabel: { fontSize: 13.5, fontWeight: "600" },

  permGroupTitle: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  permRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  errorBox: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
});
