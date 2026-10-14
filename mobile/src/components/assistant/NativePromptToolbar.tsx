// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState } from "react";
import { View } from "react-native";
import { Pressable } from "react-native";
import { Terminal } from "lucide-react-native";
import { PanelText as Text } from "../ui/PanelText";
import { getMessages } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { useAssistantComposer } from "../../features/assistant/hooks";
import { chatStore } from "../../features/assistant/chat-store";
import { chatController } from "../../features/assistant/chat-controller";
import type { ApprovalMode } from "../../features/assistant/types";
import { ConnectorBrowseModal, ConnectorsBar, ConnectorsManagerModal } from "../AssistantComposerExtras";
import { NativePromptSelectors } from "./NativePromptSelectors";

/** Selectores del prompt entre Historial/Proyecto y el campo de mensaje. */
export const NativePromptToolbar = React.memo(function NativePromptToolbar({ panelId, language, showTerminal }: { panelId: string; language?: string; showTerminal?: boolean }) {
  const composer = useAssistantComposer(panelId);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const t = getMessages(language).assistantComposer;
  const [managerOpen, setManagerOpen] = useState(false);
  const [browseId, setBrowseId] = useState<string | null>(null);
  const browseConnector = composer.connectors.find((item) => item.id === browseId) ?? null;
  return <View style={{ paddingHorizontal: 12, paddingTop: 5, paddingBottom: 6, gap: 5, backgroundColor: tokens.bgPrimary, borderTopWidth: 1, borderTopColor: tokens.border }}>
    <NativePromptSelectors panelId={panelId} language={language} approvalMode={composer.approvalMode}
      approvalOptions={[{ value: "manual", label: t.approvalManual }, { value: "auto", label: t.approvalAuto }, { value: "plan", label: t.approvalPlan }]}
      onApprovalChange={(mode: ApprovalMode) => { void chatController.setOptions(panelId, { approvalMode: mode }); }} />
    {(composer.connectors.length > 0 || (showTerminal && composer.terminalAvailable)) ? <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      {showTerminal && composer.terminalAvailable ? <Pressable onPress={() => chatController.openTerminal(panelId)} accessibilityLabel={t.terminal} style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: tokens.border, borderRadius: 8, paddingHorizontal: 8, minHeight: 34 }}><Terminal size={14} color={tokens.textSecondary} /><Text style={{ color: tokens.textSecondary, fontSize: 12, fontWeight: "600" }}>{t.terminal}</Text></Pressable> : null}
      <ConnectorsBar connectors={composer.connectors} tokens={tokens} onBrowse={setBrowseId} onManage={() => setManagerOpen(true)} />
    </View> : null}
    <ConnectorsManagerModal visible={managerOpen} connectors={composer.connectors} t={t} language={language} tokens={tokens}
      onClose={() => setManagerOpen(false)} onConnect={(id, secrets) => chatController.connectConnector(panelId, id, secrets)}
      onDisconnect={(id) => chatController.disconnectConnector(panelId, id)} />
    <ConnectorBrowseModal visible={!!browseConnector} connector={browseConnector} t={t} language={language} tokens={tokens}
      onClose={() => setBrowseId(null)} onBrowse={(id, query) => chatController.browseConnector(panelId, id, query)}
      onAttach={(id, fileId, name) => chatController.fetchConnectorFile(panelId, id, fileId, name)} />
  </View>;
});
