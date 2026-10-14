// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { StyleSheet } from "react-native";

// ── Portada (antes de iniciar el chat) ─────────────────────────────────────
// Todo el bloque (logo + título + 4 métricas + separador + botones) se agrupa y
// se centra verticalmente, de modo que los botones suben desde el fondo y las
// métricas/separador llenan el hueco entre el título y los botones.
export const styles = StyleSheet.create({
  introWrap: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 22 },
  introHero: { alignSelf: "stretch", alignItems: "center", gap: 14 },
  // Eleva el hero sobre la fila de métricas cuando el tooltip de usuarios abre
  // (zIndex ordena hermanos en ambas plataformas; sin elevation para no proyectar
  // sombra sobre todo el hero en Android).
  introHeroRaised: { zIndex: 30 },
  // Fila de 4 métricas en vivo (mismas que el tab Server del drawer izquierdo).
  introStatsRow: { flexDirection: "row", alignSelf: "stretch", gap: 8 },
  introStatCard: { flex: 1, flexBasis: 0, minWidth: 0, alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4 },
  introStatValue: { fontSize: 15, fontWeight: "900" },
  introStatLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  introSeparator: { alignSelf: "stretch", height: 1, marginVertical: 2 },
  // Contenedor del logo: el icono de la app va de BASE (siempre visible) y el
  // logo de marca remoto se superpone; si el remoto falla o no carga, se ve la base.
  introLogo: { width: 112, height: 112, borderRadius: 26, overflow: "hidden" },
  introLogoImg: { width: "100%", height: "100%" },
  introLogoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  introTitle: { fontSize: 19, fontWeight: "800", textAlign: "center" },
  // Título con estrella de favorito a la izquierda + IP enmascarada debajo.
  introTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  // Badge "compartido por X" (paneles compartidos): chip clickeable centrado.
  sharedBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6, maxWidth: "90%" },
  sharedBadgeText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  introIpRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
  introIpText: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  introIpToggle: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  // Botón "usuarios conectados" (icono + contador) junto a la IP, con tooltip
  // anclado debajo (lista de nombres). El ancla es relativa; el popover absoluto.
  introUsersAnchor: { position: "relative" },
  introUsersBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 30, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1 },
  introUsersCount: { fontSize: 12.5, fontWeight: "800" },
  // Capa invisible que cubre el área alrededor para cerrar al tocar fuera.
  introUsersBackdrop: { position: "absolute", top: -1000, bottom: -1000, left: -1000, right: -1000, zIndex: 19 },
  introUsersPopover: {
    position: "absolute", top: 36, right: 0, minWidth: 150, maxWidth: 230,
    borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, gap: 4,
    zIndex: 20, elevation: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  introUsersPopTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 2 },
  introUsersList: { maxHeight: 168 },
  introUsersItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 3 },
  introUsersName: { fontSize: 13.5, fontWeight: "600", flexShrink: 1 },
  introUsersSessions: { fontSize: 11, fontWeight: "700" },
  introUsersEmpty: { fontSize: 12.5, lineHeight: 17 },
  // Nota pequeña de advertencia (p. ej. por qué aprobar la huella SSH).
  introNote: { fontSize: 11.5, lineHeight: 16, textAlign: "center", paddingHorizontal: 6, marginTop: -2, marginBottom: 2 },
  introBtns: { alignSelf: "stretch", gap: 10 },
  introBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  introBtnSecondary: { borderWidth: 1 },
  introBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  // Contenedor de "sin conexión con el servidor" (error de fondo): icono + motivo +
  // botón Actualizar. Con él, las acciones que requieren conexión se ocultan.
  introErrorBox: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  introErrorText: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
