import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // Anula el `flexGrow:1` base del ScrollView para que el scroller horizontal de
  // tabs NO crezca verticalmente dentro de una columna flex (estiraba las píldoras).
  scrollOuter: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  seg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 34,
  },
  segFill: {
    flex: 1,
  },
  segLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
});
