// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sidebar (bloque C): header (title + Ajustes + Nueva) → search box → two
 * sections: "Últimas conversaciones" (paginated, `shrink-0`) and "Grupos"
 * (accordion, `min-h-0 flex-1 overflow-y-auto`).
 *
 * The search filters BOTH sections; it never matches on a Linux username
 * (bloque B: usernames are not rendered, so they are not searchable either).
 */
import { useMemo, useState } from "react";
import { useChatI18n } from "./i18n";
import { LatestConversations } from "./LatestConversations";
import { GroupsSection } from "./GroupsSection";
import { EMPTY_DIRECTORY, type ConversationView, type Directory, type DirectoryUser } from "./messenger-api";

export function ConversationList({
  conversations,
  activeId,
  me,
  locale,
  loading,
  directory = EMPTY_DIRECTORY,
  directoryLoading = false,
  displayNames,
  latestPageSize,
  groupsCollapsedByDefault,
  callConvIds,
  onSelect,
  onNew,
  onOpenSettings,
  onOpenGroup,
  onOpenMember,
}: {
  conversations: ConversationView[];
  activeId: string | null;
  me: string;
  locale: string;
  loading: boolean;
  directory?: Directory;
  directoryLoading?: boolean;
  /** username → display name, shared by ChatModule. */
  displayNames?: ReadonlyMap<string, string>;
  latestPageSize: number;
  groupsCollapsedByDefault: boolean;
  /** Bloque F — conversation ids with a live call. */
  callConvIds?: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenSettings: () => void;
  onOpenGroup: (group: string) => void;
  onOpenMember: (member: DirectoryUser) => void;
}) {
  const t = useChatI18n();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.displayTitle.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <aside className="flex h-full min-w-0 w-full flex-col overflow-y-auto border-r border-border bg-card/40 lg:w-72 lg:shrink-0 lg:overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <h1 className="min-w-0 truncate text-sm font-semibold">{t.pageTitle}</h1>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onOpenSettings}
            data-search-target="chat-settings"
            title={t.header.settings}
            aria-label={t.header.settings}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <i className="ti ti-settings" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onNew}
            data-search-target="chat-new"
            aria-label={t.newConversation}
            title={t.newConversation}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-pencil-plus" />
            <span className="hidden sm:inline">{t.newConversation}</span>
          </button>
        </div>
      </div>
      <div className="px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div className="shrink-0 border-b border-border pb-1">
        <LatestConversations
          conversations={filtered}
          activeId={activeId}
          me={me}
          locale={locale}
          loading={loading}
          query={query}
          pageSize={latestPageSize}
          directory={displayNames}
          callConvIds={callConvIds}
          onSelect={onSelect}
        />
      </div>

      <GroupsSection
        directory={directory}
        me={me}
        query={query}
        loading={directoryLoading}
        collapsedByDefault={groupsCollapsedByDefault}
        onOpenGroup={onOpenGroup}
        onOpenMember={onOpenMember}
      />
    </aside>
  );
}
