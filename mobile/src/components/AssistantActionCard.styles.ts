import { StyleSheet } from "react-native";
import type { getThemeTokens } from "../theme/colors";

export const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    gap: 8,
    maxWidth: "92%",
    alignSelf: "flex-start",
    width: "92%",
  },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  inputMultiline: { minHeight: 80, maxHeight: 140, textAlignVertical: "top" },
  mono: { fontFamily: "monospace", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  rowItem: { flex: 1 },
  rowItemSmall: { width: 92 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  submit: { marginTop: 2 },
  err: { fontSize: 12 },
  hint: { fontSize: 12, lineHeight: 17 },
  qr: { width: 160, height: 160, alignSelf: "center", borderRadius: 8, backgroundColor: "#fff" },
  warn: { fontSize: 12, lineHeight: 16, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  codes: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  codeItem: { width: "47%", fontSize: 13 },
  notice: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 2 },
  noticeText: { fontSize: 11, flex: 1, lineHeight: 15 },
});

export function inputStyle(tokens: ReturnType<typeof getThemeTokens>) {
  return { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput };
}
