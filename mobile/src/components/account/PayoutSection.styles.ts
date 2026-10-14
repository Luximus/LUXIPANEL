import { StyleSheet } from "react-native";

// Estilos del desembolso de tokens → USD (pestaña "Pagos" del modal de cuenta).
// Subconjunto enfocado de los estilos que antes vivían en PaymentsTab.styles.ts:
// balance (glance), conversor, métodos, solicitud e historial + editor modal.
export const styles = StyleSheet.create({
  root: { gap: 12 },
  subtitle: { fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: "800", marginTop: 6, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.6 },
  plansContent: { paddingBottom: 8, gap: 12 },

  // Tarjetas de balance.
  glanceRow: { gap: 10 },
  glanceCard: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  glanceLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  glanceValue: { fontSize: 22, fontWeight: "900", marginTop: 6 },
  glanceMeta: { fontSize: 11, marginTop: 2 },

  // Tarjetas (método de desembolso / fila de historial).
  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardMeta: { fontSize: 12 },
  cardRef: { fontSize: 10, fontFamily: "monospace" },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },

  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 8 },
  emptyWrap: { alignItems: "center", justifyContent: "center", padding: 24 },

  // ── Payouts (desembolso de tokens → USD) ──
  payoutConverter: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  payoutConverterRow: { alignItems: "center", gap: 10 },
  payoutConverterField: { flex: 1, gap: 4 },
  payoutFieldLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  payoutInput: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 16, fontWeight: "700" },
  payoutUsdValue: { fontSize: 24, fontWeight: "900" },
  payoutArrow: { fontSize: 20, fontWeight: "900", marginTop: 16 },
  payoutMaxBtn: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  payoutMaxBtnText: { fontSize: 12, fontWeight: "800" },
  payoutMethodCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  payoutMethodTop: { alignItems: "center", justifyContent: "space-between", gap: 8 },
  payoutMethodActions: { alignItems: "center", gap: 6 },
  payoutMethodActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  payoutMethodActionText: { fontSize: 12, fontWeight: "700" },
  payoutModalForm: { gap: 12 },
  payoutModalField: { gap: 6 },
  payoutModalLabel: { fontSize: 12, fontWeight: "700" },
  payoutModalInput: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontWeight: "600" },
  payoutInlineError: { fontSize: 12, fontWeight: "600" },
  payoutDefaultRow: { alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 4 },
});
