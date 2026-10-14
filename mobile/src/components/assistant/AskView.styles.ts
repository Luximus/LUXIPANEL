// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  askQuestion: { gap: 6 },
  askInput: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  askOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  askOption: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
  askOptionText: { fontSize: 12, fontWeight: "600" },
  askSubmit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start" },
  askSubmitText: { fontSize: 12.5, fontWeight: "800", color: "#fff" },
});
