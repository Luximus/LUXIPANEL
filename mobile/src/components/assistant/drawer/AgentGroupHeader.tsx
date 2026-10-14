// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronRight, Folder, MessageSquare, Plus, UserStar } from "lucide-react-native";
import type { AgentRole, AssistantAgent, Conversation } from "../../../features/assistant/types";
import { withAlpha, type ThemeTokens } from "../../../theme/colors";
import { AgentAvatar } from "../../assistant-settings/agents/AgentAvatar";
import type { AssistantStrings } from "../types";
import { PulseDot } from "./PulseDot";
import { styles } from "./AgentGroupHeader.styles";

/** Stack de avatares solapados de los subordinados de un líder (hasta `max` +
 *  burbuja "+N"), espejo del AvatarStack web. */
export function AvatarStack({ agents, tokens, max = 5 }: { agents: AssistantAgent[]; tokens: ThemeTokens; max?: number }) {
  if (agents.length === 0) return null;
  const shown = agents.slice(0, max);
  const extra = agents.length - shown.length;
  return (
    <View style={styles.avatarStack}>
      {shown.map((a) => (
        <View key={a.id} style={[styles.avatarStackItem, { borderColor: tokens.bgCardSolid }]}>
          <AgentAvatar config={a.avatarConfig} seed={a.id || a.name || "agent"} size={18} tokens={tokens} />
        </View>
      ))}
      {extra > 0 ? (
        <View style={[styles.avatarStackExtra, { borderColor: tokens.bgCardSolid, backgroundColor: tokens.bgInput }]}>
          <Text style={[styles.avatarStackExtraText, { color: tokens.textMuted }]}>{`+${extra}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Tintes FIJOS de los chips de agente (paridad exacta con `AgentInfoChips.tsx`
// web): rol en violeta (violet-500) con icono estrella-usuario; proyecto en
// sky-blue (sky-500) con icono carpeta. No dependen del `role.color` ni del tema.
const ROLE_VIOLET = "#8b5cf6"; // violet-500 (RoleChip: bg-violet-500/15)
const PROJECT_SKY = "#0ea5e9"; // sky-500 (ProjectChip: bg-sky-500/15)

/** Chip de rol del agente: violeta FIJO + icono estrella-usuario (espejo del
 *  RoleChip web `bg-violet-500/15` + `ti-user-star`, no usa `role.color`). */
function RoleChip({ role }: { role: AgentRole }) {
  return (
    <View style={[styles.agentRoleChip, { borderColor: withAlpha(ROLE_VIOLET, 0.3), backgroundColor: withAlpha(ROLE_VIOLET, 0.15) }]}>
      <UserStar size={9} color={ROLE_VIOLET} />
      <Text numberOfLines={1} style={[styles.agentRoleChipText, { color: ROLE_VIOLET }]}>{role.name}</Text>
    </View>
  );
}

/** Chip de proyecto del líder (nombre + carpeta): sky-blue FIJO, espejo del
 *  ProjectChip web `bg-sky-500/15 text-sky-700`. */
function AgentProjectChip({ label }: { label: string }) {
  return (
    <View style={[styles.agentProjectChip, { backgroundColor: withAlpha(PROJECT_SKY, 0.15) }]}>
      <Folder size={9} color={PROJECT_SKY} />
      <Text numberOfLines={1} style={[styles.agentProjectChipText, { color: PROJECT_SKY }]}>{label}</Text>
    </View>
  );
}

/** Cabecera colapsable compartida por líderes, grupos del mismo agente y
 *  sub-filas de subordinado: chevron + avatar + nombre + indicadores (vivo /
 *  sin revisar) + chips rol/proyecto + contador de chats + stack de avatares
 *  (solo líder) + botón "+". Espejo de TeamGroupHeader web. */
export function AgentGroupHeader({
  agent, fallbackName, count, isOpen, onToggle, onNewChat, convos, liveIds,
  subordinateAgents, projectLabel, role, isLeader, t, tokens,
}: {
  agent: AssistantAgent | null;
  fallbackName: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  onNewChat?: () => void;
  convos: Conversation[];
  liveIds: Set<string>;
  subordinateAgents?: AssistantAgent[];
  projectLabel?: string | null;
  role?: AgentRole | null;
  isLeader?: boolean;
  t: AssistantStrings;
  tokens: ThemeTokens;
}) {
  const name = agent?.name ?? fallbackName ?? "";
  const anyLive = convos.some((c) => liveIds.has(c.id));
  const anyUnreviewed = convos.some((c) => !anyLive && !!c.unreviewed && !liveIds.has(c.id));
  const projectName = isLeader ? agent?.project?.name ?? null : null;
  return (
    <View style={styles.agentGroupRow}>
      <Pressable onPress={onToggle} style={styles.agentGroupBtn}>
        <View style={styles.agentGroupChevron}>
          {isOpen ? <ChevronDown size={14} color={tokens.textMuted} /> : <ChevronRight size={14} color={tokens.textMuted} />}
        </View>
        {agent ? <AgentAvatar config={agent.avatarConfig} seed={agent.id || agent.name || "agent"} size={28} tokens={tokens} /> : null}
        <View style={styles.agentGroupMain}>
          <View style={styles.agentGroupTitleRow}>
            {anyLive ? <ActivityIndicator size="small" color={tokens.success} /> : null}
            {anyUnreviewed ? <PulseDot color={tokens.danger} /> : null}
            <Text numberOfLines={1} style={[styles.agentGroupName, { color: tokens.textPrimary }]}>{name}</Text>
            {role ? <RoleChip role={role} /> : null}
            {projectName ? <AgentProjectChip label={projectName} /> : null}
            <View style={[styles.agentCountPill, { backgroundColor: withAlpha(tokens.brand, 0.15) }]}>
              <MessageSquare size={9} color={tokens.textPrimary} />
              <Text style={[styles.agentCountText, { color: tokens.textPrimary }]}>{count}</Text>
            </View>
          </View>
          {!isLeader && projectLabel ? (
            <View style={styles.agentGroupProjectLine}>
              <Folder size={9} color={tokens.textMuted} />
              <Text numberOfLines={1} style={[styles.agentGroupProjectText, { color: tokens.textMuted }]}>{projectLabel}</Text>
            </View>
          ) : null}
          {subordinateAgents && subordinateAgents.length > 0 ? (
            <AvatarStack agents={subordinateAgents} tokens={tokens} />
          ) : null}
        </View>
      </Pressable>
      {onNewChat ? (
        <Pressable onPress={onNewChat} accessibilityLabel={t.newChat} hitSlop={4} style={styles.agentNewBtn}>
          <Plus size={14} color={tokens.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
