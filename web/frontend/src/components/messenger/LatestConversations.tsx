// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque C — "Últimas conversaciones": the top half of the sidebar. Paginated
 * with the shared `usePaged` hook (page size from
 * `prefs.groups.latestPageSize`) and the shared `CompactPager` (`‹ 1/3 ›`).
 * Each page change replays the panel's view transition (motion.css preset).
 *
 * While the user is SEARCHING the pager is bypassed: a search must be able to
 * reach any conversation, so every match is listed.
 */
import { useMemo } from "react";
import { CompactPager } from "@/components/ui/CompactPager";
import { ViewTransition } from "@/components/ui/ViewTransition";
import { usePaged } from "@/components/floating-assistant/chat-pane/use-paged";
import { ConversationRow } from "./ConversationRow";
import { useChatI18n } from "./i18n";
import type { ConversationView } from "./messenger-api";

export function LatestConversations({
  conversations,
  activeId,
  me,
  locale,
  loading,
  query,
  pageSize,
  directory,
  callConvIds,
  onSelect,
}: {
  /** Already filtered by the sidebar search. */
  conversations: ConversationView[];
  activeId: string | null;
  me: string;
  locale: string;
  loading: boolean;
  /** Non-empty while searching → show every match, no pager. */
  query: string;
  pageSize: number;
  directory?: ReadonlyMap<string, string>;
  /** Bloque F — conversation ids with a live call (ringing or running). */
  callConvIds?: ReadonlySet<string>;
  onSelect: (id: string) => void;
}) {
  const t = useChatI18n();
  const searching = query.trim().length > 0;
  const paged = usePaged(conversations, query, pageSize);
  const visible = useMemo(
    () => (searching ? conversations : paged.visible),
    [searching, conversations, paged.visible],
  );

  return (
    <section className="flex flex-col" data-search-target="chat-latest">
      <h2 className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t.sections.latest}
      </h2>
      {loading ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          <i className="ti ti-loader-2 animate-spin" /> {t.loading}
        </p>
      ) : conversations.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          <i className="ti ti-message-off mb-2 block text-2xl" />
          {t.emptyConversations}
        </p>
      ) : (
        <>
          <ViewTransition viewKey={searching ? "search" : `page-${paged.page}`}>
            <ul className="flex flex-col">
              {visible.map((c) => (
                <li key={c.id}>
                  <ConversationRow
                    conversation={c}
                    active={activeId === c.id}
                    me={me}
                    locale={locale}
                    directory={directory}
                    hasCall={callConvIds?.has(c.id) ?? false}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </ViewTransition>
          {!searching && paged.hasPager && (
            <CompactPager
              page={paged.page}
              pageCount={paged.pageCount}
              onPrev={paged.prev}
              onNext={paged.next}
              prevLabel={t.pager.prev}
              nextLabel={t.pager.next}
            />
          )}
        </>
      )}
    </section>
  );
}
