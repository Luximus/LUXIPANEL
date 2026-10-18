// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useState } from "react";
import { visibleSummary } from "../visible-summary";
import { MessageContent } from "../MessageContent";
import { useAssistantI18n } from "../i18n";

/** Compact presentation only. Copy, model context, evidence and controls retain
 * their original content. Details mount on demand, not for every hidden notice. */
export function CompactAnswer({ text, summary, streaming = false }: {
  text: string; summary?: string; streaming?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useAssistantI18n().chatTab;
  const preview = visibleSummary(summary || text);
  if (!text.trim()) return null;
  return <div data-compact-answer className="min-w-0">
    <p data-visible-summary className="line-clamp-2 whitespace-normal break-words" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{preview || t.toolTrace.viewDetails}</p>
    <details className="mt-1 min-w-0" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{t.toolTrace.viewDetails}</summary>
      {open && <div data-answer-detail className="mt-2 max-h-96 overflow-auto border-t border-border/60 pt-2"><MessageContent text={text} streaming={streaming} /></div>}
    </details>
  </div>;
}
