import { FormDrawer } from "../../ui/FormDrawer";
import { useConfirmation } from "../../ui/useConfirmation";
import { ConfirmationModal } from "../../ui/ConfirmationModal";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AgentsModule (RN) — RAÍZ del módulo "Agentes IA" (réplica nativa del
 * AgentsTab web). Reemplaza a `AgentsSubTab` (superconjunto de sus props).
 *
 * Carga agents/roles/teams/modules/projects/skills/servers por el túnel SSO
 * (`agents-api`) y enruta —por estado local— entre: LISTA agrupada por
 * equipos/grupos (acordeón, un grupo abierto a la vez), ÁRBOL jerárquico
 * (lista jerárquica nativa), LISTA de roles + editor de rol, editor de agente (6
 * pestañas), y plantillas de equipo. Hospeda además los modales de equipo
 * (crear/renombrar, añadir miembros) y de resync con plantilla.
 *
 * Tras CADA mutación emite `agentsEvents.emit()`; el propio módulo está suscrito
 * y recarga (y así se sincronizan otras instancias montadas). El bridge de chat
 * lo cablea el padre vía `onLaunchAgent`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ArrowLeft, Bot, Copy, FolderMinus, GitBranch, LayoutTemplate, MessageSquarePlus,
  MessagesSquare, Network, Pencil, Plus, Radio, RefreshCw, Shield, Trash2, UserMinus,
  UserPlus, Users,
} from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type { Messages } from "../../../i18n/messages";
import { ProviderIcon } from "../../ProviderIcon";
import { Button } from "../../ui/Button";
import { Select } from "../../ui/Select";
import { s } from "../styles";
import { LoadState } from "../parts";
import type {
  AssistantAgent, AgentRole, AgentTeam, AgentTeamPayload, AgentResolvedModule,
  AssistantProject, AssistantSkill, RegisteredServerView, AssistantProviderId,
} from "../types";
import {
  agentsApi, agentRolesApi, agentTeamsApi, modulesApi, projectsApi, skillsApi, registeredServersApi,
} from "./agents-api";
import { agentGroupBucket, rankAgentsInGroup } from "./agents-grouping";
import { agentsStrings, formatStr, type AgentsStrings } from "./agents-i18n";
import { agentsEvents } from "./agents-events";
import { AgentAvatar } from "./AgentAvatar";
import { AgentTree } from "./AgentTree";
import { CollapsibleSection } from "./CollapsibleSection";
import { AgentEditor, emptyDraft, toDraft, toPayload, type DraftAgent } from "./AgentEditor";
import { RoleEditor, emptyRole, roleToDraft, roleToPayload, type DraftRole } from "./RoleEditor";
import { TeamEditModal } from "./TeamEditModal";
import { TeamAddAgentsModal } from "./TeamAddAgentsModal";
import { TeamTemplatesModal } from "./TeamTemplatesModal";

type T = Messages["assistantSettings"];

/** Colores nombrados (mismo set que TeamEditModal/RoleEditor) → hex para RN. */
const COLOR_HEX: Record<string, string> = {
  violet: "#8b5cf6", blue: "#3b82f6", emerald: "#10b981", amber: "#f59e0b",
  red: "#ef4444", slate: "#64748b", cyan: "#06b6d4", pink: "#ec4899",
};
const colorHex = (c?: string): string => COLOR_HEX[c ?? "violet"] ?? COLOR_HEX.violet;

export function AgentsModule({
  panelId,
  token,
  language,
  t,
  tokens,
  onLaunchAgent,
  initialEditAgentId,
}: {
  panelId: string;
  token: string;
  language: string;
  t: T;
  tokens: ThemeTokens;
  /** Iniciar chat con este agente (el padre liga el bridge + cierra el drawer). */
  onLaunchAgent?: (agent: AssistantAgent) => void;
  /** Deep-link: abre el editor de este agente al montar (una sola vez). */
  initialEditAgentId?: string | null;
}) {
  const str = useMemo(() => agentsStrings(language), [language]);

  const [agents, setAgents] = useState<AssistantAgent[]>([]);
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [modules, setModules] = useState<AgentResolvedModule[]>([]);
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [skills, setSkills] = useState<AssistantSkill[]>([]);
  const [servers, setServers] = useState<RegisteredServerView[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  // Error de guardado del ROL, separado del `error` de la lista/agente para que
  // se pinte DENTRO del modal del RoleEditor y no filtre el error del agente.
  const [roleError, setRoleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sub-vistas / editores (router por estado local).
  const [draft, setDraft] = useState<DraftAgent | null>(null);
  const [roleDraft, setRoleDraft] = useState<DraftRole | null>(null);
  const [teamDraft, setTeamDraft] = useState<{ team: AgentTeam | null } | null>(null);
  const [teamAddCtx, setTeamAddCtx] = useState<AgentTeam | null>(null);
  const [creatingTeamForDraft, setCreatingTeamForDraft] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [resyncCtx, setResyncCtx] = useState<{ templateId: string; rootAgentId: string; teamName?: string } | null>(null);
  const [treeTeamId, setTreeTeamId] = useState<string | null>(null);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [groupPendingDelete, setGroupPendingDelete] = useState<{ label: string; agents: AssistantAgent[]; sharedSkipped: number } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // ── Carga (+ re-suscripción a agentsEvents) ────────────────────────────────
  // `loadGen` desecha respuestas obsoletas: cada `load()` (inicial o disparado por
  // `agentsEvents.emit()`) incrementa la generación; al resolver, si la generación
  // capturada ya no es la vigente (o el componente se desmontó) se descarta el
  // setState. Evita el race "último-en-resolver-gana" y el setState tras unmount.
  const firstLoad = useRef(true);
  const loadGen = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(() => {
    const gen = ++loadGen.current;
    if (firstLoad.current) setStatus("loading");
    void Promise.all([
      agentsApi.list(panelId, token),
      agentRolesApi.list(panelId, token),
      agentTeamsApi.list(panelId, token),
      modulesApi.list(panelId, token),
      projectsApi.list(panelId, token),
      skillsApi.list(panelId, token),
      registeredServersApi.list(panelId, token),
    ]).then(([ag, ro, tm, mo, pr, sk, sv]) => {
      if (!mounted.current || gen !== loadGen.current) return;
      setAgents(ag); setRoles(ro); setTeams(tm);
      setModules(mo); setProjects(pr); setSkills(sk); setServers(sv);
      setStatus("ready");
      firstLoad.current = false;
    }).catch(() => {
      if (!mounted.current || gen !== loadGen.current) return;
      if (firstLoad.current) setStatus("error");
    });
  }, [panelId, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => agentsEvents.subscribe(() => load()), [load]);

  // Deep-link desde el chip del chat: abre el editor del agente pedido una vez.
  const initConsumed = useRef(false);
  useEffect(() => {
    if (!initialEditAgentId || initConsumed.current || status !== "ready") return;
    initConsumed.current = true;
    const target = agents.find((a) => a.id === initialEditAgentId);
    if (target) setDraft(toDraft(target));
  }, [initialEditAgentId, status, agents]);

  // ── Mutaciones (cada una emite → recarga vía suscripción) ───────────────────
  const saveAgent = async () => {
    if (!draft || !draft.name.trim() || busy) return;
    if (!draft.teamId) { setError(str.teams.groupRequired); return; }
    setBusy(true); setError(null);
    try {
      // `luxAssistantProxy` NUNCA lanza: devuelve null ante fallo (red, validación
      // del backend, sesión caída). Comprobamos el resultado para NO cerrar el
      // editor ni descartar el borrador en un guardado fallido (paridad con el web,
      // que lanza y mantiene el editor abierto con el error).
      const saved = draft.id
        ? await agentsApi.update(panelId, token, draft.id, toPayload(draft))
        : await agentsApi.create(panelId, token, toPayload(draft));
      if (!saved) { setError(str.saveFailed); return; }
      setDraft(null);
      agentsEvents.emit();
    } finally { setBusy(false); }
  };

  const removeAgent = async (a: AssistantAgent) => {
    setBusy(true); setError(null);
    try {
      const ok = await agentsApi.remove(panelId, token, a.id);
      if (!ok) { setError(str.saveFailed); return; }
      agentsEvents.emit();
    } finally { setBusy(false); }
  };

  const removeFromTeam = async (a: AssistantAgent) => {
    setBusy(true);
    try { await agentsApi.update(panelId, token, a.id, { teamId: null }); agentsEvents.emit(); }
    finally { setBusy(false); }
  };

  const duplicate = (a: AssistantAgent) => {
    setDraft({ ...toDraft(a), id: undefined, name: formatStr(str.duplicateName, { name: a.name }) });
  };

  const saveRole = async () => {
    if (!roleDraft || !roleDraft.name.trim() || busy) return;
    setBusy(true); setRoleError(null);
    try {
      const saved = roleDraft.id
        ? await agentRolesApi.update(panelId, token, roleDraft.id, roleToPayload(roleDraft))
        : await agentRolesApi.create(panelId, token, roleToPayload(roleDraft));
      if (!saved) { setRoleError(str.saveFailed); return; }
      setRoleDraft(null);
      agentsEvents.emit();
    } finally { setBusy(false); }
  };

  const removeRole = async (r: AgentRole) => {
    setBusy(true); setError(null);
    try {
      const ok = await agentRolesApi.remove(panelId, token, r.id);
      if (!ok) { setError(str.saveFailed); return; }
      agentsEvents.emit();
    } finally { setBusy(false); }
  };

  const saveTeam = async (payload: AgentTeamPayload) => {
    setBusy(true); setError(null);
    try {
      const team = teamDraft?.team?.id
        ? await agentTeamsApi.update(panelId, token, teamDraft.team.id, payload)
        : await agentTeamsApi.create(panelId, token, payload);
      if (!team) { setError(str.saveFailed); return; }
      setTeamDraft(null);
      if (creatingTeamForDraft) {
        setDraft((d) => (d ? { ...d, teamId: team.id } : d));
      }
      setCreatingTeamForDraft(false);
      agentsEvents.emit();
    } finally { setBusy(false); }
  };

  const deleteTeam = async (team: AgentTeam) => {
    setBusy(true); setError(null);
    try {
      const detached = await agentTeamsApi.remove(panelId, token, team.id);
      if (detached === null) { setError(str.saveFailed); return; }
      agentsEvents.emit();
    } finally { setBusy(false); }
  };

  const addAgentsToTeam = async (ids: string[]) => {
    if (!teamAddCtx) return;
    setBusy(true);
    try {
      for (const id of ids) await agentsApi.update(panelId, token, id, { teamId: teamAddCtx.id });
      setTeamAddCtx(null);
      agentsEvents.emit();
    } finally { setBusy(false); }
  };

  const removeGroup = async () => {
    if (!groupPendingDelete || deletingGroup) return;
    const targets = groupPendingDelete.agents;
    if (targets.length === 0) { setGroupPendingDelete(null); return; }
    setDeletingGroup(true);
    setError(null);
    let anyFailed = false;
    for (const a of targets) {
      const ok = await agentsApi.remove(panelId, token, a.id).catch(() => false);
      if (!ok) anyFailed = true;
    }
    setDeletingGroup(false);
    setGroupPendingDelete(null);
    if (anyFailed) setError(str.saveFailed);
    agentsEvents.emit();
  };

  // ── Derivados (agrupación de la lista) ─────────────────────────────────────
  const teamsById = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const roleNameById = useMemo(() => new Map(roles.map((r) => [r.id, r.name] as const)), [roles]);
  const roleSpawnById = useMemo(() => new Map(roles.map((r) => [r.id, Boolean(r.canSpawnChats)] as const)), [roles]);
  const agentNameById = useMemo(() => new Map(agents.map((a) => [a.id, a.name] as const)), [agents]);

  const agentGroups = useMemo(() => {
    const groups = new Map<string, { label: string; team?: AgentTeam; agents: AssistantAgent[] }>();
    for (const tm of teams) groups.set(`team:${tm.id}`, { label: tm.name, team: tm, agents: [] });
    for (const a of agents) {
      const b = agentGroupBucket(a, teamsById);
      const ex = groups.get(b.key);
      if (ex) ex.agents.push(a);
      else groups.set(b.key, { label: b.label, team: b.team, agents: [a] });
    }
    const ordered = [...groups.entries()]
      .sort((a, b) => {
        const aG = a[0] === "General"; const bG = b[0] === "General";
        if (aG !== bG) return aG ? 1 : -1;
        return a[1].label.localeCompare(b[1].label, undefined, { sensitivity: "base" });
      })
      .map(([k]) => k);
    return { groups, ordered };
  }, [agents, teams, teamsById]);

  // Árbol: acotado a UN grupo (equipo). Sin equipos → agentes sueltos.
  const effectiveTreeTeamId = treeTeamId ?? teams[0]?.id ?? null;
  const treeAgents = useMemo(
    () => agents.filter((a) => (a.teamId ?? null) === effectiveTreeTeamId),
    [agents, effectiveTreeTeamId],
  );

  const errBanner = error
    ? <Text style={[st.err, { color: tokens.danger }]}>{formatStr(str.errorPrefix, { message: error })}</Text>
    : null;

  // ── Router de vistas ───────────────────────────────────────────────────────
  let body: React.ReactNode;

  if (status !== "ready") {
    body = <LoadState t={t} tokens={tokens} mode={status === "error" ? "error" : "loading"} onRetry={() => { firstLoad.current = true; load(); }} />;
  } else if (draft) {
    // ── Editor de agente (vista completa) ──
    body = (
      <ScrollView contentContainerStyle={st.viewPad} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <BackBar label={str.editor.backToList} onBack={() => setDraft(null)} tokens={tokens} />
        {errBanner}
        <AgentEditor
          draft={draft}
          onChangeDraft={setDraft}
          agents={agents}
          roles={roles}
          teams={teams}
          modules={modules}
          projects={projects}
          skills={skills}
          servers={servers}
          snippetOptions={null}
          busy={busy}
          onSave={() => void saveAgent()}
          onCancel={() => setDraft(null)}
          onCreateTeam={() => { setCreatingTeamForDraft(true); setTeamDraft({ team: null }); }}
          onSuggest={(brief, providerId) => agentsApi.suggest(panelId, token, brief, providerId)}
          tokens={tokens}
          str={str}
          language={language}
        />
      </ScrollView>
    );
  } else if (showTree) {
    // ── Árbol jerárquico ──
    body = (
      <View style={{ flex: 1 }}>
        <View style={st.headerRow}>
          <BackBar label={str.backToAgents} onBack={() => setShowTree(false)} tokens={tokens} />
          <Button
            size="sm"
            variant="ghost"
            label={busy ? str.treeView.regenerating : str.treeView.regenerate}
            icon={<RefreshCw size={14} color={tokens.textSecondary} />}
            loading={busy}
            onPress={() => { firstLoad.current = false; load(); }}
          />
        </View>
        {teams.length > 0 ? (
          <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
            <Select
              value={effectiveTreeTeamId ?? ""}
              options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
              placeholder={str.teams.teamSelectorPlaceholder}
              onChange={(v) => setTreeTeamId(v || null)}
            />
          </View>
        ) : null}
        <Text style={[st.hint, { color: tokens.textMuted }]}>{str.treeView.description}</Text>
        <View style={{ flex: 1, paddingHorizontal: 14, paddingBottom: 14 }}>
          <AgentTree agents={treeAgents} onPickAgent={onLaunchAgent} roleNameById={roleNameById} tokens={tokens} str={str} />
        </View>
      </View>
    );
  } else if (showRoles) {
    // ── Lista de roles ──
    const agentsByRole = (roleId: string) => agents.filter((a) => a.roleId === roleId).length;
    body = (
      <ScrollView contentContainerStyle={st.viewPad} nestedScrollEnabled>
        <View style={st.headerRow}>
          <BackBar label={str.backToAgents} onBack={() => setShowRoles(false)} tokens={tokens} />
          <Button size="sm" variant="primary" label={str.rolesList.newRole} icon={<Plus size={15} color="#fff" />} onPress={() => { setRoleError(null); setRoleDraft(emptyRole()); }} />
        </View>
        <Text style={[st.hint, { color: tokens.textMuted, paddingHorizontal: 0 }]}>{str.rolesList.description}</Text>
        {errBanner}
        {roles.length === 0 ? (
          <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, alignItems: "center", gap: 4 }]}>
            <Shield size={26} color={tokens.textMuted} />
            <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.rolesList.emptyTitle}</Text>
            <Text style={[s.cardDesc, { color: tokens.textMuted, textAlign: "center" }]}>{str.rolesList.emptyDesc}</Text>
          </View>
        ) : (
          roles.map((r) => (
            <View key={r.id} style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
              <View style={s.cardRow}>
                <View style={[s.iconBox, { backgroundColor: colorHex(r.color) + "22" }]}>
                  <Shield size={16} color={colorHex(r.color)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: tokens.textPrimary }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={2}>{r.description || str.noDescription}</Text>
                </View>
              </View>
              <View style={s.rowStart}>
                <Pill tokens={tokens}>{r.allowedTools == null ? str.allTools : formatStr(str.toolsCount, { count: r.allowedTools.length })}</Pill>
                <Pill tokens={tokens}>{formatStr(str.rolesList.agentsCount, { count: agentsByRole(r.id) })}</Pill>
                {r.relation === "shared" && r.ownerName ? <Pill tokens={tokens}>{"· " + r.ownerName}</Pill> : null}
              </View>
              <View style={s.actionsRow}>
                <Button size="sm" variant="ghost" label={str.editBtn} icon={<Pencil size={14} color={tokens.textSecondary} />} onPress={() => { setRoleError(null); setRoleDraft(roleToDraft(r)); }} />
                <IconConfirm title={str.deleteTitle} message={formatStr(str.confirmDeleteRole, { name: r.name })} cancelLabel={str.cancel} icon={<Trash2 size={16} color={tokens.danger} />} color={tokens.danger} tokens={tokens} disabled={busy} onConfirm={() => removeRole(r)} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  } else {
    // ── Lista de agentes (agrupada) ──
    body = (
      <ScrollView contentContainerStyle={st.viewPad} nestedScrollEnabled>
        <View style={st.toolbar}>
          <Text style={[st.hint, { color: tokens.textMuted, flex: 1, minWidth: 140, paddingHorizontal: 0 }]}>{str.list.description}</Text>
          <View style={st.toolbarBtns}>
            <Button size="sm" variant="ghost" label={str.list.treeBtn} icon={<Network size={14} color={tokens.textSecondary} />} onPress={() => setShowTree(true)} />
            <Button size="sm" variant="ghost" label={str.list.rolesBtn + (roles.length > 0 ? ` (${roles.length})` : "")} icon={<Shield size={14} color={tokens.textSecondary} />} onPress={() => setShowRoles(true)} />
            <Button size="sm" variant="ghost" label={str.teams.newTeamBtn} icon={<Users size={14} color={tokens.brand} />} onPress={() => { setCreatingTeamForDraft(false); setTeamDraft({ team: null }); }} />
            {/* Plantillas: icono-solo (AgentsStrings no expone una clave de rótulo;
                el asistente de plantillas trae sus propios textos). */}
            <IconBtn icon={<LayoutTemplate size={16} color={tokens.textSecondary} />} tokens={tokens} onPress={() => setShowTemplates(true)} />
            <Button size="sm" variant="primary" label={str.list.newAgent} icon={<Plus size={15} color="#fff" />} onPress={() => setDraft(emptyDraft())} />
          </View>
        </View>

        {errBanner}

        {agents.length === 0 ? (
          <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, alignItems: "center", gap: 4 }]}>
            <Bot size={28} color={tokens.textMuted} />
            <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{str.list.emptyTitle}</Text>
            <Text style={[s.cardDesc, { color: tokens.textMuted, textAlign: "center" }]}>{str.list.emptyDesc}</Text>
          </View>
        ) : (
          agentGroups.ordered.map((key) => {
            const bucket = agentGroups.groups.get(key);
            if (!bucket) return null;
            const list = bucket.agents;
            const team = bucket.team;
            const isTeam = Boolean(team);
            const isGeneral = key === "General";
            if (list.length === 0 && !isTeam) return null;
            const groupOpen = openGroupKey === key;
            const groupTitle = isGeneral ? str.list.noRoleGroupTitle : bucket.label;
            const groupDesc = isGeneral
              ? str.list.noRoleGroupDesc
              : list.length === 0
                ? str.teams.emptyTeamHint
                : formatStr(str.list.groupCount, { count: list.length });
            const color = team?.color || "violet";
            const deletable = isGeneral ? [] : list.filter((a) => a.relation !== "shared");
            const sharedSkipped = list.length - deletable.length;
            const groupIds = new Set(list.map((a) => a.id));
            const groupRoot = isGeneral ? undefined : list.find((a) => !a.parentAgentId || !groupIds.has(a.parentAgentId));
            const resyncTemplateId = groupRoot?.templateId;
            const ranks = rankAgentsInGroup(list);

            return (
              <CollapsibleSection
                key={key}
                open={groupOpen}
                onToggle={() => setOpenGroupKey(groupOpen ? null : key)}
                tokens={tokens}
                title={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[s.iconBox, { backgroundColor: colorHex(color) + "22", width: 30, height: 30 }]}>
                      <Users size={16} color={colorHex(color)} />
                    </View>
                    <Text style={[s.cardTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
                      {groupTitle} <Text style={{ color: tokens.textMuted, fontWeight: "400" }}>({list.length})</Text>
                    </Text>
                  </View>
                }
                subtitle={groupDesc}
                right={
                  !isGeneral ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      {resyncTemplateId && groupRoot ? (
                        <IconBtn icon={<RefreshCw size={15} color={tokens.textMuted} />} tokens={tokens} onPress={() => setResyncCtx({ templateId: resyncTemplateId, rootAgentId: groupRoot.id, teamName: groupTitle })} />
                      ) : null}
                      {isTeam && team ? (
                        <>
                          <IconBtn icon={<Pencil size={15} color={tokens.textMuted} />} tokens={tokens} onPress={() => { setCreatingTeamForDraft(false); setTeamDraft({ team }); }} />
                          <IconBtn icon={<UserPlus size={15} color={tokens.textMuted} />} tokens={tokens} onPress={() => setTeamAddCtx(team)} />
                          <IconConfirm title={str.teams.deleteTeamBtn} message={`${str.teams.deleteTeamConfirm} ${str.teams.deleteTeamKeepsAgentsNote}`} cancelLabel={str.cancel} icon={<FolderMinus size={15} color="#f59e0b" />} color="#f59e0b" tokens={tokens} disabled={busy} onConfirm={() => deleteTeam(team)} />
                        </>
                      ) : null}
                      <IconBtn
                        icon={<Trash2 size={15} color={tokens.danger} />}
                        tokens={tokens}
                        disabled={deletable.length === 0 || busy}
                        onPress={() => setGroupPendingDelete({ label: groupTitle, agents: deletable, sharedSkipped })}
                      />
                    </View>
                  ) : undefined
                }
              >
                <View style={{ padding: 10, gap: 10 }}>
                  {list.map((a) => (
                    <AgentCard
                      key={a.id}
                      a={a}
                      rank={ranks.get(a.id)}
                      roleName={a.roleId ? roleNameById.get(a.roleId) : undefined}
                      parentName={a.parentAgentId ? agentNameById.get(a.parentAgentId) : undefined}
                      spawn={a.canSpawnChats || (a.roleId ? Boolean(roleSpawnById.get(a.roleId)) : false)}
                      inTeam={Boolean(a.teamId && teamsById.has(a.teamId))}
                      busy={busy}
                      tokens={tokens}
                      str={str}
                      onLaunch={onLaunchAgent ? () => onLaunchAgent(a) : undefined}
                      onEdit={() => setDraft(toDraft(a))}
                      onDuplicate={() => duplicate(a)}
                      onRemoveFromTeam={() => removeFromTeam(a)}
                      onDelete={() => removeAgent(a)}
                    />
                  ))}
                </View>
              </CollapsibleSection>
            );
          })
        )}
      </ScrollView>
    );
  }

  // ── Overlays (siempre montados) ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {body}

      {/* Editor de rol */}
      <FormDrawer
        visible={roleDraft !== null}
        onClose={() => { setRoleDraft(null); setRoleError(null); }}
        title={roleDraft?.id ? str.roleEditor.titleEdit : str.roleEditor.titleNew}
        language={language}
      >
        {roleDraft ? (
          <RoleEditor
            draft={roleDraft}
            onChangeDraft={setRoleDraft}
            modules={modules}
            busy={busy}
            error={roleError}
            onSave={() => void saveRole()}
            onCancel={() => { setRoleDraft(null); setRoleError(null); }}
            tokens={tokens}
            str={str}
          />
        ) : null}
      </FormDrawer>

      {/* Crear / renombrar equipo */}
      <TeamEditModal
        visible={teamDraft !== null}
        team={teamDraft?.team}
        busy={busy}
        onSave={(payload) => void saveTeam(payload)}
        onClose={() => { setTeamDraft(null); setCreatingTeamForDraft(false); }}
        tokens={tokens}
        str={str}
        language={language}
      />

      {/* Añadir miembros a un equipo */}
      {teamAddCtx ? (
        <TeamAddAgentsModal
          visible
          team={teamAddCtx}
          agents={agents}
          teams={teams}
          busy={busy}
          onAdd={(ids) => void addAgentsToTeam(ids)}
          onClose={() => setTeamAddCtx(null)}
          tokens={tokens}
          str={str}
          language={language}
          t={t}
        />
      ) : null}

      {/* Plantillas de equipo (asistente) */}
      <TeamTemplatesModal
        visible={showTemplates}
        panelId={panelId}
        token={token}
        onApplied={() => { setShowTemplates(false); agentsEvents.emit(); }}
        onClose={() => setShowTemplates(false)}
        tokens={tokens}
        str={str}
        language={language}
      />

      {/* Resync de un equipo con su plantilla */}
      {resyncCtx ? (
        <TeamTemplatesModal
          visible
          panelId={panelId}
          token={token}
          resyncTarget={resyncCtx}
          onApplied={() => { setResyncCtx(null); agentsEvents.emit(); }}
          onClose={() => setResyncCtx(null)}
          tokens={tokens}
          str={str}
          language={language}
        />
      ) : null}

      {/* Confirmación de borrado de grupo */}
      <ConfirmationModal visible={groupPendingDelete !== null} submitting={deletingGroup}
        onCancel={() => setGroupPendingDelete(null)} onConfirm={() => void removeGroup()}
        title={groupPendingDelete ? formatStr(str.list.deleteGroupModalTitle, { name: groupPendingDelete.label }) : ""}
        language={language} confirmLabel={str.list.deleteGroupConfirm} cancelLabel={str.cancel}
      >
        {groupPendingDelete ? (
          <View style={{ gap: 8 }}>
            <Text style={[s.cardDesc, { color: tokens.textSecondary }]}>
              {formatStr(str.list.deleteGroupModalBody, { count: groupPendingDelete.agents.length })}
            </Text>
            {groupPendingDelete.sharedSkipped > 0 ? (
              <Text style={[s.cardDesc, { color: tokens.textMuted }]}>
                {formatStr(str.list.deleteGroupSharedNote, { count: groupPendingDelete.sharedSkipped })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ConfirmationModal>
    </View>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

/** Tarjeta de un agente en la lista agrupada (avatar + badges + acciones). */
function AgentCard({
  a, rank, roleName, parentName, spawn, inTeam, busy, tokens, str,
  onLaunch, onEdit, onDuplicate, onRemoveFromTeam, onDelete,
}: {
  a: AssistantAgent;
  rank?: number;
  roleName?: string;
  parentName?: string;
  spawn: boolean;
  inTeam: boolean;
  busy: boolean;
  tokens: ThemeTokens;
  str: AgentsStrings;
  onLaunch?: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemoveFromTeam: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[s.card, { backgroundColor: tokens.bgCardSolid ?? tokens.bgInput, borderColor: tokens.border }]}>
      {rank != null ? (
        <View style={[st.rankChip, { backgroundColor: tokens.brand }]}>
          <Text style={st.rankChipText}>{rank}</Text>
        </View>
      ) : null}
      {/* Cuerpo centrado: avatar, nombre, rol como badge central, descripción. */}
      <View style={{ alignItems: "center", gap: 4 }}>
        <AgentAvatar config={a.avatarConfig} size={56} seed={a.id || a.name} color={a.color} tokens={tokens} />
        <Text style={[s.cardTitle, { color: tokens.textPrimary, textAlign: "center" }]} numberOfLines={1}>{a.name}</Text>
        {roleName ? (
          <View style={[s.badge, { backgroundColor: "#6366f120", flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <Shield size={11} color="#6366f1" />
            <Text style={[s.badgeText, { color: "#6366f1" }]}>{roleName}</Text>
          </View>
        ) : null}
        <Text style={[s.cardDesc, { color: tokens.textMuted, textAlign: "center" }]} numberOfLines={2}>{a.description || str.noDescription}</Text>
      </View>

      {/* Badges secundarios */}
      <View style={[s.rowStart, { justifyContent: "center", borderTopWidth: 1, borderTopColor: tokens.border, paddingTop: 8, marginTop: 4 }]}>
        <View style={[s.badge, { backgroundColor: tokens.bgSecondary, flexDirection: "row", alignItems: "center", gap: 4 }]}>
          <ProviderIcon id={a.providerId} size={11} color={tokens.textSecondary} />
          <Text style={[s.badgeText, { color: tokens.textSecondary }]}>{a.providerId}</Text>
        </View>
        {a.model ? <Pill tokens={tokens}>{a.model}</Pill> : null}
        <Pill tokens={tokens}>{a.allowedTools == null ? str.allTools : formatStr(str.toolsCount, { count: a.allowedTools.length })}</Pill>
        {a.agentMode === "multi" ? (
          <View style={[s.badge, { backgroundColor: "#8b5cf620", flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <Users size={11} color="#8b5cf6" />
            <Text style={[s.badgeText, { color: "#8b5cf6" }]}>{`×${a.multiAgentCount ?? 3}${(a.providerIds?.length ?? 0) > 0 ? ` ·${(a.providerIds?.length ?? 0) + 1}p` : ""}`}</Text>
          </View>
        ) : null}
        {parentName ? (
          <View style={[s.badge, { backgroundColor: tokens.bgSecondary, flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <GitBranch size={11} color={tokens.textMuted} />
            <Text style={[s.badgeText, { color: tokens.textMuted }]}>{parentName}</Text>
          </View>
        ) : null}
        {(a.connections?.length ?? 0) > 0 ? (
          <View style={[s.badge, { backgroundColor: tokens.bgSecondary, flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <Network size={11} color={tokens.textMuted} />
            <Text style={[s.badgeText, { color: tokens.textMuted }]}>{a.connections?.length}</Text>
          </View>
        ) : null}
        {spawn ? (
          <View style={[s.badge, { backgroundColor: "#10b98120", flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <MessagesSquare size={11} color="#10b981" />
            <Text style={[s.badgeText, { color: "#10b981" }]}>{str.list.supervisorBadge}</Text>
          </View>
        ) : null}
        {a.realtime ? (
          <View style={[s.badge, { backgroundColor: "#f43f5e20", flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <Radio size={11} color="#f43f5e" />
            <Text style={[s.badgeText, { color: "#f43f5e" }]}>{str.list.realtimeBadge}</Text>
          </View>
        ) : null}
        {a.relation === "shared" && a.ownerName ? <Pill tokens={tokens}>{"· " + a.ownerName}</Pill> : null}
      </View>

      {/* Acciones */}
      <View style={[s.actionsRow, { borderTopWidth: 1, borderTopColor: tokens.border, paddingTop: 8 }]}>
        {onLaunch ? (
          <View style={{ flex: 1 }}>
            <Button size="sm" variant="primary" label={str.list.startChat} icon={<MessageSquarePlus size={14} color="#fff" />} onPress={onLaunch} />
          </View>
        ) : null}
        <IconBtn icon={<Pencil size={15} color={tokens.textSecondary} />} tokens={tokens} onPress={onEdit} />
        <IconBtn icon={<Copy size={15} color={tokens.textSecondary} />} tokens={tokens} onPress={onDuplicate} />
        {inTeam ? <IconConfirm title={str.teams.removeFromTeamBtn} message={str.teams.removeFromTeamConfirm} cancelLabel={str.cancel} icon={<UserMinus size={15} color="#f59e0b" />} color="#f59e0b" tokens={tokens} disabled={busy} onConfirm={onRemoveFromTeam} /> : null}
        <IconConfirm title={str.deleteTitle} message={formatStr(str.confirmDeleteAgent, { name: a.name })} cancelLabel={str.cancel} icon={<Trash2 size={15} color={tokens.danger} />} color={tokens.danger} tokens={tokens} disabled={busy} onConfirm={onDelete} />
      </View>
    </View>
  );
}

/** Barra de "volver" a la lista. */
function BackBar({ label, onBack, tokens }: { label: string; onBack: () => void; tokens: ThemeTokens }) {
  return (
    <Pressable onPress={onBack} style={st.backBar} hitSlop={8}>
      <ArrowLeft size={16} color={tokens.textSecondary} />
      <Text style={[st.backText, { color: tokens.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

/** Píldora de texto neutra. */
function Pill({ children, tokens }: { children: React.ReactNode; tokens: ThemeTokens }) {
  return (
    <View style={[s.badge, { backgroundColor: tokens.bgSecondary }]}>
      <Text style={[s.badgeText, { color: tokens.textMuted }]}>{children}</Text>
    </View>
  );
}

/** Botón-icono cuadrado (no destructivo). */
function IconBtn({ icon, tokens, onPress, disabled }: { icon: React.ReactNode; tokens: ThemeTokens; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[st.iconBtn, { borderColor: tokens.border, opacity: disabled ? 0.4 : 1 }]}>
      {icon}
    </Pressable>
  );
}

/** Confirma cada operación destructiva encima de la lista o formulario actual. */
function IconConfirm({ icon, tokens, onConfirm, disabled, title, message, cancelLabel }: {
  icon: React.ReactNode; color: string; tokens: ThemeTokens; onConfirm: () => unknown; disabled?: boolean;
  title: string; message: string; cancelLabel: string;
}) {
  const { askConfirmation, confirmation } = useConfirmation();
  return <>
    {confirmation}
    <Pressable disabled={disabled} accessibilityLabel={title}
      onPress={(event) => { event.stopPropagation(); askConfirmation(title, message, [
        { text: cancelLabel, style: "cancel" },
        { text: title, style: "destructive", onPress: onConfirm },
      ]); }}
      style={[st.iconBtn, { borderColor: tokens.border, opacity: disabled ? 0.4 : 1 }]}
    >{icon}</Pressable>
  </>;
}

const st = StyleSheet.create({
  viewPad: { padding: 14, gap: 12, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, gap: 8 },
  toolbar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
  toolbarBtns: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  hint: { fontSize: 12, lineHeight: 17, paddingHorizontal: 14, paddingBottom: 4 },
  err: { fontSize: 12, lineHeight: 17 },
  backBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  backText: { fontSize: 13, fontWeight: "500" },
  iconBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rankChip: { position: "absolute", right: 8, top: 8, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", zIndex: 2 },
  rankChipText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});

export default AgentsModule;
