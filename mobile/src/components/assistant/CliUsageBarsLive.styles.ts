// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// Estilos del skeleton / fallo del wrapper `CliUsageBarsLive` (las barras
// reales las pinta `CliUsageBars`, que trae sus propios estilos).
export const styles = StyleSheet.create({
  cliUsageWrap: { borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 6, gap: 5 },
  cliUsageHeadRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cliUsageTitle: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, flexShrink: 1 },
  cliUsageBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cliUsageTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  cliUsageFill: { height: "100%", borderRadius: 3 },
  cliUsageSkelLabel: { width: 64, height: 8, borderRadius: 4 },
  cliUsageSkelPct: { width: 40, height: 8, borderRadius: 4 },
  cliUsageFailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cliUsageFailText: { fontSize: 10, flexShrink: 1 },
  cliUsageRetry: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  cliUsageRetryText: { fontSize: 10, fontWeight: "600" },
});
