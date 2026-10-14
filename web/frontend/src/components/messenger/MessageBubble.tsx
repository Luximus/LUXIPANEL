// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * One chat message bubble. Mirrors the visual recipe of the AI assistant's
 * TurnView: own messages align right with the indigo/primary accent; others
 * align left on `bg-muted/60`. Each message group shows the author's avatar
 * (initials) and the send date+time. Reuses MessageContent (markdown + fenced
 * code) for the body.
 */
import { useMemo, useState } from "react";
import { MessageContent } from "../floating-assistant/MessageContent";
import { MediaCarousel, type MediaItem } from "@/components/ui/MediaCarousel";
import { useChatI18n, formatChatMessage } from "./i18n";
import { initials } from "./format";
import { asCallSystem, formatCallDuration, transcriptSegmentCount } from "@/lib/chat-call";
import { CallTranscriptPanel } from "./call/CallTranscriptPanel";
import { isInlineViewable, mediaIcon, mediaKindOf } from "./media-kind";
import { attachmentUrl, type AttachmentRef, type ChatMessage } from "./messenger-api";

export function MessageBubble({
  message,
  isMine,
  showAvatar,
  showAuthor,
  authorLabel,
  timeLabel,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  isMine: boolean;
  /** Render the avatar (true for the first message of a consecutive group). */
  showAvatar: boolean;
  /** Render the author name label above the bubble (groups only). */
  showAuthor: boolean;
  authorLabel: string;
  timeLabel: string;
  onEdit?: (id: string, body: string) => void;
  onDelete?: (id: string) => void;
}) {
  const t = useChatI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const deleted = !!message.deletedAt;

  // Bloque D — split by media kind. Video/audio play inline ONLY when the
  // backend actually serves them inline (`isInlineViewable` mirrors its
  // allowlist); everything else falls back to a typed download chip.
  const { images, playable, files } = useMemo(() => {
    const imgs: AttachmentRef[] = [];
    const play: AttachmentRef[] = [];
    const rest: AttachmentRef[] = [];
    for (const a of message.attachments) {
      const kind = mediaKindOf(a.name, a.mimeType);
      if (kind === "image" && isInlineViewable(a.mimeType)) imgs.push(a);
      else if ((kind === "video" || kind === "audio") && isInlineViewable(a.mimeType)) play.push(a);
      else rest.push(a);
    }
    return { images: imgs, playable: play, files: rest };
  }, [message.attachments]);

  // Fullscreen viewer over this bubble's images.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewerItems: MediaItem[] = useMemo(
    () => images.map((a) => ({ id: a.id, name: a.name, mimeType: a.mimeType, url: attachmentUrl(a.id), kind: "image" as const })),
    [images],
  );

  // Bloque F — a finished call is not a message anybody wrote: it is a fact
  // about the conversation, so it renders as a centered chip with no author,
  // no avatar and no edit/delete affordances.
  const callSystem = useMemo(() => asCallSystem(message.system), [message.system]);
  // Kept OUTSIDE the early return's branch so the hook order never changes.
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  if (callSystem) {
    const segments = transcriptSegmentCount(callSystem);
    const label =
      callSystem.outcome === "missed"
        ? t.call.system.missed
        : callSystem.outcome === "rejected"
          ? t.call.system.rejected
          : formatChatMessage(t.call.system.voice, {
              duration: formatCallDuration(callSystem.durationSec),
              count: callSystem.participants.length,
            });
    return (
      <div className="flex flex-col items-center py-1">
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] text-muted-foreground"
          // Display names only — the backend never puts a login in here.
          title={callSystem.participants.join(", ") || undefined}
        >
          <i
            className={`ti ${callSystem.outcome === "completed" ? "ti-phone" : "ti-phone-off"} text-xs`}
            aria-hidden
          />
          <span className="truncate">{label}</span>
          <span className="shrink-0 opacity-60">{timeLabel}</span>
          {segments > 0 && (
            <button
              type="button"
              onClick={() => setTranscriptOpen((v) => !v)}
              aria-expanded={transcriptOpen}
              className="ml-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
            >
              <i className={`ti ${transcriptOpen ? "ti-chevron-up" : "ti-file-text"}`} aria-hidden />
              {transcriptOpen ? t.call.transcript.close : t.call.transcript.open}
            </button>
          )}
        </span>
        {segments > 0 && (
          <div className="w-full max-w-[42rem]">
            <CallTranscriptPanel convId={message.convId} messageId={message.id} open={transcriptOpen} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`group flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar (or a spacer to keep grouped messages aligned). */}
      {showAvatar ? (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary"
          title={authorLabel}
        >
          {initials(authorLabel)}
        </div>
      ) : (
        <div className="h-7 w-7 shrink-0" aria-hidden="true" />
      )}

      <div className={`flex min-w-0 max-w-[80%] flex-col ${isMine ? "items-end" : "items-start"}`}>
        {!isMine && showAuthor && (
          <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">{authorLabel}</span>
        )}
        <div
          className={`overflow-hidden break-words rounded-2xl px-3 py-2 text-sm ${
            isMine
              ? "bg-indigo-100 text-indigo-900 dark:bg-primary dark:text-primary-foreground rounded-tr-sm"
              : "bg-muted/60 rounded-tl-sm"
          }`}
        >
          {deleted ? (
            <p className="italic text-muted-foreground">{t.deletedMessage}</p>
          ) : editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => {
                    setEditing(false);
                    setDraft(message.body);
                  }}
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => {
                    const v = draft.trim();
                    if (v && v !== message.body) onEdit?.(message.id, v);
                    setEditing(false);
                  }}
                >
                  {t.save}
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.body && <MessageContent text={message.body} />}
              {images.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {images.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setViewerIndex(i)}
                      title={a.name}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      <img
                        src={attachmentUrl(a.id)}
                        alt={a.name}
                        loading="lazy"
                        className="max-h-48 max-w-[14rem] object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {playable.length > 0 && (
                <div className="mt-1 flex flex-col gap-1.5">
                  {playable.map((a) =>
                    mediaKindOf(a.name, a.mimeType) === "video" ? (
                      <video
                        key={a.id}
                        src={attachmentUrl(a.id)}
                        controls
                        preload="metadata"
                        playsInline
                        className="max-h-56 w-full max-w-[18rem] rounded-lg border border-border bg-black"
                      />
                    ) : (
                      <audio key={a.id} src={attachmentUrl(a.id)} controls preload="metadata" className="w-full max-w-[18rem]" />
                    ),
                  )}
                </div>
              )}
              {files.length > 0 && (
                <div className="mt-1 flex flex-col gap-1">
                  {files.map((a) => (
                    <a
                      key={a.id}
                      href={attachmentUrl(a.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={a.name}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 text-xs hover:bg-accent"
                    >
                      <i className={`ti ${mediaIcon(a.name, a.mimeType)}`} />
                      <span className="max-w-[12rem] truncate">{a.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 px-1 text-[10px] text-muted-foreground/80">
          <span>{timeLabel}</span>
          {message.editedAt && !deleted && <span>{t.edited}</span>}
          {isMine && !deleted && !editing && (
            <span className="hidden items-center gap-1.5 group-hover:flex">
              <button
                type="button"
                className="hover:text-foreground"
                title={t.edit}
                onClick={() => {
                  setDraft(message.body);
                  setEditing(true);
                }}
              >
                <i className="ti ti-pencil" />
              </button>
              <button
                type="button"
                className="hover:text-destructive"
                title={t.delete}
                onClick={() => onDelete?.(message.id)}
              >
                <i className="ti ti-trash" />
              </button>
            </span>
          )}
        </div>
      </div>
      {viewerIndex !== null && viewerItems.length > 0 && (
        <MediaCarousel
          items={viewerItems}
          index={viewerIndex}
          onNavigate={(next) => setViewerIndex(next)}
          onClose={() => setViewerIndex(null)}
          variant="fullscreen"
          labels={{ download: t.media.download, close: t.media.close, previous: t.media.previous, next: t.media.next }}
        />
      )}
    </div>
  );
}
