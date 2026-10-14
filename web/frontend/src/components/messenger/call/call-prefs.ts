// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * The call slice of the messaging preferences (F3).
 *
 * `chat-prefs.ts` already owns the whole `lxp.chat.prefs` blob (server mirror,
 * validation, optimistic save) — this module adds nothing to that model. What
 * it does add is the projection FROM those preferences INTO the things the call
 * layer actually needs: the SDK's client options, the ring/DND policy, and the
 * language badge. Keeping that mapping in one place means the settings drawer
 * stays a pure preferences editor and the call components never reach into a
 * preferences shape they would then have to re-validate.
 */
import { chatPrefs, useChatPrefs, type ChatPrefsCalls } from "../chat-prefs";

export type { ChatPrefsCalls };

/** Read the current call preferences synchronously (SSR-safe defaults). */
export function getCallPrefs(): ChatPrefsCalls {
  return chatPrefs.get().calls;
}

/** React binding — the same store subscription as `useChatPrefs`. */
export function useCallPrefs(): ChatPrefsCalls {
  return useChatPrefs().calls;
}

/**
 * Should an INCOMING call make a sound?
 *
 * Two independent switches say no: "no molestar" (which also suppresses the
 * backend push) and an explicitly silenced ringtone. They are checked together
 * everywhere so the banner and the topbar can never disagree.
 */
export function shouldRing(prefs: ChatPrefsCalls = getCallPrefs()): boolean {
  return !prefs.dnd && prefs.ringtone !== "off";
}

/**
 * Options for `createCallClient`, straight from the preferences.
 *
 * `wsUrl` is whatever the backend returned — never composed here (it carries
 * the token and the deployment's public path). `startMuted` honours the
 * "micrófono al entrar" preference, which is the one thing a user expects to
 * survive from the settings drawer into the call itself.
 */
export function callClientOptions(
  wsUrl: string,
  prefs: ChatPrefsCalls = getCallPrefs(),
): { wsUrl: string; startMuted: boolean } {
  return { wsUrl, startMuted: prefs.micDefault === "muted" };
}

/**
 * Short language tag for the badge next to a name ("ES", "EN").
 *
 * `es-MX` and `es` are the same language for badge purposes — the region only
 * matters to the translation pipeline, and showing "ES-MX" in a 2-character
 * chip just makes the tile wrap.
 */
export function langBadge(lang: string | null | undefined): string {
  const base = String(lang ?? "").split("-")[0]?.trim() ?? "";
  return base ? base.toUpperCase() : "";
}
