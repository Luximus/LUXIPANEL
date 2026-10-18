// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Main chat column (header + messages + composer + drag overlay) of the
 * ChatPane. JSX extracted VERBATIM from the original `ChatPane.tsx`;
 * state/handlers come from the `useChatPane` view-model bag (`vm`).
 */
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./chat-alerts.css";
import PromptBar, { type PromptBarPicker } from "./reactbits/PromptBar";
import { AnimatedGreeting } from "./reactbits/AnimatedGreeting";
import { RealtimeRequests } from "./RealtimeRequests";
import { useRealtimeVoice } from "./use-realtime-voice";
import { lockChatInput } from "../chat-engine/input-lock";
import { usePromptDictation } from "./use-prompt-dictation";
import { createPortal } from "react-dom";
import { formatAssistantMessage, useAssistantI18n } from "../i18n";
import { chatEngine } from "../chat-engine";
import { resolveTargetScope } from "@/lib/api-client";
import { legacyHistoryAgentIds } from "../agent-market-state";
import { groupTeamNotices, isTeamNotice, TeamExecutionContent, TeamExecutionAttention } from "./team-execution";
import { groupExecutionTurns } from "./execution-turns";
import { useExecutionRenderKeys } from "./execution-render-keys";
import { ExecutionDisclosure } from "./tool-disclosure";
import { assistantConversationsApi, type ConversationMeta } from "../assistant-api";
import { PROVIDER_META, SLASH_COMMANDS, type AssistantProviderId, type ApprovalMode } from "../assistant-api";
import { formatTokens } from "@/lib/format";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { AgentAvatar } from "../AgentAvatar";
import { RoleChip } from "../AgentInfoChips";
import { ProviderIcon } from "../ProviderIcon";
import { LOOSE_GROUP_ID } from "../conversation-grouping";
import { START_TILES, iconForSuggestion } from "./helpers";
const TurnView = lazy(() => import("./turn-view").then(module => ({ default: module.TurnView })));
const CompactionDivider = lazy(() => import("./ask-permission").then(module => ({ default: module.CompactionDivider })));
import { StreamTimer } from "./message-bits";
import { conversationInProjectScope, projectScopeIds } from "./project-search";
import { type ChatPaneVM } from "./use-chat-pane";
import { chatUiState } from "../chat-ui-state";
import { ChatNavbar } from "./ChatNavbar";
import { useIsMobile } from "./use-is-mobile";
import { projectLocation } from "./project-location";
import { useChatProjectVisibility, visibleChatProjects } from "../chat-project-visibility";
import { ProjectAgentShortcuts } from "./ProjectAgentShortcuts";
import { useAgentShortcutActivity } from "./use-agent-shortcut-activity";
import type { AssistantAgent } from "../assistant-api";

const PROMPT_EFFORTS: Record<string, string[]> = {
  default: [],
  claude: ["Auto", "Low", "Medium", "High", "Extra"],
  codex: ["Auto", "Low", "Medium", "High", "Extra", "Max"],
  grok: ["Auto", "Low", "Medium", "High", "Extra"],
};

export function ChatMain({ vm, attachmentImages }: { vm: ChatPaneVM; attachmentImages: ReadonlyMap<string, string> }) {
  const mobileNavigation = useIsMobile(1024);
  const { welcomeTitle, agentMarket: marketMessages } = useAssistantI18n();
  const { copied: chatIdCopied, copy: copyChatId } = useCopyToClipboard();
  const [userInitials, setUserInitials] = useState<string | null>(null);
  const [serverLogo, setServerLogo] = useState("/logo_150.webp");
  useEffect(() => {
    setUserInitials(document.querySelector("[data-user-initials]")?.getAttribute("data-user-initials") ?? null);
    setServerLogo(document.querySelector<HTMLImageElement>("#server-context-rail img[data-lxp-logo-role='sidebar']")?.getAttribute("src") || "/logo_150.webp");
  }, []);
  const {
    active,
    activeId,
    applySlashCommand,
    approvalMode,
    attachError,
    attachments,
    autoSpeak,
    autosizeTextarea,
    backgroundRunning,
    canHoldRecord,
    chatKey,
    chatLoading,
    chatTokens,
    compactNow,
    compacting,
    contentRef,
    ct,
    ctx,
    currentAgent,
    currentAgentId,
    projectTeam,
    projectTeamAgents,
    agentCatalogReady,
    agentInputBlocked,
    historicalOnly,
    handleNewAgentChat,
    currentProject,
    currentProjectId,
    draft,
    dragActive,
    editMessage,
    editQueuedMessage,
    fileInputRef,
    hasMore,
    headerAgent,
    isMobile,
    isPreviewable,
    leaderAgent,
    leaderConv,
    listOpen,
    looseTreeActions,
    live,
    loadMore,
    loadingMore,
    mcpExpired,
    mcpRepairError,
    dismissMcp,
    mobileBottomSlot,
    mobileProviderNav,
    mode,
    model,
    modelOptions,
    newConversation,
    onApprovalModeChange,
    onChatDragEnter,
    onChatDragLeave,
    onChatDragOver,
    onChatDrop,
    onCloseDrawer,
    onFilesPicked,
    onKeyDown,
    onPaste,
    onScrollerScroll,
    openConversation,
    openImageByUrl,
    openStagedPreview,
    plusMenuOpen,
    provider,
    projects,
    queued,
    quickStartSuggestions,
    renderTeamBoard,
    rolesById,
    scrollerRef,
    selectedModel,
    selectedEffort,
    send,
    setAttachments,
    setBrowserOpen,
    setDraft,
    setEditorPath,
    setListOpen,
    setModalProject,
    setMobileListOpen,
    setPlusMenuOpen,
    setSelectedModel,
    setSelectedEffort,
    setSlashIndex,
    setVoiceActive,
    slashIndex,
    slashMatches,
    slashOpen,
    streaming,
    support,
    teamBoardGroups,
    terminalAvailable,
    textareaRef,
    ttsAvailable,
    turns,
    uiMode,
    visibleProviderOptions,
    voice,
    voiceActive,
    voiceEnabled,
    webSpeechAvailable,
  } = vm;

  const realtime = useRealtimeVoice({
    enabled: voiceEnabled && !!voice?.realtimeEnabled, canStart: !agentInputBlocked, chatKey, conversationId: activeId,
    contextKey: JSON.stringify([provider, activeId ? vm.activeMeta?.agentId ?? currentAgentId : currentAgentId, vm.effectiveProjectId]),
    refresh: (key, id) => chatEngine.refreshVoiceHistory(key, id),
    ensureConversation: async (accept) => {
      if (agentInputBlocked) throw new Error(marketMessages.historical);
      if (activeId) return activeId;
      const meta = await assistantConversationsApi.create(provider, "Conversación por voz", currentProjectId, currentAgent?.id ?? null, { approvalMode });
      if (accept(meta.id)) {
        // Adopt the returned binding atomically with the new id. The previous
        // render's list cannot yet contain it when openConversation selects it.
        vm.setConvos(items => [meta, ...items.filter(item => item.id !== meta.id)]);
        const opening = openConversation(meta.id);
        vm.setCurrentAgentId(meta.agentId ?? null);
        await opening;
      }
      return meta.id;
    },
  });
  const audioLockRef = useRef<(() => void) | null>(null);
  const onAudioPhaseChange = (value: boolean) => {
    if (value && !audioLockRef.current) audioLockRef.current = lockChatInput(chatKey, "voice-note");
    if (!value) { audioLockRef.current?.(); audioLockRef.current = null; }
  };
  useEffect(() => () => { audioLockRef.current?.(); audioLockRef.current = null; }, [chatKey]);
  const promptDictation = usePromptDictation();
  useEffect(() => () => promptDictation.cancel(), [chatKey, promptDictation.cancel]);

  const scopedProjectIds = useMemo(() => projectScopeIds(currentProjectId, projects), [currentProjectId, projects]);
  const { hiddenIds: hiddenProjectIds } = useChatProjectVisibility();
  const selectedRootProject = useMemo(() => {
    const byId = new Map(projects.map((project) => [project.id, project]));
    let project = currentProjectId ? byId.get(currentProjectId) : undefined;
    const seen = new Set<string>();
    while (project?.parentId) {
      if (seen.has(project.id)) return null;
      seen.add(project.id);
      project = byId.get(project.parentId);
    }
    return project ?? null;
  }, [currentProjectId, projects]);
  const rootProjects = visibleChatProjects(projects, hiddenProjectIds, selectedRootProject?.id);
  const shortcutProjectIds = useMemo(() => {
    if (!selectedRootProject || !projectTeam) return [];
    return [...projectScopeIds(selectedRootProject.id!, projects)];
  }, [selectedRootProject, projectTeam, projects]);
  const shortcutLegacyAgents = useMemo(() => selectedRootProject
    ? legacyHistoryAgentIds(projectTeamAgents, projects, selectedRootProject.id) : [],
  [selectedRootProject, projectTeamAgents, projects]);
  // The project landing offers agents; a selected agent or an opened chat
  // uses the regular conversation view, including when its history is empty.
  const showAgentShortcuts = !!currentProject && !currentAgentId && !activeId && !chatLoading && turns.length === 0;
  const shortcutActivity = useAgentShortcutActivity(shortcutProjectIds, projectTeamAgents.map(agent => agent.id!),
    active !== false && showAgentShortcuts && agentCatalogReady && !!projectTeam, shortcutLegacyAgents);
  const agentRoleId = (agent: AssistantAgent) => agent.context?.effectiveConfig?.roleId ?? agent.roleId;
  const agentRoleLabel = (agent: AssistantAgent) => agent.context?.effectiveAssignment?.jobTitle
    || (agentRoleId(agent) && rolesById.get(agentRoleId(agent)!)?.name)
    || (agent.id === projectTeam?.root.leaderAgentId ? ct.agentRoleLeader : ct.agentBadgeModel);
  const selectProjectAgent = (key: string) => {
    if (key === (currentAgentId ?? "")) return;
    if (vm.historicalProjectAgents.some(agent => agent.id === key)) {
      newConversation(); vm.setCurrentAgentId(key); setDraft(draft); setAttachments(attachments); return;
    }
    if (key) handleNewAgentChat(key, true);
    else { newConversation(); setDraft(draft); setAttachments(attachments); }
  };
  // An open conversation owns its project; sidebar navigation is only the
  // draft scope when no conversation is open.
  const locationNames = useMemo(() => projectLocation(
    activeId ? vm.activeMeta?.projectId : currentProjectId,
    projects,
  ), [activeId, vm.activeMeta?.projectId, currentProjectId, projects]);
  const locationLabel = locationNames.join(" / ");
  const greetingLogo = <span className="lxp-chat-greeting-logo" aria-hidden="true">
    {currentAgent ? <AgentAvatar agent={currentAgent} size={84} className="!h-full !w-full" /> : <img
      data-lxp-logo-role="sidebar"
      src={serverLogo}
      alt=""
      onError={(event) => {
        if (!event.currentTarget.src.endsWith("/logo_150.webp")) event.currentTarget.src = "/logo_150.webp";
      }}
    />}
  </span>;

  // The topbar search asks the active chat pane for matching history. Keep the
  // selected project as the single scope for both the composer and that search.
  useEffect(() => {
    if (!active) return;
    const onSearch = (event: Event) => {
      const detail = (event as CustomEvent<{
        query?: string;
        scopeLabel?: string;
        promise?: Promise<ConversationMeta[]>;
      }>).detail;
      const query = detail?.query?.trim();
      if (!detail || !query) return;
      detail.scopeLabel = currentProject?.title ?? (ct.looseChats ?? "Chats sueltos");
      detail.promise = (async () => {
        const { items } = await assistantConversationsApi.list(query, 15, 0, undefined, undefined, undefined,
          { projectIds: currentProjectId ? [...scopedProjectIds] : ["none"] });
        return items;
      })();
    };
    window.addEventListener("luxipanel:assistant-search", onSearch);
    return () => window.removeEventListener("luxipanel:assistant-search", onSearch);
  }, [active, currentProjectId, scopedProjectIds, currentProject?.title, ct.looseChats]);

  // Super buscador / deep-links: start a fresh chat from the global action.
  // `detail.__ack` tells the dispatcher the island handled the event.
  useEffect(() => {
    const onNew = (ev: Event) => {
      const detail = (ev as CustomEvent<{ __ack?: boolean }>).detail;
      if (detail && typeof detail === "object") detail.__ack = true;
      newConversation();
    };
    window.addEventListener("luxipanel:assistant-new-conversation", onNew);
    return () => window.removeEventListener("luxipanel:assistant-new-conversation", onNew);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newConversation]);

  // Precompute the two per-turn derivations ONCE per turns-change (O(N)) instead
  // of inside the .map below, where `turns.slice(i+1).every(...)` and
  // `turns.slice(0,i).reverse().find(...)` made each render O(N²) — and this pane
  // re-renders on every streaming SSE token.
  const lastUserTurnIndex = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i--) if (turns[i]?.role === "user") return i;
    return -1;
  }, [turns]);
  const teamNotices = useMemo(() => groupTeamNotices(turns), [turns]);
  const executionTurns = useMemo(() => groupExecutionTurns(turns), [turns]);
  const { lastAssistantTurnIndex, lastVisibleTurnIndex } = teamNotices;
  // Native disclosures and board state belong to this target and conversation.
  const executionScope = `${resolveTargetScope()}:${chatKey}`;
  const renderedExecutions = useExecutionRenderKeys(executionTurns, executionScope);
  const precedingUserText = useMemo(() => {
    const out: (string | null)[] = new Array(turns.length).fill(null);
    let lastText: string | null = null;
    for (let i = 0; i < turns.length; i++) {
      out[i] = lastText;
      if (turns[i]?.role === "user" && !isTeamNotice(turns[i]!)) lastText = turns[i]?.text ?? null;
    }
    return out;
  }, [turns]);

  return (
      <div
        data-lxp-chat-empty={!chatLoading && turns.length === 0 ? "true" : "false"}
        className="relative flex flex-1 min-w-0 flex-col"
        onDragEnter={onChatDragEnter}
        onDragOver={onChatDragOver}
        onDragLeave={onChatDragLeave}
        onDrop={onChatDrop}
      >
        <div ref={scrollerRef} onScroll={onScrollerScroll} className="flex-1 overflow-y-auto px-4 py-3">
          {chatLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <i className="ti ti-loader-2 animate-spin text-3xl text-primary/70" aria-hidden></i>
              <p className="font-medium text-foreground">{ct.loadingConversation ?? "Cargando conversación…"}</p>
            </div>
          ) : (
            <div ref={contentRef} data-lxp-chat-empty-content={!chatLoading && turns.length === 0 ? "" : undefined} className="mx-auto w-full max-w-[780px] space-y-3">
              {hasMore && (
                <div className="flex justify-center">
                  <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-full border border-border px-3 py-1 text-[11px] hover:bg-accent disabled:opacity-50">
                    {loadingMore ? (ct.loadingMore ?? "Cargando…") : (ct.loadOlderMessages ?? "Cargar mensajes anteriores")}
                  </button>
                </div>
              )}
              {turns.length === 0 && (
                  <div className="lxp-chat-start flex w-full flex-col items-center justify-center px-1">
                   <div className="flex w-full max-w-[720px] flex-col text-center">
                    <div className="lxp-chat-start-heading pb-3">
                      {greetingLogo}
                      <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                        <AnimatedGreeting text={currentAgent
                          ? formatAssistantMessage(ct.chatWith ?? "Chat con {name}", { name: currentAgent.name })
                          : currentProject
                          ? formatAssistantMessage(ct.newProjectChatAria ?? "Nueva conversación en {project}", { project: currentProject.title })
                          : welcomeTitle} highlightedName={currentAgent?.name ?? currentProject?.title} />
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">{showAgentShortcuts ? ct.agentShortcuts.description : (ct.startPointsDescription ?? "Elige un punto de partida o escribe tu propia pregunta abajo.")}</p>
                    </div>
                    {showAgentShortcuts ? <ProjectAgentShortcuts agents={projectTeam ? projectTeamAgents : []} selectedId={currentAgentId ?? null}
                      roleLabel={agentRoleLabel} onSelect={selectProjectAgent} labels={ct.agentShortcuts}
                      {...shortcutActivity} loading={!agentCatalogReady || (!!projectTeam && shortcutActivity.loading)} /> : quickStartSuggestions.length > 0 && (
                      <div className="lxp-chat-start-actions mt-4 flex flex-wrap items-center justify-center gap-2">
                        {quickStartSuggestions.map((s, i) => {
                          const tile = START_TILES[i % START_TILES.length];
                          // Colour keeps rotating by index; the icon reflects the
                          // question when a keyword matches, else the rotated one.
                          const icon = iconForSuggestion(s) ?? tile.icon;
                          return (
                            <button
                              key={`${i}-${s}`}
                              type="button"
                              onClick={() => { if (!agentInputBlocked) void send(s); }}
                              disabled={streaming || agentInputBlocked}
                              className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tile.color} text-white`}>
                                <i className={`ti ${icon} text-[11px]`} aria-hidden></i>
                              </span>
                              <span className="min-w-0 truncate">{s}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                   </div>
                  </div>
              )}
              {renderedExecutions.map(({ turn: t, index: i, firstIndex, indices, phases, renderKey }) => {
                // Compaction summary: render a divider, not a chat bubble — it's
                // a synthetic note that replaced the older turns it folded.
                if (t.compacted) {
                  return <Suspense key={`${executionScope}:${renderKey}`} fallback={null}><CompactionDivider turn={t} /></Suspense>;
                }
                // Edit button: only on the last user turn, only while the AI is running.
                const isLastUserTurn = streaming && t.role === "user" && i === lastUserTurnIndex;
                // Both the error retry and the completed-turn quick action
                // resend the user request that produced this assistant turn.
                const retryText =
                  t.role === "assistant"
                    ? precedingUserText[firstIndex]
                    : null;
                const turnTeamTasks = t.role === "assistant" ? [...new Map([
                  ...indices.flatMap(index => teamBoardGroups.byTurn.get(index) ?? []),
                  ...(i === lastAssistantTurnIndex ? teamBoardGroups.unanchored : []),
                ].map(task => [task.id, task])).values()] : [];
                const teamBoards = [renderTeamBoard(turnTeamTasks, `team-board-turn-${renderKey}`, true)].filter(Boolean);
                return (
                  <Fragment key={`${executionScope}:${renderKey}`}>
                    <Suspense fallback={<div aria-busy="true" className="min-h-12" />}><TurnView
                      turn={t}
                      executionPhases={phases}
                      provider={provider}
                      uiMode={uiMode}
                      isLast={i === lastVisibleTurnIndex}
                      onAnswer={async (text, opts) => {
                        if (agentInputBlocked) return;
                        if (opts?.planDecision === "approve") {
                          const changed = await onApprovalModeChange?.("auto");
                          if (!changed) throw new Error("Failed to enable automatic approval");
                        }
                        await send(text, opts?.planDecision ? { planDecision: opts.planDecision } : undefined);
                      }}
                      onPermission={(requestId, decision, tool) => { if (!agentInputBlocked) chatEngine.respondPermission(chatKey, requestId, decision, tool); }}
                      onNewChat={newConversation}
                      onRetry={retryText && !streaming && !agentInputBlocked ? () => void send(retryText) : undefined}
                      onEditMessage={isLastUserTurn && !agentInputBlocked ? editMessage : undefined}
                      onImageClick={openImageByUrl}
                      attachmentImageUrls={attachmentImages}
                      onOpenFile={(p) => setEditorPath(p)}
                      projectPath={currentProject?.path}
                      ttsAvailable={ttsAvailable}
                      voiceName={voice?.voice}
                      autoSpeak={autoSpeak && !realtime.active}
                      conversationId={activeId ?? undefined}
                      agent={headerAgent}
                      scrollContainerRef={scrollerRef}
                      teamBoards={teamBoards}
                      teamTasks={turnTeamTasks}
                      teamNotices={indices.flatMap(index => teamNotices.byTurn.get(index) ?? [])}
                    /></Suspense>
                  </Fragment>
                );
              })}
              <RealtimeRequests voice={realtime} />
              {/* Tasks/notices can arrive before the first assistant reply. */}
              {lastAssistantTurnIndex < 0 && (teamBoardGroups.unanchored.length > 0 || teamNotices.unanchored.length > 0) && (
                <div key={`${executionScope}:unanchored`} data-message-section="console" className="w-full max-w-[48rem] overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-sm">
                  <ExecutionDisclosure running={teamBoardGroups.unanchored.some(task => task.status === "pending" || task.status === "running")} attention={<TeamExecutionAttention tasks={teamBoardGroups.unanchored} />}>
                    <TeamExecutionContent boards={[renderTeamBoard(teamBoardGroups.unanchored, "team-board-unanchored", true)].filter(Boolean)} notices={teamNotices.unanchored} />
                  </ExecutionDisclosure>
                </div>
              )}
            </div>
          )}
        </div>

        {(() => {
          const toolbarPickers: PromptBarPicker[] = [
            {
              key: "project", label: ct.projects?.heading ?? "Proyecto",
              value: currentProjectId ?? LOOSE_GROUP_ID,
              icon: <i className="ti ti-folder text-sm opacity-80" aria-hidden />,
              options: [
                { key: LOOSE_GROUP_ID, name: ct.looseChats ?? "Chats sueltos" },
                ...(currentProjectId && currentProjectId !== selectedRootProject?.id ? [{
                  key: currentProjectId,
                  name: projectLocation(currentProjectId, projects).join(" / "),
                }] : []),
                ...rootProjects.map(project => ({ key: project.id, name: project.title })),
              ],
              onChange: key => {
                const nextId = key === LOOSE_GROUP_ID ? null : key;
                if (nextId === currentProjectId) return;
                if (nextId) looseTreeActions.onNewProjectChat(nextId);
                else looseTreeActions.onNewLoose();
              },
              action: selectedRootProject ? {
                label: formatAssistantMessage(ct.editProjectNamed ?? "Editar {title}", { title: selectedRootProject.title }),
                icon: <i className="ti ti-pencil text-sm" aria-hidden />,
                onSelect: () => setModalProject(selectedRootProject),
              } : undefined,
              before: !mobileNavigation ? <>
                {terminalAvailable && <button type="button" data-search-target="chat-prompt-terminal" onClick={() => window.__lxpFloatingTerminalAPI?.requestOpen()} className="prompt-bar__tool" aria-label={ct.openTerminal ?? "Terminal"} title={ct.openTerminal ?? "Terminal"}><i className="ti ti-terminal-2 text-base" aria-hidden /></button>}
                <button type="button" data-search-target="chat-prompt-multimedia" onClick={() => setBrowserOpen(true)} className="prompt-bar__tool" aria-label={ct.multimedia ?? "Multimedia"} title={ct.multimedia ?? "Multimedia"}><i className="ti ti-photo text-base" aria-hidden /></button>
              </> : undefined,
            },
            ...(projectTeam && agentCatalogReady ? [{
              key: "agent", label: ct.chatsWithAgents ?? "Agentes IA",
              value: currentAgentId ?? "",
              title: ct.agentHistoryHelp ?? "Filtra el historial por miembro e inicia un chat con él.",
              icon: <i className="ti ti-users text-sm opacity-80" aria-hidden />,
              options: [
                { key: "", name: ct.agentHistoryAll ?? "Todos los agentes" },
                ...projectTeamAgents.map(agent => ({ key: agent.id!, name: `[${agentRoleLabel(agent)}] ${agent.name}` })),
                ...vm.historicalProjectAgents.map(agent => ({ key: agent.id, name: `${agent.name} · ${marketMessages.historical}` })),
              ],
              onChange: selectProjectAgent,
            }] : []),
            ...(onApprovalModeChange ? [{
              key: "approval", label: ct.approvalModeLabel ?? "Modo de aprobación del agente",
              value: approvalMode,
              title: ct.approvalModeHelp ?? "Cómo debe actuar el agente al realizar tareas: aprobación manual, automática o generar plan.",
              icon: <i className="ti ti-shield-check text-sm" aria-hidden />,
              options: [
                { key: "manual", name: ct.approvalManual ?? "Aprob. manual" },
                { key: "auto", name: ct.approvalAuto ?? "Aprob. automática" },
                { key: "plan", name: ct.approvalPlan ?? "Generar plan" },
              ],
              onChange: (key: string) => { void onApprovalModeChange(key as ApprovalMode); },
            }] : []),
            {
              key: "provider", label: ct.changeProvider ?? "Cambiar proveedor",
              value: provider,
              icon: <ProviderIcon id={provider as AssistantProviderId} className="text-sm opacity-80" />,
              options: visibleProviderOptions.map(option => ({
                key: option.id,
                name: option.label ?? PROVIDER_META[option.id as AssistantProviderId]?.label ?? option.id,
                icon: <ProviderIcon id={option.id as AssistantProviderId} className="text-sm" />,
              })),
              onChange: key => { if (key !== provider) mobileProviderNav?.onSelect(key); },
            },
          ];
          {/* Single action slot to the right of the pill: renders exactly ONE of
              record-bar / stop / send / mic / disabled-send by priority. */}
          const composerNode = (
          <>
          {active && mobileNavigation && <ChatNavbar project={toolbarPickers[0]} terminalAvailable={terminalAvailable}
            terminalLabel={ct.openTerminal ?? "Terminal"} multimediaLabel={ct.multimedia ?? "Multimedia"}
            onTerminal={() => window.__lxpFloatingTerminalAPI?.requestOpen()} onMultimedia={() => setBrowserOpen(true)} />}
          <div className="lxp-chat-composer relative border-t border-border p-3 shrink-0 space-y-2">
          {(!isMobile || onCloseDrawer || headerAgent || activeId || streaming || backgroundRunning || chatTokens.total > 0 || attachments.length > 0 || locationNames.length > 0 || (ctx?.enabled && ctx.limit > 0 && (ctx.warn || ctx.ratio >= 0.5))) && (
            <div className="lxp-chat-composer-meta mx-auto flex w-full max-w-[780px] flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              <button type="button" data-search-target="chat-list-toggle" onClick={() => setListOpen((value) => !value)} className="hidden sm:inline-flex h-6 items-center justify-center rounded px-1 text-muted-foreground hover:bg-accent" title={listOpen ? (ct.hideList ?? "Ocultar lista") : (ct.showList ?? "Mostrar lista")} aria-label={listOpen ? (ct.hideList ?? "Ocultar lista") : (ct.showList ?? "Mostrar lista")}>
                <i className={`ti ${listOpen ? "ti-chevron-left" : "ti-chevron-right"} text-sm`} aria-hidden />
              </button>
              {headerAgent && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("luxipanel:assistant-settings-open", { detail: { section: "agentes", agentId: headerAgent.id } }))}
                  title={formatAssistantMessage(ct.agentChipTitle ?? "Agente: {name} · clic para info", { name: headerAgent.name })}
                  aria-label={formatAssistantMessage(ct.agentChipAria ?? "Ver información del agente {name}", { name: headerAgent.name })}
                  className="inline-flex h-6 min-w-0 items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-2 text-[10px] text-foreground transition-colors hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                >
                  <AgentAvatar agent={headerAgent} size={14} />
                  <span className="max-w-[9rem] truncate font-medium">{headerAgent.name}</span>
                  <RoleChip role={agentRoleId(headerAgent) ? rolesById.get(agentRoleId(headerAgent)!) ?? null : null} className="shrink-0" />
                  <i className="ti ti-info-circle text-[10px] shrink-0 opacity-70" aria-hidden />
                </button>
              )}
              {activeId && leaderConv && (
                <button
                  type="button"
                  onClick={() => void openConversation(leaderConv.conversationId)}
                  title={leaderAgent ? formatAssistantMessage(ct.backToLeaderNamed ?? "Volver al chat de {name}", { name: leaderAgent.name }) : (ct.backToLeader ?? "Volver al chat del líder")}
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 text-primary hover:bg-primary/20"
                >
                  <i className="ti ti-arrow-back-up text-xs" aria-hidden />
                  {ct.backToLeader ?? "Volver al chat del líder"}
                </button>
              )}
              {chatTokens.total > 0 && (
                <span className="lxp-chat-token-counter inline-flex h-6 items-center gap-1 text-muted-foreground tabular-nums" title={ct.tokenAccumTooltip ?? `Tokens acumulados de este chat${chatTokens.estimated ? " (incluye estimaciones de CLI)" : " (recuento real)"} · ${chatTokens.assistantTurns} turno(s)`}>
                  <span aria-hidden>Σ</span>{formatTokens(chatTokens.total)}{chatTokens.estimated ? "~" : ""} tok
                  <span className="opacity-70">· {chatTokens.assistantTurns}</span>
                </span>
              )}
              {activeId && (
                <button type="button" onClick={() => void copyChatId(activeId)} title={chatIdCopied ? (ct.copyDone ?? "Copiado") : (ct.copyChatId ?? "Copiar ID chat")} aria-label={ct.copyChatId ?? "Copiar ID chat"} className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 text-[10px] text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                  <i className={`ti ${chatIdCopied ? "ti-check" : "ti-copy"} text-xs`} aria-hidden />
                  {ct.copyChatId ?? "Copiar ID chat"}
                </button>
              )}
              {attachments.length > 0 && (
                <div className="lxp-chat-staged-attachments" aria-label={ct.attachments ?? "Adjuntos"}>
                  {attachments.map((a, i) => (
                    <span key={`${a.name}-${i}`} className="lxp-chat-staged-attachment" title={a.name}>
                      <button type="button" onClick={() => isPreviewable(a.mimeType) && openStagedPreview(i)} className="lxp-chat-staged-attachment-preview" disabled={!isPreviewable(a.mimeType)} title={a.name}>
                        {a.mimeType.startsWith("image/") ? <img src={`data:${a.mimeType};base64,${a.dataBase64}`} alt="" /> : <i className={`ti ${a.mimeType === "application/pdf" ? "ti-file-type-pdf" : "ti-file"}`} aria-hidden="true" />}
                        <span>{a.name}</span>
                      </button>
                      <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="lxp-chat-staged-attachment-remove" aria-label={`${ct.removeAttachment ?? "Quitar adjunto"}: ${a.name}`}><i className="ti ti-x" aria-hidden="true" /></button>
                    </span>
                  ))}
                </div>
              )}
              {ctx?.enabled && ctx.limit > 0 && (ctx.warn || ctx.ratio >= 0.5) && (
                <span className={`inline-flex h-6 items-center gap-1 tabular-nums ${ctx.ratio >= 0.9 ? "text-red-500" : ctx.warn ? "text-amber-500" : "text-muted-foreground"}`} title={formatAssistantMessage(ct.contextTooltip ?? "Contexto estimado: {tokens} / {limit} tokens ({pct}% de la ventana del modelo). Al llenarse, compacta para resumir lo antiguo.", { tokens: formatTokens(ctx.tokens), limit: formatTokens(ctx.limit), pct: Math.round(ctx.ratio * 100) })}>
                  <i className="ti ti-windmill text-xs" aria-hidden />ctx {Math.round(ctx.ratio * 100)}%
                </span>
              )}
              {ctx?.warn && !streaming && (
                <button type="button" onClick={() => void compactNow()} disabled={compacting} title={ct.compactHelp ?? "Compactar la conversación"} className="inline-flex h-6 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 text-amber-600 hover:bg-amber-500/20 disabled:opacity-50">
                  <i className={`ti ${compacting ? "ti-loader-2 animate-spin" : "ti-arrows-minimize"} text-xs`} aria-hidden />
                  {compacting ? (ct.compacting ?? "Compactando…") : (ct.compact ?? "Compactar")}
                </button>
              )}
              {streaming ? <span className="inline-flex h-6 items-center gap-1 text-emerald-500"><i className="ti ti-loader-2 animate-spin" aria-hidden />{ct.responding ?? "respondiendo…"} <StreamTimer running={streaming} /></span> : backgroundRunning ? <span className="inline-flex h-6 items-center gap-1 text-amber-500" title={ct.backgroundRunningTitle ?? "La tarea sigue ejecutándose en el servidor"}><i className="ti ti-cloud-cog" aria-hidden />{ct.inBackground ?? "en background"}</span> : null}
              {locationNames.length > 0 && (
                <span className="lxp-chat-project-path" title={locationLabel} aria-label={locationLabel}>
                  <i className="ti ti-folder" aria-hidden="true" />
                  <span className="lxp-chat-project-path-text">{locationLabel}</span>
                </span>
              )}
              {onCloseDrawer && <button type="button" onClick={onCloseDrawer} aria-label={ct.closeAssistant ?? "Cerrar asistente"} title={ct.close ?? "Cerrar"} className="ml-auto sm:hidden rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><i className="ti ti-x text-base" aria-hidden /></button>}
            </div>
          )}
          <div className="lxp-chat-composer-navigation" />
          {/* Recovery runs silently; only an exhausted recovery needs a notice. */}
          {mcpExpired && mcpRepairError && (
            <div role="status" aria-live="polite" className="lxp-chat-alert">
              <i className="ti ti-alert-triangle lxp-chat-alert__icon" aria-hidden></i>
              <div className="lxp-chat-alert__content">
                <p className="font-medium">{ct.mcpRepairFailed ?? "No se pudo recuperar la conexión automáticamente."}</p>
                <p className="lxp-chat-alert__description">{mcpRepairError}</p>
              </div>
              <button type="button" onClick={dismissMcp} aria-label={ct.mcpDismiss ?? "Cerrar"} className="lxp-chat-alert__button lxp-chat-alert__dismiss">
                <i className="ti ti-x" aria-hidden></i>
              </button>
            </div>
          )}

          {/* Queued follow-ups: messages sent while a run was in flight. They
              dispatch automatically (FIFO) once the current run finishes. */}
          {queued.length > 0 && (
            <div className="mx-auto w-full max-w-[780px] space-y-1">
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <i className="ti ti-clock-pause text-[11px]" aria-hidden></i>
                {formatAssistantMessage(ct.queuedHeader ?? "En cola ({n})", { n: queued.length })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {queued.map((q, i) => (
                  <span key={i} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-2 py-1 text-[11px]">
                    <span className="text-muted-foreground/60 tabular-nums">{i + 1}.</span>
                    <span className="max-w-48 truncate">{q || (ct.queuedAttachmentLabel ?? "(adjunto)")}</span>
                    <button type="button" onClick={() => void editQueuedMessage(i)} className="text-muted-foreground hover:text-primary" title={ct.editBeforeSend ?? "Editar antes de enviar"}>
                      <i className="ti ti-pencil text-xs" aria-hidden></i>
                    </button>
                    <button type="button" onClick={() => chatEngine.cancelQueued(chatKey, i)} className="text-muted-foreground hover:text-red-500" title={ct.removeFromQueue ?? "Quitar de la cola"}>
                      <i className="ti ti-x text-xs" aria-hidden></i>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {attachError && <p className="lxp-chat-alert lxp-chat-alert--attachment" role="alert">⚠ {attachError}</p>}

          {support.enabled && <input ref={fileInputRef} type="file" multiple accept={support.acceptAttr} className="hidden" onChange={(event) => void onFilesPicked(event.target.files)} />}
          {!!currentAgentId && !agentCatalogReady && (vm.agentCatalogError
            ? <div role="alert" className="flex items-center justify-center gap-2 text-sm"><span>{marketMessages.error}</span><button type="button" className="min-h-11 rounded-md border border-border px-3 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" onClick={vm.retryAgentCatalog}>{marketMessages.retry}</button></div>
            : <p role="status" className="text-center text-sm text-muted-foreground">{marketMessages.loading}</p>)}
          {historicalOnly && <p role="status" className="text-center text-sm text-muted-foreground">{marketMessages.historical}</p>}
          <PromptBar
            key={`${provider}:${currentAgent?.id ?? "loose"}`}
            className="lxp-chat-prompt"
            mobileLayout={mobileNavigation}
            readOnly={agentInputBlocked}
            value={draft}
            onChange={(text) => { setDraft(text); requestAnimationFrame(autosizeTextarea); }}
            inputRef={textareaRef}
            onPaste={onPaste}
            placeholder={mobileNavigation ? (ct.composerPlaceholder ?? "Escribe tu mensaje…") : support.enabled ? (ct.composerPlaceholderAttach ?? "Escribe o pega una imagen (Ctrl+V)…") : (ct.composerPlaceholder ?? "Escribe tu mensaje…")}
            sources={[]}
            settingsLabel={ct.advancedSettings ?? "Configuración avanzada"}
            onOpenSettings={() => window.dispatchEvent(new CustomEvent("luxipanel:assistant-settings-open"))}
            toolbarPickers={mobileNavigation ? toolbarPickers.filter(picker => picker.key !== "project") : toolbarPickers}
            inputLeading={mobileNavigation ? null : <a href="/panel/preferences#pref-profile" className="prompt-bar__profile-avatar" aria-label={`${ct.openProfile ?? "Abrir perfil"}${userInitials ? ` (${userInitials})` : ""}`} title={ct.openProfile ?? "Abrir perfil"}><span aria-hidden="true">{userInitials ?? <i className="ti ti-user" aria-hidden="true" />}</span></a>}
            commands={SLASH_COMMANDS.map((command) => ({ key: command.cmd, name: command.cmd, description: command.desc }))}
            models={[
              { key: "", name: currentAgent?.model && provider === currentAgent.providerId ? `${ct.agentBadgeModel ?? "Agente"} · ${currentAgent.model}` : (ct.modelAuto ?? "Auto") },
              ...modelOptions.map((name) => ({ key: name, name })),
            ]}
            defaultModel={selectedModel}
            onModelChange={(value) => {
              setSelectedModel(value);
              chatUiState.patchConversationChoice(provider, activeId, { model: value });
            }}
            efforts={mode === "api" || provider === "codex" || provider === "claude" ? (PROMPT_EFFORTS[provider] ?? PROMPT_EFFORTS.default) : PROMPT_EFFORTS.default}
            effortLabels={{ Auto: ct.modelAuto ?? "Auto", Low: ct.reasoningLow ?? "Bajo", Medium: ct.reasoningMedium ?? "Medio", High: ct.reasoningHigh ?? "Alto", Extra: ct.reasoningExtra ?? "Extra", Max: ct.reasoningMax ?? "Max" }}
            effortTitle={ct.reasoningEffort ?? "Esfuerzo"}
            effortHelp={ct.reasoningEffortHelp ?? "Un nivel más alto dedica más tiempo al razonamiento antes de responder"}
            reasoningLabel={ct.reasoning ?? "razonamiento"}
            automaticReasoningLabel={ct.reasoningAuto ?? "razonamiento automático"}
            defaultEffort={selectedEffort}
            onEffortChange={(value) => {
              setSelectedEffort(value);
              chatUiState.patchConversationChoice(provider, activeId, { effort: value });
            }}
            realtime={realtime.active || (!agentInputBlocked && voiceEnabled && voice?.realtimeEnabled) ? realtime : undefined}
            onAudioPhaseChange={onAudioPhaseChange}
            onDictate={!agentInputBlocked && voiceEnabled && !voice?.realtimeEnabled && canHoldRecord ? promptDictation.dictate : undefined}
            onStopDictation={promptDictation.stop}
            onCancelDictation={promptDictation.cancel}
            cancelDictationLabel={ct.cancelAudio ?? "Cancelar audio"}
            dictateLabel={ct.sttStart ?? "Dictar por voz"}
            stopDictationLabel={ct.sttStop ?? "Detener dictado"}
            dictateHint={`${ct.sttStart ?? "Dictar por voz"} · OpenAI`}
            externalAttachmentCount={attachments.length}
            onSend={(text, detail) => { if (agentInputBlocked) return; const level = detail.effort ?? "Auto"; return send(text, { ...(detail.recording ? { attachmentsOverride: [detail.recording], queue: true } : {}), reasoningEffort: level === "Extra" ? "xhigh" : level === "Auto" ? undefined : level.toLowerCase() as "low" | "medium" | "high" | "max" }); }}
            onStop={() => chatEngine.stop(chatKey)}
            onQueue={agentInputBlocked ? undefined : () => void send(undefined, { queue: true, reasoningEffort: selectedEffort === "Extra" ? "xhigh" : selectedEffort === "Auto" ? undefined : selectedEffort.toLowerCase() as "low" | "medium" | "high" | "max" })}
            queueLabel={ct.queueMessage ?? "Encolar mensaje"}
            busy={streaming || backgroundRunning}
            width={780}
          />
          </div>
          </>
          );
          return isMobile && active && mobileBottomSlot
            ? createPortal(composerNode, mobileBottomSlot)
            : composerNode;
        })()}

        {/* Overlay de drag&drop: cubre TODO el chat (mensajes + composer) mientras
            se arrastran archivos. `pointer-events-none` para que el drop lo capture
            el wrapper (que lleva onDrop); solo activo si el modelo soporta adjuntos. */}
        {dragActive && support.enabled && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-[0.3rem] border-2 border-dashed border-primary/60 bg-background/85 px-8 py-6 text-center shadow-lg">
              <i className="ti ti-paperclip text-3xl text-primary" aria-hidden></i>
              <p className="text-sm font-medium text-foreground">{ct.dropFilesToAttach ?? "Suelta los archivos para adjuntarlos"}</p>
            </div>
          </div>
        )}
      </div>
  );
}
