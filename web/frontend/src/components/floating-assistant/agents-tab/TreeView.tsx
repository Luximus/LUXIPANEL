// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { MermaidDiagram } from "../MermaidDiagram";
import type { AgentsTabVM } from "./use-agents-tab";

export function TreeView({ vm }: { vm: AgentsTabVM }) {
  const { onLaunchAgent, locale, initialEditAgentId, t, agents, setAgents, loading, setLoading, error, setError, draft, setDraft, editorTab, setEditorTab, saving, setSaving, modules, setModules, suggesting, setSuggesting, suggestArchetype, setSuggestArchetype, projects, setProjects, conns, setConns, snippetOpts, setSnippetOpts, roles, setRoles, teams, setTeams, teamDraft, setTeamDraft, teamAddCtx, setTeamAddCtx, showRoles, setShowRoles, showTree, setShowTree, showTemplates, setShowTemplates, treeTeamId, setTreeTeamId, creatingTeamForDraft, setCreatingTeamForDraft, treeRegen, setTreeRegen, regenBusy, setRegenBusy, roleDraft, setRoleDraft, resyncCtx, setResyncCtx, resyncResult, setResyncResult, resyncSelected, setResyncSelected, resyncApplying, setResyncApplying, resyncError, setResyncError, groupPendingDelete, setGroupPendingDelete, deletingGroup, setDeletingGroup, openGroupKey, setOpenGroupKey, initialEditConsumed, modelOptions, effectiveTreeTeamId, treeAgents, treeCode, treeImages, teamsById, agentGroups, setFooterAction, setHeaderOverride, openResync, confirmResync, reload, regenerateTree, reloadRoles, saveRole, removeRole, runSuggest, save, remove, removeFromTeam, deleteTeam, onTeamMutated, removeGroup, duplicate } = vm;
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setShowTree(false)} className="text-xs text-muted-foreground hover:text-foreground">
            <i className="ti ti-arrow-left" aria-hidden></i> {t.backToAgents}
          </button>
          <span className="text-xs font-medium text-foreground">{t.treeView.title}</span>
          <div className="flex items-center gap-1.5">
            {/* Group scope: the tree renders a single work group's hierarchy. */}
            <label className="sr-only" htmlFor="lxp-tree-group">{t.teams.teamSelectorLabel}</label>
            <select
              id="lxp-tree-group"
              value={effectiveTreeTeamId ?? ""}
              onChange={(e) => setTreeTeamId(e.target.value || null)}
              disabled={teams.length === 0}
              title={t.teams.teamSelectorLabel}
              className="max-w-[10rem] rounded-md border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
            >
              {teams.length === 0 && <option value="">{t.teams.teamSelectorPlaceholder}</option>}
              {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
            <button
              type="button" onClick={() => void regenerateTree()} disabled={regenBusy}
              className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
              title={t.treeView.reloadTitle}
            >
              <i className={`ti ti-refresh ${regenBusy ? "animate-spin" : ""}`} aria-hidden></i> {regenBusy ? t.treeView.regenerating : t.treeView.regenerate}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t.treeView.description}
        </p>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background">
          <MermaidDiagram key={treeRegen} code={treeCode} nodeImages={treeImages} />
        </div>
      </div>
    );
}
