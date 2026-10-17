// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ChatAttachment } from "./assistant-api";
import { TARGET_SCOPE_SESSION_KEY } from "@/lib/api-client";

/**
 * Per-page-session persistence of the chat tab's UI state.
 *
 * vaul unmounts `DrawerContent` when the drawer closes, so every component-local
 * `useState` inside ChatTab/ChatPane (the open conversation, the composer draft,
 * the selected project scope, the active provider sub-tab) is lost on close —
 * even though the conversation turns themselves survive in the `chatEngine`
 * singleton. This module mirrors that engine: a plain module-level store that
 * lives for the page session so reopening the drawer restores the chat exactly
 * as the user left it.
 *
 * A LIGHTWEIGHT slice (the open conversation id, its project scope, the active
 * provider sub-tab, and the unsent composer draft) is ALSO mirrored to
 * `sessionStorage` so a full page reload (F5) reopens the same chat with the
 * half-typed message intact — `ChatPane` re-attaches to any still-live backend
 * run on mount. Staged attachments are deliberately NOT persisted (base64 →
 * storage-quota / sensitive content). Persistence is namespaced by the active
 * target scope and wiped on a target switch, so one server's conversation ids
 * never reopen against another (managed isolation).
 */
export interface PaneUiState {
  /** Open conversation id, or null for an unsent "new chat". */
  activeId: string | null;
  /** Unsent composer text. */
  draft: string;
  /** Selected project scope (null = loose chats). */
  currentProjectId: string | null;
  /** Custom agent bound to the open chat (null = none). */
  currentAgentId: string | null;
  /** Staged-but-unsent attachments. */
  attachments: ChatAttachment[];
}

export interface ConversationChoice {
  model: string;
  effort: string;
}

const EMPTY: PaneUiState = { activeId: null, draft: "", currentProjectId: null, currentAgentId: null, attachments: [] };

// One pane snapshot per provider. Sharing one active conversation across every
// provider causes cross-provider bleed: switching from Codex to MiniMax can
// reopen the Codex conversation inside the MiniMax tab and vice versa.
let panes: Record<string, PaneUiState> = {};
let conversationChoices: Record<string, Record<string, ConversationChoice>> = {};
// Active provider sub-tab in ChatTab.
let activeProvider: string | null = null;

// ── sessionStorage persistence (survives F5; cleared on tab close) ──────────
const STORAGE_KEY = "lxp.assistant.paneState.v2";
// Set by the server switcher (scripts/extracted/layouts/server-switcher.ts).
// Used to namespace persisted state per target so a stale chat from server A
// never reopens against server B. Re-uses the canonical key from api-client
// (value identical to the former "panel-active-target-scope" literal).
const TARGET_SCOPE_KEY = TARGET_SCOPE_SESSION_KEY;

interface PersistedState {
  scope: string;
  activeProvider: string | null;
  panes: Record<string, { activeId: string | null; currentProjectId: string | null; currentAgentId?: string | null; draft?: string }> | null;
  conversationChoices?: Record<string, Record<string, ConversationChoice>>;
}

function targetScope(): string {
  if (typeof window === "undefined") return "";
  try {
    return (window.sessionStorage.getItem(TARGET_SCOPE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  const outPanes = Object.fromEntries(
    Object.entries(panes).map(([provider, pane]) => [
      provider,
      {
        activeId: pane.activeId,
        currentProjectId: pane.currentProjectId,
        currentAgentId: pane.currentAgentId,
        draft: pane.draft,
      },
    ]),
  );
  const out: PersistedState = {
    scope: targetScope(),
    activeProvider,
    panes: outPanes,
    conversationChoices,
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* quota / disabled storage — in-memory state still works for this session */
  }
}

function hydrate(): void {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const p = JSON.parse(raw) as PersistedState;
    // Drop state stored under a different target — its conversation ids belong
    // to another server and must not reopen here.
    if (!p || p.scope !== targetScope()) {
      try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    activeProvider = p.activeProvider ?? null;
    conversationChoices = p.conversationChoices ?? {};
    const nextPanes = p.panes ?? {};
    panes = Object.fromEntries(
      Object.entries(nextPanes).map(([provider, pane]) => [
        provider,
        {
          ...EMPTY,
          activeId: pane.activeId,
          currentProjectId: pane.currentProjectId,
          currentAgentId: pane.currentAgentId ?? null,
          draft: pane.draft ?? "",
        },
      ]),
    );
    // Legacy blob (`pane`) from the short-lived shared-state version: recover
    // it into the provider that was active when the blob was written.
    const legacyPane = (p as { pane?: { activeId: string | null; currentProjectId: string | null; currentAgentId?: string | null; draft?: string } | null }).pane;
    if (legacyPane && activeProvider && !panes[activeProvider]) {
      panes[activeProvider] = {
        ...EMPTY,
        activeId: legacyPane.activeId,
        currentProjectId: legacyPane.currentProjectId,
        currentAgentId: legacyPane.currentAgentId ?? null,
        draft: legacyPane.draft ?? "",
      };
    }
  } catch {
    /* corrupt blob — ignore, start fresh */
  }
}

hydrate();

// A target switch invalidates every persisted/open conversation (they are
// per-server). Wipe so nothing from the previous server bleeds into the new one.
if (typeof window !== "undefined") {
  for (const event of ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended", "luxipanel:session-started"]) window.addEventListener(event, () => {
    panes = {};
    conversationChoices = {};
    activeProvider = null;
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  });
}

export const chatUiState = {
  getConversationChoice(provider: string, id: string | null): ConversationChoice | null {
    return conversationChoices[provider]?.[id ?? "__new__"] ?? null;
  },
  patchConversationChoice(provider: string, id: string | null, patch: Partial<ConversationChoice>): void {
    const choices = conversationChoices[provider] ?? (conversationChoices[provider] = {});
    const key = id ?? "__new__";
    choices[key] = { ...(choices[key] ?? { model: "", effort: "Auto" }), ...patch };
    persist();
  },
  moveNewConversationChoice(provider: string, id: string): void {
    const choices = conversationChoices[provider];
    if (!choices?.__new__) return;
    choices[id] = choices.__new__;
    delete choices.__new__;
    persist();
  },
  deleteConversationChoice(provider: string, id: string): void {
    if (conversationChoices[provider]?.[id]) {
      delete conversationChoices[provider]![id];
      persist();
    }
  },
  getPane(provider: string): PaneUiState {
    return panes[provider] ? { ...panes[provider]! } : { ...EMPTY };
  },
  patchPane(provider: string, patch: Partial<PaneUiState>): void {
    panes[provider] = { ...(panes[provider] ?? EMPTY), ...patch };
    persist();
  },
  getActiveProvider(): string | null {
    return activeProvider;
  },
  setActiveProvider(provider: string | null): void {
    activeProvider = provider;
    persist();
  },
};
