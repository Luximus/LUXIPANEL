/**
 * Árbol de "Agentes IA": el primer nivel muestra solo líderes/agentes; cada
 * líder despliega sus chats propios + una sub-colapsable por subordinado
 * directo (aunque no tenga chats). Paginación de 5/página en cada nivel (top +
 * anidados). Puerto DOM de
 * `app/src/components/assistant/drawer/AgentThreadedConvos.tsx`, simplificado:
 * un único `expanded: Set<string>` (sin acordeón por-nivel) y sin `newestLast`
 * (el desktop no invierte el layout).
 */
import type { ReactNode } from "react";
import type { Messages } from "../../i18n";
import type { AgentTopEntry } from "./grouping/conversation-grouping";
import type { AssistantStrings, Conversation } from "./types";
import type { SidebarAgent, SidebarRole } from "./ConversationSidebar";
import { AgentGroupHeader } from "./AgentGroupHeader";
import { ConvoRow } from "./ConvoRow";
import { AGENTS_PER_PAGE, Pager, useNestedPages, usePager } from "./pager";

export function AgentThreadedConvos({
  entries, emptyLeaderAgents, activeId, liveIds, agentById, rolesById, expanded,
  onToggle, onNewAgentChat, t, st, language, onOpen, onDelete,
}: {
  entries: AgentTopEntry<Conversation>[];
  emptyLeaderAgents: SidebarAgent[];
  activeId: string | null;
  liveIds: Set<string>;
  agentById: ReadonlyMap<string, SidebarAgent>;
  rolesById: Map<string, SidebarRole>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNewAgentChat: (agentId: string) => void;
  t: AssistantStrings;
  st: Messages["serverStandalone"];
  language?: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  type TopItem = { kind: "entry"; entry: AgentTopEntry<Conversation> } | { kind: "emptyLeader"; agent: SidebarAgent };
  const topItems: TopItem[] = [
    ...entries.map((entry): TopItem => ({ kind: "entry", entry })),
    ...emptyLeaderAgents.map((agent): TopItem => ({ kind: "emptyLeader", agent })),
  ];

  const top = usePager(topItems, topItems.length, AGENTS_PER_PAGE);
  const nested = useNestedPages();
  const sliceNested = <U,>(key: string, items: U[]): U[] => {
    const pages = Math.max(1, Math.ceil(items.length / AGENTS_PER_PAGE));
    const cur = Math.min(nested.get(key), pages - 1);
    return items.slice(cur * AGENTS_PER_PAGE, cur * AGENTS_PER_PAGE + AGENTS_PER_PAGE);
  };
  const nestedPager = (key: string, total: number) => {
    const pages = Math.max(1, Math.ceil(total / AGENTS_PER_PAGE));
    if (pages <= 1) return null;
    const cur = Math.min(nested.get(key), pages - 1);
    return <Pager page={cur} pageCount={pages} st={st} onPrev={() => nested.set(key, cur - 1)} onNext={() => nested.set(key, cur + 1)} />;
  };
  const isOpen = (id: string) => expanded.has(id);
  const roleOf = (agent: SidebarAgent | null): SidebarRole | null =>
    agent?.roleId ? rolesById.get(agent.roleId) ?? null : null;

  const renderChat = (c: Conversation) => (
    <ConvoRow key={c.id} c={c} activeId={activeId} isLive={liveIds.has(c.id)} t={t} language={language} onOpen={onOpen} onDelete={onDelete} />
  );
  const nestedBox = (children: ReactNode) => <div className="sat-nested">{children}</div>;

  return (
    <>
      {top.visible.map((item) => {
        if (item.kind === "emptyLeader") {
          const a = item.agent;
          const open = isOpen(a.id);
          return (
            <div key={`empty-leader:${a.id}`} className="sat-card">
              <AgentGroupHeader
                agent={a} fallbackName={a.name} count={0} isOpen={open}
                onToggle={() => onToggle(a.id)} onNewChat={() => onNewAgentChat(a.id)}
                convos={[]} liveIds={liveIds} role={roleOf(a)} st={st}
              />
              {open ? nestedBox(<div className="sat-nested-empty">{st.treeNoConversations}</div>) : null}
            </div>
          );
        }

        const entry = item.entry;
        if (entry.kind === "thread") {
          const row = entry.row;
          if (row.kind === "single") {
            return (
              <div key={`single:${row.item.id}`} className="sat-card sat-card--flat">
                {renderChat(row.item)}
              </div>
            );
          }
          const agent = agentById.get(row.agentId) ?? null;
          const open = isOpen(row.agentId);
          const grpKey = `grp:${row.agentId}`;
          const grpChats = sliceNested(grpKey, row.items);
          return (
            <div key={`group:${row.agentId}`} className="sat-card">
              <AgentGroupHeader
                agent={agent} fallbackName={row.latest.title ?? ""} count={row.items.length} isOpen={open}
                onToggle={() => onToggle(row.agentId)} onNewChat={() => onNewAgentChat(row.agentId)}
                convos={row.items} liveIds={liveIds} role={roleOf(agent)} st={st}
              />
              {open ? nestedBox(<>{grpChats.map(renderChat)}{nestedPager(grpKey, row.items.length)}</>) : null}
            </div>
          );
        }

        // Entrada de líder: chats propios + una sub-colapsable por subordinado.
        const leaderAgent = agentById.get(entry.agentId) ?? null;
        const leaderOpen = isOpen(entry.agentId);
        const totalCount = entry.ownConvos.length + entry.subs.reduce((n, s) => n + s.convos.length, 0);
        const fallbackName = entry.ownConvos[0]?.title ?? entry.subs[0]?.convos[0]?.title ?? "";
        const ownKey = `own:${entry.agentId}`;
        const subsKey = `subs:${entry.agentId}`;
        const ownChats = sliceNested(ownKey, entry.ownConvos);
        const subsVisible = sliceNested(subsKey, entry.subs);
        return (
          <div key={`leader:${entry.agentId}`} className="sat-card">
            <AgentGroupHeader
              agent={leaderAgent} fallbackName={fallbackName} count={totalCount} isOpen={leaderOpen}
              onToggle={() => onToggle(entry.agentId)} onNewChat={() => onNewAgentChat(entry.agentId)}
              convos={[...entry.ownConvos, ...entry.subs.flatMap((s) => s.convos)]} liveIds={liveIds}
              role={roleOf(leaderAgent)} st={st}
            />
            {leaderOpen ? nestedBox(
              <>
                {ownChats.map(renderChat)}
                {nestedPager(ownKey, entry.ownConvos.length)}
                {subsVisible.map((sub) => {
                  const subAgent = agentById.get(sub.agentId) ?? null;
                  const subOpen = isOpen(sub.agentId);
                  const subKey = `sub:${sub.agentId}`;
                  const subChats = sliceNested(subKey, sub.convos);
                  return (
                    <div key={`sub:${sub.agentId}`}>
                      <AgentGroupHeader
                        agent={subAgent} fallbackName={sub.convos[0]?.title ?? ""} count={sub.convos.length} isOpen={subOpen}
                        onToggle={() => onToggle(sub.agentId)} onNewChat={() => onNewAgentChat(sub.agentId)}
                        convos={sub.convos} liveIds={liveIds} role={roleOf(subAgent)} st={st}
                      />
                      {subOpen ? nestedBox(
                        <>
                          {sub.convos.length === 0 ? <div className="sat-nested-empty">{st.treeNoConversations}</div> : null}
                          {subChats.map(renderChat)}
                          {nestedPager(subKey, sub.convos.length)}
                        </>,
                      ) : null}
                    </div>
                  );
                })}
                {nestedPager(subsKey, entry.subs.length)}
              </>,
            ) : null}
          </div>
        );
      })}
      {top.hasPager ? <Pager page={top.page} pageCount={top.pageCount} st={st} onPrev={top.prev} onNext={top.next} /> : null}
    </>
  );
}
