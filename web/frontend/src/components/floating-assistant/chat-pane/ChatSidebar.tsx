// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sidebar (chats/projects list) view of the ChatPane. The same conversation
 * tree is placed in the workspace rail on desktop; state and handlers still
 * come from the `useChatPane` view-model bag (`vm`).
 */
import { formatAssistantMessage, useAssistantI18n } from "../i18n";
import { LucideIcon } from "../LucideIcon";
import { TimelineRow, ProjectsPager, SidebarTabs } from "./sidebar-chrome";
import { ConvoRow } from "./ConvoRow";
import { AgentThreadedConvos } from "./agent-threaded-convos";
import { legacyHistoryAgentIds } from "../agent-market-state";
import { ProjectTreeConvos } from "./project-tree-convos";
import { rootProjectId, SelectedProjectConvos } from "./project-history-picker";
import { type ChatPaneVM } from "./use-chat-pane";
import { ViewTransition } from "@/components/ui/ViewTransition";
import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { useIsMobile } from "./use-is-mobile";
import { requestAssistant } from "@/lib/assistant-request";
import { Store } from "lucide-react";

export function ChatSidebar({ vm }: { vm: ChatPaneVM }) {
  const mobileNavigation = useIsMobile(1024);
  const historyLabel = useAssistantI18n().statsTab.history;
  const historyMessages = useAssistantI18n().assistantErrorBoundary;
  const marketMessages = useAssistantI18n().agentMarket;
  const scrollOffsets = useRef(new WeakMap<Element, number>());
  const {
    active,
    activeId,
    activeMeta,
    historyError,
    historySearchStatus,
    historyHasMore,
    searchingHistory,
    projectTeam,
    sidebarConvos,
    historyAgentId,
    agentCatalogReady,
    loadMoreHistory,
    loadHistoryGroup,
    closeHistoryGroup,
    reloadList,
    agentById,
    agents,
    childrenMap,
    convScope,
    convos,
    ct,
    currentProject,
    currentProjectChildren,
    currentProjectId,
    currentProjectParent,
    deleteConversation,
    expandedConvAgents,
    expandedConvProjects,
    flatProjectMatches,
    groupAgentsList,
    groupLooseList,
    handleNewAgentChat,
    isMobile,
    leaderAgents,
    listOpen,
    looseProjectTree,
    looseTreeActions,
    looseTreeRowProps,
    mobileListOpen,
    mobileProviderNav,
    mode,
    newConversation,
    openConversation,
    pagedChildren,
    pagedMatches,
    projectById,
    projectQuery,
    projectTitleById,
    projects,
    provider,
    renameConversation,
    rolesById,
    search,
    setConvScope,
    setCurrentProjectId,
    setListOpen,
    setMobileListOpen,
    setModalProject,
    setSearch,
    toggleConvAgentGroup,
    toggleConvProjectGroup,
    togglePin,
  } = vm;
  const railNavTarget = active && typeof document !== "undefined"
    ? document.getElementById("server-rail-assistant-nav")
    : null;
  const standaloneMobile = isMobile && !railNavTarget;
  const unifiedRoot = !!projectTeam || !projectQuery;
  const scopedConvos = sidebarConvos;
  const rootId = rootProjectId(currentProjectId, projectById);
  const parentRoot = rootId && rootId !== currentProjectId ? projectById.get(rootId) : null;
  const autoProjectForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeId) { autoProjectForRef.current = null; return; }
    if (autoProjectForRef.current === activeId) return;
    const chat = activeMeta?.id === activeId ? activeMeta : convos.find((item) => item.id === activeId);
    if (!chat) return;
    if (!chat.projectId && chat.agentId && !agentCatalogReady) return;
    autoProjectForRef.current = activeId;
    const agent = chat.agentId ? agentById.get(chat.agentId) : undefined;
    const legacyRoot = !chat.projectId && agent
      ? projects.find(project => !project.parentId && legacyHistoryAgentIds([agent], projects, project.id).includes(agent.id)) : null;
    setCurrentProjectId(chat.projectId && projectById.has(chat.projectId) ? chat.projectId : legacyRoot?.id ?? null);
  }, [activeId, activeMeta, convos, projectById, agentById, agentCatalogReady, projects, currentProjectId, setCurrentProjectId]);
  // In the workspace, the existing conversation tree lives in the left rail.
  // Elsewhere it keeps its original collapsible desktop/mobile behavior.
  const toggleHistoryProject = (id: string, siblings?: Iterable<string>) => {
    const opening = !expandedConvProjects.has(id);
    toggleConvProjectGroup(id, siblings);
    if (opening) loadHistoryGroup(id); else closeHistoryGroup();
  };
  const openListedConversation = (id: string) => {
    const conversation = convos.find((item) => item.id === id);
    void openConversation(id);
    if (isMobile && document.documentElement.hasAttribute("data-lxp-server-open")) {
      window.dispatchEvent(new CustomEvent("lxp:workspace:toggle-server"));
    }
    if (conversation?.provider && conversation.provider !== provider) {
      mobileProviderNav?.onSelect(conversation.provider);
    }
  };
  const listedRowProps = { ...looseTreeRowProps, onOpen: openListedConversation };
  const historyRetry = historyError != null && (
    <div role="alert" className="absolute inset-0 z-10 flex items-center justify-center bg-card px-3 dark:bg-background sm:bg-muted">
      <button type="button" onClick={() => void reloadList(search)} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-destructive shadow-sm hover:bg-accent">
        {historyMessages.retry}
      </button>
    </div>
  );
  const newChatButton = (
    <button key="new-chat" type="button" data-search-target="new-chat" onClick={() => {
      newConversation({ preserveAgent: !!historyAgentId });
      setMobileListOpen(false);
      if (isMobile && railNavTarget) window.dispatchEvent(new CustomEvent("lxp:workspace:toggle-server"));
    }}>
      <i className="ti ti-message-plus" aria-hidden="true" />
      <span>{ct.newConversation ?? "Nueva conversación"}</span>
    </button>
  );
  const newRootChatButton = parentRoot && (
    <button key="new-root-chat" type="button" data-search-target="new-root-chat" onClick={() => {
      looseTreeActions.onNewProjectChat(parentRoot.id);
      setMobileListOpen(false);
      if (isMobile && railNavTarget) window.dispatchEvent(new CustomEvent("lxp:workspace:toggle-server"));
    }}>
      <i className="ti ti-folder-plus" aria-hidden="true" />
      <span>{formatAssistantMessage(ct.newProjectChatAria ?? "Nueva conversación en {project}", { project: parentRoot.title })}</span>
    </button>
  );
  const newProjectButton = (
    <button key="new-project" type="button" data-search-target="new-project" onClick={() => setModalProject("new")}>
      <i className="ti ti-folder-plus" aria-hidden="true" />
      <span>{ct.addProject ?? "Nuevo proyecto"}</span>
    </button>
  );

  const sidebar = <aside
        onScrollCapture={(event) => {
          const el = event.target as HTMLElement;
          if (!el.matches("[data-project-history-scroll], [data-rail-history-list]")) return;
          const previous = scrollOffsets.current.get(el) ?? 0;
          scrollOffsets.current.set(el, el.scrollTop);
          if (historyHasMore && Math.abs(el.scrollTop) > 0 && el.scrollTop !== previous
            && el.scrollHeight - el.clientHeight - Math.abs(el.scrollTop) < 48) loadMoreHistory();
        }}
        data-vaul-no-drag
        data-search-target="chat-list"
        data-collapsed={standaloneMobile ? undefined : (railNavTarget || listOpen ? "false" : "true")}
        data-open={standaloneMobile ? (mobileListOpen ? "true" : "false") : undefined}
        inert={standaloneMobile ? !mobileListOpen : !railNavTarget && !listOpen}
        aria-hidden={standaloneMobile ? !mobileListOpen : !railNavTarget && !listOpen}
        className={`flex flex-col shrink-0 min-w-0 bg-card sm:bg-muted/20
          fixed inset-y-0 left-0 h-[100dvh] z-50 w-[90%] max-w-[90vw] border-r border-border shadow-2xl overflow-hidden
          sm:relative sm:inset-auto sm:z-auto sm:h-full sm:w-96 lg:w-[27rem] sm:max-w-none sm:!shadow-none sm:min-h-0
          ${standaloneMobile ? "lxp-slide-x" : "lxp-collapse-x"}`}
      >
        {historySearchStatus?.state === "indexing" && search.trim() && !historyError && <div role="status" className="px-3 py-2 text-xs text-muted-foreground">
          {formatAssistantMessage(ct.historyIndexing, { indexed: historySearchStatus.indexed, total: historySearchStatus.total })}
        </div>}
        {standaloneMobile ? (
          /* ── MOBILE layout: conversation and project history ── */
          <>
            {/* El Dashboard del asistente se eliminó por completo (móvil y
                 escritorio): el drawer móvil entra directo a la vista de
                 conversaciones (Agentes IA), igual que la lista del chat en desktop. */}

            {/* 2. Conversation list. The flat list uses flex-col-reverse so newest
                 items sit at the bottom near the composer; the grouped "Agentes
                 IA" thread view renders top-down (like the Dashboard) so groups
                 expand downward. Siempre visible: el toggle "Conversaciones" se
                 quitó del drawer móvil, así que la lista ocupa el alto liberado. */}
            <div
              data-vaul-no-drag
              data-project-history-scroll={unifiedRoot ? undefined : ""}
              className={unifiedRoot
                ? "flex flex-1 min-h-0 flex-col overflow-hidden"
                : `flex flex-1 min-h-0 gap-0.5 overflow-y-auto px-1.5 py-1 touch-pan-y overscroll-y-contain ${groupAgentsList || groupLooseList ? "flex-col" : "flex-col-reverse"}`}
            >
              {unifiedRoot ? (
                <SelectedProjectConvos
                  entries={looseProjectTree.entries}
                  projectById={projectById}
                  selectedProjectId={currentProjectId}
                  expanded={expandedConvProjects}
                  onToggle={toggleHistoryProject}
                  onNewLoose={looseTreeActions.onNewLoose}
                  onNewProjectChat={looseTreeActions.onNewProjectChat}
                  onEditProject={looseTreeActions.onEditProject}
                  rowProps={listedRowProps}
                />
              ) : groupAgentsList ? (
                /* `mt-auto` ancla la lista de líderes al FONDO del drawer (pegada
                   a los tabs/buscador, thumb-reach). Cuando la lista desborda, el
                   margin-top:auto colapsa a 0 y el scroll funciona con normalidad
                   desde arriba (no se cortan líderes). El orden interno (más
                   reciente abajo) no cambia. */
                <div className="mt-auto flex flex-col gap-0.5">
                  {scopedConvos.length === 0 && (
                    <p className="px-2 py-3 text-[11px] text-muted-foreground">{ct.conversations?.empty ?? "Sin conversaciones."}</p>
                  )}
                  <AgentThreadedConvos
                    convos={scopedConvos}
                    activeId={activeId}
                    agentById={agentById}
                    projectTitleById={projectTitleById}
                    rolesById={rolesById}
                    expanded={expandedConvAgents}
                    onToggle={toggleConvAgentGroup}
                    onNewAgentChat={handleNewAgentChat}
                    emptyLeaderAgents={leaderAgents}
                    newestLast
                    rowClassName="border-t border-border/40 last:border-t-0 "
                    onOpen={openListedConversation}
                    onDelete={(id) => void deleteConversation(id)}
                    onRename={(id, t) => void renameConversation(id, t)}
                    onTogglePin={(id, p) => void togglePin(id, p)}
                  />
                </div>
              ) : groupLooseList ? (
                <>
                  {scopedConvos.length === 0 && (
                    <p className="px-2 py-3 text-[11px] text-muted-foreground">{ct.conversations?.empty ?? "Sin conversaciones."}</p>
                  )}
                  <ProjectTreeConvos
                    entries={looseProjectTree.entries}
                    projectById={projectById}
                    selectedProjectId={currentProjectId}
                    expanded={expandedConvProjects}
                    onToggle={toggleHistoryProject}
                    onNewLoose={looseTreeActions.onNewLoose}
                    onNewProjectChat={looseTreeActions.onNewProjectChat}
                    onEditProject={looseTreeActions.onEditProject}
                    rowClassName="border-t border-border/40 last:border-t-0 "
                    rowProps={listedRowProps}
                  />
                </>
              ) : (
                <>
                  {scopedConvos.length === 0 && (
                    <p className="px-2 py-3 text-[11px] text-muted-foreground">{ct.conversations?.empty ?? "Sin conversaciones."}</p>
                  )}
                  {/* Sort: pinned first, then descending by updatedAt */}
                  {[...scopedConvos]
                    .sort((a, b) =>
                      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
                      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
                    )
                    // Container is `flex-col-reverse`: array index 0 renders at the
                    // visual bottom, so it's the last item → no trailing connector.
                    .map((c, i) => (
                      <TimelineRow key={c.id} isLast={i === 0}>
                        <ConvoRow
                          c={c}
                          activeId={activeId}
                          agentById={agentById}
                          projectTitleById={projectTitleById}
                          extraClassName="border-t border-border/40 last:border-t-0 "
                          projectLabel={projectQuery ? (c.projectId ? projectTitleById.get(c.projectId) ?? null : (ct.looseChats ?? "Chats sueltos")) : null}
                          onOpen={openListedConversation}
                          onDelete={(id) => void deleteConversation(id)}
                          onRename={(id, t) => void renameConversation(id, t)}
                          onTogglePin={(id, p) => void togglePin(id, p)}
                        />
                      </TimelineRow>
                    ))}
                </>
              )}
            </div>

            {/* 3. Resultados de búsqueda de proyectos O botón "Volver". La sección
                 colapsable "Proyectos" (sub-tabs Líderes/Proyectos) se eliminó del
                 drawer móvil; los proyectos se navegan desde el tab inferior
                 "Sueltos / Proyectos". Este bloque solo aparece al buscar o dentro
                 de un proyecto (flujo de proyecto intacto). */}
            {projectQuery && !projectTeam && (
            <div data-vaul-no-drag className="shrink-0 border-t border-border overflow-y-auto touch-pan-y overscroll-y-contain max-h-[38%]">
              {projectQuery ? (
                /* Search active: flat list of matching projects/subprojects. */
                <div className="px-1.5 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 block mb-0.5">{ct.projects?.heading ?? "Proyectos"}</span>
                  {flatProjectMatches.length === 0 && (
                    <p className="px-2 py-1 text-[10px] text-muted-foreground">{ct.projects?.empty ?? "Sin proyectos."}</p>
                  )}
                  {pagedMatches.visible.map(({ project: p, parent }) => (
                    <div
                      key={p.id}
                      className={`group flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer text-xs ${currentProjectId === p.id ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:bg-card/50"}`}
                      onClick={() => { setCurrentProjectId(p.id); setSearch(""); newConversation(); }}
                    >
                      <LucideIcon name={p.icon} size={14} />
                      <span className="truncate flex-1">
                        {parent && <span className="text-muted-foreground/60">{parent.title} / </span>}
                        {p.title}
                      </span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setModalProject(p); }} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-primary" title={ct.editProject ?? "Editar proyecto"} aria-label={formatAssistantMessage(ct.editProjectNamed ?? "Editar {title}", { title: p.title })}>
                        <i className="ti ti-pencil text-xs" aria-hidden></i>
                      </button>
                    </div>
                  ))}
                  {pagedMatches.hasPager && <ProjectsPager page={pagedMatches.page} pageCount={pagedMatches.pageCount} onPrev={pagedMatches.prev} onNext={pagedMatches.next} />}
                </div>
              ) : (
                /* Back row: volver a la lista de proyectos (el título del proyecto
                   y "Chats sueltos" viven ahora en la cabecera superior). El guard
                   exterior garantiza currentProjectId !== null aquí. */
                <div className="flex items-center gap-2 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentProjectId(currentProjectParent?.id ?? null);
                      newConversation();
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <i className="ti ti-arrow-left text-sm" aria-hidden></i>
                    {currentProjectParent ? currentProjectParent.title : (ct.projectsList ?? "Lista proyectos")}
                  </button>
                </div>
              )}
            </div>
            )}

            {/* 3a-bis. Sección plana "Agentes" ELIMINADA: la lista de agentes IA
                 ahora vive ÚNICAMENTE como el árbol colapsable de líderes (tab
                 "Agentes IA"), donde cada líder despliega a sus subordinados de
                 equipo (incluidos los que aún no tienen conversaciones). */}

            {/* 3b. Sub-projects (children of current project; hidden while searching) */}
            {!unifiedRoot && currentProjectId !== null && currentProjectChildren.length > 0 && (
              <div data-vaul-no-drag className="shrink-0 border-t border-border px-1.5 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 block mb-0.5">{ct.subprojects?.heading ?? "Subproyectos"}</span>
                {pagedChildren.visible.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer text-xs ${currentProjectId === p.id ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:bg-card/50"}`}
                    onClick={() => { setCurrentProjectId(p.id); newConversation(); }}
                  >
                    <LucideIcon name={p.icon} size={14} />
                    <span className="truncate flex-1">{p.title}</span>
                    {(childrenMap.get(p.id)?.length ?? 0) > 0 && (
                      <span className="text-[9px] text-muted-foreground/60 shrink-0" title={ct.subprojects?.heading ?? "Subproyectos"}>
                        {childrenMap.get(p.id)!.length}
                      </span>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setModalProject(p); }} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-primary" title={ct.editProject ?? "Editar proyecto"} aria-label={formatAssistantMessage(ct.editProjectNamed ?? "Editar {title}", { title: p.title })}>
                      <i className="ti ti-pencil text-xs" aria-hidden></i>
                    </button>
                  </div>
                ))}
                {pagedChildren.hasPager && <ProjectsPager page={pagedChildren.page} pageCount={pagedChildren.pageCount} onPrev={pagedChildren.prev} onNext={pagedChildren.next} />}
              </div>
            )}

            {/* 3c. "Sin revisar" — sección eliminada del drawer móvil (los chats
                 sin revisar ya se marcan con el punto rojo en su fila dentro de la
                 lista de conversaciones). */}

          </>
        ) : (
          /* ── DESKTOP layout: projects and conversations ── */
          <>

            {/* Los proyectos se navegan como carpetas plegables en el historial.
                La creación general está en el menú + del chatbox. */}

            {/* Sub-projects — listed directly under the Projects section and
                OUTSIDE the tinted chats container below, so the project tree
                stays grouped together. Hidden while searching (list is global). */}
            {!unifiedRoot && currentProjectChildren.length > 0 && (
              <div className="border-b border-border px-1.5 pt-2 pb-1.5 shrink-0 overflow-y-auto max-h-[25%]">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 block mb-0.5">{ct.subprojects?.heading ?? "Subproyectos"}</span>
                {pagedChildren.visible.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer text-xs ${currentProjectId === p.id ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:bg-card/50"}`}
                    onClick={() => { setCurrentProjectId(p.id); newConversation(); }}
                  >
                    <LucideIcon name={p.icon} size={14} />
                    <span className="truncate flex-1">{p.title}</span>
                    {(childrenMap.get(p.id)?.length ?? 0) > 0 && (
                      <span className="text-[9px] text-muted-foreground/60 shrink-0" title={ct.subprojects?.heading ?? "Subproyectos"}>
                        {childrenMap.get(p.id)!.length}
                      </span>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setModalProject(p); }} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-primary" title={ct.editProject ?? "Editar proyecto"} aria-label={formatAssistantMessage(ct.editProjectNamed ?? "Editar {title}", { title: p.title })}>
                      <i className="ti ti-pencil text-xs" aria-hidden></i>
                    </button>
                  </div>
                ))}
                {pagedChildren.hasPager && <ProjectsPager page={pagedChildren.page} pageCount={pagedChildren.pageCount} onPrev={pagedChildren.prev} onNext={pagedChildren.next} />}
              </div>
            )}

            {/* 3. Conversations container — tinted to visually separate the chats
                 list from the Projects section above: greyer in light mode
                 (bg-muted) and darker in dark mode (bg-background). Wraps the
                 header + the conversation list. */}
            <div data-rail-history-panel={railNavTarget ? "" : undefined} className="flex flex-1 min-h-0 flex-col bg-muted dark:bg-background">
            {/* Conversations header — SIN título/chevron collapsible: al eliminar
                la sección PROYECTOS, ésta es la única sección, así que los tabs y
                la lista van directos. Solo se pinta una etiqueta contextual al
                buscar o dentro de un proyecto. */}
            {!unifiedRoot && <div className="px-2 pt-2 pb-1 shrink-0">
              {railNavTarget && currentProjectId !== null && !unifiedRoot && (
                <button type="button" onClick={() => setCurrentProjectId(null)} className="lxp-rail-history-back">
                  <i className="ti ti-arrow-left" aria-hidden="true" />{historyLabel}
                </button>
              )}
              {!unifiedRoot && currentProjectParent && (
                <button
                  type="button"
                  onClick={() => { setCurrentProjectId(currentProjectParent.id); newConversation(); }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mb-0.5"
                >
                  <i className="ti ti-arrow-left text-[10px]" aria-hidden></i>
                  {currentProjectParent.title}
                </button>
              )}
              {(projectQuery || (!unifiedRoot && currentProject)) && (
                <div className="truncate px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {projectQuery
                    ? (ct.searchResults ?? "Resultados de búsqueda")
                    : `${ct.chatsPrefix ?? "Chats · "}${currentProject!.title}`}
                </div>
              )}
            </div>}
            <div
              id={railNavTarget && !unifiedRoot ? "lxp-rail-history-panel" : undefined}
              data-rail-history-list={railNavTarget && !unifiedRoot ? "" : undefined}
              data-project-history-scroll={unifiedRoot ? undefined : ""}
              className={unifiedRoot ? "flex flex-1 min-h-0 flex-col overflow-hidden" : "flex-1 min-h-0 overflow-y-auto px-1.5 pb-2"}
            >
              <ViewTransition
                viewKey={`${unifiedRoot ? "projects" : "flat"}:${currentProjectId ?? ""}`}
                className={unifiedRoot ? "flex min-h-0 flex-1 flex-col" : "space-y-0.5"}
              >
              {scopedConvos.length === 0 && !unifiedRoot && <p className="px-2 py-3 text-[11px] text-muted-foreground">{ct.conversations?.empty ?? "Sin conversaciones."}</p>}
              {unifiedRoot ? (
                <SelectedProjectConvos
                  entries={looseProjectTree.entries}
                  projectById={projectById}
                  selectedProjectId={currentProjectId}
                  expanded={expandedConvProjects}
                  onToggle={toggleHistoryProject}
                  onNewLoose={looseTreeActions.onNewLoose}
                  onNewProjectChat={looseTreeActions.onNewProjectChat}
                  onEditProject={looseTreeActions.onEditProject}
                  rowProps={listedRowProps}
                  inRail={Boolean(railNavTarget)}
                />
              ) : groupAgentsList ? (
                <AgentThreadedConvos
                  convos={scopedConvos}
                  activeId={activeId}
                  agentById={agentById}
                  projectTitleById={projectTitleById}
                  rolesById={rolesById}
                  expanded={expandedConvAgents}
                  onToggle={toggleConvAgentGroup}
                  onNewAgentChat={handleNewAgentChat}
                  emptyLeaderAgents={leaderAgents}
                  newestLast={false}
                  rowClassName={railNavTarget ? "lxp-history-card" : "border-b border-border/60 last:border-b-0 "}
                  onOpen={openListedConversation}
                  onDelete={(id) => void deleteConversation(id)}
                  onRename={(id, t) => void renameConversation(id, t)}
                  onTogglePin={(id, p) => void togglePin(id, p)}
                />
              ) : groupLooseList ? (
                <ProjectTreeConvos
                  entries={looseProjectTree.entries}
                  projectById={projectById}
                  selectedProjectId={currentProjectId}
                  expanded={expandedConvProjects}
                  onToggle={toggleHistoryProject}
                  onNewLoose={looseTreeActions.onNewLoose}
                  onNewProjectChat={looseTreeActions.onNewProjectChat}
                  onEditProject={looseTreeActions.onEditProject}
                  rowClassName={railNavTarget ? "lxp-history-card" : "border-b border-border/60 last:border-b-0 "}
                  rowProps={listedRowProps}
                />
              ) : (
                (() => {
                  const sorted = [...scopedConvos].sort((a, b) =>
                    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
                    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
                  );
                  return sorted.map((c, i) => (
                    <TimelineRow key={c.id} isLast={i === sorted.length - 1}>
                      <ConvoRow
                        c={c}
                        activeId={activeId}
                        agentById={agentById}
                        projectTitleById={projectTitleById}
                        extraClassName={railNavTarget ? "lxp-history-card" : "border-b border-border/60 last:border-b-0 "}
                        projectLabel={projectQuery ? (c.projectId ? projectTitleById.get(c.projectId) ?? null : (ct.looseChats ?? "Chats sueltos")) : null}
                        onOpen={openListedConversation}
                        onDelete={(id) => void deleteConversation(id)}
                        onRename={(id, t) => void renameConversation(id, t)}
                        onTogglePin={(id, p) => void togglePin(id, p)}
                      />
                    </TimelineRow>
                  ));
                })()
              )}
              </ViewTransition>
            </div>
            </div>
          </>
        )}
        {historyRetry}
        {historyHasMore && !historyError && <button type="button" data-history-load-more
          disabled={searchingHistory} onClick={loadMoreHistory}
          className="shrink-0 px-3 py-2 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50">
          {searchingHistory ? (ct.loadingMore ?? "Cargando…") : (ct.pagerNext ?? "Página siguiente")}
        </button>}
        <div className="lxp-history-create-actions" data-history-create-actions>
          <button type="button" data-search-target="agent-market" onClick={() => requestAssistant({ kind: "navigate", tab: "market", origin: { module: "assistant", action: "market" } })}>
            <Store size={18} aria-hidden="true" /><span>{marketMessages.title}</span>
          </button>
          {mobileNavigation ? <>{newProjectButton}{newChatButton}{newRootChatButton}</> : <>{newChatButton}{newRootChatButton}{newProjectButton}</>}
        </div>
      </aside>;
  return <>
    {railNavTarget && createPortal(sidebar, railNavTarget)}
    {!railNavTarget && sidebar}
  </>;
}
