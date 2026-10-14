// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SkillsPicker (RN) — multiselección compacta de skills reutilizada por el editor
 * de agente (puerto de WEB/floating-assistant/SkillsPicker). Construye un mapa de
 * overrides DISPERSO (skillId → {enabled, options}) que se superpone al catálogo
 * global solo en los chats de ese agente. El check muestra el estado EFECTIVO
 * (override → default global); el override solo registra desviaciones explícitas.
 *
 * A diferencia del web, la lista de skills llega por prop (`skills`) — ya la
 * cargó el editor con `skillsApi.list`; este componente no hace red.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type { AssistantSkill, AssistantSkillsMap } from "../types";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { s } from "../styles";
import type { AgentsStrings } from "./agents-i18n";
import { CheckBox } from "./AgentGroupedChecklist";

export function SkillsPicker({
  skills,
  value,
  onChange,
  tokens,
  str,
}: {
  skills: AssistantSkill[];
  value: AssistantSkillsMap;
  onChange: (next: AssistantSkillsMap) => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((sk) =>
      `${sk.name} ${sk.description} ${sk.categoryLabel}`.toLowerCase().includes(q),
    );
  }, [skills, query]);

  const isOn = (sk: AssistantSkill) => value[sk.id]?.enabled ?? sk.enabled;
  const optOf = (sk: AssistantSkill, key: string, dflt: string) => value[sk.id]?.options?.[key] ?? dflt;

  const toggle = (sk: AssistantSkill) => {
    onChange({ ...value, [sk.id]: { ...value[sk.id], enabled: !isOn(sk) } });
  };
  const setOption = (sk: AssistantSkill, key: string, v: string) => {
    const prev = value[sk.id] ?? {};
    onChange({ ...value, [sk.id]: { ...prev, options: { ...(prev.options ?? {}), [key]: v } } });
  };

  const overridden = Object.keys(value).length;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input value={query} onChangeText={setQuery} placeholder={str.editor.agentSkills} />
        </View>
        {overridden > 0 ? (
          <Pressable onPress={() => onChange({})} style={[s.badge, { backgroundColor: tokens.bgSecondary, paddingHorizontal: 9, paddingVertical: 6 }]}>
            <Text style={[s.badgeText, { color: tokens.textMuted }]}>{str.removeAll}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        {filtered.map((sk) => {
          const on = isOn(sk);
          return (
            <View
              key={sk.id}
              style={{ borderWidth: 1, borderRadius: 10, borderColor: tokens.border, backgroundColor: tokens.bgSecondary, padding: 9, gap: 6 }}
            >
              <Pressable onPress={() => toggle(sk)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ paddingTop: 1 }}>
                  <CheckBox on={on} tokens={tokens} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[s.cardDesc, { color: tokens.textPrimary, fontWeight: "700" }]}>{sk.name}</Text>
                    <View style={[s.badge, { backgroundColor: tokens.bgInput }]}>
                      <Text style={[s.badgeText, { color: tokens.textMuted }]}>{sk.categoryLabel}</Text>
                    </View>
                  </View>
                  {sk.description ? (
                    <Text style={[s.toggleHint, { color: tokens.textMuted }]} numberOfLines={2}>
                      {sk.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              {on && sk.options.length > 0 ? (
                <View style={{ gap: 6, paddingLeft: 26 }}>
                  {sk.options.map((o) => (
                    <View key={o.key} style={s.field}>
                      <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{o.label}</Text>
                      <Select
                        value={optOf(sk, o.key, o.value)}
                        options={o.choices.map((c) => ({ value: c.value, label: c.label }))}
                        onChange={(v) => setOption(sk, o.key, v)}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
        {filtered.length === 0 ? (
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{str.editor.agentSkills}</Text>
        ) : null}
      </View>
    </View>
  );
}
