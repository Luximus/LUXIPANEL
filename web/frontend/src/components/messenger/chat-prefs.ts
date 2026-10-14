// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque E — messenger preferences (`/api/preferences/chat`).
 *
 * The server is the source of truth, but the topbar script (`chat.ts`) has to
 * decide whether to beep BEFORE any React island mounts, so the whole blob is
 * mirrored into `localStorage["lxp.chat.prefs"]` (the same `createJsonPrefsStore`
 * model as `ui-prefs.ts`, with per-field validation so a stale/corrupt value can
 * never leak an unknown enum into component state).
 *
 * Flow: `syncFromServer()` (GET → store) on mount, `save(patch)` writes the
 * store optimistically, PUTs the section patch and rolls back + toasts on error.
 */
import { api } from "@/lib/api-client";
import { createJsonPrefsStore } from "@/lib/prefs-store";
import { useEffect, useState } from "react";

export const CHAT_PREFS_STORAGE_KEY = "lxp.chat.prefs";

export type ChatDensity = "comfortable" | "compact";
export type ChatFontSize = "sm" | "md" | "lg";
export type ChatLatestPageSize = 5 | 10 | 15;
export type CallProvider = "auto" | "elevenlabs" | "openai-realtime";
export type CallMicDefault = "on" | "muted";
export type CallRingtone = "default" | "off";

export interface ChatPrefsGeneral {
  soundOnNewMessage: boolean;
  desktopNotifications: boolean;
  previewInBell: boolean;
  enterSends: boolean;
}
export interface ChatPrefsAppearance {
  density: ChatDensity;
  fontSize: ChatFontSize;
}
export interface ChatPrefsGroups {
  collapsedByDefault: boolean;
  latestPageSize: ChatLatestPageSize;
}
export interface ChatPrefsCalls {
  language: string;
  translate: boolean;
  provider: CallProvider;
  micDefault: CallMicDefault;
  ringtone: CallRingtone;
  dnd: boolean;
}

export interface ChatPrefs {
  general: ChatPrefsGeneral;
  appearance: ChatPrefsAppearance;
  groups: ChatPrefsGroups;
  calls: ChatPrefsCalls;
}

export type ChatPrefsSection = keyof ChatPrefs;
export const CHAT_PREFS_SECTIONS: readonly ChatPrefsSection[] = ["general", "appearance", "groups", "calls"];

/** Languages offered for real-time call translation (mirrors the 12 locales). */
export const CALL_LANGUAGES = ["es", "en", "pt", "fr", "de", "it", "ar", "hi", "bn", "ja", "ko", "ru"] as const;

export const DEFAULT_CHAT_PREFS: ChatPrefs = {
  general: {
    soundOnNewMessage: true,
    desktopNotifications: false,
    previewInBell: true,
    enterSends: true,
  },
  appearance: { density: "comfortable", fontSize: "md" },
  groups: { collapsedByDefault: true, latestPageSize: 5 },
  calls: {
    language: "es",
    translate: false,
    provider: "auto",
    micDefault: "on",
    ringtone: "default",
    dnd: false,
  },
};

const store = createJsonPrefsStore<Partial<ChatPrefs>>(CHAT_PREFS_STORAGE_KEY);

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Validate a (possibly partial / corrupt) blob field by field. */
export function normalizeChatPrefs(raw: unknown): ChatPrefs {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ChatPrefs>;
  const g = (src.general ?? {}) as Partial<ChatPrefsGeneral>;
  const a = (src.appearance ?? {}) as Partial<ChatPrefsAppearance>;
  const gr = (src.groups ?? {}) as Partial<ChatPrefsGroups>;
  const c = (src.calls ?? {}) as Partial<ChatPrefsCalls>;
  const d = DEFAULT_CHAT_PREFS;
  const size = gr.latestPageSize;
  return {
    general: {
      soundOnNewMessage: bool(g.soundOnNewMessage, d.general.soundOnNewMessage),
      desktopNotifications: bool(g.desktopNotifications, d.general.desktopNotifications),
      previewInBell: bool(g.previewInBell, d.general.previewInBell),
      enterSends: bool(g.enterSends, d.general.enterSends),
    },
    appearance: {
      density: oneOf(a.density, ["comfortable", "compact"] as const, d.appearance.density),
      fontSize: oneOf(a.fontSize, ["sm", "md", "lg"] as const, d.appearance.fontSize),
    },
    groups: {
      collapsedByDefault: bool(gr.collapsedByDefault, d.groups.collapsedByDefault),
      latestPageSize: size === 5 || size === 10 || size === 15 ? size : d.groups.latestPageSize,
    },
    calls: {
      language: typeof c.language === "string" && /^[a-z]{2}$/.test(c.language) ? c.language : d.calls.language,
      translate: bool(c.translate, d.calls.translate),
      provider: oneOf(c.provider, ["auto", "elevenlabs", "openai-realtime"] as const, d.calls.provider),
      micDefault: oneOf(c.micDefault, ["on", "muted"] as const, d.calls.micDefault),
      ringtone: oneOf(c.ringtone, ["default", "off"] as const, d.calls.ringtone),
      dnd: bool(c.dnd, d.calls.dnd),
    },
  };
}

/** Deep-merge a per-section patch over a full blob. */
export function mergeChatPrefs(base: ChatPrefs, patch: DeepPartialChatPrefs): ChatPrefs {
  return {
    general: { ...base.general, ...(patch.general ?? {}) },
    appearance: { ...base.appearance, ...(patch.appearance ?? {}) },
    groups: { ...base.groups, ...(patch.groups ?? {}) },
    calls: { ...base.calls, ...(patch.calls ?? {}) },
  };
}

export type DeepPartialChatPrefs = {
  [K in ChatPrefsSection]?: Partial<ChatPrefs[K]>;
};

export const chatPrefs = {
  /** Validated blob (defaults on SSR / missing key / corrupt JSON). */
  get(): ChatPrefs {
    return normalizeChatPrefs(store.read());
  },
  /** Write locally (no network) and notify subscribers. */
  set(patch: DeepPartialChatPrefs): ChatPrefs {
    const next = mergeChatPrefs(chatPrefs.get(), patch);
    store.write(next);
    return next;
  },
  subscribe: store.subscribe,

  /** GET the server blob into the local mirror. Returns the resulting prefs. */
  async syncFromServer(): Promise<ChatPrefs> {
    const res = await api.get<unknown>("/api/preferences/chat");
    if (!res.ok || !res.data) return chatPrefs.get();
    const next = normalizeChatPrefs(res.data);
    store.write(next);
    return next;
  },

  /**
   * Optimistic save: mirror locally, PUT the section patch, roll back on error.
   * Returns true when the server accepted it.
   */
  async save(patch: DeepPartialChatPrefs): Promise<boolean> {
    const before = chatPrefs.get();
    chatPrefs.set(patch);
    const res = await api.put<unknown>("/api/preferences/chat", patch);
    if (!res.ok) {
      store.write(before);
      return false;
    }
    return true;
  },
};

/** React binding: current prefs, live-updated by the store's pub/sub. */
export function useChatPrefs(): ChatPrefs {
  const [value, setValue] = useState<ChatPrefs>(() => chatPrefs.get());
  useEffect(() => {
    setValue(chatPrefs.get());
    return chatPrefs.subscribe(() => setValue(chatPrefs.get()));
  }, []);
  return value;
}
