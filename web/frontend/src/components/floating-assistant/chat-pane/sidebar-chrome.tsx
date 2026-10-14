// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Small shared sidebar/list chrome for the ChatPane decomposition (feed timeline
 * row, collapsible section header, pagers, segmented tabs, avatar stack).
 * Extracted verbatim from the original `ChatPane.tsx`.
 */
import { type ReactNode } from "react";
import { CompactPager } from "@/components/ui/CompactPager";
import { useAssistantI18n } from "../i18n";
import { AgentAvatar } from "../AgentAvatar";
import { type AssistantAgent } from "../assistant-api";

/** Feed/timeline decoration (Tailwind UI "feeds" pattern): a node dot on the
 *  left of a row and a vertical connector linking it to the next item. The
 *  connector is omitted on the last visible item so the line never overruns the
 *  list. Purely a visual layer — it wraps an existing row/card without touching
 *  its avatars, badges, dates, delete buttons or click behavior. Theme-aware via
 *  the same `border`/`background`/`muted-foreground` tokens used across the pane. */
export function TimelineRow({ isLast, children }: { isLast: boolean; children: ReactNode }) {
  return (
    <div className="lxp-timeline-row relative pl-5">
      {!isLast && (
        <span
          className="lxp-timeline-connector pointer-events-none absolute left-[7px] top-5 bottom-0 w-px bg-muted-foreground/30"
          aria-hidden
        />
      )}
      <span
        className="lxp-timeline-dot pointer-events-none absolute left-1 top-[15px] h-2 w-2 rounded-full bg-muted-foreground ring-2 ring-card"
        aria-hidden
      />
      {children}
    </div>
  );
}

/** Collapsible header for the chat sidebar's two labelled sections ("Proyectos"
 *  / "Conversaciones"). The whole title row is a button (generous hit area) that
 *  toggles the section; a chevron rotates to reflect state and `aria-expanded`
 *  exposes it to assistive tech. An optional `action` (e.g. "add project")
 *  renders as a sibling so its own click never toggles the section. */
export function SidebarSectionToggle({
  open,
  onToggle,
  label,
  action,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <i
          className={`ti ti-chevron-down shrink-0 text-xs transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          aria-hidden
        ></i>
        <span className="truncate">{label}</span>
      </button>
      {action}
    </div>
  );
}

/** Page navigation footer for a paginated project/subproject list. Thin wrapper
 *  over the shared `CompactPager` (same markup/classes, labels from the
 *  assistant namespace) so the messenger and the assistant share one pager. */
export function ProjectsPager({ page, pageCount, onPrev, onNext }: { page: number; pageCount: number; onPrev: () => void; onNext: () => void }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  return (
    <CompactPager
      page={page}
      pageCount={pageCount}
      onPrev={onPrev}
      onNext={onNext}
      prevLabel={ct.pagerPrev ?? "Página anterior"}
      nextLabel={ct.pagerNext ?? "Página siguiente"}
    />
  );
}

/** Two-way segmented tabs used by the sidebar (conversation-list scope +
 *  projects-container scope). Compact, keyboard-focusable, theme-aware. */
export function SidebarTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string; icon: string }[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5" role="tablist">
      {tabs.map((tb) => (
        <button
          key={tb.id}
          type="button"
          role="tab"
          data-search-target={`scope-${tb.id}`}
          aria-selected={value === tb.id}
          onClick={() => onChange(tb.id)}
          className={`flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            value === tb.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <i className={`ti ${tb.icon} text-[11px]`} aria-hidden></i>
          <span className="truncate">{tb.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Overlapping avatar stack of a leader's subordinate agents (Tailwind Plus
 *  "stacked avatars"): up to `max` solapados + a "+N" bubble for the rest.
 *  Mirrors the Dashboard's identical header stack. */
export function AvatarStack({ agents, max = 5 }: { agents: AssistantAgent[]; max?: number }) {
  if (agents.length === 0) return null;
  const shown = agents.slice(0, max);
  const extra = agents.length - shown.length;
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-hidden>
      {shown.map((a) => (
        <AgentAvatar key={a.id} agent={a} size={18} className="rounded-full ring-2 ring-background" />
      ))}
      {extra > 0 && (
        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-muted ring-2 ring-background text-[8px] font-semibold text-muted-foreground">
          +{extra}
        </span>
      )}
    </span>
  );
}
