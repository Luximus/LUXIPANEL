import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  // Overlay anclado abajo: el sheet sube desde el borde inferior.
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: "100%",
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  // Altura fija al 80% (formularios largos con scroll propio del contenido).
  sheetFill: {
    height: "80%",
  },
  // Zona de agarre (asa + cabecera): concentra el gesto de cierre por
  // swipe-abajo sin robarle el scroll vertical al cuerpo.
  grabZone: {
    paddingTop: 8,
  },
  handleRow: {
    alignItems: "center",
    paddingBottom: 4,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerNoTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
    paddingRight: 12,
  },
  titleRtl: {
    paddingRight: 0,
    paddingLeft: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: "700",
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyFill: {
    flex: 1,
    minHeight: 0,
  },
  bodyContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
});
