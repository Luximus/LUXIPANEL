import { StyleSheet } from "react-native";
import { getThemeTokens } from "../../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

// Estilos del runner del test técnico (espejo RN de TestModal del desktop):
// intro → pregunta (con temporizadores) → resultado. RTL-aware vía
// `flexDirection`/`textAlign` aplicados en el componente.
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
    content: { padding: 16, gap: 14, paddingBottom: 40 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

    // Intro
    introTitle: { fontSize: 18, fontWeight: "800", lineHeight: 24 },
    introText: { fontSize: 14, lineHeight: 20 },
    bullet: { fontSize: 13.5, lineHeight: 19 },

    // Cabecera de pregunta + temporizadores
    timersRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    counterLabel: { fontSize: 12.5, fontWeight: "700" },
    perQBadge: {
      minWidth: 44,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    perQBadgeText: { fontSize: 15, fontWeight: "800" },
    totalTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: tokens.bgSecondary,
      overflow: "hidden",
    },
    totalFill: { height: 8, borderRadius: 999, backgroundColor: tokens.brand },

    question: { fontSize: 16, fontWeight: "800", lineHeight: 22 },
    autoHint: { fontSize: 12, lineHeight: 16 },

    // Opciones
    options: { gap: 10 },
    option: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    optionMarker: {
      width: 20,
      height: 20,
      borderRadius: 999,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    optionDot: { width: 8, height: 8, borderRadius: 999 },
    optionText: { flex: 1, fontSize: 14, lineHeight: 19 },

    // Resultado
    resultIcon: { fontSize: 52, lineHeight: 58, textAlign: "center" },
    resultTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
    resultMsg: { fontSize: 14.5, lineHeight: 20, textAlign: "center" },

    error: { fontSize: 13, fontWeight: "700" },
    footer: {
      borderTopWidth: 1,
      borderTopColor: tokens.border,
      padding: 14,
      gap: 10,
    },
  });
}
