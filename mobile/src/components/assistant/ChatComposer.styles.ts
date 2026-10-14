// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

/** Estilos del composer del chat (fase A5): portados 1:1 del modo
 *  `chat-composer` de `TitleBarTabs.styles.ts` (el navbar inferior ya no actúa
 *  como composer; ahora es una franja propia de `ChatScreen`). */
export const styles = StyleSheet.create({
  // Franja inferior de la pantalla del chat (equivalente al `bar` del navbar:
  // borde superior + fondo del tema + safe-area inferior vía padding dinámico).
  bar: {},
  column: {
    gap: 6,
    marginHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 50,
  },
  inputRow: { alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 6, marginHorizontal: 5, marginBottom: 5, borderWidth: 1, borderRadius: 14 },
  pillBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pillInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  plusMenu: {
    position: "absolute",
    bottom: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 190,
    zIndex: 60,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  sourceMenu: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  sourceRow: {
    minHeight: 42,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  plusMenuItem: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  plusMenuItemText: { fontSize: 13, fontWeight: "700" },
  attachRow: {
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
