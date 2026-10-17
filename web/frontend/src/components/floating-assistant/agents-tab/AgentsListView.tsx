// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { rankAgentsInGroup } from "../assistant-api";
import { TeamEditModal } from "../TeamEditModal";
import { TeamAddAgentsModal } from "../TeamAddAgentsModal";
import { AgentAvatar } from "../AgentAvatar";
import { ProviderIcon } from "../ProviderIcon";
import { CollapsibleSection } from "../CollapsibleSection";
import { ModalShell } from "@/components/ui/ModalShell";
import { formatAssistantMessage } from "../i18n";
import { teamAvatarBg, teamInitials } from "./constants";
import { toDraft } from "./draft";
import type { AgentsTabVM } from "./use-agents-tab";

export function AgentsListView({ vm }: { vm: AgentsTabVM }) {
  const { _i18n, onLaunchAgent, locale, initialEditAgentId, t, agents, setAgents, loading, setLoading, error, setError, draft, setDraft, editorTab, setEditorTab, saving, setSaving, modules, setModules, suggesting, setSuggesting, suggestArchetype, setSuggestArchetype, projects, setProjects, conns, setConns, snippetOpts, setSnippetOpts, roles, setRoles, teams, setTeams, teamDraft, setTeamDraft, teamAddCtx, setTeamAddCtx, showRoles, setShowRoles, showTree, setShowTree, showTemplates, setShowTemplates, treeTeamId, setTreeTeamId, creatingTeamForDraft, setCreatingTeamForDraft, treeRegen, setTreeRegen, regenBusy, setRegenBusy, roleDraft, setRoleDraft, resyncCtx, setResyncCtx, resyncResult, setResyncResult, resyncSelected, setResyncSelected, resyncApplying, setResyncApplying, resyncError, setResyncError, groupPendingDelete, setGroupPendingDelete, deletingGroup, setDeletingGroup, openGroupKey, setOpenGroupKey, initialEditConsumed, modelOptions, effectiveTreeTeamId, treeAgents, treeCode, treeImages, teamsById, agentGroups, setFooterAction, setHeaderOverride, openResync, confirmResync, reload, regenerateTree, reloadRoles, saveRole, removeRole, runSuggest, save, remove, removeFromTeam, deleteTeam, onTeamMutated, removeGroup, duplicate } = vm;
  const roleNameById = new Map(roles.map((r) => [r.id, r.name] as const));
  const roleSpawnById = new Map(roles.map((r) => [r.id, Boolean(r.canSpawnChats)] as const));
  const agentNameById = new Map(agents.map((a) => [a.id, a.name] as const));
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
          {t.list.description}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button" onClick={() => setShowTree(true)}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
            title={t.list.treeBtnTitle}
          >
            <i className="ti ti-hierarchy-2" aria-hidden></i> {t.list.treeBtn}
          </button>
          <button
            type="button" onClick={() => setShowRoles(true)}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
            title={t.list.rolesBtnTitle}
          >
            <i className="ti ti-shield" aria-hidden></i> {t.list.rolesBtn}{roles.length > 0 ? ` (${roles.length})` : ""}
          </button>
          {!vm.projectScope && <button
            type="button" onClick={() => setTeamDraft({ team: null })}
            className="rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
            title={t.teams.newTeamTitle}
          >
            <i className="ti ti-users-group" aria-hidden></i> {t.teams.newTeamBtn}
          </button>}
          <button
            type="button" onClick={vm.newAgent}
            disabled={loading || Boolean(vm.projectScope && !teams.length)}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-plus" aria-hidden></i> {t.list.newAgent}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{formatAssistantMessage(t.errorPrefix, { message: error })}</p>}
      {loading && <p className="text-xs text-muted-foreground">{t.list.loading}</p>}
      {!loading && agents.length === 0 && (
        <div className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          <i className="ti ti-robot text-3xl text-muted-foreground/40" aria-hidden></i>
          <p className="mt-2 font-medium text-foreground">{t.list.emptyTitle}</p>
          <p className="text-xs">{t.list.emptyDesc}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3">
        {agentGroups.ordered.map((key) => {
          const bucket = agentGroups.groups.get(key);
          if (!bucket) return null;
          const list = bucket.agents;
          const team = bucket.team;
          const isTeam = Boolean(team);
          const isGeneral = key === "General";
          // Hide empty LEGACY groups; empty TEAMS stay visible on purpose so a
          // freshly-created team doesn't vanish before it has members.
          if (list.length === 0 && !isTeam) return null;
          const groupKey = key;
          const groupOpen = openGroupKey === groupKey;
          // "General" keeps the legacy translated label; teams/legacy groups use
          // their own name (team name, or the "Prefix" before " · ").
          const groupTitle = isGeneral ? t.list.noRoleGroupTitle : bucket.label;
          const groupDesc = isGeneral
            ? t.list.noRoleGroupDesc
            : list.length === 0
              ? t.teams.emptyTeamHint
              : formatAssistantMessage(t.list.groupCount, { count: String(list.length) });
          // Avatar cuadrado de color sólido con iniciales (patrón "Simple cards"):
          // color determinista por clave de grupo (respeta el color del equipo).
          const avatarBg = teamAvatarBg(groupKey, team?.color);
          const initials = teamInitials(groupTitle);
          // Group-bulk-delete (conserved): only agents the current user owns can
          // be removed (backend rejects shared ones with 403). General excluded.
          const deletable = isGeneral ? [] : list.filter((a) => a.relation !== "shared");
          const sharedSkipped = list.length - deletable.length;
          // Template resync: the group's root (no parent, or parent outside the
          // group) with template provenance enables "Sincronizar con plantilla".
          const groupIds = new Set(list.map((a) => a.id));
          const groupRoot = isGeneral
            ? undefined
            : list.find((a) => !a.parentAgentId || !groupIds.has(a.parentAgentId));
          const resyncTemplateId = groupRoot?.templateId;
          // Hierarchy rank per agent within this work group. The "1" chip
          // marks the group's head; deeper ranks indicate reporting distance.
          const ranks = rankAgentsInGroup(list);
          return (
            <CollapsibleSection
              key={groupKey}
              open={groupOpen}
              onOpenChange={(next) => setOpenGroupKey(next ? groupKey : null)}
              icon={<span className="select-none">{initials}</span>}
              iconClassName={`flex size-11 flex-none items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-105 ${avatarBg}`}
              stackActionsOnMobile={!isGeneral}
              title={
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{groupTitle}</span>
                  <span className="flex-none text-[10px] font-normal text-muted-foreground">
                    ({formatAssistantMessage(t.list.groupCount, { count: String(list.length) })})
                  </span>
                </span>
              }
              description={groupDesc}
              headerAction={
                !isGeneral ? (
                  <span className="flex flex-wrap items-center justify-end gap-1">
                    {resyncTemplateId && groupRoot && (
                      <button
                        type="button"
                        onClick={() => void openResync(resyncTemplateId, groupRoot.id, groupTitle)}
                        title={t.resync.btnTitle}
                        aria-label={t.resync.btn}
                        className="flex h-7 items-center gap-1 rounded-md border border-input px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <i className="ti ti-refresh-dot" aria-hidden></i>
                        <span className="hidden @3xl:inline">{t.resync.btn}</span>
                      </button>
                    )}
                    {isTeam && team && (
                      <>
                        <button
                          type="button"
                          onClick={() => setTeamDraft({ team })}
                          title={t.teams.editTeamTitle}
                          aria-label={t.teams.editTeamTitle}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <i className="ti ti-pencil" aria-hidden></i>
                        </button>
                        {!vm.projectScope && <button
                          type="button"
                          onClick={() => setTeamAddCtx(team)}
                          title={t.teams.addAgentsBtn}
                          aria-label={t.teams.addAgentsBtn}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <i className="ti ti-user-plus" aria-hidden></i>
                        </button>}
                        {!vm.projectScope && <button
                          type="button"
                          onClick={() => void deleteTeam(team)}
                          title={t.teams.deleteTeamBtn}
                          aria-label={t.teams.deleteTeamBtn}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-xs text-amber-600 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <i className="ti ti-folder-x" aria-hidden></i>
                        </button>}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setGroupPendingDelete({ label: groupTitle, agents: deletable, sharedSkipped })}
                      disabled={deletable.length === 0}
                      title={t.list.deleteGroupTitle}
                      aria-label={t.list.deleteGroupTitle}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-xs text-red-500 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <i className="ti ti-trash" aria-hidden></i>
                    </button>
                  </span>
                ) : undefined
              }
              className={`border-violet-500/20 ${groupOpen ? "col-span-full" : ""}`}
            >
              <div className="grid grid-cols-1 gap-2 @sm:gap-3 @xl:grid-cols-2">
                {list.map((a) => (
                  <div key={a.id} className="relative flex flex-col gap-2 rounded-xl border border-border bg-card p-2 @sm:p-3">
                    {ranks.has(a.id) && (
                      <span
                        aria-hidden
                        title={`Jerarquía #${ranks.get(a.id)}`}
                        className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm ring-1 ring-background"
                      >
                        {ranks.get(a.id)}
                      </span>
                    )}
                    {/* Cuerpo centrado (patrón grid-list): avatar grande, nombre,
                        rol como ÚNICO badge central y descripción tenue. */}
                    <div className="flex w-full min-w-0 flex-col items-center gap-1 text-center">
                      <AgentAvatar agent={a} size={64} />
                      <p className="max-w-full truncate text-sm font-semibold text-foreground">{a.name}</p>
                      {a.roleId && roleNameById.has(a.roleId) && (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-white" title={t.list.roleAssignedTitle}>
                          <i className="ti ti-shield" aria-hidden></i> {roleNameById.get(a.roleId)}
                        </span>
                      )}
                      <p className="line-clamp-2 w-full min-w-0 break-words px-1 text-[11px] text-muted-foreground">{a.description || t.noDescription}</p>
                    </div>
                    {/* Pie fila 1: info secundaria (mismos badges menos rol) */}
                    <div className="mt-1 flex flex-wrap justify-center gap-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5">
                        <ProviderIcon id={a.providerId} className="text-xs" /> {a.providerId}
                      </span>
                      {a.model && <span className="rounded bg-muted/50 px-1.5 py-0.5">{a.model}</span>}
                      <span className="rounded bg-muted/50 px-1.5 py-0.5">
                        {a.allowedTools == null ? t.allTools : formatAssistantMessage(t.toolsCount, { count: String(a.allowedTools.length) })}
                      </span>
                      {a.agentMode === "multi" && (
                        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-600" title={formatAssistantMessage(t.list.multiAgentTitle, { count: String(a.multiAgentCount ?? 3) })}>
                          <i className="ti ti-users-group" aria-hidden></i> ×{a.multiAgentCount ?? 3}{(a.providerIds?.length ?? 0) > 0 ? ` ·${(a.providerIds?.length ?? 0) + 1}p` : ""}
                        </span>
                      )}
                      {a.parentAgentId && agentNameById.has(a.parentAgentId) && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5" title={t.list.subordinateTitle}>
                          <i className="ti ti-hierarchy-2" aria-hidden></i> {agentNameById.get(a.parentAgentId)}
                        </span>
                      )}
                      {(a.connections?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5" title={t.list.connectionsTitle}>
                          <i className="ti ti-arrows-exchange" aria-hidden></i> {a.connections?.length}
                        </span>
                      )}
                      {(a.canSpawnChats || (a.roleId ? roleSpawnById.get(a.roleId) : false)) && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-600" title={t.list.supervisorTitle}>
                          <i className="ti ti-messages" aria-hidden></i> {t.list.supervisorBadge}
                        </span>
                      )}
                      {a.realtime && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-600" title={t.list.realtimeTitle}>
                          <i className="ti ti-broadcast" aria-hidden></i> {t.list.realtimeBadge}
                        </span>
                      )}
                      {a.relation === "shared" && a.ownerName && (
                        <span className="rounded bg-muted/50 px-1.5 py-0.5" title={formatAssistantMessage(t.createdBy, { ownerName: a.ownerName })}>· {a.ownerName}</span>
                      )}
                    </div>
                    {/* Pie fila 2: acciones divididas (chat a la izquierda, resto a la derecha) */}
                    <div className="flex items-center gap-1 @sm:gap-1.5 border-t border-border pt-2">
                      <button
                        type="button" onClick={() => onLaunchAgent(a)}
                        className="flex-1 whitespace-nowrap inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <i className="ti ti-message-plus" aria-hidden></i> {t.list.startChat}
                      </button>
                      <button type="button" onClick={() => { setEditorTab("general"); setDraft(toDraft(a)); }} title={t.editBtn} className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md border border-input px-1.5 text-xs hover:bg-muted/50">
                        <i className="ti ti-edit" aria-hidden></i>
                      </button>
                      <button type="button" onClick={() => duplicate(a)} title={t.list.duplicateTitle} className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md border border-input px-1.5 text-xs hover:bg-muted/50">
                        <i className="ti ti-copy" aria-hidden></i>
                      </button>
                      {!vm.projectScope && a.teamId && teamsById.has(a.teamId) && (
                        <button type="button" onClick={() => void removeFromTeam(a)} title={t.teams.removeFromTeamBtn} aria-label={t.teams.removeFromTeamBtn} className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md border border-input px-1.5 text-xs text-amber-600 hover:bg-amber-500/10">
                          <i className="ti ti-user-minus" aria-hidden></i>
                        </button>
                      )}
                      <button type="button" onClick={() => void remove(a)} title={t.deleteTitle} className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md border border-input px-1.5 text-xs text-red-500 hover:bg-red-500/10">
                        <i className="ti ti-trash" aria-hidden></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          );
        })}
      </div>

      {groupPendingDelete && (
        <ModalShell onClose={() => !deletingGroup && setGroupPendingDelete(null)}>
          <div
            className="flex h-full flex-col p-5"
            aria-labelledby="lxp-group-delete-title"
            aria-describedby="lxp-group-delete-desc"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                <i className="ti ti-alert-triangle text-lg" aria-hidden></i>
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="lxp-group-delete-title" className="text-sm font-semibold text-foreground">
                  {formatAssistantMessage(t.list.deleteGroupModalTitle, { name: groupPendingDelete.label })}
                </h3>
                <p id="lxp-group-delete-desc" className="mt-1 text-xs text-muted-foreground">
                  {formatAssistantMessage(t.list.deleteGroupModalBody, { count: String(groupPendingDelete.agents.length) })}
                </p>
              </div>
            </div>

            <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground">
              {groupPendingDelete.agents.map((a) => (
                <li key={a.id} className="truncate py-0.5" title={a.name}>• {a.name}</li>
              ))}
            </ul>

            {groupPendingDelete.sharedSkipped > 0 && (
              <p className="mt-2 text-[11px] text-amber-500">
                {formatAssistantMessage(t.list.deleteGroupSharedNote, { count: String(groupPendingDelete.sharedSkipped) })}
              </p>
            )}

            <div className="mt-auto flex items-center justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setGroupPendingDelete(null)}
                disabled={deletingGroup}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void removeGroup()}
                disabled={deletingGroup || groupPendingDelete.agents.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingGroup && (
                  <i className="ti ti-loader-2 animate-spin" aria-hidden></i>
                )}
                <i className={`ti ti-trash ${deletingGroup ? "hidden" : ""}`} aria-hidden></i>
                {t.list.deleteGroupConfirm}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {resyncCtx && (
        <ModalShell
          onClose={() => !resyncApplying && setResyncCtx(null)}
          title={formatAssistantMessage(t.resync.modalTitle, { name: resyncCtx.groupLabel })}
          closeLabel={t.resync.close}
          bodyClassName="space-y-3 pl-5 pr-4 pt-3"
          footer={
            <>
              <button
                type="button"
                onClick={() => setResyncCtx(null)}
                disabled={resyncApplying}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                {resyncResult && !resyncResult.markersMissing && resyncResult.missing.length > 0
                  ? t.cancel
                  : t.resync.close}
              </button>
              {resyncResult && !resyncResult.markersMissing && resyncResult.missing.length > 0 && (
                <button
                  type="button"
                  onClick={() => void confirmResync()}
                  disabled={resyncApplying || resyncSelected.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {resyncApplying && <i className="ti ti-loader-2 animate-spin" aria-hidden></i>}
                  {resyncApplying ? t.resync.applying : t.resync.confirm}
                </button>
              )}
            </>
          }
        >
              {resyncError && <p className="text-xs text-red-500">{resyncError}</p>}
              {!resyncResult && !resyncError && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <i className="ti ti-loader-2 animate-spin" aria-hidden></i> {t.resync.loading}
                </p>
              )}
              {resyncResult?.markersMissing && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                  {t.resync.markersMissing}
                </p>
              )}
              {resyncResult && !resyncResult.markersMissing && (
                <>
                  {/* Faltan — checkboxes preseleccionados */}
                  <div>
                    <p className="mb-1 text-xs font-medium text-foreground">
                      {t.resync.missingHeading} ({resyncResult.missing.length})
                    </p>
                    {resyncResult.missing.length === 0 ? (
                      <p className="text-[11px] text-emerald-600">{t.resync.nothingMissing}</p>
                    ) : (
                      <div className="space-y-1 rounded-md border border-border bg-muted/20 p-2">
                        {resyncResult.missing.map((m) => {
                          const on = resyncSelected.has(m.slotId);
                          return (
                            <label key={m.slotId} className="flex items-start gap-2 text-[11px] text-foreground">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() =>
                                  setResyncSelected((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(m.slotId)) next.delete(m.slotId); else next.add(m.slotId);
                                    return next;
                                  })
                                }
                                className="mt-0.5"
                              />
                              <span className="min-w-0">
                                <span className="font-medium">{m.name}</span>
                                {m.description && (
                                  <span className="block text-[10px] text-muted-foreground">{m.description}</span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Presentes — informativo */}
                  {resyncResult.present.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-foreground">
                        {t.resync.presentHeading} ({resyncResult.present.length})
                      </p>
                      <ul className="rounded-md border border-border bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                        {resyncResult.present.map((p) => (
                          <li key={p.slotId} className="flex items-center gap-1.5 truncate py-0.5" title={p.name}>
                            <i className="ti ti-circle-check text-emerald-500" aria-hidden></i> {p.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Añadidos a mano — informativo, no se tocan */}
                  {resyncResult.extra.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-foreground">
                        {t.resync.extraHeading} ({resyncResult.extra.length})
                        <span className="ml-1 font-normal text-muted-foreground">— {t.resync.extraNote}</span>
                      </p>
                      <ul className="rounded-md border border-border bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                        {resyncResult.extra.map((x) => (
                          <li key={x.agentId} className="truncate py-0.5" title={x.name}>• {x.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
        </ModalShell>
      )}

      {teamDraft && (
        <TeamEditModal
          team={teamDraft.team}
          agents={agents}
          teams={teams}
          t={t.teams}
          quickTeamLabel={_i18n.teamTemplates.openBtn}
          onQuickTeam={() => { setTeamDraft(null); setShowTemplates(true); }}
          onClose={() => setTeamDraft(null)}
          onSaved={onTeamMutated}
        />
      )}

      {teamAddCtx && (
        <TeamAddAgentsModal
          team={teamAddCtx}
          agents={agents}
          teams={teams}
          t={t.teams}
          onClose={() => setTeamAddCtx(null)}
          onSaved={onTeamMutated}
        />
      )}
    </div>
  );
}
