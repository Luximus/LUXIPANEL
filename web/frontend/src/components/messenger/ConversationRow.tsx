// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque C — one conversation row of the sidebar (avatar + title + preview +
 * relative time + unread dot). Extracted from `ConversationList` so the
 * "Últimas conversaciones" section and any future list reuse the same row.
 *
 * The preview NEVER prints a Linux username: the author is resolved with
 * `displayNameFor` (bloque B).
 */
import { useChatI18n } from "./i18n";
import { displayNameFor, initials, relativeTime } from "./format";
import type { ConversationView } from "./messenger-api";

export function ConversationRow({
  conversation: c,
  active,
  me,
  locale,
  directory,
  hasCall = false,
  onSelect,
}: {
  conversation: ConversationView;
  active: boolean;
  me: string;
  locale: string;
  /** username → display name (shared directory loaded by ChatModule). */
  directory?: ReadonlyMap<string, string>;
  /** Bloque F — a call is ringing or running in this conversation. */
  hasCall?: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useChatI18n();

  const raw = c.lastMessagePreview || "";
  let preview = "";
  if (raw) {
    const who =
      c.lastMessageFrom === me
        ? `${t.you}: `
        : c.kind !== "dm" && c.lastMessageFrom
          ? `${displayNameFor(c, c.lastMessageFrom, { directory, unknownUser: t.unknownUser })}: `
          : "";
    preview = who + raw;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent [[data-density=compact]_&]:py-1.5 ${
        active ? "bg-accent" : c.unread ? "bg-primary/[0.04]" : ""
      }`}
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary [[data-density=compact]_&]:h-7 [[data-density=compact]_&]:w-7">
        {c.kind === "dm" ? initials(c.displayTitle) : <i className="ti ti-users text-base" />}
        {c.kind === "dm" && c.online && (
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{c.displayTitle}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground/80">{relativeTime(c.lastMessageAt, locale)}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{preview}</span>
      </span>
      {/* Bloque F — a live call outranks the unread dot: it is the thing the
          user has seconds to act on, and both would just crowd the row. */}
      {hasCall ? (
        <i
          className="ti ti-phone-call shrink-0 animate-pulse text-sm text-emerald-500"
          title={t.call.rowActive}
          aria-label={t.call.rowActive}
        />
      ) : (
        c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
