import type { UIEventHandler } from "react";
import { Folder, Loader2, MessagesSquare, Plus, Search, Trash2, X } from "lucide-react";
import { formatRelative } from "./format";
import type { AssistantStrings, Conversation, Project } from "./types";

/**
 * Sidebar LEGACY del asistente MANAGED (`ServerAssistantPane`): lista plana +
 * árbol de proyectos + búsqueda server-side. Es el sidebar original previo al
 * rediseño de scope-tabs/árboles colapsables: `ServerAssistantPane` (túnel
 * managed) lo conserva sin cambios de comportamiento, mientras el módulo DIRECTO
 * (`AssistantModule`) usa el nuevo `ConversationSidebar` con paridad LUXIPANEL.
 */
export function ConversationSidebarLegacy({
  t,
  onScrollCapture,
  language,
  conversations,
  projects,
  projectId,
  onSelectProject,
  conversationId,
  busy,
  historyBusy,
  query,
  onQueryChange,
  onOpen,
  onDelete,
  onNew,
}: {
  t: AssistantStrings;
  onScrollCapture?: UIEventHandler<HTMLElement>;
  language?: string;
  conversations: Conversation[];
  projects: Project[];
  projectId: string;
  onSelectProject: (id: string) => void;
  conversationId: string | null;
  busy: boolean;
  historyBusy: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  // Alcance de conversaciones (réplica del módulo): un proyecto seleccionado →
  // sus chats; sin proyecto (`""`) → "chats sueltos" (sin projectId).
  const visibleConversations = projectId
    ? conversations.filter((c) => c.projectId === projectId)
    : conversations.filter((c) => !c.projectId);

  // Proyectos raíz vs. hijos (igual que ChatPane del módulo).
  const projectIdSet = new Set(projects.map((p) => p.id));
  const childrenMap = new Map<string, Project[]>();
  const rootProjects: Project[] = [];
  for (const p of projects) {
    if (p.parentId && projectIdSet.has(p.parentId)) {
      const arr = childrenMap.get(p.parentId) ?? [];
      arr.push(p);
      childrenMap.set(p.parentId, arr);
    } else {
      rootProjects.push(p);
    }
  }
  const currentProject = projectId ? projects.find((p) => p.id === projectId) ?? null : null;
  const currentParentId = currentProject?.parentId && projectIdSet.has(currentProject.parentId)
    ? currentProject.parentId
    : null;
  const branchParentId = (childrenMap.get(projectId)?.length ?? 0) > 0 ? projectId : currentParentId;
  const currentChildren = branchParentId ? (childrenMap.get(branchParentId) ?? []) : [];
  const projectLabel = (p: Project) => p.title ?? p.name ?? p.id;

  return (
    <aside onScrollCapture={onScrollCapture} className="server-assistant__sidebar">
      <button type="button" className="server-assistant__drawer-new" onClick={onNew} aria-label={t.newChat} title={t.newChat}>
        <Plus size={15} /><span>{t.newChat}</span>
      </button>
      <div className="server-assistant__drawer-search">
        <Search size={12} aria-hidden />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t.searchConversations}
          aria-label={t.searchConversations}
        />
        {query ? (
          <button type="button" onClick={() => onQueryChange("")} aria-label="x"><X size={11} /></button>
        ) : null}
      </div>
      {projects.length > 0 ? (
        <div className="server-assistant__projects" role="group" aria-label={t.projectsTitle}>
          <span className="server-assistant__projects-title">{t.projectsTitle}</span>
          <button
            type="button"
            className={`server-assistant__proj ${projectId === "" ? "is-active" : ""}`}
            onClick={() => onSelectProject("")}
          >
            <MessagesSquare size={14} aria-hidden />
            <span className="server-assistant__proj-name">{t.looseChats}</span>
          </button>
          {rootProjects.map((p) => {
            const kids = childrenMap.get(p.id)?.length ?? 0;
            return (
              <button
                key={p.id}
                type="button"
                className={`server-assistant__proj ${projectId === p.id || currentParentId === p.id ? "is-active" : ""}`}
                onClick={() => onSelectProject(p.id)}
                title={projectLabel(p)}
              >
                <Folder size={14} aria-hidden />
                <span className="server-assistant__proj-name">{projectLabel(p)}</span>
                {kids > 0 ? <span className="server-assistant__proj-count">{kids}</span> : null}
              </button>
            );
          })}
          {currentChildren.length > 0 ? (
            <div className="server-assistant__subprojects">
              <span className="server-assistant__projects-title server-assistant__projects-title--sub">{t.subProjects}</span>
              {currentChildren.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`server-assistant__proj server-assistant__proj--child ${projectId === p.id ? "is-active" : ""}`}
                  onClick={() => onSelectProject(p.id)}
                  title={projectLabel(p)}
                >
                  <Folder size={13} aria-hidden />
                  <span className="server-assistant__proj-name">{projectLabel(p)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="server-assistant__drawer-list">
        {historyBusy ? (
          <div className="server-assistant__drawer-empty"><Loader2 size={13} className="animate-spin" /></div>
        ) : visibleConversations.length === 0 ? (
          <div className="server-assistant__drawer-empty">{t.noConversations}</div>
        ) : (
          visibleConversations.map((c) => {
            const live = c.id === conversationId && busy;
            return (
              <div key={c.id} className={`server-assistant__conv ${c.id === conversationId ? "is-active" : ""}`}>
                <button
                  type="button"
                  className="server-assistant__conv-main"
                  onClick={() => onOpen(c.id)}
                  title={c.title ?? c.id}
                >
                  <span className="server-assistant__conv-title">
                    {live ? <Loader2 size={11} className="animate-spin shrink-0" /> : null}
                    <span className="truncate">{c.title?.trim() || c.id.slice(0, 8)}</span>
                  </span>
                  {c.preview ? <span className="server-assistant__conv-preview truncate">{c.preview}</span> : null}
                  <span className="server-assistant__conv-date">{formatRelative(c.updatedAt ?? c.createdAt, language, t)}</span>
                </button>
                <button
                  type="button"
                  className="server-assistant__conv-del"
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                  aria-label={t.deleteConversation}
                  title={t.deleteConversation}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
