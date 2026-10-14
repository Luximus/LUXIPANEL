// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  quickTurnRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  quickTurnChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
  quickTurnText: { fontSize: 11.5, fontWeight: "600" },
  turnDivider: { height: 1, alignSelf: "stretch", marginTop: 8 },
});
