/**
 * Árbol de "Sueltos / Proyectos": una carpeta "Chats sueltos" colapsable
 * (siempre primera) + carpetas de proyecto anidadas, cada una con sus chats y
 * sus subcarpetas. Paginación de 5/página en cada nivel. Puerto DOM de
 * `app/src/components/assistant/drawer/ProjectTreeConvos.tsx`.
 */
import { ChevronRight, Folder, Loader2, MessageSquare, Plus } from "lucide-react";
import type { Messages } from "../../i18n";
import {
  flattenProjectTreeChats,
  LOOSE_GROUP_ID,
  type ProjectTreeEntry,
  type ProjectTreeNode,
} from "./grouping/conversation-grouping";
import type { AssistantStrings, Conversation } from "./types";
import { AGENTS_PER_PAGE, Pager, useNestedPages, usePager } from "./pager";
import { ConvoRow } from "./ConvoRow";

/** Cabecera colapsable de una carpeta (proyecto o "Chats sueltos"): chevron +
 *  icono + indicadores live/sin-revisar + nombre + pill de conteo + botón "+". */
export function ProjectGroupHeader({ name, count, isOpen, loose, convos, liveIds, onToggle, onNewChat, t, st }: {
  name: string;
  count: number;
  isOpen: boolean;
  loose?: boolean;
  convos: Conversation[];
  liveIds: Set<string>;
  onToggle: () => void;
  onNewChat?: () => void;
  t: AssistantStrings;
  st: Messages["serverStandalone"];
}) {
  const anyLive = convos.some((c) => liveIds.has(c.id));
  const anyUnreviewed = !anyLive && convos.some((c) => !!c.unreviewed);
  return (
    <div className="sat-group-head">
      <button
        type="button"
        className="sat-group-head__main"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? st.treeCollapse : st.treeExpand}
      >
        <ChevronRight size={14} className={`sat-chevron ${isOpen ? "is-open" : ""}`} aria-hidden />
        {loose ? <MessageSquare size={16} aria-hidden /> : <Folder size={16} aria-hidden />}
        <span className="sat-group-head__title-row">
          {anyLive ? <Loader2 size={12} className="animate-spin shrink-0" aria-hidden /> : null}
          {anyUnreviewed ? <span className="sat-dot" aria-hidden /> : null}
          <span className="sat-group-head__name truncate">{name}</span>
          <span className="sat-count-pill"><span>{count}</span></span>
        </span>
      </button>
      {onNewChat ? (
        <button type="button" className="sat-group-head__add" onClick={onNewChat} aria-label={t.newChat} title={t.newChat}>
          <Plus size={15} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Árbol recursivo de proyectos colapsable. `top` = nivel superior (carpeta
 *  "Chats sueltos" + carpetas raíz, paginadas de 5); anidado = chats propios de
 *  la carpeta (paginados de 5) + subcarpetas. */
export function ProjectTreeConvos({
  entries, projectTitleById, expanded, activeId, liveIds, top = true,
  onToggle, onNewLoose, onNewProjectChat, onOpen, onDelete, t, st, language,
}: {
  entries: ProjectTreeEntry<Conversation>[];
  projectTitleById: Map<string, string>;
  expanded: Set<string>;
  activeId: string | null;
  liveIds: Set<string>;
  top?: boolean;
  onToggle: (id: string) => void;
  onNewLoose: () => void;
  onNewProjectChat: (projectId: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  t: AssistantStrings;
  st: Messages["serverStandalone"];
  language?: string;
}) {
  const nested = useNestedPages();
  const sliceNested = <U,>(key: string, items: U[]): U[] => {
    const pages = Math.max(1, Math.ceil(items.length / AGENTS_PER_PAGE));
    const cur = Math.min(nested.get(key), pages - 1);
    return items.slice(cur * AGENTS_PER_PAGE, cur * AGENTS_PER_PAGE + AGENTS_PER_PAGE);
  };
  const renderNestedPager = (key: string, total: number) => {
    const pages = Math.max(1, Math.ceil(total / AGENTS_PER_PAGE));
    if (pages <= 1) return null;
    const cur = Math.min(nested.get(key), pages - 1);
    return <Pager page={cur} pageCount={pages} st={st} onPrev={() => nested.set(key, cur - 1)} onNext={() => nested.set(key, cur + 1)} />;
  };

  const chatEntries = entries.filter((e): e is { kind: "chat"; convo: Conversation } => e.kind === "chat");
  const folderEntries = entries.filter((e): e is { kind: "project"; node: ProjectTreeNode<Conversation> } => e.kind === "project");
  const looseOpen = expanded.has(LOOSE_GROUP_ID);

  const convoRow = (c: Conversation) => (
    <ConvoRow key={c.id} c={c} activeId={activeId} isLive={liveIds.has(c.id)} t={t} language={language} onOpen={onOpen} onDelete={onDelete} />
  );

  const renderProjectFolder = (node: ProjectTreeNode<Conversation>) => {
    const isOpen = expanded.has(node.projectId);
    return (
      <div key={`proj:${node.projectId}`} className="sat-card">
        <ProjectGroupHeader
          name={projectTitleById.get(node.projectId) ?? node.projectId.slice(0, 8)}
          count={node.totalConvos}
          isOpen={isOpen}
          convos={flattenProjectTreeChats(node)}
          liveIds={liveIds}
          onToggle={() => onToggle(node.projectId)}
          onNewChat={() => onNewProjectChat(node.projectId)}
          t={t}
          st={st}
        />
        {isOpen ? (
          <div className="sat-nested">
            {node.entries.length ? (
              <ProjectTreeConvos
                entries={node.entries}
                projectTitleById={projectTitleById}
                expanded={expanded}
                activeId={activeId}
                liveIds={liveIds}
                top={false}
                onToggle={onToggle}
                onNewLoose={onNewLoose}
                onNewProjectChat={onNewProjectChat}
                onOpen={onOpen}
                onDelete={onDelete}
                t={t}
                st={st}
                language={language}
              />
            ) : (
              <div className="sat-nested-empty">{st.treeNoConversations}</div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  type TopCard = { kind: "loose" } | { kind: "folder"; node: ProjectTreeNode<Conversation> };
  // La carpeta "Chats sueltos" se pinta SIEMPRE (aunque esté a 0): su "+" es el
  // único punto del sidebar para crear un chat NO ligado a proyecto/agente.
  const topCards: TopCard[] = top
    ? [{ kind: "loose" as const }, ...folderEntries.map((e) => ({ kind: "folder" as const, node: e.node }))]
    : [];
  const pagedTop = usePager(topCards, topCards.length, AGENTS_PER_PAGE);

  // Nivel anidado: chats propios (paginados de 5) + subcarpetas.
  if (!top) {
    const chats = chatEntries.map((e) => e.convo);
    const visibleChats = sliceNested("chats", chats);
    return (
      <>
        {visibleChats.map(convoRow)}
        {renderNestedPager("chats", chats.length)}
        {folderEntries.map((e) => renderProjectFolder(e.node))}
      </>
    );
  }

  // Nivel superior: carpeta "Chats sueltos" + carpetas raíz.
  const looseVisible = sliceNested(LOOSE_GROUP_ID, chatEntries).map((e) => e.convo);
  return (
    <>
      {pagedTop.visible.map((card) =>
        card.kind === "loose" ? (
          <div key="loose" className="sat-card">
            <ProjectGroupHeader
              name={st.looseChatsFolder}
              loose
              count={chatEntries.length}
              isOpen={looseOpen}
              convos={chatEntries.map((e) => e.convo)}
              liveIds={liveIds}
              onToggle={() => onToggle(LOOSE_GROUP_ID)}
              onNewChat={onNewLoose}
              t={t}
              st={st}
            />
            {looseOpen ? (
              <div className="sat-nested">
                {chatEntries.length === 0 ? <div className="sat-nested-empty">{st.treeNoConversations}</div> : null}
                {looseVisible.map(convoRow)}
                {renderNestedPager(LOOSE_GROUP_ID, chatEntries.length)}
              </div>
            ) : null}
          </div>
        ) : (
          renderProjectFolder(card.node)
        ),
      )}
      {pagedTop.hasPager ? (
        <Pager page={pagedTop.page} pageCount={pagedTop.pageCount} st={st} onPrev={pagedTop.prev} onNext={pagedTop.next} />
      ) : null}
    </>
  );
}
