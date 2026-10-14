// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * CompactPager — the panel's tiny `‹ 1/3 ›` pager.
 *
 * Extracted verbatim (markup + classes) from the assistant sidebar's
 * `ProjectsPager` (`floating-assistant/chat-pane/sidebar-chrome.tsx`), which is
 * now a thin wrapper over it, so the messenger's "Últimas conversaciones"
 * section and the assistant project list can never drift apart. Labels arrive
 * by prop (the component itself is i18n-agnostic).
 */
import { cn } from "@/lib/utils";

export type CompactPagerProps = {
  /** Zero-based current page. */
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  /** aria-label of the ‹ button. */
  prevLabel?: string;
  /** aria-label of the › button. */
  nextLabel?: string;
  className?: string;
};

export function CompactPager({
  page,
  pageCount,
  onPrev,
  onNext,
  prevLabel = "Anterior",
  nextLabel = "Siguiente",
  className,
}: CompactPagerProps) {
  return (
    <div className={cn("mt-0.5 flex items-center justify-between px-2 py-1 text-[10px] text-muted-foreground", className)}>
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 0}
        className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 hover:bg-card/50 disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label={prevLabel}
      >
        <i className="ti ti-chevron-left text-xs" aria-hidden></i>
      </button>
      <span className="tabular-nums">{page + 1} / {pageCount}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount - 1}
        className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 hover:bg-card/50 disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label={nextLabel}
      >
        <i className="ti ti-chevron-right text-xs" aria-hidden></i>
      </button>
    </div>
  );
}
