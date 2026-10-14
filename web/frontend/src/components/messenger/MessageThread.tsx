// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Right pane: conversation header + scrolling message thread + composer.
 *
 * The header carries an ACTIONS area (`headerActions`) sized for the pill
 * buttons: "Multimedia" (bloque D) lives there and the future "Llamar" button
 * (bloque F) drops in next to it via the `actions` slot — no layout change.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useChatI18n, formatChatMessage } from "./i18n";
import { initials, dateTime, displayNameFor } from "./format";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { isCallLive, joinedParticipants, type ChatCallView } from "@/lib/chat-call";
import type { ChatMessage, ConversationView, NewAttachment } from "./messenger-api";

export function MessageThread({
  conversation,
  messages,
  me,
  locale,
  loading,
  directory,
  enterSends = true,
  onSend,
  onEdit,
  onDelete,
  onBack,
  onOpenMedia,
  onCall,
  activeCall = null,
  callEnabled = false,
  callBusy = false,
  actions,
}: {
  conversation: ConversationView;
  messages: ChatMessage[];
  me: string;
  locale: string;
  loading: boolean;
  /** username → display name (shared directory). */
  directory?: ReadonlyMap<string, string>;
  enterSends?: boolean;
  onSend: (body: string, attachments: NewAttachment[]) => Promise<void> | void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onOpenMedia: () => void;
  /** Bloque F — start the call, or join the one already running. */
  onCall?: () => void;
  /** The live call of THIS conversation, if any. */
  activeCall?: ChatCallView | null;
  /** False when `CALL_ENABLED` is off or the browser lacks the audio APIs. */
  callEnabled?: boolean;
  /** A start/join request is in flight — avoid a double room. */
  callBusy?: boolean;
  /** Extra header actions, after the call/media pair. */
  actions?: ReactNode;
}) {
  const t = useChatI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation.id]);

  const subtitle =
    conversation.kind === "dm"
      ? conversation.online
        ? t.online
        : t.offline
      : formatChatMessage(t.membersCount, { count: conversation.members.length });

  // "Llamada en curso · 3 · Unirse" — the count is the people ACTUALLY in the
  // room, not the invitees, so a ringing callee does not inflate it.
  const inCall = isCallLive(activeCall);
  const joinLabel = inCall
    ? formatChatMessage(t.call.inProgress, { count: joinedParticipants(activeCall).length })
    : t.call.action;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-3 sm:gap-3 sm:px-4">
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent lg:hidden" onClick={onBack} aria-label={t.sections.latest}>
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {conversation.kind === "dm" ? initials(conversation.displayTitle) : <i className="ti ti-users text-base" />}
          {conversation.kind === "dm" && conversation.online && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{conversation.displayTitle}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {conversation.kind === "linux-group" && <i className="ti ti-brand-tabler mr-1" />}
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Bloque F — llamar / unirse. Deshabilitado (con tooltip que lo
              explica) cuando el navegador no tiene getUserMedia/AudioWorklet:
              un botón que no hace nada es peor que uno gris que dice por qué. */}
          {onCall && (
            <button
              type="button"
              onClick={onCall}
              disabled={!callEnabled || callBusy}
              data-search-target="chat-call"
              title={callEnabled ? (inCall ? joinLabel : t.call.action) : t.call.unsupported}
              aria-label={inCall ? joinLabel : t.call.action}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                inCall
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <i
                className={`ti ${callBusy ? "ti-loader-2 animate-spin" : "ti-phone"} ${inCall && !callBusy ? "animate-pulse" : ""}`}
                aria-hidden
              />
              <span className="hidden lg:inline">{inCall ? joinLabel : t.call.action}</span>
            </button>
          )}
          {actions}
          <button
            type="button"
            onClick={onOpenMedia}
            data-search-target="chat-media"
            title={t.header.media}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <i className="ti ti-photo" aria-hidden />
            <span className="hidden lg:inline">{t.header.media}</span>
          </button>
          {conversation.kind !== "dm" && (
            <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground lg:inline">
              {conversation.kind === "linux-group" ? t.badgeLinuxGroup : t.badgeGroup}
            </span>
          )}
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 [[data-density=compact]_&]:py-1.5">
        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            <i className="ti ti-loader-2 animate-spin" /> {t.loading}
          </p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">{t.emptyThread}</p>
        ) : (
          <div className="flex flex-col gap-3 [[data-density=compact]_&]:gap-1.5">
            {messages.map((m, i) => {
              const isMine = m.from === me;
              const prev = messages[i - 1];
              const firstOfGroup = !prev || prev.from !== m.from;
              const showAuthor = conversation.kind !== "dm" && !isMine && firstOfGroup;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={isMine}
                  showAvatar={firstOfGroup}
                  showAuthor={showAuthor}
                  // Bloque B: NEVER `m.from` — always the resolved display name.
                  authorLabel={displayNameFor(conversation, m.from, {
                    directory,
                    unknownUser: t.unknownUser,
                    fallbackName: m.fromDisplayName,
                  })}
                  timeLabel={dateTime(m.createdAt, locale)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })}
          </div>
        )}
      </div>

      <Composer onSend={onSend} enterSends={enterSends} />
    </section>
  );
}
