// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { LucideIcon } from "../LucideIcon";
import { formatAssistantMessage } from "../i18n";
import { colorText, colorTint } from "./constants";
import { emptyRole, roleToDraft } from "./draft";
import type { AgentsTabVM } from "./use-agents-tab";

export function RolesListView({ vm }: { vm: AgentsTabVM }) {
  const { onLaunchAgent, locale, initialEditAgentId, t, agents, setAgents, loading, setLoading, error, setError, draft, setDraft, editorTab, setEditorTab, saving, setSaving, modules, setModules, suggesting, setSuggesting, suggestArchetype, setSuggestArchetype, projects, setProjects, conns, setConns, snippetOpts, setSnippetOpts, roles, setRoles, teams, setTeams, teamDraft, setTeamDraft, teamAddCtx, setTeamAddCtx, showRoles, setShowRoles, showTree, setShowTree, showTemplates, setShowTemplates, treeTeamId, setTreeTeamId, creatingTeamForDraft, setCreatingTeamForDraft, treeRegen, setTreeRegen, regenBusy, setRegenBusy, roleDraft, setRoleDraft, resyncCtx, setResyncCtx, resyncResult, setResyncResult, resyncSelected, setResyncSelected, resyncApplying, setResyncApplying, resyncError, setResyncError, groupPendingDelete, setGroupPendingDelete, deletingGroup, setDeletingGroup, openGroupKey, setOpenGroupKey, initialEditConsumed, modelOptions, effectiveTreeTeamId, treeAgents, treeCode, treeImages, teamsById, agentGroups, setFooterAction, setHeaderOverride, openResync, confirmResync, reload, regenerateTree, reloadRoles, saveRole, removeRole, runSuggest, save, remove, removeFromTeam, deleteTeam, onTeamMutated, removeGroup, duplicate } = vm;
    const agentsByRole = (roleId: string) => agents.filter((a) => a.roleId === roleId).length;
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setShowRoles(false)} className="text-xs text-muted-foreground hover:text-foreground">
            <i className="ti ti-arrow-left" aria-hidden></i> {t.backToAgents}
          </button>
          <button type="button" onClick={() => setRoleDraft(emptyRole())} className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <i className="ti ti-plus" aria-hidden></i> {t.rolesList.newRole}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t.rolesList.description}
        </p>
        {error && <p className="text-xs text-red-500">{formatAssistantMessage(t.errorPrefix, { message: error })}</p>}
        {roles.length === 0 && (
          <div className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            <i className="ti ti-shield text-3xl text-muted-foreground/40" aria-hidden></i>
            <p className="mt-2 font-medium text-foreground">{t.rolesList.emptyTitle}</p>
            <p className="text-xs">{t.rolesList.emptyDesc}</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
          {roles.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorTint(r.color)}`}>
                  <LucideIcon name={r.icon || "Shield"} size={16} className={colorText(r.color)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{r.description || t.noDescription}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded bg-muted/50 px-1.5 py-0.5">{r.allowedTools == null ? t.allTools : formatAssistantMessage(t.toolsCount, { count: String(r.allowedTools.length) })}</span>
                <span className="rounded bg-muted/50 px-1.5 py-0.5">{formatAssistantMessage(t.rolesList.agentsCount, { count: String(agentsByRole(r.id)) })}</span>
                {r.relation === "shared" && r.ownerName && (
                  <span className="rounded bg-muted/50 px-1.5 py-0.5" title={formatAssistantMessage(t.createdBy, { ownerName: r.ownerName })}>· {r.ownerName}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <button type="button" onClick={() => setRoleDraft(roleToDraft(r))} className="flex-1 rounded-md border border-input px-2 py-1.5 text-xs hover:bg-muted/50">
                  <i className="ti ti-edit" aria-hidden></i> {t.editBtn}
                </button>
                <button type="button" onClick={() => void removeRole(r)} title={t.deleteTitle} className="rounded-md border border-input px-2 py-1.5 text-xs text-red-500 hover:bg-red-500/10">
                  <i className="ti ti-trash" aria-hidden></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
}
