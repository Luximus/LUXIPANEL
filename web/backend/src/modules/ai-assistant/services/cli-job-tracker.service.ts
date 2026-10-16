// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * CLI background job tracker.
 *
 * When the CLI bridge launches an agent in background (nohup), it registers
 * a job here. The tracker polls the target's log file every 3 s, pushes
 * incremental output to active SSE subscribers, and emits a notification via
 * the event bus when the job finishes and nobody is watching.
 *
 * Lifetime: in-memory only — jobs are lost on panel restart, but the nohup
 * process keeps running on the target and the log file remains there.
 */

import { StringDecoder } from "node:string_decoder";
import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { getContextUser, getContextUserId, runWithExecutor } from "../../../shared/executor/context.js";
import { executionKey, executionTargetId } from "./execution-scope.js";
import { cliSecretsDir } from "./providers/cli/cli-tmp-paths.js";
import { deriveNotificationPreview } from "./conversation-message-normalizer.js";
import { permissionBroker } from "./permission-broker.js";
import { agentRunRegistry } from "./agent-run-registry.js";

const log = createModuleLogger("cli-job-tracker");

const POLL_MS = 3_000;
// Bound every transfer, including replay after restart, below executor limits.
const LOG_CHUNK_BYTES = 256 * 1024;
const MAX_CHUNKS_PER_TICK = 8;
const PROCESS_PROBE_MS = 15_000;
/** Internal sentinel: no exit status was received; never invent SIGKILL/137. */
export const CLI_EXIT_UNCONFIRMED = -1;

export type OutputListener = (chunk: string) => void;
export type DoneListener = (output: string, exitCode: number) => void;

export interface CliJob {
  readonly jobId: string;
  readonly logFile: string;
  readonly exitFile: string;
  readonly startedAt: number;
  readonly serverName: string;
  accumulated: string;
  done: boolean;
  exitCode?: number;
}

interface JobState extends CliJob {
  executor: Executor;
  /** Target PID of the launched CLI (the `nohup bash -c` parent). Lets the
   *  user's "stop" kill the whole background process tree, not just detach. */
  pid?: string;
  /** Conversation this job belongs to — used to kill it on an explicit stop. */
  conversationId?: string;
  /** CLI provider that launched this job (claude/codex/…). Viaja en la
   *  notificación para que el target de la campana abra el chat en el
   *  proveedor correcto. */
  provider?: string;
  /**
   * Live-steering plumbing (ASSISTANT_LIVE_STEERING). When set, this job was
   * launched with a persistent stdin FIFO so the user can inject extra messages
   * mid-run. `steer(text)` writes one NDJSON user message to the FIFO; `holderPid`
   * is the helper process holding the FIFO's write end open (killed to force the
   * EOF that ends the turn). In steering mode the CLI does NOT exit on its own —
   * the turn is settled by detecting the stream-json `result` event below.
   */
  steer?: (text: string) => Promise<void>;
  holderPid?: string;
  steering?: boolean;
  /** True once the turn's `result` event was seen and the holder was killed (so
   *  we only force EOF once, then let the normal exit-file path complete). */
  steerEnded?: boolean;
  /** Optional stateful transform: raw stdout delta → display text (e.g.
   *  Claude stream-json → readable terminal lines). Identity when absent. */
  transform?: (rawChunk: string) => string;
  /** Bytes already consumed from the target log. Incremental tail reads start
   *  here so each poll transfers only the NEW output, not the whole growing
   *  log (the old `cat`-every-tick was O(n) per poll, O(n²) per session). */
  byteOffset: number;
  outputListeners: Set<OutputListener>;
  doneListeners: Set<DoneListener>;
  timer: ReturnType<typeof setInterval>;
  /** True while an SSE generator is actively consuming this job's output.
   *  Suppresses the push notification so the browser doesn't double-alert. */
  hasActiveStream: boolean;
  polling: boolean;
  decoder: StringDecoder;
  lastProcessProbe: number;
  missingProcessChecks: number;
  notificationCtx: { title: string; link: string };
  approvalBuffer: string;
  seenApprovals: Set<string>;
}

const jobs = new Map<string, JobState>();

/** Relay Codex app-server's native JSON-RPC approval callback to the panel. */
function relayCodexApprovals(job: JobState, chunk: string): void {
  if (job.provider !== "codex") return;
  job.approvalBuffer += chunk;
  let newline = job.approvalBuffer.indexOf("\n");
  while (newline >= 0) {
    const line = job.approvalBuffer.slice(0, newline);
    job.approvalBuffer = job.approvalBuffer.slice(newline + 1);
    newline = job.approvalBuffer.indexOf("\n");
    let event: Record<string, unknown>;
    try { event = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
    if (event.type !== "lxp.approval.request") continue;
    const requestId = typeof event.request_id === "string" ? event.request_id : "";
    if (!/^\d+$/.test(requestId) || job.seenApprovals.has(requestId)) continue;
    job.seenApprovals.add(requestId);
    const replyFile = `/tmp/${job.jobId}-approvals/${requestId}.json`;
    void (async () => {
      const tool = typeof event.tool === "string" ? event.tool : "Codex";
      const approval = job.conversationId ? agentRunRegistry.getApproval(job.conversationId) : null;
      const decision = approval?.mode === "plan" ? "deny" : job.conversationId
        ? !event.require_user_approval && (approval?.autoApprove.has(tool) || approval?.mode === "auto") ? "allow" : await permissionBroker.request({
            conversationId: job.conversationId,
            provider: "codex",
            tool,
            title: typeof event.title === "string" ? event.title : "Aprobación de Codex",
            detail: typeof event.detail === "string" ? event.detail : undefined,
          })
        : "deny";
      await job.executor.writeFile(replyFile, Buffer.from(JSON.stringify({ decision })), { mode: 0o600 });
    })().catch((err) => log.warn({ jobId: job.jobId, err: (err as Error).message }, "codex approval relay failed"));
  }
}

/** Kill the FIFO-holder helper of a steering job so its CLI sees stdin EOF and
 *  exits. Best-effort + idempotent (the PID may already be gone). */
async function killHolder(job: JobState): Promise<void> {
  if (!job.holderPid || !/^\d+$/.test(job.holderPid)) return;
  try {
    await job.executor.exec(`kill -TERM ${job.holderPid} 2>/dev/null || true`, { timeoutMs: 5_000 });
  } catch { /* best-effort */ }
}

/** Deliver decoded bytes once, even when a poll splits a UTF-8 character. */
function publishOutput(job: JobState, chunk: string): void {
  if (!chunk) return;
  job.accumulated += chunk;
  relayCodexApprovals(job, chunk);
  const display = job.transform ? job.transform(chunk) : chunk;
  if (display) for (const listener of job.outputListeners) {
    try { listener(display); } catch { /* ignore subscriber errors */ }
  }
  if (job.steering && !job.steerEnded && /"type":\s*"result"/.test(chunk)) {
    job.steerEnded = true;
    void killHolder(job);
  }
}

async function tick(job: JobState): Promise<void> {
  // Slow targets must not overlap polls and advance the same byte cursor twice.
  if (job.done || job.polling) return;
  job.polling = true;
  try {
    // Read completion BEFORE the log. Once this exists the writer has closed,
    // so draining the log below includes the final answer without a huge cat.
    const ex = await job.executor.exec(`cat ${quoteArg(job.exitFile)} 2>/dev/null`, { timeoutMs: 5_000 });
    const codeStr = ex.stdout.trim();
    let exitCode: number | undefined;
    if (ex.exitCode === 0 && /^\d+$/.test(codeStr) && Number(codeStr) <= 255) exitCode = Number(codeStr);
    else if (ex.exitCode !== 1 || codeStr) throw new Error("Could not read CLI exit status");

    let drained = false;
    for (let i = 0; i < MAX_CHUNKS_PER_TICK; i++) {
      // Base64 preserves raw byte offsets across local/SSH UTF-8 decoding.
      // pipefail propagates a missing/unreadable log instead of losing output.
      const script = `set -o pipefail; dd if=${quoteArg(job.logFile)} bs=65536 skip=${job.byteOffset} count=${LOG_CHUNK_BYTES} iflag=skip_bytes,count_bytes status=none | base64 -w0`;
      const r = await job.executor.exec(`bash -c ${quoteArg(script)}`, { timeoutMs: 10_000 });
      if (r.exitCode !== 0) throw new Error("Could not read CLI log chunk");
      if (job.done) return;
      const bytes = Buffer.from(r.stdout.trim(), "base64");
      job.byteOffset += bytes.length;
      publishOutput(job, job.decoder.write(bytes));
      if (bytes.length < LOG_CHUNK_BYTES) { drained = true; break; }
    }
    if (!drained) return; // Continue replay next tick before finalizing.

    if (exitCode === undefined) {
      if (Date.now() - job.startedAt < PROCESS_PROBE_MS || Date.now() - job.lastProcessProbe < PROCESS_PROBE_MS) return;
      if (!job.pid || !/^[1-9]\d*$/.test(job.pid)) return;
      job.lastProcessProbe = Date.now();
      const process = await job.executor.exec(`ps -p ${job.pid} -o stat=`, { timeoutMs: 5_000 });
      const state = process.stdout.trim();
      const missing = (process.exitCode === 1 && !state) || (process.exitCode === 0 && /^[ZX]/.test(state));
      if (!missing) {
        if (process.exitCode !== 0 || !state) throw new Error("Could not check CLI process status");
        job.missingProcessChecks = 0;
        return; // A live job has no arbitrary maximum duration.
      }
      if (++job.missingProcessChecks < 2) return;
      exitCode = CLI_EXIT_UNCONFIRMED;
      log.warn({ jobId: job.jobId }, "CLI process disappeared without a recorded exit status");
    }

    if (job.done) return;
    publishOutput(job, job.decoder.end());
    clearInterval(job.timer);
    job.done = true;
    job.exitCode = exitCode;
    jobs.delete(executionKey(job.jobId, job.executor.target.id));

    log.info({ jobId: job.jobId, exitCode, bytes: job.accumulated.length }, "CLI job completed");

    // Fire done listeners (active SSE generators waiting for completion)
    for (const l of job.doneListeners) {
      try { l(job.accumulated, exitCode); } catch { /* ignore */ }
    }

    // Push notification only when no live SSE was consuming the output
    if (!job.hasActiveStream) {
      // Cuerpo LEGIBLE: último bloque narrativo del log (sin ANSI, sin
      // marcadores de herramienta) + JSON humanizado. El `slice(-500)` previo
      // metía la cola cruda del log en la campana (bug 2026-08-25).
      let preview = "";
      try {
        preview = deriveNotificationPreview(undefined, job.accumulated, 160);
      } catch (err) {
        log.warn({ jobId: job.jobId, err: (err as Error).message }, "preview humanize failed");
      }
      const eventName = exitCode === 0 ? Events.CLI_JOB_COMPLETED : Events.CLI_JOB_FAILED;
      eventBus.emit(eventName, {
        jobId: job.jobId,
        targetId: job.executor.target.id,
        ...(getContextUserId() !== null ? { userId: getContextUserId() } : {}),
        serverName: job.serverName,
        title: job.notificationCtx.title,
        link: job.notificationCtx.link,
        preview: preview || "Tarea completada.",
        exitCode,
        ...(job.conversationId ? { conversationId: job.conversationId } : {}),
        ...(job.provider ? { provider: job.provider } : {}),
      });
    }

    // Best-effort cleanup of temp files on the target
    if (exitCode !== CLI_EXIT_UNCONFIRMED) void job.executor
      .exec(`rm -f ${quoteArg(job.logFile)} ${quoteArg(job.exitFile)}`, { timeoutMs: 5_000 })
      .catch(() => undefined);
  } catch (err) {
    // A failed connection/check is unknown, never evidence of a dead process.
    job.missingProcessChecks = 0;
    log.warn({ jobId: job.jobId, err: (err as Error).message }, "CLI job poll error");
  } finally {
    job.polling = false;
  }
}

export const cliJobTracker = {
  /**
   * Register a newly launched background job and start polling.
   * Call immediately after the nohup launch command returns the PID.
   */
  start(opts: {
    jobId: string;
    logFile: string;
    exitFile: string;
    executor: Executor;
    serverName: string;
    notificationCtx: { title: string; link: string };
    transform?: (rawChunk: string) => string;
    pid?: string;
    conversationId?: string;
    /** CLI provider id (claude/codex/gemini/…) — viaja a la notificación. */
    provider?: string;
    /** Live-steering channel + FIFO holder PID (ASSISTANT_LIVE_STEERING). */
    steer?: (text: string) => Promise<void>;
    holderPid?: string;
    steering?: boolean;
    /** Preserve the ORIGINAL launch time when re-registering a job for recovery
     *  (after a panel restart) so the max-runtime budget + duration stay correct.
     *  Omitted for a fresh launch → defaults to now. */
    startedAt?: number;
  }): CliJob {
    const job: JobState = {
      jobId: opts.jobId,
      logFile: opts.logFile,
      exitFile: opts.exitFile,
      executor: opts.executor,
      serverName: opts.serverName,
      notificationCtx: opts.notificationCtx,
      transform: opts.transform,
      pid: opts.pid,
      conversationId: opts.conversationId,
      provider: opts.provider,
      steer: opts.steer,
      holderPid: opts.holderPid,
      steering: opts.steering,
      startedAt: opts.startedAt ?? Date.now(),
      accumulated: "",
      byteOffset: 0,
      decoder: new StringDecoder("utf8"),
      polling: false,
      lastProcessProbe: 0,
      missingProcessChecks: 0,
      done: false,
      hasActiveStream: false,
      approvalBuffer: "",
      seenApprovals: new Set(),
      outputListeners: new Set(),
      doneListeners: new Set(),
      // Placeholder — set immediately below so the closure captures the right ref
      timer: null as unknown as ReturnType<typeof setInterval>,
    };
    const userId = getContextUserId() ?? undefined;
    const user = getContextUser() ?? undefined;
    job.timer = setInterval(() => void runWithExecutor(opts.executor, () => tick(job), userId, user), POLL_MS);
    jobs.set(executionKey(opts.jobId, opts.executor.target.id), job);
    log.info({ jobId: opts.jobId, server: opts.serverName }, "CLI job registered");
    return job;
  },

  get(jobId: string): CliJob | undefined {
    return jobs.get(executionKey(jobId));
  },

  /** True when a background CLI job is still being tracked for this
   *  conversation (used by the team task board to tell "alive" from
   *  "orphaned by a restart" before reconciling a running task). */
  hasJobForConversation(conversationId: string, targetId = executionTargetId()): boolean {
    for (const job of jobs.values()) {
      if (job.executor.target.id === targetId && job.conversationId === conversationId) return true;
    }
    return false;
  },

  /** Subscribe to incremental output chunks. Returns an unsubscribe fn. */
  subscribeOutput(jobId: string, listener: OutputListener): () => void {
    const job = jobs.get(executionKey(jobId));
    if (!job) return () => {};
    job.outputListeners.add(listener);
    return () => job.outputListeners.delete(listener);
  },

  /** Subscribe to the job-done signal. Returns an unsubscribe fn. */
  subscribeDone(jobId: string, listener: DoneListener): () => void {
    const job = jobs.get(executionKey(jobId));
    if (!job) return () => {};
    job.doneListeners.add(listener);
    return () => job.doneListeners.delete(listener);
  },

  /**
   * Inject a live "addendum" into the in-flight turn of a conversation (steering).
   * Writes one NDJSON user message to the running CLI's stdin FIFO so the agent
   * picks it up mid-run. Returns true when a steerable, still-running job was
   * found and the write was issued; false otherwise (caller then falls back to
   * a continuation turn). No-op for jobs launched without a steering FIFO.
   */
  async steerConversation(conversationId: string, text: string): Promise<boolean> {
    const targetId = executionTargetId();
    let delivered = false;
    for (const job of [...jobs.values()]) {
      if (job.executor.target.id !== targetId || job.conversationId !== conversationId) continue;
      if (job.done || job.steerEnded || !job.steer) continue;
      try {
        await job.steer(text);
        delivered = true;
      } catch (err) {
        log.warn({ jobId: job.jobId, err: (err as Error).message }, "steer write failed");
      }
    }
    return delivered;
  },

  /**
   * Mark whether an active SSE generator is consuming this job's output.
   * When false at completion, the tracker fires a push notification.
   */
  setActiveStream(jobId: string, isActive: boolean): void {
    const job = jobs.get(executionKey(jobId));
    if (job) job.hasActiveStream = isActive;
  },

  /**
   * Hard-stop every background CLI job of a conversation (user pressed "stop").
   *
   * Detaching the SSE alone left the `nohup`'d CLI burning on the target until
   * it finished on its own. This kills the whole process tree (the launched
   * `bash -c` parent and every descendant the agent spawned), stops polling, and
   * wakes any attached stream by firing the done listeners with a SIGTERM-style
   * exit code so the provider generator settles instead of hanging. Best-effort:
   * the process may already be gone. Returns how many jobs were targeted.
   */
  killForConversation(conversationId: string, targetId = executionTargetId()): number {
    let killed = 0;
    for (const job of [...jobs.values()]) {
      if (job.executor.target.id !== targetId || job.conversationId !== conversationId) continue;
      killed++;
      job.done = true;
      job.exitCode = 143;
      clearInterval(job.timer);
      jobs.delete(executionKey(job.jobId, job.executor.target.id));
      // Free the FIFO holder first (steering jobs) so it can't linger holding
      // the pipe open after the CLI tree is gone.
      void killHolder(job);

      // Kill the process tree on the target (own user → no sudo needed). The
      // recursive walk reaps grandchildren the agent's tools may have spawned.
      if (job.pid && /^\d+$/.test(job.pid)) {
        const kt = `kt(){ for c in $(pgrep -P "$1" 2>/dev/null); do kt "$c"; done; kill -TERM "$1" 2>/dev/null; }; kt ${job.pid}`;
        void job.executor
          .exec(`bash -c '${kt.replaceAll("'", "'\\''")}'`, { timeoutMs: 8_000 })
          .catch(() => undefined);
      }

      // 143 = 128 + SIGTERM(15): tells the provider this run was stopped.
      for (const l of job.doneListeners) {
        try { l(job.accumulated, 143); } catch { /* ignore */ }
      }

      // Best-effort cleanup of the job's temp artifacts (prompt/log/exit + the
      // per-job sudo askpass dir). The CLI's own cleanup may not run once killed.
      void job.executor
        .exec(`rm -rf /tmp/${job.jobId}* ${cliSecretsDir(job.jobId)}`, { timeoutMs: 5_000 })
        .catch(() => undefined);

      log.info({ jobId: job.jobId, server: job.serverName }, "CLI job killed by user stop");
    }
    return killed;
  },
};
