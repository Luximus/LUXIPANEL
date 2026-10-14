// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AgentGroupedChecklist (RN) — checklist multi-selección de agentes agrupados
 * por equipo/grupo de trabajo (puerto de WEB/floating-assistant/AgentGroupedChecklist).
 * Los buckets salen de `groupAgentsForPicker`, así que NUNCA diverge de la lista
 * principal del módulo. Cada grupo es una cabecera colapsable con nombre + conteo;
 * un grupo arranca abierto si contiene algún agente seleccionado. La selección la
 * posee el llamador (este componente solo pinta y emite `onToggle`).
 *
 * Se usa en el editor ("Conexiones con otros agentes") y en los pickers de equipo.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronDown, ChevronRight, Users } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type { AssistantAgent, AgentTeam } from "../types";
import { s } from "../styles";
import { formatStr, type AgentsStrings } from "./agents-i18n";
import { groupAgentsForPicker } from "./agents-grouping";
import { AgentAvatar } from "./AgentAvatar";

export function AgentGroupedChecklist({
  agents,
  selectedIds,
  onToggle,
  excludeId,
  teams,
  tokens,
  str,
}: {
  agents: AssistantAgent[];
  selectedIds: Set<string> | string[];
  onToggle: (id: string) => void;
  /** Agente a omitir de la lista (p. ej. el que se está editando). */
  excludeId?: string;
  /** Equipos para el bucketing por `teamId`; sin ellos cae al grupo por nombre. */
  teams?: AgentTeam[];
  tokens: ThemeTokens;
  str: AgentsStrings;
}) {
  const selected = useMemo(
    () => (selectedIds instanceof Set ? selectedIds : new Set(selectedIds)),
    [selectedIds],
  );

  const groups = useMemo(() => {
    const teamsById = new Map<string, AgentTeam>((teams ?? []).map((t) => [t.id, t]));
    const pool = excludeId ? agents.filter((a) => a.id !== excludeId) : agents;
    return groupAgentsForPicker(pool, teamsById);
  }, [agents, excludeId, teams]);

  if (groups.length === 0) {
    return <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{str.editor.connectionsEmpty}</Text>;
  }

  return (
    <View style={{ gap: 6 }}>
      {groups.map((g) => (
        <ChecklistGroup
          key={g.key}
          label={g.key === "General" ? str.list.noRoleGroupTitle : g.label}
          count={g.agents.length}
          agents={g.agents}
          selected={selected}
          onToggle={onToggle}
          tokens={tokens}
          str={str}
        />
      ))}
    </View>
  );
}

function ChecklistGroup({
  label,
  count,
  agents,
  selected,
  onToggle,
  tokens,
  str,
}: {
  label: string;
  count: number;
  agents: AssistantAgent[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
}) {
  const hasSelected = agents.some((a) => selected.has(a.id));
  const [open, setOpen] = useState(hasSelected);

  return (
    <View style={{ borderWidth: 1, borderRadius: 10, borderColor: tokens.border, backgroundColor: tokens.bgSecondary }}>
      <Pressable onPress={() => setOpen((v) => !v)} style={[s.rowBetween, { padding: 9, gap: 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1 }}>
          <Users size={14} color={tokens.textMuted} />
          <Text style={[s.cardDesc, { color: tokens.textPrimary, fontWeight: "700" }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={[s.badge, { backgroundColor: tokens.bgInput }]}>
            <Text style={[s.badgeText, { color: tokens.textMuted }]}>
              {formatStr(str.list.groupCount, { count })}
            </Text>
          </View>
          {open ? <ChevronDown size={16} color={tokens.textMuted} /> : <ChevronRight size={16} color={tokens.textMuted} />}
        </View>
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 6, paddingBottom: 6, gap: 2 }}>
          {agents.map((a) => {
            const on = selected.has(a.id);
            return (
              <Pressable
                key={a.id}
                onPress={() => onToggle(a.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8 }}
              >
                <CheckBox on={on} tokens={tokens} />
                <AgentAvatar config={a.avatarConfig} seed={a.id || a.name} size={20} tokens={tokens} />
                <Text style={[s.cardDesc, { color: tokens.textSecondary, flex: 1 }]} numberOfLines={1}>
                  {a.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** Casilla cuadrada de selección (no hay primitiva Checkbox en la app). */
export function CheckBox({ on, tokens }: { on: boolean; tokens: ThemeTokens }) {
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
        borderColor: on ? tokens.brand : tokens.border,
        backgroundColor: on ? tokens.brand : "transparent",
      }}
    >
      {on ? <Check size={12} color="#ffffff" /> : null}
    </View>
  );
}
