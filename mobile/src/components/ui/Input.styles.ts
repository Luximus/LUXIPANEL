import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  inputWithReveal: {
    paddingEnd: 44,
  },
  revealWrap: {
    position: "relative",
    justifyContent: "center",
  },
  revealBtn: {
    position: "absolute",
    end: 8,
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontSize: 12,
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
  },
});
