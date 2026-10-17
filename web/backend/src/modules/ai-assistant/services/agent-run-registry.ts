// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agent run registry — decouples an agent run from the HTTP/SSE connection
 * that started it.
 *
 * WHY: the assistant streams over a single long-lived `fetch`/SSE connection
 * that, on mobile, lives inside the app's WebView renderer. When the user
 * switches to another app, Android freezes the renderer and tears down the
 * in-flight socket — NOT a loss of internet. Previously the controller wired
 * `req.on("close") → ac.abort()`, so that transport drop *cancelled the whole
 * agent run* and the bubble showed "Network error". The work was lost even
 * though the backend could have finished it.
 *
 * This registry owns the run instead. The run executes inside an explicit
 * `runWithExecutor(executor, …)` scope (so the per-server ALS context survives
 * the request ending), buffers every event, and PERSISTS the turn on
 * completion regardless of whether any client is still listening. The SSE
 * controller merely *attaches* to a run: it replays the buffered events and
 * then streams live ones. A dropped connection just detaches — the run keeps
 * going and the answer lands in the conversation, which the client reloads
 * when it returns to the foreground.
 *
 * Runs are keyed by server + conversationId. One live run per conversation
 * on each server; reconnecting joins the existing run on that server.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { runWithExecutor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { ApprovalMode } from "../models/assistant-config.types.js";
import type { AgentEvent } from "./agent.service.js";
import type { AskQuestion } from "../models/ask.types.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { recordActivity } from "../../../shared/worklog/worklog-recorder.service.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { deriveNotificationPreview } from "./conversation-message-normalizer.js";
import { humanizePreview } from "../../../shared/text/humanize-preview.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { executionKey, executionTargetId } from "./execution-scope.js";
import type { ApiActivity } from "../models/api-activity.types.js";
import { createApiActivity } from "./api-activity.js";

const log = createModuleLogger("ai-agent-registry");

/** Keep a finished run around briefly so a reconnecting client can replay
 *  the final events (incl. the terminal `done`/`error`) before it GCs. */
const RETENTION_MS = 2 * 60_000;

type Subscriber = (event: AgentEvent, seq: number) => void;

interface AgentRun {
  key: string;
  /** Provider that owns this run (claude/codex/…), for the active-runs feed. */
  provider?: string;
  /** Project the conversation belongs to, carried for the active-runs feed. */
  projectId?: string | null;
  /** Panel user that started the run — powers the per-user concurrency cap
   *  (`activeCountForUser`). Absent for system/background runs. */
  userId?: number;
  /** True for team WORKER runs. They carry `userId` (runContext/MCP fallback
   *  and per-user permission scoping still need the owner) but are EXCLUDED
   *  from `activeCountForUser`: workers have their own quota
   *  (ASSISTANT_MAX_WORKER_RUNS) and must not eat the user's HTTP cap. */
  isWorker?: boolean;
  /** True once the run is detected to be a CLI-mode answer (`.cli` tool or a
   *  `-cli`/estimated usage event). Lets a reconnecting client adopt it with
   *  the right text routing. */
  cli: boolean;
  /** Ordered event buffer; `seq` of an event is its index here. */
  events: AgentEvent[];
  /** True only after persistence/close settle and the terminal is published. */
  done: boolean;
  /** The provider has stopped; translation/persistence/close may still run. */
  closing: boolean;
  /** Shutdown must not start a queued successor after an in-flight save. */
  shutdownRequested?: boolean;
  /** Coalesced queue wake-up, invoked only after a successful save and release. */
  deferredQueueDrain?: () => Promise<void>;
  /** Accumulated assistant text (English when translation is active). */
  assistantText: string;
  /** Background translation: the final answer in the user's language (set in
   *  the terminal path when `translate` was provided). Persisted as the display
   *  variant; `assistantText` stays the canonical (English) context text. */
  translatedText?: string;
  /** Background translation: set when translation degraded after retries — the
   *  human reason the answer was delivered untranslated. Surfaced live via a
   *  `translation_error` event and persisted so the notice survives reload. */
  translationError?: string;
  /** CLI runs: id of the `.cli` tool_use, so a translated answer can be
   *  delivered as a `tool_result` that replaces the bubble text. */
  cliToolId?: string;
  /** CLI runs: the clean English answer captured from the provider's
   *  `tool_result` (claude). Translated once the run finishes. */
  cliEnglishAnswer?: string;
  /** Set when the agent emitted an `ask` event (interactive question pending). */
  ask?: AskQuestion[];
  /** "plan-approval" when the pending ask is a plan-approval request (persists
   *  on the turn so the frontend can send `planDecision: "approve"`). */
  askKind?: "plan-approval";
  /** Approval policy for this run, snapshotted from the user's config at run
   *  start (so the permission gate reads it in-memory, no SSH round-trip per
   *  ask). `mode` governs the gate ("auto" → allow all; "manual"/"plan" → ask);
   *  `autoApprove` is the live "never ask again" set — seeded from the persisted
   *  allowlist and grown when the user clicks "approve & never ask again". */
  approval?: { mode: ApprovalMode; autoApprove: Set<string> };
  ac: AbortController;
  subscribers: Set<Subscriber>;
  startedAt: number;
  gcTimer?: ReturnType<typeof setTimeout>;
  /** Per-server executor the run is pinned to — used by `gracefulShutdown` to
   *  persist an interrupted API answer through the right server. */
  executor: Executor;
  /** Resolves when the run's stream + persistence (`onComplete`) have settled.
   *  `gracefulShutdown` awaits it so an aborted API run finishes persisting
   *  before the process exits. */
  completion?: Promise<void>;
}

export interface StartRunParams {
  key: string;
  /** Provider owning the run (surfaced by the active-runs feed). */
  provider?: string;
  /** Trusted recovery callers know the CLI exists before its first replayed
   * event. Keep it detached if another shutdown happens during recovery. */
  cli?: boolean;
  /** Project the conversation belongs to (run identity completeness). */
  projectId?: string | null;
  /** Per-server executor; the run is pinned to it for its whole lifetime. */
  executor: Executor;
  /** Authenticated user owning the run. Pinned into the executor context so
   *  detached tool handlers (which have no `req`) can enforce the same
   *  per-group permission/path policy as the HTTP layer. Omitted for admin /
   *  internal runs (no per-user scoping). */
  user?: SessionUser;
  /** Mark a team worker run: keeps `user`/`userId` for scoping but excludes
   *  the run from the per-user concurrency cap (see AgentRun.isWorker). */
  isWorker?: boolean;
  /** Builds the event generator. Called INSIDE the executor scope so the
   *  agent's tool calls inherit the right per-server ALS context. */
  makeGen: () => AsyncGenerator<AgentEvent>;
  /** Side effect per event (e.g. usage ledger). Runs inside the scope too. */
  onEvent?: (event: AgentEvent) => void;
  /** Persist the finished turn. Called once, after the stream ends, inside
   *  the executor scope. `errored` is true when the run ended on an error.
   *  `ask` carries any interactive question the agent posed (so it persists
   *  on the turn and re-renders on reload). `translation` carries the final
   *  answer already rendered in the user's language (when `translate` was set);
   *  `assistantText` remains the canonical English context text. The run still
   *  owns its key here: drainConversationQueue defers dispatch until release,
   *  so this callback must never wait for its own run's completion. */
  onComplete?: (
    assistantText: string,
    errored: boolean,
    ask?: AskQuestion[],
    translation?: { text: string; lang: string; error?: string },
    /** Wall-clock ms from run start to completion — persisted on the turn so the
     *  dashboard can show how long the query took after a reload. */
    durationMs?: number,
    /** CLI runs only: the FULL terminal log (every step/lane). `assistantText`
     *  is the clean final answer for CLI runs; this is the verbose transcript so
     *  the reloaded console box can be rebuilt. Undefined for API runs. */
    cliLog?: string,
    /** "plan-approval" when `ask` is a plan-approval request (persisted on the
     *  turn so answering can send `planDecision: "approve"`). */
    askKind?: "plan-approval",
    outcome?: { error?: string; interrupted?: boolean; pending?: boolean },
    apiActivity?: ApiActivity,
  ) => Promise<void> | void;
  /**
   * Background translation. When set, an API-mode run suppresses live English
   * text deltas and emits ONE already-translated `text` event right before
   * `done`. A CLI-mode run instead KEEPS its live raw terminal (English) and
   * delivers the translated final answer as a `tool_result` that replaces the
   * bubble text. `translateText` turns the finished English answer into the
   * user's language; `translateAsk` localizes an interactive question's strings.
   * Supplied for both API and CLI runs (the engine is the separate translation
   * provider configured in settings, not the agent's provider).
   */
  translate?: {
    lang: string;
    translateText: (englishText: string) => Promise<string>;
    /** Like `translateText` but reports whether the translation actually
     *  succeeded. When `ok` is false, `text` is the untranslated English
     *  fallback and `error` explains why — surfaced to the user as a collapsed
     *  notice. Optional: callers without it fall back to `translateText`. */
    translateTextDetailed?: (englishText: string) => Promise<{ text: string; ok: boolean; error?: string }>;
    translateAsk?: (questions: AskQuestion[]) => Promise<AskQuestion[]>;
  };
}

const runs = new Map<string, AgentRun>();

function hasTerminal(run: AgentRun): boolean {
  const last = run.events[run.events.length - 1];
  return Boolean(last && (last.type === "done" || last.type === "error"));
}

function push(run: AgentRun, event: AgentEvent): void {
  const seq = run.events.length;
  run.events.push(event);
  for (const sub of run.subscribers) {
    try {
      sub(event, seq);
    } catch {
      /* a slow/broken subscriber must never break the run */
    }
  }
}

/**
 * Background translation of an interactive `ask`: localize the questions and
 * push the translated event. Returns true when it handled (and pushed) the
 * event; false otherwise (non-ask, no translator, or a failed translation —
 * the caller then falls through and pushes the source event as usual).
 */
async function maybeTranslateAsk(
  run: AgentRun,
  event: AgentEvent,
  translate: NonNullable<StartRunParams["translate"]>,
): Promise<boolean> {
  if (event.type !== "ask" || !translate.translateAsk) return false;
  try {
    const tq = await translate.translateAsk(event.questions);
    run.ask = tq;
    run.askKind = event.kind;
    push(run, { type: "ask", id: event.id, questions: tq, ...(event.kind ? { kind: event.kind } : {}) });
    return true;
  } catch (err) {
    log.warn({ err: (err as Error).message }, "ask translation failed — pushing source");
    return false;
  }
}

function scheduleGc(run: AgentRun): void {
  const key = executionKey(run.key, run.executor.target.id);
  run.gcTimer = setTimeout(() => {
    if (runs.get(key) === run) runs.delete(key);
  }, RETENTION_MS);
  // Don't keep the event loop alive just to GC a finished buffer.
  run.gcTimer.unref?.();
}

export const agentRunRegistry = {
  /** True while a run is streaming or persisting/closing its turn. */
  isActive(key: string, targetId?: string): boolean {
    const run = runs.get(executionKey(key, targetId));
    return Boolean(run && !run.done);
  },

  /** True when a run exists for this key (live OR finished-but-retained). */
  has(key: string, targetId?: string): boolean {
    return runs.has(executionKey(key, targetId));
  },

  /**
   * Snapshot of every run still streaming or closing (`!done`), with provider + cli
   * flag. Powers `GET /api/ai/agent/active`, which lets the Dashboard and chat
   * list show background runs after a WebView reload wiped the client engine —
   * without the user having to open each chat to rediscover it. Keys are
   * conversationIds; the controller intersects them with the requester's own
   * per-server conversation list, so no cross-server id ever leaks.
   */
  activeRuns(): Array<{ key: string; provider?: string; cli: boolean; targetId: string }> {
    const out: Array<{ key: string; provider?: string; cli: boolean; targetId: string }> = [];
    for (const run of runs.values()) {
      if (!run.done) out.push({ key: run.key, provider: run.provider, cli: run.cli, targetId: run.executor.target.id });
    }
    return out;
  },

  /** Live runs started by this panel user — powers the per-user concurrency
   *  cap. Team worker runs are excluded: they carry the user's id for scoping
   *  but are throttled by their own quota (ASSISTANT_MAX_WORKER_RUNS). */
  activeCountForUser(userId: number, targetId?: string): number {
    const target = executionTargetId(targetId);
    let n = 0;
    for (const run of runs.values()) {
      if (!run.done && !run.isWorker && run.userId === userId && run.executor.target.id === target) n += 1;
    }
    return n;
  },

  /**
   * Pinned executor + owner of an ACTIVE run. Used by the MCP cross channel to
   * re-resolve a token whose bridge session went stale MID-RUN (session TTL /
   * re-login while the CLI is still streaming): the run keeps using its pinned
   * executor for its whole lifetime, so serving the run's own MCP callbacks
   * with that same executor is strictly narrower than the original resolution.
   * `null` once the run finishes (a finished-but-retained run must not extend
   * the token's reach).
   */
  runContext(key: string, targetId?: string): { executor: Executor; ownerUserId?: number; signal: AbortSignal } | null {
    const run = runs.get(executionKey(key, targetId));
    if (!run || run.done || run.ac.signal.aborted) return null;
    return {
      executor: run.executor,
      signal: run.ac.signal,
      ...(run.userId !== undefined ? { ownerUserId: run.userId } : {}),
    };
  },

  /**
   * Queue drains requested during a run (including inside onComplete) must
   * return without waiting for that same run. Coalesce the wake-up on its
   * owner; dispatch it after storage, terminal delivery and key release.
   * A failed save, explicit stop or shutdown discards only this in-memory
   * wake-up: the durable queued turn remains available for recovery/review.
   */
  deferQueueDrain(key: string, drain: () => Promise<void>, targetId?: string): boolean {
    const run = runs.get(executionKey(key, targetId));
    if (!run) return false;
    // An async enqueue/verify listener may reach us after the save settled.
    // Keep its durable turn queued even when this run is already retained.
    if (run.shutdownRequested) return true;
    if (run.done) return false;
    run.deferredQueueDrain ??= drain;
    return true;
  },

  /**
   * Start a run for `key`, or return the existing one if a live (or
   * recently-finished, still-buffered) run already exists. The run executes
   * detached from any request — it survives the SSE connection closing.
   */
  start(params: StartRunParams): AgentRun {
    const key = executionKey(params.key, params.executor.target.id);
    const existing = runs.get(key);
    // A LIVE run for this key → join it (one run per conversation at a time).
    if (existing && !existing.done) return existing;
    // A FINISHED run is still retained for replay. A new turn for the same
    // conversation (the user's next message, or the next queued follow-up the
    // server drains) must SUPERSEDE it — otherwise we'd hand back the old
    // answer and never run the new one. Evict it and start fresh.
    if (existing) {
      if (existing.gcTimer) clearTimeout(existing.gcTimer);
      runs.delete(key);
    }

    const run: AgentRun = {
      key: params.key,
      provider: params.provider,
      projectId: params.projectId ?? null,
      userId: params.user?.userId,
      ...(params.isWorker ? { isWorker: true } : {}),
      cli: params.cli === true,
      events: [],
      done: false,
      closing: false,
      assistantText: "",
      ac: new AbortController(),
      subscribers: new Set(),
      startedAt: Date.now(),
      executor: params.executor,
    };
    runs.set(key, run);

    // Detached: pinned to the per-server executor so kv/dataStore/tools
    // resolve to the right server even after the request that kicked it off
    // has ended.
    const translate = params.translate;
    run.completion = runWithExecutor(params.executor, async () => {
      let errored = false;
      let terminalError: string | undefined;
      let terminalSeen = false;
      let pending = false;
      let workingStatusPushed = false;
      const apiActivity = createApiActivity();
      try {
        for await (const event of params.makeGen()) {
          if (run.ac.signal.aborted) break;
          if (event.type === "text" && event.phase !== "commentary") run.assistantText += event.delta;
          // API prose before a tool belongs to progress. Keep it in the event
          // replay but persist/translate only the answer after the last call.
          if (event.type === "tool_use" && !run.cli && !event.name.endsWith(".cli")) run.assistantText = "";
          if (event.type === "done" || event.type === "error") terminalSeen = true;
          if (event.type === "done") pending = event.pending === true;
          if (event.type === "done" && !pending && !run.ask?.length && !(run.cli ? run.cliEnglishAnswer : run.assistantText)?.trim() && !errored) {
            errored = true;
            terminalError = "El asistente terminó sin una respuesta final verificable. Revisa el estado antes de repetir cambios.";
          }
          if (event.type === "ask") {
            run.ask = event.questions;
            run.askKind = event.kind;
          }
          if (event.type === "error") { errored = true; terminalError = event.message; }
          // Detect CLI-mode runs the same way the usage recorder does, so the
          // active-runs feed can tell a reconnecting client to route text into
          // the terminal box instead of the markdown bubble.
          if (event.type === "tool_use" && event.name.endsWith(".cli")) {
            run.cli = true;
            run.cliToolId = event.id;
          } else if (event.type === "usage" && (event.model.endsWith("-cli") || event.estimated)) run.cli = true;
          if (!run.cli) apiActivity.record(event);
          // CLI runs persist the clean final answer from the provider's
          // terminal `tool_result`; without this, non-translated runs fall back
          // to the accumulated terminal transcript and store that as `content`.
          if (run.cli && event.type === "tool_result" && event.id === run.cliToolId) {
            if (event.success && event.output && !event.output.startsWith("[")) run.cliEnglishAnswer = event.output;
            if (!event.success) {
              errored = true;
              terminalError = event.output || "La ejecución CLI no terminó correctamente.";
            }
          }
          try {
            params.onEvent?.(event);
          } catch (err) {
            log.warn({ err: (err as Error).message }, "agent run onEvent hook failed");
          }

          // ── Background translation reshapes the client-facing stream ──
          if (translate) {
            // Interactive `ask` is localized the same way regardless of mode.
            if (await maybeTranslateAsk(run, event, translate)) continue;
            if (run.cli) {
              // CLI keeps its live raw terminal (English) streaming — text /
              // tool_use / usage flow through untouched so the user watches the
              // agent work. Only the FINAL clean answer is translated.
              if (event.type === "tool_result" && event.id === run.cliToolId && event.success && event.output && !event.output.startsWith("[")) {
                // Suppress the English copy; the translated answer is
                // delivered in `finally`.
                continue;
              }
              if (event.type === "done") break; // translated answer emitted in `finally`
            } else {
              if (event.type === "text") {
                // Suppress live English deltas (no seq burned). Show one transient
                // "working" status so the bubble isn't blank while the answer forms.
                if (!workingStatusPushed) {
                  workingStatusPushed = true;
                  push(run, { type: "status", state: "working" });
                }
                continue;
              }
              if (event.type === "done") break; // terminal handled in `finally`
            }
          }

          // Both terminal outcomes are provisional until onComplete settles.
          // SSE closes on either frame; publish exactly one after persistence.
          if (event.type === "done" || event.type === "error") break;
          push(run, event);
        }
      } catch (err) {
        errored = true;
        terminalError = (err as Error).message ?? "Error interno del agente";
      } finally {
        run.closing = true;
        if (!terminalSeen && !errored && !run.ac.signal.aborted) {
          errored = true;
          terminalError = "La ejecución terminó sin confirmar su resultado. Revisa el estado antes de repetir cambios.";
        }
        // Background translation: deliver the answer once, already translated.
        // Guarded so an errored/aborted run never blocks on a translation call
        // and never loses its terminal frame.
        if (translate && !pending && !errored && !run.ac.signal.aborted && !hasTerminal(run)) {
          // Translate while reporting whether it actually succeeded. The hook
          // already retried internally; if it still failed, we deliver the
          // English fallback AND surface the reason as a `translation_error`.
          const doTranslate = async (
            english: string,
          ): Promise<{ text: string; ok: boolean; error?: string }> => {
            try {
              if (translate.translateTextDetailed) return await translate.translateTextDetailed(english);
              return { text: await translate.translateText(english), ok: true };
            } catch (err) {
              // Defensive: the hook is contracted not to throw, but never lose
              // the answer if it does.
              const msg = (err as Error).message;
              log.warn({ err: msg }, "answer translation threw — using source");
              return { text: english, ok: false, error: msg };
            }
          };
          if (run.cli) {
            // CLI: translate only the clean answer from the terminal tool_result.
            // A missing answer must never promote the raw terminal to a final.
            // Deliver it as a `tool_result` so it REPLACES the (empty) bubble
            // text while the live terminal stays intact.
            const english = run.cliEnglishAnswer ?? "";
            if (english.trim()) {
              push(run, { type: "status", state: "translating" });
              const res = await doTranslate(english);
              run.translatedText = res.text || (run.cliEnglishAnswer ?? "");
              if (run.translatedText.trim() && run.cliToolId) {
                push(run, { type: "tool_result", id: run.cliToolId, success: true, output: run.translatedText });
              }
              if (!res.ok && res.error) {
                run.translationError = res.error;
                push(run, { type: "translation_error", message: res.error });
              }
            }
          } else {
            push(run, { type: "status", state: "translating" });
            const res = await doTranslate(run.assistantText);
            run.translatedText = res.text || run.assistantText;
            if (run.translatedText.trim()) push(run, { type: "text", delta: run.translatedText, phase: "final_answer" });
            if (!res.ok && res.error) {
              run.translationError = res.error;
              push(run, { type: "translation_error", message: res.error });
            }
          }
        }
        // CLI runs: `content` should be the CLEAN final answer (captured from the
        // provider's tool_result), not the verbose terminal log — the log is
        // persisted separately as `cliLog` for the console box. API runs already
        // accumulate the clean answer into `assistantText`.
        const cleanAnswer = pending ? "" : run.cli ? (run.cliEnglishAnswer ?? "") : run.assistantText;
        let persisted = false;
        try {
          await params.onComplete?.(
            cleanAnswer,
            errored,
            run.ask,
            translate && run.translatedText
              ? { text: run.translatedText, lang: translate.lang, ...(run.translationError ? { error: run.translationError } : {}) }
              : undefined,
            Date.now() - run.startedAt,
            run.cli ? run.assistantText : undefined,
            run.askKind,
            terminalError || run.ac.signal.aborted || pending ? { ...(terminalError ? { error: terminalError } : {}), ...(run.ac.signal.aborted ? { interrupted: true } : {}), ...(pending ? { pending: true } : {}) } : undefined,
            run.cli ? undefined : apiActivity.snapshot(),
          );
          persisted = true;
        } catch (err) {
          errored = true;
          terminalError = "No se pudo confirmar el guardado y cierre del turno. Revisa el historial y el estado de la tarea antes de repetir cambios.";
          log.warn({ err: (err as Error).message }, "agent run persistence failed");
        }
        // No await between release and terminal delivery: reconnects either
        // subscribe to the closing run or replay its one settled terminal.
        run.done = true;
        if (!hasTerminal(run)) push(run, errored ? { type: "error", message: terminalError || "La ejecución no terminó correctamente." } : { type: "done", ...(pending ? { pending: true } : {}) });
        const drain = run.deferredQueueDrain;
        run.deferredQueueDrain = undefined;
        if (persisted && !run.ac.signal.aborted && !run.shutdownRequested && drain) {
          try {
            await drain();
          } catch (err) {
            // Dispatch has its own durable queue. Its failure cannot rewrite
            // this saved turn or produce a second terminal for its subscribers.
            log.warn({ err: (err as Error).message }, "agent deferred queue drain failed");
          }
        }
        // Worklog: a finished, non-errored assistant run is significant
        // activity. The user prompt isn't kept in the registry, so the detail
        // is the answer's first 200 chars. Fail-open fire-and-forget; runs
        // inside the executor scope so identity resolves from the ALS context.
        if (!errored && !pending && !run.ask?.length && !run.ac.signal.aborted) {
          void recordActivity({
            module: "ai-assistant",
            action: run.cli ? "cli_task" : "assistant_task",
            category: "ai_assisted",
            detail: cleanAnswer.slice(0, 200),
            metrics: { durationMin: Math.round(((Date.now() - run.startedAt) / 60_000) * 100) / 100 },
          });
        }
        // "Chat finished" notification: the in-app bell (always) + an owner push
        // to web/app/desktop when NO client was attached (user navigated away).
        // Skipped on stop/shutdown: settled listeners can enqueue fresh work.
        // Persisted task/history reconciliation resumes after restart.
        // Fire-and-forget; a listener failure must never break the run.
        if (!run.ac.signal.aborted && !run.shutdownRequested) {
          // Título + agente de la conversación para que la campana muestre
          // «Auditoría del servidor» — Riesgo: medio · … en vez de un id.
          // Best-effort: la meta puede no existir (chat efímero) o la lectura
          // SFTP fallar — nunca debe romper el cierre del run.
          let conversationTitle: string | undefined;
          let agentId: string | undefined;
          try {
            const meta = await conversationsRepository.getMeta(run.executor, run.key);
            if (meta?.title) conversationTitle = meta.title;
            if (meta?.agentId) agentId = meta.agentId;
          } catch (err) {
            log.debug?.({ err: (err as Error).message }, "conversation meta lookup failed (preview)");
          }
          // Cuerpo LEGIBLE: último bloque narrativo + JSON humanizado. El
          // `slice(0,200)` anterior volcaba el log crudo / el JSON de la
          // respuesta en la campana (bug 2026-08-25).
          const rawForPreview = run.cli ? run.assistantText || cleanAnswer : cleanAnswer;
          const preview = terminalError ||
            deriveNotificationPreview(run.translatedText, rawForPreview, 160) ||
            humanizePreview((run.translatedText || cleanAnswer || "").trim(), 160);
          try {
            const completionEvent = {
              conversationId: run.key,
              userId: params.user?.userId,
              targetId: run.executor.target.id,
              provider: run.provider,
              cli: run.cli,
              errored,
              ...(pending ? { pending: true } : {}),
              ...(run.ask?.length ? { awaitingInput: true } : {}),
              preview,
              ...(conversationTitle ? { conversationTitle } : {}),
              ...(agentId ? { agentId } : {}),
              hadSubscribers: run.subscribers.size > 0,
            };
            // Team lifecycle must observe every settled provider turn. User
            // notifications and agent-message acknowledgments need a final.
            eventBus.emit(Events.AI_TURN_SETTLED, completionEvent);
            if (!pending && !run.ask?.length) eventBus.emit(Events.AI_CHAT_FINISHED, completionEvent);
          } catch (err) {
            log.warn({ err: (err as Error).message }, "AI_CHAT_FINISHED emit failed");
          }
        }
        scheduleGc(run);
      }
      // 4th arg pins the run owner into the executor context so detached tool
      // handlers (no `req`) can enforce the same per-group permission/path
      // policy as the HTTP layer (e.g. files.* canAccessPath).
    }, params.user?.userId, params.user);

    return run;
  },

  /**
   * Attach to a run: synchronously replay buffered events from `fromSeq`,
   * then subscribe to live ones. Returns an unsubscribe fn, or `null` if no
   * run exists for the key. No `await` between reading the buffer and
   * subscribing, so (single-threaded) no event can be missed or duplicated.
   */
  attach(key: string, fromSeq: number, onEvent: Subscriber, targetId?: string): (() => void) | null {
    const run = runs.get(executionKey(key, targetId));
    if (!run) return null;
    const len = run.events.length;
    for (let i = Math.max(0, fromSeq); i < len; i++) {
      const ev = run.events[i];
      if (ev) onEvent(ev, i);
    }
    if (run.done) return () => undefined;
    run.subscribers.add(onEvent);
    return () => run.subscribers.delete(onEvent);
  },

  /**
   * Inject an out-of-band event into a LIVE run's buffer, as if the generator
   * had yielded it. Used by the permission broker to surface a mid-run approval
   * prompt (and its resolution) on the open SSE stream — the run itself keeps
   * polling the CLI log, so this just slots an extra event into the same ordered
   * buffer (correct seq, replayed on reconnect). Returns false when no live run
   * exists for the key (finished/GC'd) — the caller treats that as "no channel".
   */
  inject(key: string, event: AgentEvent, targetId?: string): boolean {
    const run = runs.get(executionKey(key, targetId));
    if (!run || run.done) return false;
    push(run, event);
    return true;
  },

  /**
   * Snapshot the run's approval policy (mode + persisted "never ask again"
   * allowlist). Called once at run start from `agentService.run` (which runs
   * inside this run's scope, so the run exists). No-op when no live run owns the
   * key. The set is COPIED so later in-run additions don't mutate config state.
   */
  setApproval(key: string, approval: { mode: ApprovalMode; autoApproveTools: string[] }, targetId?: string): void {
    const run = runs.get(executionKey(key, targetId));
    if (!run || run.done) return;
    run.approval = { mode: approval.mode, autoApprove: new Set(approval.autoApproveTools) };
  },

  /** The run's approval policy, or null when no live run owns the key. The
   *  permission gate (mcp-server) reads this before asking the user. */
  getApproval(key: string, targetId?: string): { mode: ApprovalMode; autoApprove: Set<string> } | null {
    const run = runs.get(executionKey(key, targetId));
    if (!run || run.done) return null;
    return run.approval ?? null;
  },

  /** Add a tool to the live run's "never ask again" set so the REST of this run
   *  skips the prompt (the persistent allowlist is written separately by the
   *  controller). No-op when no live run owns the key. */
  addAutoApproveTool(key: string, tool: string, targetId?: string): void {
    const run = runs.get(executionKey(key, targetId));
    if (!run || run.done) return;
    if (!run.approval) run.approval = { mode: "manual", autoApprove: new Set() };
    run.approval.autoApprove.add(tool);
  },

  /** Explicitly abort a run (user pressed "stop"). */
  stop(key: string, targetId?: string): boolean {
    const run = runs.get(executionKey(key, targetId));
    if (!run || run.done) return false;
    run.ac.abort();
    return true;
  },

  /**
   * Best-effort graceful shutdown (SIGTERM/SIGINT). API-mode runs are in-process
   * and cannot survive a restart, so abort them and await their persistence:
   * the run's `finally`→`onComplete` saves whatever answer was produced so the
   * thread isn't left frozen at the user's turn. CLI providers still running
   * are LEFT ALONE — their `nohup` keeps running and a recovery descriptor lets a
   * later request re-attach and persist the real answer (persisting here would
   * race that and double-write). A CLI already closing is awaited too: its
   * save belongs to this process. No queued successor starts during shutdown.
   * Bounded by `timeoutMs` so process exit is never
   * blocked indefinitely.
   */
  async gracefulShutdown(timeoutMs = 5_000): Promise<{ flushed: number; cliDetached: number }> {
    let flushed = 0;
    let cliDetached = 0;
    const waits: Promise<unknown>[] = [];
    for (const run of runs.values()) {
      if (run.done) continue;
      run.shutdownRequested = true;
      if (run.cli && !run.closing) {
        cliDetached++;
        continue;
      }
      // Do not relabel a result interrupted after its save already began.
      if (!run.closing) run.ac.abort();
      flushed++;
      if (run.completion) waits.push(run.completion.catch(() => undefined));
    }
    if (waits.length > 0) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.allSettled(waits),
          new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    return { flushed, cliDetached };
  },
};
