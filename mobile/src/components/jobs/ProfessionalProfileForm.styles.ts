import { StyleSheet } from "react-native";
import { getThemeTokens } from "../../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

export function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    metaCard: {
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 14,
      padding: 12,
      gap: 6,
      backgroundColor: tokens.bgCard,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    metaLabel: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    metaValue: {
      fontSize: 13,
      fontWeight: "800",
    },
    hint: {
      fontSize: 12,
      lineHeight: 16,
    },
    error: {
      fontSize: 13,
      fontWeight: "700",
    },
    // Campos del formulario en ScrollView; el botón guardar va en footer sticky.
    scrollContent: {
      padding: 14,
      gap: 14,
      paddingBottom: 24,
    },
    // Footer de acción anclado abajo (mismo patrón que el editor de conexión).
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: tokens.border,
      backgroundColor: tokens.bgPrimary,
    },
  });
}
