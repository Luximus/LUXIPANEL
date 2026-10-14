/**
 * Threading Gmail-style + jerarquía de equipos de 2 niveles para la lista de
 * conversaciones del sidebar del asistente — puerto 1:1 de
 * `app/src/components/assistant-settings/agents/conversation-grouping.ts`
 * (mismo contrato que usan el Dashboard y el sidebar del chat de LUXIPANEL, y ya
 * portado literal a la app móvil). Lógica PURA, sin DOM/RN: el sidebar de
 * desktop (`ConversationSidebar`/`AgentThreadedConvos`/`ProjectTreeConvos`) la
 * consume para pintar el árbol líder → subordinados y el árbol de proyectos
 * idénticos a los del panel y la app.
 */

/** Forma mínima que cumplen tanto `DashboardItem` como `ConversationMeta`. */
export interface ConversationLike {
  agentId?: string | null;
  projectId?: string | null;
  updatedAt?: string;
  pinned?: boolean;
  /** Flag persistido "el último run terminó pero no se ha abierto" (punto rojo).
   *  Usado para ordenar subordinados de un líder: sin revisar primero. */
  unreviewed?: boolean;
}

/**
 * En qué tab de la lista de conversaciones cae un chat. Espeja el toggle del
 * sidebar: los chats ligados a un agente viven en "Agentes IA"; el resto en
 * "Sueltos / Proyectos" (subdividido en proyecto vs suelto para el badge).
 */
export type ConversationCategory = "agents" | "projects" | "loose";

export function categorizeConversation(x: ConversationLike): ConversationCategory {
  if (x.agentId) return "agents";
  if (x.projectId) return "projects";
  return "loose";
}

/** El scope-tab al que mapea una categoría (agents vs loose). */
export function scopeForCategory(cat: ConversationCategory): "agents" | "loose" {
  return cat === "agents" ? "agents" : "loose";
}

/** Una fila de primer nivel: un chat suelto, o un hilo colapsado de chats del
 *  mismo agente. */
export type ThreadRow<T> =
  | { kind: "single"; item: T }
  | { kind: "group"; agentId: string; items: T[]; latest: T };

/**
 * Threading Gmail-style sobre una lista YA FILTRADA y YA ORDENADA: 2+ chats
 * ligados al mismo agente se pliegan en una fila de grupo anclada donde está el
 * chat mejor rankeado del agente; un agente con un solo chat se pinta como fila
 * simple; los chats sueltos (sin agentId) pasan sin tocar. Los hijos de un grupo
 * se ordenan por última actividad (updatedAt desc). Puro + genérico sobre T.
 */
export function groupByAgentThread<T extends ConversationLike>(items: T[]): ThreadRow<T>[] {
  const byAgent = new Map<string, T[]>();
  for (const it of items) {
    if (!it.agentId) continue;
    const list = byAgent.get(it.agentId);
    if (list) list.push(it);
    else byAgent.set(it.agentId, [it]);
  }
  const emitted = new Set<string>();
  const out: ThreadRow<T>[] = [];
  for (const it of items) {
    if (!it.agentId) {
      out.push({ kind: "single", item: it });
      continue;
    }
    if (emitted.has(it.agentId)) continue;
    emitted.add(it.agentId);
    const group = byAgent.get(it.agentId)!;
    if (group.length < 2) {
      out.push({ kind: "single", item: it });
      continue;
    }
    const sorted = [...group].sort((a, b) => ((a.updatedAt ?? "") < (b.updatedAt ?? "") ? 1 : -1));
    out.push({ kind: "group", agentId: it.agentId, items: sorted, latest: sorted[0]! });
  }
  return out;
}

// ── Jerarquía de equipos de 2 niveles para el tab "Agentes IA" ────────────────
// El primer nivel muestra SÓLO líderes de proyecto/equipo; las conversaciones
// propias del líder más una sub-colapsable por subordinado DIRECTO viven dentro
// de su colapsable. En modo roster-seed (`seedRoster`) se siembra CADA miembro
// de equipo, así un subordinado (o un equipo entero) sin conversaciones sigue
// apareciendo como colapsable vacía — el roster, no el set de conversaciones,
// define la forma. Los agentes de primer nivel sin subordinados conservan el
// threading Gmail-style (fila simple o grupo del mismo agente).

/** Forma mínima de agente para resolver la jerarquía de 2 niveles. */
export interface AgentHierarchyLike {
  id: string;
  parentAgentId?: string | null;
  isTeamLeader?: boolean;
  subordinateIds?: string[];
}

/** Una entrada de primer nivel del tab "Agentes IA": o una colapsable de líder
 *  (sus conversaciones + sub-colapsables por subordinado) o una fila threaded
 *  simple (una conversación o grupo del mismo agente) para un no-líder/suelto. */
export type AgentTopEntry<T> =
  | { kind: "leader"; agentId: string; ownConvos: T[]; subs: { agentId: string; convos: T[] }[] }
  | { kind: "thread"; row: ThreadRow<T> };

/**
 * Construye la vista de equipos de 2 niveles para una lista de conversaciones
 * ligadas a agentes. Ver el contrato completo en el archivo homónimo de la app.
 * Puro y genérico sobre T; el tope de 2 niveles sigue el contrato compartido.
 */
export function buildAgentConversationTree<T extends ConversationLike>(
  convos: T[],
  // `ReadonlyMap` (solo se lee: get/has/keys/iter) para poder recibir un
  // `Map<string, SidebarAgent>` — SidebarAgent es un AgentHierarchyLike, y un
  // ReadonlyMap es covariante en su valor (un `Map` mutable no lo sería).
  agentById: ReadonlyMap<string, AgentHierarchyLike>,
  opts?: { seedRoster?: boolean; newestLast?: boolean },
): AgentTopEntry<T>[] {
  const seedRoster = opts?.seedRoster ?? false;
  const newestLast = opts?.newestLast ?? false;

  const rank = (a: T, b: T) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  const rankKey = (a: T | null, b: T | null) => {
    if (a && b) return rank(a, b);
    if (!a && !b) return 0;
    return a ? -1 : 1;
  };

  const byAgent = new Map<string, T[]>();
  for (const c of convos) {
    if (!c.agentId) continue;
    const arr = byAgent.get(c.agentId);
    if (arr) arr.push(c);
    else byAgent.set(c.agentId, [c]);
  }
  const hasConvos = (id: string) => (byAgent.get(id)?.length ?? 0) > 0;

  const childrenOf = new Map<string, string[]>();
  for (const [id, a] of agentById) {
    if (a.parentAgentId && agentById.has(a.parentAgentId)) {
      const arr = childrenOf.get(a.parentAgentId) ?? [];
      arr.push(id);
      childrenOf.set(a.parentAgentId, arr);
    }
  }
  const directSubs = (id: string): string[] => {
    const explicit = agentById.get(id)?.subordinateIds?.filter((s) => agentById.has(s));
    return explicit && explicit.length ? explicit : (childrenOf.get(id) ?? []);
  };
  const displaySubs = (id: string): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of directSubs(id)) {
      if (s === id || seen.has(s)) continue;
      if (!seedRoster && !hasConvos(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  };

  const displayLeader = new Set<string>();
  for (const id of agentById.keys()) if (displaySubs(id).length > 0) displayLeader.add(id);

  const isNestedUnderLeader = (id: string): boolean => {
    const p = agentById.get(id)?.parentAgentId;
    return !!(p && displayLeader.has(p) && displaySubs(p).includes(id));
  };
  const topLeaders = [...displayLeader].filter((id) => !isNestedUnderLeader(id));

  const nested = new Set<string>();
  for (const id of topLeaders) for (const s of displaySubs(id)) nested.add(s);
  const topLeaderSet = new Set(topLeaders);

  const remaining = convos.filter((c) => {
    if (!c.agentId) return true;
    return !topLeaderSet.has(c.agentId) && !nested.has(c.agentId);
  });

  const subGroup = (list: T[]): 0 | 1 | 2 =>
    list.length === 0 ? 2 : list.some((c) => c.unreviewed) ? 0 : 1;

  const keyed: { entry: AgentTopEntry<T>; key: T | null }[] = [];
  for (const id of topLeaders) {
    const ownConvos = [...(byAgent.get(id) ?? [])].sort(rank);
    const subs = displaySubs(id)
      .map((s) => ({ agentId: s, convos: [...(byAgent.get(s) ?? [])].sort(rank) }))
      .sort(
        (a, b) =>
          subGroup(a.convos) - subGroup(b.convos) ||
          (b.convos[0]?.updatedAt ?? "").localeCompare(a.convos[0]?.updatedAt ?? ""),
      );
    const all = [...ownConvos, ...subs.flatMap((s) => s.convos)].sort(rank);
    keyed.push({ entry: { kind: "leader", agentId: id, ownConvos, subs }, key: all[0] ?? null });
  }
  for (const row of groupByAgentThread([...remaining].sort(rank))) {
    keyed.push({ entry: { kind: "thread", row }, key: row.kind === "single" ? row.item : row.latest });
  }

  keyed.sort((a, b) => (newestLast ? -rankKey(a.key, b.key) : rankKey(a.key, b.key)));
  return keyed.map((k) => k.entry);
}

/**
 * Cadena self→raíz de ids colapsables que hay que expandir para REVELAR un nodo:
 * primero su propio id, luego cada ancestro vía `parentOf` hasta la raíz. A
 * prueba de ciclos. Genérico sobre la arista de padre (sirve para el árbol de
 * agentes vía `parentAgentId` y para el de proyectos vía `parentId`). Usado
 * para auto-expandir sólo la rama que contiene la conversación activa.
 */
export function computeExpandChain(
  startId: string | null | undefined,
  parentOf: (id: string) => string | null | undefined,
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur = startId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    chain.push(cur);
    cur = parentOf(cur);
  }
  return chain;
}

// ─── Árbol recursivo de PROYECTOS (Sueltos/Proyectos) ────────────────────────
// Puerto 1:1 de WEB/floating-assistant/conversation-grouping.ts: agrupa los
// chats en carpetas de proyecto colapsables anidadas + una carpeta "Chats
// sueltos" en el nivel superior. Lo consume `ProjectTreeConvos` (scope
// `loose`), reemplazando el filtro plano "Recientes/Sin revisar".

/** Id sintético de la carpeta "Chats sueltos" (nunca colisiona con un uuid real). */
export const LOOSE_GROUP_ID = "__loose__";

/** Forma mínima de un proyecto para armar la jerarquía (id + parentId). */
export interface ProjectHierarchyLike {
  id: string;
  parentId?: string | null;
}

/** Una entrada de un nivel del árbol: una carpeta de proyecto anidada o un chat. */
export type ProjectTreeEntry<T> =
  | { kind: "project"; node: ProjectTreeNode<T> }
  | { kind: "chat"; convo: T };

/** Nodo carpeta de proyecto: sus entradas internas (subcarpetas + chats propios,
 *  ordenadas por actividad) y el total de chats de todo su subárbol (pill). */
export interface ProjectTreeNode<T> {
  projectId: string;
  totalConvos: number;
  entries: ProjectTreeEntry<T>[];
}

export interface ProjectConversationTree<T> {
  /** Nivel superior: carpetas raíz + chats sueltos, ordenados por actividad. */
  entries: ProjectTreeEntry<T>[];
}

/** Aplana todos los chats del subárbol de un nodo (para indicadores de la cabecera). */
export function flattenProjectTreeChats<T>(node: ProjectTreeNode<T>): T[] {
  const out: T[] = [];
  const walk = (n: ProjectTreeNode<T>) => {
    for (const e of n.entries) {
      if (e.kind === "chat") out.push(e.convo);
      else walk(e.node);
    }
  };
  walk(node);
  return out;
}

/**
 * Construye el árbol recursivo de proyectos para una lista de conversaciones.
 * Puro y genérico. Pinned primero, luego más reciente; carpetas vacías al final;
 * cycle-safe. Con `includeEmpty` (default del sidebar) toda carpeta conocida
 * aparece aunque no tenga chats.
 */
export function buildProjectConversationTree<T extends ConversationLike>(
  convos: T[],
  projects: ProjectHierarchyLike[],
  opts?: { includeEmpty?: boolean },
): ProjectConversationTree<T> {
  const includeEmpty = opts?.includeEmpty ?? false;
  const rank = (a: T, b: T) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  const rankKey = (a: T | null, b: T | null) => {
    if (a && b) return rank(a, b);
    if (!a && !b) return 0;
    return a ? -1 : 1;
  };

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const childrenOf = new Map<string, string[]>();
  const rootIds: string[] = [];
  for (const p of projects) {
    if (p.parentId && p.parentId !== p.id && projectById.has(p.parentId)) {
      const arr = childrenOf.get(p.parentId) ?? [];
      arr.push(p.id);
      childrenOf.set(p.parentId, arr);
    } else {
      rootIds.push(p.id);
    }
  }

  const byProject = new Map<string, T[]>();
  const looseConvos: T[] = [];
  for (const c of convos) {
    const pid = c.projectId;
    if (pid && projectById.has(pid)) {
      const arr = byProject.get(pid);
      if (arr) arr.push(c);
      else byProject.set(pid, [c]);
    } else {
      looseConvos.push(c);
    }
  }

  const build = (id: string, guard: Set<string>): { node: ProjectTreeNode<T>; best: T | null } | null => {
    if (guard.has(id)) return null; // cycle guard
    const nextGuard = new Set(guard).add(id);
    const ownConvos = [...(byProject.get(id) ?? [])].sort(rank);
    const builtChildren = (childrenOf.get(id) ?? [])
      .map((cid) => build(cid, nextGuard))
      .filter((x): x is { node: ProjectTreeNode<T>; best: T | null } => x !== null);

    const total = ownConvos.length + builtChildren.reduce((n, c) => n + c.node.totalConvos, 0);
    if (total === 0 && !includeEmpty) return null;

    const entries: { entry: ProjectTreeEntry<T>; key: T | null }[] = [
      ...ownConvos.map((c) => ({ entry: { kind: "chat", convo: c } as ProjectTreeEntry<T>, key: c as T | null })),
      ...builtChildren.map((c) => ({ entry: { kind: "project", node: c.node } as ProjectTreeEntry<T>, key: c.best })),
    ];
    entries.sort((a, b) => rankKey(a.key, b.key));
    const best = entries.length ? [...entries.map((e) => e.key)].sort(rankKey)[0]! : null;
    return { node: { projectId: id, totalConvos: total, entries: entries.map((e) => e.entry) }, best };
  };

  const topEntries: { entry: ProjectTreeEntry<T>; key: T | null }[] = [];
  for (const id of rootIds) {
    const built = build(id, new Set());
    if (built) topEntries.push({ entry: { kind: "project", node: built.node }, key: built.best });
  }
  for (const c of looseConvos) topEntries.push({ entry: { kind: "chat", convo: c }, key: c });
  topEntries.sort((a, b) => rankKey(a.key, b.key));

  return { entries: topEntries.map((e) => e.entry) };
}
