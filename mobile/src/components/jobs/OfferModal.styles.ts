import { StyleSheet } from "react-native";
import { getThemeTokens } from "../../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

export function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    body: {
      flex: 1,
    },
    controls: {
      gap: 10,
      paddingBottom: 10,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    searchInput: {
      flex: 1,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    toggleLabel: {
      fontSize: 13,
      fontWeight: "700",
      flex: 1,
    },
    profCard: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      gap: 8,
      marginBottom: 10,
    },
    profHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    profName: {
      flex: 1,
      fontSize: 14.5,
      fontWeight: "800",
    },
    availBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
    },
    availText: {
      fontSize: 11,
      fontWeight: "800",
    },
    headline: {
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
    empty: {
      textAlign: "center",
      paddingVertical: 24,
      fontSize: 13,
      fontWeight: "600",
    },
    error: {
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 8,
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
