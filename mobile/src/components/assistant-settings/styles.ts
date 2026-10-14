import { StyleSheet } from "react-native";

// Estilos compartidos por los sub-tabs de ajustes del asistente. Colores se
// aplican inline con los tokens del tema (no se codifican aquí).
export const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, gap: 14, paddingBottom: 40 },

  // Encabezado de sección
  sectionHead: { gap: 3, marginBottom: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionDesc: { fontSize: 12, lineHeight: 17 },

  // Tarjeta genérica
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardDesc: { fontSize: 12, lineHeight: 16 },

  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },

  fieldLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  field: { gap: 4 },

  // Estados centrados (carga / error / vacío)
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10, minHeight: 160 },
  centerText: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  // Badges
  badge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700" },

  // Stats grid
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },

  // Filas de tabla simple
  tableRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 7, borderTopWidth: 1 },
  tableCellLabel: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  tableCellValue: { fontSize: 12, fontWeight: "700" },
  mono: { fontFamily: "monospace", fontSize: 11 },

  // Toggle row (switch + label)
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  toggleMain: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 13, fontWeight: "600" },
  toggleHint: { fontSize: 11, lineHeight: 15 },

  divider: { height: 1, marginVertical: 2 },

  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },

  // Modal-ish form container
  formGap: { gap: 10 },
});
