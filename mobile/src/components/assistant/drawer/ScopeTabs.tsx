// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Bot, MessageSquare } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type { AssistantStrings } from "../types";
import { styles } from "./ScopeTabs.styles";

/** Scope activo de la lista de conversaciones del drawer. */
export type ConvScope = "agents" | "loose";

/** Tabs de scope del drawer (Agentes IA / Sueltos·Proyectos). Espejo del
 *  `SidebarTabs` del panel; segmentado compacto. */
export function ScopeTabs({ value, onChange, tokens, t }: {
  value: ConvScope;
  onChange: (v: ConvScope) => void;
  tokens: ThemeTokens;
  t: AssistantStrings;
}) {
  const tabs: { id: ConvScope; label: string; Icon: typeof Bot }[] = [
    { id: "agents", label: t.chatsWithAgents ?? "Agentes IA", Icon: Bot },
    { id: "loose", label: t.chatsLoose ?? "Sueltos / Proyectos", Icon: MessageSquare },
  ];
  return (
    <View style={[styles.scopeTabs, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
      {tabs.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <Pressable key={id} onPress={() => onChange(id)} style={[styles.scopeTab, active ? { backgroundColor: tokens.bgCardSolid } : null]}>
            <Icon size={13} color={active ? tokens.brand : tokens.textMuted} />
            <Text numberOfLines={1} style={[styles.scopeTabText, { color: active ? tokens.textPrimary : tokens.textMuted }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
