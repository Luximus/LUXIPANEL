// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * User preferences — per-user UI/UX settings, keyed by userId with an
 * extensible JSON blob. Persisted file-backed via dataStore (no DB).
 */

import { z } from "zod";

export interface UserPreferencesData {
  theme?: "light" | "dark" | "system";
  /** i18n language code, e.g. "es", "en", "en-US". */
  language?: string;
  dashboardLayout?: string;
  notificationsEnabled?: boolean;
  /** Messaging (/panel/chat) settings — see `chatPreferencesSchema`. */
  chat?: ChatPreferences;
  [key: string]: unknown;
}

// ── Chat preferences ────────────────────────────────────────────────────────
// Per-user settings for the messaging module. Stored inside the same extensible
// preferences blob under the `chat` key, in SECTIONS (general / appearance /
// groups / calls) so the PUT endpoint can merge one section without the client
// having to echo the rest back.
//
// PRESENCE IS NOT HERE: `showOnline` / `statusMessage` are per SERVER (they
// describe a Linux account on the connected box) and live in the chat module's
// own `chat/profiles.json` sidecar — see `GET/PUT /api/chat/me/profile`.

/** Every section is `.partial()`: a PUT may carry any subset of any section. */
export const chatPreferencesSchema = z
  .object({
    general: z
      .object({
        soundOnNewMessage: z.boolean(),
        desktopNotifications: z.boolean(),
        previewInBell: z.boolean(),
        enterSends: z.boolean(),
      })
      .partial(),
    appearance: z
      .object({
        density: z.enum(["comfortable", "compact"]),
        fontSize: z.enum(["sm", "md", "lg"]),
      })
      .partial(),
    groups: z
      .object({
        collapsedByDefault: z.boolean(),
        latestPageSize: z.union([z.literal(5), z.literal(10), z.literal(15)]),
      })
      .partial(),
    calls: z
      .object({
        /** BCP-47-ish short tag: "es", "en", "pt-BR". */
        language: z
          .string()
          .min(2)
          .max(8)
          .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, "Must be a language tag like 'es' or 'pt-BR'"),
        translate: z.boolean(),
        provider: z.enum(["auto", "elevenlabs", "openai-realtime"]),
        micDefault: z.enum(["on", "muted"]),
        ringtone: z.enum(["default", "off"]),
        dnd: z.boolean(),
      })
      .partial(),
  })
  .partial();

/** Partial patch accepted by `PUT /api/preferences/chat`. */
export type ChatPreferencesPatch = z.infer<typeof chatPreferencesSchema>;

/** Fully-resolved chat preferences (what GET always returns). */
export interface ChatPreferences {
  general: {
    soundOnNewMessage: boolean;
    desktopNotifications: boolean;
    previewInBell: boolean;
    enterSends: boolean;
  };
  appearance: {
    density: "comfortable" | "compact";
    fontSize: "sm" | "md" | "lg";
  };
  groups: {
    collapsedByDefault: boolean;
    latestPageSize: 5 | 10 | 15;
  };
  calls: {
    language: string;
    translate: boolean;
    provider: "auto" | "elevenlabs" | "openai-realtime";
    micDefault: "on" | "muted";
    ringtone: "default" | "off";
    dnd: boolean;
  };
}

export const CHAT_PREFERENCES_DEFAULTS: ChatPreferences = {
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

/**
 * Project the stored blob onto the FULL chat contract: defaults deep-merged
 * with whatever `data.chat` holds, section by section. A stored section that is
 * not an object (corrupt/legacy row) is ignored rather than throwing.
 */
export function toChatPreferences(data: UserPreferencesData): ChatPreferences {
  const stored = (data?.chat ?? {}) as Record<string, unknown>;
  const section = <K extends keyof ChatPreferences>(key: K): ChatPreferences[K] => {
    const raw = stored[key as string];
    const patch = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return { ...CHAT_PREFERENCES_DEFAULTS[key], ...(patch as object) } as ChatPreferences[K];
  };
  return {
    general: section("general"),
    appearance: section("appearance"),
    groups: section("groups"),
    calls: section("calls"),
  };
}

/** Shape returned/accepted by the GET/PUT /api/preferences/ui contract. */
export interface UiPreferences {
  theme: "light" | "dark" | "system";
  language: string | null;
}

/**
 * Project a stored preferences blob onto the UI contract shape, applying the
 * contract defaults: theme "system", language null.
 */
export function toUiPreferences(data: UserPreferencesData): UiPreferences {
  return {
    theme: data.theme ?? "system",
    language: typeof data.language === "string" ? data.language : null,
  };
}

export interface UserPreference {
  userId: number;
  data: UserPreferencesData;
  updatedAt: Date;
}
