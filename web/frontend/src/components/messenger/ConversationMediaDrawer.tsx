// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque D — "Multimedia": every attachment of a conversation, in a wide
 * drawer. Left column = type tabs (Imágenes / Vídeos / PDF / Audio /
 * Documentos / Otros) with counters and the list (a 3-column grid for images,
 * rows for the rest). Right column = the inline `MediaCarousel` stage; empty
 * until something is picked. Below `@xl` the two columns stack.
 *
 * The list is fetched when the drawer opens and re-fetched whenever a live
 * `chat:message` carrying attachments lands in this conversation (the parent
 * bumps `refreshKey`).
 */
import { useEffect, useMemo, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { MediaCarousel, type MediaItem, type MediaItemKind } from "@/components/ui/MediaCarousel";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";
import { cn } from "@/lib/utils";
import { formatChatMessage, useChatI18n } from "./i18n";
import { dateTime, displayNameFor } from "./format";
import { formatBytes, isInlineViewable, mediaIcon, mediaKindOf, type MediaKind } from "./media-kind";
import {
  attachmentUrl,
  messengerApi,
  type ConversationAttachment,
  type ConversationView,
} from "./messenger-api";

type MediaTab = "images" | "videos" | "pdf" | "audio" | "documents" | "others";
const TAB_ORDER: readonly MediaTab[] = ["images", "videos", "pdf", "audio", "documents", "others"];
const TAB_ICON: Record<MediaTab, string> = {
  images: "ti-photo",
  videos: "ti-video",
  pdf: "ti-file-type-pdf",
  audio: "ti-music",
  documents: "ti-file-text",
  others: "ti-files",
};
const KIND_TO_TAB: Record<MediaKind, MediaTab> = {
  image: "images",
  video: "videos",
  pdf: "pdf",
  audio: "audio",
  document: "documents",
  other: "others",
};

/** `MediaKind` → the carousel's own kind, honouring the inline allowlist. */
function carouselKind(a: ConversationAttachment): MediaItemKind {
  if (!isInlineViewable(a.mimeType)) return "file";
  const kind = mediaKindOf(a.name, a.mimeType);
  if (kind === "image" || kind === "video" || kind === "audio" || kind === "pdf") return kind;
  return "file";
}

export function ConversationMediaDrawer({
  conversation,
  locale,
  directory,
  refreshKey = 0,
  onClose,
}: {
  conversation: ConversationView;
  locale: string;
  directory?: ReadonlyMap<string, string>;
  /** Bump to re-fetch (a new message with attachments arrived). */
  refreshKey?: number;
  onClose: () => void;
}) {
  const t = useChatI18n();
  const [items, setItems] = useState<ConversationAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MediaTab>("images");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tabDirection = useViewDirection(tab, TAB_ORDER);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void messengerApi.listAttachments(conversation.id).then((rows) => {
      if (!alive) return;
      setItems(rows);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [conversation.id, refreshKey]);

  const byTab = useMemo(() => {
    const buckets: Record<MediaTab, ConversationAttachment[]> = {
      images: [], videos: [], pdf: [], audio: [], documents: [], others: [],
    };
    for (const a of items) buckets[KIND_TO_TAB[mediaKindOf(a.name, a.mimeType)]].push(a);
    return buckets;
  }, [items]);

  // Land on the first non-empty tab once the list arrives.
  useEffect(() => {
    if (loading || items.length === 0) return;
    setTab((current) => (byTab[current].length ? current : TAB_ORDER.find((k) => byTab[k].length) ?? current));
  }, [loading, items.length, byTab]);

  const current = byTab[tab];
  const carouselItems: MediaItem[] = useMemo(
    () =>
      current.map((a) => ({
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        url: attachmentUrl(a.id),
        kind: carouselKind(a),
      })),
    [current],
  );
  const selectedIndex = Math.max(0, carouselItems.findIndex((it) => it.id === selectedId));
  const selectedAttachment = selectedId ? current.find((a) => a.id === selectedId) ?? null : null;

  // A tab change clears the stage (the selection belongs to the old bucket).
  useEffect(() => { setSelectedId(null); }, [tab]);

  const senderOf = (a: ConversationAttachment) =>
    displayNameFor(conversation, a.from, { directory, unknownUser: t.unknownUser, fallbackName: a.fromDisplayName });

  return (
    <ModalShell
      onClose={onClose}
      cardClassName="w-[min(96vw,68rem)] max-lg:w-[85vw] max-sm:w-full"
      icon="ti-photo"
      title={t.media.title}
      description={conversation.displayTitle}
      closeLabel={t.media.close}
      bodyClassName="overflow-hidden p-0"
    >
      <div className="flex h-full min-h-0 flex-col @xl:flex-row">
        {/* Left: tabs + list */}
        <div className="flex w-full min-h-0 flex-col border-b border-border @xl:w-80 @xl:shrink-0 @xl:border-b-0 @xl:border-r">
          <div data-rubber-tabs role="tablist" aria-label={t.media.title} className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
            {TAB_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                onClick={() => setTab(id)}
                aria-selected={tab === id}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 ease-out",
                  tab === id ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <i className={`ti ${TAB_ICON[id]} text-sm`} aria-hidden></i>
                <span>{t.media.tabs[id === "videos" ? "videos" : id]}</span>
                <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{byTab[id].length}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                <i className="ti ti-loader-2 animate-spin" /> {t.loading}
              </p>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t.media.empty}</p>
            ) : current.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t.media.emptyTab}</p>
            ) : (
              <ViewTransition viewKey={tab} direction={tabDirection}>
                {tab === "images" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {current.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        title={`${a.name} — ${formatChatMessage(t.media.sentBy, { name: senderOf(a) })}`}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-lg border",
                          selectedId === a.id ? "border-primary ring-2 ring-primary/30" : "border-border/40",
                        )}
                      >
                        <img
                          src={attachmentUrl(a.id)}
                          alt={a.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:opacity-80"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {current.map((a) => (
                      <li key={a.id}>
                        <div
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border bg-background/40 px-3 py-2 text-sm transition-colors",
                            selectedId === a.id ? "border-primary bg-primary/5" : "border-border/40 hover:bg-accent",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedId(a.id)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          >
                            <i className={`ti ${mediaIcon(a.name, a.mimeType)} shrink-0 text-lg text-muted-foreground`} aria-hidden></i>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-foreground" title={a.name}>{a.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {[formatBytes(a.size, locale), dateTime(a.createdAt, locale), formatChatMessage(t.media.sentBy, { name: senderOf(a) })]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </button>
                          <a
                            href={attachmentUrl(a.id)}
                            download={a.name}
                            title={t.media.download}
                            aria-label={t.media.download}
                            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <i className="ti ti-download text-sm" aria-hidden></i>
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ViewTransition>
            )}
          </div>
        </div>

        {/* Right: the stage */}
        <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
          {selectedAttachment ? (
            <MediaCarousel
              items={carouselItems}
              index={selectedIndex}
              onNavigate={(next) => {
                const size = carouselItems.length;
                if (!size) return;
                const wrapped = ((next % size) + size) % size;
                setSelectedId(carouselItems[wrapped]!.id);
              }}
              onClose={() => setSelectedId(null)}
              variant="inline"
              labels={{
                download: t.media.download,
                close: t.media.close,
                previous: t.media.previous,
                next: t.media.next,
              }}
              footer={
                <span>
                  {[
                    formatChatMessage(t.media.sentBy, { name: senderOf(selectedAttachment) }),
                    dateTime(selectedAttachment.createdAt, locale),
                    formatBytes(selectedAttachment.size, locale),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              }
            />
          ) : (
            <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <i className="ti ti-photo-scan text-4xl opacity-40" aria-hidden></i>
              <p className="text-sm">{t.media.viewerHint}</p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
