import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBody: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 14, fontWeight: "700" },
  optionSub: { fontSize: 12, lineHeight: 16 },
});
