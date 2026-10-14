// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  compactWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  compactLine: { flex: 1, height: 1 },
  compactPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  compactPillText: { fontSize: 10.5, fontWeight: "600" },
  compactBody: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
});
