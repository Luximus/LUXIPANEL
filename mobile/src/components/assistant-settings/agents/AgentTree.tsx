// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AgentTree (RN) — jerarquía de agentes 100% nativa. Lista jerárquica con
 * sangría por nivel (líder → subordinados), avatar y rol por fila; cuando
 * `onPickAgent` está presente cada fila es tocable para elegir el agente.
 * Antes esto renderizaba un diagrama Mermaid dentro de un WebView (con CDN
 * externo); se eliminó por la política "sin webviews en la app" — esta lista
 * era su fallback y ahora es el render único.
 */
import React, { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Bot, ChevronRight } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type { AssistantAgent } from "../types";
import { s } from "../styles";
import type { AgentsStrings } from "./agents-i18n";
import { AgentAvatar } from "./AgentAvatar";

/** Filas de la lista jerárquica nativa. */
type TreeRow = { agent: AssistantAgent; depth: number };
function buildTreeRows(agents: AssistantAgent[]): TreeRow[] {
  const ids = new Set(agents.map((a) => a.id));
  const childrenOf = new Map<string, AssistantAgent[]>();
  const roots: AssistantAgent[] = [];
  for (const a of agents) {
    if (a.parentAgentId && ids.has(a.parentAgentId)) {
      const arr = childrenOf.get(a.parentAgentId) ?? [];
      arr.push(a);
      childrenOf.set(a.parentAgentId, arr);
    } else {
      roots.push(a);
    }
  }
  const byName = (x: AssistantAgent, y: AssistantAgent) =>
    (x.name ?? "").localeCompare(y.name ?? "", undefined, { sensitivity: "base" });
  roots.sort(byName);
  for (const [, arr] of childrenOf) arr.sort(byName);

  const rows: TreeRow[] = [];
  const seen = new Set<string>();
  const walk = (a: AssistantAgent, depth: number) => {
    if (seen.has(a.id)) return; // guardia de ciclos
    seen.add(a.id);
    rows.push({ agent: a, depth });
    for (const c of childrenOf.get(a.id) ?? []) walk(c, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  // Huérfanos de ciclos que no se alcanzaron desde ninguna raíz.
  for (const a of agents) if (!seen.has(a.id)) walk(a, 0);
  return rows;
}

export function AgentTree({
  agents,
  onPickAgent,
  roleNameById,
  tokens,
  str,
}: {
  agents: AssistantAgent[];
  onPickAgent?: (agent: AssistantAgent) => void;
  /** ROL id → nombre; pinta el rol bajo el nombre en cada nodo/fila. */
  roleNameById?: ReadonlyMap<string, string>;
  tokens: ThemeTokens;
  str: AgentsStrings;
}) {
  const rows = useMemo(() => buildTreeRows(agents), [agents]);

  if (agents.length === 0) {
    return (
      <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, alignItems: "center" }]}>
        <Text style={[s.cardDesc, { color: tokens.textMuted, textAlign: "center" }]}>{str.diagram.empty}</Text>
      </View>
    );
  }
  return <NativeTree rows={rows} onPickAgent={onPickAgent} roleNameById={roleNameById} tokens={tokens} />;
}

/** Lista jerárquica nativa (y selector de agente cuando hay `onPickAgent`). */
function NativeTree({
  rows,
  onPickAgent,
  roleNameById,
  tokens,
}: {
  rows: TreeRow[];
  onPickAgent?: (agent: AssistantAgent) => void;
  roleNameById?: ReadonlyMap<string, string>;
  tokens: ThemeTokens;
}) {
  return (
    <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
      <View style={{ gap: 2 }}>
        {rows.map(({ agent, depth }) => {
          const roleName = agent.roleId ? roleNameById?.get(agent.roleId)?.trim() : undefined;
          const Row = (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 7,
                paddingHorizontal: 8,
                marginLeft: depth * 16,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.bgSecondary,
              }}
            >
              {depth > 0 ? <ChevronRight size={13} color={tokens.textMuted} /> : <Bot size={14} color={tokens.brand} />}
              <AgentAvatar config={agent.avatarConfig} seed={agent.id || agent.name} size={20} tokens={tokens} />
              <View style={{ flex: 1 }}>
                <Text style={[s.cardDesc, { color: tokens.textPrimary, fontWeight: depth === 0 ? "700" : "500" }]} numberOfLines={1}>
                  {agent.name}
                </Text>
                {roleName ? (
                  <Text style={[s.cardDesc, { color: tokens.textMuted, fontSize: 11, lineHeight: 15 }]} numberOfLines={1}>
                    {roleName}
                  </Text>
                ) : null}
              </View>
            </View>
          );
          return onPickAgent ? (
            <Pressable key={agent.id} onPress={() => onPickAgent(agent)}>
              {Row}
            </Pressable>
          ) : (
            <View key={agent.id}>{Row}</View>
          );
        })}
      </View>
    </ScrollView>
  );
}
