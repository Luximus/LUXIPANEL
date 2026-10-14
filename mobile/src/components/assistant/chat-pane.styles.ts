import { StyleSheet } from "react-native";
import type { ThemeTokens } from "../../theme/colors";

/**
 * Estilos del asistente del servidor (réplica RN del módulo Asistente IA de
 * LUXIPANEL — chat + proveedores). Convención del repo: layout estático aquí,
 * colores del tema inline en el JSX vía `getThemeTokens(isDark)`; los helpers
 * de abajo reciben los tokens para los combos color+layout repetidos.
 *
 * Fase A3: los estilos de los componentes extraídos (turnos, bloques por turno,
 * cabecera de pills, USO CLI, tiles de inicio, portada y drawer) viven ahora en
 * su `.styles.ts` junto a cada componente en `components/assistant/`. Aquí queda
 * lo que el pane sigue pintando (lista/estados/composer) + la vista Proveedores
 * (`ServerAssistantProviders` importa `styles`/`accentBg` de aquí).
 */
/** Aire bajo el último turno con el teclado CERRADO (el composer va pegado
 *  debajo del ScrollView). */
export const LIST_BOTTOM_PAD = 16;

/**
 * Padding inferior de la lista de turnos compensando el composer flotante: con
 * el teclado abierto el composer sube `keyboardShift` px (translateY) y tapa esa
 * franja del ScrollView — que NO se encoge —, dejando el turno recién enviado y
 * el arranque de la respuesta escondidos detrás. Con el teclado cerrado
 * (`keyboardShift = 0`) deja el aire de siempre, sin hueco extra.
 *
 * Uso: `contentContainerStyle={[styles.listContent, listBottomPad(kbHeight)]}`.
 */
export function listBottomPad(keyboardShift: number): { paddingBottom: number } {
  return { paddingBottom: LIST_BOTTOM_PAD + Math.max(0, keyboardShift) };
}

export const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden" },

  // ── Cabecera ──────────────────────────────────────────────────────────────
  head: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 7, borderBottomWidth: 1 },
  title: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 999 },
  // Logo de marca del panel como avatar circular del título del asistente.
  headLogo: { width: 19, height: 19, borderRadius: 999 },
  respondingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 2 },
  respondingText: { fontSize: 10.5, fontWeight: "600" },
  headBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  // ── Chips de proveedor ────────────────────────────────────────────────────
  // Chips pegados arriba, justo bajo la cabecera; scroll horizontal si hay más.
  chipsRow: { flexDirection: "row", gap: 6, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 4, alignItems: "center" },
  provChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  provChipText: { fontSize: 11, fontWeight: "700" },
  // Chips compactos embebidos EN la barra de cabecera (misma fila que el título),
  // con scroll horizontal ocupando el espacio entre el título y los botones.
  headChips: { flex: 1 },
  headChipsContent: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4 },
  provChipSm: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  provChipSmText: { fontSize: 10.5, fontWeight: "700" },
  provBadge: { width: 14, height: 14, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  provBadgeText: { fontSize: 9, fontWeight: "800", color: "#ffffff" },

  // ── Drawer de conversaciones (restos legacy del headbar del pane) ─────────
  drawerTop: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, paddingBottom: 4 },
  // Sin `height` fijo (clipaba el texto en Android): altura por padding + centrado
  // vertical para que "Buscar conversaciones…" se vea completo, sin cortarse.
  drawerSearch: { flex: 1, minHeight: 38, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, textAlignVertical: "center" },
  drawerProjects: { flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 5 },
  convRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: "transparent" },
  convMain: { flex: 1, gap: 1 },
  convTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  convTitle: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
  convPreview: { fontSize: 11.5 },
  convDate: { fontSize: 10.5 },
  liveDot: { width: 7, height: 7, borderRadius: 999 },
  convDelete: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 10 },
  chatRowTitle: { flex: 1, fontSize: 14, fontWeight: "500" },

  // ── Sección Agentes (legacy) ──
  agentIconBox: { width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  agentProvider: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase", marginLeft: 4 },
  // Fila de agente en el drawer de chat: avatar DiceBear + nombre + chip proveedor.
  agentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10 },
  // Chip de proveedor del agente (acento violeta, paridad con los chips de rol web).
  agentChip: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  agentChipText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
  newConvBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  newConvText: { fontSize: 13, fontWeight: "800" },

  // ── Lista de mensajes ─────────────────────────────────────────────────────
  list: { flex: 1 },
  // `paddingBottom` > padding: el composer es una franja FLOTANTE que sube con el
  // teclado (translateY) y el ScrollView no se encoge, así que sus últimos píxeles
  // quedan DETRÁS del composer. Con el teclado abierto hay que sumar además su
  // desplazamiento: `listBottomPad(keyboardShift)`.
  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: LIST_BOTTOM_PAD, gap: 12, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 6, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  // Estado vacío de chat de AGENTE: tarjeta simple centrada (paridad web).
  emptyAgentState: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24, paddingVertical: 24 },
  emptyAgentTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptyAgentHint: { fontSize: 13, textAlign: "center" },

  // Chips de respuesta rápida (primer mensaje sugerido): rejilla centrada que
  // ENVUELVE en varias filas para mostrar todas las opciones (no scroll de 1 fila).
  quickRepliesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 8, paddingHorizontal: 16, marginTop: 4 },
  quickChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  quickChipText: { fontSize: 13, fontWeight: "600" },

  // ── Botón flotante "Entrar a panel" (modo chat) ──────────────────────────
  enterFloatWrap: { position: "absolute", left: 0, right: 0, bottom: 14, alignItems: "center" },
  enterFloatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  enterFloatText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  empty: { fontSize: 12.5, textAlign: "center", paddingHorizontal: 12, lineHeight: 18, minHeight: 0 },
  blocked: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 22, paddingHorizontal: 14 },
  blockedText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  notice: { fontSize: 12.5, textAlign: "center", padding: 8 },

  // ── Cabecera de la conversación (chip Terminal, hoy sin uso) ──
  chatHeadTerminalChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginLeft: "auto" },
  chatHeadTerminalText: { fontSize: 11, fontWeight: "600" },

  // ── USO CLI (restos legacy; el wrapper vive en assistant/CliUsageBarsLive) ──
  cliUsageSource: { fontSize: 10, fontWeight: "400", opacity: 0.7 },
  cliUsageLabel: { width: 70, fontSize: 10 },
  cliUsagePct: { width: 110, textAlign: "right", fontSize: 9, fontVariant: ["tabular-nums"] },

  // ── Banner de agente custom ──
  agentBanner: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 },
  agentBannerLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  agentBannerName: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },

  // ── Composer ──────────────────────────────────────────────────────────────
  // Contenedor exterior: separa el chip de adjunto (arriba) de la píldora.
  composer: { gap: 6, padding: 8, borderTopWidth: 1 },
  // Píldora redondeada (paridad web ~1.25rem) que envuelve [+][textarea][enviar].
  composerPill: { flexDirection: "row", alignItems: "flex-end", gap: 4, borderWidth: 1, borderRadius: 22, paddingLeft: 5, paddingRight: 5, paddingVertical: 4 },
  inputWrap: { flex: 1, gap: 5 },
  // Textarea sin borde propio (el borde lo pone la píldora), auto-crece 34–120.
  input: { flex: 1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, fontSize: 14, minHeight: 34, maxHeight: 120, textAlignVertical: "center" },
  // Botón "+"/adjuntar dentro de la píldora: circular, discreto.
  pillBtn: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  // Botón enviar/detener: circular ~38px, alto contraste (neutro), NO violeta.
  sendBtn: { width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  composerChip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  composerChipText: { fontSize: 11, maxWidth: 160 },
  approveBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  approveBtnText: { fontSize: 12.5, fontWeight: "700", color: "#ffffff" },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  ghostBtnText: { fontSize: 12.5, fontWeight: "700" },

  // ── Vista Proveedores ─────────────────────────────────────────────────────
  provView: { flex: 1 },
  provViewContent: { padding: 10, gap: 10, flexGrow: 1 },
  provLoading: { alignItems: "center", gap: 8, paddingVertical: 24 },
  provLoadingText: { fontSize: 12.5 },
  provCard: { borderWidth: 2, borderRadius: 12, padding: 11, gap: 9 },
  provCardHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  provIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  provHeadMain: { flex: 1, gap: 1 },
  provLabel: { fontSize: 13.5, fontWeight: "700" },
  provDesc: { fontSize: 11, lineHeight: 15 },
  provSwitchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  provSwitchLabel: { fontSize: 12.5, fontWeight: "600" },
  // Toggles de burbuja por proveedor (pastillas compactas que envuelven).
  bubbleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  bubbleToggle: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  bubbleDot: { width: 10, height: 10, borderRadius: 999, borderWidth: 1.5 },
  bubbleToggleText: { fontSize: 11, fontWeight: "700" },
  // Nota de estado gestionado + nota MCP del panel CLI.
  cliManagedText: { fontSize: 10.5, lineHeight: 14 },
  cliMcpNote: { fontSize: 10.5, lineHeight: 14, fontStyle: "italic" },
  fieldLabel: { fontSize: 11.5, fontWeight: "600", marginBottom: 4 },
  provActionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  probeText: { fontSize: 11.5, lineHeight: 16 },
  cliBox: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  cliRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cliText: { fontSize: 12 },
});

/** Fondo translúcido del accent de un proveedor (avatar / icono de tarjeta). */
export function accentBg(tint: string): string {
  return `${tint}22`;
}

/** Colores de la cabecera/superficies del pane según tema. */
export function paneSurface(tokens: ThemeTokens) {
  return {
    wrap: { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border },
    head: { backgroundColor: tokens.bgSecondary, borderBottomColor: tokens.border },
    headBtn: { backgroundColor: tokens.bgInput, borderColor: tokens.border },
  } as const;
}
