// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat engine facade. The engine's state, streaming, queueing, history and
 * background-polling logic is split by responsibility under ./chat-engine/*;
 * this file re-exports the public surface (the interfaces + `chatEngine` +
 * `historyTurn`/`historyTurns`) so consumers keep importing from
 * `@/components/floating-assistant/chat-engine` unchanged.
 */
import type { AgentMessage, ChatAttachment, TeamTaskView } from "./assistant-api";
import { historyTurns } from "./chat-engine/history";
import { resolveTargetScope } from "@/lib/api-client";
import { chatInputLocked } from "./chat-engine/input-lock";
import {
  stopAgent, cancelAgentQueue, sendPermissionDecision, getAgentQueueItem,
  assistantConversationsApi, streamAgentResume, teamApi, listActiveRuns, snapshotToTaskView,
} from "./assistant-api";
import type { ChatTurn, LiveChat, Listener } from "./chat-engine/types";
import {
  chats, pendingAddenda, queues, serverQueued, adopting, backgroundActive,
  unreviewedBackground, backgroundPending, backgroundWorkerRunning, listeners, version,
  isLocallyStreaming, isActivelyViewing, runningWorkerIdSet, emit,
  setActiveViewKey, clearActiveViewKey,
} from "./chat-engine/state";
import {
  finalizeTurn, applyEvent, handleStreamThrow, lastTurnInterrupted, lastTurnStopped,
  clearInterruptedFlag, reloadHistory,
} from "./chat-engine/stream-apply";
import {
  dispatchSend, sendAddendum, enqueueSend, enqueueServerTurn, refreshServerQueue,
  followServerChain, onCleanSettle, removeQueuedAt, scheduleResume, resetResumeAttempts,
} from "./chat-engine/send";
import { startBackgroundPoll, stopBackgroundPoll } from "./chat-engine/resume-poll";

export type { CliLane, ToolTrace, TurnAttachment, ChatTurn, LiveChat } from "./chat-engine/types";
export { historyTurn, historyTurns } from "./chat-engine/history";
let backgroundRefreshTask: Promise<void> | null = null;

export const chatEngine = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    // First subscriber (assistant drawer opened) → start polling the backend
    // for background runs so the Dashboard/chat list stay current. Stops when
    // the last subscriber leaves (drawer closed) to avoid idle polling.
    if (listeners.size === 1) startBackgroundPoll();
    return () => {
      listeners.delete(fn);
      if (listeners.size === 0) stopBackgroundPoll();
    };
  },

  /** Monotonic version — used as the useSyncExternalStore snapshot. */
  getVersion(): number {
    return version;
  },

  get(key: string): LiveChat | undefined {
    return chats.get(key);
  },

  /** Snapshot of every live chat the engine currently holds (Dashboard feed). */
  entries(): Array<{ key: string; chat: LiveChat }> {
    return Array.from(chats.entries()).map(([key, chat]) => ({ key, chat }));
  },

  /**
   * True when the conversation has a live run on the BACKEND that this client
   * isn't streaming locally (i.e. discovered via `refreshBackgroundRuns` after
   * a reload, not yet adopted). Lets the chat list show "en curso" without a
   * local stream. A locally-streaming chat already reflects via `isStreaming`,
   * so we exclude those to avoid a double indicator.
   */
  isBackgroundRunning(key: string): boolean {
    if (!backgroundActive.has(key)) return false;
    return !isLocallyStreaming(key);
  },

  /** conversationIds the backend reports as running but not streamed locally. */
  backgroundOnly(): string[] {
    return [...backgroundActive.keys()].filter((id) => !isLocallyStreaming(id));
  },

  /** True when ANY chat has a finished-but-unseen result (the red "sin revisar"
   *  state) — used to light the Dashboard tab button. Excludes the chat the user
   *  is actively viewing (its flag is never set / is cleared on settle). */
  hasUnreviewed(): boolean {
    if (unreviewedBackground.size > 0) return true;
    for (const c of chats.values()) if (c.unreviewed) return true;
    return false;
  },

  /** True when the conversation `key` is waiting on the user to approve a tool —
   *  either reported by the active-runs feed (works off-screen / after reload) or
   *  reflected locally by a live turn still showing a permission prompt. Drives
   *  the yellow "needs your approval" dot in the chat list + Dashboard. */
  hasPendingPermission(key: string): boolean {
    const c = chats.get(key);
    const local = !!c?.turns.some((t) => t.role === "assistant" && t.pending && !!t.permission);
    return c?.streaming ? local : local || backgroundPending.has(key);
  },

  isUnreviewed(key: string, persisted = false): boolean {
    if (isActivelyViewing(key)) return false;
    return unreviewedBackground.has(key) || (chats.get(key)?.unreviewed ?? persisted);
  },

  /** True when ANY chat is waiting on an approval — used to light the Chat/
   *  Dashboard tab buttons so the user notices from anywhere in the panel. */
  hasAnyPendingPermission(): boolean {
    return [...new Set([...backgroundPending, ...chats.keys()])].some(key => chatEngine.hasPendingPermission(key));
  },

  /**
   * The ACTUAL CLI flag of a background run for `id`, as reported by the
   * active-runs feed (`refreshBackgroundRuns`), or `undefined` when the backend
   * reports no live run for it. A reopen must adopt with the run's real mode —
   * the pane's own `mode` can differ from how the run was launched, and an
   * `isCli` mismatch routes the streamed text to the wrong place (the live CLI
   * terminal stays empty). Callers fall back to the persisted message `cli` flag
   * and finally the pane mode.
   */
  backgroundCli(id: string): boolean | undefined {
    return backgroundActive.get(id)?.cli;
  },

  /** True when `conversationId` is the assignee of a delegated task the leader
   *  reports as still running (`status === "running"`) — i.e. this SUBAGENT chat
   *  is actively working. Drives the "en curso" spinner on the chat-list row.
   *  Reads the memoised worker set, so it's cheap to call once per row. */
  isWorkerTaskRunning(conversationId: string): boolean {
    if (!conversationId) return false;
    // Two sources, unioned: the in-memory leader boards (`runningWorkerIdSet`,
    // authoritative while a leader chat is held/streaming) and the global
    // active-tasks mirror (`backgroundWorkerRunning`, survives a reload when no
    // board is in memory). Either one true → the subagent is working.
    return runningWorkerIdSet().has(conversationId) || backgroundWorkerRunning.has(conversationId);
  },

  /** Delegated-team tasks of a chat (leader conversations), oldest first. */
  teamTasksOf(key: string): TeamTaskView[] {
    const map = chats.get(key)?.teamTasks;
    if (!map) return [];
    return Object.values(map).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  },

  /**
   * Rehydrate the team task board of a conversation from the server. Reads the
   * PERSISTED conversation snapshot (`GET /api/ai/conversations/:id/team-tasks`)
   * so the "Equipo trabajando" block survives a reload even after the in-memory
   * run buffer GC'd (injected `team_task_update` events only replay while the
   * run is retained). Fire-and-forget from ChatPane when a conversation is
   * opened; merges by id preserving live-only fields (verify/isolation/
   * artifacts), so a live event never regresses to the leaner snapshot.
   * No-op (keeps the board empty) for conversations without delegated tasks.
   */
  async refreshTeamTasks(key: string): Promise<void> {
    const chat = chats.get(key);
    const conversationId = chat?.conversationId ?? (key.startsWith("new:") ? null : key);
    if (!conversationId) return;
    let tasks: TeamTaskView[] = [];
    try {
      const snapshot = await teamApi.getConversationSnapshot(conversationId);
      if (snapshot) tasks = snapshot.tasks.map(snapshotToTaskView);
    } catch {
      return; // fail-open: cards just stay as-is
    }
    const current = chats.get(key);
    if (!current) {
      if (tasks.length === 0) return;
      // Chat not held locally (yet) — nothing to attach the board to.
      return;
    }
    if (tasks.length === 0 && !current.teamTasks) return;
    const merged: Record<string, TeamTaskView> = { ...(current.teamTasks ?? {}) };
    // Preserve richer live-only fields already present (verify/isolation/
    // artifacts arrive via `team_task_update`; the persisted snapshot is leaner).
    for (const task of tasks) {
      const prev = merged[task.id];
      merged[task.id] = prev ? { ...prev, ...task } : task;
    }
    chats.set(key, { ...current, teamTasks: merged });
    emit();
  },

  /**
   * Refresh the mirror of backend background runs. Called on drawer open, on
   * return to foreground, and on a light poll while the drawer is open. Emits
   * only when the active set actually changed, so subscribers (Dashboard, chat
   * list) repaint the "en curso" markers without churn.
   */
  async refreshBackgroundRuns(): Promise<void> {
    if (backgroundRefreshTask) return backgroundRefreshTask;
    const task = (async () => {
    const localAtStart = new Map(chats);
    // Fetch the active-runs feed and the global delegated-task feed CONCURRENTLY;
    // either can fail transiently without dropping the other's last-known state.
    const [runsRes, tasksRes] = await Promise.allSettled([listActiveRuns(), teamApi.listActive()]);
    let changed = false;

    if (runsRes.status === "fulfilled") {
      const runs = runsRes.value;
      const next = new Map<string, { provider: string | null; cli: boolean }>();
      const nextPending = new Set<string>();
      for (const r of runs) {
        next.set(r.id, { provider: r.provider, cli: r.cli });
        if (r.pendingPermission) nextPending.add(r.id);
      }
      // A stream/stop may have settled while this request was in flight.
      // Preserve those newer local decisions until the next fresh snapshot.
      for (const [id, current] of chats) {
        if (localAtStart.get(id) === current) continue;
        next.delete(id); nextPending.delete(id);
        const known = backgroundActive.get(id);
        if (known) next.set(id, known);
        if (backgroundPending.has(id)) nextPending.add(id);
      }

      if (next.size !== backgroundActive.size) changed = true;
      if (!changed) {
        for (const k of next.keys()) if (!backgroundActive.has(k)) { changed = true; break; }
      }
      // Pending-permission set changed → repaint the yellow dots.
      if (!changed && nextPending.size !== backgroundPending.size) changed = true;
      if (!changed) {
        for (const k of nextPending) if (!backgroundPending.has(k)) { changed = true; break; }
      }
      // A run that WAS active and is no longer in the feed finished off-screen.
      // Flag its conversation "sin revisar" (unless the user is on it right now)
      // so the Dashboard tab button lights up even for background-only runs the
      // engine never streamed locally (e.g. rediscovered after a WebView reload).
      for (const id of backgroundActive.keys()) {
        if (!next.has(id) && !chats.get(id)?.unreviewed && !isActivelyViewing(id)) {
          unreviewedBackground.add(id);
          changed = true;
        }
      }
      backgroundActive.clear();
      for (const [k, v] of next) backgroundActive.set(k, v);
      backgroundPending.clear();
      for (const k of nextPending) backgroundPending.add(k);
    }

    // Global delegated-task feed → refresh the subagent-row spinner mirror so it
    // survives a reload (Bug: spinner vanished on refresh because the running
    // state lived only in memory) and re-pull any locally-held leader board that
    // still shows a running task so it flips to done/failed once its stream ended
    // (Bug: card stuck "en curso" after the subagent finished, no more
    // `team_task_update` events arriving).
    if (tasksRes.status === "fulfilled") {
      const nextWorkers = new Set<string>();
      for (const t of tasksRes.value) {
        // "pending" and "running" are both non-terminal (still working / queued).
        if ((t.status === "running" || t.status === "pending") && t.workerConversationId) {
          nextWorkers.add(t.workerConversationId);
        }
      }
      let workersChanged = nextWorkers.size !== backgroundWorkerRunning.size;
      if (!workersChanged) {
        for (const k of nextWorkers) if (!backgroundWorkerRunning.has(k)) { workersChanged = true; break; }
      }
      if (workersChanged) {
        backgroundWorkerRunning.clear();
        for (const k of nextWorkers) backgroundWorkerRunning.add(k);
        changed = true;
      }
      // A leader board held in memory stops receiving `team_task_update` events
      // once its turn's stream ends, so a task that finished server-side would
      // stay "running" on screen. Re-pull the reconciled snapshot for any local
      // chat that still shows a running/pending task; `refreshTeamTasks` merges
      // terminal states and emits, flipping the card and clearing the derived
      // running-worker set. Only chats WITH a running task are refetched.
      for (const [key, chat] of chats) {
        if (!chat.teamTasks) continue;
        const hasRunning = Object.values(chat.teamTasks).some(
          (t) => t.status === "running" || t.status === "pending",
        );
        if (hasRunning) void chatEngine.refreshTeamTasks(key);
      }
    }

    if (changed) emit();
    })();
    backgroundRefreshTask = task;
    try { await task; }
    finally { if (backgroundRefreshTask === task) backgroundRefreshTask = null; }
  },

  /** Clear the "sin revisar" flag once the user has seen the conversation.
   *  Clears the in-memory flag AND the persisted server-side one so the
   *  Dashboard's red dot doesn't reappear on the next reload. The server call
   *  fires even with no local entry (e.g. opening a finished background chat
   *  rediscovered after a reload). `key` is the conversation id here. */
  markReviewed(key: string): void {
    const c = chats.get(key);
    let changed = unreviewedBackground.delete(key);
    if (c?.unreviewed) {
      chats.set(key, { ...c, unreviewed: false });
      changed = true;
    }
    if (changed) emit();
    // Real conversation ids are uuids; skip ephemeral pre-send keys ("new:…").
    if (key && !key.startsWith("new")) {
      void assistantConversationsApi.markReviewed(key).catch(() => undefined);
    }
  },

  /** Record the chat the user is currently viewing (visible pane's open chat).
   *  A run that settles on this chat while it's on screen is NOT flagged
   *  "sin revisar" — the user is already watching the result. */
  setActiveView(key: string | null): void {
    setActiveViewKey(key);
  },

  /** Clear the active-view marker, but only if it still points at `key` (so a
   *  pane unmounting doesn't wipe the marker another pane just claimed). */
  clearActiveView(key: string): void {
    clearActiveViewKey(key);
  },

  /** Refresh persisted voice messages without navigation or dropping task state. */
  async refreshVoiceHistory(key: string, conversationId: string): Promise<void> {
    const before = chats.get(key), scope = resolveTargetScope();
    if (!before || before.conversationId !== conversationId || before.streaming) return;
    const { items } = await assistantConversationsApi.messages(conversationId, Math.max(30, before.turns.length + 10), 0);
    const current = chats.get(key);
    if (scope !== resolveTargetScope() || (!current || current.turns !== before.turns) || current.streaming) return;
    const fetched = historyTurns(items, current.provider);
    const first = fetched[0];
    const overlap = first?.createdAt ? current.turns.findIndex(t => t.createdAt === first.createdAt && t.role === first.role && t.text === first.text) : -1;
    const turns = overlap > 0 ? [...current.turns.slice(0, overlap), ...fetched] : fetched;
    chats.set(key, { ...current, turns });
    emit();
    await chatEngine.refreshTeamTasks(key);
  },

  /** Seed turns loaded from history into the engine (no stream). */
  seed(key: string, provider: string, conversationId: string | null, turns: ChatTurn[]): void {
    const existing = chats.get(key);
    if (existing?.streaming) return; // never clobber a live stream
    // Preserve the delegation board (chat-level, not derived from turns): a
    // reseed (history reload / pagination) must NOT drop teamTasks already
    // rehydrated by refreshTeamTasks, or the "Equipo trabajando" container
    // would blank out after a reload even though the snapshot was fetched.
    chats.set(key, {
      provider,
      conversationId,
      turns,
      streaming: false,
      ...(existing?.teamTasks ? { teamTasks: existing.teamTasks } : {}),
    });
    emit();
  },

  /** Drop a chat's local state (e.g. starting a brand-new empty chat). */
  clear(key: string): void {
    const c = chats.get(key);
    if (c?.streaming) return;
    chats.delete(key);
    unreviewedBackground.delete(key);
    pendingAddenda.delete(key);
    emit();
  },

  /** Purge an ephemeral "new:<nonce>" chat's leftover state (its LiveChat plus
   *  any client/server queue mirror) when the user starts a fresh chat, so
   *  abandoned pre-send keys don't accumulate in the maps. Only ever called with
   *  a "new:" key — never a real conversationId — and never clobbers a live
   *  stream. */
  discardEphemeral(key: string): void {
    if (!key || isLocallyStreaming(key)) return;
    let changed = false;
    if (chats.delete(key)) changed = true;
    if (queues.delete(key)) changed = true;
    if (serverQueued.delete(key)) changed = true;
    if (pendingAddenda.delete(key)) changed = true;
    if (changed) emit();
  },

  /** Remove the last N turns (used when re-editing a stopped message). */
  popTurns(key: string, n: number): void {
    const c = chats.get(key);
    if (!c || c.streaming || n <= 0) return;
    chats.set(key, { ...c, turns: c.turns.slice(0, Math.max(0, c.turns.length - n)) });
    emit();
  },

  isStreaming(key: string): boolean {
    return isLocallyStreaming(key);
  },

  stop(key: string): void {
    const chat = chats.get(key);
    chat?.abort?.abort();
    // The run is decoupled from this connection on the backend, so aborting the
    // local fetch no longer cancels it — tell the backend to stop too. Also drop
    // the background-active mirror NOW: otherwise a stale "still in flight" entry
    // (cleared only on the next poll, seconds later) would make the immediate
    // next send be treated as an ADDENDUM instead of a replacement.
    if (chat?.conversationId) {
      void stopAgent(chat.conversationId);
      backgroundActive.delete(chat.conversationId);
      backgroundPending.delete(chat.conversationId);
    }
    // A manual stop halts the WHOLE chain: drop any queued follow-ups (local +
    // server) AND any buffered addenda so the assistant doesn't auto-dispatch
    // the next message. The settle path also skips draining when the last turn
    // is `stopped`. (editMessage() stops first, so this also clears the addenda
    // before the edited single message replaces the bubble.)
    queues.delete(key);
    pendingAddenda.delete(key);
    const pending = serverQueued.get(key) ?? [];
    serverQueued.delete(key);
    for (const item of pending) {
      if (!item.id.startsWith("tmp-")) void cancelAgentQueue(item.id);
    }
    // Settle the turn SYNCHRONOUSLY (mark it stopped + clear streaming) so an
    // immediate next send sees a deterministic "stopped, not streaming" state
    // and REPLACES the stopped message instead of combining onto it. The async
    // abort path (handleStreamThrow → finalizeTurn → finally) re-applies the
    // same state idempotently.
    if (chat) chats.set(key, { ...chats.get(key)!, streaming: false, abort: undefined });
    finalizeTurn(key);
    emit();
  },

  /**
   * Answer a live permission prompt: POST the decision (so the blocked CLI
   * continues) and optimistically clear the buttons on the current turn. The
   * backend also emits `permission_resolved`, which re-clears idempotently — and
   * reaches any OTHER attached client (second tab) that we can't update locally.
   */
  respondPermission(
    key: string,
    requestId: string,
    decision: "allow" | "deny" | "always",
    tool?: string,
  ): void {
    const chat = chats.get(key);
    const conversationId = chat?.conversationId;
    // "always" carries the tool name so the backend remembers it (never ask again).
    if (conversationId) void sendPermissionDecision(conversationId, requestId, decision, tool);
    if (!chat) return;
    const out = [...chat.turns];
    const i = out.length - 1;
    const t = out[i];
    if (t && t.role === "assistant" && t.permission?.id === requestId) {
      out[i] = { ...t, permission: undefined };
      chats.set(key, { ...chat, turns: out });
      emit();
    }
  },

  /**
   * Start (or continue) a stream for a conversation. `messages` is the
   * full history to send; `userText` the new user turn to render.
   * Returns the key the chat is stored under.
   *
   * Overrides: `agentId` / `projectId` / `forceNew` aceptan `null` literal para
   * sobrescribir el state del pane (caso del bridge `lxp:assistant:request v1`
   * sobre un pane agent-bound: el request externo fuerza conversación NORMAL).
   */
  async send(opts: {
    key: string;
    provider: string;
    /** "cli" routes streamed text into the active CLI tool's mini-terminal. */
    mode?: "api" | "cli";
    conversationId: string | null;
    projectId?: string | null;
    /** Custom agent bound to this conversation (system prompt + tools + provider/model). */
    agentId?: string | null;
    /**
     * OVERRIDE del agentId del pane. `null` explícito = "fuerza conversación
     * NORMAL" (resetea el agentId aunque el pane esté agent-bound). `undefined`
     * = usa el agentId tal cual venga en `agentId`. Los re-envíos del bridge
     * externo fijan este flag a `null` antes de enviar.
     */
    agentIdOverride?: boolean;
    /**
     * OVERRIDE del projectId del pane. `null` explícito = "fuerza proyecto
     * suelto"; `undefined` = respeta el projectId del state.
     */
    projectIdOverride?: boolean;
    /** Force a brand-new conversation (no reuse the open conversationId). */
    forceNew?: boolean;
    messages: AgentMessage[];
    userText: string;
    attachments?: ChatAttachment[];
    /** Per-turn model override (in-chat selector); absent → provider default. */
    model?: string;
    effort?: "low" | "medium" | "high" | "xhigh";
    /** "approve" cuando este turno responde a un ask `askKind:"plan-approval"`
     *  con su PRIMERA opción (botón "Aprobar plan"). Viaja como flag
     *  estructurado (sobrevive a la traducción) y el backend lo re-valida. */
    planDecision?: "approve";
    /** Rebuilds the outgoing `messages` from up-to-date turns. Required so a
     *  QUEUED follow-up (or a combined addendum continuation) sends the right
     *  context once the prior run finishes. The optional `overrideText` replaces
     *  the new user message — used to dispatch the joined addenda as one turn. */
    buildMessages: (priorTurns: ChatTurn[], overrideText?: string) => AgentMessage[];
    /** Explicit "Encolar" button: queue as a SEPARATE follow-up turn (the old
     *  default). When false/absent, a send during a live run is an ADDENDUM to
     *  the active bubble instead (steering / continuation). */
    queue?: boolean;
    /** Called when a slash `/clear` resolves so the UI can wipe turns. */
    onClear?: (key: string) => void;
    /** Called after the stream finishes (to refresh the conversation list). */
    onSettled?: (key: string) => void;
  }): Promise<void> {
    const { key, provider, mode, conversationId, projectId, agentId, messages, userText, attachments, model, effort } = opts;
    if (chatInputLocked(key) && !attachments?.some(a => a.voice) && !opts.planDecision) return;
    const isCli = mode === "cli";

    // A run is already in flight for this chat → queue the follow-up instead of
    // dropping it (or, worse, joining the live run). It dispatches automatically
    // when the current run settles.
    //
    // "In flight" is broader than the LOCAL `streaming` flag:
    //  • local stream alive — the obvious case;
    //  • the last turn is `interrupted` — our socket dropped but the backend run
    //    very likely keeps going (the whole point of the decoupled registry);
    //  • the backend reports a live run for this conversation (another tab, or a
    //    poll-discovered background run we haven't adopted).
    // In any of these, a fresh POST would make the backend treat it as
    // `joiningLiveRun` and REPLAY the in-flight run's buffer into THIS new turn —
    // a phantom, duplicate CLI terminal showing the prior run's output while the
    // user's actual message is silently dropped. Enqueue instead; the server
    // drains it next (and starts immediately if the run already finished).
    const localStreaming = isLocallyStreaming(key);
    const backendInFlight =
      !!conversationId && (backgroundActive.has(conversationId) || lastTurnInterrupted(key));
    // A user-stopped turn is NOT in flight: the next send replaces it (handled by
    // the caller's trim), never an addendum — even if a stale background mirror or
    // a not-yet-settled stream momentarily still looks "in flight".
    if ((localStreaming || backendInFlight) && !lastTurnStopped(key)) {
      // An approved plan must remain a separate turn. Folding it into a live
      // addendum drops planDecision and can leave the approval card stuck.
      if (opts.queue || opts.planDecision) {
        // Explicit "Encolar" button → SEPARATE follow-up turn (own chip). With a
        // conversationId, queue it on the SERVER so it survives the tab/app
        // closing and drains in the background. Without one (brand-new chat),
        // keep the client-side queue (nothing to persist to yet).
        if (conversationId) {
          void enqueueServerTurn(key, conversationId, { provider, projectId, agentId, userText, attachments, model, effort, planDecision: opts.planDecision });
        } else {
          enqueueSend(key, {
            provider,
            isCli,
            conversationId,
            projectId,
            agentId,
            userText,
            attachments,
            model,
            effort,
            planDecision: opts.planDecision,
            buildMessages: opts.buildMessages,
            onClear: opts.onClear,
            onSettled: opts.onSettled,
          });
        }
        return;
      }
      // Default send while a run is live → ADDENDUM: append to the active user
      // bubble (so it reads as the same message) and deliver it to the model
      // either by live steering (provider supports it) or, failing that, as a
      // single continuation turn drained when the current run settles.
      sendAddendum(key, {
        provider,
        isCli,
        conversationId,
        projectId,
        agentId,
        userText,
        attachments,
        model,
        effort,
        buildMessages: opts.buildMessages,
        onClear: opts.onClear,
        onSettled: opts.onSettled,
      });
      return;
    }

    await dispatchSend(key, {
      provider,
      isCli,
      conversationId,
      projectId,
      agentId,
      messages,
      userText,
      attachments,
      model,
      effort,
      ...(opts.planDecision ? { planDecision: opts.planDecision } : {}),
      onClear: opts.onClear,
      onSettled: opts.onSettled,
    });
  },

  /** Snapshot of the queued follow-up message texts for a chat (UI chips).
   *  Server-side (background) items first, then any client-side ones. */
  queued(key: string): string[] {
    const server = (serverQueued.get(key) ?? []).map((q) => q.userText);
    const local = (queues.get(key) ?? []).map((q) => q.userText);
    return [...server, ...local];
  },

  /**
   * Pull a queued follow-up OUT of the queue for editing (matches the order
   * from `queued`). Returns its text + attachments so the caller can load them
   * into the composer; the item is removed from the queue (server or client)
   * so it won't dispatch while the user edits — re-sending re-queues it.
   * Returns null if the index is stale. Attachments for SERVER items are
   * fetched on demand (they aren't kept in the lightweight chip mirror).
   */
  async editQueued(
    key: string,
    index: number,
  ): Promise<{ userText: string; attachments?: ChatAttachment[] } | null> {
    const server = serverQueued.get(key) ?? [];
    if (index >= 0 && index < server.length) {
      const item = server[index];
      if (!item) return null;
      // Fetch full content (incl. attachments) BEFORE removing it. Optimistic
      // (`tmp-`) items have no server id yet → fall back to the chip text.
      let full: { userText: string; attachments?: ChatAttachment[] } = { userText: item.userText };
      if (!item.id.startsWith("tmp-")) {
        const fetched = await getAgentQueueItem(item.id);
        if (fetched) full = { userText: fetched.userText, attachments: fetched.attachments };
      }
      removeQueuedAt(key, index);
      return full;
    }
    const localIndex = index - server.length;
    const q = queues.get(key);
    if (!q || localIndex < 0 || localIndex >= q.length) return null;
    const item = q[localIndex];
    removeQueuedAt(key, index);
    return item ? { userText: item.userText, attachments: item.attachments } : null;
  },

  /** Cancel a queued follow-up by index (matches the order from `queued`). */
  cancelQueued(key: string, index: number): void {
    removeQueuedAt(key, index);
  },

  /**
   * Adopt a still-running backend run when (re)opening a conversation from
   * history. After a full WebView reload (e.g. mobile app-switch killed the
   * renderer), the in-memory `chats` map is empty, so the existing
   * transport-drop resume path can't fire — there's no interrupted turn to
   * recover. Yet the run may still be alive in the backend registry (a long
   * CLI task the user left going). This probes the registry for `conversationId`
   * and, if a run is live, appends a pending assistant turn to the freshly
   * loaded history and streams it in — so the user sees live progress and the
   * final answer instead of a thread frozen at the user's last message.
   *
   * No-op (204 → returns) when no run is buffered: the loaded history is then
   * authoritative. Must be called AFTER `seed()` so history turns are the base.
   */
  async adopt(key: string, provider: string, conversationId: string, isCli: boolean): Promise<boolean> {
    const existing = chats.get(key);
    if (existing?.streaming) return true; // already live locally
    if (adopting.has(key)) return true; // a probe is already deciding for this key
    adopting.add(key); // claimed synchronously, before the awaits below

    // Surface any persisted background queue as chips, regardless of whether a
    // run is currently live.
    void refreshServerQueue(key, conversationId);

    const ac = new AbortController();
    const startedAt = Date.now();
    let gen: Awaited<ReturnType<typeof streamAgentResume>>;
    try {
      gen = await streamAgentResume(conversationId, -1, ac.signal);
    } catch {
      adopting.delete(key);
      return false; // probe failed → keep the loaded history
    }

    // History already ends with the assistant's answer ⇒ this run finished and
    // PERSISTED while we were away, and the seed loaded it. A finished run is
    // still retained in the registry for ~2 min, so `streamAgentResume(-1)`
    // hands back its full event buffer — replaying it would append a SECOND
    // assistant turn (a duplicate terminal bubble) on top of the seeded one.
    // The loaded history is authoritative here; only stream when the thread is
    // frozen mid-run (ends at the user's turn). Still follow any queued chain.
    const baseTurns = chats.get(key)?.turns ?? existing?.turns ?? [];
    const lastBase = baseTurns[baseTurns.length - 1];
    if (!gen || lastBase?.role === "assistant") {
      ac.abort(); // close the resume SSE we won't consume
      adopting.delete(key);
      if ((serverQueued.get(key)?.length ?? 0) > 0) void followServerChain(key, conversationId, provider, isCli);
      return false; // history is authoritative
    }

    // A run IS live and the thread is frozen at the user turn. Append a pending
    // assistant turn and replay the buffered + live events into it.
    const turns: ChatTurn[] = [...baseTurns, { role: "assistant", provider, text: "", tools: [], pending: true }];
    chats.set(key, { provider, conversationId, turns, streaming: true, abort: ac, isCli });
    adopting.delete(key); // `streaming` now guards re-entry
    emit();

    try {
      for await (const frame of gen) {
        applyEvent(key, frame.event, { isCli, startedAt, seq: frame.seq });
      }
    } catch (err) {
      handleStreamThrow(key, err, startedAt, isCli);
    } finally {
      const c = chats.get(key);
      if (c) chats.set(key, { ...c, streaming: false, abort: undefined });
      emit();
      if (lastTurnInterrupted(key)) scheduleResume(key);
      else if (!lastTurnStopped(key)) onCleanSettle(key, conversationId, provider, isCli);
    }
    return true;
  },

  /**
   * Resume a chat whose stream was cut by a transport drop. Re-attaches to the
   * still-running backend run (replaying only missed events); if the run is
   * already gone, reloads the persisted conversation so the user sees the final
   * answer. No-op unless the chat is interrupted and we're in the foreground.
   */
  async resume(key: string): Promise<void> {
    const chat = chats.get(key);
    if (!chat || chat.streaming) return;
    if (!chat.conversationId) return; // only conversationId-keyed runs persist
    if (!lastTurnInterrupted(key)) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    const conversationId = chat.conversationId;
    const isCli = chat.isCli ?? false;
    const startedAt = Date.now();
    const ac = new AbortController();
    // Clear the interrupted flag + reinstate the pending state while we catch up.
    const cleared = clearInterruptedFlag(chat);
    chats.set(key, { ...cleared, streaming: true, abort: ac });
    emit();

    try {
      const gen = await streamAgentResume(conversationId, chat.lastSeq ?? -1, ac.signal);
      if (gen) {
        for await (const frame of gen) {
          applyEvent(key, frame.event, { isCli, startedAt, seq: frame.seq });
        }
      } else {
        // 204 → the run finished + persisted while we were away. Reload it.
        await reloadHistory(key, conversationId);
      }
    } catch (err) {
      handleStreamThrow(key, err, startedAt, isCli);
    } finally {
      const c = chats.get(key);
      if (c) chats.set(key, { ...c, streaming: false, abort: undefined });
      emit();
      if (lastTurnInterrupted(key)) {
        scheduleResume(key); // still cut → try again later (with backoff)
      } else {
        resetResumeAttempts(key); // recovered
        if (!lastTurnStopped(key)) onCleanSettle(key, conversationId, chat.provider, isCli);
      }
    }
  },
};
