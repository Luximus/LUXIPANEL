import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "90%",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  // Tarjeta de altura fija (90%): acota el scroll interno cuando el cuerpo no
  // envuelve en ScrollView (scrollable=false). Mantiene maxHeight como tope.
  cardFill: {
    height: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerNoTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 12,
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
  // Cuerpo sin ScrollView (scrollable=false): rellena la tarjeta para que el
  // contenido (FlatList / ScrollView propio) tenga altura acotada y haga scroll.
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
