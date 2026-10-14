// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// ─── Árbol de "Agentes IA" (paridad con AgentThreadedConvos web) ──────────────
// Puerto RN del árbol líder → subordinados del sidebar del chat de LUXIPANEL:
// el primer nivel muestra solo líderes/agentes; cada líder despliega sus chats
// propios + una sub-colapsable por subordinado directo (aunque no tenga chats).
// Los grupos muestran todos los chats recibidos; el drawer pide más al hacer scroll.
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import type { AgentRole, AssistantAgent, Conversation } from "../../../features/assistant/types";
import type { ThemeTokens } from "../../../theme/colors";
import { buildAgentConversationTree } from "../../assistant-settings/agents/conversation-grouping";
import type { AssistantStrings } from "../types";
import { pickEmptyLeaderAgents } from "./agent-top-items";
import { TimelineRowRN } from "./TimelineRow";
import { ConvoRow } from "./ConvoRow";
import { AgentGroupHeader } from "./AgentGroupHeader";
import { styles } from "./AgentThreadedConvos.styles";

// Acordeón POR NIVEL (paridad web): en cada grupo hay como mucho un agente
// desplegado. `openAgentByGroup` mapea grupo → agente abierto (o null): el
// primer nivel usa `ROOT_GROUP_KEY` y cada líder es el grupo de sus
// subordinados, así que abrir un subagente no cierra a su líder ni afecta a
// otros grupos.
export const ROOT_GROUP_KEY = "root";
export type OpenAgentByGroup = Map<string, string | null>;

/** Lista de conversaciones del tab "Agentes IA" como vista de equipos de 2
 *  niveles. Construye el árbol con `buildAgentConversationTree` (mismo módulo
 *  puro que el web) y lo pinta con `AgentGroupHeader` + `ConvoRow` anidados.
 *  `newestLast` invierte el orden en móvil (líderes recientes abajo, thumb-reach). */
export function AgentThreadedConvos({
  convos, activeId, liveIds, agentById, rolesById, projectTitleById, openAgentByGroup,
  onToggle, onNewAgentChat, emptyLeaderAgents = [], newestLast = false, t, tokens,
  onOpen, onDelete, onRename, onTogglePin,
}: {
  convos: Conversation[];
  activeId: string | null;
  liveIds: Set<string>;
  agentById: Map<string, AssistantAgent>;
  rolesById: Map<string, AgentRole>;
  projectTitleById: Map<string, string>;
  openAgentByGroup: OpenAgentByGroup;
  onToggle: (groupKey: string, agentId: string) => void;
  onNewAgentChat: (agentId: string) => void;
  emptyLeaderAgents?: AssistantAgent[];
  newestLast?: boolean;
  t: AssistantStrings;
  tokens: ThemeTokens;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}) {
  const entries = useMemo(
    () => buildAgentConversationTree(convos, agentById, { seedRoster: true, newestLast }),
    [convos, agentById, newestLast],
  );
  // Líderes STANDALONE sin conversaciones que no salen del árbol: se añaden como
  // contenedores vacíos en el extremo "menos reciente" (arriba con newestLast).
  // `pickEmptyLeaderAgents` cuenta también a los subordinados ANIDADOS: un
  // subordinado que a su vez lidera equipo ya sale dentro de su líder y no debe
  // duplicarse como tarjeta de primer nivel con contador 0.
  type TopItem = { kind: "entry"; entry: (typeof entries)[number] } | { kind: "emptyLeader"; agent: AssistantAgent };
  const emptyTop: TopItem[] = pickEmptyLeaderAgents(entries, emptyLeaderAgents)
    .map((agent) => ({ kind: "emptyLeader", agent }));
  const entryTop: TopItem[] = entries.map((entry) => ({ kind: "entry", entry }));
  const topItems: TopItem[] = newestLast ? [...emptyTop, ...entryTop] : [...entryTop, ...emptyTop];

  const isOpenIn = (groupKey: string, agentId: string) => openAgentByGroup.get(groupKey) === agentId;
  const roleOf = (agent: AssistantAgent | null): AgentRole | null =>
    agent?.roleId ? rolesById.get(agent.roleId) ?? null : null;
  const projectLabelOf = (list: Conversation[]): string | null => {
    for (const c of list) {
      if (c.projectId) {
        const title = projectTitleById.get(c.projectId);
        if (title) return title;
      }
    }
    return null;
  };
  const renderChat = (c: Conversation) => (
    <ConvoRow
      key={c.id}
      c={c}
      activeId={activeId}
      isLive={liveIds.has(c.id)}
      projectLabel={null}
      t={t}
      tokens={tokens}
      onOpen={onOpen}
      onDelete={onDelete}
      onRename={onRename}
      onTogglePin={onTogglePin}
    />
  );
  // Chats anidados con conector de timeline (punto + línea), paridad con el
  // panel: el `border-l` lo aporta `agentNested`; aquí va el punto por chat.
  const renderNested = (chats: Conversation[]) =>
    chats.map((c, i) => (
      <TimelineRowRN key={c.id} isLast={i === chats.length - 1} tokens={tokens}>
        {renderChat(c)}
      </TimelineRowRN>
    ));
  const nestedBox = (children: React.ReactNode) => (
    <View style={[styles.agentNested, { borderLeftColor: tokens.border }]}>{children}</View>
  );

  return (
    <>
      {topItems.map((item) => {
        if (item.kind === "emptyLeader") {
          const a = item.agent;
          const isOpen = isOpenIn(ROOT_GROUP_KEY, a.id);
          return (
            <View key={`empty-leader:${a.id}`} style={[styles.agentTopCard, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
              <AgentGroupHeader
                agent={a} fallbackName={a.name} count={0} isOpen={isOpen}
                onToggle={() => onToggle(ROOT_GROUP_KEY, a.id)} onNewChat={() => onNewAgentChat(a.id)}
                convos={[]} liveIds={liveIds} projectLabel={null} role={roleOf(a)} isLeader t={t} tokens={tokens}
              />
              {isOpen ? nestedBox(<Text style={[styles.agentNestedEmpty, { color: tokens.textMuted }]}>{t.noConversations}</Text>) : null}
            </View>
          );
        }
        const entry = item.entry;
        if (entry.kind === "thread") {
          const row = entry.row;
          if (row.kind === "single") return (
            <View key={`single:${row.item.id}`} style={[styles.agentTopCard, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
              {renderChat(row.item)}
            </View>
          );
          const agent = agentById.get(row.agentId) ?? null;
          const isOpen = isOpenIn(ROOT_GROUP_KEY, row.agentId);
          const grpChats = row.items;
          return (
            <View key={`group:${row.agentId}`} style={[styles.agentTopCard, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
              <AgentGroupHeader
                agent={agent} fallbackName={row.latest.title ?? ""} count={row.items.length} isOpen={isOpen}
                onToggle={() => onToggle(ROOT_GROUP_KEY, row.agentId)} onNewChat={() => onNewAgentChat(row.agentId)}
                convos={row.items} liveIds={liveIds} projectLabel={projectLabelOf(row.items)} role={roleOf(agent)} t={t} tokens={tokens}
              />
              {isOpen ? nestedBox(renderNested(grpChats)) : null}
            </View>
          );
        }
        // Entrada de líder: chats propios + una sub-colapsable por subordinado.
        const leaderAgent = agentById.get(entry.agentId) ?? null;
        const leaderOpen = isOpenIn(ROOT_GROUP_KEY, entry.agentId);
        const totalCount = entry.ownConvos.length + entry.subs.reduce((n, s) => n + s.convos.length, 0);
        const allConvos = [...entry.ownConvos, ...entry.subs.flatMap((s) => s.convos)];
        const fallbackName = entry.ownConvos[0]?.title ?? entry.subs[0]?.convos[0]?.title ?? "";
        const ownChats = entry.ownConvos;
        return (
          <View key={`leader:${entry.agentId}`} style={[styles.agentTopCard, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <AgentGroupHeader
              agent={leaderAgent} fallbackName={fallbackName} count={totalCount} isOpen={leaderOpen}
              onToggle={() => onToggle(ROOT_GROUP_KEY, entry.agentId)} onNewChat={() => onNewAgentChat(entry.agentId)}
              convos={allConvos} liveIds={liveIds} projectLabel={projectLabelOf(allConvos)} role={roleOf(leaderAgent)} isLeader
              subordinateAgents={entry.subs.map((s) => agentById.get(s.agentId)).filter((a): a is AssistantAgent => !!a)}
              t={t} tokens={tokens}
            />
            {leaderOpen ? nestedBox(
              <>
                {renderNested(ownChats)}
                {entry.subs.map((sub) => {
                  const subAgent = agentById.get(sub.agentId) ?? null;
                  const subOpen = isOpenIn(entry.agentId, sub.agentId);
                  const subChats = sub.convos;
                  return (
                    <View key={`sub:${sub.agentId}`}>
                      <AgentGroupHeader
                        agent={subAgent} fallbackName={sub.convos[0]?.title ?? ""} count={sub.convos.length} isOpen={subOpen}
                        onToggle={() => onToggle(entry.agentId, sub.agentId)} onNewChat={() => onNewAgentChat(sub.agentId)}
                        convos={sub.convos} liveIds={liveIds} projectLabel={null} role={roleOf(subAgent)} t={t} tokens={tokens}
                      />
                      {subOpen ? nestedBox(
                        <>
                          {sub.convos.length === 0 ? <Text style={[styles.agentNestedEmpty, { color: tokens.textMuted }]}>{t.noConversations}</Text> : null}
                          {renderNested(subChats)}
                        </>,
                      ) : null}
                    </View>
                  );
                })}
              </>,
            ) : null}
          </View>
        );
      })}
    </>
  );
}
