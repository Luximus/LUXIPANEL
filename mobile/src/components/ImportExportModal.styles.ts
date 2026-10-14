import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  tabsRow: { borderBottomWidth: 1, paddingBottom: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "800", marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  warnRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
});
