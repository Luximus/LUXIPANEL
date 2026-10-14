/**
 * Cabecera colapsable compartida por líderes, grupos del mismo agente y
 * sub-filas de subordinado: chevron + avatar + nombre + indicadores (vivo /
 * sin revisar) + chip de rol + contador de chats + botón "+". Puerto DOM de
 * `app/src/components/assistant/drawer/AgentGroupHeader.tsx`, simplificado
 * (sin `ThemeTokens`, sin `AgentAvatar`/avataaars, sin stack de subordinados ni
 * chip de proyecto — el desktop no trae esos datos al sidebar).
 */
import { ChevronRight, Loader2, MessageSquare, Plus, UserStar } from "lucide-react";
import type { Messages } from "../../i18n";
import { resolveTiIcon } from "./grouping/ti-icon-map";
import type { Conversation } from "./types";
import type { SidebarAgent, SidebarRole } from "./ConversationSidebar";

// Tinte FIJO del chip de rol (paridad con `RoleChip` web/app: violet-500), no
// depende de `role.color` ni del tema.
const ROLE_VIOLET = "#8b5cf6";

/** Avatar circular del agente: fondo = `agent.color` (fallback índigo) + icono
 *  lucide resuelto de `agent.icon` (fallback `Bot`) en blanco. */
function AgentAvatarCircle({ agent }: { agent: SidebarAgent | null }) {
  const Icon = resolveTiIcon(agent?.icon);
  return (
    <span className="sat-avatar" style={{ background: agent?.color || "#6366f1" }} aria-hidden>
      <Icon size={14} color="#fff" />
    </span>
  );
}

function RoleChip({ role }: { role: SidebarRole }) {
  return (
    <span className="sat-chip sat-chip--role">
      <UserStar size={9} color={ROLE_VIOLET} aria-hidden />
      <span className="truncate">{role.name}</span>
    </span>
  );
}

export function AgentGroupHeader({
  agent, fallbackName, count, isOpen, onToggle, onNewChat, convos, liveIds, role, st,
}: {
  agent: SidebarAgent | null;
  fallbackName: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  onNewChat?: () => void;
  convos: Conversation[];
  liveIds: Set<string>;
  role?: SidebarRole | null;
  st: Messages["serverStandalone"];
}) {
  const name = agent?.name ?? fallbackName ?? "";
  const anyLive = convos.some((c) => liveIds.has(c.id));
  const anyUnreviewed = convos.some((c) => !anyLive && !!c.unreviewed && !liveIds.has(c.id));
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
        <AgentAvatarCircle agent={agent} />
        <span className="sat-group-head__title-row">
          {anyLive ? <Loader2 size={12} className="animate-spin shrink-0" aria-hidden /> : null}
          {anyUnreviewed ? <span className="sat-dot" aria-hidden /> : null}
          <span className="sat-group-head__name truncate">{name}</span>
          {role ? <RoleChip role={role} /> : null}
          <span className="sat-count-pill">
            <MessageSquare size={9} aria-hidden />
            <span>{count}</span>
          </span>
        </span>
      </button>
      {onNewChat ? (
        <button type="button" className="sat-group-head__add" onClick={onNewChat} aria-label={st.newAgentChat} title={st.newAgentChat}>
          <Plus size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
