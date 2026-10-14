import { StyleSheet } from "react-native";
import { getThemeTokens } from "../../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

export function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tokens.bgPrimary },
    header: {
      minHeight: 58,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: tokens.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.bgCardSolid,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: "800" },
    content: { padding: 14, gap: 14, paddingBottom: 40 },
    sec: {
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 14,
      padding: 12,
      gap: 10,
      backgroundColor: tokens.bgCard,
    },
    secTitle: { fontSize: 14, fontWeight: "800" },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    badge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeText: { fontSize: 11, fontWeight: "800" },
    price: { fontSize: 15, fontWeight: "800" },
    title: { fontSize: 16, fontWeight: "800", lineHeight: 21 },
    desc: { fontSize: 13, lineHeight: 18 },
    hint: { fontSize: 12.5, lineHeight: 17 },
    warn: { fontSize: 12.5, fontWeight: "700", lineHeight: 17 },
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
    flexBtn: { flexGrow: 1, minWidth: 110 },
    // Barra de progreso.
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: tokens.bgSecondary,
      overflow: "hidden",
    },
    progressFill: { height: 8, borderRadius: 999, backgroundColor: tokens.brand },
    progressPct: { fontSize: 13, fontWeight: "800" },
    // Estrellas de rating.
    stars: { flexDirection: "row", gap: 4 },
    star: { fontSize: 30, lineHeight: 34 },
    error: { fontSize: 13, fontWeight: "700" },
  });
}
