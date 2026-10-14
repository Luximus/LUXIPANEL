// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useAssistantI18n, formatAssistantMessage } from "../i18n";
import { type AssistantProject, type ConversationMeta } from "../assistant-api";
import { flattenProjectTreeChats, LOOSE_GROUP_ID, type ProjectTreeEntry } from "../conversation-grouping";
import { ProjectGroupHeader, ProjectTreeConvos } from "./project-tree-convos";
import { type ProjectTreeRowProps } from "./types";

/** The selector represents a root project even when the active chat belongs to
 * a subproject. A cycle or missing parent stops the walk safely. */
export function rootProjectId(id: string | null, projects: Map<string, AssistantProject>): string | null {
  if (!id || !projects.has(id)) return null;
  const seen = new Set<string>();
  let current = id;
  while (!seen.has(current)) {
    seen.add(current);
    const parentId = projects.get(current)?.parentId;
    if (!parentId || !projects.has(parentId) || seen.has(parentId)) return current;
    current = parentId;
  }
  return current;
}

export function ProjectHistorySelect({
  entries, projectById, selectedProjectId, onSelectProject, onNewLoose, onNewProjectChat, onEditProject, className = "",
}: {
  entries: ProjectTreeEntry<ConversationMeta>[];
  projectById: Map<string, AssistantProject>;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onNewLoose: () => void;
  onNewProjectChat: (id: string) => void;
  onEditProject: (id: string) => void;
  className?: string;
}) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const selectedRootId = rootProjectId(selectedProjectId, projectById);
  const roots = entries.filter((entry): entry is ProjectTreeEntry<ConversationMeta> & { kind: "project" } => entry.kind === "project");
  return <div className={`lxp-project-picker flex min-w-0 items-center gap-2 ${className}`}>
    <span className="relative min-w-0 flex-1">
      <select
        aria-label={ct.projects?.heading ?? "Proyecto"}
        value={selectedRootId ?? LOOSE_GROUP_ID}
        onChange={(event) => onSelectProject(event.target.value === LOOSE_GROUP_ID ? null : event.target.value)}
        className="min-h-9 w-full min-w-0 appearance-none cursor-pointer rounded-lg border border-border bg-card py-2 pl-2.5 pr-9 text-xs font-medium text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <option value={LOOSE_GROUP_ID}>{ct.looseChats ?? "Chats sueltos"}</option>
        {roots.map((entry) => <option key={entry.node.projectId} value={entry.node.projectId}>
          {projectById.get(entry.node.projectId)?.title ?? entry.node.projectId}
        </option>)}
      </select>
      <i className="ti ti-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true" />
    </span>
    <button
      type="button"
      onClick={() => selectedRootId ? onNewProjectChat(selectedRootId) : onNewLoose()}
      aria-label={ct.newConversation ?? "Nueva conversación"}
      title={ct.newConversation ?? "Nueva conversación"}
      className="grid min-h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-sm text-foreground hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
    >
      <i className="ti ti-plus" aria-hidden="true" />
    </button>
    {selectedRootId && <button
      type="button"
      onClick={() => onEditProject(selectedRootId)}
      aria-label={formatAssistantMessage(ct.editProjectNamed ?? "Editar {title}", { title: projectById.get(selectedRootId)?.title ?? "proyecto" })}
      title={ct.editProject ?? "Editar proyecto"}
      className="grid min-h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-sm text-foreground hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
    >
      <i className="ti ti-pencil" aria-hidden="true" />
    </button>}
  </div>;
}

export function SelectedProjectConvos({
  entries, projectById, selectedProjectId, expanded, onToggle,
  onNewLoose, onNewProjectChat, onEditProject, rowProps, inRail = false,
}: {
  entries: ProjectTreeEntry<ConversationMeta>[];
  projectById: Map<string, AssistantProject>;
  selectedProjectId: string | null;
  expanded: Set<string>;
  onToggle: (id: string, siblings?: Iterable<string>) => void;
  onNewLoose: () => void;
  onNewProjectChat: (id: string) => void;
  onEditProject: (id: string) => void;
  rowProps: ProjectTreeRowProps;
  inRail?: boolean;
}) {
  const i18n = useAssistantI18n();
  const dt = i18n.dashboardTab as Record<string, any>;
  const rootId = rootProjectId(selectedProjectId, projectById);
  const rootNode = entries.find((entry) => entry.kind === "project" && entry.node.projectId === rootId);
  const selectedEntries = rootNode?.kind === "project"
    ? rootNode.node.entries
    : entries.filter((entry) => entry.kind === "chat");
  const subprojects = selectedEntries.filter((entry) => entry.kind === "project");
  const chats = selectedEntries.filter((entry) => entry.kind === "chat");
  const siblingIds = subprojects.map((entry) => entry.node.projectId);
  const treeProps = {
    projectById, expanded, onToggle, onNewLoose, onNewProjectChat,
    onEditProject, rowClassName: "lxp-history-card", top: false as const, rowProps, selectedProjectId,
  };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-selected-project-convos>
    {subprojects.length > 0 && <div
      data-pinned-subprojects
      data-vaul-no-drag
      className="shrink-0 max-h-[42dvh] overflow-y-auto overscroll-y-contain border-b border-border/60 px-1.5"
    >
      {subprojects.map((entry) => {
        const id = entry.node.projectId;
        return <div key={id} className="lxp-history-card">
          <ProjectGroupHeader
            project={projectById.get(id) ?? null}
            fallbackName={id}
            count={entry.node.totalConvos}
            isOpen={expanded.has(id)}
            isCurrent={selectedProjectId === id}
            onToggle={() => onToggle(id, siblingIds)}
            onNewChat={() => onNewProjectChat(id)}
            onEdit={() => onEditProject(id)}
            convos={flattenProjectTreeChats(entry.node)}
          />
        </div>;
      })}
    </div>}
    <div
      id={inRail ? "lxp-rail-history-panel" : undefined}
      data-rail-history-list={inRail ? "" : undefined}
      data-project-history-scroll
      className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2"
    >
    {subprojects.filter((entry) => expanded.has(entry.node.projectId)).map((entry) =>
      <div key={`${entry.node.projectId}:contents`} className="ml-3 border-l border-border/50 pl-1">
        {entry.node.entries.length > 0
          ? <ProjectTreeConvos entries={entry.node.entries} listId={entry.node.projectId} {...treeProps} />
          : <p className="px-2 py-1 text-[11px] text-muted-foreground">{dt.projectEmpty ?? "Sin conversaciones"}</p>}
      </div>
    )}
    {chats.length > 0
      ? <ProjectTreeConvos entries={chats} listId={`${rootId ?? LOOSE_GROUP_ID}:chats`} {...treeProps} />
      : subprojects.length === 0 && <p className="px-2 py-3 text-[11px] text-muted-foreground">{dt.projectEmpty ?? "Sin conversaciones"}</p>}
    </div>
  </div>;
}
