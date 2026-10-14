// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Árbol de Agentes IA (líder → subordinados, paridad con AgentThreadedConvos web).
// Cada colapsable/entrada de nivel superior va en SU PROPIA tarjeta (radius 14,
// borde, separación vertical) en vez de apilarse dentro de un único bloque gris.
export const styles = StyleSheet.create({
  agentTopCard: { borderWidth: 1, borderRadius: 14, marginBottom: 8, paddingVertical: 2, overflow: "hidden" },
  // Contenedor anidado (chats propios + sub-colapsables): línea vertical izquierda.
  agentNested: { marginLeft: 12, borderLeftWidth: 1, paddingLeft: 4 },
  agentNestedEmpty: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 5 },
});
