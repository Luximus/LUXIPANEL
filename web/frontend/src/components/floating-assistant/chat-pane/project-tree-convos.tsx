// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Recursive "Sueltos / Proyectos" conversation tree (project folder header +
 * recursive list). Extracted verbatim from the original `ChatPane.tsx`.
 */
import { useState, type ReactNode } from "react";
import { useAssistantI18n, formatAssistantMessage } from "../i18n";
import { LucideIcon } from "../LucideIcon";
import { chatEngine } from "../chat-engine";
import {
  type AssistantProject,
  type ConversationMeta,
} from "../assistant-api";
import {
  flattenProjectTreeChats,
  LOOSE_GROUP_ID,
  type ProjectTreeEntry,
} from "../conversation-grouping";
import { TimelineRow } from "./sidebar-chrome";
import { ConvoRow } from "./ConvoRow";
import { CollapseY } from "./collapse-y";
import { AnimatedList } from "./reactbits/AnimatedList";
import { SwipeRow, type SwipeRowAction } from "./reactbits/SwipeRow";
import { type ProjectTreeRowProps } from "./types";

/** Collapsable header for a PROJECT folder in the recursive "Sueltos / Proyectos"
 *  tree: chevron + folder icon + project name + live/unreviewed indicators +
 *  subtree conversation-count pill. Mirrors `TeamGroupHeader` (agent groups) so
 *  both trees read identically; the project-specific aria strings reuse the
 *  Dashboard's `dashboardTab` keys (single source, shared with `DashboardTab`). */
export function ProjectGroupHeader({
  project,
  fallbackName,
  iconName,
  count,
  isOpen,
  isCurrent = false,
  onToggle,
  onNewChat,
  onEdit,
  convos,
}: {
  project: AssistantProject | null;
  fallbackName: string;
  /** Icon override (e.g. the "Chats sueltos" folder); defaults to the project's
   *  own icon, then a generic folder. */
  iconName?: string;
  count: number;
  isOpen: boolean;
  isCurrent?: boolean;
  onToggle: () => void;
  /** Crea una conversación nueva en esta carpeta (suelta o de proyecto). */
  onNewChat?: () => void;
  /** Abre el ProjectModal en edición para este proyecto (solo carpetas reales). */
  onEdit?: () => void;
  convos: ConversationMeta[];
}) {
  const dt = useAssistantI18n().dashboardTab as Record<string, any>;
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const name = project?.title ?? fallbackName;
  const anyLive = convos.some((c) => chatEngine.isStreaming(c.id) || chatEngine.isBackgroundRunning(c.id) || chatEngine.isWorkerTaskRunning(c.id));
  const anyUnreviewed = convos.some((c) => !anyLive && (!!chatEngine.get(c.id)?.unreviewed || !!c.unreviewed));
  const actions: SwipeRowAction[] = [
    ...(onNewChat ? [{ id: "new", label: formatAssistantMessage(ct.newProjectChatAria ?? "Nueva conversación en {project}", { project: name }), icon: "ti-plus", tone: "primary" as const, onSelect: onNewChat }] : []),
    ...(onEdit ? [{ id: "edit", label: formatAssistantMessage(ct.editProjectNamed ?? "Editar {title}", { title: name }), icon: "ti-pencil", onSelect: onEdit }] : []),
  ];
  return (
    <SwipeRow actions={actions} moreLabel={ct.moreActions ?? "Más acciones"}>
    <div className="group lxp-project-group-header flex items-center rounded-md hover:bg-card/50" data-current-project={isCurrent ? "true" : undefined}>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-current={isCurrent ? "location" : undefined}
      aria-label={formatAssistantMessage(
        isOpen ? (dt.projectGroupCollapseAria ?? "Contraer el proyecto {project}") : (dt.projectGroupExpandAria ?? "Expandir el proyecto {project} ({count} conversaciones)"),
        { count, project: name },
      )}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2.5 text-left"
    >
      <i className={`ti ti-chevron-right shrink-0 text-sm text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden></i>
      <LucideIcon name={project?.icon ?? iconName ?? "folder"} size={18} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-[13px] font-medium">
          {anyLive && <i className="ti ti-loader-2 animate-spin text-emerald-500 text-[10px]" aria-hidden></i>}
          {anyUnreviewed && (
            <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-red-500 ring-2 ring-red-500/30 animate-pulse" aria-hidden></span>
          )}
          <span className="truncate">{name}</span>
        </span>
      </span>
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
        title={formatAssistantMessage(dt.groupCountTitle ?? "{count} conversaciones", { count })}
      >
        <i className="ti ti-message text-[9px]" aria-hidden></i>
        {count}
      </span>
    </button>
    </div>
    </SwipeRow>
  );
}

function ConversationSwipeRow({ c, rowProps }: { c: ConversationMeta; rowProps: ProjectTreeRowProps }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const [renameRequestId, setRenameRequestId] = useState(0);
  const actions: SwipeRowAction[] = [
    { id: "pin", label: c.pinned ? (ct.unpin ?? "Desfijar") : (ct.pinTop ?? "Fijar arriba"), icon: c.pinned ? "ti-pinned-off" : "ti-pin", onSelect: () => rowProps.onTogglePin(c.id, !c.pinned) },
    { id: "rename", label: ct.rename ?? "Renombrar", icon: "ti-pencil", onSelect: () => setRenameRequestId((value) => value + 1) },
    { id: "delete", label: ct.deleteChat ?? "Eliminar chat", icon: "ti-trash", tone: "danger", onSelect: () => rowProps.onDelete(c.id) },
  ];
  return <SwipeRow actions={actions} moreLabel={ct.moreActions ?? "Más acciones"}>
    <ConvoRow c={c} extraClassName="" inGroup inProjectTree hideInlineActions renameRequestId={renameRequestId} {...rowProps} />
  </SwipeRow>;
}

/** Recursive conversation list for the "Sueltos / Proyectos" tab: each root
 *  project renders as a collapsable folder holding its own chats plus a nested
 *  folder per child project (any depth); chats without a project sit as loose
 *  rows at the current level. Empty folders are already pruned by the builder.
 *  Same collapsable/chevron/indent chrome as the "Agentes IA" tree. */
export function ProjectTreeConvos({
  entries,
  projectById,
  expanded,
  onToggle,
  onNewLoose,
  onNewProjectChat,
  onEditProject,
  rowClassName,
  selectedProjectId,
  top = true,
  showEmptyLoose = false,
  listId = "root",
  rowProps,
}: {
  entries: ProjectTreeEntry<ConversationMeta>[];
  projectById: Map<string, AssistantProject>;
  expanded: Set<string>;
  /** Toggle a folder; `siblings` = ids of the folders sharing that level (accordion). */
  onToggle: (projectId: string, siblings?: Iterable<string>) => void;
  /** Nueva conversación suelta (botón + del contenedor "Chats sueltos"). */
  onNewLoose: () => void;
  /** Nueva conversación ligada a un proyecto (botón + del contenedor de proyecto). */
  onNewProjectChat: (projectId: string) => void;
  /** Abre el ProjectModal en edición (botón lápiz del contenedor de proyecto). */
  onEditProject: (projectId: string) => void;
  rowClassName: string;
  selectedProjectId?: string | null;
  top?: boolean;
  showEmptyLoose?: boolean;
  listId?: string;
  rowProps: ProjectTreeRowProps;
}) {
  const dt = useAssistantI18n().dashboardTab as Record<string, any>;
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const emptyLabel = dt.projectEmpty ?? "Sin conversaciones";

  const renderProjectFolder = (node: ProjectTreeEntry<ConversationMeta> & { kind: "project" }): ReactNode => {
    const n = node.node;
    const project = projectById.get(n.projectId) ?? null;
    const isOpen = expanded.has(n.projectId);
    return (
      <div key={`proj:${n.projectId}`} className={top ? rowClassName : "lxp-project-subfolder"}>
        <ProjectGroupHeader
          project={project}
          fallbackName={rowProps.projectTitleById.get(n.projectId) ?? ""}
          count={n.totalConvos}
          isOpen={isOpen}
          isCurrent={selectedProjectId === n.projectId}
          onToggle={() => onToggle(n.projectId, levelSiblingIds)}
          onNewChat={() => onNewProjectChat(n.projectId)}
          onEdit={() => onEditProject(n.projectId)}
          convos={flattenProjectTreeChats(n)}
        />
        <CollapseY open={isOpen}>
          <div className="ml-3 border-l border-border/50 pl-1">
            {n.entries.length ? (
              <ProjectTreeConvos
                entries={n.entries}
                projectById={projectById}
                expanded={expanded}
                onToggle={onToggle}
                onNewLoose={onNewLoose}
                onNewProjectChat={onNewProjectChat}
                onEditProject={onEditProject}
                rowClassName={rowClassName}
                selectedProjectId={selectedProjectId}
                top={false}
                listId={n.projectId}
                rowProps={rowProps}
              />
            ) : (
              <p className="px-2 py-1 text-[11px] text-muted-foreground">{emptyLabel}</p>
            )}
          </div>
          </CollapseY>
      </div>
    );
  };

  // Folders stay above chats even when a recent chat would otherwise outrank
  // its sibling subproject in the activity-sorted tree.
  const chatEntries = entries.filter((e): e is ProjectTreeEntry<ConversationMeta> & { kind: "chat" } => e.kind === "chat");
  const folderEntries = entries.filter((e): e is ProjectTreeEntry<ConversationMeta> & { kind: "project" } => e.kind === "project");
  const orderedEntries: ProjectTreeEntry<ConversationMeta>[] = [...folderEntries, ...chatEntries];
  const looseOpen = expanded.has(LOOSE_GROUP_ID);
  // Accordion siblings include all folders, even those loaded later.
  const levelSiblingIds: string[] = [
    ...(top && (showEmptyLoose || chatEntries.length > 0) ? [LOOSE_GROUP_ID] : []),
    ...folderEntries.map((e) => e.node.projectId),
  ];

  // Top-level cards contain loose chats and every root folder.
  type TopCard =
    | { kind: "loose" }
    | { kind: "folder"; entry: ProjectTreeEntry<ConversationMeta> & { kind: "project" } };
  const topCards: TopCard[] = top
    ? [
        ...(showEmptyLoose || chatEntries.length > 0 ? [{ kind: "loose" as const }] : []),
        ...folderEntries.map((entry) => ({ kind: "folder" as const, entry })),
      ]
    : [];
  const containsActive = (entry: ProjectTreeEntry<ConversationMeta>): boolean =>
    !!rowProps.activeId && (entry.kind === "chat"
      ? entry.convo.id === rowProps.activeId
      : flattenProjectTreeChats(entry.node).some((chat) => chat.id === rowProps.activeId));

  // Nested levels show all subproject folders before their own chat rows.
  if (!top) {
    return (
      <AnimatedList
        items={orderedEntries}
        itemKey={(entry) => entry.kind === "chat" ? `chat:${entry.convo.id}` : `project:${entry.node.projectId}`}
        resetKey={listId}
        ensureVisibleIndex={orderedEntries.findIndex(containsActive)}
        renderItem={(entry, index) => entry.kind === "chat"
          ? <TimelineRow isLast={index === orderedEntries.length - 1}><ConversationSwipeRow c={entry.convo} rowProps={rowProps} /></TimelineRow>
          : renderProjectFolder(entry)}
      />
    );
  }

  // Top level: fold ALL loose chats (no project) into one "Chats sueltos"
  // collapsable — same chrome as a project folder — that sits ABOVE the project
  // folders. Both levels reveal more rows as the user scrolls.
  return (
    <AnimatedList
      items={topCards}
      itemKey={(card) => card.kind === "loose" ? "loose" : `project:${card.entry.node.projectId}`}
      resetKey={listId}
      ensureVisibleIndex={topCards.findIndex((card) => card.kind === "loose"
        ? chatEntries.some(containsActive)
        : containsActive(card.entry))}
      renderItem={(card) =>
        card.kind === "loose" ? (
          <div className={rowClassName}>
            <ProjectGroupHeader
              project={null}
              fallbackName={ct.looseChats ?? "Chats sueltos"}
              iconName="MessageSquare"
              count={chatEntries.length}
              isOpen={looseOpen}
              onToggle={() => onToggle(LOOSE_GROUP_ID, levelSiblingIds)}
              onNewChat={onNewLoose}
              convos={chatEntries.map((e) => e.convo)}
            />
            <CollapseY open={looseOpen}>
              <div className="ml-3 border-l border-border/50 pl-1">
                <AnimatedList
                  items={chatEntries}
                  itemKey={(entry) => entry.convo.id}
                  resetKey={LOOSE_GROUP_ID}
                  ensureVisibleIndex={chatEntries.findIndex(containsActive)}
                  renderItem={(entry, index) => <TimelineRow isLast={index === chatEntries.length - 1}>
                    <ConversationSwipeRow c={entry.convo} rowProps={rowProps} />
                  </TimelineRow>}
                />
              </div>
              </CollapseY>
          </div>
        ) : (
          renderProjectFolder(card.entry)
        )}
    />
  );
}
