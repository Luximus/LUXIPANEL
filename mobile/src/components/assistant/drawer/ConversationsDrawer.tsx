import { localizeServerError } from '../../../lib/server-error-localization';
import { invalidateAssistantReads } from "../../../api/client/assistant";
import { historySearchLabel, type HistorySearchStatus } from "../../../lib/history-search-status";
import { loadSessionState } from "../../../lib/session-state";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Drawer de conversaciones del asistente (proyectos + árbol de agentes +
 * búsqueda + scope tabs). Movido 1:1 desde `ServerAssistantPane.tsx` (fase A3).
 *
 * NOTA A3/A4: este componente es el CONTENEDOR del drawer, no una vista pura —
 * conserva su capa de datos (`luxAssistantProxy` + cachés stale-while-revalidate)
 * porque su padre real es `ServerChatTab` (no el pane), así que la llamada no
 * puede "quedarse en el pane y bajar por props". En la fase A4 esta capa de
 * datos migra a `features/assistant/conversations-store.ts` y aquí quedará solo
 * presentación.
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NativeModuleContext } from "../../../screens/main/native-module-context";
import { useConversationActivity } from "../../../features/assistant/use-conversation-activity";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Folder, MoreHorizontal, Search } from "lucide-react-native";
import { luxAssistantProxy, luxAssistantProxyOk } from "../../../api/client";
import type { AgentRole, AssistantAgent, Conversation, Project } from "../../../features/assistant/types";
import { withAlpha, type ThemeTokens } from "../../../theme/colors";
import { usePullRefresh } from "../../../hooks/usePullRefresh";
import { Skeleton } from "../../ui/Skeleton";
import { useAssistantSession } from "../../../features/assistant/hooks";
import { clearLocalOp, mergeLocalOps, nextOpSeq, setLocalOp, type ConvLocalOps } from "../../../features/assistant/conv-local-ops";
import { loadConversationPages } from "../../../features/assistant/conversation-pages";
import { projectScopeIds, rootProjectId } from "../../../features/assistant/project-scope";
import { buildProjectConversationTree, flattenProjectTreeChats, LOOSE_GROUP_ID, type ProjectTreeEntry } from "../../assistant-settings/agents/conversation-grouping";
import type { AssistantStrings } from "../types";
import { ConvoRow } from "./ConvoRow";
import { DeleteConversationDialog } from "./DeleteConversationDialog";
import { ProjectGroupHeaderRN, ProjectTreeConvos } from "./ProjectTreeConvos";
import { AgentThreadedConvos, type OpenAgentByGroup } from "./AgentThreadedConvos";
import { ScopeTabs, type ConvScope } from "./ScopeTabs";
import { styles as treeStyles } from "./ProjectTreeConvos.styles";
import { styles } from "./ConversationsDrawer.styles";

// One demand-only page; the next page is requested by scrolling.
const CONVOS_PAGE = 15;
const CONVOS_CONCURRENCY = 1;

// Caché EN MEMORIA (vida del proceso) de lo que pinta el drawer de agentes. Cada
// request pasa por el proxy SSO de LP → SSH al box → ficheros JSON: el listado de
// conversaciones tiene p95 de segundos. Sin caché, cada apertura del drawer volvía
// a pagar los ~5 s enteros. Estrategia stale-while-revalidate: se pinta al instante
// lo último conocido y se refresca en segundo plano.
type SidebarsSnapshot = { projects: Project[]; agents: AssistantAgent[]; roles: AgentRole[] };
const sidebarsCache = new Map<string, SidebarsSnapshot>();
const convosCache = new Map<string, { items: Conversation[]; total: number }>();

/** Clave de caché de la lista: distingue búsqueda / scope / proyecto, que son los
 *  ejes que cambian la query server-side. Fuera del componente para poder
 *  hidratar la lista en el INICIALIZADOR del `useState` (primer frame) y no en un
 *  efecto (un frame tarde). */
function convosKeyOf(panelId: string, search: string, scope: ConvScope, projectId: string, workspace = false, projects: Project[] = []): string {
  const q = search.trim();
  const root = workspace ? rootProjectId(projectId, projects) : null;
  const projectScope = workspace ? root ? projectScopeIds(root, projects).sort().join(",") : "none" : projectId || "none";
  if (q) return `${panelId}|q:${q}|${workspace ? projectScope : "all"}`;
  if (workspace) return `${panelId}|workspace:${projectScope}`;
  return `${panelId}|${scope === "agents" ? "agents" : `loose:${projectId || "none"}`}`;
}

export function ConversationsDrawer({
  panelId,
  token,
  t,
  tokens,
  activeId,
  onOpen,
  onNew,
  onNewInProject,
  onDeleted,
  onPickAgent,
  fill,
  projectId: controlledProjectId,
  onProjectChange,
  onOpenAllProjects,
  workspace = false,
  searchOpen = false,
}: {
  panelId: string;
  token: string;
  workspace?: boolean;
  searchOpen?: boolean;
  t: AssistantStrings;
  tokens: ThemeTokens;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** Clic en el botón "+" de una carpeta de proyecto: inicia un chat LIGADO a
   *  ese proyecto (sin él, el chat nacía suelto y no aparecía en la carpeta). */
  onNewInProject?: (projectId: string) => void;
  onDeleted: (id: string) => void;
  /** Clic en el botón "+" de un agente del árbol "Agentes IA": inicia un chat
   *  ligado a él. Consume el contrato RICO (`AssistantAgent`). */
  onPickAgent?: (agent: AssistantAgent) => void;
  /** Rellena el alto disponible (tab del drawer) en vez del overlay de 300px. */
  fill?: boolean;
  /** Proyecto activo (controlado por el padre para compartirlo con la pantalla
   *  "Todos los proyectos"). Si no se pasa, se gestiona localmente. */
  projectId?: string;
  onProjectChange?: (id: string) => void;
  /** Abre la pantalla "Todos los proyectos". */
  onOpenAllProjects?: () => void;
}) {
  // Proveedor activo del panel: cada proveedor tiene SUS PROPIOS chats (paridad
  // con el módulo asistente de LUXIPANEL). La lista se filtra server-side por
  // `?provider=` y se re-consulta al cambiar de proveedor.
  const { provider } = useAssistantSession(panelId);
  // Inset inferior seguro para que la barra fija (scope + nueva conv + buscador)
  // no quede bajo el home-indicator (paridad con `env(safe-area-inset-bottom)`
  // del panel). El padre (ServerChatTab/ServerDrawer) no aplica inset propio.
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [projectIdLocal, setProjectIdLocal] = useState("");
  const projectId = controlledProjectId !== undefined ? controlledProjectId : projectIdLocal;
  const setProjectId = onProjectChange ?? setProjectIdLocal;
  // Hidratación SÍNCRONA desde la caché: el drawer pinta lo último conocido en el
  // PRIMER frame y revalida detrás (stale-while-revalidate; ver `sidebarsCache`/
  // `convosCache`). Los sidebars ya se hidrataban así, pero la lista se rellenaba
  // dentro del efecto de carga: el primer frame se pintaba en blanco ("Sin
  // conversaciones" un instante) y el contenido cacheado entraba un frame después
  // — justo al abrir el drawer, que es cuando se nota.
  const cacheScope = JSON.stringify([panelId, token]);
  const cachedSidebars = sidebarsCache.get(cacheScope);
  // Scope inicial: el drawer entra directo a "Agentes IA" si hay soporte de
  // agentes (`onPickAgent`). Se necesita AQUÍ para calcular la clave de caché de
  // la lista antes de que exista el estado `scope`.
  const initialScope: ConvScope = workspace ? "loose" : onPickAgent ? "agents" : "loose";
  const cachedConvos = convosCache.get(convosKeyOf(cacheScope, "", initialScope, controlledProjectId ?? "", workspace, cachedSidebars?.projects));
  const [busy, setBusy] = useState(!cachedConvos);
  const [storedConversations, setConversations] = useState<Conversation[]>(() => cachedConvos?.items.slice(0, CONVOS_PAGE) ?? []);
  const visible = useContext(NativeModuleContext)?.visible !== false;
  const activity = useConversationActivity(panelId, token, activeId, visible);
  const conversations = useMemo(() => storedConversations.map(activity.decorate), [storedConversations, activity]);
  const [convTotal, setConvTotal] = useState(() => cachedConvos?.total ?? 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreLock = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  const nextOffsetRef = useRef(0);
  const [pageHasMore, setPageHasMore] = useState(false);
  // La carga de la lista FALLÓ (proxy caído / 429 / 5xx): se pinta el bloque de
  // error con reintento en vez de un "Sin conversaciones" que miente.
  const [searchStatus, setSearchStatus] = useState<HistorySearchStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Reintento manual: fuerza otra pasada del efecto de carga.
  const [reloadTick, setReloadTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const deleteRequestRef = useRef<symbol | null>(null);
  useEffect(() => {
    setPendingDelete(null);
    setDeleting(false);
    setDeleteError(false);
    return () => { deleteRequestRef.current = null; };
  }, [panelId, token]);
  const [projects, setProjects] = useState<Project[]>(cachedSidebars?.projects ?? []);
  const [agents, setAgents] = useState<AssistantAgent[]>(cachedSidebars?.agents ?? []);
  const [roles, setRoles] = useState<AgentRole[]>(cachedSidebars?.roles ?? []);
  const { liveIds } = activity;
  // Scope de la lista (paridad con los tabs del sidebar del chat de LUXIPANEL).
  const [scope, setScope] = useState<ConvScope>(initialScope);
  const selectedRootId = workspace ? rootProjectId(projectId, projects) : null;
  const workspaceProjectIds = selectedRootId ? projectScopeIds(selectedRootId, projects).sort().join(",") : "none";
  // Agente desplegado en el árbol, uno por grupo (acordeón por nivel): abrir un
  // agente cierra el que estuviera abierto en SU nivel y deja intactos los demás
  // niveles. Toggle desde la cabecera de grupo (tocar el abierto lo cierra).
  const [openAgentByGroup, setOpenAgentByGroup] = useState<OpenAgentByGroup>(() => new Map());
  const openAgentByGroupRef = useRef(openAgentByGroup);
  openAgentByGroupRef.current = openAgentByGroup;
  const activeHistoryGroup = useRef<string | null>(null);
  const requestGroupRef = useRef<(kind: "agent" | "project", id: string, opening: boolean) => void>(() => undefined);
  const toggleAgent = useCallback((groupKey: string, agentId: string) => {
    requestGroupRef.current("agent", agentId, openAgentByGroupRef.current.get(groupKey) !== agentId);
    setOpenAgentByGroup((prev) => {
      const next = new Map(prev);
      next.set(groupKey, prev.get(groupKey) === agentId ? null : agentId);
      return next;
    });
  }, []);
  // Carpetas de proyecto desplegadas en el árbol "Sueltos / Proyectos" (por id;
  // "Chats sueltos" usa LOOSE_GROUP_ID). Toggle desde la cabecera de grupo.
  const [expandedConvProjects, setExpandedConvProjects] = useState<Set<string>>(() => new Set([LOOSE_GROUP_ID]));
  const expandedConvProjectsRef = useRef(expandedConvProjects);
  expandedConvProjectsRef.current = expandedConvProjects;
  const toggleConvProject = useCallback((id: string) => {
    requestGroupRef.current("project", id, !expandedConvProjectsRef.current.has(id));
    setExpandedConvProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // En el workspace, búsqueda e historial comparten el proyecto raíz elegido
  // (o solo chats sueltos). El drawer legado conserva su scope propio.
  const searching = search.trim().length > 0;
  const agentsScope = !searching && scope === "agents";
  type ConvListRes = { items?: Conversation[]; conversations?: Conversation[]; total?: number; nextCursor?: string | null; hasMore?: boolean; searchStatus?: HistorySearchStatus; summary?: { projects: Record<string, number>; agents: Record<string, number> } } | Conversation[];
  type ConvPage = { items: Conversation[]; total: number; nextCursor?: string | null; hasMore?: boolean; searchStatus?: HistorySearchStatus; summary?: { projects: Record<string, number>; agents: Record<string, number> } };
  const buildConvQs = (offset: number) =>
    `q=${encodeURIComponent(search.trim())}&limit=${CONVOS_PAGE}&offset=${offset}&paged=1${offset === 0 ? "&includeSummary=1" : ""}` +
    // NO se filtra por `provider`: la lista de conversaciones (y el árbol
    // líder→subordinados) muestra los chats de TODOS los proveedores, igual que la
    // web (`reloadList` pasa provider=undefined a `assistantConversationsApi.list`).
    // Filtrar por el proveedor activo hacía que un equipo con chats repartidos
    // entre claude/codex apareciera casi vacío (p.ej. 2 de 203) en el drawer.
    // En workspace, projectIds incluye raíz e hijos; "none" aísla los sueltos.
    // Fuera de workspace se conserva el filtro antiguo del drawer del servidor.
    (workspace ? `&projectIds=${encodeURIComponent(workspaceProjectIds)}` : searching ? "" : agentsScope ? "&withAgent=1" : projectId ? `&projectId=${encodeURIComponent(projectId)}` : "&withAgent=0");
  // `luxAssistantProxy` NUNCA lanza: devuelve `null` ante CUALQUIER fallo (timeout,
  // 429 del rate-limit, 5xx). Antes eso se leía como `{items: [], total: 0}` —
  // indistinguible de "no hay chats": un 429 en un pull-to-refresh vaciaba la lista
  // Y envenenaba las cachés module-level con snapshots vacíos (cerrar y reabrir el
  // drawer seguía mostrando vacío). Ahora el error se propaga como `null` y NADIE
  // pinta/cachea con él: se muestra el bloque de error con reintento.
  const readConvList = (res: ConvListRes | null): ConvPage | null => {
    if (res == null) return null;
    const items = Array.isArray(res) ? res : (res.items ?? res.conversations ?? []);
    const list = Array.isArray(items) ? items : [];
    const total = Array.isArray(res) ? list.length : (res.total ?? list.length);
    return { items: list, total, ...(Array.isArray(res) ? {} : { nextCursor: res.nextCursor, hasMore: res.hasMore, summary: res.summary, searchStatus: res.searchStatus }) };
  };

  // Proyectos + agentes (RICOS: rol/equipo/jerarquía/avatarConfig) + roles + runs
  // vivos: al abrir el drawer (y al refrescar). El árbol "Agentes IA" consume la
  // jerarquía (parentAgentId/subordinateIds) y los roles para los chips.
  // Token de GENERACIÓN de la carga de sidebars: el `cancelled` de antes solo se
  // leía dentro de un `catch` vacío (código muerto), así que una respuesta tardía
  // seguía escribiendo estado y caché tras desmontar el drawer o cambiar de panel.
  // Cada carga toma una generación; solo la vigente puede tocar estado/caché.
  const sidebarsGenRef = useRef(0);
  const loadSidebars = useCallback(async (): Promise<boolean> => {
    const gen = ++sidebarsGenRef.current;
    const isCurrent = () => sidebarsGenRef.current === gen;
    const [projRes, agentsRes, rolesRes] = await Promise.all([
      luxAssistantProxy<{ projects?: Project[]; items?: Project[] } | Project[]>(panelId, token, "GET", "/api/ai/projects"),
      luxAssistantProxy<{ agents?: AssistantAgent[]; items?: AssistantAgent[] } | AssistantAgent[]>(panelId, token, "GET", "/api/ai/agents"),
      luxAssistantProxy<{ roles?: AgentRole[]; items?: AgentRole[] } | AgentRole[]>(panelId, token, "GET", "/api/ai/agent-roles"),
    ]);
    // Carga obsoleta (drawer desmontado / otro panel / otra recarga posterior):
    // ni setState ni cache.set.
    if (!isCurrent()) return true;
    // `null` = fallo del proxy. Antes se degradaba a `[]` y VACIABA (y cacheaba
    // vacíos) proyectos/agentes/roles: un 429 borraba el árbol entero.
    const projList = projRes == null ? null : (Array.isArray(projRes) ? projRes : (projRes.projects ?? projRes.items ?? []));
    const agentList = agentsRes == null ? null : (Array.isArray(agentsRes) ? agentsRes : (agentsRes.agents ?? agentsRes.items ?? []));
    const roleList = rolesRes == null ? null : (Array.isArray(rolesRes) ? rolesRes : (rolesRes.roles ?? rolesRes.items ?? []));
    if (projList) setProjects(projList);
    if (agentList) setAgents(agentList);
    if (roleList) setRoles(roleList);
    if (!projList || !agentList || !roleList) return false;
    const snapshot: SidebarsSnapshot = { projects: projList, agents: agentList, roles: roleList };
    sidebarsCache.set(cacheScope, snapshot);
    return true;
  }, [panelId, token]);
  useEffect(() => {
    void loadSidebars();
    // Al desmontar/cambiar de panel se invalida la carga en vuelo (ver `isCurrent`).
    return () => { sidebarsGenRef.current += 1; };
  }, [loadSidebars]);

  // Conversaciones: búsqueda server-side (?q=) con debounce + scope por proyecto
  // server-side (?projectId=) — así la paginación ("cargar más") es exacta.
  const convosCacheKey = convosKeyOf(cacheScope, search, scope, projectId, workspace, projects);
  // Mutaciones locales (borrar/renombrar/fijar) que aún no se reflejan en lo que
  // devuelve el servidor. TODO snapshot del servidor (páginas que llegan detrás,
  // revalidación, pull-to-refresh) se fusiona con ellas antes de pintarse: sin
  // esto, la página 2 —que se pidió con la lista vieja— resucitaba un chat recién
  // borrado o revertía un rename que el servidor ya había aceptado.
  const localOpsRef = useRef<ConvLocalOps>(new Map());
  const opsKeyRef = useRef(convosCacheKey);
  if (opsKeyRef.current !== convosCacheKey) {
    opsKeyRef.current = convosCacheKey;
    localOpsRef.current = new Map();
  }
  // Espejos para los callbacks async (rollback): el estado de la mutación al
  // resolverse, no el del render en que se lanzó.
  const cacheKeyRef = useRef(convosCacheKey);
  cacheKeyRef.current = convosCacheKey;
  const listRef = useRef<Conversation[]>(conversations);
  listRef.current = conversations;
  const totalRef = useRef(convTotal);
  totalRef.current = convTotal;
  // Espejo de los callbacks del PADRE (`ServerChatTab` los declara como arrows
  // inline: identidad nueva en cada uno de sus renders). Las filas memoizadas
  // reciben los envoltorios estables de abajo, no estas props.
  const cbRef = useRef({ onOpen, onDeleted, onNew, onNewInProject, onPickAgent });
  cbRef.current = { onOpen, onDeleted, onNew, onNewInProject, onPickAgent };
  const setProjectIdRef = useRef(setProjectId);
  setProjectIdRef.current = setProjectId;
  const openConv = useCallback((id: string) => cbRef.current.onOpen(id), []);
  const newLooseChat = useCallback(() => cbRef.current.onNew(), []);
  /** "+" de una carpeta de proyecto: chat nuevo LIGADO a ese proyecto. */
  const newProjectChat = useCallback((pid: string) => {
    setProjectIdRef.current(pid);
    const { onNewInProject: inProject, onNew: newChat } = cbRef.current;
    if (inProject) inProject(pid);
    else newChat();
  }, []);
  /** Pinta una lista y deja la caché en el MISMO estado (la caché solo la escribía
   *  el efecto de carga: al cambiar de scope y volver, el drawer rehidrataba desde
   *  ella y los chats borrados reaparecían). */
  const commitList = useCallback((items: Conversation[], total: number) => {
    listRef.current = items;
    totalRef.current = total;
    setConversations(items);
    setConvTotal(total);
    convosCache.set(cacheKeyRef.current, { items: [...items], total });
  }, []);
  useEffect(() => {
    let cancelled = false;
    // 1) Pintado inmediato de lo cacheado (si lo hay): el drawer abre con contenido
    //    en vez de con el spinner de +5 s. 2) Revalidación detrás.
    const cached = convosCache.get(convosCacheKey);
    setLoadError(false);
    setSearchStatus(null);
    nextCursorRef.current = null;
    nextOffsetRef.current = 0;
    setPageHasMore(false);
    if (cached) {
      setConversations(cached.items);
      setConvTotal(cached.total);
      setBusy(false);
    } else {
      setConversations([]);
      setBusy(true);
    }
    // El debounce solo tiene sentido mientras se TECLEA en el buscador; en la carga
    // inicial (y al cambiar de scope) era latencia regalada.
    groupPages.current.clear(); activeHistoryGroup.current = null;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          // Pinta el prefijo de páginas que YA ha llegado (fusionado con las
          // mutaciones locales pendientes) y deja la caché al día.
          const paint = (items: Conversation[], total: number) => {
            const merged = mergeLocalOps(items, localOpsRef.current);
            const nextTotal = Math.max(total - (items.length - merged.length), merged.length);
            setConversations(merged);
            setConvTotal(nextTotal);
            convosCache.set(convosCacheKey, { items: [...merged], total: nextTotal });
          };
          let painted = false;
          // Solo se pide la primera página; el scroll solicita las siguientes.
          const res = await loadConversationPages<Conversation>({
            pageSize: CONVOS_PAGE,
            maxPages: 1,
            concurrency: CONVOS_CONCURRENCY,
            isCancelled: () => cancelled,
            fetchPage: async (offset) => {
              const page = readConvList(await luxAssistantProxy<ConvListRes>(panelId, token, "GET", `/api/ai/conversations?${buildConvQs(offset)}`));
              if (!cancelled && cacheKeyRef.current === convosCacheKey && page) {
                setSearchStatus(page.searchStatus ?? null);
                if (page.summary) setGroupSummary(page.summary);
                nextCursorRef.current = page.nextCursor ?? null;
                nextOffsetRef.current = page.items.length;
                setPageHasMore(page.hasMore ?? page.items.length < page.total);
              }
              return page;
            },
            onProgress: (items, total) => {
              paint(items, total);
              if (painted) return;
              painted = true;
              // Primera página pintada: fuera el skeleton.
              setBusy(false);
            },
          });
          if (cancelled) return;
          // `null` = falló la PRIMERA página: NI se pinta lista vacía NI se escribe
          // caché (eso dejaba el drawer vacío hasta reiniciar la app). Se conserva
          // lo que hubiera y sale el bloque de error con reintento.
          // Una página INTERMEDIA fallida (`res.failed`) corta la paginación
          // CONSERVANDO el total: el árbol queda incompleto pero con "Cargar más"
          // para completarlo a mano (nunca truncado en silencio ni cacheado a 0).
          if (!res) setLoadError(true);
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
    }, searching ? 320 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, token, search, provider, projectId, workspaceProjectIds, agentsScope, reloadTick]);

  const groupPages = useRef(new Map<string, { offset: number; cursor?: string | null; hasMore: boolean; pending: boolean; scope: string }>());
  const [groupSummary, setGroupSummary] = useState<{ projects: Record<string, number>; agents: Record<string, number> } | null>(null);
  const loadGroupPage = async (kind: "agent" | "project", id: string, next = false) => {
    const key = `${kind}:${id}`, scopeKey = cacheKeyRef.current;
    let state = groupPages.current.get(key);
    if (state?.scope !== scopeKey) { state = undefined; groupPages.current.delete(key); }
    if (state && (!next || state.pending || !state.hasMore)) return;
    const pageState = state ?? { offset: 0, hasMore: true, pending: false, scope: scopeKey };
    pageState.pending = true; groupPages.current.set(key, pageState);
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      if (kind === "project") for (const project of projects) {
        if (project.parentId && ids.has(project.parentId) && !ids.has(project.id)) { ids.add(project.id); changed = true; }
      }
      else for (const agent of agents) {
        if (agent.parentAgentId && ids.has(agent.parentAgentId) && !ids.has(agent.id)) { ids.add(agent.id); changed = true; }
      }
    }
    const filter = kind === "agent" ? `withAgent=1&agentIds=${encodeURIComponent([...ids].join(","))}`
      : `withAgent=0&projectIds=${encodeURIComponent(id === LOOSE_GROUP_ID ? "none" : [...ids].join(","))}`;
    const res = await luxAssistantProxy<ConvListRes>(panelId, token, "GET", `/api/ai/conversations?limit=15&paged=1&offset=${pageState.offset}&${filter}${pageState.cursor ? `&cursor=${encodeURIComponent(pageState.cursor)}` : ""}`);
    pageState.pending = false;
    if (cacheKeyRef.current !== scopeKey || groupPages.current.get(key) !== pageState) return;
    const page = readConvList(res);
    if (!page) { setLoadError(true); groupPages.current.delete(key); return; }
    pageState.cursor = page.nextCursor; pageState.offset += page.items.length;
    pageState.hasMore = page.hasMore ?? pageState.offset < page.total;
    const merged = new Map(listRef.current.map(row => [row.id, row]));
    for (const row of mergeLocalOps(page.items, localOpsRef.current)) merged.set(row.id, row);
    commitList([...merged.values()], Math.max(convTotal, merged.size));
  };
  requestGroupRef.current = (kind, id, opening) => {
    activeHistoryGroup.current = opening ? `${kind}:${id}` : null;
    if (opening) void loadGroupPage(kind, id);
  };

  const loadMoreConvos = useCallback(async () => {
    // `busy` = hay una carga/revalidación en vuelo: su snapshot reemplaza la lista
    // entera y se llevaría por delante la página que estamos a punto de anexar.
    if (loadingMoreLock.current || loadingMore || busy) return;
    const group = activeHistoryGroup.current;
    const groupState = group ? groupPages.current.get(group) : null;
    if (group && groupState?.scope === cacheKeyRef.current && groupState.hasMore) {
      const colon = group.indexOf(":");
      if (groupState.pending) return;
      setLoadingMore(true);
      try {
        await loadGroupPage(group.slice(0, colon) as "agent" | "project", group.slice(colon + 1), true);
      } finally {
        setLoadingMore(false);
      }
      return;
    }
    if (!pageHasMore) return;
    loadingMoreLock.current = true;
    const key = cacheKeyRef.current;
    setLoadingMore(true);
    try {
      const res = await luxAssistantProxy<ConvListRes>(panelId, token, "GET", `/api/ai/conversations?${buildConvQs(nextOffsetRef.current)}${nextCursorRef.current ? `&cursor=${encodeURIComponent(nextCursorRef.current)}` : ""}`);
      if (cacheKeyRef.current !== key) return;
      const page = readConvList(res);
      // Fallo del proxy: se deja la lista como está (no se trunca ni se cachea).
      if (!page) { setLoadError(true); return; }
      nextCursorRef.current = page.nextCursor ?? null;
      nextOffsetRef.current += page.items.length;
      setPageHasMore(page.hasMore ?? nextOffsetRef.current < page.total);
      const prev = listRef.current;
      const seen = new Set(prev.map((c) => c.id));
      const merged = [...prev, ...mergeLocalOps(page.items.filter((c) => !seen.has(c.id)), localOpsRef.current)];
      commitList(merged, Math.max(page.total, merged.length));
    } catch {
      if (cacheKeyRef.current === key) setLoadError(true);
    } finally {
      loadingMoreLock.current = false;
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, token, conversations.length, loadingMore, busy, pageHasMore, search, provider, projectId, workspaceProjectIds, agentsScope, commitList]);

  // Renombrar/fijar son optimistas con rollback real; borrar espera la
  // confirmación y el éxito del servidor. Las mutaciones se registran en
  // `localOpsRef` para que un snapshot anterior no las deshaga. El rollback
  // solo toca la lista si sigue siendo la misma query (scope/búsqueda).
  //
  // VERSIONADO (`nextOpSeq`): cada mutación estampa su secuencia en el campo que
  // escribe y `clearLocalOp` solo revierte si la op pendiente SIGUE siendo la suya.
  // Sin esto, con dos mutaciones rápidas sobre la misma fila el rollback de la
  // primera (fallida) borraba la op local de la segunda (aceptada) y el siguiente
  // snapshot del servidor restauraba el valor original.
  //
  // IDENTIDAD ESTABLE (perf): estos tres callbacks bajan a CADA fila de la lista
  // (`ConvoRow`, ahora memoizada). Si se recrearan en cada render, `React.memo`
  // no evitaría nada: cientos de filas se re-renderizarían en cada tecla del
  // buscador, en cada página que aterriza y en cada llegada de los runs vivos.
  // Por eso leen la lista de `listRef` (espejo del render) en vez de capturar
  // `conversations` del closure.
  const rollbackFor = (key: string) => cacheKeyRef.current === key;
  const remove = useCallback((id: string) => {
    if (deleteRequestRef.current) return;
    const conversation = listRef.current.find((c) => c.id === id);
    if (!conversation) return;
    setDeleteError(false);
    setPendingDelete(conversation);
  }, []);
  const cancelDelete = useCallback(() => {
    if (deleteRequestRef.current) return;
    setPendingDelete(null);
    setDeleteError(false);
  }, []);

  // Renombrar (optimista) — PATCH /api/ai/conversations/:id { title }.
  const rename = useCallback((id: string, title: string) => {
    const key = cacheKeyRef.current;
    const seq = nextOpSeq();
    const prevTitle = listRef.current.find((c) => c.id === id)?.title;
    setLocalOp(localOpsRef.current, id, { title }, seq);
    commitList(listRef.current.map((c) => (c.id === id ? { ...c, title } : c)), totalRef.current);
    void luxAssistantProxyOk(panelId, token, "PATCH", `/api/ai/conversations/${encodeURIComponent(id)}`, { title }).then((ok) => {
      if (ok) return;
      if (!clearLocalOp(localOpsRef.current, id, "title", seq)) return;
      if (!rollbackFor(key)) return;
      commitList(listRef.current.map((c) => (c.id === id ? { ...c, title: prevTitle } : c)), totalRef.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, token, commitList]);
  // Fijar/desfijar (optimista) — el backend ordena fijados primero.
  const togglePin = useCallback((id: string, pinned: boolean) => {
    const key = cacheKeyRef.current;
    const seq = nextOpSeq();
    setLocalOp(localOpsRef.current, id, { pinned }, seq);
    commitList(listRef.current.map((c) => (c.id === id ? { ...c, pinned } : c)), totalRef.current);
    void luxAssistantProxyOk(panelId, token, "PATCH", `/api/ai/conversations/${encodeURIComponent(id)}`, { pinned }).then((ok) => {
      if (ok) return;
      if (!clearLocalOp(localOpsRef.current, id, "pinned", seq)) return;
      if (!rollbackFor(key)) return;
      commitList(listRef.current.map((c) => (c.id === id ? { ...c, pinned: !pinned } : c)), totalRef.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, token, commitList]);

  // Deslizar hacia abajo para actualizar: re-consulta conversaciones (página 1),
  // proyectos, agentes y runs vivos de una sola pasada.
  const reloadAll = useCallback(async (preserveLoaded = false) => {
    if (!token) return;
    invalidateAssistantReads();
    if (preserveLoaded) {
      // Conserva las carpetas y filas visibles. Reinicia los cursores para que
      // el borrado no salte registros en la paginación por offset.
      for (const [id, state] of groupPages.current) {
        groupPages.current.set(id, { ...state, offset: 0, cursor: null, hasMore: true, pending: false });
      }
    } else {
      groupPages.current.clear(); activeHistoryGroup.current = null;
    }
    setBusy(true);
    const key = cacheKeyRef.current;
    try {
      // Al refrescar se reemplaza la primera página y el cursor de continuación.
      // `null` = fallo: se conserva la lista anterior y se muestra reintento.
      const loadConvos = async (): Promise<ConvPage | null> => {
        // Una sola página, sin pintado parcial.
        const res = await loadConversationPages<Conversation>({
          pageSize: CONVOS_PAGE,
          maxPages: 1,
          concurrency: CONVOS_CONCURRENCY,
          fetchPage: async (offset) => {
            const page = readConvList(await luxAssistantProxy<ConvListRes>(panelId, token, "GET", `/api/ai/conversations?${buildConvQs(offset)}`));
            if (key === cacheKeyRef.current && page) {
              setSearchStatus(page.searchStatus ?? null);
              if (page.summary) setGroupSummary(page.summary);
              nextCursorRef.current = page.nextCursor ?? null;
              nextOffsetRef.current = page.items.length;
              setPageHasMore(page.hasMore ?? page.items.length < page.total);
            }
            return page;
          },
        });
        // Falló alguna página (1ª o intermedia): no se pinta ni se cachea nada.
        if (!res || res.failed) return null;
        return { items: res.items, total: Math.max(res.total, res.items.length) };
      };
      const [page, sidebarsOk] = await Promise.all([loadConvos(), loadSidebars()]);
      if (key !== cacheKeyRef.current) return;
      if (!page) { setLoadError(true); return; }
      const { items, total } = page;
      const refreshed = preserveLoaded
        ? [...new Map([...listRef.current, ...items].map((row) => [row.id, row])).values()]
        : items;
      const merged = mergeLocalOps(refreshed, localOpsRef.current);
      const removedFromPage = items.length - mergeLocalOps(items, localOpsRef.current).length;
      commitList(merged, Math.max(total - removedFromPage, merged.length));
      setLoadError(!sidebarsOk);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, token, search, provider, projectId, workspaceProjectIds, agentsScope, loadSidebars, commitList]);
  const confirmDelete = async () => {
    if (!pendingDelete || deleteRequestRef.current) return;
    const { id } = pendingDelete;
    const key = cacheKeyRef.current;
    const request = Symbol(id);
    deleteRequestRef.current = request;
    setDeleting(true);
    setDeleteError(false);
    const ok = await luxAssistantProxyOk(panelId, token, "DELETE", `/api/ai/conversations/${encodeURIComponent(id)}`).catch(() => false);
    if (ok) {
      // Evita rehidratar el chat eliminado al cambiar de proyecto o búsqueda.
      for (const [cachedKey, snapshot] of convosCache) {
        if (!cachedKey.startsWith(`${cacheScope}|`)) continue;
        const items = snapshot.items.filter((c) => c.id !== id);
        convosCache.set(cachedKey, { items, total: Math.max(items.length, snapshot.total - (snapshot.items.length - items.length)) });
      }
      invalidateAssistantReads();
    }
    if (deleteRequestRef.current !== request) return;
    deleteRequestRef.current = null;
    setDeleting(false);
    if (!ok) { setDeleteError(true); return; }
    setLocalOp(localOpsRef.current, id, { removed: true }, nextOpSeq());
    const next = listRef.current.filter((c) => c.id !== id);
    commitList(next, Math.max(next.length, totalRef.current - (listRef.current.length - next.length)));
    setPendingDelete(null);
    cbRef.current.onDeleted(id);
    if (key === cacheKeyRef.current) void reloadAll(true);
  };
  const { refreshing, onRefresh } = usePullRefresh(reloadAll);
  /** Reintento del bloque de error: relanza el efecto de carga (y los sidebars). */
  const retryLoad = useCallback(() => {
    invalidateAssistantReads();
    setLoadError(false);
    setReloadTick((n) => n + 1);
    void loadSidebars();
  }, [loadSidebars]);

  // Índices para el árbol "Agentes IA": agente por id (jerarquía) + rol por id
  // (chips). Los líderes de equipo se muestran SIEMPRE (aun sin conversaciones).
  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const leaderAgents = useMemo(
    () => agents.filter((a) => a.isTeamLeader || (a.subordinateIds?.length ?? 0) > 0),
    [agents],
  );
  const canAgents = !!onPickAgent;

  // Árbol de proyectos (lista plana → roots + hijos por parentId), espejo de web.
  const { rootProjects, childrenMap } = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const map = new Map<string, Project[]>();
    const roots: Project[] = [];
    for (const p of projects) {
      if (p.parentId && ids.has(p.parentId)) {
        const arr = map.get(p.parentId) ?? [];
        arr.push(p);
        map.set(p.parentId, arr);
      } else {
        roots.push(p);
      }
    }
    return { rootProjects: roots, childrenMap: map };
  }, [projects]);
  const projectLabel = (p: Project) => p.name ?? p.title ?? p.id.slice(0, 8);
  const projectTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, projectLabel(p));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);
  const currentProject = projectId ? projects.find((p) => p.id === projectId) ?? null : null;
  const currentParentId = currentProject?.parentId && projects.some((p) => p.id === currentProject.parentId)
    ? currentProject.parentId
    : null;
  // Si el proyecto activo tiene hijos, los mostramos; si es un hijo, mostramos
  // sus hermanos (para que quede resaltado en su rama).
  const branchParentId = (childrenMap.get(projectId)?.length ?? 0) > 0 ? projectId : currentParentId;
  const currentChildren = branchParentId ? (childrenMap.get(branchParentId) ?? []) : [];

  // Orden: fijados primero, luego por fecha desc (el backend ya ordena así pero lo
  // re-aplicamos para optimismo de pin/rename). Separa "sin revisar" (terminados
  // sin abrir) en su propia sección con punto rojo.
  const sorted = useMemo(
    () => [...conversations].sort((a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    ),
    [conversations],
  );
  // "Sin revisar" es una SECCIÓN aparte: sus filas no se repiten en "Recientes"
  // (antes cada chat terminado-sin-abrir salía duplicado en la vista plana).
  // Memoizado: con la lista plana (búsqueda / proyecto) son dos barridos de
  // cientos de elementos que se rehacían en CADA render, incluida cada tecla.
  const [unreviewedConvos, recentConvos] = useMemo(() => {
    const unreviewed: Conversation[] = [];
    const recent: Conversation[] = [];
    for (const c of sorted) {
      if (c.unreviewed && !liveIds.has(c.id)) unreviewed.push(c);
      else recent.push(c);
    }
    return [unreviewed, recent] as const;
  }, [sorted, liveIds]);
  // Árbol de carpetas y chats: el workspace lo muestra dentro de la raíz
  // elegida; el drawer legado lo muestra completo cuando no hay selección.
  const groupLooseTree = !searching && scope === "loose" && (!projectId || workspace);
  const looseTree = useMemo(
    () => (groupLooseTree
      ? (() => {
        const tree = buildProjectConversationTree(conversations, projects, { includeEmpty: true });
        const count = (entry: ProjectTreeEntry<Conversation>): number => {
          if (entry.kind !== "project") return 0;
          const total = (groupSummary?.projects[entry.node.projectId] ?? 0) + entry.node.entries.reduce((n, child) => n + count(child), 0);
          if (groupSummary) entry.node.totalConvos = total;
          return total;
        };
        tree.entries.forEach(count); return tree;
      })()
      : { entries: [] as ProjectTreeEntry<Conversation>[] }),
    [groupLooseTree, conversations, projects, groupSummary],
  );
  const selectedProjectEntry = looseTree.entries.find((entry) => entry.kind === "project" && entry.node.projectId === selectedRootId);
  const workspaceEntries = selectedRootId
    ? selectedProjectEntry?.kind === "project" ? selectedProjectEntry.node.entries : []
    : looseTree.entries.filter((entry) => entry.kind === "chat");
  const workspaceSubprojects = workspaceEntries.filter((entry): entry is Extract<ProjectTreeEntry<Conversation>, { kind: "project" }> => entry.kind === "project");
  const workspaceChats = workspaceEntries.filter((entry): entry is Extract<ProjectTreeEntry<Conversation>, { kind: "chat" }> => entry.kind === "chat");
  const workspaceTreeProps = {
    projectTitleById, agentById, expanded: expandedConvProjects, activeId, liveIds,
    onToggle: toggleConvProject, onNewLoose: newLooseChat, onNewProjectChat: newProjectChat,
    onOpen: openConv, onDelete: remove, onRename: rename, onTogglePin: togglePin, t, tokens,
  };
  const projectLabelFor = (c: Conversation) =>
    searching ? (c.projectId ? projectTitleById.get(c.projectId) ?? null : (t.looseChats ?? "Chats sueltos")) : null;

  // OJO: `ConvoRow` está memoizada. Todo lo que baja aquí debe tener identidad
  // estable entre renders o el memo no sirve de nada: `c` (objeto de la lista),
  // `t`/`tokens` (memoizados por el padre / `getThemeTokens`), y los callbacks
  // (envoltorios estables de arriba).
  const renderConvo = (c: Conversation) => (
    <ConvoRow
      key={c.id}
      c={c}
      activeId={activeId}
      isLive={liveIds.has(c.id)}
      projectLabel={projectLabelFor(c)}
      agentLabel={c.agentId ? agentById.get(c.agentId)?.name : undefined}
      t={t}
      tokens={tokens}
      onOpen={openConv}
      onDelete={remove}
      onRename={rename}
      onTogglePin={togglePin}
    />
  );

  // Árbol "Agentes IA": botón "+" de una cabecera → nuevo chat ligado al agente.
  const agentByIdRef = useRef(agentById);
  agentByIdRef.current = agentById;
  const startAgentChat = useCallback((agentId: string) => {
    const a = agentByIdRef.current.get(agentId);
    if (a) cbRef.current.onPickAgent?.(a);
  }, []);

  // Bloque de ERROR de carga (con reintento): sustituye al "Sin conversaciones"
  // cuando la lista no se pudo traer (proxy caído / 429 / 5xx). Sin él, un fallo
  // se leía como "no tienes chats".
  const listError = (
    <View>
      <Text style={[styles.drawerEmpty, { color: tokens.textMuted }]}>{localizeServerError(t.error)}</Text>
      <Pressable onPress={retryLoad} style={[styles.loadMoreBtn, { borderColor: tokens.border }]}>
        <Text style={[styles.loadMoreText, { color: tokens.textMuted }]}>{t.retry ?? "Reintentar"}</Text>
      </Pressable>
    </View>
  );
  const failedEmpty = loadError && conversations.length === 0;

  return (
    <View style={[fill ? { flex: 1 } : styles.drawer, { borderBottomColor: tokens.border, backgroundColor: fill ? "transparent" : tokens.bgCardSolid }]}>
      {/* Layout INVERTIDO móvil (paridad con el sidebar del chat de LUXIPANEL):
          la lista de conversaciones va ARRIBA (scroll) y la barra de scope +
          "Nueva conversación" + buscador va FIJA ABAJO (thumb-reach). */}
      {workspace && !searching && workspaceSubprojects.length > 0 ? (
        <ScrollView
          nestedScrollEnabled
          style={{ flexGrow: 0, maxHeight: windowHeight * 0.42, borderBottomWidth: 1, borderBottomColor: withAlpha(tokens.border, 0.6) }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 5 }}
        >
          {workspaceSubprojects.map((entry) => {
            const id = entry.node.projectId;
            return <ProjectGroupHeaderRN key={id}
              name={projectTitleById.get(id) ?? id}
              count={entry.node.totalConvos}
              isOpen={expandedConvProjects.has(id)}
              convos={flattenProjectTreeChats(entry.node)}
              liveIds={liveIds}
              onToggle={() => toggleConvProject(id)}
              onNewChat={() => newProjectChat(id)}
              t={t} tokens={tokens}
            />;
          })}
        </ScrollView>
      ) : null}
      <ScrollView
        scrollEventThrottle={100}
        onScroll={({ nativeEvent }) => {
          if (nativeEvent.contentOffset.y > 0 && nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height >= nativeEvent.contentSize.height - 48) void loadMoreConvos();
        }}
        style={[styles.drawerList, fill ? { flex: 1 } : null]}
        contentContainerStyle={workspace ? {paddingTop:10,paddingBottom:8,gap:4} : fill ? styles.drawerListContent : null}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
      >
        {/* Refresco/página fallidos con lista ya pintada: aviso + reintento ARRIBA
            (la lista se conserva tal cual; antes el fallo era invisible). */}
        {searching && searchStatus?.state === "indexing" && <View>
          <Text style={[styles.drawerEmpty, { color: tokens.textMuted }]}>{historySearchLabel(loadSessionState().language, searchStatus)}</Text>
          <Pressable onPress={onRefresh} style={[styles.loadMoreBtn, { borderColor: tokens.border }]}><Text style={{ color: tokens.textMuted }}>{t.refresh}</Text></Pressable>
        </View>}
        {loadError && conversations.length > 0 ? listError : null}
        {workspace ? (busy && conversations.length === 0 ? <View style={{gap:8}}>{[0,1,2,3].map(i=><Skeleton key={i} height={62} radius={5}/>)}</View> : failedEmpty ? listError : <>
          {searching ? sorted.map(renderConvo) : workspaceEntries.length ? <>
            {workspaceSubprojects.filter((entry) => expandedConvProjects.has(entry.node.projectId)).map((entry) => (
              <View key={`${entry.node.projectId}:contents`} style={{ marginLeft: 12, borderLeftWidth: 1, borderLeftColor: withAlpha(tokens.border, 0.5), paddingLeft: 4 }}>
                {entry.node.entries.length > 0
                  ? <ProjectTreeConvos entries={entry.node.entries} top={false} {...workspaceTreeProps} />
                  : <Text style={[styles.drawerEmpty, { color: tokens.textMuted }]}>{t.noConversations}</Text>}
              </View>
            ))}
            {workspaceChats.length > 0 ? <ProjectTreeConvos entries={workspaceChats} top={false} {...workspaceTreeProps} /> : null}
          </> : <Text style={[styles.drawerEmpty, { color: tokens.textMuted }]}>{t.noConversations}</Text>}
          {loadingMore && <ActivityIndicator size="small" color={tokens.textMuted} />}
        </>) : agentsScope ? (
          /* ── Tab "Agentes IA": árbol líder → subordinados (2 niveles) ── */
          busy && conversations.length === 0 ? (
            <View style={{ gap: 8, marginVertical: 8, paddingHorizontal: 4 }}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} radius={8} />)}
            </View>
          ) : failedEmpty ? (
            listError
          ) : conversations.length === 0 && leaderAgents.length === 0 ? (
            <Text style={[styles.drawerEmpty, { color: tokens.textMuted }]}>
              {agents.length === 0 ? (t.agentsEmpty ?? "Sin agentes. Créalos en la pestaña Agentes.") : (t.agentsConvEmpty ?? "Sin conversaciones con agentes.")}
            </Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              <AgentThreadedConvos
                convos={conversations}
                activeId={activeId}
                liveIds={liveIds}
                agentById={agentById}
                rolesById={rolesById}
                projectTitleById={projectTitleById}
                openAgentByGroup={openAgentByGroup}
                onToggle={toggleAgent}
                onNewAgentChat={startAgentChat}
                emptyLeaderAgents={leaderAgents}
                t={t}
                tokens={tokens}
                onOpen={openConv}
                onDelete={remove}
                onRename={rename}
                onTogglePin={togglePin}
              />
            </View>
          )
        ) : groupLooseTree ? (
        /* ── Tab "Sueltos / Proyectos": árbol colapsable con timeline. ── */
        <>
        {busy && conversations.length === 0 ? (
          <View style={{ gap: 8, marginVertical: 8, paddingHorizontal: 4 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} radius={8} />)}
          </View>
        ) : failedEmpty ? (
          listError
        ) : (
          /* Se pinta SIEMPRE (aunque no haya chats ni proyectos): la tarjeta
             "Chats sueltos" con su "+" es el único punto del drawer para crear un
             chat no ligado a proyecto/agente. */
          <ProjectTreeConvos
            entries={looseTree.entries}
            projectTitleById={projectTitleById}
            expanded={expandedConvProjects}
            activeId={activeId}
            liveIds={liveIds}
            onToggle={toggleConvProject}
            onNewLoose={newLooseChat}
            onNewProjectChat={newProjectChat}
            onOpen={openConv}
            onDelete={remove}
            onRename={rename}
            onTogglePin={togglePin}
            t={t}
            tokens={tokens}
          />
        )}
        {onOpenAllProjects ? (
          <Pressable onPress={onOpenAllProjects} style={styles.treeRow}>
            <MoreHorizontal size={16} color={tokens.textMuted} />
            <Text numberOfLines={1} style={[styles.treeLabel, { color: tokens.textSecondary }]}>{t.allProjectsEntry}</Text>
          </Pressable>
        ) : null}
        {loadingMore && <ActivityIndicator size="small" color={tokens.textMuted} />}
        </>
        ) : (
        /* ── Búsqueda / proyecto seleccionado: render plano existente de
             Proyectos (árbol + paginador) · Sin revisar · Recientes. ── */
        <>
        {projects.length > 0 ? (
          <>
            <Text style={[styles.treeSection, { color: tokens.textMuted }]}>{t.projectsSection}</Text>
            {rootProjects.map((p) => {
              const kids = childrenMap.get(p.id)?.length ?? 0;
              const active = projectId === p.id || currentParentId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setProjectId(projectId === p.id ? "" : p.id)}
                  style={[styles.treeRow, active ? { backgroundColor: tokens.brandDim } : null]}
                >
                  <Folder size={16} color={active ? tokens.brand : tokens.textMuted} />
                  <Text numberOfLines={1} style={[styles.treeLabel, { color: active ? tokens.textPrimary : tokens.textSecondary }]}>
                    {projectLabel(p)}
                  </Text>
                  {kids > 0 ? (
                    <View style={[treeStyles.treeCount, { backgroundColor: tokens.bgInput }]}>
                      <Text style={[treeStyles.treeCountText, { color: tokens.textMuted }]}>{kids}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            {currentChildren.length > 0 ? (
              <>
                <Text style={[styles.treeSection, { color: tokens.textMuted, marginTop: 8 }]}>{t.projectsSection}</Text>
                {currentChildren.map((p) => {
                  const active = projectId === p.id;
                  const kids = childrenMap.get(p.id)?.length ?? 0;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setProjectId(projectId === p.id ? "" : p.id)}
                      style={[styles.treeRow, styles.treeRowChild, active ? { backgroundColor: tokens.brandDim } : null]}
                    >
                      <Folder size={15} color={active ? tokens.brand : tokens.textMuted} />
                      <Text numberOfLines={1} style={[styles.treeLabel, { color: active ? tokens.textPrimary : tokens.textSecondary }]}>
                        {projectLabel(p)}
                      </Text>
                      {kids > 0 ? (
                        <View style={[treeStyles.treeCount, { backgroundColor: tokens.bgInput }]}>
                          <Text style={[treeStyles.treeCountText, { color: tokens.textMuted }]}>{kids}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </>
            ) : null}
            {onOpenAllProjects ? (
              <Pressable onPress={onOpenAllProjects} style={styles.treeRow}>
                <MoreHorizontal size={16} color={tokens.textMuted} />
                <Text numberOfLines={1} style={[styles.treeLabel, { color: tokens.textSecondary }]}>{t.allProjectsEntry}</Text>
              </Pressable>
            ) : null}
          </>
        ) : onOpenAllProjects ? (
          <Pressable onPress={onOpenAllProjects} style={styles.treeRow}>
            <MoreHorizontal size={16} color={tokens.textMuted} />
            <Text numberOfLines={1} style={[styles.treeLabel, { color: tokens.textSecondary }]}>{t.allProjectsEntry}</Text>
          </Pressable>
        ) : null}

        {/* La sección plana "Agentes" se movió al tab "Agentes IA" (árbol
             colapsable líder → subordinados); aquí sólo van sueltos/proyectos. */}

        {/* ── Sin revisar ── (chats terminados que el usuario no ha abierto) */}
        {unreviewedConvos.length > 0 ? (
          <>
            <View style={styles.unreviewedHead}>
              <View style={[styles.unreviewedDot, { backgroundColor: tokens.danger }]} />
              <Text style={[styles.treeSection, { color: tokens.textMuted, marginTop: 0, marginBottom: 0, paddingHorizontal: 0, flex: 1 }]}>{t.unreviewedHeading ?? "Sin revisar"}</Text>
              <View style={[styles.unreviewedCount, { backgroundColor: "rgba(244,63,94,0.12)" }]}>
                <Text style={[styles.unreviewedCountText, { color: tokens.danger }]}>{unreviewedConvos.length}</Text>
              </View>
            </View>
            {unreviewedConvos.map(renderConvo)}
          </>
        ) : null}

        {/* ── Recientes ── (la cabecera se omite si todo está en "Sin revisar") */}
        {recentConvos.length > 0 || unreviewedConvos.length === 0 ? (
          <Text style={[styles.treeSection, { color: tokens.textMuted }]}>{t.recentChats}</Text>
        ) : null}
        {busy && conversations.length === 0 ? (
          <View style={{ gap: 8, marginVertical: 8, paddingHorizontal: 4 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} radius={8} />)}
          </View>
        ) : failedEmpty ? (
          listError
        ) : sorted.length === 0 ? (
          <Text style={[styles.drawerEmpty, { color: tokens.textMuted }]}>{t.noConversations}</Text>
        ) : (
          <>
            {recentConvos.map(renderConvo)}
            {loadingMore && <ActivityIndicator size="small" color={tokens.textMuted} />}
          </>
        )}
        </>
        )}
      </ScrollView>

      {/* ── Barra inferior fija: scope tabs + buscador ──
          Sin fondo gris (transparente) y al ras del borde inferior. El shell del
          drawer (MainScreen) YA reserva `insets.bottom`, así que aquí solo va un
          margen mínimo fijo (sin volver a sumar el safe-area, que dejaba el doble
          hueco que el usuario pedía bajar). Botón "Nueva conversación" retirado:
          se crea chat tocando un agente del árbol o el "+" de cada grupo. */}
      {(!workspace || searchOpen) && <View style={[styles.drawerBottomBar, { borderTopColor: tokens.border, backgroundColor: "transparent", paddingBottom: 6 }]}>
        {canAgents && !searching && !workspace ? (
          <ScopeTabs value={scope} onChange={setScope} tokens={tokens} t={t} />
        ) : null}
        <View style={[styles.searchWrap, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
          <Search size={14} color={tokens.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.search}
            placeholderTextColor={tokens.textMuted}
            autoCapitalize="none"
            style={[styles.searchInput, { color: tokens.textPrimary }]}
          />
        </View>
      </View>}
      <DeleteConversationDialog conversation={pendingDelete} deleting={deleting} error={deleteError}
        t={t} onCancel={cancelDelete} onConfirm={confirmDelete} />
    </View>
  );
}
