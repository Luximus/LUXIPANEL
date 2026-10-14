import { StyleSheet } from "react-native";
import { getThemeTokens } from "../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

export function makeStyles(tokens: ThemeTokens, compact = false) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: compact ? "100%" : undefined,
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
    headerLeft: {
      flex: 1,
      alignItems: "center",
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
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 28,
      gap: 12,
    },
    // Los 3 filtros (buscar + categoría + tag) en UNA sola fila; el buscador se
    // lleva la mayor parte del ancho (flex 1.5) y cada selector el resto.
    filterWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 2,
    },
    searchBox: {
      flex: 1.5,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 40,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderRadius: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      paddingVertical: 0,
    },
    select: {
      flex: 1,
      height: 40,
    },
    card: {
      backgroundColor: tokens.bgCard,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: 18,
      overflow: "hidden",
    },
    cardCover: {
      width: "100%",
      height: 170,
      backgroundColor: tokens.bgSecondary,
    },
    cardText: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 9,
    },
    cardMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    cardCategory: {
      fontSize: 11.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    cardDate: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 21,
    },
    cardExcerpt: {
      fontSize: 13.2,
      lineHeight: 18,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    cardAuthor: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    cardViews: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
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
    footerText: {
      fontSize: 12,
      fontWeight: "700",
    },
    stateText: {
      fontSize: 14,
      fontWeight: "600",
    },
    // Vista de artículo nativa (antes WebView): scroll con cover, pill de
    // categoría, título, meta y el cuerpo renderizado por HtmlView.
    articleScroll: {
      flex: 1,
    },
    articleContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 48,
    },
    articleCover: {
      width: "100%",
      maxHeight: 240,
      aspectRatio: 16 / 9,
      borderRadius: 12,
      marginBottom: 14,
      backgroundColor: tokens.bgSecondary,
    },
    articleCat: {
      alignSelf: "flex-start",
      fontSize: 12,
      fontWeight: "700",
      paddingHorizontal: 9,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
      overflow: "hidden",
    },
    articleTitle: {
      fontSize: 24,
      fontWeight: "800",
      lineHeight: 30,
      marginTop: 12,
      marginBottom: 6,
    },
    articleMeta: {
      fontSize: 12.5,
      marginBottom: 16,
    },
    bottomInset: {
      flexShrink: 0,
    },
  });
}
