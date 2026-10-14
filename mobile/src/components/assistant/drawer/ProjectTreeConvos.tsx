// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// ─── Árbol de "Sueltos / Proyectos" (paridad con ProjectTreeConvos web) ───────
// Puerto RN del árbol recursivo de proyectos del sidebar del chat de LUXIPANEL:
// una carpeta "Chats sueltos" colapsable + carpetas de proyecto anidadas, cada
// una con sus chats (envueltos en el timeline) y sus subcarpetas. La carga de
// más conversaciones pertenece al scroll del drawer, no a este árbol.
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ChevronRight, Folder, MessageSquare, Plus } from "lucide-react-native";
import type { AssistantAgent, Conversation } from "../../../features/assistant/types";
import { withAlpha, type ThemeTokens } from "../../../theme/colors";
import { flattenProjectTreeChats, LOOSE_GROUP_ID, type ProjectTreeEntry, type ProjectTreeNode } from "../../assistant-settings/agents/conversation-grouping";
import type { AssistantStrings } from "../types";
import { PulseDot } from "./PulseDot";
import { TimelineRowRN } from "./TimelineRow";
import { ConvoRow } from "./ConvoRow";
import { styles } from "./ProjectTreeConvos.styles";

/** Cabecera colapsable de una carpeta (proyecto o "Chats sueltos"): chevron +
 *  icono + indicadores live/sin-revisar + nombre + pill de conteo + botón "+"
 *  (nueva conversación en esa carpeta). Espejo RN de `ProjectGroupHeader` web. */
export function ProjectGroupHeaderRN({ name, count, isOpen, loose, convos, liveIds, onToggle, onNewChat, t, tokens }: {
  name: string;
  count: number;
  isOpen: boolean;
  loose?: boolean;
  convos: Conversation[];
  liveIds: Set<string>;
  onToggle: () => void;
  onNewChat?: () => void;
  t: AssistantStrings;
  tokens: ThemeTokens;
}) {
  const anyLive = convos.some((c) => liveIds.has(c.id));
  const anyUnreviewed = !anyLive && convos.some((c) => !!c.unreviewed);
  return (
    <View style={styles.treeGroupHead}>
      <Pressable onPress={onToggle} accessibilityLabel={name} style={styles.treeGroupHeadMain}>
        <ChevronRight size={14} color={tokens.textMuted} style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }} />
        {loose ? <MessageSquare size={16} color={tokens.textMuted} /> : <Folder size={16} color={tokens.textMuted} />}
        <View style={styles.treeGroupHeadNameWrap}>
          {anyLive ? <ActivityIndicator size="small" color={tokens.success} /> : null}
          {anyUnreviewed ? <PulseDot color={tokens.danger} /> : null}
          <Text numberOfLines={1} style={[styles.treeGroupHeadName, { color: tokens.textPrimary }]}>{name}</Text>
        </View>
        <View style={[styles.treeCount, { backgroundColor: tokens.bgInput }]}>
          <Text style={[styles.treeCountText, { color: tokens.textMuted }]}>{count}</Text>
        </View>
      </Pressable>
      {onNewChat ? (
        <Pressable onPress={onNewChat} accessibilityLabel={t.newChat} hitSlop={6} style={styles.treeGroupHeadAdd}>
          <Plus size={15} color={tokens.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Árbol recursivo de proyectos colapsable. `top` = nivel superior (carpeta
 *  "Chats sueltos" + carpetas raíz); anidado = chats propios + subcarpetas. */
export function ProjectTreeConvos({
  entries, projectTitleById, agentById, expanded, activeId, liveIds, top = true,
  onToggle, onNewLoose, onNewProjectChat, onOpen, onDelete, onRename, onTogglePin, t, tokens,
}: {
  entries: ProjectTreeEntry<Conversation>[];
  projectTitleById: Map<string, string>;
  agentById?: Map<string, AssistantAgent>;
  expanded: Set<string>;
  activeId: string | null;
  liveIds: Set<string>;
  top?: boolean;
  onToggle: (projectId: string) => void;
  onNewLoose: () => void;
  onNewProjectChat: (projectId: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  t: AssistantStrings;
  tokens: ThemeTokens;
}) {
  const chatEntries = entries.filter((e): e is { kind: "chat"; convo: Conversation } => e.kind === "chat");
  const folderEntries = entries.filter((e): e is { kind: "project"; node: ProjectTreeNode<Conversation> } => e.kind === "project");
  const looseOpen = expanded.has(LOOSE_GROUP_ID);

  const convoRow = (c: Conversation, key: string, i: number, list: Conversation[]) => (
    <TimelineRowRN key={key} isLast={i === list.length - 1} tokens={tokens}>
      <ConvoRow c={c} activeId={activeId} isLive={liveIds.has(c.id)} agentLabel={c.agentId ? agentById?.get(c.agentId)?.name : undefined} t={t} tokens={tokens} onOpen={onOpen} onDelete={onDelete} onRename={onRename} onTogglePin={onTogglePin} />
    </TimelineRowRN>
  );

  const renderProjectFolder = (node: ProjectTreeNode<Conversation>): React.ReactNode => {
    const isOpen = expanded.has(node.projectId);
    return (
      <View key={`proj:${node.projectId}`}>
        <ProjectGroupHeaderRN
          name={projectTitleById.get(node.projectId) ?? node.projectId.slice(0, 8)}
          count={node.totalConvos}
          isOpen={isOpen}
          convos={flattenProjectTreeChats(node)}
          liveIds={liveIds}
          onToggle={() => onToggle(node.projectId)}
          onNewChat={() => onNewProjectChat(node.projectId)}
          t={t}
          tokens={tokens}
        />
        {isOpen ? (
          <View style={[styles.treeNestBox, { borderLeftColor: withAlpha(tokens.border, 0.8) }]}>
            {node.entries.length ? (
              <ProjectTreeConvos
                entries={node.entries}
                projectTitleById={projectTitleById}
                agentById={agentById}
                expanded={expanded}
                activeId={activeId}
                liveIds={liveIds}
                top={false}
                onToggle={onToggle}
                onNewLoose={onNewLoose}
                onNewProjectChat={onNewProjectChat}
                onOpen={onOpen}
                onDelete={onDelete}
                onRename={onRename}
                onTogglePin={onTogglePin}
                t={t}
                tokens={tokens}
              />
            ) : (
              <Text style={[styles.treeEmptyNested, { color: tokens.textMuted }]}>{t.noConversations}</Text>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  type TopCard = { kind: "loose" } | { kind: "folder"; node: ProjectTreeNode<Conversation> };
  // La carpeta "Chats sueltos" se pinta SIEMPRE (aunque esté a 0): su "+" es el
  // único punto del drawer para crear un chat NO ligado a proyecto/agente, y al
  // borrar el último chat suelto desaparecía la forma de crear uno nuevo.
  const topCards: TopCard[] = top
    ? [
        { kind: "loose" as const },
        ...folderEntries.map((e) => ({ kind: "folder" as const, node: e.node })),
      ]
    : [];
  // Nivel anidado: chats propios (timeline) + subcarpetas.
  if (!top) {
    const chats = chatEntries.map((e) => e.convo);
    return (
      <>
        {chats.map((c, i) => convoRow(c, c.id, i, chats))}
        {folderEntries.map((e) => renderProjectFolder(e.node))}
      </>
    );
  }

  // Nivel superior: carpeta "Chats sueltos" (si hay sueltos) + carpetas raíz.
  const looseVisible = chatEntries.map((e) => e.convo);
  return (
    <>
      {topCards.map((card) =>
        card.kind === "loose" ? (
          <View key="loose">
            <ProjectGroupHeaderRN
              name={t.looseChats ?? "Chats sueltos"}
              loose
              count={chatEntries.length}
              isOpen={looseOpen}
              convos={chatEntries.map((e) => e.convo)}
              liveIds={liveIds}
              onToggle={() => onToggle(LOOSE_GROUP_ID)}
              onNewChat={onNewLoose}
              t={t}
              tokens={tokens}
            />
            {looseOpen ? (
              <View style={[styles.treeNestBox, { borderLeftColor: withAlpha(tokens.border, 0.8) }]}>
                {chatEntries.length === 0 ? (
                  <Text style={[styles.treeEmptyNested, { color: tokens.textMuted }]}>{t.noConversations}</Text>
                ) : null}
                {looseVisible.map((c, i) => convoRow(c, c.id, i, looseVisible))}
              </View>
            ) : null}
          </View>
        ) : (
          renderProjectFolder(card.node)
        ),
      )}
    </>
  );
}
