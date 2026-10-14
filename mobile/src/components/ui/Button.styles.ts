import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnMd: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
  },
  btnSm: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 34,
  },
  label: {
    fontWeight: "700",
  },
  labelMd: {
    fontSize: 14,
  },
  labelSm: {
    fontSize: 13,
  },
});
