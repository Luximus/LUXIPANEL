import { localizeServerError } from '../../../lib/server-error-localization';
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React from "react";
import { StyleSheet, View } from "react-native";
import { MessageSquare } from "lucide-react-native";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import type { Conversation } from "../../../features/assistant/types";
import type { AssistantStrings } from "../types";
import { ConfirmationModal } from "../../ui/ConfirmationModal";
import { PanelText as Text } from "../../ui/PanelText";

export function DeleteConversationDialog({ conversation, deleting, error, t, onCancel, onConfirm }: {
  conversation: Conversation | null;
  deleting: boolean;
  error: boolean;
  t: AssistantStrings;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const language = loadSessionState().language;
  const messages = getMessages(language);
  const copy = messages.assistantDrawer;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const textAlign = getLocaleTextAlign(language);
  return (
    <ConfirmationModal visible={!!conversation} onCancel={onCancel} onConfirm={onConfirm} title={t.deleteConv} language={language}
      message={copy.deleteConvDescription} submitting={deleting}
      confirmLabel={t.deleteAction ?? messages.common.delete} cancelLabel={messages.common.cancel}
    >
      <View style={[styles.conversation, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border, flexDirection: getLocaleRowDirection(language) }]}>
        <MessageSquare size={19} color={tokens.textMuted} />
        <View style={styles.details}>
          <Text numberOfLines={3} style={[styles.title, { color: tokens.textPrimary, textAlign }]}>
            {conversation?.title?.trim() || conversation?.id.slice(0, 8)}
          </Text>
          {!!conversation?.preview?.trim() && <Text numberOfLines={2} style={[styles.preview, { color: tokens.textMuted, textAlign }]}>{conversation.preview.trim()}</Text>}
        </View>
      </View>
      {deleting && <Text accessibilityLiveRegion="polite" style={{ color: tokens.textMuted, textAlign }}>{copy.deletingConv}</Text>}
      {error && <View style={[styles.error, { backgroundColor: withAlpha(tokens.danger, 0.1) }]}>
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.preview, { color: tokens.danger, textAlign }]}>{localizeServerError(copy.deleteConvError)}</Text>
      </View>}
    </ConfirmationModal>
  );
}

const styles = StyleSheet.create({
  conversation: { alignItems: "center", gap: 12, padding: 14, borderRadius: 13, borderWidth: 1 },
  details: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  preview: { fontSize: 12, lineHeight: 18 },
  error: { padding: 12, borderRadius: 10 },
});
