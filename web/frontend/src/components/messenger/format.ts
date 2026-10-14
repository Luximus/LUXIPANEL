// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Small formatting helpers shared by the messenger components. */
import { formatDateStamp, initialsFrom } from "@/lib/format";

/** Avatar initials, messenger flavor: first + LAST word (F-21). */
export function initials(name: string): string {
  return initialsFrom(name, { from: "last" });
}

export function relativeTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const sec = Math.round((Date.now() - ts) / 1000);
  let rtf: Intl.RelativeTimeFormat | null = null;
  try {
    rtf = new Intl.RelativeTimeFormat(locale.split("-")[0], { numeric: "auto" });
  } catch {
    rtf = null;
  }
  const fmt = (v: number, unit: Intl.RelativeTimeFormatUnit) =>
    rtf ? rtf.format(v, unit) : `${Math.abs(v)} ${unit}`;
  if (sec < 60) return fmt(-Math.max(1, sec), "second");
  const min = Math.round(sec / 60);
  if (min < 60) return fmt(-min, "minute");
  const h = Math.round(min / 60);
  if (h < 24) return fmt(-h, "hour");
  const d = Math.round(h / 24);
  if (d < 30) return fmt(-d, "day");
  const mo = Math.round(d / 30);
  if (mo < 12) return fmt(-mo, "month");
  return fmt(-Math.round(mo / 12), "year");
}

export function clockTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale.split("-")[0], { hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

/** Send date + time, e.g. "26 jun, 14:32" — today shows only the time (F-19). */
export function dateTime(iso: string | null | undefined, locale: string): string {
  return formatDateStamp(iso, { locale, day: "numeric" });
}

/**
 * Bloque B — resolve the HUMAN display name of a participant. The UI must
 * NEVER print a Linux username, so the lookup order is:
 *
 *   1. `conversation.memberNames[username]` (decorated by the backend),
 *   2. the DM counterpart shortcut (`otherDisplayName` / `displayTitle`),
 *   3. the shared directory (`ChatModule` loads it once and shares it),
 *   4. `unknownUser` — the localized "Usuario" placeholder.
 *
 * Every argument is optional so the helper stays usable from the topbar list
 * (no conversation object) and while the directory is still loading.
 */
export function displayNameFor(
  conversation: DisplayNameConversation | null | undefined,
  username: string | null | undefined,
  options: DisplayNameOptions = {},
): string {
  const { directory, unknownUser = "Usuario", fallbackName } = options;
  const name = (fallbackName ?? "").trim();
  if (name) return name;
  const user = (username ?? "").trim();
  if (conversation && user) {
    const fromMap = conversation.memberNames?.[user];
    if (fromMap && fromMap.trim()) return fromMap.trim();
    if (conversation.kind === "dm" && conversation.otherUser === user) {
      const other = (conversation.otherDisplayName ?? conversation.displayTitle ?? "").trim();
      if (other) return other;
    }
  }
  if (user && directory) {
    const fromDir = directory.get(user);
    if (fromDir && fromDir.trim()) return fromDir.trim();
  }
  return unknownUser;
}

/** Minimal shape `displayNameFor` needs (keeps `format.ts` import-free). */
export interface DisplayNameConversation {
  kind?: string;
  displayTitle?: string;
  otherUser?: string;
  otherDisplayName?: string | null;
  memberNames?: Record<string, string> | null;
}

export interface DisplayNameOptions {
  /** username → display name, from `GET /api/chat/directory`. */
  directory?: ReadonlyMap<string, string>;
  /** Localized `t.unknownUser`. */
  unknownUser?: string;
  /** Pre-resolved name (e.g. `message.fromDisplayName`) — wins over everything. */
  fallbackName?: string | null;
}
