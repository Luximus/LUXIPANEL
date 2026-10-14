import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import React, { useContext, useEffect, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { Pressable, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { loadSessionState } from "../../lib/session-state";
import { useNativeModuleVisible } from "../main/native-module-context";
import { NativeModuleContext } from "../main/native-module-context";
import { useServerMessaging } from "../../lib/use-server-messaging";
import { startServerCall } from "../../lib/server-calls";
import { downloadServerFile } from "../../api/serverApi";
import { serverUserText } from "../../i18n/server-user-messages";
import type { Message } from "../../api/serverUserApi";
type PendingAttachment = { name: string; mimeType: string; dataBase64: string };
export function NativeMessagingScreen({
  panelId,
  onBack,
}: {
  panelId: string;
  token: string;
  onBack: () => void;
}) {
  const visible = useNativeModuleVisible(),
    moduleContext = useContext(NativeModuleContext),
    chat = useServerMessaging(panelId, visible),
    { theme } = useTheme(),
    colors = getThemeTokens(theme === "dark");
  const language = loadSessionState().language,
    t = serverUserText(language);
  const [newChat, setNewChat] = useState(false),
    [groupName, setGroupName] = useState(""),
    [members, setMembers] = useState<string[]>([]);
  const [editing, setEditing] = useState<Message | null>(null),
    [editBody, setEditBody] = useState(""),
    [deleting, setDeleting] = useState<Message | null>(null),
    [attachments, setAttachments] = useState<
      Record<string, PendingAttachment[]>
    >({}),
    [transcript, setTranscript] = useState("");
  useEffect(() => {
    if (visible && moduleContext?.selectedView) void chat.select(moduleContext.selectedView);
  }, [visible, moduleContext?.selectedView, moduleContext?.viewRevision]);
  const input = {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.textPrimary,
    padding: 12,
    backgroundColor: colors.bgInput,
  };
  const safely = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      chat.setError(
        error instanceof Error ? error.message : t("chat.errorLoad"),
      );
    }
  };
  const attach = () =>
    safely(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !chat.active) return;
      const chosen: PendingAttachment[] = [];
      for (const asset of result.assets) {
        if ((asset.size ?? 0) > 15_000_000) throw new Error("20 MB");
        chosen.push({
          name: asset.name,
          mimeType: asset.mimeType ?? "application/octet-stream",
          dataBase64: await new File(asset.uri).base64(),
        });
      }
      const id = chat.active;
      setAttachments((previous) => ({
        ...previous,
        [id]: [...(previous[id] ?? []), ...chosen],
      }));
    });
  const download = (id: string, name: string) =>
    safely(async () => {
      const blob = await downloadServerFile(
        panelId,
        "",
        `/api/chat/attachments/${encodeURIComponent(id)}`,
      );
      const file = new File(Paths.cache, name.replace(/[^a-zA-Z0-9._-]/g, "_"));
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(blob);
      });
      file.write(Uint8Array.from(atob(data), (char) => char.charCodeAt(0)));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
    });
  const selected = chat.conversations.find((row) => row.id === chat.active),
    pending = chat.active ? (attachments[chat.active] ?? []) : [];
  return (
    <ServerModuleScreen
      title={t("chat.pageTitle")}
      onBack={onBack}
      error={chat.error}
      onRetry={() => void chat.refresh()}
      action={{
        label: t("chat.newConversation"),
        onPress: () => setNewChat(true),
      }}
    >
      <View style={selected ? { display: "none" } : undefined}>
        {chat.rows.map((conversation) => (
          <Pressable
            key={conversation.id}
            onPress={() => void chat.select(conversation.id)}
            style={{
              padding: 12,
              borderRadius: 10,
              backgroundColor:
                conversation.id === chat.active
                  ? colors.bgInput
                  : colors.bgCardSolid,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: conversation.unread ? "700" : "400",
              }}
            >
              {conversation.displayTitle}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.textMuted }}>
              {conversation.lastMessagePreview}
            </Text>
          </Pressable>
        ))}
        <Button
          variant="ghost"
          label={`${t("chat.sections.groups")} ${chat.groupsExpanded ? "−" : "+"}`}
          onPress={() => chat.setGroupsExpanded((value) => !value)}
        />
        {chat.groupsExpanded && chat.groupPageCount > 1 && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              variant="ghost"
              label={t("chat.pager.prev")}
              disabled={!chat.groupPage}
              onPress={() => chat.setGroupPage((value) => value - 1)}
            />
            <Button
              variant="ghost"
              label={t("chat.pager.next")}
              disabled={chat.groupPage >= chat.groupPageCount - 1}
              onPress={() => chat.setGroupPage((value) => value + 1)}
            />
          </View>
        )}
      </View>
      {selected ? (
        <View style={{ gap: 12 }}>
          <Button
            label={t("chat.media.previous")}
            variant="ghost"
            onPress={chat.clearSelection}
          />
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Text
              style={{ color: colors.textPrimary, flex: 1, fontWeight: "700" }}
            >
              {selected.displayTitle}
            </Text>
            <Button
              label={t("chat.call.action")}
              onPress={() =>
                void safely(() => startServerCall(panelId, selected.id))
              }
            />
          </View>
          <Button
            variant="ghost"
            label={t("chat.pager.prev")}
            loading={chat.busy}
            onPress={() => void chat.older()}
          />
          {chat.messages.map((message) => (
            <View
              key={message.id}
              style={{
                padding: 12,
                backgroundColor: colors.bgCardSolid,
                borderRadius: 12,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {message.fromDisplayName || t("chat.unknownUser")}
              </Text>
              <Text
                selectable
                style={{
                  color: colors.textPrimary,
                  fontSize:
                    chat.preferences.appearance.fontSize === "sm"
                      ? 12
                      : chat.preferences.appearance.fontSize === "lg"
                        ? 18
                        : 14,
                }}
              >
                {message.deletedAt ? t("chat.deletedMessage") : message.body}
              </Text>
              {message.attachments?.map((attachment) => (
                <Button
                  key={attachment.id}
                  variant="ghost"
                  label={attachment.name}
                  onPress={() => void download(attachment.id, attachment.name)}
                />
              ))}
              {!message.deletedAt && message.from === chat.me ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    label={t("chat.edit")}
                    onPress={() => {
                      setEditing(message);
                      setEditBody(message.body);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    label={t("chat.delete")}
                    onPress={() => setDeleting(message)}
                  />
                </View>
              ) : null}
              {!message.deletedAt && message.system ? (
                <Button
                  variant="ghost"
                  size="sm"
                  label={t("chat.call.transcript.open")}
                  onPress={() =>
                    void safely(async () => {
                      const response = await chat.api.transcript(
                        selected.id,
                        message.id,
                      );
                      setTranscript(
                        response.segments
                          .map(
                            (segment) =>
                              `${segment.speakerDisplayName ?? ""}: ${segment.text}`,
                          )
                          .join("\n") || t("chat.call.transcript.empty"),
                      );
                    })
                  }
                />
              ) : null}
            </View>
          ))}
          {pending.map((attachment, index) => (
            <Button
              key={index}
              variant="ghost"
              label={`${attachment.name} ×`}
              onPress={() =>
                setAttachments((previous) => ({
                  ...previous,
                  [selected.id]: pending.filter((_, i) => i !== index),
                }))
              }
            />
          ))}
          <TextInput
            accessibilityLabel={t("chat.composerPlaceholder")}
            style={input}
            multiline
            value={chat.draft}
            onChangeText={chat.setDraft}
            placeholder={t("chat.composerPlaceholder")}
            placeholderTextColor={colors.textMuted}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              label={t("chat.attach")}
              variant="ghost"
              onPress={() => void attach()}
            />
            <Button
              label={t("chat.send")}
              loading={chat.busy}
              onPress={() => {
                const id = selected.id;
                void chat.send(pending).then((sent) => {
                  if (sent)
                    setAttachments((previous) => ({ ...previous, [id]: [] }));
                });
              }}
            />
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.textMuted }}>
          {t("chat.selectConversation")}
        </Text>
      )}
      <FormDrawer
        visible={newChat}
        onClose={() => setNewChat(false)}
        title={t("chat.newConversation")}
      >
        {chat.error && (
          <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>
            {localizeServerError(chat.error)}
          </Text>
        )}
        {chat.directory.users.map((user) => (
          <View
            key={user.username}
            style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
          >
            <Button
              variant="ghost"
              label={user.displayName || t("chat.unknownUser")}
              onPress={() =>
                void safely(async () => {
                  const created = await chat.create({
                    kind: "dm",
                    username: user.username,
                  });
                  if (created) setNewChat(false);
                })
              }
            />
            <Button
              variant="ghost"
              label={members.includes(user.username) ? "✓" : nativeText("+")}
              onPress={() =>
                setMembers((previous) =>
                  previous.includes(user.username)
                    ? previous.filter((id) => id !== user.username)
                    : [...previous, user.username],
                )
              }
            />
          </View>
        ))}
        {chat.directory.groups.map((group) => (
          <Button
            key={group.name}
            variant="ghost"
            label={group.name}
            onPress={() =>
              void safely(async () => {
                const created = await chat.create({
                  kind: "linux-group",
                  group: group.name,
                });
                if (created) setNewChat(false);
              })
            }
          />
        ))}
        <TextInput
          style={input}
          value={groupName}
          onChangeText={setGroupName}
          placeholder={t("chat.newChat.customName")}
        />
        <Button
          label={t("chat.newChat.create")}
          disabled={!groupName.trim() || !members.length}
          onPress={() =>
            void safely(async () => {
              const created = await chat.create({
                kind: "group",
                title: groupName,
                members,
              });
              if (created) setNewChat(false);
            })
          }
        />
      </FormDrawer>
      <FormDrawer
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={t("chat.edit")}
      >
        {chat.error && (
          <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>
            {localizeServerError(chat.error)}
          </Text>
        )}
        <TextInput
          style={input}
          value={editBody}
          onChangeText={setEditBody}
          multiline
        />
        <Button
          label={t("chat.save")}
          onPress={() =>
            void safely(async () => {
              if (!editing) return;
              const updated = await chat.api.edit(
                editing.convId,
                editing.id,
                editBody,
              );
              chat.setMessages((previous) =>
                previous.map((row) => (row.id === updated.id ? updated : row)),
              );
              setEditing(null);
            })
          }
        />
      </FormDrawer>
      <Modal
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("chat.delete")}
      >
        {chat.error && (
          <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>
            {localizeServerError(chat.error)}
          </Text>
        )}
        <Button
          label={t("chat.delete")}
          variant="danger"
          onPress={() =>
            void safely(async () => {
              if (!deleting) return;
              const updated = await chat.api.remove(
                deleting.convId,
                deleting.id,
              );
              chat.setMessages((previous) =>
                previous.map((row) => (row.id === updated.id ? updated : row)),
              );
              setDeleting(null);
            })
          }
        />
      </Modal>
      <Modal
        visible={!!transcript}
        onClose={() => setTranscript("")}
        title={t("chat.call.transcript.title")}
      >
        <Text selectable style={{ color: colors.textPrimary }}>
          {transcript}
        </Text>
      </Modal>
    </ServerModuleScreen>
  );
}
