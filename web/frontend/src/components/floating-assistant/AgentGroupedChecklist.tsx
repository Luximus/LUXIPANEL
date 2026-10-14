// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AgentGroupedChecklist — a multi-select checklist of agents grouped by team,
 * with a collapsible header per group (name + agent count + chevron) and a
 * trailing "Sueltos" section for ungrouped agents (legacy `agentWorkGroupKey`
 * "General" bucket). Buckets come from `groupAgentsForPicker`, so this NEVER
 * diverges from the main Agents-tab list. Used by the agent editor's
 * "Conexiones con otros agentes" list and by the team member pickers.
 *
 * Collapse state is LOCAL and non-persistent (per-group `useState`, seeded once
 * from `defaultOpenKeys`): relevant sections start expanded, the rest collapsed.
 * Selection/toggle is fully owned by the caller — this component only renders.
 */
import { useState, type ReactNode } from "react";
import type { AssistantAgent, AgentTeam } from "./assistant-api";
import { AgentAvatar } from "./AgentAvatar";

export type AgentGroupBucket = {
  key: string;
  label: string;
  team?: AgentTeam;
  agents: AssistantAgent[];
};

export function AgentGroupedChecklist({
  groups,
  selectedIds,
  onToggle,
  ungroupedLabel,
  countLabel,
  defaultOpenKeys,
  avatarSize = 16,
  trailing,
  className,
}: {
  /** Ordered, non-empty buckets from `groupAgentsForPicker`. */
  groups: AgentGroupBucket[];
  selectedIds: Set<string> | string[];
  onToggle(id: string): void;
  /** Label for the ungrouped legacy "General" bucket (reuse the list's key). */
  ungroupedLabel: string;
  /** Renders the per-group agent count (e.g. "3 agentes"). */
  countLabel(count: number): string;
  /** Bucket keys that start expanded; the rest start collapsed. */
  defaultOpenKeys: Set<string>;
  avatarSize?: number;
  /** Optional trailing node per agent row (e.g. an "already in team" badge). */
  trailing?(agent: AssistantAgent): ReactNode;
  className?: string;
}) {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  return (
    <div className={className ?? "flex flex-col gap-1"}>
      {groups.map((g) => (
        <AgentChecklistGroup
          key={g.key}
          bucket={g}
          label={g.key === "General" ? ungroupedLabel : g.label}
          count={g.agents.length}
          countLabel={countLabel}
          defaultOpen={defaultOpenKeys.has(g.key)}
          selected={selected}
          onToggle={onToggle}
          avatarSize={avatarSize}
          trailing={trailing}
        />
      ))}
    </div>
  );
}

function AgentChecklistGroup({
  bucket,
  label,
  count,
  countLabel,
  defaultOpen,
  selected,
  onToggle,
  avatarSize,
  trailing,
}: {
  bucket: AgentGroupBucket;
  label: string;
  count: number;
  countLabel(count: number): string;
  defaultOpen: boolean;
  selected: Set<string>;
  onToggle(id: string): void;
  avatarSize: number;
  trailing?(agent: AssistantAgent): ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-border/70 bg-card/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-x-3 rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
          <i className="ti ti-users text-sm" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="flex-none rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
          {countLabel(count)}
        </span>
        <i
          className={`ti ti-chevron-down flex-none text-sm text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {/* Sección plegable animada con el estándar de movimiento (200ms
          ease-out): grid-rows 1fr↔0fr + opacidad, sin desmontar. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        inert={!open}
        aria-hidden={!open}
      >
        <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden px-1 pb-1">
          {bucket.agents.map((a) => {
            const on = selected.has(a.id);
            return (
              <label
                key={a.id}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/40"
              >
                <input type="checkbox" checked={on} onChange={() => onToggle(a.id)} />
                <AgentAvatar agent={a} size={avatarSize} />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                {trailing?.(a)}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
