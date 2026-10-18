// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import type { ChatTurn } from "../chat-engine/types";
import { visibleSummary } from "../visible-summary";
import { MessageContent } from "../MessageContent";
import { useAssistantI18n } from "../i18n";

/** Missing or uncertain presentation metadata must preserve the complete body. */
export function answerPresentation(turn: ChatTurn): "full" | "summary" {
  return turn.presentation === "summary" && !turn.pending && !turn.completionPending
    && !turn.error && !turn.ask?.length && !turn.askKind && !turn.permission
    && !turn.interrupted && !turn.stopped && !turn.status && !turn.translationError
    ? "summary" : "full";
}

/** Presentation only: expanding replaces the preview with the intact answer,
 * so the same summary never appears above its own detail. */
export function CompactAnswer({ text, summary, presentation, streaming = false, scrollContainerRef }: {
  text: string; summary?: string; presentation?: "full" | "summary"; streaming?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const previewRef = useRef<HTMLParagraphElement>(null);
  const [fittingPreview, setFittingPreview] = useState<string>();
  const t = useAssistantI18n().chatTab;
  const preview = visibleSummary(summary || text);
  const compact = !!text.trim() && presentation === "summary" && !streaming;
  useEffect(() => {
    if (!compact || open) return;
    const element = previewRef.current;
    if (!element) return;
    const measure = () => setFittingPreview(
      element.clientHeight > 0 && element.scrollHeight <= element.clientHeight + 1 ? preview : undefined,
    );
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [compact, open, preview]);
  if (!text.trim()) return null;
  if (presentation !== "summary" || streaming) return <MessageContent text={text} streaming={streaming} scrollContainerRef={scrollContainerRef} />;
  // Keep access to the full body until layout confirms the preview fits, including SSR.
  const hasDetail = open || text.trim() !== preview || fittingPreview !== preview;
  return <div data-compact-answer className="min-w-0">
    {(!open || !hasDetail) && !!preview && <p ref={previewRef} data-visible-summary className="line-clamp-2 whitespace-normal break-words" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{preview}</p>}
    {hasDetail && <details open={open} className="mt-1 min-w-0" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary aria-expanded={open} aria-controls={contentId} className="flex min-h-11 cursor-pointer items-center rounded-md px-1 text-xs text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.toolTrace.viewDetails}</summary>
      <div id={contentId}>
        {open && <div data-answer-detail className="mt-2 max-h-96 overflow-auto border-t border-border/60 pt-2"><MessageContent text={text} streaming={streaming} scrollContainerRef={scrollContainerRef} /></div>}
      </div>
    </details>}
  </div>;
}
