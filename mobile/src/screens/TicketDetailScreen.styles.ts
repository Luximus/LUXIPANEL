import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  ticketTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  infoBadges: { flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  responsePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1,
  },
  responsePillText: {
    fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoMeta: { fontSize: 12, flexShrink: 1 },
  chatList: { padding: 12, paddingBottom: 24 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "92%" },
  messageRowOwn: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  messageRowAdmin: { alignSelf: "flex-start" },
  avatarSlot: { alignItems: "flex-end", justifyContent: "flex-end" },
  message: { gap: 4, flexShrink: 1 },
  messageOwn: { alignItems: "flex-end" },
  messageAdmin: { alignItems: "flex-start" },
  messageMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  adminTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  bubble: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, maxWidth: "100%", overflow: "hidden" },
  bubbleAttachmentsOnly: { minWidth: 220 },
  attachmentsList: { gap: 6, width: "100%" },
  attachmentsListWithContent: { marginTop: 8 },
  attachment: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, width: "100%",
  },
  attachmentInfo: { flex: 1, minWidth: 0 },
  attachmentBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 5, minWidth: 32, alignItems: "center",
  },
  replyBar: {
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8,
    borderTopWidth: 1, gap: 8,
  },
  replyInput: {
    minHeight: 80, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, textAlignVertical: "top",
  },
  replyActions: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
  },
  attachIconBtn: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  sendIconBtn: {
    width: 48, height: 44, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
});
