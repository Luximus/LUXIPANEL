import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
});
