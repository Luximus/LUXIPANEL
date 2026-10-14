// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared conversation categorisation + Gmail-style agent threading.
 *
 * Both the Dashboard (`DashboardTab`) and the chat sidebar (`ChatPane`) present
 * the same conversation model, so the "which tab does this chat belong to"
 * derivation and the "collapse 2+ chats of the same agent into one expandable
 * thread" grouping live here ONCE and are reused by both — no duplicated logic.
 */

/** Minimal shape both `DashboardItem` and `ConversationMeta` satisfy. */
export interface ConversationLike {
  agentId?: string | null;
  projectId?: string | null;
  updatedAt?: string;
  pinned?: boolean;
  /** Persisted "last run finished but not yet opened" flag (the red dot). Used
   *  to sort a leader's subordinates: unreviewed subs first. */
  unreviewed?: boolean;
}

/**
 * Which conversation-list tab a chat belongs to. Mirrors the sidebar toggle:
 * agent-bound chats live under "Agentes IA"; everything else under
 * "Sueltos / Proyectos" (further split into project vs loose for the badge).
 */
export type ConversationCategory = "agents" | "projects" | "loose";

export function categorizeConversation(x: ConversationLike): ConversationCategory {
  if (x.agentId) return "agents";
  if (x.projectId) return "projects";
  return "loose";
}

/** The conversation-scope tab a category maps to (agents vs loose). */
export function scopeForCategory(cat: ConversationCategory): "agents" | "loose" {
  return cat === "agents" ? "agents" : "loose";
}

/** A top-level row: a single chat, or a collapsed thread of same-agent chats. */
export type ThreadRow<T> =
  | { kind: "single"; item: T }
  | { kind: "group"; agentId: string; items: T[]; latest: T };

/**
 * Gmail-style threading over an ALREADY-FILTERED, ALREADY-SORTED list: 2+ chats
 * bound to the same agent fold into one group row anchored where the agent's
 * best-ranked chat sits; an agent with a single chat renders as a plain row;
 * loose chats (no agentId) pass through untouched. A group's children are
 * sorted by last activity (updatedAt desc). Pure + generic over the item type.
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

// ── Two-level team hierarchy for the "Agentes IA" conversation tab ─────────────
// The chat sidebar's top level shows ONLY project/team leaders; a leader's own
// conversations plus one sub-collapsable per DIRECT subordinate live inside its
// collapsable. In roster-seed mode (`seedRoster`) EVERY team member is seeded so
// a subordinate (or a whole team) with zero conversations still renders as an
// empty collapsable — the roster, not the conversation set, drives the shape.
// Top-level agents with no subordinates keep the plain Gmail-style threading
// (single row or same-agent group), so standalone agents behave as before.

/** Minimal agent shape needed to resolve the 2-level team hierarchy. */
export interface AgentHierarchyLike {
  id: string;
  parentAgentId?: string | null;
  isTeamLeader?: boolean;
  subordinateIds?: string[];
}

/** One top-level entry of the "Agentes IA" tab: either a team-leader collapsable
 *  (its own conversations + subordinate sub-collapsables) or a plain threaded row
 *  (single conversation or same-agent group) for a non-leader / loose agent. */
export type AgentTopEntry<T> =
  | { kind: "leader"; agentId: string; ownConvos: T[]; subs: { agentId: string; convos: T[] }[] }
  | { kind: "thread"; row: ThreadRow<T> };

/**
 * Build the 2-level team view for a list of agent-bound conversations.
 *
 * - A "display leader" is any agent with ≥1 shown DIRECT subordinate. In
 *   roster-seed mode (`opts.seedRoster`) that's any agent that has a team, so an
 *   idle team still surfaces; otherwise only agents with ≥1
 *   subordinate-with-conversations (legacy behaviour).
 * - Each display leader renders as a top-level collapsable holding its own
 *   conversations plus a sub-collapsable per shown subordinate. With
 *   `seedRoster` every DIRECT team member is shown — a subordinate with zero
 *   conversations becomes an empty sub-collapsable rather than being hidden.
 * - Everything else (standalone agents) falls through to the existing
 *   `groupByAgentThread` so behaviour there is unchanged.
 * - Entries are ordered by activity: pinned first, then most-recent conversation
 *   (seeded leaders/teams with no conversations sort as "least recent"). With
 *   `opts.newestLast` the whole ordering is inverted so the most-recent entries
 *   sit at the BOTTOM of the list (thumb-reach in the chat drawer).
 *
 * Pure and generic over the item type; the 2-level cap follows the shared
 * contract ("la vista es de 2 niveles: usar subordinateIds").
 */
export function buildAgentConversationTree<T extends ConversationLike>(
  convos: T[],
  agentById: Map<string, AgentHierarchyLike>,
  opts?: { seedRoster?: boolean; newestLast?: boolean },
): AgentTopEntry<T>[] {
  const seedRoster = opts?.seedRoster ?? false;
  const newestLast = opts?.newestLast ?? false;

  const rank = (a: T, b: T) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  // A leader/thread's ordering key may be null (a seeded leader or team with no
  // conversations yet): non-null keys (actual activity) rank ahead of nulls.
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

  // Direct children per agent, derived from parentAgentId edges as a fallback for
  // when the server's `subordinateIds` is absent.
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
  // Deduped direct subordinates shown under a leader (never self). In roster-seed
  // mode ALL direct members are shown (a member with 0 chats becomes an empty
  // sub-collapsable); otherwise only members that actually hold conversations.
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

  // A leader nested under another display leader is attached there as a plain
  // subordinate (2-level cap); it does not also open at the top level.
  const isNestedUnderLeader = (id: string): boolean => {
    const p = agentById.get(id)?.parentAgentId;
    return !!(p && displayLeader.has(p) && displaySubs(p).includes(id));
  };
  const topLeaders = [...displayLeader].filter((id) => !isNestedUnderLeader(id));

  const nested = new Set<string>();
  for (const id of topLeaders) for (const s of displaySubs(id)) nested.add(s);
  const topLeaderSet = new Set(topLeaders);

  // Conversations still handled by plain threading: neither a top leader's own
  // nor a nested subordinate's.
  const remaining = convos.filter((c) => {
    if (!c.agentId) return true;
    return !topLeaderSet.has(c.agentId) && !nested.has(c.agentId);
  });

  // Order a leader's subordinates by a composite key:
  //   group 0 = has ≥1 unreviewed (unread) chat,
  //   group 1 = has chats but all reviewed,
  //   group 2 = no chats yet (seeded roster members);
  // within groups 0 & 1, most-recent activity first; group 2 sinks to the bottom
  // keeping its input (roster) order (stable). Same in mobile and desktop.
  const subGroup = (convos: T[]): 0 | 1 | 2 =>
    convos.length === 0 ? 2 : convos.some((c) => c.unreviewed) ? 0 : 1;

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

// ── Recursive project hierarchy for the "Sueltos / Proyectos" conversation tab ─
// Mirrors the "Agentes IA" 2-level team view but for PROJECTS, which nest to any
// depth: each root project is a top-level collapsable holding its own chats plus
// a sub-collapsable per child project (recursive); chats without a (known)
// project sit at the current level as loose rows. Empty folders (no chats in
// their whole subtree) are pruned, so the tree only surfaces projects that
// actually hold conversations — same contract as the agent tree.

/** Minimal project shape needed to resolve the recursive project hierarchy. */
export interface ProjectHierarchyLike {
  id: string;
  parentId?: string | null;
}

/**
 * The self→root chain of collapsable folder/agent ids that must be expanded to
 * REVEAL a node: the node's own id first, then each ancestor via `parentOf`
 * until the root (a null/undefined/absent parent). Cycle-safe (a node already
 * in the chain stops the walk). Generic over the parent edge, so it serves both
 * the project tree (`parentId`) and the 2-level agent tree (`parentAgentId`).
 *
 * Used to auto-expand only the branch that holds the active conversation, so the
 * lists can start fully collapsed yet still surface the chat that's open.
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

/**
 * Sentinel folder id for the synthetic "Chats sueltos" collapsable. The top-level
 * loose chats (no project) are folded into ONE folder — same chrome as a project
 * folder — that renders first, above the project folders. Shared by the chat
 * sidebar and Dashboard so the expand/collapse state key matches in both. It can
 * never collide with a real project id (those are uuids).
 */
export const LOOSE_GROUP_ID = "__loose__";

/** One entry in a project level: a nested project folder or a leaf chat row.
 *  Top-level entries interleave root folders with loose chats; a folder's inner
 *  entries interleave its child folders with its own chats — all activity-sorted. */
export type ProjectTreeEntry<T> =
  | { kind: "project"; node: ProjectTreeNode<T> }
  | { kind: "chat"; convo: T };

/** A project folder node: its activity-ordered inner entries (child folders +
 *  own chats) and the total chat count across its whole subtree (count pill). */
export interface ProjectTreeNode<T> {
  projectId: string;
  totalConvos: number;
  entries: ProjectTreeEntry<T>[];
}

export interface ProjectConversationTree<T> {
  /** Top level: root project folders + loose chats, ordered by last activity. */
  entries: ProjectTreeEntry<T>[];
}

/** Flatten every chat inside a project node's subtree (own + all descendants) —
 *  used by the folder header for its live/unreviewed/status indicators. */
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
 * Build the recursive project tree for a list of conversations.
 *
 * - A chat whose `projectId` points at a KNOWN project nests under that project
 *   (parent or child — the id is the exact folder it lives in); everything else
 *   (no `projectId`, or an orphan id) becomes a loose chat at the top level.
 * - With `includeEmpty` (the sidebar/Dashboard default), EVERY known project is
 *   surfaced as a folder even with zero chats in its subtree, so the whole
 *   project structure is always browsable (empty folders show a 0 count and
 *   sink below their populated siblings). Without it, empty folders/branches are
 *   pruned (legacy "only show folders that hold conversations").
 * - Folders and chats are ordered by activity: pinned first, then most-recent;
 *   empty folders (no datable chat) sort last, keeping their input order.
 * - Cycle-safe (a project cannot be its own ancestor via `parentId`).
 *
 * Pure and generic over the item type; shared by the chat sidebar and Dashboard.
 */
export function buildProjectConversationTree<T extends ConversationLike>(
  convos: T[],
  projects: ProjectHierarchyLike[],
  opts?: { includeEmpty?: boolean },
): ProjectConversationTree<T> {
  const includeEmpty = opts?.includeEmpty ?? false;
  const rank = (a: T, b: T) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  // Ordering key may be null for an empty folder (no datable chat): nulls sort
  // last while preserving their relative (input) order.
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

  // Build a folder node. `best` is the top-ranked chat in the subtree (null when
  // the subtree holds none), used to order this folder among siblings. Returns
  // null only when the subtree is empty AND empty folders are being pruned.
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

/**
 * ACCORDION toggle for a collapsable tree level: opening `id` closes every
 * OTHER node of the same level (`siblings` — the renderer passes the ids that
 * share the row with `id`; when omitted only `id` is toggled). Closing `id`
 * just removes it. Descendants of a sibling that gets closed stay in the set:
 * they're hidden while the sibling is collapsed and reappear as the user left
 * them when it is reopened (each level stays accordion-consistent on its own).
 * Pure: returns a NEW set, never mutates `prev`.
 */
export function accordionToggle(
  prev: ReadonlySet<string>,
  id: string,
  siblings?: Iterable<string>,
): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  if (siblings) for (const s of siblings) if (s !== id) next.delete(s);
  next.add(id);
  return next;
}

/**
 * ACCORDION reveal of a whole ancestor chain (see `computeExpandChain`): every
 * node of the chain is opened and, at each level, its siblings (`siblingsOf`)
 * are closed — so auto-expanding the branch that holds the active chat never
 * leaves two folders of the same level open. Pure.
 */
export function revealChainAccordion(
  prev: ReadonlySet<string>,
  chain: readonly string[],
  siblingsOf: (id: string) => Iterable<string>,
): Set<string> {
  const next = new Set(prev);
  for (const id of chain) {
    for (const s of siblingsOf(id)) if (s !== id) next.delete(s);
    next.add(id);
  }
  return next;
}
