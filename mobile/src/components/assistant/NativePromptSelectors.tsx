import React from "react";
import { View } from "react-native";
import { ShieldCheck, Sparkles } from "lucide-react-native";
import { nativeChatControls } from "../../i18n/native-chat-controls";
import { getThemeTokens } from "../../theme/colors";
import { useTheme } from "../../hooks/useTheme";
import { Select } from "../ui/Select";
import { PROVIDER_META, ProviderIcon } from "../ProviderIcon";
import { useAssistantChat, useAssistantSession } from "../../features/assistant/hooks";
import type { ApprovalMode } from "../../features/assistant/types";
import { chatController } from "../../features/assistant/chat-controller";
import { chatStore } from "../../features/assistant/chat-store";
import { PROVIDER_MODELS } from "../../features/assistant/prompt-models";

export function NativePromptSelectors({ panelId, language, approvalMode, approvalOptions, onApprovalChange }: {
  panelId: string;
  language?: string;
  approvalMode: ApprovalMode;
  approvalOptions: { value: string; label: string }[];
  onApprovalChange: (mode: ApprovalMode) => void;
}) {
  const session = useAssistantSession(panelId);
  const chat = useAssistantChat(panelId);
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const t = nativeChatControls(language);
  const picker = { minWidth: 0, minHeight: 34, paddingHorizontal: 5, borderWidth: 0, borderRadius: 8 };
  const provider = session.provider;
  const hasEffort = provider === "claude" || provider === "codex" ||
    (provider === "grok" && chat.activeProviderCfg?.mode === "api");
  const efforts = [
    { value: "", label: t.auto },
    { value: "low", label: t.low },
    { value: "medium", label: t.medium },
    { value: "high", label: t.high },
    { value: "xhigh", label: t.xhigh },
  ];
  return <View style={{ flexDirection: "row", gap: 4, width: "100%" }}>
    <Select compact style={{ ...picker, flex: 1.3 }} placeholder={t.approval} accessibilityLabel={t.approval}
      leading={<ShieldCheck size={13} color={colors.textMuted} />}
      value={approvalMode} options={approvalOptions}
      onChange={value => onApprovalChange(value as ApprovalMode)} />
    <Select compact style={{ ...picker, flex: 1 }} placeholder={t.provider} accessibilityLabel={t.provider}
      leading={<ProviderIcon id={provider} size={13} color={colors.textMuted} />}
      value={provider}
      options={session.providers.map(value => ({ value, label: PROVIDER_META[value]?.label ?? value }))}
      onChange={next => {
        chatController.setProvider(panelId, next);
      }} />
    <Select compact style={{ ...picker, flex: 1.1 }} placeholder={t.model} accessibilityLabel={t.model}
      value={session.model ?? ""}
      options={[{ value: "", label: t.auto }, ...(PROVIDER_MODELS[provider] ?? []).map(value => ({ value, label: value }))]}
      onChange={model => { void chatController.setOptions(panelId, { model }); }} />
    {hasEffort ? <Select compact style={{ ...picker, flex: 0.95 }} placeholder={t.effort} accessibilityLabel={t.effort}
      leading={<Sparkles size={13} color={colors.textMuted} />}
      value={session.effort ?? ""} options={efforts}
      onChange={effort => { void chatController.setOptions(panelId, { effort: effort as "" | "low" | "medium" | "high" | "xhigh" }); }} /> : null}
  </View>;
}
