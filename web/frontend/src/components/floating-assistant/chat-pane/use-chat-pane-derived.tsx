// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ChatPane orchestrator — TRAMO 2/3 (mid derived + effects + list/scroll
 * callbacks incl. reloadList). VERBATIM slice (orig lines 2157-2711); runs AFTER
 * tramo 1, receiving its bindings via `s`. Handlers referenced backward
 * (open/new/delete/rename/togglePin) reach the `actions` bag via wrappers.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { historyReady } from "@/lib/startup-state";
import { isLooseConversation, projectScopeIds } from "./project-search";
import { rootProjectId } from "./project-history-picker";
import { projectAgentScope, projectForAgent } from "../project-modal/agent-scope";
import { availableInProject, legacyHistoryAgentIds } from "../agent-market-state";
import { createProjectHistory, emptyProjectHistory } from "./project-history";
import {
  assistantConversationsApi,
  assistantProjectsApi,
  assistantAgentsApi,
  assistantAgentRolesApi,
  assistantMcpApi,
  leaderAgentsOf,
  agentWorkGroupKey,
  SLASH_COMMANDS,
  type AssistantProject,
  type AssistantProviderId,
  type AssistantAgent,
  type AssistantAgentRole,
  type ConversationMeta,
  type SlashCommandDef,
} from "../assistant-api";
import { chatEngine, type TurnAttachment } from "../chat-engine";
import { TeamTaskBoard } from "../TeamTaskBoard";
import { ImageCarousel, isImageAttachment } from "../ConversationMedia";
import { type TeamTaskView } from "../assistant-api";
import { AgentAvatar } from "../AgentAvatar";
import { RoleChip, ProjectChip } from "../AgentInfoChips";
import {
  buildProjectConversationTree,
  computeExpandChain,
  revealChainAccordion,
  LOOSE_GROUP_ID,
} from "../conversation-grouping";
import { showToast } from "@/lib/toast";
import { hasMcpSessionError, startMcpRecovery } from "../mcp-recovery";
import { resolveTargetScope, scopeHeaders } from "@/lib/api-client";
import { mcpBannerPrefs } from "../mcp-banner-prefs";
import { usePaged } from "./use-paged";
import { ProjectsPager } from "./sidebar-chrome";
import {
  LOOSE_SUGGESTIONS,
  PROJECT_FALLBACK_SUGGESTIONS,
  sampleSuggestions,
} from "./helpers";
import { type ProjectTreeRowProps } from "./types";
import { type ChatPaneProps, type ChatPaneActions } from "./vm-types";
import { type useChatPaneState } from "./use-chat-pane-state";

export function useChatPaneDerived(props: ChatPaneProps, s: ReturnType<typeof useChatPaneState>, actions: ChatPaneActions) {
  const {
  provider,
  mode,
  model,
  initialModel,
  uiMode = "simple",
  voice,
  approvalMode = "manual",
  onApprovalModeChange,
  openConversationId,
  openProjectId,
  openAgentId,
  openConversationAgentId,
  openNonce,
  onLaunchAgent,
  seedText,
  seedAutoSend,
  seedNewChat,
  seedNonce,
  onSeedConsumed,
  mobileBottomSlot,
  active,
  mobileProviderNav,
  onCloseDrawer,
  assistantRequestOpenRequestId,
  assistantRequestPrompt,
  assistantRequestSubmit,
  assistantRequestNonce,
  onAssistantRequestConsumed,
  } = props;
  const {
    activeConvMeta,
    activeId,
    agents,
    attachments,
    chatKey,
    chatLoading,
    compacting,
    contentRef,
    convScope,
    conversationsSectionOpen,
    convos,
    ct,
    currentAgentId,
    currentProjectId,
    draft,
    leaderConv,
    live,
    projects,
    projectsSectionOpen,
    roles,
    scrollerRef,
    search,
    setAgents,
    setAttachError,
    setCompacting,
    setConvos,
    setCtx,
    setCurrentAgentId,
    setCurrentProjectId,
    setDraft,
    setExpandedConvAgents,
    setExpandedConvProjects,
    setMobileListOpen,
    setModalProject,
    setProjects,
    setRoles,
    setSlashIndex,
    setSlashOpen,
    stickToBottomRef,
    streaming,
    textareaRef,
    turns,
  } = s;
  const openConversation: ChatPaneActions["openConversation"] = (...args) => actions.openConversation(...args);
  const newConversation: ChatPaneActions["newConversation"] = (...args) => actions.newConversation(...args);
  const deleteConversation: ChatPaneActions["deleteConversation"] = (...args) => actions.deleteConversation(...args);
  const renameConversation: ChatPaneActions["renameConversation"] = (...args) => actions.renameConversation(...args);
  const togglePin: ChatPaneActions["togglePin"] = (...args) => actions.togglePin(...args);
  const contextScopeRef = useRef({ activeId, active });
  contextScopeRef.current = { activeId, active };
  const reloadContext = useCallback(async (id: string) => {
    try {
      const c = await assistantConversationsApi.context(id);
      if (contextScopeRef.current.activeId === id && contextScopeRef.current.active !== false) setCtx(c);
    } catch {
      if (contextScopeRef.current.activeId === id && contextScopeRef.current.active !== false) setCtx(null);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!activeId) { setCtx(null); return; }
    if (streaming) return; // a live run is mutating the transcript; wait for settle
    void reloadContext(activeId);
    const onUpdate = () => { void reloadContext(activeId); };
    window.addEventListener("lxp:assistant:usage-updated", onUpdate);
    return () => window.removeEventListener("lxp:assistant:usage-updated", onUpdate);
  }, [active, activeId, streaming, reloadContext]);

  /** Manually compact the active conversation (the "Compactar" button). Folds
   *  older turns into a summary on the server, then reloads the thread so the
   *  user sees the summary divider + the kept tail. */
  const compactNow = useCallback(async () => {
    if (!activeId || compacting) return;
    setCompacting(true);
    try {
      const { context } = await assistantConversationsApi.compact(activeId);
      setCtx(context);
      // Re-seed the thread from the rewritten history. Drop the live engine
      // entry first so openConversation reloads from the server (seed() won't
      // clobber an existing in-memory chat).
      chatEngine.clear(activeId);
      await openConversation(activeId);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : (ct.compactError ?? "No se pudo compactar la conversación"));
    } finally {
      setCompacting(false);
    }
  }, [activeId, compacting]);

  // Slash-command autocomplete matches (C1): only when the draft is a single
  // "/word" token (no space yet) — once the user types args we step out of the
  // way. Matched against the catalog by command prefix.
  const slashMatches = useMemo<SlashCommandDef[]>(() => {
    const d = draft.trimStart();
    if (!d.startsWith("/") || /\s/.test(d)) return [];
    const q = d.toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.cmd.toLowerCase().startsWith(q));
  }, [draft]);

  // Open the dropdown whenever there are matches; keep the highlighted index in
  // range as the list shrinks while the user types.
  useEffect(() => {
    setSlashOpen(slashMatches.length > 0);
    setSlashIndex((i) => (i < slashMatches.length ? i : 0));
  }, [slashMatches.length]);

  /** Insert a chosen slash command into the draft (with a trailing space when it
   *  takes args, so the user can type them straight away) and refocus. */
  const applySlashCommand = useCallback((cmd: SlashCommandDef) => {
    setDraft(cmd.args ? `${cmd.cmd} ` : cmd.cmd);
    setSlashOpen(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, []);
  // Follow-up messages queued behind the in-flight run (dispatched FIFO).
  const queued = chatEngine.queued(chatKey);
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;
  // Prefer the meta fetched directly by id (authoritative, always present) and
  // fall back to the list entry while it loads. This makes the active chat's
  // project known even when the list is scoped elsewhere — so the header badge
  // is correct and a follow-up turn never persists a wrong/null project.
  const activeMeta = activeId
    ? (activeConvMeta?.id === activeId ? activeConvMeta : null) ?? convos.find((c) => c.id === activeId) ?? null
    : null;
  const effectiveProjectId = activeId ? (activeMeta?.projectId ?? null) : currentProjectId;
  // The project (parent or subproject) the OPEN conversation belongs to — used
  // by the header badge/button. Independent of `currentProject` (sidebar nav).
  const activeChatProject = activeMeta?.projectId
    ? projects.find((p) => p.id === activeMeta.projectId) ?? null
    : null;

  // Accumulated token usage across every assistant turn of this chat (C1). Some
  // turns are estimated (CLI character-count) — flag it so the tooltip can say so.
  const chatTokens = useMemo(() => {
    let total = 0;
    let assistantTurns = 0;
    let estimated = false;
    for (const t of turns) {
      if (t.role !== "assistant") continue;
      assistantTurns++;
      if (t.tokens) {
        total += t.tokens.total;
        if (t.tokens.estimated) estimated = true;
      }
    }
    return { total, assistantTurns, estimated };
  }, [turns]);

  // Todos los adjuntos de la conversación (en orden), y las imágenes para el
  // carrusel. Alimentan el visor a pantalla completa y el navegador de adjuntos.
  const convAttachments = useMemo<TurnAttachment[]>(
    () => turns.flatMap((t) => t.attachments ?? []),
    [turns],
  );
  const convImages = useMemo<TurnAttachment[]>(
    () => convAttachments.filter(isImageAttachment),
    [convAttachments],
  );
  // Índice de la imagen abierta en el carrusel (null = cerrado).
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  // Modal "Adjuntos de la conversación" (con pestañas por tipo).
  const [browserOpen, setBrowserOpen] = useState(false);
  // File the user opened from a turn's "Archivos modificados" list → editor modal.
  const [editorPath, setEditorPath] = useState<string | null>(null);

  // Adjuntos STAGED (aún sin enviar) que se pueden previsualizar en el carrusel:
  // imágenes + PDFs. Se exponen como TurnAttachment con un data: URL para reusar
  // el MISMO carrusel (ImageCarousel) que ve las imágenes del chat.
  const isPreviewable = (mime: string) => mime.startsWith("image/") || mime === "application/pdf";
  const stagedMedia = useMemo<TurnAttachment[]>(
    () =>
      attachments
        .filter((a) => isPreviewable(a.mimeType))
        .map((a) => ({ name: a.name, mimeType: a.mimeType, url: `data:${a.mimeType};base64,${a.dataBase64}` })),
    [attachments],
  );
  // Índice abierto en el carrusel de adjuntos staged (null = cerrado).
  const [stagedGalleryIndex, setStagedGalleryIndex] = useState<number | null>(null);
  // Click en un chip de adjunto: si es imagen/PDF abre el carrusel posicionado
  // en él (el índice se mapea a la lista filtrada `stagedMedia`).
  const openStagedPreview = useCallback(
    (i: number) => {
      const a = attachments[i];
      if (!a || !isPreviewable(a.mimeType)) return;
      const idx = attachments.slice(0, i + 1).filter((x) => isPreviewable(x.mimeType)).length - 1;
      setStagedGalleryIndex(idx >= 0 ? idx : 0);
    },
    [attachments],
  );

  // Al pulsar una imagen en una burbuja, abrir el carrusel posicionado en ella
  // dentro de la lista global de imágenes de la conversación.
  const openImageByUrl = useCallback(
    (url: string) => {
      const idx = convImages.findIndex((im) => im.url === url);
      setGalleryIndex(idx >= 0 ? idx : 0);
    },
    [convImages],
  );

  // Split projects into root (no valid parentId) and a children map.
  const { rootProjects, childrenMap } = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const childrenMap = new Map<string, AssistantProject[]>();
    const rootProjects: AssistantProject[] = [];
    for (const p of projects) {
      if (p.parentId && ids.has(p.parentId)) {
        const arr = childrenMap.get(p.parentId) ?? [];
        arr.push(p);
        childrenMap.set(p.parentId, arr);
      } else {
        rootProjects.push(p);
      }
    }
    return { rootProjects, childrenMap };
  }, [projects]);

  // Lookup id → title (for the project badge shown on chats during global search).
  const projectTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) if (p.id) m.set(p.id, p.title);
    return m;
  }, [projects]);
  const agentById = useMemo(() => {
    const m = new Map<string, AssistantAgent>();
    for (const a of agents) if (a.id) m.set(a.id, a);
    return m;
  }, [agents]);
  const projectById = useMemo(() => {
    const m = new Map<string, AssistantProject>();
    for (const p of projects) if (p.id) m.set(p.id, p);
    return m;
  }, [projects]);
  // Roles by id so agent rows/headers can resolve their role pill from `roleId`.
  // Declared here (before `leadersListEl`) so both the leaders list and the
  // agent-tree headers can read it without a temporal-dead-zone reference.
  const rolesById = useMemo(() => {
    const m = new Map<string, AssistantAgentRole>();
    for (const r of roles) if (r.id) m.set(r.id, r);
    return m;
  }, [roles]);
  // Custom agents (sidebar "Agentes" section + active-agent badge). Reloaded on
  // the agents-updated event so creating one in the Agents tab shows up here.
  const catalogScope = JSON.stringify([resolveTargetScope(), scopeHeaders(), currentProjectId]);
  const [agentsLoadedScope, setAgentsLoadedScope] = useState<string | null>(null);
  const agentsLoaded = agentsLoadedScope === catalogScope;
  const [agentsError, setAgentsError] = useState<unknown>(null);
  const catalogScopeRef = useRef(catalogScope);
  const catalogSequence = useRef(0);
  catalogScopeRef.current = catalogScope;
  const reloadAgents = useCallback(() => {
    const sequence = ++catalogSequence.current;
    const identity = () => JSON.stringify([resolveTargetScope(), scopeHeaders()]);
    const scope = identity();
    const isCurrent = () => identity() === scope && catalogScopeRef.current === catalogScope && sequence === catalogSequence.current;
    setAgentsLoadedScope(null);
    void assistantAgentsApi.list(currentProjectId ? { contextProjectId: currentProjectId } : {}).then(items => {
      if (!isCurrent()) return;
      setAgents(items); setAgentsLoadedScope(catalogScope); setAgentsError(null);
    }).catch(error => { if (isCurrent()) { setAgentsError(error); setAgentsLoadedScope(null); } });
    // Roles power the header agent pill's role chip; refreshed alongside agents.
    void assistantAgentRolesApi.list().then(items => { if (isCurrent()) setRoles(items); }).catch(() => { /* ignore */ });
  }, [catalogScope, currentProjectId]);
  const projectTeam = useMemo(() => currentProject ? projectAgentScope(currentProject, projects) : null, [currentProject, projects]);
  const projectTeamAgents = useMemo(() => agents.filter(a => a.id && availableInProject(a, currentProjectId))
    .sort((a, b) => Number(b.id === projectTeam?.root.leaderAgentId) - Number(a.id === projectTeam?.root.leaderAgentId) || a.name.localeCompare(b.name)), [agents, currentProjectId, projectTeam?.root.leaderAgentId]);

  const selectedRoot = rootProjectId(currentProjectId, projectById);
  const historyProjectIds = selectedRoot ? [...projectScopeIds(selectedRoot, projects)].sort().join(",") : "none";
  const historyAgentId = projectTeam ? currentAgentId ?? undefined : undefined;
  const legacyMembers = selectedRoot ? legacyHistoryAgentIds(agents, projects, selectedRoot) : [];
  const includeLegacy = !!historyAgentId && legacyMembers.includes(historyAgentId);
  const legacyAgentIds = includeLegacy ? historyAgentId! : "";
  const historyKey = JSON.stringify([catalogScope, search.trim(), historyProjectIds, historyAgentId, legacyAgentIds, agentsLoaded]);
  const [historyState, setHistoryState] = useState({ key: "", data: emptyProjectHistory() });
  const historyData = historyState.key === historyKey ? historyState.data : emptyProjectHistory();
  // Hide previous-scope rows immediately, even before the next request starts.
  const sidebarConvos = useMemo(() => {
    const inScope = (chat: ConversationMeta) => (chat.agentId ?? null) === (historyAgentId ?? null)
      && (chat.projectId ? historyProjectIds.split(",").includes(chat.projectId)
        : selectedRoot ? includeLegacy && legacyAgentIds.split(",").includes(chat.agentId ?? "") : isLooseConversation(chat));
    const rows = historyState.key === historyKey ? convos.filter(inScope) : [];
    const activeInScope = activeMeta && inScope(activeMeta);
    return historyState.key === historyKey && historyState.data.initialized && !search.trim() && activeInScope && !rows.some(c => c.id === activeMeta.id)
      ? [activeMeta, ...rows] : rows;
  }, [historyState, historyKey, convos, activeMeta, historyProjectIds, selectedRoot, includeLegacy, legacyAgentIds, search, historyAgentId]);
  const historySummary = historyData.summary;
  const historicalProjectAgents = agents.filter(agent => !availableInProject(agent, currentProjectId) && (
    agent.id === currentAgentId || (historySummary?.agents[agent.id] ?? 0) > 0 || legacyMembers.includes(agent.id) ||
    agent.assignments?.some(assignment => historyProjectIds.split(",").includes(assignment.projectId))
  ));

  // Auto-expand the collapsable branch that holds the ACTIVE conversation, so
  // the lists can start fully collapsed yet still reveal the open chat. Runs
  // ONCE per active conversation (guarded by `autoExpandedForRef`): it only ADDS
  // the chain's ids to the expansion sets — never collapses — so a later reload
  // (which re-fires this effect as the maps change) can't stomp folders the user
  // opened or closed by hand. An agent chat expands its agent→leader chain; a
  // project chat expands its project→root chain; a loose chat expands the
  // synthetic "Chats sueltos" folder.
  const autoExpandedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeId) { autoExpandedForRef.current = null; return; }
    const meta = activeConvMeta?.id === activeId ? activeConvMeta : convos.find((c) => c.id === activeId) ?? null;
    if (!meta) return; // wait until the active conversation's metadata is known
    const expansionKey = `${activeId}:${meta.agentId ?? "none"}:${meta.projectId ?? "loose"}:${meta.projectId ? projectById.has(meta.projectId) : true}`;
    if (autoExpandedForRef.current === expansionKey) return;
    autoExpandedForRef.current = expansionKey;
    if (meta.agentId) setExpandedConvAgents(prev => new Set([...prev, meta.agentId!]));
    // Every chat, including agent-bound chats, lives under its project folder.
    const parentOfProject = (id: string) => projectById.get(id)?.parentId ?? null;
    const chain = meta.projectId && projectById.has(meta.projectId)
      ? computeExpandChain(meta.projectId, parentOfProject)
      : [LOOSE_GROUP_ID];
    const projectSiblings = (id: string): string[] => {
      const parent = id === LOOSE_GROUP_ID ? null : parentOfProject(id);
      const out: string[] = parent === null ? [LOOSE_GROUP_ID] : [];
      for (const p of projectById.values()) if (p.id && (p.parentId ?? null) === parent) out.push(p.id);
      return out;
    };
    setExpandedConvProjects((prev) => revealChainAccordion(prev, chain, projectSiblings));
  }, [activeId, activeConvMeta, convos, agentById, projectById]);

  // Project/team leaders (rank-1 per work group) for the "Líderes" project tab.
  const leaderAgents = useMemo(() => leaderAgentsOf(agents), [agents]);

  // The search box doubles as a project/subproject filter. With a query active
  // we show a flat list of every matching project (root OR sub), each tagged
  // with its parent so subprojects are reachable without first opening the
  // parent. Empty query → normal hierarchical navigation.
  const projectQuery = search.trim().toLowerCase();
  // A collapsed section is force-shown while a search is active so the matching
  // results are never hidden behind a collapsed header (the chevron still
  // reflects the stored preference; collapsing resumes when the search clears).
  const projectsSectionShown = projectsSectionOpen || !!projectQuery;
  const conversationsSectionShown = conversationsSectionOpen || !!projectQuery;
  // On mobile the conversation list also stays visible inside a project (its
  // header is the project row, which carries no collapse toggle to re-open it).
  const mobileConvListShown = conversationsSectionShown || currentProjectId !== null;
  // Gmail-style agent threading applies only to the root "Agentes IA" list
  // (not inside a project, not while searching, where context differs).
  const groupAgentsList = convScope === "agents" && currentProjectId === null && !projectQuery;
  // One project tree contains both normal and agent-bound conversations.
  const groupLooseList = convScope === "loose" && currentProjectId === null && !projectQuery;
  const looseProjectTree = useMemo(() => {
    // Display legacy mailboxes under their unique owning root, without changing
    // the metadata used to open/send the conversation.
    const displayed = sidebarConvos.map(c => !c.projectId && includeLegacy && c.agentId === historyAgentId
      ? { ...c, projectId: selectedRoot } : c);
    const tree = buildProjectConversationTree(displayed, projects, { includeEmpty: true });
    if (historySummary) {
      const apply = (entries: typeof tree.entries): number => entries.reduce((sum, entry) => {
        if (entry.kind === "chat") return sum;
        const own = (historySummary.projects[entry.node.projectId] ?? 0) + (includeLegacy && entry.node.projectId === selectedRoot ? historySummary.projects.none ?? 0 : 0);
        entry.node.totalConvos = own + apply(entry.node.entries);
        return sum + entry.node.totalConvos;
      }, 0);
      apply(tree.entries);
    }
    if (historyAgentId || projectQuery) {
      const prune = (entries: typeof tree.entries): typeof tree.entries => entries.filter(entry => entry.kind === "chat" || entry.node.totalConvos > 0 || entry.node.projectId === selectedRoot)
        .map(entry => entry.kind === "project" ? { ...entry, node: { ...entry.node, entries: prune(entry.node.entries) } } : entry);
      tree.entries = prune(tree.entries);
    }
    return tree;
  }, [sidebarConvos, projects, historySummary, includeLegacy, projectTeamAgents, selectedRoot, historyAgentId, projectQuery]);
  const looseTreeRowProps: ProjectTreeRowProps = {
    activeId,
    agentById,
    projectTitleById,
    onOpen: (id) => void openConversation(id),
    onDelete: (id) => void deleteConversation(id),
    onRename: (id, t) => void renameConversation(id, t),
    onTogglePin: (id, p) => void togglePin(id, p),
  };
  const projectChatSequence = useRef(0);
  // Acciones de las cabeceras collapsables del árbol "Sueltos / Proyectos":
  // botón + (nueva conversación suelta / de proyecto) y lápiz (editar proyecto).
  const looseTreeActions = {
    onNewLoose: () => { setCurrentProjectId(null); newConversation(); },
    onNewProjectChat: async (pid: string) => {
      const project = projectById.get(pid);
      if (!project) return;
      const sequence = ++projectChatSequence.current;
      let preserveAgent = false;
      if (historyAgentId) {
        try {
          const members = await assistantAgentsApi.list({ projectId: pid });
          if (catalogScopeRef.current !== catalogScope || sequence !== projectChatSequence.current) return;
          preserveAgent = members.some(agent => agent.id === historyAgentId && availableInProject(agent, pid));
        } catch {
          if (catalogScopeRef.current === catalogScope && sequence === projectChatSequence.current) setAttachError(s.i18n.agentMarket.error);
          return;
        }
      }
      setCurrentProjectId(pid);
      newConversation({ preserveAgent });
    },
    onEditProject: (pid: string) => { const p = projectById.get(pid); if (p) setModalProject(p); },
  };
  // Botón + de la cabecera de un agente: inicia un chat ligado a ese agente.
  // Mismo mecanismo que la lista de agentes/líderes: si es de este proveedor lo
  // liga en el panel actual; si no, salta al sub-tab del proveedor del agente.
  const handleNewAgentChat = (agentId: string, preserveDraft = false) => {
    const a = agentById.get(agentId);
    if (!a) return;
    const project = projectForAgent(a, projects, currentProjectId ?? undefined);
    if (currentProjectId && !project) return;
    if (!currentProjectId && (!a.capabilities?.canExecute || a.execution?.projectId)) return;
    const pending = preserveDraft ? { text: draft, attachments } : undefined;
    if (a.providerId === provider) {
      newConversation({ preserveAgent: false });
      setCurrentProjectId(project?.id ?? null);
      setCurrentAgentId(agentId);
      s.conversationOptions.resetNew("");
      if (pending) { setDraft(pending.text); s.setAttachments(pending.attachments); }
    } else if (onLaunchAgent) {
      if (pending) onLaunchAgent(a, project?.id, pending);
      else onLaunchAgent(a, project?.id);
    }
    // En móvil, cerrar el drawer al iniciar el chat con el agente — mismo cierre
    // que el botón "+" de chat suelto (setMobileListOpen(false)); en desktop no
    // hay drawer, así que es inocuo.
    setMobileListOpen(false);
  };
  const flatProjectMatches = useMemo(() => {
    if (!projectQuery) return [];
    return projects
      .filter((p) => p.id && p.title.toLowerCase().includes(projectQuery))
      .map((p) => ({
        project: p,
        parent: p.parentId ? projects.find((x) => x.id === p.parentId) ?? null : null,
      }));
  }, [projects, projectQuery]);

  const currentProjectChildren = currentProjectId
    ? (childrenMap.get(currentProjectId) ?? [])
    : [];
  const currentProjectParent = currentProject?.parentId
    ? projects.find((p) => p.id === currentProject.parentId) ?? null
    : null;

  // Paginate the project / subproject / search lists at 10 rows, revealing more
  // on demand. Subprojects re-page when navigating into another project; search
  // matches re-page on a new query.
  const pagedRoot = usePaged(rootProjects, rootProjects.length);
  const pagedChildren = usePaged(currentProjectChildren, currentProjectId);
  const pagedMatches = usePaged(flatProjectMatches, projectQuery);
  const pagedLeaders = usePaged(leaderAgents, leaderAgents.length);
  // Shared render for the "Líderes de proyecto" tab (mobile + desktop). Clicking
  // a leader ALWAYS starts a fresh chat with it: same-provider inline, otherwise
  // via onLaunchAgent (switches to the leader's provider sub-tab).
  const leadersListEl = (
    <>
      {leaderAgents.length === 0 && (
        <p className="px-2 py-1 text-[10px] text-muted-foreground">{ct.agents?.empty ?? "Sin agentes. Créalos en la pestaña Agentes."}</p>
      )}
      {pagedLeaders.visible.map((a) => {
        const role = a.roleId ? rolesById.get(a.roleId) ?? null : null;
        const workGroup = agentWorkGroupKey(a);
        return (
          <div
            key={a.id}
            className={`group flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer text-xs ${currentAgentId === a.id ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:bg-card/50"}`}
            onClick={() => {
              if (a.providerId === provider) { newConversation({ preserveAgent: false }); setCurrentAgentId(a.id); }
              else onLaunchAgent?.(a);
            }}
            title={a.description || a.name}
          >
            <AgentAvatar agent={a} size={26} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {/* Fila 1: nombre + rol + proyecto del líder. En el chat NO se
                   muestran chips de proveedor·modelo (solo el Dashboard). */}
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="min-w-0 max-w-full truncate font-medium text-foreground">{a.name}</span>
                {role && <RoleChip role={role} className="shrink-0" />}
                <ProjectChip project={a.project} className="shrink-0" />
              </span>
              {/* Fila 2: grupo de trabajo del líder (si no es el genérico). */}
              {workGroup !== "General" && (
                <span className="mt-0.5 flex items-center gap-1 text-[9px] uppercase text-muted-foreground/60">
                  <i className="ti ti-folder shrink-0 text-[9px]" aria-hidden></i>
                  <span className="truncate">{workGroup}</span>
                </span>
              )}
            </span>
          </div>
        );
      })}
      {pagedLeaders.hasPager && <ProjectsPager page={pagedLeaders.page} pageCount={pagedLeaders.pageCount} onPrev={pagedLeaders.prev} onNext={pagedLeaders.next} />}
    </>
  );

  // Ancestor chain (root → immediate parent) for the breadcrumb + inheritance
  // hint: a nested project prepends every ancestor's instructions at chat time.
  const projectAncestors = useMemo(() => {
    const chain: AssistantProject[] = [];
    const seen = new Set<string>();
    let cur: AssistantProject | null = currentProject;
    while (cur?.parentId && !seen.has(cur.parentId)) {
      seen.add(cur.parentId);
      const parent = projects.find((x) => x.id === cur!.parentId) ?? null;
      if (!parent) break;
      chain.unshift(parent);
      cur = parent;
    }
    return chain;
  }, [currentProject, projects]);

  // Quick-start suggestions for an EMPTY chat. A project chat samples from the
  // project's pre-generated set (or generic project starters if none yet); a
  // loose chat gets server / new-project starters. Re-sampled per conversation
  // (keyed by activeId) so they vary instead of always repeating.
  const quickStartSuggestions = useMemo(() => {
    // Localized starters follow the selected language; fall back to the Spanish
    // constants if the active locale doesn't provide them.
    const looseSet =
      Array.isArray(ct.quickStartLoose) && ct.quickStartLoose.length
        ? (ct.quickStartLoose as string[])
        : LOOSE_SUGGESTIONS;
    const projectFallbackSet =
      Array.isArray(ct.quickStartProjectFallback) && ct.quickStartProjectFallback.length
        ? (ct.quickStartProjectFallback as string[])
        : PROJECT_FALLBACK_SUGGESTIONS;
    if (currentProject) {
      const gen = (currentProject.suggestions ?? []).filter((s) => s && s.trim());
      const projectSet = gen.length >= 3 ? gen : projectFallbackSet;
      const pool = projectSet.length >= 6
        ? projectSet
        : [...projectSet, ...projectFallbackSet.filter((suggestion) => !projectSet.includes(suggestion))];
      return sampleSuggestions(pool, 6);
    }
    return sampleSuggestions(looseSet, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, activeId, currentProject?.suggestions, ct.quickStartLoose, ct.quickStartProjectFallback]);
  const providerOptions = mobileProviderNav?.options ?? [];
  const visibleProviderOptions = providerOptions.length > 0
    ? providerOptions
    : [{ id: provider, label: provider, provider: true }];
  const canSwitchProvider = visibleProviderOptions.length > 1;

  // Raise a banner when the MCP loopback reported a stale session (the agent's
  // panel tools couldn't resolve the connected server). The backend embeds a
  // stable `[MCP_SESSION_EXPIRED]` marker that survives CLI relaying; we scan
  // the turn text / raw transcript / tool outputs for it and keep the newest
  // marker's timestamp so a later repair can dismiss the (persisted) banner.
  const [mcpRepairError, setMcpRepairError] = useState<string | null>(null);
  // Dismissal keyed by conversationId → ms epoch of the newest marker the user
  // dismissed/repaired. Seeded from the persistent store so a "Cerrar"/repair
  // survives reloads; after reload `activeMeta.mcpRepairedAt` (from the server)
  // also keeps a repaired banner hidden.
  const [mcpDismissedAt, setMcpDismissedAt] = useState<Record<string, number>>(() => mcpBannerPrefs.getAll());
  // Epoch ms of the newest turn carrying the `MCP_SESSION_EXPIRED` marker, or
  // -1 when the transcript has none. Drives both the banner and the dismissal
  // watermark (so a LATER failed run re-raises a previously-closed banner).
  const mcpMarkerAt = useMemo(() => {
    let latest = -1;
    for (const t of turns) {
      const hit =
        hasMcpSessionError(t.error, true) || hasMcpSessionError(t.raw) ||
        t.tools.some(tool => hasMcpSessionError(tool.terminal) ||
          hasMcpSessionError(tool.result?.output, tool.result?.success === false));
      if (hit) latest = Math.max(latest, t.createdAt ?? 0);
    }
    return latest;
  }, [turns]);
  const mcpExpired = useMemo(() => {
    if (mcpMarkerAt < 0) return false;
    // Hide when a repair (server-persisted meta) or a dismissal is at least as
    // new as the most recent marker turn.
    const repairedAt = activeMeta?.mcpRepairedAt ? Date.parse(activeMeta.mcpRepairedAt) : -1;
    if (repairedAt >= 0 && repairedAt >= mcpMarkerAt) return false;
    const dismissed = activeId ? mcpDismissedAt[activeId] ?? -1 : -1;
    if (dismissed >= 0 && dismissed >= mcpMarkerAt) return false;
    return true;
  }, [mcpMarkerAt, activeMeta?.mcpRepairedAt, activeId, mcpDismissedAt]);
  // "Cerrar" — persistently dismiss the banner for this conversation up to the
  // current marker watermark (a later failed run will re-raise it).
  const dismissMcp = useCallback(() => {
    if (!activeId || mcpMarkerAt < 0) return;
    const at = Math.max(mcpMarkerAt, 0);
    setMcpDismissedAt((m) => ({ ...m, [activeId]: at }));
    mcpBannerPrefs.dismiss(activeId, at);
  }, [activeId, mcpMarkerAt]);

  // Automatic maintenance, scoped to this target/chat. No button or toast.
  useEffect(() => {
    setMcpRepairError(null);
    if (!mcpExpired || !activeId) return;
    const scope = () => JSON.stringify([resolveTargetScope(), scopeHeaders()]);
    const originalScope = scope();
    let stopped = false;
    let stop = () => {};
    let lastStart = 0;
    const begin = () => {
      if (stopped || scope() !== originalScope || Date.now() - lastStart < 30000) return;
      lastStart = Date.now();
      stop();
      setMcpRepairError(null);
      stop = startMcpRecovery({
        key: JSON.stringify([originalScope, activeId, provider, mcpMarkerAt]),
        current: () => !stopped && scope() === originalScope,
        repair: async () => {
          const res = await assistantMcpApi.repair({ conversationId: activeId, provider: provider as AssistantProviderId });
          return { ok: res.ok && res.data?.ok === true, stamp: res.data?.mcpRepairedAt,
            error: res.status === 428 ? ct.mcpRepairReconnect : res.data?.detail || res.error };
        },
        recovered: result => {
          const stamp = result.stamp ?? new Date().toISOString();
          const at = Math.max(mcpMarkerAt, Date.parse(stamp) || Date.now());
          setMcpDismissedAt(m => ({ ...m, [activeId]: at }));
          mcpBannerPrefs.dismiss(activeId, at);
          s.setActiveConvMeta(prev => prev?.id === activeId ? { ...prev, mcpRepairedAt: stamp } : prev);
        },
        failed: message => setMcpRepairError(message || ct.mcpRepairFailed || "No se pudo recuperar la conexión automáticamente."),
      });
    };
    begin();
    window.addEventListener("online", begin);
    window.addEventListener("focus", begin);
    return () => { stopped = true; stop(); window.removeEventListener("online", begin); window.removeEventListener("focus", begin); };
  }, [activeId, provider, mcpMarkerAt, mcpExpired, ct.mcpRepairReconnect, ct.mcpRepairFailed, s.setActiveConvMeta]);

  // ── Projects ──────────────────────────────────────────────────────────────
  const reloadProjects = useCallback(async () => {
    try {
      const latest = await assistantProjectsApi.list();
      setProjects(latest);
      // A merged/deleted project can remain in the persisted composer state.
      // Clear it so a new chat never sends a removed project id.
      setCurrentProjectId((id) => id && !latest.some((project) => project.id === id) ? null : id);
    } catch { /* ignore */ }
  }, []);

  const needsAgents = active !== false && (!!currentProjectId || !!currentAgentId || !!activeConvMeta?.agentId || !!leaderConv || (conversationsSectionOpen && convScope === "agents"));
  useEffect(() => {
    if (!needsAgents) return;
    reloadAgents();
    const onUpd = () => reloadAgents();
    window.addEventListener("lxp:assistant:agents-updated", onUpd);
    window.addEventListener("luxipanel:permissions-changed", onUpd);
    return () => {
      ++catalogSequence.current;
      window.removeEventListener("lxp:assistant:agents-updated", onUpd);
      window.removeEventListener("luxipanel:permissions-changed", onUpd);
    };
  }, [reloadAgents, needsAgents]);
  const currentAgent = useMemo(
    () => (currentAgentId ? agents.find((a) => a.id === currentAgentId) ?? null : null),
    [currentAgentId, agents],
  );
  // Leader agent for the "back to leader" header button (resolved from the
  // leader conversation's bound agent id).
  const leaderAgent = useMemo(
    () => (leaderConv ? agents.find((a) => a.id === leaderConv.leaderAgentId) ?? null : null),
    [leaderConv, agents],
  );
  // Agent shown in the header card. Prefer the conversation's bound agent (from
  // its authoritative meta) so it resolves even for worker chats not present in
  // the currently-scoped list; fall back to the in-flight currentAgent.
  const headerAgent = useMemo(() => {
    const id = activeMeta?.agentId ?? currentAgentId;
    return id ? agents.find((a) => a.id === id) ?? null : null;
  }, [activeMeta, currentAgentId, agents]);

  // Render ONE delegation board scoped to a group of tasks (the ones a single
  // leader turn delegated). Reused for every per-turn group and for the
  // unanchored fallback bucket, so the props stay in one place. The board
  // derives its "N de M" counter from the `tasks` subset it receives, so each
  // group counts only its own tasks.
  const renderTeamBoard = (groupTasks: TeamTaskView[], key: string, embedded = false) =>
    activeId && groupTasks.length > 0 ? (
      <TeamTaskBoard
        key={key}
        conversationId={activeId}
        tasks={groupTasks}
        onOpenChat={(workerConvId) => void openConversation(workerConvId)}
        leaderAgentId={activeConvMeta?.agentId ?? currentAgentId ?? undefined}
        onOpenFile={(p) => setEditorPath(p)}
        agentById={agentById}
        embedded={embedded}
      />
    ) : null;

  // History is fetched on demand under one member/root/search scope.
  const currentHistoryKey = useRef(historyKey);
  currentHistoryKey.current = historyKey;
  const historyProjectsRef = useRef(projects);
  historyProjectsRef.current = projects;
  const history = useMemo(() => createProjectHistory({
    projectIds: historyProjectIds.split(","), agentId: historyAgentId,
    legacyAgentIds: legacyAgentIds ? legacyAgentIds.split(",") : [], query: search.trim(),
    projectIdsFor: id => [...projectScopeIds(id, historyProjectsRef.current)],
  }, data => {
    if (currentHistoryKey.current !== historyKey) return;
    setHistoryState({ key: historyKey, data });
    setConvos(data.items);
  }), [historyKey]);
  const reloadList = useCallback(async (q: string) => {
    if (agentsError) reloadAgents();
    if (q.trim() === search.trim()) await history.first(true);
  }, [history, search, agentsError, reloadAgents]);
  useEffect(() => {
    if (!historyData.initialized || active === false) return;
    for (const id of s.expandedConvProjects ?? []) void history.group(id);
  }, [history, historyData.initialized, s.expandedConvProjects, active]);
  const loadMoreHistory = useCallback(() => { if (active !== false) void history.next(); }, [history, active]);
  useEffect(() => {
    if (active === false || (projectTeam && !agentsLoaded)) return;
    let current = true;
    const ready = () => { if (current) historyReady(); };
    const timer = setTimeout(() => void history.first().then(ready, ready), search.trim() ? 350 : 0);
    return () => { current = false; clearTimeout(timer); history.cancel(); };
  }, [history, active, !!projectTeam, agentsLoaded]);
  // Both the history tree and the composer picker need the catalog, even when
  // the legacy projects section is collapsed and no project is selected.
  const needsProjects = active !== false;
  useEffect(() => { if (needsProjects) void reloadProjects(); }, [reloadProjects, needsProjects]);

  // Keep the latest message in view without the user ever scrolling. A new
  // turn (a sent message or the assistant's reply) or a chat switch animates
  // smoothly to the bottom; while the assistant streams its answer we follow
  // the growing text instantly so the view stays pinned to the bottom (a
  // per-token smooth scroll would fight itself and look janky).
  // Pin the view to the newest content. The user scrolling up to read history
  // releases the pin (onScroll below); a new turn or chat switch re-arms it.
  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // A new bubble appearing (or switching chats) always brings the user down,
  // even if they'd scrolled up. We re-arm the pin and smooth-scroll after two
  // animation frames so the bubble's content (markdown/code/attachments) has
  // laid out and we land on the real bottom, not the pre-layout height.
  useEffect(() => {
    stickToBottomRef.current = true;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => scrollToBottom("smooth"));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [turns.length, chatKey, scrollToBottom]);

  // Catch-all: any height change of the message content (streaming text, an
  // async-loaded image/attachment, a code block expanding) re-pins to bottom
  // while the user is stuck there. ResizeObserver fires for every such growth,
  // so the view stays glued to the latest message without per-token effects.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollToBottom("auto");
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [chatKey, chatLoading, scrollToBottom]);

  // Release/arm the pin based on how close to the bottom the user is.
  const onScrollerScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  }, []);


  // The immutable chat binding owns admission, independently of sidebar navigation.
  const boundAgentId = activeId ? activeMeta?.agentId ?? currentAgentId : currentAgentId;
  const boundAgent = agents.find(agent => agent.id === boundAgentId);
  const boundAgentAvailable = !!boundAgent && (effectiveProjectId
    ? availableInProject(boundAgent, effectiveProjectId)
    : boundAgent.capabilities?.canExecute === true && boundAgent.execution?.projectId === null);
  const historicalOnly = !!boundAgentId && agentsLoaded && !boundAgentAvailable;
  const agentInputBlocked = (!!activeId && (!activeMeta || (activeMeta.agentId ?? null) !== (currentAgentId ?? null)))
    || (!!boundAgentId && (!agentsLoaded || !boundAgentAvailable));

  return {
    agentInputBlocked,
    historicalOnly,
    activeChatProject,
    activeMeta,
    agentById,
    applySlashCommand,
    autoExpandedForRef,
    browserOpen,
    canSwitchProvider,
    chatTokens,
    childrenMap,
    compactNow,
    convAttachments,
    convImages,
    conversationsSectionShown,
    currentAgent,
    currentProject,
    currentProjectChildren,
    currentProjectParent,
    editorPath,
    effectiveProjectId,
    flatProjectMatches,
    galleryIndex,
    groupAgentsList,
    groupLooseList,
    handleNewAgentChat,
    headerAgent,
    isPreviewable,
    leaderAgent,
    leaderAgents,
    leadersListEl,
    looseProjectTree,
    historyError: projectTeam && agentsError ? agentsError : historyData.error,
    projectTeam,
    agentCatalogReady: agentsLoaded,
    agentCatalogError: agentsError,
    retryAgentCatalog: reloadAgents,
    projectTeamAgents: agentsLoaded ? projectTeamAgents : [],
    historicalProjectAgents: agentsLoaded ? historicalProjectAgents : [],
    sidebarConvos,
    historyAgentId,
    historySearchStatus: historyData.searchStatus,
    historyHasMore: historyData.hasMore,
    historySummary,
    loadMoreHistory,
    loadHistoryGroup: history.group,
    closeHistoryGroup: history.closeGroup,
    looseTreeActions,
    looseTreeRowProps,
    mcpExpired,
    mcpRepairError,
    dismissMcp,
    mobileConvListShown,
    onScrollerScroll,
    openImageByUrl,
    openStagedPreview,
    pagedChildren,
    pagedLeaders,
    pagedMatches,
    pagedRoot,
    projectAncestors,
    projectById,
    projectQuery,
    searchingHistory: historyData.loading,
    projectTitleById,
    projectsSectionShown,
    providerOptions,
    queued,
    quickStartSuggestions,
    reloadAgents,
    reloadContext,
    reloadList,
    reloadProjects,
    renderTeamBoard,
    rolesById,
    rootProjects,
    scrollToBottom,
    setBrowserOpen,
    setEditorPath,
    setGalleryIndex,
    setStagedGalleryIndex,
    slashMatches,
    stagedGalleryIndex,
    stagedMedia,
    visibleProviderOptions,
  };
}
