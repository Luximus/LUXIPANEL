import "./ConversationSidebar.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import type { Messages } from "../../i18n";
import {
  buildAgentConversationTree,
  buildProjectConversationTree,
  computeExpandChain,
  LOOSE_GROUP_ID,
} from "./grouping/conversation-grouping";
import { pickEmptyLeaderAgents } from "./grouping/agent-top-items";
import type { AssistantStrings, Conversation, Project } from "./types";
import { ScopeTabs, type ConvScope } from "./ScopeTabs";
import { AgentThreadedConvos } from "./AgentThreadedConvos";
import { ProjectTreeConvos } from "./ProjectTreeConvos";
import { ConvoRow } from "./ConvoRow";

/** Forma mínima de agente que necesita el árbol "Agentes IA" del sidebar
 *  (cumple `AgentHierarchyLike` de la lógica pura: id/parentAgentId/
 *  isTeamLeader/subordinateIds). */
export type SidebarAgent = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  roleId?: string | null;
  parentAgentId?: string | null;
  subordinateIds?: string[];
  isTeamLeader?: boolean;
};

export type SidebarRole = { id: string; name: string; color?: string };

/**
 * Sidebar del asistente de servidor: scope tabs ("Agentes IA" / "Sueltos ·
 * Proyectos") + árboles colapsables, paridad con el módulo Agentes IA de
 * LUXIPANEL (paridad ya lograda en la app móvil — esta es su réplica DOM).
 * Presentacional: toda la agrupación/orden viene de `grouping/conversation-grouping`
 * (lógica pura compartida); este componente solo deriva índices, gestiona el
 * scope/búsqueda/expansión y delega las mutaciones al contenedor.
 */
export function ConversationSidebar({
  onScrollCapture,
  onHistoryGroup,
  t,
  st,
  language,
  conversations,
  projects,
  agents,
  roles,
  activeConversationId,
  liveConversationId,
  busy: _busy,
  historyBusy,
  query,
  onQueryChange,
  onOpen,
  onDelete,
  onNew,
  onNewInProject,
  onPickAgent,
}: {
  onScrollCapture?: React.UIEventHandler<HTMLElement>;
  onHistoryGroup?: (kind: "project" | "agent", id: string) => void;
  t: AssistantStrings;
  st: Messages["serverStandalone"];
  language?: string;
  conversations: Conversation[];
  projects: Project[];
  agents: SidebarAgent[];
  roles: SidebarRole[];
  activeConversationId: string | null;
  liveConversationId?: string | null;
  busy: boolean;
  historyBusy: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onNewInProject: (projectId: string) => void;
  onPickAgent: (agentId: string) => void;
}) {
  // Scope inicial: "Agentes IA" si hay agentes; si no, "Sueltos / Proyectos".
  // Calculado UNA sola vez al montar (no reactivo a `agents`, paridad con el
  // contenedor RN: cambiar de scope tras cargar los agentes es cosa del usuario).
  const [scope, setScope] = useState<ConvScope>(() => (agents.length > 0 ? "agents" : "loose"));

  // Expansión del árbol: UN solo set de ids expandidos para AMBOS árboles (los
  // ids de agente y de proyecto/`LOOSE_GROUP_ID` viven en namespaces distintos,
  // así que no colisionan). Todo colapsado al montar, sin persistencia.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = useCallback((id: string) => {
    if (!expanded.has(id)) onHistoryGroup?.(projects.some(p => p.id === id) || id === LOOSE_GROUP_ID ? "project" : "agent", id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [expanded, onHistoryGroup, projects]);

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const leaderAgents = useMemo(
    () => agents.filter((a) => a.isTeamLeader || (a.subordinateIds?.length ?? 0) > 0),
    [agents],
  );

  // Auto-expansión: al cambiar la conversación activa, UNE (nunca quita) la
  // cadena self→raíz de su rama en ambos árboles, para que quede visible sin
  // que el usuario tenga que desplegar a mano.
  useEffect(() => {
    const activeConv = activeConversationId
      ? conversations.find((c) => c.id === activeConversationId) ?? null
      : null;
    const agentChain = computeExpandChain(activeConv?.agentId ?? null, (id) => agentById.get(id)?.parentAgentId);
    const projectChain = !activeConv
      ? []
      : activeConv.projectId && projectById.has(activeConv.projectId)
        ? computeExpandChain(activeConv.projectId, (id) => projectById.get(id)?.parentId)
        : [LOOSE_GROUP_ID];
    const union = [...agentChain, ...projectChain];
    if (union.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of union) {
        if (!next.has(id)) { next.add(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [activeConversationId, conversations, agentById, projectById]);

  const liveIds = useMemo(
    () => new Set<string>(liveConversationId ? [liveConversationId] : []),
    [liveConversationId],
  );

  const agentEntries = useMemo(
    () => buildAgentConversationTree(conversations, agentById, { seedRoster: true }),
    [conversations, agentById],
  );
  const emptyLeaderAgents = useMemo(
    () => pickEmptyLeaderAgents(agentEntries, leaderAgents),
    [agentEntries, leaderAgents],
  );
  const projectTree = useMemo(
    () => buildProjectConversationTree(conversations, projects, { includeEmpty: true }),
    [conversations, projects],
  );
  const projectTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.title ?? p.name ?? p.id.slice(0, 8));
    return m;
  }, [projects]);

  const searching = query.trim().length > 0;

  return (
    <aside className="server-assistant__sidebar" onScrollCapture={onScrollCapture}>
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

      <div className="server-assistant__drawer-list">
        {historyBusy ? (
          <div className="server-assistant__drawer-empty"><Loader2 size={13} className="animate-spin" /></div>
        ) : searching ? (
          conversations.length === 0 ? (
            <div className="server-assistant__drawer-empty">{t.noConversations}</div>
          ) : (
            conversations.map((c) => (
              <ConvoRow
                key={c.id}
                c={c}
                activeId={activeConversationId}
                isLive={liveIds.has(c.id)}
                t={t}
                language={language}
                onOpen={onOpen}
                onDelete={onDelete}
              />
            ))
          )
        ) : (
          <>
            <ScopeTabs value={scope} onChange={setScope} st={st} />
            {scope === "agents" ? (
              agentEntries.length === 0 && emptyLeaderAgents.length === 0 ? (
                <div className="server-assistant__drawer-empty">
                  {agents.length === 0 ? st.agentsEmpty : st.agentsConvEmpty}
                </div>
              ) : (
                <div className="sat-tree">
                  <AgentThreadedConvos
                    entries={agentEntries}
                    emptyLeaderAgents={emptyLeaderAgents}
                    activeId={activeConversationId}
                    liveIds={liveIds}
                    agentById={agentById}
                    rolesById={rolesById}
                    expanded={expanded}
                    onToggle={toggle}
                    onNewAgentChat={onPickAgent}
                    t={t}
                    st={st}
                    language={language}
                    onOpen={onOpen}
                    onDelete={onDelete}
                  />
                </div>
              )
            ) : (
              <div className="sat-tree">
                <ProjectTreeConvos
                  entries={projectTree.entries}
                  projectTitleById={projectTitleById}
                  expanded={expanded}
                  activeId={activeConversationId}
                  liveIds={liveIds}
                  onToggle={toggle}
                  onNewLoose={onNew}
                  onNewProjectChat={onNewInProject}
                  onOpen={onOpen}
                  onDelete={onDelete}
                  t={t}
                  st={st}
                  language={language}
                />
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
