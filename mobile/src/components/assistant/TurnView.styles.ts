// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // ── Turnos ────────────────────────────────────────────────────────────────
  turnUser: { alignItems: "flex-end" },
  userBubble: { maxWidth: "86%", borderRadius: 16, borderTopRightRadius: 4, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8, gap: 3 },
  userText: { fontSize: 13.5, lineHeight: 19 },
  userTime: { fontSize: 10, textAlign: "right" },
  // Fila de acciones por burbuja (copiar / editar), paridad con la web: en la
  // burbuja de usuario va alineada a la derecha bajo un divisor; en la del
  // asistente va bajo la respuesta, alineada a la izquierda.
  bubbleActionsUser: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 4, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  bubbleActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  turnAssistant: { gap: 5 },
  aHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  // Avatar del turno del asistente ~28px (paridad con la fila-header de la web,
  // que precede la burbuja con el avatar + nombre del agente).
  avatar: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  // Nombre del agente/proveedor a la derecha del avatar (fila-header del turno).
  aName: { fontSize: 12, fontWeight: "700", flexShrink: 1, maxWidth: 115 },
  providerBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, maxWidth: 100 },
  avatarInitial: { fontSize: 12, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1, flexWrap: "wrap" },
  metaText: { fontSize: 10.5 },
  aBubble: { borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8, gap: 6 },
  attChip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  attChipText: { fontSize: 11.5 },

  // ── Estados (interrumpido / parado / sin traducir) ──
  stateRow: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6 },
  stateText: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  // Error duro: caja roja con título + detalle + botones.
  errBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, gap: 6, marginTop: 6 },
  errTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errTitle: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  errDetail: { fontSize: 11.5, lineHeight: 16 },
  errBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  errBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  errBtnText: { fontSize: 11.5, fontWeight: "700" },
});
