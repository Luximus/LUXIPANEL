import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 16 },
  error: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  list: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 6,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  radio: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  primary: { fontSize: 13, fontWeight: "700" },
  secondary: { fontSize: 11 },
});
