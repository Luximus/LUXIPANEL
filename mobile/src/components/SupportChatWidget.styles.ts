import { Platform, StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    left: 16,
    paddingHorizontal: 18,
    zIndex: 45,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  // Avatar redondeado del asistente activo dentro del FAB (reemplaza el icono).
  fabAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  backdrop: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  panel: {
    flex: 1,
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
  },
  headAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headTitleText: {
    fontWeight: "700",
    fontSize: 15,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 12,
    gap: 8,
  },
  msg: {
    maxWidth: "85%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  typing: {
    paddingVertical: 12,
    borderWidth: 1,
  },
  error: {
    alignSelf: "center",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 4,
  },
  actions: {
    gap: 6,
    marginTop: 6,
    alignItems: "flex-start",
    maxWidth: "85%",
    alignSelf: "flex-start",
  },
  action: {
    width: "100%",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 14,
  },
});
