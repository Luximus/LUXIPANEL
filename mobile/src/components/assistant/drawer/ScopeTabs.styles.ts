// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Tabs de scope del drawer (Agentes IA / Sueltos·Proyectos), segmentado compacto.
export const styles = StyleSheet.create({
  scopeTabs: { flexDirection: "row", borderRadius: 10, borderWidth: 1, padding: 2, gap: 2 },
  scopeTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 7, borderRadius: 8 },
  scopeTabText: { fontSize: 11.5, fontWeight: "700" },
});
