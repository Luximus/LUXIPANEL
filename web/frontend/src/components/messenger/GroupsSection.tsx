// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque C — "Grupos": the bottom half of the sidebar. Every Linux group the
 * user belongs to is an accordion (`accordionToggle` + `CollapseY`, the same
 * pair the assistant sidebar uses) whose header opens the GROUP chat and whose
 * rows are its members: clicking a member opens the existing DM or creates it.
 *
 * Only display names are rendered — never a Linux username (bloque B).
 */
import { useEffect, useMemo, useState } from "react";
import { CollapseY } from "@/components/floating-assistant/chat-pane/collapse-y";
import { accordionToggle } from "@/components/floating-assistant/conversation-grouping";
import { formatChatMessage, useChatI18n } from "./i18n";
import { initials } from "./format";
import { normalizeGroupMembers, type Directory, type DirectoryGroup, type DirectoryUser } from "./messenger-api";

export function GroupsSection({
  directory,
  me,
  query,
  loading,
  collapsedByDefault,
  onOpenGroup,
  onOpenMember,
}: {
  directory: Directory;
  me: string;
  query: string;
  loading: boolean;
  collapsedByDefault: boolean;
  onOpenGroup: (group: string) => void;
  onOpenMember: (member: DirectoryUser) => void;
}) {
  const t = useChatI18n();
  const q = query.trim().toLowerCase();

  const userIndex = useMemo(() => {
    const map = new Map<string, DirectoryUser>();
    for (const u of directory.users) map.set(u.username, u);
    return map;
  }, [directory.users]);

  // Group → members (me excluded), display names resolved from the directory.
  const groups = useMemo(() => {
    return directory.groups.map((g: DirectoryGroup) => {
      const members = normalizeGroupMembers(g.members, userIndex).filter((m) => m.username !== me);
      return {
        name: g.name,
        members,
        online: members.filter((m) => m.online).length,
      };
    });
  }, [directory.groups, userIndex, me]);

  // Searching filters the MEMBERS (by display name only — usernames are never
  // shown, so they must not be searchable either) and keeps the groups that
  // still have matches.
  const filtered = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        members: g.members.filter((m) => (m.displayName || "").toLowerCase().includes(q)),
        matchesName: g.name.toLowerCase().includes(q),
      }))
      .filter((g) => g.members.length > 0 || g.matchesName);
  }, [groups, q]);

  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set<string>());
  // First render (and whenever the preference changes): honour
  // `collapsedByDefault` — expanded means "open the first group".
  useEffect(() => {
    setOpen(collapsedByDefault || !groups.length ? new Set<string>() : new Set([groups[0]!.name]));
  }, [collapsedByDefault, groups.length]);

  // A search auto-expands every group that has matching members.
  const effectiveOpen = useMemo(() => {
    if (!q) return open;
    return new Set(filtered.filter((g) => g.members.length > 0).map((g) => g.name));
  }, [q, open, filtered]);

  return (
    <section className="flex min-h-0 flex-none flex-col overflow-visible lg:flex-1 lg:overflow-y-auto" data-search-target="chat-groups">
      <h2 className="sticky top-0 z-10 bg-card/80 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
        {t.sections.groups}
      </h2>
      {loading ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          <i className="ti ti-loader-2 animate-spin" /> {t.loading}
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t.newChat.noGroups}</p>
      ) : (
        <ul className="flex flex-col pb-2">
          {filtered.map((g) => {
            const isOpen = effectiveOpen.has(g.name);
            return (
              <li key={g.name}>
                <div className="flex items-center gap-1 px-1">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen((prev) => accordionToggle(prev, g.name))}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent [[data-density=compact]_&]:py-1"
                  >
                    <i
                      className={`ti ti-chevron-down shrink-0 text-xs transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{g.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {g.members.length === 0
                          ? t.groups.noMembers
                          : formatChatMessage(t.groups.onlineCount, { online: g.online, total: g.members.length })}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title={t.groups.openChat}
                    aria-label={t.groups.openChat}
                    onClick={() => onOpenGroup(g.name)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <i className="ti ti-message" aria-hidden />
                  </button>
                </div>
                <CollapseY open={isOpen}>
                  <ul className="flex flex-col pl-6 pr-1">
                    {g.members.map((m) => (
                      <li key={m.username}>
                        <button
                          type="button"
                          onClick={() => onOpenMember(m)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent [[data-density=compact]_&]:py-1"
                        >
                          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            {initials(m.displayName || t.unknownUser)}
                            {m.online && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card bg-emerald-500" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{m.displayName || t.unknownUser}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {m.status?.trim() || (m.online ? t.online : t.offline)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CollapseY>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
