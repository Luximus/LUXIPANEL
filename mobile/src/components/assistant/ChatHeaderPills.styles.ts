// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  chatHeadBar: { gap: 6, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 6 },
  chatHeadSummary: { flexDirection: "row", alignItems: "center", gap: 6 },
  chatHeadDetails: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  chatHeadProject: { marginLeft: "auto", flexShrink: 1 },
  chatHeadAgentPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, maxWidth: 180 },
  chatHeadAgentName: { fontSize: 10, fontWeight: "600", flexShrink: 1 },
  chatHeadScopePill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, maxWidth: 160 },
  chatHeadScopeText: { fontSize: 10, fontWeight: "600", flexShrink: 1 },
});
