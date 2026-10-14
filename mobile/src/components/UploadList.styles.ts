import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  item: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  itemMain: { flex: 1, gap: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 38,
    alignItems: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  name: { fontSize: 13, fontWeight: "600", flex: 1 },
  progressTrack: { height: 4, borderRadius: 999, overflow: "hidden" },
  progressBar: { height: 4, borderRadius: 999 },
  meta: { fontSize: 11 },
});
