import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  countdownRowRtl: {
    flexDirection: "row-reverse",
  },
  countdownText: {
    fontSize: 14,
    fontWeight: "700",
  },
  reloadBtn: {
    marginTop: 8,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  reloadLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
