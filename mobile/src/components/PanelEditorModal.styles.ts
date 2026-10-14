import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  keyList: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
  },
  keyListContainer: {
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 240,
    overflow: "hidden",
  },
  keyListScroll: {
    maxHeight: 240,
  },
  // Estado vacío de la lista de llaves: texto centrado en vez de contenedor solo.
  emptyListText: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  keyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  tabBody: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabsRow: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  col: {
    flex: 1,
  },
  colPort: {
    width: 108,
  },
  keysCountRow: {
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchWrap: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 38,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  sshHintTop: {
    fontSize: 12,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 13,
    minHeight: 0,
  },
});
