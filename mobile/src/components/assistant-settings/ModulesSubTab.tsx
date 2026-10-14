import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import {
  Activity,
  Archive,
  BellRing,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Folder,
  LayoutDashboard,
  Mail,
  Puzzle,
  Shield,
  ShieldAlert,
  Users,
  Webhook,
} from "lucide-react-native";
import { modulesApi } from "./agents/agents-api";
import { PROVIDER_META, PROVIDER_ORDER, ProviderIcon } from "../ProviderIcon";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { s } from "./styles";
import { LoadState } from "./parts";
import type { AgentResolvedModule, AssistantProviderId } from "./types";

type T = Messages["assistantSettings"];

// Verde esmeralda del switch activo (paridad con el resto de Config).
const SWITCH_ON_EMERALD = "#10b981";

/** Icono por módulo (lucide). Réplica aproximada del MODULE_ICONS de la web. */
const MODULE_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  admin: Shield,
  backup: Archive,
  cron: Clock,
  dashboard: LayoutDashboard,
  databases: Database,
  files: Folder,
  firewall: ShieldAlert,
  hosting: Building2,
  mail: Mail,
  monitor: Activity,
  "server-alerts": BellRing,
  users: Users,
  webhooks: Webhook,
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/**
 * Sub-tab "Módulos": catálogo de módulos del backend con sus tools (read/action),
 * paneles de datos y toggles por módulo/tool (enabled + requireConfirm). Réplica
 * nativa de `ModulesTab.tsx` de LUXIPANEL. Lee/escribe `/api/ai/modules`.
 */
export function ModulesSubTab({
  panelId,
  token,
  t,
  tokens,
}: {
  panelId: string;
  token: string;
  t: T;
  tokens: ThemeTokens;
}) {
  const m = t.modulesTab;
  const [modules, setModules] = useState<AgentResolvedModule[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedProvider, setSelectedProvider] = useState<AssistantProviderId | "">("");

  const load = React.useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    void modulesApi.list(panelId, token).then((rows) => {
      if (cancelled) return;
      setModules(rows);
      setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [panelId, token]);

  useEffect(() => load(), [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const patchModule = async (id: string, enabled: boolean) => {
    const rows = await modulesApi.setModule(panelId, token, id, enabled);
    if (rows) setModules(rows);
    else setModules((cur) => cur?.map((x) => (x.moduleId === id ? { ...x, enabled } : x)) ?? cur);
  };

  const patchTool = async (moduleId: string, toolName: string, patch: { enabled?: boolean; requireConfirm?: boolean }) => {
    const rows = await modulesApi.setTool(panelId, token, moduleId, toolName, patch);
    if (rows) setModules(rows);
    else setModules((cur) => cur?.map((x) => (x.moduleId === moduleId
      ? { ...x, tools: x.tools.map((tl) => (tl.name === toolName ? { ...tl, ...patch } : tl)) }
      : x)) ?? cur);
  };

  const providerBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: tokens.border }}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}
    >
      <ProviderPill
        label={m.all}
        active={selectedProvider === ""}
        onPress={() => setSelectedProvider("")}
        tokens={tokens}
      />
      {PROVIDER_ORDER.map((id) => (
        <ProviderPill
          key={id}
          label={PROVIDER_META[id]?.label ?? id}
          icon={<ProviderIcon id={id} size={14} color={selectedProvider === id ? "#ffffff" : tokens.textMuted} />}
          active={selectedProvider === id}
          onPress={() => setSelectedProvider(id)}
          tokens={tokens}
        />
      ))}
    </ScrollView>
  );

  if (status !== "ready" || !modules) {
    return (
      <View style={s.root}>
        {providerBar}
        <LoadState t={t} tokens={tokens} mode={status === "error" ? "error" : "loading"} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {providerBar}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} nestedScrollEnabled>
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>
          {selectedProvider ? fmt(m.providerHint, { provider: PROVIDER_META[selectedProvider]?.label ?? selectedProvider }) : m.generalHint}
        </Text>

        {modules.length === 0 ? (
          <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
            <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{m.noCapabilities}</Text>
          </View>
        ) : modules.map((mod) => {
          const isOpen = expanded.has(mod.moduleId);
          const enabledTools = mod.tools.filter((x) => x.enabled).length;
          const Icon = MODULE_ICONS[mod.moduleId] ?? Puzzle;
          const dataPanels = mod.dataPanels ?? [];
          return (
            <View
              key={mod.moduleId}
              style={[s.card, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, padding: 0, opacity: mod.enabled ? 1 : 0.7 }]}
            >
              <Pressable onPress={() => toggleExpand(mod.moduleId)} style={[s.rowBetween, { padding: 12 }]}>
                <View style={[s.cardRow, { flex: 1 }]}>
                  <View style={[s.iconBox, { backgroundColor: tokens.bgInput }]}>
                    <Icon size={18} color={tokens.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, { color: tokens.textPrimary, textTransform: "capitalize" }]}>{mod.moduleId}</Text>
                    <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={1}>
                      {fmt(mod.tools.length === 1 ? m.toolCountOne : m.toolCountOther, { count: mod.tools.length })}
                      {dataPanels.length > 0 ? fmt(m.dataPanelSuffix, { count: dataPanels.length }) : ""}
                      {mod.enabled ? fmt(m.activeSuffix, { count: enabledTools }) : ""}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Switch
                    value={mod.enabled}
                    onValueChange={(v) => void patchModule(mod.moduleId, v)}
                    trackColor={{ false: tokens.border, true: SWITCH_ON_EMERALD }}
                    thumbColor="#ffffff"
                  />
                  {isOpen ? <ChevronDown size={16} color={tokens.textMuted} /> : <ChevronRight size={16} color={tokens.textMuted} />}
                </View>
              </Pressable>

              {isOpen ? (
                <View style={{ borderTopWidth: 1, borderTopColor: tokens.border, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
                  {mod.tools.map((tool) => (
                    <ToolRow
                      key={tool.name}
                      tool={tool}
                      disabled={!mod.enabled}
                      m={m}
                      tokens={tokens}
                      onPatch={(patch) => void patchTool(mod.moduleId, tool.name, patch)}
                    />
                  ))}
                  {dataPanels.length > 0 ? (
                    <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: tokens.border, gap: 3 }}>
                      <Text style={[s.fieldLabel, { color: tokens.textMuted, marginBottom: 2 }]}>{m.dataPanelsTitle}</Text>
                      {dataPanels.map((p) => (
                        <Text key={p.name} style={[s.cardDesc, { color: tokens.textMuted }]}>
                          · {p.title} <Text style={{ opacity: 0.6 }}>— {p.description}</Text>
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ProviderPill({ label, icon, active, onPress, tokens }: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onPress: () => void;
  tokens: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: active ? tokens.brand : tokens.border,
        backgroundColor: active ? tokens.brand : tokens.bgCardSolid,
      }}
    >
      {icon}
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: active ? "#ffffff" : tokens.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

function ToolRow({ tool, disabled, m, tokens, onPatch }: {
  tool: AgentResolvedModule["tools"][number];
  disabled: boolean;
  m: T["modulesTab"];
  tokens: ThemeTokens;
  onPatch: (patch: { enabled?: boolean; requireConfirm?: boolean }) => void;
}) {
  return (
    <View style={{ opacity: disabled ? 0.5 : 1, gap: 6 }}>
      <View style={[s.rowBetween]}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={[s.rowStart, { gap: 6 }]}>
            <Text style={[s.toggleLabel, { color: tokens.textPrimary }]} numberOfLines={1}>{tool.title}</Text>
            {tool.dangerous ? (
              <View style={[s.badge, { backgroundColor: `${tokens.warning}22` }]}>
                <Text style={[s.badgeText, { color: tokens.warning }]}>{m.riskBadge}</Text>
              </View>
            ) : null}
            <View style={[s.badge, { backgroundColor: tokens.bgInput }]}>
              <Text style={[s.badgeText, { color: tokens.textMuted }]}>{tool.kind}</Text>
            </View>
          </View>
          <Text style={[s.mono, { color: tokens.textMuted }]} numberOfLines={1}>{tool.name}</Text>
        </View>
        <Switch
          value={tool.enabled}
          disabled={disabled}
          onValueChange={(v) => onPatch({ enabled: v })}
          trackColor={{ false: tokens.border, true: SWITCH_ON_EMERALD }}
          thumbColor="#ffffff"
        />
      </View>
      <Pressable
        onPress={() => { if (!disabled && tool.enabled) onPatch({ requireConfirm: !tool.requireConfirm }); }}
        disabled={disabled || !tool.enabled}
        style={[s.rowStart, { gap: 6, opacity: tool.enabled ? 1 : 0.5 }]}
      >
        <View style={{
          width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
          borderColor: tool.requireConfirm ? SWITCH_ON_EMERALD : tokens.border,
          backgroundColor: tool.requireConfirm ? SWITCH_ON_EMERALD : "transparent",
          alignItems: "center", justifyContent: "center",
        }}>
          {tool.requireConfirm ? <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", lineHeight: 13 }}>✓</Text> : null}
        </View>
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{m.confirm}</Text>
      </Pressable>
    </View>
  );
}

export default ModulesSubTab;
