// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useAssistantI18n } from "../i18n";
import type { AssistantAgent, AssistantAgentRole, ConversationMeta } from "../assistant-api";
import { TeamGroupHeader } from "./agent-threaded-convos";
import { ConvoRow } from "./ConvoRow";
import { CollapseY } from "./collapse-y";
import { GENERAL_HISTORY, type ProjectAgentHistoryState } from "./project-agent-history";
import type { ProjectTreeRowProps } from "./types";

export function ProjectAgentConvos({ agents, history, expanded, onToggle, onNewChat, onLoadMore, onRetry, rolesById, rowProps, activeConversation }: {
  agents: AssistantAgent[];
  history: ProjectAgentHistoryState;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNewChat: (id: string) => void;
  onLoadMore: (id: string) => void;
  onRetry: (id: string) => void;
  rolesById: Map<string, AssistantAgentRole>;
  rowProps: ProjectTreeRowProps;
  activeConversation?: ConversationMeta | null;
}) {
  const i18n = useAssistantI18n();
  const ct = i18n.chatTab as Record<string, any>;
  const rows = (id: string) => {
    const page = history.groups[id];
    const selected = activeConversation?.agentId === id ? activeConversation : null;
    const items = selected && !page?.items.some(c => c.id === selected.id) ? [selected, ...(page?.items ?? [])] : page?.items ?? [];
    return <div className="ml-4 border-l border-border pl-2 pb-2">
      {items.map(c => <ConvoRow key={c.id} c={c} {...rowProps}
        projectLabel={c.projectId ? rowProps.projectTitleById.get(c.projectId) : null}
        extraClassName="border-b border-border/40 last:border-b-0" />)}
      {page?.error ? <button type="button" className="px-2 py-2 text-xs text-destructive" onClick={() => onRetry(id)}>{i18n.assistantErrorBoundary.retry}</button>
        : page?.loading || !page ? <div role="status" className="px-2 py-2"><i className="ti ti-loader-2 animate-spin" aria-label={ct.loading ?? "Cargando"} /></div>
        : !items.length ? <p className="px-2 py-2 text-xs text-muted-foreground">{ct.conversations?.empty ?? "Sin conversaciones."}</p> : null}
      {page?.hasMore && !page.loading && !page.error && <button type="button" className="px-2 py-2 text-xs text-primary hover:underline" onClick={() => onLoadMore(id)}>{i18n.dashboardTab.paginationNext}</button>}
    </div>;
  };
  return <div className="flex min-h-0 flex-1 flex-col" data-project-agent-history>
    <div className="shrink-0 px-3 py-2 text-xs font-semibold">{ct.chatsWithAgents ?? "Agentes IA"}</div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2">
      {agents.map(agent => <section key={agent.id} data-agent-group={agent.id}>
        <TeamGroupHeader agent={agent} fallbackName={agent.name} count={history.counts[agent.id!] ?? 0}
          isOpen={expanded.has(agent.id!)} onToggle={() => onToggle(agent.id!)}
          onNewChat={() => onNewChat(agent.id!)} convos={history.groups[agent.id!]?.items ?? []} rolesById={rolesById} />
        <CollapseY open={expanded.has(agent.id!)}>{rows(agent.id!)}</CollapseY>
      </section>)}
      {history.loading && <div role="status" className="px-3 py-2"><i className="ti ti-loader-2 animate-spin" aria-label={ct.loading ?? "Cargando"} /></div>}
      {history.counts[GENERAL_HISTORY] > 0 && <section data-general-history>
        <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">{ct.conversations?.heading ?? "Conversaciones"}</div>
        {rows(GENERAL_HISTORY)}
      </section>}
    </div>
  </div>;
}
