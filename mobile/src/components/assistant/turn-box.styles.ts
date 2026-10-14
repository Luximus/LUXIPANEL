// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

/** Caja base de los avisos por turno (permiso / ask). El color del borde y del
 *  fondo se inyecta inline según la semántica (ámbar/violeta/rojo/neutro).
 *  Compartida por `PermissionView` y `AskView`. */
export const turnBoxStyles = StyleSheet.create({
  turnBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, gap: 8, marginTop: 6 },
  turnBoxTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  turnBoxTitle: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  turnBoxBody: { fontSize: 12, lineHeight: 17 },
  askQuestionText: { fontSize: 12, fontWeight: "600" },
});
