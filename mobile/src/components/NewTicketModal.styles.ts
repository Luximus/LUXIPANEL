import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, marginBottom: 6 },
  priorityRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  attachSection: { gap: 8 },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  counter: { fontSize: 12, fontWeight: "600" },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: { fontSize: 13 },
});
