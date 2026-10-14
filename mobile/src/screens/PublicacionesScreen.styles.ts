import { StyleSheet } from "react-native";
import { getThemeTokens } from "../theme/colors";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

// Estilos del muro social "Publicaciones". Mismo lenguaje visual que
// BlogReaderScreen/JobsScreen: tarjetas con borde sutil, cabecera fija (no en
// `compact`, donde el tab-bar del drawer ya rotula) y lista con RefreshControl.
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
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
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

    // ── Banner de saldo (saldo + costo de publicar) ─────────────────────────
    balanceBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
    },
    balanceLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    balanceText: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    balanceCost: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    // ── Composer (texto / encuesta) ─────────────────────────────────────────
    composer: {
      backgroundColor: tokens.bgCard,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: 18,
      padding: 12,
      gap: 10,
    },
    composerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    composerInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      minHeight: 38,
      maxHeight: 140,
      paddingVertical: 6,
    },
    typeToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    typeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    typeChipText: {
      fontSize: 12,
      fontWeight: "800",
    },
    pollOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pollOptionInput: {
      flex: 1,
      fontSize: 13.5,
      fontWeight: "600",
      height: 40,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: 12,
    },
    pollOptionRemove: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    addOptionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingVertical: 4,
    },
    addOptionText: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    composerBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    charCounter: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    composerNotice: {
      fontSize: 12,
      fontWeight: "700",
    },

    // ── Tarjeta de publicación ───────────────────────────────────────────────
    card: {
      backgroundColor: tokens.bgCard,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: 18,
      padding: 12,
      gap: 10,
    },
    // Fila 1: avatar + nombre.
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    authorName: {
      flex: 1,
      fontSize: 13.5,
      fontWeight: "800",
    },
    // Fila 2: contenido + fecha + reacciones/acciones.
    contentText: {
      fontSize: 14.5,
      lineHeight: 20,
    },
    dateText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    // ── Encuesta ──────────────────────────────────────────────────────────────
    pollWrap: {
      gap: 8,
    },
    pollOption: {
      borderWidth: 1,
      borderRadius: 12,
      overflow: "hidden",
      paddingVertical: 9,
      paddingHorizontal: 11,
      justifyContent: "center",
      minHeight: 40,
    },
    pollOptionBar: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
    },
    pollOptionContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    pollOptionLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
    },
    pollOptionCount: {
      fontSize: 12,
      fontWeight: "800",
    },
    pollTotal: {
      fontSize: 11.5,
      fontWeight: "700",
      marginTop: 2,
    },

    // ── Barra de reacciones/acciones ─────────────────────────────────────────
    reactionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingTop: 4,
    },
    reactionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    reactionText: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    reactionSpacer: {
      flex: 1,
    },

    // ── Comentarios ──────────────────────────────────────────────────────────
    commentsWrap: {
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: tokens.border,
      paddingTop: 10,
    },
    commentRow: {
      flexDirection: "row",
      gap: 8,
    },
    commentBubble: {
      flex: 1,
      backgroundColor: tokens.bgSecondary,
      borderRadius: 12,
      paddingHorizontal: 11,
      paddingVertical: 8,
      gap: 3,
    },
    commentHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    commentAuthor: {
      fontSize: 12,
      fontWeight: "800",
    },
    commentDate: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    commentText: {
      fontSize: 13,
      lineHeight: 18,
    },
    commentActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 2,
    },
    commentActionText: {
      fontSize: 11,
      fontWeight: "800",
    },
    // Caja de entrada de comentario / respuesta.
    commentComposer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    commentInput: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      minHeight: 38,
      maxHeight: 110,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderRadius: 12,
    },
    commentSendBtn: {
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    commentSendText: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    replyingBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingBottom: 2,
    },
    replyingText: {
      fontSize: 11.5,
      fontWeight: "700",
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
  });
}
