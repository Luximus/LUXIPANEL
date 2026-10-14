import { StyleSheet } from "react-native";
import { getThemeTokens } from "../../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

export function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: tokens.bgCard,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      gap: 10,
    },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 21,
    },
    badge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      flexShrink: 0,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "800",
    },
    desc: {
      fontSize: 13.2,
      lineHeight: 18,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
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
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    price: {
      fontSize: 15,
      fontWeight: "800",
    },
    metaText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    // Panel IA colapsable.
    aiToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
    },
    aiToggleText: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    aiBox: {
      borderTopWidth: 1,
      borderTopColor: tokens.border,
      paddingTop: 8,
      gap: 6,
    },
    aiLine: {
      fontSize: 12.5,
      lineHeight: 17,
    },
    aiHeading: {
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    actionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    actionBtn: {
      flexGrow: 1,
      minWidth: 110,
    },
  });
}
