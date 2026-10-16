// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Assistant UI preferences (UI-only, localStorage) — same model as
 * `bubble-prefs`: presentation defaults with no server state and a tiny
 * pub/sub so open views re-render live when changed from the settings modal.
 *
 *   - defaultAgentsTab:        which tab of the AGENTS section starts active
 *                              (dashboard grid and the chat sidebar's
 *                              "Líderes / Proyectos" toggle).
 *   - defaultConversationsTab: which tab of the CONVERSATIONS list starts
 *                              active (dashboard and chat sidebar's
 *                              "Agentes IA / Sueltos / Proyectos" toggle).
 *
 * Defaults preserve the historical behaviour (leaders / loose).
 */
import { normalizeReasoningEffort, type ChatReasoningEffort } from "./reasoning-effort";
import { createJsonPrefsStore } from "@/lib/prefs-store";

export type AgentsTabPref = "leaders" | "projects";
export type ConversationsTabPref = "agents" | "loose";

export interface AssistantUiPrefs {
  defaultAgentsTab: AgentsTabPref;
  defaultConversationsTab: ConversationsTabPref;
  /**
   * Collapsed/expanded state of the chat sidebar's two labelled sections
   * ("Proyectos" / "Conversaciones"). UI-only (never server-mirrored) — the
   * server `reload()` mirror only touches the `default*` fields above.
   * Defaults: Projects CLOSED, Conversations OPEN.
   */
  projectsSectionOpen: boolean;
  conversationsSectionOpen: boolean;
  /**
   * Default provider/model for NEW loose/project chats — per-server, mirrored
   * from the assistant config (`defaultChatProvider`/`defaultChatModel`) so the
   * chat composer reads them at mount before the server response lands.
   * `""` = unset: fall back to the active provider / auto model. Typed as plain
   * strings (not `AssistantProviderId`) to avoid an import cycle with
   * `assistant-api.ts`; the consumer validates against the live provider list.
   */
  defaultChatProvider: string;
  defaultChatModel: string;
  defaultChatEffort: ChatReasoningEffort;
}

const DEFAULTS: AssistantUiPrefs = {
  defaultAgentsTab: "leaders",
  defaultConversationsTab: "loose",
  projectsSectionOpen: false,
  conversationsSectionOpen: true,
  defaultChatProvider: "",
  defaultChatModel: "",
  defaultChatEffort: "",
};

// Persistencia + pub/sub compartidos (F-18); la validación por campo (abajo)
// es lo único propio de este store.
const store = createJsonPrefsStore<Partial<AssistantUiPrefs>>("lxp.assistant.uiPrefs");
const readAll = store.read;

function isAgentsTab(v: unknown): v is AgentsTabPref {
  return v === "leaders" || v === "projects";
}
function isConversationsTab(v: unknown): v is ConversationsTabPref {
  return v === "agents" || v === "loose";
}

export const uiPrefs = {
  get(): AssistantUiPrefs {
    // Merge over DEFAULTS and validate each field so a stale/corrupt stored
    // value can never leak an unknown tab id into component state.
    const raw = readAll();
    return {
      defaultAgentsTab: isAgentsTab(raw.defaultAgentsTab) ? raw.defaultAgentsTab : DEFAULTS.defaultAgentsTab,
      defaultConversationsTab: isConversationsTab(raw.defaultConversationsTab)
        ? raw.defaultConversationsTab
        : DEFAULTS.defaultConversationsTab,
      projectsSectionOpen:
        typeof raw.projectsSectionOpen === "boolean" ? raw.projectsSectionOpen : DEFAULTS.projectsSectionOpen,
      conversationsSectionOpen:
        typeof raw.conversationsSectionOpen === "boolean"
          ? raw.conversationsSectionOpen
          : DEFAULTS.conversationsSectionOpen,
      defaultChatProvider:
        typeof raw.defaultChatProvider === "string" ? raw.defaultChatProvider : DEFAULTS.defaultChatProvider,
      defaultChatEffort: normalizeReasoningEffort(raw.defaultChatEffort),
      defaultChatModel:
        typeof raw.defaultChatModel === "string" ? raw.defaultChatModel : DEFAULTS.defaultChatModel,
    };
  },
  set(patch: Partial<AssistantUiPrefs>): void {
    store.write({ ...uiPrefs.get(), ...patch });
  },
  subscribe: store.subscribe,
};
