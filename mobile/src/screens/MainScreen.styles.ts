import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  blogDrawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "flex-end",
    zIndex: 40,
    elevation: 40,
  },
  blogDrawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 18, 0.5)",
  },
  blogDrawer: {
    height: "100%",
    borderLeftWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: -8, height: 0 },
    elevation: 16,
    overflow: "hidden",
  },
  serverDrawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "flex-start",
    zIndex: 40,
    elevation: 40,
  },
  serverDrawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 18, 0.5)",
  },
  serverDrawer: {
    height: "100%",
    borderRightWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 8, height: 0 },
    elevation: 16,
    overflow: "hidden",
  },
  // Overlay del terminal nativo ("Nueva terminal"/consolas) a pantalla completa
  // sobre el dashboard. Por encima de la portada y del avatar flotante (zIndex 50);
  // el drawer izquierdo va aún más arriba al renderse como RN Modal.
  nativeTerminalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  // Overlay de una pantalla de módulo NATIVA (RN): por encima del overlay de
  // webviews de módulos; la propia pantalla aporta su fondo opaco.
  nativeModuleOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 55,
    elevation: 55,
  },
  // Cada consola montada ocupa todo el overlay; solo la activa se muestra (el resto
  // con `display:"none"` para seguir VIVAS).
  consoleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  // Indicador de carga de la activación diferida: pantalla SÓLIDA oscura (el color lo
  // pone el render con `bgPrimary`) con spinner + textos centrados. Sin velo
  // translúcido ni tarjeta/sombra (se veía raro sobre el dashboard).
  moduleLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 52,
    elevation: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  moduleLoadingTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  moduleLoadingHint: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 18 },
  // Avatar de cuenta flotante (esquina inferior derecha del dashboard), donde
  // antes estaban las flechas del carousel. `bottom` se fija inline con la safe-area.
  floatingAvatar: {
    position: "absolute",
    right: 14,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 25,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  // Bottom-sheet central (swipe-up): overlay anclado abajo + sheet al 90%.
  actionsSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "column",
    justifyContent: "flex-end",
    zIndex: 45,
    elevation: 45,
  },
  actionsSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 18, 0.5)",
  },
  actionsSheet: {
    width: "100%",
    // 100% del contenedor (abre completo). Sin radio ni borde superior: queda a
    // ras de la barra de tabs (`DrawerTopBar`).
    height: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
    overflow: "hidden",
  },
  // Overlay del drawer central "Más opciones": zIndex 60 para quedar POR ENCIMA
  // del overlay de webviews de módulo (zIndex 50), así "Más opciones" reabre el
  // drawer visible aunque haya un módulo a pantalla completa.
  modulePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "column",
    justifyContent: "flex-end",
    zIndex: 60,
    elevation: 60,
  },
  // Drawer central "Más herramientas": abre COMPLETO (100% de la pantalla) igual
  // que el `actionsSheet` (sin radio ni borde superior, a ras de la pantalla). El
  // inset superior lo reserva el contenedor en el render (tiene cabecera propia, no
  // usa el navbar).
  modulePickerSheet: {
    width: "100%",
    height: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
    overflow: "hidden",
  },
  // Asa inferior para abrir el sheet (centrada sobre el borde inferior).
  sheetHandleZone: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 30,
  },
  sheetHandle: {
    width: 72,
    height: 22,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
