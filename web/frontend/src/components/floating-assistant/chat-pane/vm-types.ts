// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared types for the ChatPane orchestrator hook split. `ChatPaneProps` is the
 * pane's public props (members byte-identical to the original inline type).
 * `ChatPaneActions` is the small set of handlers referenced BACKWARD by earlier
 * tramos (state/derived) — they are threaded through a plain `actions` bag so the
 * sub-hooks stay contiguous and the flattened React-hook sequence is unchanged.
 */
import { type VoiceConfigState, type ApprovalMode, type AssistantAgent } from "../assistant-api";
import { type MobileNavController } from "../MobileNavModal";

export interface ChatPaneProps {
  onRestoreProvider?: (provider: string, conversationId: string) => void;
  provider: string;
  mode: "api" | "cli";
  /** Active model id — gates attachment support by the model's real capability. */
  model?: string;
  /** Default model to preselect in the composer for a NEW loose/project chat on
   *  THIS provider (per-server `defaultChatModel`, already validated & scoped by
   *  ChatTab). Undefined / "auto" → the composer starts on Auto. Never applied to
   *  agent chats or when reopening an existing conversation. */
  initialModel?: string;
  /** UI complexity mode — "simple" humanizes tool traces and hides jargon. */
  uiMode?: "simple" | "advanced";
  /** Voice (audio in/out) settings + capabilities; null when unavailable. */
  voice?: VoiceConfigState | null;
  /** How the agent conducts mutating actions (manual / auto / plan). Drives the
   *  selector in the chat header. */
  approvalMode?: ApprovalMode;
  /** Persist a new approval mode (bubbles to the panel-level config state). */
  onApprovalModeChange?: (mode: ApprovalMode) => Promise<boolean>;
  /** When set (with a bumped `openNonce`), opens this conversation — used by the Dashboard. */
  openConversationId?: string | null;
  /** Project (parent or child) the opened conversation belongs to, so opening a
   *  chat from the Dashboard also selects its project here. null = loose chat. */
  openProjectId?: string | null;
  /** When set with a bumped `openNonce` and NO conversationId, starts a fresh
   *  chat bound to this custom agent — used by the Agents tab "Iniciar chat". */
  openAgentId?: string | null;
  /** The owning agent of the conversation being opened from the Dashboard (null
   *  for loose/project chats). Used to select the conversation-list tab (Agentes
   *  IA vs Sueltos/Proyectos) synchronously, without depending on the async,
   *  best-effort meta fetch (which may 404 for orphan/not-yet-persisted chats). */
  openConversationAgentId?: string | null;
  /** Bumped by the parent so the same conversation can be re-opened. */
  openNonce?: number;
  /** Launch a chat bound to a custom agent (switches to its provider sub-tab).
   *  Used by the chat sidebar's "Agentes" section to start any agent. */
  onLaunchAgent?: (agent: AssistantAgent) => void;
  /** When set, prefills the composer with this text (e.g. from the mail inbox "Depurar con IA"). */
  seedText?: string | null;
  /** When true, the seeded prompt is sent automatically (e.g. files AI input). */
  seedAutoSend?: boolean;
  /** When true, the seed starts a fresh conversation instead of the active one. */
  seedNewChat?: boolean;
  /** Bumped by the parent on each new seed so identical text re-triggers. */
  seedNonce?: number;
  /** Called once the seed has been applied so the parent can clear it. */
  onSeedConsumed?: () => void;
  /** On mobile, the composer is portaled into this slot (below the tab bars). */
  mobileBottomSlot?: HTMLElement | null;
  /** True when this pane is the visible one — only the active pane portals. */
  active?: boolean;
  // ── Bridge `lxp:assistant:request v1` ─────────────────────────────────────
  /** RequestId externo (solo para el provider resuelto en ChatTab). */
  assistantRequestOpenRequestId?: string | null;
  /** Texto del request externo. */
  assistantRequestPrompt?: string | null;
  /** "auto" crea+envía; "prefill" sólo rellena composer. */
  assistantRequestSubmit?: "auto" | "prefill" | null;
  assistantRequestServerEntries?: import("@/lib/assistant-request").AssistantServerEntry[];
  /** Nonce bumpeado en cada nuevo request. */
  assistantRequestNonce?: number;
  /** Llamado tras enviar/prefill; limpia el slot en el panel. */
  onAssistantRequestConsumed?: () => void;
  /** Mobile-only: provider switcher shown as a composer button + bottom-sheet
   *  modal (replaces the provider sub-tab strip, hidden on phones). */
  mobileProviderNav?: MobileNavController;
  /** Drawer-only: closes the assistant. Rendered as a ✕ in the chat header on
   *  phones (the bottom nav that held the close button is hidden on chat). */
  onCloseDrawer?: () => void;
}

export interface ChatPaneActions {
  reloadList: (q: string) => Promise<void>;
  send: (
    explicitText?: string,
    opts?: {
      forceNew?: boolean;
      queue?: boolean;
      planDecision?: "approve";
      agentIdOverride?: string | null;
      projectIdOverride?: string | null;
      conversationIdOverride?: string | null;
      attachmentsOverride?: import("../assistant-api").ChatAttachment[];
      reasoningEffort?: "low" | "medium" | "high" | "xhigh";
    },
  ) => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  newConversation: (opts?: { preserveAgent?: boolean }) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePin: (id: string, pinned: boolean) => Promise<void>;
}
