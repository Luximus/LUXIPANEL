import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  body: { gap: 10 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  pill: { borderRadius: 999, minWidth: 46, alignItems: "center", justifyContent: "center", paddingVertical: 5, paddingHorizontal: 8 },
  pillOn: { backgroundColor: "#10b981" },
  pillOff: { backgroundColor: "#94a3b8" },
  pillLabel: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
