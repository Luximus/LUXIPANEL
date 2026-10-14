import { StyleSheet } from "react-native";
import { getThemeTokens } from "../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

// Estilos de la pantalla "Empleos" (Jobs marketplace). Mismo lenguaje visual que
// BlogReaderScreen: tarjetas con borde sutil, cabecera fija y lista con
// RefreshControl. Cada componente de `components/jobs/*` trae su propio `.styles`.
export function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    header: {
      minHeight: 58,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    // Barra de pestañas internas (Comprador / Profesional / Mi perfil).
    tabsBar: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 4,
    },
    // Footer de acciones anclado abajo (mismo patrón que el editor de conexión
    // `PanelEditorPanel`): fila con borde superior; el botón "Crear" (Comprador) vive aquí.
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
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 28,
      gap: 12,
    },
    empty: {
      textAlign: "center",
      marginTop: 36,
      fontSize: 14,
      fontWeight: "600",
    },
    footerState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      gap: 8,
    },
    stateText: {
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
