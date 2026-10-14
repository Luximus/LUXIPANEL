import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  footerBtn: {
    flex: 1,
  },
});
