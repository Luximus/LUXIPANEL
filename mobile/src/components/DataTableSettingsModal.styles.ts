import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  tabs: { flexWrap: "wrap", borderBottomWidth: 1, paddingBottom: 10, marginBottom: 10 },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 10, 26, 0.45)",
  },
  drawerSheet: {
    height: "100%",
    borderLeftWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: -8, height: 0 },
    elevation: 16,
    overflow: "hidden",
  },
  drawerHeader: {
    minHeight: 52,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    gap: 12,
  },
  drawerTitle: { flex: 1, fontSize: 15, fontWeight: "800" },
  drawerClose: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  drawerBody: { flex: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  drawerScroll: { flex: 1 },
  accordion: { borderWidth: 1, borderRadius: 12, overflow: "hidden", marginBottom: 8 },
  accordionHeader: { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  accordionTitle: { flex: 1, fontSize: 13, fontWeight: "700" },
  accordionBody: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2, gap: 10 },
  providerCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10, marginBottom: 8 },
  providerHeader: { alignItems: "center", gap: 10 },
  providerLogo: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  providerPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  providerActions: { flexWrap: "wrap", gap: 8, alignItems: "center" },
  tabsRow: { borderBottomWidth: 1, paddingBottom: 10, marginBottom: 10 },
  // Sub-conmutador (Lista/Registro) de los tabs SSH/Categorías: mismo espaciado
  // que los sub-tabs internos del sheet central (ActionsSheet `subToggle`): pills
  // con margen, sin línea divisoria inferior.
  subToggle: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2 },
  // Cuerpo del tab "Categorías"/"SSH" en el drawer izquierdo: padding horizontal
  // igual al del cuerpo del tab "Server" (`scrollBody` = padding 12) para que el
  // contenido (búsqueda/listas/formulario) quede alineado con el sub-conmutador y no
  // pegado a los bordes. `gap` separa cada elemento apilado (buscador↔lista, y cada
  // input del formulario de registro) en lugar de que queden pegados.
  catTagBody: { paddingHorizontal: 12, gap: 10 },
  // Botón FIJO en la parte inferior del tab (SSH/Categorías): abre el drawer
  // central de formularios (FormSheet) con el formulario de registro del tab.
  registerBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1 },
  // Cuerpo de los formularios dentro del FormSheet (el sheet ya aporta padding).
  sheetForm: { gap: 10 },
  body: { gap: 10, paddingBottom: 8 },
  // En el drawer el cuerpo no debe quedar pegado a la barra de tabs: mismo
  // respiro superior (12) que los tabs Server/Snippets/Chat del drawer.
  bodyDrawer: { paddingTop: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "800" },
  // Sub-encabezado dentro del tab "Categorías" (separa Categorías / Tags en cada sub-tab).
  // El espaciado lo aporta el `gap` del contenedor (`catTagBody`); la separación EXTRA
  // entre los grupos Categorías/Tags la da el `groupDivider` (línea) intercalado.
  groupLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  // Línea separadora entre los grupos Categorías y Tags (lista y registro). El `gap`
  // del contenedor le deja 10px arriba/abajo, así queda centrada entre ambos grupos.
  groupDivider: { height: 1, marginVertical: 2 },
  row: { gap: 8, alignItems: "center" },
  tagInlineRow: { gap: 8, alignItems: "center" },
  tagCategorySelect: { width: 140, minHeight: 42, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  tagInputInline: { flex: 1 },
  input: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  searchWrap: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  keyListContainer: {
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: 280,
  },
  keyListScroll: { maxHeight: 280 },
  keyList: { paddingVertical: 4 },
  // Estado vacío de las listas (categorías/tags/llaves): texto centrado para
  // que el contenedor no se vea como una barra sola sin contenido.
  emptyListText: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  keyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.24)",
  },
  // Última fila de la lista: sin separador para no duplicar la línea con el
  // borde del contenedor (se ve como dos rayas pegadas).
  keyRowLast: {
    borderBottomWidth: 0,
  },
  apiTokenRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  apiTokenInput: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  apiActionsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  tabIconBtn: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  selectBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  paginationRow: { alignItems: "center", justifyContent: "center", gap: 10 },
  pageBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowInlineInput: {
    minWidth: 150,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 14,
    fontWeight: "600",
  },
});
