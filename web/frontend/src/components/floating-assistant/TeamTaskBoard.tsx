// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TeamTaskBoard — live progress cards for the tasks a LEADER agent delegated
 * to its subordinates (`team.assign`). Rendered inside the leader's chat under
 * the conversation turns whenever the chat has delegated tasks.
 *
 * State comes from the chat engine (`chat.teamTasks`): updated live via the
 * injected `team_task_update` SSE events and rehydrated from
 * `GET /api/ai/team/tasks` when the conversation is (re)opened. The optional
 * plan checklist (team.plan) is lazily fetched here when any task references a
 * planId.
 *
 * Equipos v2 additions: per-task cost chips (tokens + duration from
 * /team/summary), verify badges, diff viewer (worktree artifacts), queued
 * status, cancel-all, manual task assignment, 👍/👎 feedback and a live
 * status-coloured org chart of the leader's subtree.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  assistantAgentsApi,
  assistantProjectsApi,
  teamApi,
  type AssistantAgent,
  type AssistantProject,
  type TeamPlan,
  type TeamSummary,
  type TeamTaskDiff,
  type TeamTaskRating,
  type TeamTaskView,
} from "./assistant-api";
import { buildAgentTree, type AgentNodeClass } from "./agent-tree";
import { AgentAvatar } from "./AgentAvatar";
import { MermaidDiagram } from "./MermaidDiagram";
import { chatEngine } from "./chat-engine";
import { ModalShell } from "@/components/ui/ModalShell";
import { openConfirm } from "@/lib/confirm";
import { useAssistantI18n, formatAssistantMessage } from "./i18n";
import { fmtTokens as fmtTokensShared, fmtDuration as fmtDurationShared } from "@/lib/format";

// Board flavor of the shared formatters (F-20): always one decimal, and the
// sub-second literal comes from i18n instead of the hardcoded "<1s".
const fmtTokens = (n: number): string => fmtTokensShared(n, { decimals: 1 });
const fmtDuration = (ms: number, t: TeamBoardMessages): string =>
  fmtDurationShared(ms, { lessThanSecond: t.lessThan1s });

type TeamBoardMessages = ReturnType<typeof useAssistantI18n>["teamBoard"];

function statusChip(task: TeamTaskView, t: TeamBoardMessages): { label: string; className: string; spin?: boolean } {
  if (task.status === "running" && task.pendingPermission) {
    return { label: t.pendingPermission, className: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
  }
  switch (task.status) {
    case "pending":
      // Deferred by quota/lease → soft amber "queued" chip.
      return { label: t.statusQueued, className: "bg-amber-500/10 text-amber-500/90 border-amber-500/20" };
    case "running":
      return { label: t.statusRunning, className: "bg-blue-500/15 text-blue-500 border-blue-500/30", spin: true };
    case "done":
      return { label: t.statusDone, className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    case "failed":
      return { label: t.statusFailed, className: "bg-red-500/15 text-red-500 border-red-500/30" };
    case "canceled":
      return { label: t.statusCanceled, className: "bg-muted text-muted-foreground border-border" };
  }
}

const TERMINAL = new Set(["done", "failed", "canceled"]);

/** Diff line colour by prefix (+ green, − red, @@ cyan). */
function diffLineClass(line: string): string {
  if (line.startsWith("+")) return "text-emerald-500";
  if (line.startsWith("-")) return "text-red-500";
  if (line.startsWith("@@")) return "text-cyan-500";
  return "text-muted-foreground";
}

export function TeamTaskBoard({
  conversationId,
  tasks,
  onOpenChat,
  leaderAgentId,
  onOpenFile,
  agentById,
  embedded = false,
}: {
  conversationId: string;
  tasks: TeamTaskView[];
  /** Open a worker's chat (ChatTab switches the visible conversation). */
  onOpenChat: (workerConversationId: string) => void;
  /** Agent id of the leader conversation — enables "+ Añadir tarea" and the
   *  live org chart (both need the hierarchy rooted at the leader). */
  leaderAgentId?: string;
  /** Optional: open a changed file in the panel's file editor. */
  onOpenFile?: (path: string) => void;
  /** Roster (agent id → agent) so each task card shows the ASSIGNEE's avatar
   *  instead of a generic robot icon. Falls back to the robot when unresolved. */
  agentById?: Map<string, AssistantAgent>;
  /** Render as a section inside the assistant message card. */
  embedded?: boolean;
}) {
  const t = useAssistantI18n().teamBoard;
  const taskListId = useId();
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const tasksExpanded = expandedFor === conversationId;
  const visibleTasks = tasksExpanded ? tasks : tasks.slice(0, 3);
  const [plan, setPlan] = useState<TeamPlan | null>(null);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancellingAll, setCancellingAll] = useState(false);

  // 👍/👎 feedback per task (rehydrated from the backend on mount).
  const [feedback, setFeedback] = useState<Record<string, TeamTaskRating>>({});
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);

  // Diff modal state (worktree artifacts).
  const [diffTask, setDiffTask] = useState<TeamTaskView | null>(null);
  const [diffData, setDiffData] = useState<TeamTaskDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffUnavailable, setDiffUnavailable] = useState<Set<string>>(new Set());

  // Lazy agent/project catalogs (assign modal + org chart).
  const [agents, setAgents] = useState<AssistantAgent[] | null>(null);
  const [projects, setProjects] = useState<AssistantProject[] | null>(null);

  // "+ Añadir tarea" modal.
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assignTaskText, setAssignTaskText] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignProjectId, setAssignProjectId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Live org chart toggle.
  const [orgOpen, setOrgOpen] = useState(false);

  const planId = tasks.find((x) => x.planId)?.planId ?? null;
  const terminalCount = tasks.filter((x) => TERMINAL.has(x.status)).length;
  const nonTerminalCount = tasks.length - terminalCount;

  // Cost data: fetch as soon as ANY task settled (per-row chips need the
  // per-task tokens/duration), refresh as more settle.
  useEffect(() => {
    if (terminalCount === 0) {
      setSummary(null);
      return;
    }
    let alive = true;
    teamApi
      .getSummary(conversationId)
      .then((s) => {
        if (alive) setSummary(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [terminalCount, conversationId]);

  // Rehydrate recorded feedback for this conversation's tasks.
  useEffect(() => {
    let alive = true;
    teamApi
      .listFeedback(conversationId)
      .then((rows) => {
        if (!alive) return;
        const map: Record<string, TeamTaskRating> = {};
        for (const r of rows) map[r.taskId] = r.rating;
        setFeedback(map);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [conversationId]);

  // Lazy plan fetch — refreshed whenever a task settles (checklist advances
  // server-side on each close).
  useEffect(() => {
    if (!planId) {
      setPlan(null);
      return;
    }
    let alive = true;
    teamApi
      .getPlan(conversationId)
      .then((p) => {
        if (alive) setPlan(p);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [planId, conversationId, terminalCount]);

  // Lazy agents fetch — needed by the assign modal and the org chart.
  const needAgents = (assignOpen || orgOpen) && Boolean(leaderAgentId);
  useEffect(() => {
    if (!needAgents || agents !== null) return;
    let alive = true;
    assistantAgentsApi
      .list()
      .then((list) => {
        if (alive) setAgents(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [needAgents, agents]);

  // Lazy projects fetch — resolve titles of the chosen worker's projectIds.
  useEffect(() => {
    if (!assignOpen || projects !== null) return;
    let alive = true;
    assistantProjectsApi
      .list()
      .then((list) => {
        if (alive) setProjects(list);
      })
      .catch(() => {
        if (alive) setProjects([]);
      });
    return () => {
      alive = false;
    };
  }, [assignOpen, projects]);

  const subordinates = useMemo(
    () => (agents && leaderAgentId ? agents.filter((a) => a.parentAgentId === leaderAgentId) : []),
    [agents, leaderAgentId],
  );
  const assignWorker = subordinates.find((a) => a.id === assignWorkerId) ?? null;
  const workerProjects = useMemo(() => {
    if (!assignWorker?.projectIds?.length) return [];
    const byId = new Map((projects ?? []).map((p) => [p.id, p] as const));
    return assignWorker.projectIds.map((id) => ({ id, title: byId.get(id)?.title ?? id }));
  }, [assignWorker, projects]);

  // Live org chart: the leader's subtree, coloured by each worker's task state.
  // Priority: pendingPermission > running > failed > done > canceled.
  const orgCode = useMemo(() => {
    if (!orgOpen || !leaderAgentId || !agents) return null;
    const byParent = new Map<string, AssistantAgent[]>();
    for (const a of agents) {
      if (!a.parentAgentId) continue;
      const arr = byParent.get(a.parentAgentId) ?? [];
      arr.push(a);
      byParent.set(a.parentAgentId, arr);
    }
    const subtree: AssistantAgent[] = [];
    const seen = new Set<string>();
    const root = agents.find((a) => a.id === leaderAgentId);
    const stack = root ? [root] : [];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur.id)) continue;
      seen.add(cur.id);
      subtree.push(cur);
      for (const ch of byParent.get(cur.id) ?? []) stack.push(ch);
    }
    if (subtree.length === 0) return null;
    const RANK: Record<AgentNodeClass, number> = { waiting: 4, running: 3, failed: 2, done: 1 };
    const nodeClasses: Record<string, AgentNodeClass> = {};
    for (const task of tasks) {
      let cls: AgentNodeClass | null = null;
      if (task.status === "running" && task.pendingPermission) cls = "waiting";
      else if (task.status === "running" || task.status === "pending") cls = "running";
      else if (task.status === "failed") cls = "failed";
      else if (task.status === "done") cls = "done";
      // canceled → no colour
      if (!cls) continue;
      const prev = nodeClasses[task.workerAgentId];
      if (!prev || RANK[cls] > RANK[prev]) nodeClasses[task.workerAgentId] = cls;
    }
    return buildAgentTree(subtree, { nodeClasses });
  }, [orgOpen, leaderAgentId, agents, tasks]);

  if (tasks.length === 0) return null;
  const done = tasks.filter((x) => x.status === "done").length;

  const cancelTask = async (taskId: string) => {
    if (cancelling) return;
    if (!(await openConfirm(t.cancelConfirm, { variant: "danger" }))) return;
    setCancelling(taskId);
    try {
      await teamApi.cancelTask(taskId);
      await chatEngine.refreshTeamTasks(conversationId);
    } catch {
      /* board keeps its state; next refresh corrects it */
    } finally {
      setCancelling(null);
    }
  };

  const cancelAll = async () => {
    if (cancellingAll) return;
    if (!(await openConfirm(t.cancelAllConfirm, { variant: "danger" }))) return;
    setCancellingAll(true);
    try {
      // Cancel only THIS board's live tasks (a leader chat can render several
      // boards, one per delegating turn — the conversation-wide `cancelAllTasks`
      // would reach into sibling turns' boards).
      const live = tasks.filter((x) => !TERMINAL.has(x.status));
      await Promise.all(live.map((x) => teamApi.cancelTask(x.id)));
      await chatEngine.refreshTeamTasks(conversationId);
    } catch {
      /* board keeps its state; next refresh corrects it */
    } finally {
      setCancellingAll(false);
    }
  };

  const rate = async (task: TeamTaskView, rating: TeamTaskRating) => {
    if (feedbackBusy) return;
    const prev = feedback[task.id];
    setFeedbackBusy(task.id);
    setFeedback((f) => ({ ...f, [task.id]: rating }));
    try {
      await teamApi.sendTaskFeedback(task.id, rating);
    } catch {
      // Rollback the optimistic vote.
      setFeedback((f) => {
        const next = { ...f };
        if (prev) next[task.id] = prev;
        else delete next[task.id];
        return next;
      });
    } finally {
      setFeedbackBusy(null);
    }
  };

  const openDiff = async (task: TeamTaskView) => {
    setDiffTask(task);
    setDiffData(null);
    setDiffLoading(true);
    try {
      const d = await teamApi.getTaskDiff(task.id);
      if (d) {
        setDiffData(d);
      } else {
        // 404: no worktree / no changes → hide the button from now on.
        setDiffUnavailable((s) => new Set(s).add(task.id));
      }
    } finally {
      setDiffLoading(false);
    }
  };

  const submitAssign = async () => {
    if (assignBusy || !assignWorkerId || !assignTaskText.trim()) return;
    setAssignBusy(true);
    setAssignError(null);
    try {
      await teamApi.assignTask({
        conversationId,
        agentId: assignWorkerId,
        task: assignTaskText.trim(),
        ...(assignTitle.trim() ? { title: assignTitle.trim() } : {}),
        ...(assignProjectId ? { projectId: assignProjectId } : {}),
      });
      setAssignOpen(false);
      setAssignWorkerId("");
      setAssignTaskText("");
      setAssignTitle("");
      setAssignProjectId("");
      await chatEngine.refreshTeamTasks(conversationId);
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setAssignBusy(false);
    }
  };

  return (
    <section className={embedded ? "min-w-0 bg-background/10 p-3" : "mx-1 my-2 rounded-xl border border-border bg-card/40 p-3"} data-testid="team-task-board">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <i className="ti ti-users-group text-sm text-primary" aria-hidden />
          {plan?.title ?? t.title}
        </span>
        <span className="flex items-center gap-1.5">
          {leaderAgentId && (
            <button
              type="button"
              onClick={() => setOrgOpen((v) => !v)}
              title={t.orgChart}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
                orgOpen
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <i className="ti ti-hierarchy-2 text-[11px]" aria-hidden />
              {t.orgChart}
            </button>
          )}
          {leaderAgentId && (
            <button
              type="button"
              onClick={() => { setAssignError(null); setAssignOpen(true); }}
              title={t.addTaskTitle}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <i className="ti ti-plus text-[11px]" aria-hidden />
              {t.addTask}
            </button>
          )}
          {nonTerminalCount >= 2 && (
            <button
              type="button"
              onClick={() => void cancelAll()}
              disabled={cancellingAll}
              title={t.cancelAllConfirm}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-1.5 py-0.5 text-[10px] text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              <i className={`ti ${cancellingAll ? "ti-loader-2 animate-spin" : "ti-x"} text-[11px]`} aria-hidden />
              {t.cancelAll}
            </button>
          )}
          <span className="text-[11px] text-muted-foreground">
            {formatAssistantMessage(t.progressOf, { done, total: tasks.length })}
          </span>
        </span>
      </header>

      {/* Aggregated progress bar */}
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${tasks.length > 0 ? Math.round((terminalCount / tasks.length) * 100) : 0}%` }}
        />
      </div>

      {/* Live org chart of the leader's subtree, coloured by task state. */}
      {orgOpen && (
        <div className="mb-2 h-64 overflow-hidden rounded-lg border border-border bg-background">
          {orgCode ? (
            <MermaidDiagram code={orgCode} />
          ) : (
            <p className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
              <i className="ti ti-loader-2 mr-1 animate-spin" aria-hidden /> {t.loading}
            </p>
          )}
        </div>
      )}

      {/* Plan checklist (when the leader registered one with team.plan) */}
      {plan && plan.steps.length > 0 && (
        <ul className="mb-2 space-y-0.5">
          {plan.steps.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <i
                className={`ti ${
                  s.status === "done"
                    ? "ti-circle-check text-emerald-500"
                    : s.status === "failed"
                      ? "ti-circle-x text-red-500"
                      : s.status === "assigned"
                        ? "ti-progress text-blue-500"
                        : "ti-circle-dashed"
                } text-xs`}
                aria-hidden
              />
              <span className={s.status === "done" ? "line-through opacity-70" : ""}>{s.title}</span>
            </li>
          ))}
        </ul>
      )}

      <ul id={taskListId} className="space-y-1.5">
        {visibleTasks.map((task) => {
          const chip = statusChip(task, t);
          const isTerminal = TERMINAL.has(task.status);
          const st = isTerminal ? summary?.tasks.find((x) => x.taskId === task.id) : undefined;
          const verify = task.verify;
          const files = task.artifacts?.filesChangedTotal ?? 0;
          const vote = feedback[task.id];
          return (
            <li
              key={task.id}
              data-team-task-id={task.id}
              className="rounded-lg border border-border/60 bg-background/60 px-2 py-1.5"
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const assignee = agentById?.get(task.workerAgentId) ?? null;
                  return assignee ? (
                    <AgentAvatar agent={assignee} size={20} className="shrink-0" />
                  ) : (
                    <i className="ti ti-robot shrink-0 text-sm text-muted-foreground" aria-hidden />
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground" title={task.title}>
                    {task.title}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {formatAssistantMessage(t.assignedTo, { agent: task.workerAgentName })}
                    {task.error && task.status === "failed" ? ` · ${task.error}` : ""}
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${chip.className}`}
                >
                  {chip.spin && <i className="ti ti-loader-2 animate-spin text-[10px]" aria-hidden />}
                  {chip.label}
                </span>
                {isTerminal && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => void rate(task, "up")}
                      disabled={feedbackBusy === task.id}
                      title={t.feedbackUp}
                      aria-label={t.feedbackUp}
                      className={`rounded-md p-1 transition-colors disabled:opacity-50 ${
                        vote === "up"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <i className={`ti ${vote === "up" ? "ti-thumb-up-filled" : "ti-thumb-up"} text-sm`} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void rate(task, "down")}
                      disabled={feedbackBusy === task.id}
                      title={t.feedbackDown}
                      aria-label={t.feedbackDown}
                      className={`rounded-md p-1 transition-colors disabled:opacity-50 ${
                        vote === "down"
                          ? "bg-red-500/15 text-red-500"
                          : "text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <i className={`ti ${vote === "down" ? "ti-thumb-down-filled" : "ti-thumb-down"} text-sm`} aria-hidden />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenChat(task.workerConversationId)}
                  title={t.openChat}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <i className="ti ti-message-circle text-sm" aria-hidden />
                  <span>{t.openChat}</span>
                </button>
                {!isTerminal && (
                  <button
                    type="button"
                    onClick={() => void cancelTask(task.id)}
                    disabled={cancelling === task.id}
                    title={t.cancel}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                  >
                    <i className={`ti ${cancelling === task.id ? "ti-loader-2 animate-spin" : "ti-x"} text-sm`} aria-hidden />
                  </button>
                )}
              </div>

              {/* Meta row: verify badge, cost chips, artifacts + branch. */}
              {(verify && verify.state !== "skipped") || st || files > 0 || task.isolation?.branch ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-6 text-[10px]">
                  {verify?.state === "running" && (
                    <span
                      title={verify.state}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-blue-500"
                    >
                      <i className="ti ti-loader-2 animate-spin text-[10px]" aria-hidden />
                      {t.verifyRunning}
                    </span>
                  )}
                  {verify?.state === "passed" && (
                    <span
                      title={verify.state}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-500"
                    >
                      <i className="ti ti-shield-check text-[10px]" aria-hidden />
                      {t.verifyPassed}
                    </span>
                  )}
                  {verify?.state === "failed" && (
                    <span
                      title={verify.state}
                      className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-red-500"
                    >
                      <i className="ti ti-shield-x text-[10px]" aria-hidden />
                      {formatAssistantMessage(t.verifyFailed, { attempts: verify.attempts })}
                    </span>
                  )}
                  {st && st.tokens.totalTokens > 0 && (
                    <span
                      title={t.tokensChipTitle}
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-muted-foreground"
                    >
                      <i className="ti ti-coins text-[10px]" aria-hidden />
                      {st.tokens.estimated ? "≈" : ""}
                      {fmtTokens(st.tokens.totalTokens)}
                    </span>
                  )}
                  {st && st.durationMs != null && st.durationMs > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                      <i className="ti ti-clock text-[10px]" aria-hidden />
                      {fmtDuration(st.durationMs, t)}
                    </span>
                  )}
                  {files > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                      <i className="ti ti-file-diff text-[10px]" aria-hidden />
                      {formatAssistantMessage(t.filesChanged, { count: files })}
                      <span className="text-emerald-500">{formatAssistantMessage(t.insertions, { count: task.artifacts?.insertions ?? 0 })}</span>
                      <span className="text-red-500">{formatAssistantMessage(t.deletions, { count: task.artifacts?.deletions ?? 0 })}</span>
                    </span>
                  )}
                  {files > 0 && !diffUnavailable.has(task.id) && (
                    <button
                      type="button"
                      onClick={() => void openDiff(task)}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <i className="ti ti-git-compare text-[10px]" aria-hidden />
                      {t.viewDiff}
                    </button>
                  )}
                  {task.isolation?.branch && (
                    <span
                      title={task.isolation.integrated ? t.branchIntegrated : task.isolation.branch}
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono ${
                        task.isolation.integrated
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                          : "border-border/60 bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <i className="ti ti-git-branch text-[10px]" aria-hidden />
                      {task.isolation.branch}
                      {task.isolation.integrated && <i className="ti ti-check text-[10px]" aria-hidden />}
                    </span>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {tasks.length > 3 && (
        <button
          type="button"
          data-team-tasks-toggle
          aria-expanded={tasksExpanded}
          aria-controls={taskListId}
          onClick={() => setExpandedFor(tasksExpanded ? null : conversationId)}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-3 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-accent active:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{tasksExpanded ? t.showFewerTasks : formatAssistantMessage(t.showMoreTasks, { count: tasks.length - 3 })}</span>
          <ChevronDown aria-hidden className={`size-4 transition-transform duration-200 ${tasksExpanded ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* Cost footer: tokens spent by the leader + the whole team (shown as
          soon as any task settled; feeds off GET /api/ai/team/summary). */}
      {summary && summary.total.totalTokens > 0 && (
        <footer className="mt-2 flex items-center gap-1.5 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
          <i className="ti ti-coins text-[11px]" aria-hidden />
          <span>
            {formatAssistantMessage(t.tokensSummary, {
              total: fmtTokens(summary.total.totalTokens),
              leader: fmtTokens(summary.leader.totalTokens),
              workers: fmtTokens(summary.total.totalTokens - summary.leader.totalTokens),
            })}
            {summary.total.estimated ? " ≈" : ""}
          </span>
        </footer>
      )}

      {/* Diff modal (worktree artifacts) */}
      {diffTask && (
        <ModalShell
          onClose={() => setDiffTask(null)}
          title={`${t.diffTitle} · ${diffTask.title}`}
          description={diffTask.title}
          closeLabel={t.close}
          headerActions={
            diffData?.branch && (
              <span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                <i className="ti ti-git-branch" aria-hidden /> {diffData.branch}
              </span>
            )
          }
          bodyClassName="p-3"
        >
              {diffLoading && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <i className="ti ti-loader-2 animate-spin" aria-hidden /> {t.loading}
                </p>
              )}
              {!diffLoading && !diffData && (
                <p className="text-xs text-muted-foreground">{t.diffUnavailable}</p>
              )}
              {!diffLoading && diffData && (
                <>
                  {diffData.filesChanged.length > 0 && (
                    <ul className="mb-2 space-y-0.5 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-[11px]">
                      {diffData.filesChanged.map((f) => (
                        <li key={f.path} className="flex items-center gap-2">
                          {onOpenFile ? (
                            <button
                              type="button"
                              onClick={() => onOpenFile(f.path)}
                              className="min-w-0 flex-1 truncate text-left font-mono text-foreground hover:text-primary hover:underline"
                              title={f.path}
                            >
                              {f.path}
                            </button>
                          ) : (
                            <span className="min-w-0 flex-1 truncate font-mono text-foreground" title={f.path}>
                              {f.path}
                            </span>
                          )}
                          <span className="shrink-0 text-emerald-500">{formatAssistantMessage(t.insertions, { count: f.insertions })}</span>
                          <span className="shrink-0 text-red-500">{formatAssistantMessage(t.deletions, { count: f.deletions })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <pre className="overflow-x-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-snug">
                    {diffData.diff.split("\n").map((line, i) => (
                      <div key={i} className={`whitespace-pre ${diffLineClass(line)}`}>
                        {line || " "}
                      </div>
                    ))}
                  </pre>
                  {diffData.truncated && (
                    <p className="mt-1 text-[10px] text-amber-500">{t.diffTruncated}</p>
                  )}
                </>
              )}
        </ModalShell>
      )}

      {/* "+ Añadir tarea" modal (manual assignment to a subordinate). */}
      {assignOpen && (
        <ModalShell
          onClose={() => !assignBusy && setAssignOpen(false)}
          title={t.addTaskTitle}
          closeLabel={t.close}
          bodyClassName="flex flex-col gap-3 p-5"
        >
            {agents === null ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <i className="ti ti-loader-2 animate-spin" aria-hidden /> {t.loading}
              </p>
            ) : subordinates.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.addTaskNoWorkers}</p>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-foreground">{t.addTaskWorker}</span>
                  <select
                    value={assignWorkerId}
                    onChange={(e) => { setAssignWorkerId(e.target.value); setAssignProjectId(""); }}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">{t.addTaskWorkerPlaceholder}</option>
                    {subordinates.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-foreground">{t.addTaskInstruction}</span>
                  <textarea
                    value={assignTaskText}
                    onChange={(e) => setAssignTaskText(e.target.value)}
                    rows={5}
                    placeholder={t.addTaskInstructionHint}
                    className="resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm leading-snug focus:border-primary focus:outline-none"
                  />
                  <span className="text-[10px] text-muted-foreground/70">{t.addTaskInstructionHint}</span>
                </label>

                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-foreground">{t.addTaskTitleField}</span>
                  <input
                    type="text"
                    value={assignTitle}
                    maxLength={120}
                    onChange={(e) => setAssignTitle(e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                </label>

                {workerProjects.length > 0 && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-foreground">{t.addTaskProject}</span>
                    <select
                      value={assignProjectId}
                      onChange={(e) => setAssignProjectId(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    >
                      <option value="">{t.addTaskProjectNone}</option>
                      {workerProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}

            {assignError && <p className="text-xs text-red-500">{assignError}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                disabled={assignBusy}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                {t.close}
              </button>
              {subordinates.length > 0 && (
                <button
                  type="button"
                  onClick={() => void submitAssign()}
                  disabled={assignBusy || !assignWorkerId || !assignTaskText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {assignBusy && <i className="ti ti-loader-2 animate-spin" aria-hidden />}
                  {assignBusy ? t.addTaskSubmitting : t.addTaskSubmit}
                </button>
              )}
            </div>
        </ModalShell>
      )}
    </section>
  );
}
