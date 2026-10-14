// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * RoleEditor (RN) — editor de un rol reutilizable de agente (perfil con prompt
 * base + herramientas por defecto + permiso de supervisor). Réplica nativa del
 * editor de roles de WEB/floating-assistant/AgentsTab.tsx. El `draft` lo posee el
 * padre (AgentsModule); este componente pinta y emite `onChangeDraft`.
 *
 * Exporta `DraftRole`, `emptyRole`, `roleToDraft`, `roleToPayload` (portados 1:1).
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Code, Cpu, FlaskConical, Server, Shield, Terminal, TriangleAlert, Wrench, Zap } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type { AgentRole, AgentRolePayload, AgentResolvedModule } from "../types";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { s } from "../styles";
import type { AgentsStrings } from "./agents-i18n";
import { CheckBox } from "./AgentGroupedChecklist";

// ── Draft + payload (portados 1:1 de AgentsTab.tsx) ──────────────────────────

export interface DraftRole {
  id?: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowAllTools: boolean;
  allowedTools: Set<string>;
  icon: string;
  color: string;
  canSpawnChats: boolean;
}

export function emptyRole(): DraftRole {
  return { name: "", description: "", systemPrompt: "", allowAllTools: true, allowedTools: new Set(), icon: "Shield", color: "blue", canSpawnChats: false };
}

export function roleToDraft(r: AgentRole): DraftRole {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    systemPrompt: r.systemPrompt,
    allowAllTools: r.allowedTools == null,
    allowedTools: new Set(r.allowedTools ?? []),
    icon: r.icon || "Shield",
    color: r.color || "indigo",
    canSpawnChats: Boolean(r.canSpawnChats),
  };
}

export function roleToPayload(d: DraftRole): AgentRolePayload {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    systemPrompt: d.systemPrompt,
    allowedTools: d.allowAllTools ? null : [...d.allowedTools],
    icon: d.icon,
    color: d.color,
    canSpawnChats: d.canSpawnChats,
  };
}

// Presets de icono/color (mismos valores que el web; el web pinta con LucideIcon
// + dots Tailwind — aquí mapeamos a iconos RN y hex de la paleta).
const ICON_PRESETS: Array<{ key: string; Icon: LucideIcon }> = [
  { key: "Zap", Icon: Zap },
  { key: "Wrench", Icon: Wrench },
  { key: "Terminal", Icon: Terminal },
  { key: "Shield", Icon: Shield },
  { key: "Code", Icon: Code },
  { key: "Cpu", Icon: Cpu },
  { key: "Server", Icon: Server },
  { key: "FlaskConical", Icon: FlaskConical },
];
const COLOR_PRESETS: Array<{ key: string; hex: string }> = [
  { key: "violet", hex: "#8b5cf6" },
  { key: "blue", hex: "#3b82f6" },
  { key: "emerald", hex: "#10b981" },
  { key: "amber", hex: "#f59e0b" },
  { key: "red", hex: "#ef4444" },
  { key: "slate", hex: "#64748b" },
  { key: "cyan", hex: "#06b6d4" },
  { key: "pink", hex: "#ec4899" },
];

export function RoleEditor({
  draft,
  onChangeDraft,
  modules,
  busy,
  error,
  onSave,
  onCancel,
  tokens,
  str,
}: {
  draft: DraftRole;
  onChangeDraft: (next: DraftRole) => void;
  /** Catálogo de módulos+tools para la lista de herramientas del rol. */
  modules?: AgentResolvedModule[];
  busy: boolean;
  /** Error de guardado (se pinta DENTRO del modal, no detrás en la lista). */
  error?: string | null;
  onSave: () => void;
  onCancel: () => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
}) {
  const set = (patch: Partial<DraftRole>) => onChangeDraft({ ...draft, ...patch });
  const mods = modules ?? [];

  const toolToggle = (name: string) => {
    const next = new Set(draft.allowedTools);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    set({ allowedTools: next });
  };
  const moduleToggleAll = (mod: AgentResolvedModule, on: boolean) => {
    const next = new Set(draft.allowedTools);
    for (const tool of mod.tools) {
      if (on) next.add(tool.name);
      else next.delete(tool.name);
    }
    set({ allowedTools: next });
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={s.rowBetween}>
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{draft.id ? str.roleEditor.titleEdit : str.roleEditor.titleNew}</Text>
      </View>

      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{str.roleEditor.fieldName}</Text>
        <Input value={draft.name} maxLength={120} onChangeText={(v) => set({ name: v })} placeholder={str.roleEditor.namePlaceholder} />
      </View>
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{str.roleEditor.fieldDesc}</Text>
        <Input value={draft.description} maxLength={500} onChangeText={(v) => set({ description: v })} placeholder={str.roleEditor.descPlaceholder} />
      </View>
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{str.roleEditor.fieldBasePrompt}</Text>
        <Input value={draft.systemPrompt} maxLength={20000} onChangeText={(v) => set({ systemPrompt: v })} placeholder={str.roleEditor.basePromptPlaceholder} multiline />
        <Text style={[s.toggleHint, { color: tokens.textMuted }]}>{str.roleEditor.basePromptHint}</Text>
      </View>

      {/* Icono + color */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {ICON_PRESETS.map(({ key, Icon }) => {
          const on = draft.icon === key;
          return (
            <Pressable
              key={key}
              onPress={() => set({ icon: key })}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
                borderColor: on ? tokens.brand : tokens.border,
                backgroundColor: on ? tokens.brandDim : "transparent",
              }}
            >
              <Icon size={16} color={on ? tokens.brand : tokens.textMuted} />
            </Pressable>
          );
        })}
        {COLOR_PRESETS.map(({ key, hex }) => {
          const on = draft.color === key;
          return (
            <Pressable
              key={key}
              onPress={() => set({ color: key })}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: hex,
                borderWidth: on ? 2 : 0,
                borderColor: tokens.textPrimary,
              }}
            />
          );
        })}
      </View>

      {/* Herramientas por defecto del rol */}
      <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, gap: 8 }]}>
        <Pressable onPress={() => set({ allowAllTools: !draft.allowAllTools })} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <CheckBox on={draft.allowAllTools} tokens={tokens} />
          <Text style={[s.toggleLabel, { color: tokens.textPrimary, flex: 1 }]}>{str.roleEditor.noToolLimit}</Text>
        </Pressable>
        {!draft.allowAllTools ? (
          <View style={{ gap: 10 }}>
            <Text style={[s.toggleHint, { color: tokens.textMuted }]}>{str.roleEditor.toolsDesc}</Text>
            {mods.length === 0 ? <Text style={[s.toggleHint, { color: tokens.textMuted }]}>{str.noActiveModules}</Text> : null}
            {mods.map((mod) => {
              const selected = mod.tools.filter((tool) => draft.allowedTools.has(tool.name)).length;
              const allOn = selected === mod.tools.length && mod.tools.length > 0;
              return (
                <View key={mod.moduleId} style={{ borderRadius: 10, backgroundColor: tokens.bgSecondary, padding: 9, gap: 6 }}>
                  <View style={s.rowBetween}>
                    <Text style={[s.cardDesc, { color: tokens.textPrimary, fontWeight: "700", textTransform: "capitalize" }]}>{mod.moduleId}</Text>
                    <Pressable onPress={() => moduleToggleAll(mod, !allOn)}>
                      <Text style={[s.badgeText, { color: tokens.brand }]}>{allOn ? str.removeAll : str.selectAll}</Text>
                    </Pressable>
                  </View>
                  {mod.tools.map((tool) => (
                    <Pressable key={tool.name} onPress={() => toolToggle(tool.name)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                      <CheckBox on={draft.allowedTools.has(tool.name)} tokens={tokens} />
                      <Text style={[s.cardDesc, { color: tokens.textSecondary, flex: 1 }]} numberOfLines={1}>
                        {tool.title || tool.name}
                      </Text>
                      {tool.dangerous ? <TriangleAlert size={13} color={tokens.danger} /> : null}
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Permiso del cargo: crear chats para subordinados */}
      <Pressable
        onPress={() => set({ canSpawnChats: !draft.canSpawnChats })}
        style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, flexDirection: "row", alignItems: "flex-start", gap: 8 }]}
      >
        <View style={{ paddingTop: 1 }}>
          <CheckBox on={draft.canSpawnChats} tokens={tokens} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.toggleLabel, { color: tokens.textPrimary }]}>{str.roleEditor.supervisorLabel}</Text>
          <Text style={[s.toggleHint, { color: tokens.textMuted }]}>{str.roleEditor.supervisorDesc}</Text>
        </View>
      </Pressable>

      {error ? (
        <Text style={[s.cardDesc, { color: tokens.danger }]}>{error}</Text>
      ) : null}

      <View style={s.actionsRow}>
        <Button size="sm" variant="ghost" label={str.cancel} onPress={onCancel} disabled={busy} />
        <Button
          size="sm"
          variant="primary"
          label={busy ? str.saving : draft.id ? str.saveChanges : str.roleEditor.createRole}
          loading={busy}
          disabled={busy || !draft.name.trim()}
          onPress={onSave}
        />
      </View>
    </View>
  );
}
