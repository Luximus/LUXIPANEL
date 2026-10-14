// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  modFilesHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  modFilesTitle: { fontSize: 11.5, fontWeight: "700", flexShrink: 1 },
  modFilesCount: { minWidth: 18, height: 16, borderRadius: 8, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  modFilesCountText: { fontSize: 10, fontWeight: "800" },
  modFileRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1 },
  modFileName: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  modFileDir: { fontSize: 10, fontFamily: "monospace", flexShrink: 1 },
});
