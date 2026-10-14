import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
  },
  logoBig: { height: 56, resizeMode: "contain" },
  logoSmall: { height: 18, resizeMode: "contain", marginTop: 6, marginBottom: 24 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  message: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 22 },
  retryBtn: {
    marginBottom: 20,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.4 },
});
