// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ChatPane orchestrator hook. The original monolithic body is split into three
 * CONTIGUOUS tramos (state -> derived -> actions), called here in the SAME order,
 * so the flattened sequence of primitive React-hook calls is byte-identical to
 * the monolith (tramo 3 has no hooks). Values flow forward via `s`/`d`; the few
 * BACKWARD references (earlier tramos calling later handlers) go through the
 * plain `actions` bag, which is populated after the last tramo runs — no extra
 * hook, no reordering. Public props (`ChatPaneProps`) are unchanged.
 */
import { useChatPaneState } from "./use-chat-pane-state";
import { useChatPaneDerived } from "./use-chat-pane-derived";
import { useChatPaneActions } from "./use-chat-pane-actions";
import { type ChatPaneProps, type ChatPaneActions } from "./vm-types";

export type { ChatPaneProps };

export function useChatPane(props: ChatPaneProps) {
  const {
  provider,
  mode,
  model,
  initialModel,
  uiMode = "simple",
  voice,
  approvalMode = "manual",
  onApprovalModeChange,
  openConversationId,
  openProjectId,
  openAgentId,
  openConversationAgentId,
  openNonce,
  onLaunchAgent,
  seedText,
  seedAutoSend,
  seedNewChat,
  seedNonce,
  onSeedConsumed,
  mobileBottomSlot,
  active,
  mobileProviderNav,
  onCloseDrawer,
  assistantRequestOpenRequestId,
  assistantRequestPrompt,
  assistantRequestSubmit,
  assistantRequestNonce,
  onAssistantRequestConsumed,
  } = props;
  // Shared bag for the few handlers referenced BACKWARD by tramos 1/2 (defined
  // in tramo 3 / reloadList in tramo 2). Populated after the tramos run; the
  // wrappers in tramos 1/2 read it at call time (post-render), mirroring the
  // hoisted-function reachability the monolith relied on. Not a hook.
  const actions = {} as ChatPaneActions;
  const state = useChatPaneState(props, actions);
  const derived = useChatPaneDerived(props, state, actions);
  const handlers = useChatPaneActions(props, state, derived);
  Object.assign(actions, { reloadList: derived.reloadList }, handlers);
  return {
    provider,
    mode,
    model,
    initialModel,
    uiMode,
    voice,
    openConversationId,
    openProjectId,
    openAgentId,
    openConversationAgentId,
    openNonce,
    onLaunchAgent,
    seedText,
    seedAutoSend,
    seedNewChat,
    seedNonce,
    onSeedConsumed,
    mobileBottomSlot,
    active,
    mobileProviderNav,
    onCloseDrawer,
    assistantRequestOpenRequestId,
    assistantRequestPrompt,
    assistantRequestSubmit,
    assistantRequestNonce,
    onAssistantRequestConsumed,
    ...state,
    ...derived,
    ...handlers,
  };
}

export type ChatPaneVM = ReturnType<typeof useChatPane>;
