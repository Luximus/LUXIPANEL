// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sub-pestañas del editor de agentes (extraídas de `AgentEditor.tsx`):
 * general | model | hierarchy | tools | resources | access. Sin estado propio
 * (el `draft` lo posee AgentsModule y fluye por props vía `set`/`onChangeDraft`).
 */
import { profileCopy } from "../agent-profiles/copy";
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Plus, Sparkles, TriangleAlert, Wand2 } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type {
  AssistantAgent,
  AgentRole,
  AgentTeam,
  AgentResolvedModule,
  AssistantProviderId,
  AssistantProject,
  AssistantSkill,
  RegisteredServerView,
} from "../types";
import { REALTIME_PROVIDERS } from "../types";
import { PROVIDER_META, PROVIDER_MODELS, PROVIDER_ORDER, ProviderIcon } from "../../ProviderIcon";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { s } from "../styles";
import { formatStr, type AgentsStrings } from "./agents-i18n";
import {
  AVATAR_COLOR_ATTRS,
  AVATAR_ENUM_ATTRS,
  avatarOptionValues,
  randomAvatarSeed,
  type AvatarAttr,
} from "./agent-avataaars";
import { AgentAvatar } from "./AgentAvatar";
import { AgentGroupedChecklist, CheckBox } from "./AgentGroupedChecklist";
import { SkillsPicker } from "./SkillsPicker";
import { groupAgentsForPicker } from "./agents-grouping";
import type { DraftAgent, SnippetFilterOptions } from "./agent-editor-draft";

// Arquetipos de ayuda-IA: al elegir uno se envía su brief al LLM que redacta el
// agente completo. Etiqueta traducida vía str.archetypes[value].
const AI_ARCHETYPES: Array<{ value: keyof AgentsStrings["archetypes"]; brief: string }> = [
  { value: "devops", brief: "Agente DevOps/SRE experto: despliegues, servicios systemd, Nginx, monitoreo de recursos y automatización segura de servidores Linux." },
  { value: "security", brief: "Auditor de seguridad: revisa configuraciones, permisos, firewall (UFW), hardening del sistema y detecta riesgos, explicando severidad y remediación." },
  { value: "dba", brief: "Administrador de bases de datos (MySQL/MariaDB y PostgreSQL): consultas, optimización, backups, restauración y mantenimiento seguro." },
  { value: "support", brief: "Asistente de soporte técnico: diagnostica problemas y guía paso a paso a usuarios no técnicos con lenguaje claro y empático." },
  { value: "nginx", brief: "Administrador web/Nginx: virtual hosts, reverse proxy, certificados SSL/TLS, dominios, rendimiento y resolución de errores 5xx." },
  { value: "backups", brief: "Especialista en backups: estrategias de respaldo programado, cifrado, múltiples destinos, verificación de integridad y restauración guiada." },
  { value: "logs", brief: "Analista de logs e incidencias: investiga errores, correlaciona eventos del sistema y servicios, y resume causas y acciones." },
  { value: "automation", brief: "Ingeniero de automatización: diseña tareas cron y scripts seguros, idempotentes y con notificaciones de resultado." },
];

// ── Sub-componentes reutilizables ────────────────────────────────────────────

function SectionCard({ tokens, children }: { tokens: ThemeTokens; children: React.ReactNode }) {
  return (
    <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, gap: 8 }]}>{children}</View>
  );
}

function Label({ text, tokens }: { text: string; tokens: ThemeTokens }) {
  return <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{text}</Text>;
}

function Hint({ text, tokens }: { text: string; tokens: ThemeTokens }) {
  return <Text style={[s.toggleHint, { color: tokens.textMuted }]}>{text}</Text>;
}

function CheckRow({
  on,
  label,
  desc,
  onPress,
  tokens,
}: {
  on: boolean;
  label: string;
  desc?: string;
  onPress: () => void;
  tokens: ThemeTokens;
}) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 4 }}>
      <View style={{ paddingTop: 1 }}>
        <CheckBox on={on} tokens={tokens} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.toggleLabel, { color: tokens.textPrimary }]}>{label}</Text>
        {desc ? <Hint text={desc} tokens={tokens} /> : null}
      </View>
    </Pressable>
  );
}

// ── General ──────────────────────────────────────────────────────────────────

export function GeneralTab({
  draft,
  set,
  onChangeDraft,
  tokens,
  str,
  onSuggest,
  suggesting,
  aiOpen,
  setAiOpen,
  runSuggest,
  language,
}: {
  draft: DraftAgent;
  set: (p: Partial<DraftAgent>) => void;
  onChangeDraft: (d: DraftAgent) => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
  onSuggest?: unknown;
  suggesting: boolean;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  runSuggest: (brief: string) => void;
  language: string;
}) {
  const labels = profileCopy(language);
  const avatarAttrs = [...AVATAR_ENUM_ATTRS, ...AVATAR_COLOR_ATTRS] as AvatarAttr[];
  return (
    <View style={{ gap: 12 }}>
      {onSuggest ? (
        <View style={[s.card, { backgroundColor: tokens.brandDim, borderColor: tokens.borderBrand, gap: 8 }]}>
          <Pressable onPress={() => setAiOpen(!aiOpen)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={tokens.brand} />
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.editor.aiHelpTitle}</Text>
              <Hint text={str.editor.aiHelpDesc} tokens={tokens} />
            </View>
          </Pressable>
          {aiOpen ? (
            <View style={{ gap: 8 }}>
              <Select
                value=""
                placeholder={str.editor.aiHelpSelect}
                options={AI_ARCHETYPES.map((a) => ({ value: a.value, label: str.archetypes[a.value] }))}
                onChange={(v) => {
                  const arch = AI_ARCHETYPES.find((a) => a.value === v);
                  if (arch) runSuggest(arch.brief);
                }}
              />
              {draft.description.trim() ? (
                <Button
                  size="sm"
                  variant="ghost"
                  label={str.editor.aiHelpFromDesc}
                  icon={<Wand2 size={14} color={tokens.brand} />}
                  disabled={suggesting}
                  onPress={() => runSuggest(draft.description.trim())}
                />
              ) : null}
              {suggesting ? <Hint text={str.editor.aiHelpGenerating} tokens={tokens} /> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Avatar */}
      <View style={{ gap: 8 }}>
        <Label text={str.editor.fieldAvatar} tokens={tokens} />
        <View style={{ alignItems: "center", gap: 6 }}>
          <AgentAvatar config={draft.avatarConfig} seed={draft.id ?? "new-agent"} size={64} tokens={tokens} />
          <Button
            size="sm"
            variant="ghost"
            label={`🎲 ${str.editor.avatarRandomize}`}
            onPress={() => set({ avatarConfig: { seed: randomAvatarSeed() } })}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {avatarAttrs.map((attr) => (
            <View key={attr} style={{ flexBasis: "47%", flexGrow: 1, gap: 3 }}>
              <Text style={[s.toggleHint, { color: tokens.textMuted }]}>{str.editor.avatarAttrs[attr]}</Text>
              <Select
                value={draft.avatarConfig[attr] ?? ""}
                options={[
                  { value: "", label: str.editor.avatarAuto },
                  ...avatarOptionValues(attr).map((v) => ({ value: v, label: v })),
                ]}
                onChange={(v) =>
                  onChangeDraft({ ...draft, avatarConfig: { ...draft.avatarConfig, [attr]: v || undefined } })
                }
              />
            </View>
          ))}
        </View>
      </View>

      <View style={s.field}>
        <Label text={str.editor.fieldName} tokens={tokens} />
        <Input value={draft.name} maxLength={120} onChangeText={(v) => set({ name: v })} placeholder={str.editor.namePlaceholder} />
      </View>
      <View style={s.field}>
        <Label text={str.editor.fieldDescription} tokens={tokens} />
        <Input value={draft.description} maxLength={500} onChangeText={(v) => set({ description: v })} placeholder={str.editor.descPlaceholder} />
      </View>
      <Input label={labels.specialty} value={draft.specialty} maxLength={200} onChangeText={specialty => set({ specialty })} />
      <Input label={labels.technologies} defaultValue={draft.technologies.join(", ")} onEndEditing={e => set({ technologies: e.nativeEvent.text.split(",").map(s => s.trim()).filter(Boolean) })} />
      <Input label={labels.knowledge} value={draft.knowledge} multiline maxLength={12000} onChangeText={knowledge => set({ knowledge })} />
      <View style={s.field}>
        <Label text={str.editor.fieldSystemPrompt} tokens={tokens} />
        <Input value={draft.systemPrompt} maxLength={20000} onChangeText={(v) => set({ systemPrompt: v })} placeholder={str.editor.systemPromptPlaceholder} multiline />
      </View>
    </View>
  );
}

// ── Model ────────────────────────────────────────────────────────────────────

export function ModelTab({
  draft,
  set,
  tokens,
  str,
}: {
  draft: DraftAgent;
  set: (p: Partial<DraftAgent>) => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
}) {
  const models = PROVIDER_MODELS[draft.providerId] ?? [];
  const modelOptions = [
    { value: "", label: str.editor.modelPlaceholder },
    ...(draft.model && !models.includes(draft.model) ? [{ value: draft.model, label: draft.model }] : []),
    ...models.map((m) => ({ value: m, label: m })),
  ];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={[s.field, { flex: 1 }]}>
          <Label text={str.editor.fieldProvider} tokens={tokens} />
          <Select
            value={draft.providerId}
            options={PROVIDER_ORDER.map((id) => ({ value: id, label: PROVIDER_META[id]?.label ?? id }))}
            onChange={(v) => {
              const pid = v as AssistantProviderId;
              const keepModel = (PROVIDER_MODELS[pid] ?? []).includes(draft.model);
              set({
                providerId: pid,
                model: keepModel ? draft.model : "",
                realtime: REALTIME_PROVIDERS.includes(pid) ? draft.realtime : false,
              });
            }}
          />
        </View>
        <View style={[s.field, { flex: 1 }]}>
          <Label text={str.editor.fieldModel} tokens={tokens} />
          <Select value={draft.model} placeholder={str.editor.modelPlaceholder} options={modelOptions} onChange={(v) => set({ model: v })} />
        </View>
      </View>

      {/* Multi-agente + multi-proveedor */}
      <SectionCard tokens={tokens}>
        <CheckRow
          on={draft.agentMode === "multi"}
          label={str.editor.multiAgentLabel}
          onPress={() => set({ agentMode: draft.agentMode === "multi" ? "single" : "multi" })}
          tokens={tokens}
        />
        {draft.agentMode === "multi" ? (
          <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: tokens.border, paddingTop: 8 }}>
            <Text style={[s.toggleHint, { color: tokens.textMuted }]}>
              {str.editor.multiAgentDescPre}
              <Text style={{ fontWeight: "700" }}>{str.editor.multiAgentDescBold}</Text>
              {str.editor.multiAgentDescPost}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={[s.toggleLabel, { color: tokens.textPrimary }]}>{str.editor.multiAgentCopies}</Text>
              <View style={{ width: 70 }}>
                <Input
                  value={String(draft.multiAgentCount)}
                  keyboardType="number-pad"
                  onChangeText={(v) => {
                    const n = Math.max(2, Math.min(8, Math.round(Number(v) || 3)));
                    set({ multiAgentCount: n });
                  }}
                />
              </View>
              <Text style={[s.toggleHint, { color: tokens.textMuted }]}>{str.editor.multiAgentCopiesHint}</Text>
            </View>
            <Text style={[s.toggleHint, { color: tokens.textMuted }]}>
              {str.editor.multiAgentProvidersPre}
              <Text style={{ fontWeight: "700" }}>{draft.providerId}</Text>
              {str.editor.multiAgentProvidersPost}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PROVIDER_ORDER.filter((p) => p !== draft.providerId).map((p) => {
                const on = draft.providerIds.includes(p);
                return (
                  <Pressable
                    key={p}
                    onPress={() =>
                      set({
                        providerIds: on ? draft.providerIds.filter((x) => x !== p) : [...draft.providerIds, p],
                      })
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderColor: on ? tokens.brand : tokens.border,
                      backgroundColor: on ? tokens.brandDim : "transparent",
                    }}
                  >
                    <CheckBox on={on} tokens={tokens} />
                    <ProviderIcon id={p} size={12} color={tokens.textSecondary} />
                    <Text style={[s.badgeText, { color: tokens.textSecondary, textTransform: "capitalize" }]}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Hint text={str.editor.multiAgentApiHint} tokens={tokens} />
          </View>
        ) : null}
      </SectionCard>
    </View>
  );
}

// ── Hierarchy ────────────────────────────────────────────────────────────────

export function HierarchyTab({
  draft,
  set,
  agents,
  roles,
  teams,
  teamsById,
  tokens,
  str,
  onCreateTeam,
}: {
  draft: DraftAgent;
  set: (p: Partial<DraftAgent>) => void;
  agents: AssistantAgent[];
  roles: AgentRole[];
  teams: AgentTeam[];
  teamsById: Map<string, AgentTeam>;
  tokens: ThemeTokens;
  str: AgentsStrings;
  onCreateTeam: () => void;
}) {
  const otherAgents = agents.filter((a) => a.id !== draft.id);

  // Excluir descendientes del selector "superior" para no formar ciclos.
  const descendantIds = new Set<string>();
  if (draft.id) {
    const childrenOf = new Map<string, string[]>();
    for (const a of agents) {
      if (a.parentAgentId) {
        const arr = childrenOf.get(a.parentAgentId) ?? [];
        arr.push(a.id);
        childrenOf.set(a.parentAgentId, arr);
      }
    }
    const stack = [draft.id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const ch of childrenOf.get(cur) ?? []) {
        if (!descendantIds.has(ch)) {
          descendantIds.add(ch);
          stack.push(ch);
        }
      }
    }
  }
  const superiorOptions = otherAgents.filter((a) => !descendantIds.has(a.id));
  const superiorGroups = groupAgentsForPicker(superiorOptions, teamsById);
  const parentOptions = [
    { value: "", label: str.editor.parentNone },
    ...superiorGroups.flatMap((g) =>
      g.agents.map((a) => ({
        value: a.id,
        label: `${g.key === "General" ? str.list.noRoleGroupTitle : g.label} · ${a.name}`,
      })),
    ),
  ];

  return (
    <View style={{ gap: 12 }}>
      <SectionCard tokens={tokens}>
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.editor.roleHeading}</Text>

        <View style={s.field}>
          <Label text={str.editor.roleAssigned} tokens={tokens} />
          <Select
            value={draft.roleId ?? ""}
            options={[{ value: "", label: str.editor.roleNone }, ...roles.map((r) => ({ value: r.id, label: r.name }))]}
            onChange={(v) => set({ roleId: v || null })}
          />
          <Hint text={str.editor.roleHint} tokens={tokens} />
        </View>

        <View style={s.field}>
          <Label text={`${str.teams.teamSelectorLabel} *`} tokens={tokens} />
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View
              style={{
                flex: 1,
                borderWidth: draft.teamId ? 0 : 1,
                borderRadius: 10,
                borderColor: tokens.danger,
              }}
            >
              <Select
                value={draft.teamId ?? ""}
                placeholder={str.teams.teamSelectorPlaceholder}
                options={[
                  { value: "", label: str.teams.teamSelectorPlaceholder },
                  ...teams.map((tm) => ({ value: tm.id, label: tm.name })),
                ]}
                onChange={(v) => set({ teamId: v || null })}
              />
            </View>
            <Button size="sm" variant="ghost" label={str.teams.newTeamBtn} icon={<Plus size={14} color={tokens.brand} />} onPress={onCreateTeam} />
          </View>
        </View>

        <View style={s.field}>
          <Label text={str.editor.parentAgent} tokens={tokens} />
          <Select value={draft.parentAgentId ?? ""} options={parentOptions} onChange={(v) => set({ parentAgentId: v || null })} />
          <Hint text={`${str.editor.parentHintPre}${str.editor.parentHintBold}${str.editor.parentHintPost}`} tokens={tokens} />
        </View>

        <View style={s.field}>
          <Label text={str.editor.connectionsLabel} tokens={tokens} />
          <AgentGroupedChecklist
            agents={agents}
            excludeId={draft.id}
            teams={teams}
            selectedIds={draft.connections}
            onToggle={(id) => {
              const on = draft.connections.includes(id);
              set({ connections: on ? draft.connections.filter((x) => x !== id) : [...draft.connections, id] });
            }}
            tokens={tokens}
            str={str}
          />
          <Hint text={str.editor.connectionsHint} tokens={tokens} />
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: tokens.border, paddingTop: 8 }}>
          <CheckRow
            on={draft.canSpawnChats}
            label={str.editor.supervisorLabel}
            desc={str.editor.supervisorDesc}
            onPress={() => set({ canSpawnChats: !draft.canSpawnChats })}
            tokens={tokens}
          />
        </View>
      </SectionCard>
    </View>
  );
}

// ── Tools ────────────────────────────────────────────────────────────────────

export function ToolsTab({
  draft,
  set,
  modules,
  tokens,
  str,
}: {
  draft: DraftAgent;
  set: (p: Partial<DraftAgent>) => void;
  modules: AgentResolvedModule[];
  tokens: ThemeTokens;
  str: AgentsStrings;
}) {
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
    <SectionCard tokens={tokens}>
      <CheckRow on={draft.allowAllTools} label={str.editor.allowAllTools} onPress={() => set({ allowAllTools: !draft.allowAllTools })} tokens={tokens} />
      {!draft.allowAllTools ? (
        <View style={{ gap: 10 }}>
          <Hint text={str.editor.toolsDesc} tokens={tokens} />
          {modules.length === 0 ? <Hint text={str.noActiveModules} tokens={tokens} /> : null}
          {modules.map((mod) => {
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
                  <Pressable
                    key={tool.name}
                    onPress={() => toolToggle(tool.name)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}
                  >
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
    </SectionCard>
  );
}

// ── Resources ────────────────────────────────────────────────────────────────

function TriBox({ state, tokens }: { state: "on" | "off" | "partial"; tokens: ThemeTokens }) {
  if (state === "partial") {
    return (
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          borderWidth: 1.5,
          alignItems: "center",
          justifyContent: "center",
          borderColor: tokens.brand,
          backgroundColor: "transparent",
        }}
      >
        <View style={{ width: 9, height: 2, borderRadius: 1, backgroundColor: tokens.brand }} />
      </View>
    );
  }
  return <CheckBox on={state === "on"} tokens={tokens} />;
}

export function ResourcesTab({
  draft,
  set,
  onChangeDraft,
  projects,
  skills,
  snippetOptions,
  tokens,
  str,
  privateProject = false,
}: {
  draft: DraftAgent;
  set: (p: Partial<DraftAgent>) => void;
  onChangeDraft: (d: DraftAgent) => void;
  projects: AssistantProject[];
  skills: AssistantSkill[];
  snippetOptions: SnippetFilterOptions | null;
  tokens: ThemeTokens;
  str: AgentsStrings;
  privateProject?: boolean;
}) {
  const projectChildren = useMemo(() => {
    const m = new Map<string, AssistantProject[]>();
    for (const p of projects) {
      if (!p.parentId) continue;
      const arr = m.get(p.parentId) ?? [];
      arr.push(p);
      m.set(p.parentId, arr);
    }
    return m;
  }, [projects]);

  const subtreeIds = (p: AssistantProject): string[] => [p.id, ...(projectChildren.get(p.id) ?? []).flatMap(subtreeIds)];

  const projectToggle = (p: AssistantProject) => {
    const ids = subtreeIds(p);
    const all = ids.every((id) => draft.projectIds.includes(id));
    const next = all
      ? draft.projectIds.filter((id) => !ids.includes(id))
      : [...new Set([...draft.projectIds, ...ids])];
    set({ projectIds: next });
  };

  const renderProjectNode = (p: AssistantProject, depth: number): React.ReactNode => {
    const ids = subtreeIds(p);
    const all = ids.every((id) => draft.projectIds.includes(id));
    const some = !all && ids.some((id) => draft.projectIds.includes(id));
    const kids = projectChildren.get(p.id) ?? [];
    return (
      <View key={p.id} style={{ gap: 4 }}>
        <Pressable
          onPress={() => projectToggle(p)}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingLeft: depth * 16 }}
        >
          <TriBox state={all ? "on" : some ? "partial" : "off"} tokens={tokens} />
          <Text style={[s.cardDesc, { color: tokens.textSecondary, flex: 1 }]} numberOfLines={1}>
            {p.title}
          </Text>
        </Pressable>
        {kids.map((c) => renderProjectNode(c, depth + 1))}
      </View>
    );
  };

  const indexedProjects = projects.filter((p) => p.graphIndex?.status === "ready");
  const rootProjects = projects.filter((p) => !p.parentId);

  // Snippets: categoría + tags.
  const snOk = !!snippetOptions?.ok;
  const cat = snippetOptions?.categories.find((c) => c.name === draft.snippetCategory);
  const catTags = cat ? (snippetOptions?.tags ?? []).filter((tg) => tg.categoryId === cat.id) : [];
  const knownNames = new Set(catTags.map((tg) => tg.name));
  const orphanTags = draft.snippetTags.filter((n) => !knownNames.has(n));
  const toggleTag = (name: string) =>
    set({
      snippetTags: draft.snippetTags.includes(name)
        ? draft.snippetTags.filter((n) => n !== name)
        : [...draft.snippetTags, name],
    });
  const savedCatMissing =
    !!draft.snippetCategory && !(snippetOptions?.categories ?? []).some((c) => c.name === draft.snippetCategory);
  const categoryOptions = [
    { value: "", label: str.editor.snippetsCategoryNone },
    ...(savedCatMissing ? [{ value: draft.snippetCategory, label: draft.snippetCategory }] : []),
    ...(snippetOptions?.categories ?? []).map((c) => ({ value: c.name, label: c.name })),
  ];

  return (
    <View style={{ gap: 12 }}>
      {/* Proyectos adjuntos */}
      <SectionCard tokens={tokens}>
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.editor.attachedProjects}</Text>
        <Hint text={str.editor.attachedProjectsDesc} tokens={tokens} />
        {!privateProject && rootProjects.length === 0 ? <Hint text={str.editor.noParentProjects} tokens={tokens} /> : null}
        {privateProject ? <Text style={{ color: tokens.textPrimary }}>{projects.filter(p => draft.projectIds.includes(p.id)).map(p => p.title).join(" · ")}</Text> : rootProjects.map((p) => renderProjectNode(p, 0))}
        <View style={{ borderTopWidth: 1, borderTopColor: tokens.border, paddingTop: 8 }}>
          <CheckRow on={draft.autoCapture} label={str.editor.saveObsidian} onPress={() => set({ autoCapture: !draft.autoCapture })} tokens={tokens} />
        </View>
      </SectionCard>

      {/* Snippets de terminal */}
      <SectionCard tokens={tokens}>
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.editor.snippetsSection}</Text>
        <Hint text={str.editor.snippetsHelp} tokens={tokens} />
        {snippetOptions !== null && !snippetOptions.ok ? (
          <Text style={[s.toggleHint, { color: tokens.danger }]}>{str.editor.snippetsNoAccess}</Text>
        ) : null}
        <View style={s.field}>
          <Label text={str.editor.snippetsCategoryLabel} tokens={tokens} />
          {snOk ? (
            <Select
              value={draft.snippetCategory}
              options={categoryOptions}
              onChange={(name) => onChangeDraft({ ...draft, snippetCategory: name, snippetTags: [] })}
            />
          ) : (
            <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{draft.snippetCategory || str.editor.snippetsCategoryNone}</Text>
          )}
        </View>
        {snOk && draft.snippetCategory ? (
          <View style={s.field}>
            <Label text={str.editor.snippetsTagsLabel} tokens={tokens} />
            {catTags.length === 0 && orphanTags.length === 0 ? (
              <Hint text={str.editor.snippetsNoTags} tokens={tokens} />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {[
                  ...orphanTags.map((name) => ({ key: `orphan:${name}`, name })),
                  ...catTags.map((tg) => ({ key: String(tg.id), name: tg.name })),
                ].map((tg) => {
                  const on = draft.snippetTags.includes(tg.name);
                  return (
                    <Pressable
                      key={tg.key}
                      onPress={() => toggleTag(tg.name)}
                      style={{
                        borderWidth: 1,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderColor: on ? tokens.brand : tokens.border,
                        backgroundColor: on ? tokens.brandDim : "transparent",
                      }}
                    >
                      <Text style={[s.badgeText, { color: on ? tokens.brand : tokens.textMuted }]}>{tg.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </SectionCard>

      {/* Índices de grafo de código */}
      <SectionCard tokens={tokens}>
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.editor.graphIndexesTitle}</Text>
        <Hint text={str.editor.graphIndexesDesc} tokens={tokens} />
        {indexedProjects.length === 0 ? <Hint text={str.editor.graphIndexesEmpty} tokens={tokens} /> : null}
        {indexedProjects.map((p) => {
          const on = draft.graphProjectIds.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() =>
                set({
                  graphProjectIds: on ? draft.graphProjectIds.filter((x) => x !== p.id) : [...draft.graphProjectIds, p.id],
                })
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}
            >
              <CheckBox on={on} tokens={tokens} />
              <Text style={[s.cardDesc, { color: tokens.textSecondary, flex: 1 }]} numberOfLines={1}>
                {p.title}
              </Text>
              {p.graphIndex?.project ? (
                <View style={[s.badge, { backgroundColor: tokens.bgInput }]}>
                  <Text style={[s.mono, { color: tokens.textMuted }]}>
                    {p.graphIndex.project}
                    {p.graphIndex.nodes != null ? ` · ${p.graphIndex.nodes}n/${p.graphIndex.edges ?? 0}e` : ""}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </SectionCard>

      {/* Skills del agente */}
      <SectionCard tokens={tokens}>
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.editor.agentSkills}</Text>
        <SkillsPicker skills={skills} value={draft.skills} onChange={(skillsMap) => set({ skills: skillsMap })} tokens={tokens} str={str} />
      </SectionCard>
    </View>
  );
}

// ── Access ───────────────────────────────────────────────────────────────────

export function AccessTab({
  draft,
  set,
  servers,
  tokens,
  str,
}: {
  draft: DraftAgent;
  set: (p: Partial<DraftAgent>) => void;
  servers: RegisteredServerView[];
  tokens: ThemeTokens;
  str: AgentsStrings;
}) {
  return (
    <View style={{ gap: 12 }}>
      {/* Servidores asociados */}
      <SectionCard tokens={tokens}>
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.editor.associatedServers}</Text>
        {servers.length === 0 ? <Hint text={str.editor.serversEmpty} tokens={tokens} /> : null}
        {servers.map((c) => {
          const on = draft.servers.some((sv) => sv.id === c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() =>
                set({
                  servers: on
                    ? draft.servers.filter((sv) => sv.id !== c.id)
                    : [...draft.servers, { id: c.id, name: c.name, host: c.host }],
                })
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}
            >
              <CheckBox on={on} tokens={tokens} />
              <Text style={[s.cardDesc, { color: tokens.textSecondary, flex: 1 }]} numberOfLines={1}>
                {c.name}
                {c.host ? <Text style={{ color: tokens.textMuted }}>{` · ${c.host}`}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </SectionCard>

      {/* Credenciales de acceso */}
      <SectionCard tokens={tokens}>
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.editor.credentialTitle}</Text>
        <Hint text={str.editor.credentialHint} tokens={tokens} />
        <View style={{ borderWidth: 1, borderRadius: 8, borderColor: tokens.danger, padding: 8, flexDirection: "row", gap: 6 }}>
          <TriangleAlert size={14} color={tokens.danger} />
          <Text style={[s.toggleHint, { color: tokens.danger, flex: 1 }]}>{str.editor.credentialWarn2fa}</Text>
        </View>

        {draft.credentialSaved && !draft.credentialClear && !draft.credentialInput ? (
          <View style={{ gap: 8 }}>
            <View style={[s.badge, { backgroundColor: tokens.bgSecondary, paddingHorizontal: 9, paddingVertical: 6, alignSelf: "flex-start" }]}>
              <Text style={[s.mono, { color: tokens.textSecondary }]}>
                {formatStr(str.editor.credentialSet, { user: draft.credentialSaved.username })}
                {draft.credentialSaved.label ? ` · ${draft.credentialSaved.label}` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                size="sm"
                variant="ghost"
                label={str.editor.credentialReplace}
                onPress={() =>
                  set({
                    credentialInput: {
                      label: draft.credentialSaved?.label ?? "",
                      username: draft.credentialSaved?.username ?? "",
                      secret: "",
                    },
                  })
                }
              />
              <Button
                size="sm"
                variant="ghost"
                label={str.editor.credentialRemove}
                icon={<TriangleAlert size={13} color={tokens.danger} />}
                onPress={() => set({ credentialClear: true, credentialInput: null })}
              />
            </View>
          </View>
        ) : draft.credentialClear ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[s.cardDesc, { color: tokens.textMuted, flex: 1 }]}>{str.editor.credentialRemoved}</Text>
            <Button size="sm" variant="ghost" label={str.editor.credentialCancel} onPress={() => set({ credentialClear: false })} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Input
              value={draft.credentialInput?.username ?? ""}
              placeholder={str.editor.credentialUser}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(v) =>
                set({
                  credentialInput: {
                    label: draft.credentialInput?.label ?? "",
                    username: v,
                    secret: draft.credentialInput?.secret ?? "",
                  },
                })
              }
            />
            <Input
              value={draft.credentialInput?.secret ?? ""}
              placeholder={str.editor.credentialPass}
              secureTextEntry
              secureToggle
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(v) =>
                set({
                  credentialInput: {
                    label: draft.credentialInput?.label ?? "",
                    username: draft.credentialInput?.username ?? "",
                    secret: v,
                  },
                })
              }
            />
            <Input
              value={draft.credentialInput?.label ?? ""}
              placeholder={str.editor.credentialLabel}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(v) =>
                set({
                  credentialInput: {
                    label: v,
                    username: draft.credentialInput?.username ?? "",
                    secret: draft.credentialInput?.secret ?? "",
                  },
                })
              }
            />
            {draft.credentialSaved ? (
              <Button size="sm" variant="ghost" label={str.editor.credentialCancel} onPress={() => set({ credentialInput: null })} />
            ) : null}
          </View>
        )}
      </SectionCard>
    </View>
  );
}
