// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useId, useState } from "react";
import { visibleSummary } from "../visible-summary";
import { MessageContent } from "../MessageContent";
import { useAssistantI18n } from "../i18n";

/** Presentation only: expanding replaces the preview with the intact answer,
 * so the same summary never appears above its own detail. */
export function CompactAnswer({ text, summary, streaming = false }: {
  text: string; summary?: string; streaming?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const t = useAssistantI18n().chatTab;
  const preview = visibleSummary(summary || text);
  if (!text.trim()) return null;
  const hasDetail = text.trim() !== preview;
  return <div data-compact-answer className="min-w-0">
    {(!open || !hasDetail) && !!preview && <p data-visible-summary className="line-clamp-2 whitespace-normal break-words" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{preview}</p>}
    {hasDetail && <details open={open} className="mt-1 min-w-0" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary aria-expanded={open} aria-controls={contentId} className="flex min-h-11 cursor-pointer items-center rounded-md px-1 text-xs text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.toolTrace.viewDetails}</summary>
      <div id={contentId}>
        {open && <div data-answer-detail className="mt-2 max-h-96 overflow-auto border-t border-border/60 pt-2"><MessageContent text={text} streaming={streaming} /></div>}
      </div>
    </details>}
  </div>;
}
