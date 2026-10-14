// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MediaCarousel — shared media viewer, extracted from the assistant's
 * `ImageCarousel` (`floating-assistant/ConversationMedia.tsx`), which is now a
 * wrapper over it.
 *
 * Two presentations:
 *   • `fullscreen` — the historical lightbox: portal + dark backdrop + top bar
 *     (name, counter, download, ✕) + arrows + optional thumbnail strip. Exit
 *     animation via `useDeferredClose` (200 ms, motion.css preset).
 *   • `inline` — the same stage WITHOUT portal/backdrop, to be embedded in a
 *     column (the messenger's media drawer). No ✕ unless `onClose` is given.
 *
 * The stage renders by `kind`, mirroring what the backend is willing to serve
 * inline: `img`, `<video controls preload="metadata" playsInline>`,
 * `<audio controls>`, `<iframe sandbox="allow-scripts" referrerPolicy="no-referrer">`
 * for PDF (no `allow-same-origin`: the page CSP has `object-src 'none'`, so an
 * iframe is the only viewer), and a download card for anything else.
 *
 * i18n-agnostic: every string comes in through `labels`.
 */
import { useCallback, useEffect, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useBodyPointerEventsWhileOpen } from "@/lib/body-pointer-events";
import { backdropMotionClass } from "@/components/ui/ModalShell";
import { useDeferredClose } from "@/components/ui/use-deferred-close";
import { cn } from "@/lib/utils";

export type MediaItemKind = "image" | "video" | "audio" | "pdf" | "file";

export interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  kind: MediaItemKind;
}

export interface MediaCarouselLabels {
  download: string;
  close: string;
  previous: string;
  next: string;
  /** Shown on the download card of a non-inline-viewable item. */
  unsupported?: string;
}

export interface MediaCarouselProps {
  items: MediaItem[];
  /** Current index (any integer — it is wrapped into range). */
  index: number;
  onNavigate: (next: number) => void;
  /** Required for `fullscreen`; optional (renders a ✕) for `inline`. */
  onClose?: () => void;
  variant?: "fullscreen" | "inline";
  /** Thumbnail strip. Default: on for `fullscreen`, off for `inline`. */
  showThumbnails?: boolean;
  labels: MediaCarouselLabels;
  /** Extra chrome under the stage (e.g. "Enviado por Ana · 12 KB"). */
  footer?: ReactNode;
  className?: string;
}

const DOTS_MAX = 12;

/** Item stage: the actual media element for this kind. */
function MediaStage({ item, dark }: { item: MediaItem; dark: boolean }) {
  const stop = (e: SyntheticEvent) => e.stopPropagation();
  if (item.kind === "image") {
    return (
      <img
        src={item.url}
        alt={item.name}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        onClick={stop}
      />
    );
  }
  if (item.kind === "video") {
    return (
      <video
        src={item.url}
        controls
        preload="metadata"
        playsInline
        className="max-h-full max-w-full rounded-lg bg-black shadow-2xl"
        onClick={stop}
      />
    );
  }
  if (item.kind === "audio") {
    return (
      <div
        className={cn(
          "flex w-full max-w-xl flex-col items-center gap-3 rounded-lg p-6 shadow-2xl",
          dark ? "bg-white/10 text-white" : "bg-muted/40",
        )}
        onClick={stop}
      >
        <i className="ti ti-music text-4xl opacity-70" aria-hidden></i>
        <p className="max-w-full truncate text-sm font-medium" title={item.name}>{item.name}</p>
        <audio src={item.url} controls preload="metadata" className="w-full" />
      </div>
    );
  }
  if (item.kind === "pdf") {
    return (
      <iframe
        src={item.url}
        title={item.name}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="h-full w-full max-w-4xl rounded-lg bg-white shadow-2xl"
        onClick={stop}
      />
    );
  }
  return null;
}

export function MediaCarousel({
  items,
  index,
  onNavigate,
  onClose,
  variant = "fullscreen",
  showThumbnails,
  labels,
  footer,
  className,
}: MediaCarouselProps) {
  const fullscreen = variant === "fullscreen";
  const { closing, requestClose } = useDeferredClose(onClose ?? (() => {}));
  const close = useCallback(() => {
    if (onClose) requestClose();
  }, [onClose, requestClose]);

  const count = items.length;
  const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const current = items[safeIndex];

  // Keyboard: ←/→ navigate, Esc closes. Bound to `window` while mounted (the
  // inline variant lives inside a drawer that has its own Escape handler, so it
  // only claims the key when it can actually close something).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onNavigate(safeIndex - 1);
      else if (e.key === "ArrowRight") onNavigate(safeIndex + 1);
      else if (e.key === "Escape" && onClose && fullscreen) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [safeIndex, onNavigate, onClose, close, fullscreen]);

  const withThumbs = showThumbnails ?? fullscreen;
  const withDots = !withThumbs && count > 1 && count <= DOTS_MAX;

  const body = current ? (
    <>
      {/* Top bar: name, counter, download, ✕ */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 px-4 py-3",
          fullscreen ? "text-white" : "border-b border-border",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={current.name}>
          {current.name}
        </span>
        {count > 1 && (
          <span className={cn("shrink-0 text-xs tabular-nums", fullscreen ? "text-white/70" : "text-muted-foreground")}>
            {safeIndex + 1} / {count}
          </span>
        )}
        <a
          href={current.url}
          download={current.name}
          title={labels.download}
          aria-label={labels.download}
          className={cn(
            "shrink-0 rounded-full p-2",
            fullscreen ? "bg-white/10 text-white hover:bg-white/20" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <i className="ti ti-download text-lg" aria-hidden></i>
        </a>
        {onClose && (
          <button
            type="button"
            onClick={close}
            className={cn(
              "shrink-0 rounded-full p-2",
              fullscreen ? "bg-white/10 text-white hover:bg-white/20" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            aria-label={labels.close}
          >
            <i className="ti ti-x text-lg" aria-hidden></i>
          </button>
        )}
      </div>

      {/* Stage + arrows */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2">
        {count > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate(safeIndex - 1); }}
            className={cn(
              "absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-2.5",
              fullscreen ? "bg-white/10 text-white hover:bg-white/20" : "bg-card/90 text-foreground shadow ring-1 ring-border hover:bg-accent",
            )}
            aria-label={labels.previous}
          >
            <i className="ti ti-chevron-left text-2xl" aria-hidden></i>
          </button>
        )}

        {current.kind === "file" ? (
          <div
            className={cn(
              "flex max-w-sm flex-col items-center gap-3 rounded-lg p-8 text-center",
              fullscreen ? "bg-white/10 text-white" : "bg-muted/40",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <i className="ti ti-file text-4xl opacity-70" aria-hidden></i>
            <p className="max-w-full truncate text-sm font-medium" title={current.name}>{current.name}</p>
            {labels.unsupported && <p className="text-xs opacity-70">{labels.unsupported}</p>}
            <a
              href={current.url}
              download={current.name}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                fullscreen ? "bg-white/15 text-white hover:bg-white/25" : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <i className="ti ti-download" aria-hidden></i> {labels.download}
            </a>
          </div>
        ) : (
          <MediaStage item={current} dark={fullscreen} />
        )}

        {count > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate(safeIndex + 1); }}
            className={cn(
              "absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-2.5",
              fullscreen ? "bg-white/10 text-white hover:bg-white/20" : "bg-card/90 text-foreground shadow ring-1 ring-border hover:bg-accent",
            )}
            aria-label={labels.next}
          >
            <i className="ti ti-chevron-right text-2xl" aria-hidden></i>
          </button>
        )}
      </div>

      {footer && (
        <div
          className={cn("shrink-0 px-4 py-2 text-xs", fullscreen ? "text-white/70" : "border-t border-border text-muted-foreground")}
          onClick={(e) => e.stopPropagation()}
        >
          {footer}
        </div>
      )}

      {/* Dots (short lists) */}
      {withDots && (
        <div className="flex shrink-0 items-center justify-center gap-1.5 px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onNavigate(i)}
              title={it.name}
              aria-label={it.name}
              aria-current={i === safeIndex ? "true" : undefined}
              className={cn(
                "h-2 w-2 rounded-full transition",
                i === safeIndex
                  ? fullscreen ? "bg-white" : "bg-primary"
                  : fullscreen ? "bg-white/40 hover:bg-white/70" : "bg-muted-foreground/40 hover:bg-muted-foreground/70",
              )}
            />
          ))}
        </div>
      )}

      {/* Thumbnail strip (long lists / fullscreen) */}
      {withThumbs && count > 1 && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onNavigate(i)}
              className={cn(
                "h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition",
                i === safeIndex
                  ? fullscreen ? "border-white" : "border-primary"
                  : "border-transparent opacity-60 hover:opacity-100",
              )}
              title={it.name}
            >
              {it.kind === "image" ? (
                <img src={it.url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className={cn("flex h-full w-full items-center justify-center", fullscreen ? "bg-white/10 text-white" : "bg-muted text-muted-foreground")}>
                  <i
                    className={cn(
                      "ti text-lg",
                      it.kind === "pdf" ? "ti-file-type-pdf" : it.kind === "video" ? "ti-video" : it.kind === "audio" ? "ti-music" : "ti-file",
                    )}
                    aria-hidden
                  ></i>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  ) : null;

  if (!current) return null;

  if (!fullscreen) {
    return <div className={cn("flex h-full min-h-0 flex-col", className)}>{body}</div>;
  }

  if (typeof document === "undefined") return null;

  return (
    <FullscreenPortal closing={closing} onBackdrop={close} className={className}>
      {body}
    </FullscreenPortal>
  );
}

function FullscreenPortal({
  closing,
  onBackdrop,
  className,
  children,
}: {
  closing: boolean;
  onBackdrop: () => void;
  className?: string;
  children: ReactNode;
}) {
  // Keep the body interactive while the viewer sits above a drawer.
  useBodyPointerEventsWhileOpen(true);
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[10000] flex flex-col bg-black/85",
        backdropMotionClass(closing),
        closing && "pointer-events-none",
        className,
      )}
      onClick={onBackdrop}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>,
    document.body,
  );
}
