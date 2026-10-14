// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Cabecera de grupo del árbol de Agentes IA (líder / grupo / subordinado):
// chevron + avatar + nombre + chips + contador + stack de avatares + botón "+".
export const styles = StyleSheet.create({
  agentGroupRow: { flexDirection: "row", alignItems: "flex-start", borderRadius: 8 },
  agentGroupBtn: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 8, paddingVertical: 9 },
  agentGroupChevron: { marginTop: 2 },
  agentGroupMain: { flex: 1, minWidth: 0, gap: 3 },
  agentGroupTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  agentGroupName: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  // Píldora con el nº de conversaciones del agente (acento de marca, paridad web).
  agentCountPill: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  agentCountText: { fontSize: 9.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
  // Chip de rol (color del rol) + chip de proyecto (líder).
  agentRoleChip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  agentRoleChipText: { fontSize: 9.5, fontWeight: "700" },
  agentProjectChip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  agentProjectChipText: { fontSize: 9.5, fontWeight: "700" },
  agentGroupProjectLine: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  agentGroupProjectText: { fontSize: 9.5 },
  // Stack de avatares solapados de los subordinados de un líder (+N burbuja).
  avatarStack: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  avatarStackItem: { marginLeft: -6, borderRadius: 999, borderWidth: 2 },
  avatarStackExtra: { marginLeft: -6, minWidth: 18, height: 18, borderRadius: 999, borderWidth: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  avatarStackExtraText: { fontSize: 8, fontWeight: "800" },
  // Botón "+" (nueva conversación con este agente) en la cabecera del grupo.
  agentNewBtn: { marginTop: 5, marginRight: 2, width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
});
