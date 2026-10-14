// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useModuleCatalog } from "../use-module-catalog";
/**
 * AgentsTab orchestrator hook. Holds the ENTIRE stateful body of the original
 * monolithic `AgentsTab` component — every useState/useRef/useEffect/useMemo
 * plus the (non-hook) async handlers — moved here VERBATIM and in the SAME
 * order, so the flattened sequence of primitive React-hook calls is byte-
 * identical to the monolith. The presentational views (`./AgentEditor`,
 * `./RoleEditorView`, `./views`, `./AgentsListView`) are pure children that
 * read this VM. Public props (`AgentsTabProps`) are unchanged.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  agentGroupBucket,
  assistantAgentsApi,
  assistantAgentRolesApi,
  assistantAgentTeamsApi,
  assistantModulesApi,
  assistantProjectsApi,
  assistantTeamTemplatesApi,
  type TeamTemplateResyncResult,
  fetchAssociatableConnections,
  fetchTerminalSnippetFilterOptions,
  type TerminalSnippetFilterOptions,
  PROVIDER_MODELS,
  type AgentTeam,
  type AssistantAgent,
  type AssistantAgentRole,
  type AssistantProject,
  type AssistantProjectServer,
  type AgentSuggestion,
  type ResolvedModule,
} from "../assistant-api";
import { buildAgentTree, mmNodeId } from "../agent-tree";
import { agentAvatarUri } from "../agent-avataaars";
import { useSettingsFooterAction, useSettingsHeaderOverride } from "../settings-footer";
import { openConfirm } from "@/lib/confirm";
import { formatAssistantMessage, useAssistantI18n } from "../i18n";
import { agentsTabFallback, type AgentsTabMessages } from "./messages";
import { type DraftAgent, type DraftRole, toDraft, toPayload, roleToPayload } from "./draft";

export type AgentsTabProps = {
  onLaunchAgent: (agent: AssistantAgent) => void;
  /** Active platform locale — forwarded to TeamTemplatesModal so template
   *  names/descriptions/systemPrompts render in the user's language. */
  locale?: string;
  /** Deep-link: open the editor for this agent as soon as the list loads
   *  (used by the chat header's agent chip). Consumed once per mount. */
  initialEditAgentId?: string | null;
};

export function useAgentsTab({ onLaunchAgent, locale, initialEditAgentId }: AgentsTabProps) {
  const _i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & { agentsTab?: Partial<AgentsTabMessages> };
  const _over = _i18n.agentsTab ?? {};
  const t: AgentsTabMessages = {
    ...agentsTabFallback, ..._over,
    diagram: { ...agentsTabFallback.diagram, ..._over.diagram },
    archetypes: { ...agentsTabFallback.archetypes, ..._over.archetypes },
    editor: {
      ...agentsTabFallback.editor, ..._over.editor,
      avatarAttrs: { ...agentsTabFallback.editor.avatarAttrs, ..._over.editor?.avatarAttrs },
    },
    roleEditor: { ...agentsTabFallback.roleEditor, ..._over.roleEditor },
    treeView: { ...agentsTabFallback.treeView, ..._over.treeView },
    rolesList: { ...agentsTabFallback.rolesList, ..._over.rolesList },
    list: { ...agentsTabFallback.list, ..._over.list },
    teams: { ...agentsTabFallback.teams, ..._over.teams },
    resync: { ...agentsTabFallback.resync, ..._over.resync },
  };
  const [agents, setAgents] = useState<AssistantAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftAgent | null>(null);
  // Active tab in the agent editor — the create/edit form is split into focused tabs.
  const [editorTab, setEditorTab] = useState<"general" | "model" | "hierarchy" | "tools" | "resources" | "access">("general");
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<ResolvedModule[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestArchetype, setSuggestArchetype] = useState("");
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [conns, setConns] = useState<AssistantProjectServer[]>([]);
  // Snippet pre-filter options (terminal categories/tags); null = still loading.
  const [snippetOpts, setSnippetOpts] = useState<TerminalSnippetFilterOptions | null>(null);
  // Roles (reusable profiles assigned to agents) + role management views.
  const [roles, setRoles] = useState<AssistantAgentRole[]>([]);
  // First-class teams + their modal state (create/rename, add members).
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [teamDraft, setTeamDraft] = useState<{ team: AgentTeam | null } | null>(null);
  const [teamAddCtx, setTeamAddCtx] = useState<AgentTeam | null>(null);
  const [showRoles, setShowRoles] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  // Hierarchy tree is scoped to ONE work group at a time (teamId); null ⇒ fall
  // back to the first team so the diagram is never the global agent soup.
  const [treeTeamId, setTreeTeamId] = useState<string | null>(null);
  // Inline "+ Nuevo grupo" from within the agent editor: opens a TeamEditModal
  // and, on save, auto-selects the freshly-created team into the draft.
  const [creatingTeamForDraft, setCreatingTeamForDraft] = useState(false);
  const [treeRegen, setTreeRegen] = useState(0);
  const [regenBusy, setRegenBusy] = useState(false);
  const [roleDraft, setRoleDraft] = useState<DraftRole | null>(null);
  // "Sincronizar con plantilla": per-group compare against the source template.
  const [resyncCtx, setResyncCtx] = useState<{ templateId: string; rootAgentId: string; groupLabel: string } | null>(null);
  const [resyncResult, setResyncResult] = useState<TeamTemplateResyncResult | null>(null);
  const [resyncSelected, setResyncSelected] = useState<Set<string>>(new Set());
  const [resyncApplying, setResyncApplying] = useState(false);
  const [resyncError, setResyncError] = useState<string | null>(null);

  async function openResync(templateId: string, rootAgentId: string, groupLabel: string) {
    setResyncCtx({ templateId, rootAgentId, groupLabel });
    setResyncResult(null);
    setResyncError(null);
    setResyncApplying(false);
    try {
      const r = await assistantTeamTemplatesApi.resync(templateId, rootAgentId);
      setResyncResult(r);
      setResyncSelected(new Set(r.missing.map((m) => m.slotId)));
    } catch (e) {
      setResyncError((e as Error).message);
    }
  }

  async function confirmResync() {
    if (!resyncCtx || !resyncResult || resyncApplying) return;
    const slotIds = [...resyncSelected];
    if (slotIds.length === 0) return;
    setResyncApplying(true);
    setResyncError(null);
    try {
      await assistantTeamTemplatesApi.applyMissing(resyncCtx.templateId, resyncCtx.rootAgentId, slotIds);
      setResyncCtx(null);
      setResyncResult(null);
      await reload();
      window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
    } catch (e) {
      setResyncError((e as Error).message);
    } finally {
      setResyncApplying(false);
    }
  }

  async function reload() {
    setLoading(true);
    try {
      const [ags, rls, tms] = await Promise.all([
        assistantAgentsApi.list(),
        assistantAgentRolesApi.list().catch(() => [] as AssistantAgentRole[]),
        assistantAgentTeamsApi.list().catch(() => [] as AgentTeam[]),
      ]);
      setAgents(ags);
      setRoles(rls);
      setTeams(tms);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /** Regenerate the hierarchy tree: re-pull agents from the server and force the
   *  diagram to re-render (the tree is derived from each agent's parentAgentId). */
  async function regenerateTree() {
    setRegenBusy(true);
    try {
      await reload();
      setTreeRegen((n) => n + 1);
    } finally {
      setRegenBusy(false);
    }
  }

  async function reloadRoles() {
    try { setRoles(await assistantAgentRolesApi.list()); } catch { /* ignore */ }
  }

  async function saveRole() {
    if (!roleDraft || !roleDraft.name.trim()) return;
    setSaving(true);
    try {
      if (roleDraft.id) await assistantAgentRolesApi.update(roleDraft.id, roleToPayload(roleDraft));
      else await assistantAgentRolesApi.create(roleToPayload(roleDraft));
      setRoleDraft(null);
      await reloadRoles();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(r: AssistantAgentRole) {
    if (!(await openConfirm(formatAssistantMessage(t.confirmDeleteRole, { name: r.name }), { variant: "danger" }))) return;
    try {
      await assistantAgentRolesApi.remove(r.id);
      await Promise.all([reloadRoles(), reload()]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { void reload(); }, []);
  // Deep-link from the chat header chip: once the agents list is in, jump
  // straight into the editor for the requested agent (same view the list's
  // "Editar" button opens). Consumed once so in-modal navigation stays free.
  const initialEditConsumed = useRef(false);
  useEffect(() => {
    if (!initialEditAgentId || initialEditConsumed.current || loading) return;
    initialEditConsumed.current = true;
    const target = agents.find((a) => a.id === initialEditAgentId);
    if (target) {
      setEditorTab("general");
      setDraft(toDraft(target));
    }
  }, [initialEditAgentId, loading, agents]);
  useModuleCatalog(setModules);
  // Tool catalog for the allowlist editor (active modules + their tools).
  useEffect(() => {

    // ALL projects: the "attach projects" picker renders the nested tree and
    // the graph-index picker lists any project with a ready index.
    void assistantProjectsApi.list().then(setProjects).catch(() => { /* ignore */ });
    // Registered servers the agent can be associated with.
    void fetchAssociatableConnections().then(setConns).catch(() => { /* ignore */ });
    // Terminal snippet categories/tags for the pre-filter (never throws; ok:false
    // when the user has no terminal permission → fields render disabled).
    void fetchTerminalSnippetFilterOptions().then(setSnippetOpts);
  }, []);

  const modelOptions = useMemo(
    // Dep on `providerId` (a primitive string), not the whole `draft` object —
    // otherwise this re-runs on every keystroke and produces a new array
    // reference, which the MermaidDiagram and other downstream consumers
    // would treat as a fresh dep and could trigger a re-render → re-fetch → re-merge
    // loop into React #300.
    () => (draft ? PROVIDER_MODELS[draft.providerId] ?? [] : []),
    [draft?.providerId],
  );

  // Hierarchy tree diagram (Mermaid) + per-node avatar images, memoized so the
  // diagram only re-renders when the agents change. Scoped to ONE work group:
  // treeTeamId (or the first team as default) filters the agents before the
  // tree is built so it shows a single group's hierarchy at a time.
  const effectiveTreeTeamId = treeTeamId ?? teams[0]?.id ?? null;
  const treeAgents = useMemo(
    () => agents.filter((a) => (a.teamId ?? null) === effectiveTreeTeamId),
    [agents, effectiveTreeTeamId],
  );
  const treeCode = useMemo(
    () => buildAgentTree(treeAgents, { emptyLabel: t.diagram.empty, connLabel: t.diagram.connection }),
    [treeAgents, t.diagram.empty, t.diagram.connection],
  );
  const treeImages = useMemo(
    () => Object.fromEntries(treeAgents.map((a) => [mmNodeId(a.id), agentAvatarUri(a.avatarConfig, a.id)])),
    [treeAgents],
  );
  const teamsById = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);

  // List view grouping: keep this hook above any conditional early returns so
  // the hook order stays stable when switching between list and editor modes.
  // Buckets = first-class teams (via agentGroupBucket) + legacy name-prefix
  // groups. EMPTY teams are seeded so a freshly-created team stays visible.
  const agentGroups = useMemo(() => {
    const groups = new Map<string, { label: string; team?: AgentTeam; agents: AssistantAgent[] }>();
    // Seed every team first so teams with 0 members still render.
    for (const tm of teams) {
      groups.set(`team:${tm.id}`, { label: tm.name, team: tm, agents: [] });
    }
    for (const a of agents) {
      const b = agentGroupBucket(a, teamsById);
      const existing = groups.get(b.key);
      if (existing) existing.agents.push(a);
      else groups.set(b.key, { label: b.label, team: b.team, agents: [a] });
    }
    // Alphabetical by label; the legacy "General" bucket always sorts last.
    const ordered = [...groups.entries()]
      .sort((a, b) => {
        const aGen = a[0] === "General";
        const bGen = b[0] === "General";
        if (aGen !== bGen) return aGen ? 1 : -1;
        return a[1].label.localeCompare(b[1].label, undefined, { sensitivity: "base" });
      })
      .map(([k]) => k);
    return { groups, ordered };
  }, [agents, teams, teamsById]);

  // AI assist: send the chosen archetype's brief to the LLM and prefill the form.
  async function runSuggest(brief: string) {
    if (!draft || !brief) return;
    setSuggesting(true);
    setError(null);
    try {
      const s: AgentSuggestion = await assistantAgentsApi.suggest(brief, draft.providerId);
      setDraft((d) => {
        if (!d) return d;
        const hasTools = Array.isArray(s.allowedTools) && s.allowedTools.length > 0;
        return {
          ...d,
          name: s.name || d.name,
          description: s.description || d.description,
          systemPrompt: s.systemPrompt || d.systemPrompt,
          providerId: s.providerId ?? d.providerId,
          allowAllTools: hasTools ? false : d.allowAllTools,
          allowedTools: hasTools ? new Set(s.allowedTools as string[]) : d.allowedTools,
        };
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(false);
      setSuggestArchetype("");
    }
  }

  async function save() {
    if (!draft || !draft.name.trim()) return;
    // Group (team) is now mandatory: bounce to the Hierarchy tab if missing so
    // the required selector is in view. (UI-only guard — programmatic agent
    // creation paths still allow a null teamId; see the multi-agent/template flows.)
    if (!draft.teamId) {
      setError(t.teams.groupRequired);
      setEditorTab("hierarchy");
      return;
    }
    setSaving(true);
    try {
      if (draft.id) await assistantAgentsApi.update(draft.id, toPayload(draft));
      else await assistantAgentsApi.create(toPayload(draft));
      setDraft(null);
      await reload();
      window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: AssistantAgent) {
    if (!(await openConfirm(formatAssistantMessage(t.confirmDeleteAgent, { name: a.name }), { variant: "danger" }))) return;
    try {
      await assistantAgentsApi.remove(a.id);
      await reload();
      window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Detach a single agent from its team (agent is NOT deleted).
  async function removeFromTeam(a: AssistantAgent) {
    if (!(await openConfirm(t.teams.removeFromTeamConfirm, { variant: "danger" }))) return;
    try {
      await assistantAgentsApi.update(a.id, { teamId: null });
      await reload();
      window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Delete a team; members are only detached (backend returns detachedCount).
  async function deleteTeam(team: AgentTeam) {
    if (!(await openConfirm(`${t.teams.deleteTeamConfirm}\n\n${t.teams.deleteTeamKeepsAgentsNote}`, { variant: "danger" }))) return;
    try {
      await assistantAgentTeamsApi.remove(team.id);
      await reload();
      window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Shared onSaved for the team create/rename + add-members modals.
  function onTeamMutated() {
    setTeamDraft(null);
    setTeamAddCtx(null);
    void reload();
    window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
  }

  // Group-bulk-delete state + handler. "group" is a frontend-derived bucket
  // (no backend concept); we iterate the agents in that bucket and reuse the
  // existing single-agent DELETE endpoint. Shared agents owned by other users
  // are pre-filtered (backend would reject them with 403).
  const [groupPendingDelete, setGroupPendingDelete] =
    useState<{ label: string; agents: AssistantAgent[]; sharedSkipped: number } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Close the group-delete confirmation modal with Escape.
  useEffect(() => {
    if (!groupPendingDelete) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deletingGroup) setGroupPendingDelete(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupPendingDelete, deletingGroup]);

  async function removeGroup() {
    if (!groupPendingDelete || deletingGroup) return;
    const targets = groupPendingDelete.agents;
    if (targets.length === 0) {
      setGroupPendingDelete(null);
      return;
    }
    setDeletingGroup(true);
    const failures: string[] = [];
    for (const a of targets) {
      try {
        await assistantAgentsApi.remove(a.id);
      } catch (e) {
        failures.push(a.name);
      }
    }
    await reload();
    window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
    setDeletingGroup(false);
    setGroupPendingDelete(null);
    if (failures.length) {
      setError(formatAssistantMessage(t.list.deleteGroupErrors, { names: failures.join(", ") }));
    }
  }

  function duplicate(a: AssistantAgent) {
    setEditorTab("general");
    setDraft({ ...toDraft(a), id: undefined, name: formatAssistantMessage(t.duplicateName, { name: a.name }) });
  }

  // Work-group cards render in a responsive grid; expanded groups are tracked
  // here (controlled CollapsibleSection) so they can span the full row. Acordeón:
  // solo una tarjeta de grupo abierta a la vez (openGroupKey único), abrir una
  // cierra la anterior.
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

  // While the agent editor is open, its primary action (save/create) lives in
  // the settings-modal footer next to "Close". Re-published on each draft/state
  // change so the label and disabled state stay in sync; cleared on unmount.
  const setFooterAction = useSettingsFooterAction();
  useEffect(() => {
    if (!setFooterAction) return;
    if (!draft) {
      setFooterAction(null);
      return;
    }
    setFooterAction({
      label: saving ? t.saving : draft.id ? t.saveChanges : t.editor.createAgent,
      disabled: saving || !draft.name.trim() || !draft.teamId,
      onClick: () => { void save(); },
    });
  }, [setFooterAction, draft, saving, t.saving, t.saveChanges, t.editor.createAgent]);
  useEffect(() => () => setFooterAction?.(null), [setFooterAction]);

  // While the agent editor is open, take over the settings-modal header: the
  // title/description reflect create-vs-edit and the header's back arrow becomes
  // the SINGLE way to cancel the form (returns to the agents list). Cleared when
  // the editor closes so the header reverts to the section's own title/back.
  const setHeaderOverride = useSettingsHeaderOverride();
  useEffect(() => {
    if (!setHeaderOverride) return;
    if (!draft) {
      setHeaderOverride(null);
      return;
    }
    setHeaderOverride({
      title: draft.id ? t.editor.headerTitleEdit : t.editor.headerTitleNew,
      description: draft.id ? t.editor.headerDescEdit : t.editor.headerDescNew,
      backLabel: t.editor.backToList,
      onBack: () => setDraft(null),
    });
  }, [setHeaderOverride, draft, t.editor.headerTitleEdit, t.editor.headerTitleNew, t.editor.headerDescEdit, t.editor.headerDescNew, t.editor.backToList]);
  useEffect(() => () => setHeaderOverride?.(null), [setHeaderOverride]);

  return {
    onLaunchAgent, locale, initialEditAgentId, t, _i18n,
    agents, setAgents, loading, setLoading, error, setError, draft, setDraft,
    editorTab, setEditorTab, saving, setSaving, modules, setModules,
    suggesting, setSuggesting, suggestArchetype, setSuggestArchetype,
    projects, setProjects, conns, setConns, snippetOpts, setSnippetOpts,
    roles, setRoles, teams, setTeams, teamDraft, setTeamDraft,
    teamAddCtx, setTeamAddCtx, showRoles, setShowRoles, showTree, setShowTree,
    showTemplates, setShowTemplates, treeTeamId, setTreeTeamId,
    creatingTeamForDraft, setCreatingTeamForDraft, treeRegen, setTreeRegen,
    regenBusy, setRegenBusy, roleDraft, setRoleDraft,
    resyncCtx, setResyncCtx, resyncResult, setResyncResult,
    resyncSelected, setResyncSelected, resyncApplying, setResyncApplying,
    resyncError, setResyncError, groupPendingDelete, setGroupPendingDelete,
    deletingGroup, setDeletingGroup, openGroupKey, setOpenGroupKey,
    initialEditConsumed,
    modelOptions, effectiveTreeTeamId, treeAgents, treeCode, treeImages,
    teamsById, agentGroups, setFooterAction, setHeaderOverride,
    openResync, confirmResync, reload, regenerateTree, reloadRoles, saveRole,
    removeRole, runSuggest, save, remove, removeFromTeam, deleteTeam,
    onTeamMutated, removeGroup, duplicate,
  };
}

export type AgentsTabVM = ReturnType<typeof useAgentsTab>;
