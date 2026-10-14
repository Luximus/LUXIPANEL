import { CredentialsLink } from "../../workspace/credentials/CredentialsLink";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { type ReactNode } from "react";
import {
  agentGroupBucket,
  assistantAgentTeamsApi,
  groupAgentsForPicker,
  PROVIDER_ORDER,
  PROVIDER_META,
  PROVIDER_MODELS,
  REALTIME_PROVIDERS,
  type AssistantProject,
  type AssistantProviderId,
  type ResolvedModule,
} from "../assistant-api";
import { TeamEditModal } from "../TeamEditModal";
import {
  AVATAR_COLOR_ATTRS,
  AVATAR_ENUM_ATTRS,
  agentAvatarUri,
  avatarOptionValues,
  randomAvatarSeed,
  type AvatarAttr,
} from "../agent-avataaars";
import { ProviderIcon } from "../ProviderIcon";
import { LucideIcon } from "../LucideIcon";
import { SkillsPicker } from "../SkillsPicker";
import { CollapsibleSection } from "../CollapsibleSection";
import { AgentGroupedChecklist } from "../AgentGroupedChecklist";
import { formatAssistantMessage } from "../i18n";
import { AI_ARCHETYPES } from "./constants";
import { toDraft } from "./draft";
import type { AgentsTabVM } from "./use-agents-tab";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";

const EDITOR_TAB_ORDER = ["general", "model", "hierarchy", "tools", "resources", "access"] as const;

export function AgentEditor({ vm }: { vm: AgentsTabVM }) {
  const { onLaunchAgent, locale, initialEditAgentId, t, agents, setAgents, loading, setLoading, error, setError, draft, setDraft, editorTab, setEditorTab, saving, setSaving, modules, setModules, suggesting, setSuggesting, suggestArchetype, setSuggestArchetype, projects, setProjects, conns, setConns, snippetOpts, setSnippetOpts, roles, setRoles, teams, setTeams, teamDraft, setTeamDraft, teamAddCtx, setTeamAddCtx, showRoles, setShowRoles, showTree, setShowTree, showTemplates, setShowTemplates, treeTeamId, setTreeTeamId, creatingTeamForDraft, setCreatingTeamForDraft, treeRegen, setTreeRegen, regenBusy, setRegenBusy, roleDraft, setRoleDraft, resyncCtx, setResyncCtx, resyncResult, setResyncResult, resyncSelected, setResyncSelected, resyncApplying, setResyncApplying, resyncError, setResyncError, groupPendingDelete, setGroupPendingDelete, deletingGroup, setDeletingGroup, openGroupKey, setOpenGroupKey, initialEditConsumed, modelOptions, effectiveTreeTeamId, treeAgents, treeCode, treeImages, teamsById, agentGroups, setFooterAction, setHeaderOverride, openResync, confirmResync, reload, regenerateTree, reloadRoles, saveRole, removeRole, runSuggest, save, remove, removeFromTeam, deleteTeam, onTeamMutated, removeGroup, duplicate } = vm;
  // Dirección de la transición entre tabs del editor (orden de la barra).
  const editorTabDirection = useViewDirection(editorTab, EDITOR_TAB_ORDER);
  if (!draft) return null;
    const toolToggle = (name: string) => {
      setDraft((d) => {
        if (!d) return d;
        const next = new Set(d.allowedTools);
        if (next.has(name)) next.delete(name); else next.add(name);
        return { ...d, allowedTools: next };
      });
    };
    const moduleToggleAll = (mod: ResolvedModule, on: boolean) => {
      setDraft((d) => {
        if (!d) return d;
        const next = new Set(d.allowedTools);
        for (const t of mod.tools) { if (on) next.add(t.name); else next.delete(t.name); }
        return { ...d, allowedTools: next };
      });
    };
    // Hierarchy/connection options: every OTHER agent; the "superior" list also
    // excludes this agent's descendants so the parent chain can't form a cycle.
    const otherAgents = agents.filter((a) => a.id !== draft.id);
    const descendantIds = new Set<string>();
    if (draft.id) {
      const childrenOf = new Map<string, string[]>();
      for (const a of agents) if (a.parentAgentId) {
        const arr = childrenOf.get(a.parentAgentId) ?? [];
        arr.push(a.id);
        childrenOf.set(a.parentAgentId, arr);
      }
      const stack = [draft.id];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const ch of childrenOf.get(cur) ?? []) if (!descendantIds.has(ch)) { descendantIds.add(ch); stack.push(ch); }
      }
    }
    const superiorOptions = otherAgents.filter((a) => !descendantIds.has(a.id));
    // Group the two hierarchy pickers by team (+ trailing "Sueltos" bucket) via
    // the SAME buckets as the main list, so 24 agents stay manageable. Sections
    // start expanded when they hold something relevant (a checked connection, or
    // the team of the agent being edited); collapsed otherwise.
    const connectionGroups = groupAgentsForPicker(otherAgents, teamsById);
    const superiorGroups = groupAgentsForPicker(superiorOptions, teamsById);
    const selfBucketKey = agentGroupBucket({ name: draft.name, teamId: draft.teamId }, teamsById).key;
    const connectionOpenKeys = new Set<string>();
    for (const g of connectionGroups) {
      if (g.key === selfBucketKey || g.agents.some((a) => draft.connections.includes(a.id))) {
        connectionOpenKeys.add(g.key);
      }
    }
    // Árbol de proyectos adjuntos: hijos indexados por parentId; marcar un
    // padre selecciona/deselecciona TODO su subárbol (el agente usa las rutas
    // de trabajo de los proyectos seleccionados — ya no hay rutas manuales).
    const projectChildren = new Map<string, AssistantProject[]>();
    for (const p of projects) {
      if (!p.parentId) continue;
      const arr = projectChildren.get(p.parentId) ?? [];
      arr.push(p);
      projectChildren.set(p.parentId, arr);
    }
    const subtreeIds = (p: AssistantProject): string[] => [
      p.id,
      ...(projectChildren.get(p.id) ?? []).flatMap(subtreeIds),
    ];
    const projectToggle = (p: AssistantProject) => {
      setDraft((d) => {
        if (!d) return d;
        const ids = subtreeIds(p);
        const all = ids.every((id) => d.projectIds.includes(id));
        const next = all
          ? d.projectIds.filter((id) => !ids.includes(id))
          : [...new Set([...d.projectIds, ...ids])];
        return { ...d, projectIds: next };
      });
    };
    const renderProjectNode = (p: AssistantProject, depth: number): ReactNode => {
      const ids = subtreeIds(p);
      const all = ids.every((id) => draft.projectIds.includes(id));
      const some = !all && ids.some((id) => draft.projectIds.includes(id));
      const kids = projectChildren.get(p.id) ?? [];
      return (
        <div key={p.id} className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground" style={{ paddingLeft: depth * 16 }}>
            <input
              type="checkbox"
              checked={all}
              ref={(el) => { if (el) el.indeterminate = some; }}
              onChange={() => projectToggle(p)}
            />
            <LucideIcon name={p.icon} size={12} />
            <span className="truncate">{p.title}</span>
          </label>
          {kids.map((c) => renderProjectNode(c, depth + 1))}
        </div>
      );
    };
    // Proyectos con índice del grafo de código LISTO (selector de índices).
    const indexedProjects = projects.filter((p) => p.graphIndex?.status === "ready");
    return (
      <div className="flex flex-col gap-4 p-4">
        {/* El título/descripción del formulario (crear vs editar) y el único
            camino de regreso viven en el header del modal (SettingsHeaderContext,
            publicado por el efecto de arriba). Sin header interno duplicado. */}

        {/* Pestañas — el formulario del agente se reparte en grupos enfocados */}
        <div className="-mt-1 flex flex-wrap gap-1 border-b border-border">
          <EditorTabBtn active={editorTab === "general"} onClick={() => setEditorTab("general")} icon="ti-id-badge-2">{t.editor.tabGeneral}</EditorTabBtn>
          <EditorTabBtn active={editorTab === "model"} onClick={() => setEditorTab("model")} icon="ti-cpu">{t.editor.tabModel}</EditorTabBtn>
          <EditorTabBtn active={editorTab === "hierarchy"} onClick={() => setEditorTab("hierarchy")} icon="ti-hierarchy-2">{t.editor.tabHierarchy}</EditorTabBtn>
          <EditorTabBtn active={editorTab === "tools"} onClick={() => setEditorTab("tools")} icon="ti-tool">{t.editor.tabTools}</EditorTabBtn>
          <EditorTabBtn active={editorTab === "resources"} onClick={() => setEditorTab("resources")} icon="ti-folders">{t.editor.tabResources}</EditorTabBtn>
          <EditorTabBtn active={editorTab === "access"} onClick={() => setEditorTab("access")} icon="ti-key">{t.editor.tabAccess}</EditorTabBtn>
        </div>

        {/* Contenido del tab activo con la transición de vista del panel
            (motion.css): remontado por tab, direccional según el orden. */}
        <ViewTransition viewKey={editorTab} direction={editorTabDirection} className="flex flex-col gap-4">
        {editorTab === "general" && (<>
        {/* Ayuda de IA: bloque colapsable (colapsado por defecto) que redacta el
            agente con IA a partir de un arquetipo o la descripción actual. */}
        <CollapsibleSection
          className="border-violet-400/40 bg-violet-500/5"
          icon={<i className="ti ti-sparkles text-lg text-violet-500" aria-hidden></i>}
          iconClassName="flex size-11 flex-none items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 transition-colors group-hover:bg-violet-500/20"
          title={t.editor.aiHelpTitle}
          description={t.editor.aiHelpDesc}
        >
          <div className="flex items-center gap-2">
            <select
              value={suggestArchetype}
              disabled={suggesting}
              onChange={(e) => {
                const v = e.target.value;
                setSuggestArchetype(v);
                const arch = AI_ARCHETYPES.find((a) => a.value === v);
                if (arch) void runSuggest(arch.brief);
              }}
              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">{t.editor.aiHelpSelect}</option>
              {AI_ARCHETYPES.map((a) => (
                <option key={a.value} value={a.value}>{(t.archetypes as Record<string, string>)[a.value] ?? a.label}</option>
              ))}
            </select>
            {draft.description.trim() && (
              <button
                type="button" disabled={suggesting}
                onClick={() => void runSuggest(draft.description.trim())}
                className="shrink-0 rounded-md border border-violet-400/50 px-2.5 py-1.5 text-xs text-violet-600 hover:bg-violet-500/10 disabled:opacity-50"
                title={t.editor.aiHelpFromDescTitle}
              >
                <i className="ti ti-wand" aria-hidden></i> {t.editor.aiHelpFromDesc}
              </button>
            )}
          </div>
          {suggesting && (
            <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-violet-600">
              <i className="ti ti-loader-2 animate-spin" aria-hidden></i> {t.editor.aiHelpGenerating}
            </span>
          )}
        </CollapsibleSection>

        {/* Apariencia — Avataaars local: preview + atributos + aleatorio.
            Va ANTES del nombre para presentar primero la identidad visual. */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">{t.editor.fieldAvatar}</span>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center gap-1.5 w-full">
              <img
                src={agentAvatarUri(draft.avatarConfig, draft.id ?? "new-agent")}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full border border-border bg-muted/40 object-cover"
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, avatarConfig: { seed: randomAvatarSeed() } })}
                className="rounded-md border border-input px-2 py-1 text-[11px] hover:bg-muted/50"
                title={t.editor.avatarRandomize}
              >
                🎲 {t.editor.avatarRandomize}
              </button>
            </div>
            <div className="grid w-full grid-cols-2 gap-1.5 @lg:grid-cols-3">
              {([...AVATAR_ENUM_ATTRS, ...AVATAR_COLOR_ATTRS] as AvatarAttr[]).map((attr) => (
                <label key={attr} className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                  {t.editor.avatarAttrs[attr]}
                  <select
                    value={draft.avatarConfig[attr] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        avatarConfig: { ...draft.avatarConfig, [attr]: e.target.value || undefined },
                      })
                    }
                    className="rounded-md border border-input bg-background px-1.5 py-1 text-[11px] focus:border-primary focus:outline-none"
                  >
                    <option value="">{t.editor.avatarAuto}</option>
                    {avatarOptionValues(attr).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-foreground">{t.editor.fieldName}</span>
          <input
            type="text" value={draft.name} maxLength={120}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t.editor.namePlaceholder}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-foreground">{t.editor.fieldDescription}</span>
          <input
            type="text" value={draft.description} maxLength={500}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder={t.editor.descPlaceholder}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-foreground">{t.editor.fieldSystemPrompt}</span>
          <textarea
            value={draft.systemPrompt} rows={6} maxLength={20000}
            onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
            placeholder={t.editor.systemPromptPlaceholder}
            className="resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm leading-snug focus:border-primary focus:outline-none"
          />
        </label>
        </>)}

        {editorTab === "model" && (<>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-foreground">{t.editor.fieldProvider}</span>
            <select
              value={draft.providerId}
              onChange={(e) => {
                const pid = e.target.value as AssistantProviderId;
                // Keep the model only if it also exists for the new provider;
                // otherwise fall back to the provider default (empty).
                const keepModel = (PROVIDER_MODELS[pid] ?? []).includes(draft.model);
                setDraft({ ...draft, providerId: pid, model: keepModel ? draft.model : "", realtime: REALTIME_PROVIDERS.includes(pid) ? draft.realtime : false });
              }}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              {PROVIDER_ORDER.map((id) => (
                <option key={id} value={id}>{PROVIDER_META[id].label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-foreground">{t.editor.fieldModel}</span>
            <select
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{t.editor.modelPlaceholder}</option>
              {/* Saved model not in the catalog (legacy/custom) — keep it selectable. */}
              {draft.model && !modelOptions.includes(draft.model) && (
                <option value={draft.model}>{draft.model}</option>
              )}
              {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>

        {/* Comunicación en tiempo real — checkbox OCULTO deliberadamente (equipos
            v2): la sesión realtime no se ofrece desde el editor por ahora. El
            valor existente se sigue preservando (toDraft/toPayload conservan
            `realtime`); para reactivar la UI restaurar el bloque desde git. */}

        {/* Multi-agente + multi-proveedor */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox" checked={draft.agentMode === "multi"}
              onChange={(e) => setDraft({ ...draft, agentMode: e.target.checked ? "multi" : "single" })}
            />
            {t.editor.multiAgentLabel}
          </label>
          {draft.agentMode === "multi" && (
            <div className="flex flex-col gap-2 border-t border-border pt-2">
              <p className="text-[11px] text-muted-foreground">
                {t.editor.multiAgentDescPre}<b>{t.editor.multiAgentDescBold}</b>{t.editor.multiAgentDescPost}
              </p>
              <label className="flex items-center gap-2 text-[11px] text-foreground">
                <span className="font-medium">{t.editor.multiAgentCopies}</span>
                <input
                  type="number" min={2} max={8} value={draft.multiAgentCount}
                  onChange={(e) => {
                    const n = Math.max(2, Math.min(8, Math.round(Number(e.target.value) || 3)));
                    setDraft({ ...draft, multiAgentCount: n });
                  }}
                  className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                />
                <span className="text-muted-foreground/70">{t.editor.multiAgentCopiesHint}</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                {t.editor.multiAgentProvidersPre}<b>{draft.providerId}</b>{t.editor.multiAgentProvidersPost}
              </span>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_ORDER.filter((p) => p !== draft.providerId).map((p) => {
                  const on = draft.providerIds.includes(p);
                  return (
                    <label key={p} className="flex items-center gap-1.5 rounded-md border border-input px-2 py-1 text-[11px]">
                      <input
                        type="checkbox" checked={on}
                        onChange={() => setDraft({ ...draft, providerIds: on ? draft.providerIds.filter((x) => x !== p) : [...draft.providerIds, p] })}
                      />
                      <ProviderIcon id={p} className="text-xs" />
                      <span className="capitalize">{p}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/70">{t.editor.multiAgentApiHint}</p>
            </div>
          )}
        </div>
        </>)}

        {editorTab === "hierarchy" && (<>
        {/* Rol y jerarquía: rol asignado, agente superior (subordinación) y conexiones */}
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-foreground">{t.editor.roleHeading}</span>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t.editor.roleAssigned}</span>
            <select
              value={draft.roleId ?? ""}
              onChange={(e) => setDraft({ ...draft, roleId: e.target.value || null })}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{t.editor.roleNone}</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <span className="text-[10px] text-muted-foreground/70">
              {t.editor.roleHint}
            </span>
          </label>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">
              {t.teams.teamSelectorLabel} <span className="text-red-500" aria-hidden>*</span>
            </span>
            <div className="flex items-center gap-1.5">
              <select
                value={draft.teamId ?? ""}
                onChange={(e) => setDraft({ ...draft, teamId: e.target.value || null })}
                aria-required="true"
                className={`flex-1 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none ${draft.teamId ? "border-input focus:border-primary" : "border-red-400/60 focus:border-red-500"}`}
              >
                {/* Non-selectable placeholder: a group is now mandatory. */}
                <option value="" disabled>{t.teams.teamSelectorPlaceholder}</option>
                {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setCreatingTeamForDraft(true)}
                title={t.teams.newTeamBtn}
                className="flex shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10"
              >
                <i className="ti ti-plus" aria-hidden></i> {t.teams.newTeamBtn}
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t.editor.parentAgent}</span>
            <select
              value={draft.parentAgentId ?? ""}
              onChange={(e) => setDraft({ ...draft, parentAgentId: e.target.value || null })}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{t.editor.parentNone}</option>
              {superiorGroups.map((g) => (
                <optgroup key={g.key} label={g.key === "General" ? t.list.noRoleGroupTitle : g.label}>
                  {g.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="text-[10px] text-muted-foreground/70">
              {t.editor.parentHintPre}<b>{t.editor.parentHintBold}</b>{t.editor.parentHintPost}
            </span>
          </label>

          <div className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground">{t.editor.connectionsLabel}</span>
            {otherAgents.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{t.editor.connectionsEmpty}</p>
            ) : (
              <AgentGroupedChecklist
                className="flex flex-col gap-1 max-h-60 overflow-y-auto"
                groups={connectionGroups}
                selectedIds={draft.connections}
                onToggle={(id) => {
                  const on = draft.connections.includes(id);
                  setDraft({ ...draft, connections: on ? draft.connections.filter((x) => x !== id) : [...draft.connections, id] });
                }}
                ungroupedLabel={t.list.noRoleGroupTitle}
                countLabel={(count) => formatAssistantMessage(t.list.groupCount, { count: String(count) })}
                defaultOpenKeys={connectionOpenKeys}
              />
            )}
            <span className="text-[10px] text-muted-foreground/70">
              {t.editor.connectionsHint}
            </span>
          </div>

          <label className="flex items-start gap-2 border-t border-border pt-2 text-[11px] font-medium text-foreground">
            <input
              type="checkbox" checked={draft.canSpawnChats}
              onChange={(e) => setDraft({ ...draft, canSpawnChats: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              {t.editor.supervisorLabel}
              <span className="block font-normal text-muted-foreground/70">
                {t.editor.supervisorDesc}
              </span>
            </span>
          </label>
        </div>
        </>)}

        {editorTab === "tools" && (<>
        {/* Herramientas permitidas */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox" checked={draft.allowAllTools}
              onChange={(e) => setDraft({ ...draft, allowAllTools: e.target.checked })}
            />
            {t.editor.allowAllTools}
          </label>
          {!draft.allowAllTools && (
            <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
              <p className="text-[11px] text-muted-foreground">
                {t.editor.toolsDesc}
              </p>
              {modules.length === 0 && <p className="text-xs text-muted-foreground">{t.noActiveModules}</p>}
              {modules.map((mod) => {
                const selected = mod.tools.filter((tool) => draft.allowedTools.has(tool.name)).length;
                const allOn = selected === mod.tools.length && mod.tools.length > 0;
                return (
                  <div key={mod.moduleId} className="rounded-md bg-muted/30 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium capitalize text-foreground">{mod.moduleId}</span>
                      <button
                        type="button"
                        onClick={() => moduleToggleAll(mod, !allOn)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {allOn ? t.removeAll : t.selectAll}
                      </button>
                    </div>
                    <div className="mt-1 grid grid-cols-1 gap-1 @xl:grid-cols-2">
                      {mod.tools.map((tool) => (
                        <label key={tool.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <input
                            type="checkbox" checked={draft.allowedTools.has(tool.name)}
                            onChange={() => toolToggle(tool.name)}
                          />
                          <span className="truncate" title={tool.description}>{tool.title || tool.name}</span>
                          {tool.dangerous && <i className="ti ti-alert-triangle text-amber-500" title={t.sensitiveTool} aria-hidden></i>}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>)}

        {editorTab === "access" && (<>
        {/* Servidores asociados */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-foreground">{t.editor.associatedServers}</span>
          {conns.length === 0 && <p className="text-[11px] text-muted-foreground">{t.editor.serversEmpty}</p>}
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {conns.map((c) => {
              const on = draft.servers.some((s) => s.id === c.id);
              return (
                <label key={c.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox" checked={on}
                    onChange={() => setDraft({ ...draft, servers: on ? draft.servers.filter((s) => s.id !== c.id) : [...draft.servers, c] })}
                  />
                  <span className="truncate">{c.name}{c.host ? <span className="text-muted-foreground/60"> · {c.host}</span> : null}</span>
                </label>
              );
            })}
          </div>
        </div>

        </>)}

        {editorTab === "resources" && (<>
        {/* Proyectos adjuntos — árbol anidado completo: marcar un proyecto
            padre selecciona todas sus carpetas anidadas (subproyectos); el
            agente usa las rutas de trabajo de los proyectos seleccionados. */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-foreground">{t.editor.attachedProjects}</span>
          <p className="text-[11px] text-muted-foreground">{t.editor.attachedProjectsDesc}</p>
          {projects.length === 0 && <p className="text-[11px] text-muted-foreground">{t.editor.noParentProjects}</p>}
          <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
            {projects.filter((p) => !p.parentId).map((p) => renderProjectNode(p, 0))}
          </div>
          <label className="flex items-center gap-2 border-t border-border pt-2 text-[11px] font-medium text-foreground">
            <input type="checkbox" checked={draft.autoCapture} onChange={(e) => setDraft({ ...draft, autoCapture: e.target.checked })} />
            {t.editor.saveObsidian}
          </label>
        </div>

        {/* Snippets de terminal: pre-filtro por categoría (+tags) de la librería
            de snippets del usuario. Vacío = sin filtro. Si el usuario no puede
            leer los snippets (sin permiso de terminal), campos deshabilitados. */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-foreground">{t.editor.snippetsSection}</span>
          <p className="text-[11px] text-muted-foreground">{t.editor.snippetsHelp}</p>
          {snippetOpts !== null && !snippetOpts.ok && (
            <p className="text-[11px] text-amber-500">{t.editor.snippetsNoAccess}</p>
          )}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-foreground">{t.editor.snippetsCategoryLabel}</span>
            <select
              value={draft.snippetCategory}
              disabled={!snippetOpts?.ok}
              onChange={(e) => {
                const name = e.target.value;
                // Cambiar (o quitar) la categoría resetea también los tags.
                setDraft({ ...draft, snippetCategory: name, snippetTags: [] });
              }}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">{t.editor.snippetsCategoryNone}</option>
              {/* Categoría guardada que ya no existe en la librería: se conserva visible. */}
              {draft.snippetCategory && !(snippetOpts?.categories ?? []).some((c) => c.name === draft.snippetCategory) && (
                <option value={draft.snippetCategory}>{draft.snippetCategory}</option>
              )}
              {(snippetOpts?.categories ?? []).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          {snippetOpts?.ok && draft.snippetCategory && (() => {
            const cat = snippetOpts.categories.find((c) => c.name === draft.snippetCategory);
            const catTags = cat ? snippetOpts.tags.filter((tg) => tg.categoryId === cat.id) : [];
            // Tags guardados que ya no existen en la categoría: se conservan como toggle activo.
            const knownNames = new Set(catTags.map((tg) => tg.name));
            const orphanTags = draft.snippetTags.filter((n) => !knownNames.has(n));
            const toggleTag = (name: string) =>
              setDraft({
                ...draft,
                snippetTags: draft.snippetTags.includes(name)
                  ? draft.snippetTags.filter((n) => n !== name)
                  : [...draft.snippetTags, name],
              });
            return (
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-foreground">{t.editor.snippetsTagsLabel}</span>
                {catTags.length === 0 && orphanTags.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{t.editor.snippetsNoTags}</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {[...orphanTags.map((name) => ({ key: `orphan:${name}`, name })), ...catTags.map((tg) => ({ key: String(tg.id), name: tg.name }))].map((tg) => {
                      const on = draft.snippetTags.includes(tg.name);
                      return (
                        <button
                          key={tg.key}
                          type="button"
                          onClick={() => toggleTag(tg.name)}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted/50"}`}
                        >
                          {tg.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Índices de grafo de código: el agente consulta el código por el
            grafo (símbolos/llamadas/arquitectura) en vez de leer archivos
            completos — menos tokens por respuesta. */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-foreground">{t.editor.graphIndexesTitle}</span>
          <p className="text-[11px] text-muted-foreground">{t.editor.graphIndexesDesc}</p>
          {indexedProjects.length === 0 && <p className="text-[11px] text-muted-foreground">{t.editor.graphIndexesEmpty}</p>}
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {indexedProjects.map((p) => {
              const on = draft.graphProjectIds.includes(p.id);
              return (
                <label key={p.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox" checked={on}
                    onChange={() => setDraft({ ...draft, graphProjectIds: on ? draft.graphProjectIds.filter((x) => x !== p.id) : [...draft.graphProjectIds, p.id] })}
                  />
                  <i className="ti ti-topology-star-3" aria-hidden></i>
                  <span className="truncate">{p.title}</span>
                  {p.graphIndex?.project && (
                    <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {p.graphIndex.project}
                      {p.graphIndex.nodes != null ? ` · ${p.graphIndex.nodes}n/${p.graphIndex.edges ?? 0}e` : ""}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
        </>)}

        {editorTab === "access" && (<>
        {/* Credenciales de acceso (UNA sola): login en la app bajo prueba */}
        <CredentialsLink label={t.editor.credentialTitle} credential="assistant" />
        </>)}

        {editorTab === "resources" && (<>
        {/* Skills del agente (solo en sus chats) */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-foreground">{t.editor.agentSkills}</span>
          <SkillsPicker value={draft.skills} onChange={(skills) => setDraft({ ...draft, skills })} />
        </div>
        </>)}
        </ViewTransition>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {/* Único camino de regreso = la flecha del header del modal (cancela el
            formulario). El guardado principal vive en el footer del modal
            (SettingsFooterContext); este botón es solo un fallback cuando el tab
            se renderiza fuera de ese layout. Sin botón "Cancelar" inferior. */}
        {!setFooterAction && (
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => void save()} disabled={saving || !draft.name.trim() || !draft.teamId}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {saving ? t.saving : draft.id ? t.saveChanges : t.editor.createAgent}
            </button>
          </div>
        )}

        {/* Inline "+ Nuevo grupo": create a team without leaving the editor, then
            refresh the list and auto-select the freshly-created team into the draft. */}
        {creatingTeamForDraft && (
          <TeamEditModal
            team={null}
            agents={agents}
            teams={teams}
            t={t.teams}
            onClose={() => setCreatingTeamForDraft(false)}
            onSaved={async () => {
              const before = new Set(teams.map((tm) => tm.id));
              setCreatingTeamForDraft(false);
              try {
                const list = await assistantAgentTeamsApi.list();
                setTeams(list);
                const created = list.find((tm) => !before.has(tm.id));
                if (created) setDraft((d) => (d ? { ...d, teamId: created.id } : d));
              } catch { /* ignore: list stays as-is, user can retry */ }
              window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
            }}
          />
        )}

      </div>
    );
}

/** Tab button for the agent create/edit editor (icon + label). */
function EditorTabBtn({ active, onClick, icon, children }: { active: boolean; onClick(): void; icon: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out ${active ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      <i className={`ti ${icon}`} aria-hidden></i>{children}
    </button>
  );
}
