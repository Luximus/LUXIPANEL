// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * "Agentes IA" 2-level team conversation view (leader header + threaded chats).
 * Extracted verbatim from the original `ChatPane.tsx`.
 */
import { useState, type ReactNode } from "react";
import { useAssistantI18n, formatAssistantMessage } from "../i18n";
import { chatEngine } from "../chat-engine";
import { AgentAvatar } from "../AgentAvatar";
import { RoleChip, ProjectChip } from "../AgentInfoChips";
import { buildAgentConversationTree } from "../conversation-grouping";
import {
  type ConversationMeta,
  type AssistantAgent,
  type AssistantAgentRole,
} from "../assistant-api";
import { TimelineRow, ProjectsPager, AvatarStack } from "./sidebar-chrome";
import { ConvoRow } from "./ConvoRow";
import { CollapseY } from "./collapse-y";
import { usePaged } from "./use-paged";
import { AGENTS_PER_PAGE } from "./helpers";

/** Collapsable header shared by team-leader rows and their subordinate sub-rows
 *  (and by plain same-agent thread groups): chevron + avatar + name + live /
 *  unreviewed indicators + conversation-count pill. Chrome strings are shared
 *  with the Dashboard's identical grouping — reuse its keys, don't duplicate. */
export function TeamGroupHeader({
  agent,
  fallbackName,
  count,
  isOpen,
  onToggle,
  onNewChat,
  convos,
  subordinateAgents,
  projectLabel,
  rolesById,
  isLeader,
}: {
  agent: AssistantAgent | null;
  fallbackName: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  /** Crea una conversación nueva ligada a este agente (botón + en la cabecera). */
  onNewChat?: () => void;
  convos: ConversationMeta[];
  /** Leader's subordinate agents → overlapping avatar stack. Undefined for plain
   *  agent groups and subordinate sub-rows (no stack). */
  subordinateAgents?: AssistantAgent[];
  /** Nombre del proyecto del líder → segunda fila, junto al contador de chats. */
  projectLabel?: string | null;
  /** True SOLO en la fila de un líder → pinta el proyecto del agente
   *  (`agent.project`, contrato aditivo) como badge en la fila del nombre. */
  isLeader?: boolean;
  /** Roles by id → resuelve el pill de rol del agente desde su `roleId`. Igual
   *  que en el Dashboard, para que ambas superficies muestren lo mismo. */
  rolesById?: Map<string, AssistantAgentRole> | null;
}) {
  const dt = useAssistantI18n().dashboardTab as Record<string, any>;
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const name = agent?.name ?? fallbackName;
  const anyLive = convos.some((c) => chatEngine.isStreaming(c.id) || chatEngine.isBackgroundRunning(c.id) || chatEngine.isWorkerTaskRunning(c.id));
  const anyUnreviewed = convos.some((c) => !anyLive && (!!chatEngine.get(c.id)?.unreviewed || !!c.unreviewed));
  const role = agent?.roleId ? rolesById?.get(agent.roleId) ?? null : null;
  return (
    <div className="group @container flex items-start rounded-md hover:bg-card/50">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={formatAssistantMessage(
        isOpen ? (dt.groupCollapseAria ?? "Contraer las conversaciones de {agent}") : (dt.groupExpandAria ?? "Expandir las {count} conversaciones de {agent}"),
        { count, agent: name },
      )}
      className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-2.5 py-2.5 text-left"
    >
      <i className={`ti ti-chevron-right mt-1 shrink-0 text-sm text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden></i>
      {agent && <AgentAvatar agent={agent} size={28} className="mt-0.5 shrink-0" />}
      <span className="min-w-0 flex-1">
        {/* Fila 1: nombre + rol + proyecto (líder) + contador. En el chat NO se
             muestran chips de proveedor·modelo (solo el Dashboard los pinta). */}
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] font-medium">
          {anyLive && <i className="ti ti-loader-2 animate-spin text-emerald-500 text-[10px]" aria-hidden></i>}
          {anyUnreviewed && (
            <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-red-500 ring-2 ring-red-500/30 animate-pulse" aria-hidden></span>
          )}
          <span className="min-w-0 max-w-full truncate">{name}</span>
          {role && <RoleChip role={role} className="min-w-0 shrink @sm:shrink-0" />}
          {isLeader && agent && <ProjectChip project={agent.project} className="min-w-0 shrink @sm:shrink-0" />}
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-foreground"
            title={formatAssistantMessage(dt.countTooltip ?? dt.groupCountTitle ?? "{count} conversaciones con este agente", { count })}
          >
            <i className="ti ti-message text-[9px]" aria-hidden></i>
            {count}
          </span>
        </span>
        {/* Fila 2: proyecto de los chats del grupo (solo grupos NO-líder). En los
            líderes el proyecto ya se pinta como `ProjectChip` junto al rol (fila 1),
            así que aquí se omite para no duplicarlo. */}
        {!isLeader && projectLabel && (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/80">
            <i className="ti ti-folder shrink-0 text-[10px]" aria-hidden></i>
            <span className="truncate">{projectLabel}</span>
          </span>
        )}
        {/* Contenedor estrecho (drawer): el stack de avatares baja a su propia
            fila para no comprimir/solaparse con el nombre y los chips. En
            contenedores anchos se pinta a la derecha (ver sibling de abajo). */}
        {subordinateAgents && subordinateAgents.length > 0 && (
          <span className="mt-1 flex @sm:hidden">
            <AvatarStack agents={subordinateAgents} />
          </span>
        )}
      </span>
      {subordinateAgents && subordinateAgents.length > 0 && (
        <span className="mt-0.5 hidden shrink-0 self-start @sm:flex">
          <AvatarStack agents={subordinateAgents} />
        </span>
      )}
    </button>
    {onNewChat && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onNewChat(); }}
        title={ct.newChatHere ?? "Nueva conversación"}
        aria-label={formatAssistantMessage(ct.newAgentChatAria ?? "Nueva conversación con {agent}", { agent: name })}
        className="mt-1.5 mr-1 shrink-0 self-start rounded p-1 text-muted-foreground opacity-70 transition-colors hover:bg-accent hover:text-primary hover:opacity-100 focus-visible:opacity-100"
      >
        <i className="ti ti-plus text-sm" aria-hidden></i>
      </button>
    )}
    </div>
  );
}

/** Conversation list for the "Agentes IA" tab, as a 2-level team view: the top
 *  level shows ONLY project/team leaders; a leader's collapsable holds its own
 *  conversations plus one sub-collapsable per DIRECT subordinate that has
 *  conversations (subordinates without any are hidden). Agents with no
 *  subordinates-with-conversations (leaders of other projects, loose agents)
 *  keep the Gmail-style threading: single `ConvoRow` or same-agent group. */
export function AgentThreadedConvos({
  convos,
  activeId,
  agentById,
  projectTitleById,
  rolesById,
  expanded,
  onToggle,
  onNewAgentChat,
  emptyLeaderAgents = [],
  newestLast = false,
  rowClassName = "",
  onOpen,
  onDelete,
  onRename,
  onTogglePin,
}: {
  convos: ConversationMeta[];
  activeId: string | null;
  agentById: Map<string, AssistantAgent>;
  projectTitleById: Map<string, string>;
  rolesById?: Map<string, AssistantAgentRole> | null;
  expanded: Set<string>;
  /** Toggle a group; `siblings` = ids of the groups sharing that level (accordion). */
  onToggle: (agentId: string, siblings?: Iterable<string>) => void;
  /** Crea una conversación nueva ligada a este agente (botón + de la cabecera). */
  onNewAgentChat: (agentId: string) => void;
  /** Líderes de proyecto que deben mostrarse como contenedor SIEMPRE, aun sin
   *  conversaciones (badge 0 + empty state), como las carpetas de proyecto. */
  emptyLeaderAgents?: AssistantAgent[];
  /** SOLO en móvil (`true`): invierte el orden para que los líderes más recientes
   *  queden ABAJO, al alcance del pulgar sobre las tabs/búsqueda ancladas debajo.
   *  En escritorio (`false`, default) se conserva el orden original (más recientes
   *  arriba). El sembrado de subordinados (`seedRoster`) es igual en ambos. */
  newestLast?: boolean;
  rowClassName?: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}) {
  const dt = useAssistantI18n().dashboardTab as Record<string, any>;
  // Seed the tree from the full roster (every team member, even with 0 chats).
  // `newestLast` (móvil) invierte el orden para que los líderes más recientes
  // queden abajo, al alcance del pulgar; en escritorio (default) se conserva el
  // orden original (más recientes arriba). El sembrado (`seedRoster`) es igual.
  const entries = buildAgentConversationTree(convos, agentById, { seedRoster: true, newestLast });
  // Líderes STANDALONE (sin equipo) SIN conversaciones que no aparecen en el
  // árbol: se añaden como contenedores vacíos en el extremo "menos reciente" de
  // la lista (arriba con newestLast, abajo sin él). Un líder ya representado NO
  // se duplica.
  const representedTop = new Set<string>();
  for (const e of entries) {
    if (e.kind === "leader") representedTop.add(e.agentId);
    else {
      const r = e.row;
      const aid = r.kind === "single" ? r.item.agentId : r.agentId;
      if (aid) representedTop.add(aid);
    }
  }
  const emptyLeaders = emptyLeaderAgents.filter((a) => a.id && !representedTop.has(a.id));
  type TopItem =
    | { kind: "entry"; entry: (typeof entries)[number] }
    | { kind: "emptyLeader"; agent: AssistantAgent };
  const emptyTop = emptyLeaders.map((agent) => ({ kind: "emptyLeader" as const, agent }));
  const entryTop = entries.map((entry) => ({ kind: "entry" as const, entry }));
  // Con newestLast (móvil) los contenedores vacíos van ARRIBA (extremo menos
  // reciente); en escritorio van ABAJO para respetar el orden original.
  const topItems: TopItem[] = newestLast ? [...emptyTop, ...entryTop] : [...entryTop, ...emptyTop];
  // Ids of every collapsable at the TOP level (all pages) — the accordion
  // closes them when another top-level group opens. Single chat rows aren't
  // collapsables, so they're skipped.
  const topSiblingIds: string[] = topItems.flatMap((it) => {
    if (it.kind === "emptyLeader") return [it.agent.id];
    const e = it.entry;
    if (e.kind === "leader") return [e.agentId];
    return e.row.kind === "single" ? [] : [e.row.agentId];
  });
  const rowProps = { activeId, agentById, projectTitleById, onOpen, onDelete, onRename, onTogglePin };
  // Nombre de proyecto dominante de un conjunto de chats → etiqueta a la derecha
  // de la fila del líder (primer chat con proyecto resuelto).
  const projectLabelOf = (list: ConversationMeta[]): string | null => {
    for (const c of list) {
      if (c.projectId) {
        const title = projectTitleById.get(c.projectId);
        if (title) return title;
      }
    }
    return null;
  };

  // ---- Pagination (5 per page). Top-level list via the shared `usePaged`
  // (resets to page 1 when the list length changes, like the project pagers);
  // every nested chat list keys its own page into `nestedPages`.
  const paged = usePaged(topItems, topItems.length, AGENTS_PER_PAGE);
  const [nestedPages, setNestedPages] = useState<Record<string, number>>({});
  const nestedPage = (k: string) => nestedPages[k] ?? 0;
  const setNestedPage = (k: string, p: number) =>
    setNestedPages((prev) => ({ ...prev, [k]: Math.max(0, p) }));
  const sliceNested = <U,>(key: string, items: U[]): U[] => {
    const pages = Math.max(1, Math.ceil(items.length / AGENTS_PER_PAGE));
    const cur = Math.min(nestedPage(key), pages - 1);
    return items.slice(cur * AGENTS_PER_PAGE, cur * AGENTS_PER_PAGE + AGENTS_PER_PAGE);
  };
  const renderNestedPager = (key: string, total: number): ReactNode => {
    const pages = Math.max(1, Math.ceil(total / AGENTS_PER_PAGE));
    if (pages <= 1) return null;
    const cur = Math.min(nestedPage(key), pages - 1);
    return (
      <ProjectsPager
        page={cur}
        pageCount={pages}
        onPrev={() => setNestedPage(key, cur - 1)}
        onNext={() => setNestedPage(key, cur + 1)}
      />
    );
  };

  return (
    <>
      {paged.visible.map((item) => {
        // Contenedor de un líder de proyecto SIN conversaciones: cabecera
        // collapsable con badge 0 y empty state, igual que una carpeta de
        // proyecto vacía. El botón + sigue creando un chat con ese agente.
        if (item.kind === "emptyLeader") {
          const a = item.agent;
          const isOpen = expanded.has(a.id);
          return (
            <div key={`empty-leader:${a.id}`} className="lxp-history-group-card">
              <TeamGroupHeader
                agent={a}
                fallbackName={a.name}
                count={0}
                isOpen={isOpen}
                onToggle={() => onToggle(a.id, topSiblingIds)}
                onNewChat={() => onNewAgentChat(a.id)}
                convos={[]}
                projectLabel={null}
                rolesById={rolesById}
                isLeader
              />
              <CollapseY open={isOpen}>
                <div className="ml-3 border-l border-border/50 pl-1">
                  <p className="px-2 py-1 text-[11px] text-muted-foreground">{dt.projectEmpty ?? "Sin conversaciones"}</p>
                </div>
                </CollapseY>
            </div>
          );
        }
        const entry = item.entry;
        // NOTE: the feed timeline (`TimelineRow`) decorates the INDIVIDUAL CHAT
        // cards nested inside each agent, NOT the agent-level rows. So top-level
        // agent/leader rows are rendered bare; only the nested `ConvoRow`s below
        // get the dot + connector, linking an agent's chats as a Tailwind-style
        // feed (line never overruns the last chat of the visible page).
        if (entry.kind === "thread") {
          const row = entry.row;
          if (row.kind === "single") {
            return (
              <ConvoRow key={row.item.id} c={row.item} extraClassName={rowClassName} {...rowProps} />
            );
          }
          const agent = agentById.get(row.agentId) ?? null;
          const isOpen = expanded.has(row.agentId);
          const grpKey = `grp:${row.agentId}`;
          const grpChats = sliceNested(grpKey, row.items);
          return (
            // Agent-group card: NO inter-card separator (each agent is its own
            // container). The `rowClassName` divider is reserved for chat rows.
            <div key={`group:${row.agentId}`} className="lxp-history-group-card">
              <TeamGroupHeader
                agent={agent}
                fallbackName={row.latest.title}
                count={row.items.length}
                isOpen={isOpen}
                onToggle={() => onToggle(row.agentId, topSiblingIds)}
                onNewChat={() => onNewAgentChat(row.agentId)}
                convos={row.items}
                projectLabel={projectLabelOf(row.items)}
                rolesById={rolesById}
              />
              <CollapseY open={isOpen}>
                <div className="ml-3 border-l border-border/50 pl-1">
                  {grpChats.map((c, i) => (
                    <TimelineRow key={c.id} isLast={i === grpChats.length - 1}>
                      <ConvoRow c={c} inGroup {...rowProps} />
                    </TimelineRow>
                  ))}
                  {renderNestedPager(grpKey, row.items.length)}
                </div>
                </CollapseY>
            </div>
          );
        }
        // Team-leader entry: own conversations + one sub-collapsable per
        // subordinate that has conversations.
        const leaderAgent = agentById.get(entry.agentId) ?? null;
        const leaderOpen = expanded.has(entry.agentId);
        const totalCount = entry.ownConvos.length + entry.subs.reduce((n, s) => n + s.convos.length, 0);
        const allConvos = [...entry.ownConvos, ...entry.subs.flatMap((s) => s.convos)];
        const fallbackName = entry.ownConvos[0]?.title ?? entry.subs[0]?.convos[0]?.title ?? "";
        const ownKey = `own:${entry.agentId}`;
        const subsKey = `subs:${entry.agentId}`;
        const ownChats = sliceNested(ownKey, entry.ownConvos);
        return (
          // Team-leader card: NO inter-card separator (see agent-group note above).
          <div key={`leader:${entry.agentId}`} className="lxp-history-group-card">
            <TeamGroupHeader
              agent={leaderAgent}
              fallbackName={fallbackName}
              count={totalCount}
              isOpen={leaderOpen}
              onToggle={() => onToggle(entry.agentId, topSiblingIds)}
              onNewChat={() => onNewAgentChat(entry.agentId)}
              convos={allConvos}
              projectLabel={projectLabelOf(allConvos)}
              rolesById={rolesById}
              isLeader
              subordinateAgents={entry.subs
                .map((s) => agentById.get(s.agentId))
                .filter((a): a is AssistantAgent => !!a)}
            />
            <CollapseY open={leaderOpen}>
              <div className="ml-3 border-l border-border/50 pl-1">
                {ownChats.map((c, i) => (
                  <TimelineRow key={c.id} isLast={i === ownChats.length - 1}>
                    <ConvoRow c={c} inGroup {...rowProps} />
                  </TimelineRow>
                ))}
                {renderNestedPager(ownKey, entry.ownConvos.length)}
                {sliceNested(subsKey, entry.subs).map((sub) => {
                  const subAgent = agentById.get(sub.agentId) ?? null;
                  const subOpen = expanded.has(sub.agentId);
                  const subKey = `sub:${sub.agentId}`;
                  const subChats = sliceNested(subKey, sub.convos);
                  return (
                    <div key={`sub:${sub.agentId}`}>
                      <TeamGroupHeader
                        agent={subAgent}
                        fallbackName={sub.convos[0]?.title ?? ""}
                        count={sub.convos.length}
                        isOpen={subOpen}
                        onToggle={() => onToggle(sub.agentId, entry.subs.map((x) => x.agentId))}
                        onNewChat={() => onNewAgentChat(sub.agentId)}
                        convos={sub.convos}
                        rolesById={rolesById}
                      />
                      <CollapseY open={subOpen}>
                        <div className="ml-3 border-l border-border/50 pl-1">
                          {sub.convos.length === 0 && (
                            <p className="px-2 py-1 text-[11px] text-muted-foreground">{dt.projectEmpty ?? "Sin conversaciones"}</p>
                          )}
                          {subChats.map((c, i) => (
                            <TimelineRow key={c.id} isLast={i === subChats.length - 1}>
                              <ConvoRow c={c} inGroup {...rowProps} />
                            </TimelineRow>
                          ))}
                          {renderNestedPager(subKey, sub.convos.length)}
                        </div>
                        </CollapseY>
                    </div>
                  );
                })}
                {renderNestedPager(subsKey, entry.subs.length)}
              </div>
              </CollapseY>
          </div>
        );
      })}
      {paged.hasPager && (
        <ProjectsPager page={paged.page} pageCount={paged.pageCount} onPrev={paged.prev} onNext={paged.next} />
      )}
    </>
  );
}
