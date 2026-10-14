import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: "center",
  },
  logoBig: { height: 88, resizeMode: "contain", marginBottom: 8 },
  logoSmall: { height: 22, resizeMode: "contain", marginBottom: 28 },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  dotsRow: { flexDirection: "row", gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  copyright: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    textAlign: "center",
  },
});
