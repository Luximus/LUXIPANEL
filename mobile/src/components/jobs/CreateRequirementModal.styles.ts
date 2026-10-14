import { StyleSheet } from "react-native";
import { getThemeTokens } from "../../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

export function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    body: {
      gap: 12,
    },
    aiBox: {
      borderWidth: 1,
      borderColor: tokens.borderBrand,
      backgroundColor: tokens.brandDim,
      borderRadius: 12,
      padding: 10,
      gap: 8,
    },
    aiTitle: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    aiNotice: {
      fontSize: 12.5,
      fontWeight: "600",
    },
    aiHeading: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 4,
    },
    aiLine: {
      fontSize: 12.5,
      lineHeight: 17,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.bgSecondary,
    },
    chipText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    error: {
      fontSize: 13,
      fontWeight: "700",
    },
    footerRow: {
      flexDirection: "row",
      gap: 10,
      flex: 1,
    },
    footerBtn: {
      flex: 1,
    },
  });
}
