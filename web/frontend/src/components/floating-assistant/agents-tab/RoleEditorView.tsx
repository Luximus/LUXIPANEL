// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { type ResolvedModule } from "../assistant-api";
import { LucideIcon } from "../LucideIcon";
import { ICON_PRESETS, COLOR_PRESETS, COLOR_DOT } from "./constants";
import type { AgentsTabVM } from "./use-agents-tab";

export function RoleEditorView({ vm }: { vm: AgentsTabVM }) {
  const { onLaunchAgent, locale, initialEditAgentId, t, agents, setAgents, loading, setLoading, error, setError, draft, setDraft, editorTab, setEditorTab, saving, setSaving, modules, setModules, suggesting, setSuggesting, suggestArchetype, setSuggestArchetype, projects, setProjects, conns, setConns, snippetOpts, setSnippetOpts, roles, setRoles, teams, setTeams, teamDraft, setTeamDraft, teamAddCtx, setTeamAddCtx, showRoles, setShowRoles, showTree, setShowTree, showTemplates, setShowTemplates, treeTeamId, setTreeTeamId, creatingTeamForDraft, setCreatingTeamForDraft, treeRegen, setTreeRegen, regenBusy, setRegenBusy, roleDraft, setRoleDraft, resyncCtx, setResyncCtx, resyncResult, setResyncResult, resyncSelected, setResyncSelected, resyncApplying, setResyncApplying, resyncError, setResyncError, groupPendingDelete, setGroupPendingDelete, deletingGroup, setDeletingGroup, openGroupKey, setOpenGroupKey, initialEditConsumed, modelOptions, effectiveTreeTeamId, treeAgents, treeCode, treeImages, teamsById, agentGroups, setFooterAction, setHeaderOverride, openResync, confirmResync, reload, regenerateTree, reloadRoles, saveRole, removeRole, runSuggest, save, remove, removeFromTeam, deleteTeam, onTeamMutated, removeGroup, duplicate } = vm;
  if (!roleDraft) return null;
    const rToolToggle = (name: string) => setRoleDraft((d) => {
      if (!d) return d;
      const next = new Set(d.allowedTools);
      if (next.has(name)) next.delete(name); else next.add(name);
      return { ...d, allowedTools: next };
    });
    const rModuleToggleAll = (mod: ResolvedModule, on: boolean) => setRoleDraft((d) => {
      if (!d) return d;
      const next = new Set(d.allowedTools);
      for (const t of mod.tools) { if (on) next.add(t.name); else next.delete(t.name); }
      return { ...d, allowedTools: next };
    });
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{roleDraft.id ? t.roleEditor.titleEdit : t.roleEditor.titleNew}</h3>
          <button type="button" onClick={() => setRoleDraft(null)} className="text-xs text-muted-foreground hover:text-foreground">
            <i className="ti ti-x" aria-hidden></i> {t.cancel}
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-foreground">{t.roleEditor.fieldName}</span>
          <input
            type="text" value={roleDraft.name} maxLength={120}
            onChange={(e) => setRoleDraft({ ...roleDraft, name: e.target.value })}
            placeholder={t.roleEditor.namePlaceholder}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-foreground">{t.roleEditor.fieldDesc}</span>
          <input
            type="text" value={roleDraft.description} maxLength={500}
            onChange={(e) => setRoleDraft({ ...roleDraft, description: e.target.value })}
            placeholder={t.roleEditor.descPlaceholder}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-foreground">{t.roleEditor.fieldBasePrompt}</span>
          <textarea
            value={roleDraft.systemPrompt} rows={6} maxLength={20000}
            onChange={(e) => setRoleDraft({ ...roleDraft, systemPrompt: e.target.value })}
            placeholder={t.roleEditor.basePromptPlaceholder}
            className="resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm leading-snug focus:border-primary focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground/70">{t.roleEditor.basePromptHint}</span>
        </label>

        {/* Icono + color */}
        <div className="flex flex-wrap items-center gap-1">
          {ICON_PRESETS.map((ic) => (
            <button key={ic} type="button" onClick={() => setRoleDraft({ ...roleDraft, icon: ic })}
              className={`flex h-7 w-7 items-center justify-center rounded-md border ${roleDraft.icon === ic ? "border-primary bg-primary/10" : "border-input hover:bg-muted/50"}`} title={ic}>
              <LucideIcon name={ic} size={14} />
            </button>
          ))}
          {COLOR_PRESETS.map((c) => (
            <button key={c} type="button" onClick={() => setRoleDraft({ ...roleDraft, color: c })}
              className={`h-5 w-5 rounded-full ${COLOR_DOT[c]} ${roleDraft.color === c ? "ring-2 ring-offset-1 ring-foreground/40" : ""}`} title={c} />
          ))}
        </div>

        {/* Herramientas por defecto del rol */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input type="checkbox" checked={roleDraft.allowAllTools} onChange={(e) => setRoleDraft({ ...roleDraft, allowAllTools: e.target.checked })} />
            {t.roleEditor.noToolLimit}
          </label>
          {!roleDraft.allowAllTools && (
            <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
              <p className="text-[11px] text-muted-foreground">{t.roleEditor.toolsDesc}</p>
              {modules.length === 0 && <p className="text-xs text-muted-foreground">{t.noActiveModules}</p>}
              {modules.map((mod) => {
                const selected = mod.tools.filter((tool) => roleDraft.allowedTools.has(tool.name)).length;
                const allOn = selected === mod.tools.length && mod.tools.length > 0;
                return (
                  <div key={mod.moduleId} className="rounded-md bg-muted/30 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium capitalize text-foreground">{mod.moduleId}</span>
                      <button type="button" onClick={() => rModuleToggleAll(mod, !allOn)} className="text-[11px] text-primary hover:underline">
                        {allOn ? t.removeAll : t.selectAll}
                      </button>
                    </div>
                    <div className="mt-1 grid grid-cols-1 gap-1 @xl:grid-cols-2">
                      {mod.tools.map((tool) => (
                        <label key={tool.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <input type="checkbox" checked={roleDraft.allowedTools.has(tool.name)} onChange={() => rToolToggle(tool.name)} />
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

        {/* Permiso del cargo: crear chats para subordinados */}
        <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs font-medium text-foreground">
          <input
            type="checkbox" checked={roleDraft.canSpawnChats}
            onChange={(e) => setRoleDraft({ ...roleDraft, canSpawnChats: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            {t.roleEditor.supervisorLabel}
            <span className="block font-normal text-muted-foreground/70">
              {t.roleEditor.supervisorDesc}
            </span>
          </span>
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void saveRole()} disabled={saving || !roleDraft.name.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
            {saving ? t.saving : roleDraft.id ? t.saveChanges : t.roleEditor.createRole}
          </button>
          <button type="button" onClick={() => setRoleDraft(null)} className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted/50">{t.cancel}</button>
        </div>
      </div>
    );
}
