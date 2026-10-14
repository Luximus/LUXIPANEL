// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Paginador de proyectos / subproyectos (chevron izq/der).
export const styles = StyleSheet.create({
  pagerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 3 },
  pagerBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  pagerText: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
