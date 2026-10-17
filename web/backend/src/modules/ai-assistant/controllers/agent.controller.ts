import { enqueueAgentTurn } from "../services/queued-turn-admission.js";
import { resolveConversationBinding } from "../services/agent-context.service.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agent controller — SSE endpoint that streams agentic AI events.
 *
 * POST /api/ai/agent
 * Body: { messages: AgentMessage[], withContext?: boolean }
 *
 * Streams newline-delimited SSE events:
 *   data: {"type":"text","delta":"..."}
 *   data: {"type":"tool_use","id":"...","name":"...","input":{...}}
 *   data: {"type":"tool_result","id":"...","success":true,"output":"..."}
 *   data: {"type":"done"}
 *   data: {"type":"error","message":"..."}
 *
 * Runs WITH a conversationId are decoupled from this connection via
 * `agentRunRegistry`: the run keeps going (and persists) even if the client
 * disconnects mid-stream (e.g. the mobile WebView gets frozen on app-switch).
 * See agent-run-registry.ts for the full rationale.
 */

import { z } from "zod";
import { chatAttachmentSchema } from "../models/chat-attachment.js";
import type { Request, Response } from "express";
import { agentService } from "../services/agent.service.js";
import { agentRunRegistry } from "../services/agent-run-registry.js";
import { permissionBroker } from "../services/permission-broker.js";
import { cliJobTracker } from "../services/cli-job-tracker.service.js";
import { cliJobsRepository } from "../repositories/cli-jobs.repository.js";
import { cliSessionsRepository } from "../repositories/cli-sessions.repository.js";
import type { CliJobDescriptor } from "../repositories/cli-jobs.repository.js";
import { recoverConversation } from "../services/cli-run-recovery.service.js";
export { recoverConversation } from "../services/cli-run-recovery.service.js";
import { activeCodexWriterSessions } from "../services/providers/cli/cli-session.js";
import { getExecutor } from "../../../shared/executor/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { panelOriginFromRequest } from "../../../shared/http/panel-origin.js";
import { openSse } from "../../../shared/http/sse.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { slashCommandsService } from "../services/slash-commands.service.js";
import { assessContext } from "../services/context-window.service.js";
import { compactConversation } from "../services/compaction.service.js";
import { PROVIDER_IDS, resolveAgentRunProvider } from "../models/assistant-config.types.js";
import type { AgentEvent } from "../services/agent.service.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { mintCrossMcpToken, mintGraphMcpToken } from "../services/mcp-run-tokens.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { ConflictError } from "../../../shared/errors/index.js";
import { env } from "../../../config/env.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
// Connection-independent turn pipeline (persist/translate/run/drain + team
// nudge) — extracted to turn-queue.service so background drains and event-bus
// listeners never depend on express. The controller keeps SSE/transport only.
import {
  MAX_MSG_CONTENT,
  type AgentTurnMessage,
  persistUserMessage,
  buildMessagesFromHistory,
  makeUsageRecorder,
  startConversationRun,
  drainConversationQueue,
} from "../services/turn-queue.service.js";

const log = createModuleLogger("ai-agent-controller");

/**
 * Ownership gate for the run-control endpoints. Execution registries also
 * check the selected server; conversation membership prevents one user from
 * attaching to another user's SSE stream, aborting their run, steering text into their
 * live turn, or resolve their pending permission prompt. Returns true only when
 * the conversation belongs to THIS (server, user) scope — the same membership
 * set `activeRuns` intersects with. Fails closed on any lookup error.
 */
async function ownsConversation(req: Request, conversationId: string): Promise<boolean> {
  try {
    const ownIds = await conversationsRepository.listIds(getExecutor(req));
    return ownIds.has(conversationId);
  } catch (err) {
    log.warn({ err: (err as Error).message, conversationId }, "agent: ownership check failed");
    return false;
  }
}

const agentSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(MAX_MSG_CONTENT), // may be empty when only attachments are sent
  })).min(1).max(50),
  withContext: z.boolean().default(true),
  /** Conversation to persist this turn into (ChatGPT-style history). */
  conversationId: z.string().max(64).optional(),
  /** Provider override (multi-provider tabs). Defaults to activeProvider. */
  provider: z.enum(PROVIDER_IDS).optional(),
  /**
   * Model override for THIS turn only (in-chat model picker). Patched onto the
   * in-memory provider config by agentService.run — never persisted to the
   * sidecar. Contract shared with the frontend track.
   */
  model: z.string().max(64).optional(),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
  /** Project context (working dir + instructions) for this turn. */
  projectId: z.string().max(64).nullable().optional(),
  /** Custom agent driving this turn (system prompt + tool subset + provider/model). */
  agentId: z.string().max(64).nullable().optional(),
  /** Files attached to the latest user message (base64). */
  attachments: z.array(chatAttachmentSchema)
    .max(8)
    .optional(),
  /**
   * "approve" cuando este turno responde afirmativamente a un ask
   * `askKind:"plan-approval"` (botón "Aprobar plan"). Validado server-side
   * contra el último turno assistant persistido; si valida, el run corre con
   * `approvalModeOverride:"auto"` para ejecutar el plan aprobado.
   */
  planDecision: z.literal("approve").optional(),
});

const stopSchema = z.object({
  conversationId: z.string().max(64),
});

const inputSchema = z.object({
  conversationId: z.string().max(64),
  text: z.string().min(1).max(MAX_MSG_CONTENT),
});

const permissionSchema = z.object({
  conversationId: z.string().max(64),
  requestId: z.string().max(64),
  // "always" = approve AND remember: resolve as allow, then add `tool` to the
  // run's live set + the persisted "never ask again" allowlist.
  decision: z.enum(["allow", "deny", "always"]),
  /** Tool name to remember when decision is "always" (from the prompt). */
  tool: z.string().max(128).optional(),
});

const enqueueSchema = z.object({
  conversationId: z.string().max(64),
  userText: z.string().max(MAX_MSG_CONTENT),
  provider: z.enum(PROVIDER_IDS).optional(),
  /** Per-turn model override (in-chat picker), persisted so the background
   *  drain reuses it. Shared contract with the frontend track. */
  model: z.string().max(64).optional(),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
  projectId: z.string().max(64).nullable().optional(),
  agentId: z.string().max(64).nullable().optional(),
  withContext: z.boolean().default(true),
  attachments: z.array(chatAttachmentSchema)
    .max(8)
    .optional(),
  /** Igual que agentSchema.planDecision — el drain re-valida server-side. */
  planDecision: z.literal("approve").optional(),
});

type AgentBody = z.infer<typeof agentSchema>;

async function resolveRunTarget(
  executor: Executor | null | undefined,
  input: {
    conversationId?: string;
    provider?: AgentBody["provider"];
    model?: string;
    projectId?: string | null;
    agentId?: string | null;
  },
): Promise<{
  provider?: AgentBody["provider"];
  model?: string;
  projectId?: string | null;
  agentId?: string | null;
}> {
  let provider = input.provider;
  let model = input.model?.trim() ? input.model : undefined;
  let projectId = input.projectId ?? null;
  let agentId = input.agentId ?? null;

  if (input.conversationId) {
    const meta = await conversationsRepository.getMeta(executor, input.conversationId).catch(() => null);
    if (!agentId && meta?.agentId) agentId = meta.agentId;
    if (!provider && meta?.provider && PROVIDER_IDS.includes(meta.provider as typeof PROVIDER_IDS[number])) {
      provider = meta.provider as AgentBody["provider"];
    }
    if (projectId == null && meta?.projectId) projectId = meta.projectId;
    if (input.model === undefined && (!input.provider || input.provider === meta?.provider)) model = meta?.model || undefined;
  }

  const binding = await resolveConversationBinding(executor, input);
  projectId = binding.projectId; agentId = binding.agentId;
  if (binding.agent) provider = resolveAgentRunProvider(input.provider, model, binding.agent.providerId);
  return { provider, model, projectId, agentId };
}

/* persistUserMessage / persistAssistantMessage, the background-translation
 * plumbing (resolveTranslation / buildTranslateHooks), buildMessagesFromHistory,
 * makeUsageRecorder, startConversationRun and drainConversationQueue moved to
 * ../services/turn-queue.service.ts (no req/res — usable from background
 * drains and event-bus listeners). */

// ── Restart recovery (P0) ───────────────────────────────────────────────────

/**
 * Reconstruct a decoupled run for a CLI background job that survived a panel
 * restart (re-attach via `makeRecoveredCliGen`). Persists the answer, drops the
 * recovery descriptor, and drains the queue on completion — exactly like a
 * normal CLI run. `user` is pinned into the detached run scope so the per-user
 * sidecars (conversation history, descriptor, queue) resolve to the right place.
 */
/**
 * Restart recovery for everything on the connected server (this user): re-attach
 * to surviving CLI jobs and re-drain any follow-up queues whose in-memory
 * drainer died with the old process. Idempotent + cheap once descriptors/queues
 * are cleared (each guarded by `registry.has`/`isActive`). Returns counts.
 */
export async function recoverServerRuns(
  executor: Executor,
  user?: SessionUser,
): Promise<{ recovered: number; drained: number }> {
  let recovered = 0;
  let drained = 0;

  let descs: CliJobDescriptor[] = [];
  try {
    descs = await cliJobsRepository.list(executor);
  } catch (err) {
    log.warn({ err: (err as Error).message }, "agent: recovery descriptor list failed");
  }
  for (const d of descs) {
    if (!d.conversationId) continue;
    try {
      if (await recoverConversation(executor, d.conversationId, user)) recovered++;
    } catch (err) {
      log.warn({ err: (err as Error).message, conversationId: d.conversationId }, "agent: recoverConversation failed");
    }
  }

  // A failed duplicate resume can overwrite and then remove the original job
  // descriptor. Match live Codex writers to this user's stored sessions so the
  // drawer-open recovery still finds them, even when no descriptor remains.
  const writers = await activeCodexWriterSessions(executor);
  if (writers.size) {
    try {
      const sessions = await cliSessionsRepository.listAll(executor);
      for (const session of sessions) {
        const sessionId = session.providers?.codex?.codex ?? session.codex;
        if (!session.id || !sessionId || !writers.has(sessionId) || agentRunRegistry.has(session.id, executor.target.id)) continue;
        try {
          if (await recoverConversation(executor, session.id, user)) recovered++;
        } catch (err) {
          log.warn({ err: (err as Error).message, conversationId: session.id }, "agent: orphan recovery failed");
        }
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, "agent: CLI session list failed during orphan recovery");
    }
  }

  let pendingConvs: string[] = [];
  try {
    pendingConvs = await agentQueueRepository.listConversationsWithPending(executor);
  } catch (err) {
    log.warn({ err: (err as Error).message }, "agent: pending-queue scan failed");
  }
  for (const cid of pendingConvs) {
    if (agentRunRegistry.isActive(cid, executor.target.id)) continue;
    try {
      await drainConversationQueue(executor, cid);
      drained++;
    } catch (err) {
      log.warn({ err: (err as Error).message, conversationId: cid }, "agent: queue re-drain failed");
    }
  }

  return { recovered, drained };
}

/**
 * Open SSE headers + a keep-alive heartbeat. Returns the writer + a cleanup.
 *
 * Thin adapter over the shared `openSse()` (B-24): the only assistant-specific
 * bit is that events carry a monotonic `seq` as the SSE `id:`, which lets a
 * reconnecting client resume via `Last-Event-ID`.
 */
function setupSse(res: Response): {
  send: (event: AgentEvent, seq?: number) => void;
  stopHeartbeat: () => void;
} {
  // CLI-mode runs a single blocking exec that emits nothing for the whole call,
  // so the stream sits idle for tens of seconds — the shared heartbeat is what
  // stops Cloudflare's HTTP/3 layer from killing it (ERR_QUIC_PROTOCOL_ERROR).
  const sse = openSse(res);
  return {
    send: (event: AgentEvent, seq?: number) =>
      sse.send(event, seq !== undefined ? { id: seq } : {}),
    stopHeartbeat: () => sse.close(),
  };
}

/**
 * Stream an existing registry run to the client: replay buffered events from
 * `fromSeq`, then live ones, until a terminal event or the client disconnects.
 * A disconnect just detaches — the run keeps going in the registry (this is the
 * whole point: a frozen mobile WebView no longer aborts the agent).
 */
async function streamRunToClient(
  req: Request,
  res: Response,
  conversationId: string,
  fromSeq: number,
): Promise<void> {
  const { send, stopHeartbeat } = setupSse(res);

  await new Promise<void>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      resolve();
    };

    const onEvent = (event: AgentEvent, seq: number) => {
      send(event, seq);
      if (event.type === "done" || event.type === "error") finish();
    };

    unsubscribe = agentRunRegistry.attach(conversationId, fromSeq, onEvent);
    if (!unsubscribe) {
      // Run already GC'd / never existed — nothing to stream.
      send({ type: "done" });
      finish();
      return;
    }
    req.on("close", finish);
  });

  stopHeartbeat();
  if (!res.writableEnded) res.end();
}

/** Parse `Last-Event-ID` (or `?fromSeq=`) → the next seq to replay from. */
function resumeFromSeq(req: Request): number {
  const raw = Number(req.header("Last-Event-ID") ?? req.query["fromSeq"] ?? -1);
  return Number.isFinite(raw) ? raw + 1 : 0;
}

// Acuñación de tokens MCP por-run: extraída a `services/mcp-run-tokens.ts`
// para que el drain de la cola (turn-queue) acuñe tokens frescos sin Request.

export const agentController = {
  /** POST /api/ai/agent — stream agent events via SSE. */
  async run(req: Request, res: Response): Promise<void> {
    let body: AgentBody;
    try {
      body = agentSchema.parse(req.body);
    } catch (err: unknown) {
      log.warn({ err: (err as Error).message }, "agent: invalid request body");
      res.status(400).json({ ok: false, error: apiErrorMessage(res.locals.locale, "validation") });
      return;
    }

    log.info(
      {
        provider: body.provider,
        conversationId: body.conversationId,
        attachments: body.attachments?.map((a) => ({ name: a.name, mime: a.mimeType, kb: Math.round(a.dataBase64.length / 1024) })) ?? [],
      },
      "agent: incoming request",
    );

    const sessionUser = res.locals["user"] as SessionUser | undefined;
    const userId = sessionUser?.userId;
    const executor = getExecutor(req);

    // Per-run cross-server channel inputs: captured from THIS request (the
    // decoupled run has no req later). agent.service only uses them when the
    // project has associated servers and the provider is the Claude CLI.
    const panelOrigin = panelOriginFromRequest(req);
    const crossMcpToken = mintCrossMcpToken(sessionUser, body.conversationId);
    const graphMcpToken = mintGraphMcpToken(sessionUser, body.conversationId);

    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
    const conversationId = body.conversationId;

    // Remember whether this run was a CLI-mode answer. Persisted on the
    // assistant message so history can re-render the terminal-styled bubble
    // (instead of ballooning the raw `$ …` terminal stream as markdown).
    //
    // The reliable signal is the `.cli` tool_use event: the CLI bridge emits
    // it the instant the job launches, BEFORE any output, so it survives every
    // CLI exit path. The usage event is NOT reliable here — an early CLI error
    // (e.g. a stale `--resume` session) or an SSE detach finishes the run
    // without ever emitting `usage`, which used to leave the turn unflagged and
    // rendered as ballooned markdown on reload.
    // Tracks whether this run was a CLI answer (persisted on the assistant
    // turn). Only the decoupled path persists; the legacy inline path below
    // has no conversation, so the holder is effectively write-only there.
    const resolvedTarget = await resolveRunTarget(executor, {
      conversationId,
      provider: body.provider,
      model: body.model,
      projectId: body.projectId ?? null,
      agentId: body.agentId ?? null,
    });

    const cliHolder = { value: false };
    const recordUsage = makeUsageRecorder({
      executor,
      provider: resolvedTarget.provider,
      conversationId: conversationId ?? null,
      projectId: resolvedTarget.projectId ?? null,
      userId: userId !== undefined ? String(userId) : null,
      cliHolder,
    });

    const runOptions = {
      withContext: body.withContext,
      userId: userId !== undefined ? String(userId) : undefined,
      user: sessionUser,
      providerId: resolvedTarget.provider,
      model: resolvedTarget.model,
      effort: body.effort,
      projectId: resolvedTarget.projectId ?? undefined,
      agentId: resolvedTarget.agentId ?? undefined,
      conversationId,
      attachments: body.attachments,
      ...(panelOrigin ? { panelOrigin } : {}),
      ...(crossMcpToken ? { crossMcpToken } : {}),
      ...(graphMcpToken ? { graphMcpToken } : {}),
    };

    // ── Decoupled path (has conversationId) ─────────────────────────────────
    // The run is owned by the registry: it survives this connection dropping
    // and persists on its own. A torn-down WebView socket no longer aborts the
    // agent or loses the answer — the client just reloads the conversation.
    if (conversationId && lastUser) {
      // A CLI process can survive a backend restart while the in-memory run
      // registry does not. Restore it before deciding whether this message can
      // start a new run; otherwise Codex resumes a thread with an active writer.
      await recoverConversation(executor, conversationId, sessionUser);
      // A run is ALREADY streaming for this conversation. Starting a fresh run
      // here would call `agentRunRegistry.start`, which returns the existing run
      // and IGNORES these new `messages` — silently dropping the user's latest
      // message while replaying the in-flight run's buffer. (The frontend tries
      // to avoid this by enqueuing when it detects a live run, but that check is
      // racy: a dropped SSE socket, a stale `active` poll, or a second tab can
      // all let a fresh POST slip through.) The backend is authoritative: queue
      // the turn on the server so it drains right after the current run finishes,
      // then attach the client to the live run so it still sees progress.
      if (agentRunRegistry.isActive(conversationId, executor.target.id)) {
        await agentQueueRepository
          .enqueue(executor, {
            conversationId,
            provider: resolvedTarget.provider,
            model: resolvedTarget.model,
            effort: body.effort,
            projectId: resolvedTarget.projectId ?? null,
            agentId: resolvedTarget.agentId ?? null,
            withContext: body.withContext,
            // Display-language text; the drain path translates it like a live send.
            userText: lastUser.content,
            attachments: body.attachments,
            userId: userId !== undefined ? String(userId) : null,
            user: sessionUser ?? null,
            ...(body.planDecision ? { planDecision: body.planDecision } : {}),
          })
          .catch((err) =>
            log.warn({ err: (err as Error).message }, "agent: enqueue while live-run failed"),
          );
        await streamRunToClient(req, res, conversationId, resumeFromSeq(req));
        return;
      }

      // Tope de corridas concurrentes POR USUARIO (recursos/abuso): arrancar
      // una corrida nueva con N ya vivas en otras conversaciones se rechaza
      // con 409 tipado. Los turnos sobre una conversación con run vivo no
      // llegan aquí (se encolan arriba y drenan en serie).
      const maxRuns = env.ASSISTANT_MAX_CONCURRENT_RUNS_PER_USER;
      if (maxRuns > 0 && userId !== undefined && agentRunRegistry.activeCountForUser(Number(userId)) >= maxRuns) {
        throw new ConflictError(
          `Tienes ${maxRuns} ejecuciones del asistente en curso. Espera a que termine alguna (o deténla) antes de iniciar otra.`,
        );
      }

      // No live run → start a fresh one. Persist the user's message up-front so
      // the thread stays non-blank if the client reloads mid-run.
      let outgoingMessages: AgentTurnMessage[] = body.messages;
      await persistUserMessage(executor, conversationId, lastUser.content, body.provider, body.attachments);

      // Aprobación de plan: el frontend manda `planDecision:"approve"` al elegir
      // la PRIMERA opción de un ask `askKind:"plan-approval"`. Se valida contra
      // el último turno assistant PERSISTIDO (nunca contra el texto de la
      // respuesta, que puede venir traducido) y, si cuadra, el run corre con
      // `approvalModeOverride:"auto"` para ejecutar el plan aprobado. El
      // frontend ya persistió el modo automático antes de enviar este turno.
      // Se evalúa ANTES de la auto-compactación para que
      // un plegado no borre el `askKind` del turno a validar.
      let approvalModeOverride: "auto" | undefined;
      if (body.planDecision === "approve") {
        try {
          const all = await conversationsRepository.allMessages(executor, conversationId);
          const lastAssistant = [...all].reverse().find((m) => m.role === "assistant");
          if (lastAssistant?.askKind === "plan-approval" && lastAssistant.ask?.length) {
            approvalModeOverride = "auto";
          }
        } catch {
          /* fail-closed: sin validación no hay override (el turno corre en modo plan) */
        }
      }

      // Context-window guard: a very long conversation (especially CLI, which
      // resumes its own ever-growing upstream transcript) overruns the model
      // window and starts silently dropping recent turns — the user's repeated
      // requests "no se quedan". If we're past the auto-compact threshold, fold
      // the older turns into a summary FIRST, then rebuild the outgoing context
      // from the rewritten history. The just-persisted user message is in the
      // kept tail, so the current request is preserved verbatim. Best-effort:
      // a summary failure degrades to mechanical and never blocks the send.
      // Slash commands are skipped (they aren't real queries).
      if (!slashCommandsService.isSlash(lastUser.content)) {
        try {
          const all = await conversationsRepository.allMessages(executor, conversationId);
          if (assessContext(all).shouldAutoCompact) {
            const r = await compactConversation(executor, conversationId);
            if (r.compacted) {
              log.info({ conversationId, method: r.method, before: r.before, after: r.after, tokensBefore: r.tokensBefore, tokensAfter: r.tokensAfter }, "agent: auto-compacted before run");
              outgoingMessages = await buildMessagesFromHistory(executor, conversationId);
            }
          }
        } catch (err) {
          log.warn({ conversationId, err: (err as Error).message }, "agent: auto-compaction failed (continuing)");
        }
      }

      startConversationRun({
        executor,
        conversationId,
        messages: outgoingMessages,
        provider: resolvedTarget.provider,
        model: resolvedTarget.model,
        effort: body.effort,
        projectId: resolvedTarget.projectId ?? null,
        agentId: resolvedTarget.agentId ?? null,
        withContext: body.withContext,
        attachments: body.attachments,
        user: sessionUser,
        userId: userId !== undefined ? String(userId) : undefined,
        ...(panelOrigin ? { panelOrigin } : {}),
        ...(crossMcpToken ? { crossMcpToken } : {}),
        ...(graphMcpToken ? { graphMcpToken } : {}),
        ...(approvalModeOverride ? { approvalModeOverride } : {}),
      });

      await streamRunToClient(req, res, conversationId, resumeFromSeq(req));
      return;
    }

    // ── Legacy inline path (no conversationId → nothing to persist/resume) ───
    // Keep the original request-bound behaviour: aborting the request aborts
    // the run. There is no conversation to reconcile against on reload anyway.
    const { send, stopHeartbeat } = setupSse(res);
    const ac = new AbortController();
    req.on("close", () => {
      stopHeartbeat();
      ac.abort();
    });

    try {
      for await (const event of agentService.run(body.messages, { ...runOptions, signal: ac.signal })) {
        if (ac.signal.aborted) break;
        recordUsage(event);
        send(event);
        if (event.type === "done" || event.type === "error") break;
      }
    } catch (err: unknown) {
      send({ type: "error", message: (err as Error).message ?? "Error interno del agente" });
    } finally {
      stopHeartbeat();
    }

    if (!res.writableEnded) res.end();
  },

  /**
   * GET /api/ai/agent/stream?conversationId=&fromSeq= — attach to an EXISTING
   * run without starting one. Used by the client to resume streaming after a
   * transient disconnect (e.g. mobile app-switch). Responds 204 when no run is
   * buffered for the conversation, signalling the client to reload history
   * instead (the answer already finished + persisted).
   */
  async attach(req: Request, res: Response): Promise<void> {
    const conversationId = String(req.query["conversationId"] ?? "");
    if (!conversationId) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "conversationIdRequired") });
      return;
    }
    // Ownership gate: never attach to a run whose conversation isn't in this
    // (server, user) scope. 204 = same "nothing to attach to" signal the client
    // already handles by reloading history — without leaking the run's existence.
    if (!(await ownsConversation(req, conversationId))) {
      res.status(204).end();
      return;
    }
    // A CLI background job may have survived a panel restart — try to re-attach
    // to it before telling the client "nothing here" (204).
    if (!agentRunRegistry.has(conversationId)) {
      const sessionUser = res.locals["user"] as SessionUser | undefined;
      await recoverConversation(getExecutor(req), conversationId, sessionUser).catch((err) =>
        log.warn({ err: (err as Error).message, conversationId }, "agent: attach recovery failed"),
      );
    }
    if (!agentRunRegistry.has(conversationId)) {
      res.status(204).end();
      return;
    }
    await streamRunToClient(req, res, conversationId, resumeFromSeq(req));
  },

  /**
   * POST /api/ai/agent/resume — restart recovery kick. Re-attaches to CLI
   * background jobs that survived a panel restart and re-drains follow-up queues
   * for THIS server/user. Called by the client on drawer open / return to
   * foreground. Per-server isolation is implicit: the descriptor + queue sidecars
   * live on the connected target and are read through this request's executor.
   */
  async resume(req: Request, res: Response): Promise<void> {
    const executor = getExecutor(req);
    const sessionUser = res.locals["user"] as SessionUser | undefined;
    let result = { recovered: 0, drained: 0 };
    try {
      result = await recoverServerRuns(executor, sessionUser);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "agent: resume recovery failed");
    }
    res.json({ ok: true, ...result });
  },

  /**
   * GET /api/ai/agent/active — list conversations with a live background run.
   * Used by the client to repaint "en curso" state in the Dashboard + chat list
   * after a WebView reload emptied the in-memory engine (the run kept going on
   * the backend). Scoped to the requester's OWN per-server conversations: we
   * intersect the global registry's active keys with this server's conversation
   * store, so a conversationId belonging to another server is never revealed.
   */
  async activeRuns(req: Request, res: Response): Promise<void> {
    const active = agentRunRegistry.activeRuns();
    if (active.length === 0) {
      res.json({ ok: true, runs: [] });
      return;
    }
    const executor = getExecutor(req);
    let ownIds: Set<string>;
    try {
      // Ids only: this endpoint is POLLED while a run is alive, and it just needs
      // the membership set. `list({ limit: 1000 })` was silently clamped to 200
      // by the repository's paging, so a run on an older chat dropped out of the
      // set and its "en curso" state stopped being reported.
      ownIds = await conversationsRepository.listIds(executor);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "agent: active-runs conversation list failed");
      res.json({ ok: true, runs: [] });
      return;
    }
    const runs = active
      .filter((r) => r.targetId === executor.target.id && ownIds.has(r.key))
      .map((r) => ({
        id: r.key,
        provider: r.provider ?? null,
        cli: r.cli,
        // True when the run is blocked on a permission prompt the user hasn't
        // answered — drives the "needs review" yellow dot in the chat list +
        // Dashboard, even when the user isn't streaming that chat.
        pendingPermission: permissionBroker.pendingCount(r.key) > 0,
      }));
    res.json({ ok: true, runs });
  },

  /** POST /api/ai/agent/stop — explicitly abort an in-flight run. */
  async stop(req: Request, res: Response): Promise<void> {
    let body: z.infer<typeof stopSchema>;
    try {
      body = stopSchema.parse(req.body);
    } catch {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "conversationIdRequired") });
      return;
    }
    if (!(await ownsConversation(req, body.conversationId))) {
      res.status(403).json({ ok: false, error: apiErrorMessage(res.locals.locale, "forbidden") });
      return;
    }
    const stopped = agentRunRegistry.stop(body.conversationId);
    // Deny + clear any pending permission prompt for this run so the blocked
    // approve MCP call returns immediately instead of hanging until its timeout.
    permissionBroker.cancelConversation(body.conversationId);
    // Also kill any background CLI process tree of this conversation — aborting
    // the run only detaches the stream; the `nohup`'d CLI would otherwise keep
    // running on the target until it finished on its own.
    const killed = cliJobTracker.killForConversation(body.conversationId);
    // The job is gone → drop its recovery descriptor so a later restart doesn't
    // try to re-attach to a killed job.
    await cliJobsRepository.delete(getExecutor(req), body.conversationId).catch(() => undefined);
    res.json({ ok: true, stopped, killed });
  },

  /**
   * POST /api/ai/agent/input — live "steering": inject an extra user message
   * ("añadidura") into the turn already in flight so the agent picks it up
   * mid-run, without waiting for it to finish. Only honoured for runs launched
   * with a steering stdin FIFO (claude/minimax under ASSISTANT_LIVE_STEERING).
   * Returns 409 when no steerable run is active so the client falls back to a
   * continuation turn. Session-authed (admin); conversationId scopes the target.
   */
  async input(req: Request, res: Response): Promise<void> {
    let body: z.infer<typeof inputSchema>;
    try {
      body = inputSchema.parse(req.body);
    } catch {
      res.status(400).json({ ok: false, error: apiErrorMessage(res.locals.locale, "validation") });
      return;
    }
    if (!(await ownsConversation(req, body.conversationId))) {
      res.status(403).json({ ok: false, error: apiErrorMessage(res.locals.locale, "forbidden") });
      return;
    }
    const delivered = await cliJobTracker.steerConversation(body.conversationId, body.text);
    if (!delivered) {
      // No live steerable run (steering off, run already settled, or non-FIFO
      // provider) → tell the client to deliver it as a continuation instead.
      res.status(409).json({ ok: false, error: apiModuleMessage(res.locals.locale, "noActiveRun") });
      return;
    }
    res.json({ ok: true, delivered: true });
  },

  /**
   * POST /api/ai/agent/permission — the user's approve/deny for a pending
   * `permission_request`. Resolves the blocked `permissions.approve` MCP call so
   * the Claude CLI continues (allow) or backs off (deny) within the same turn.
   * Session-authed (admin); the per-server conversationId scopes the decision.
   */
  async permission(req: Request, res: Response): Promise<void> {
    let body: z.infer<typeof permissionSchema>;
    try {
      body = permissionSchema.parse(req.body);
    } catch {
      res.status(400).json({ ok: false, error: apiErrorMessage(res.locals.locale, "validation") });
      return;
    }
    if (!(await ownsConversation(req, body.conversationId))) {
      res.status(403).json({ ok: false, error: apiErrorMessage(res.locals.locale, "forbidden") });
      return;
    }
    // "always" → approve now AND remember the tool. The CLI only understands
    // allow/deny, so resolve as "allow"; the remembering happens here.
    const verdict = body.decision === "always" ? "allow" : body.decision;
    const resolved = permissionBroker.resolve(body.conversationId, body.requestId, verdict);
    if (body.decision === "always" && body.tool) {
      // Skip the prompt for the REST of this run (in-memory)…
      agentRunRegistry.addAutoApproveTool(body.conversationId, body.tool);
      // …and persist it so FUTURE runs auto-approve too. Best-effort: a write
      // failure must not break the (already-resolved) approval.
      await assistantConfigRepository
        .addAutoApproveTool(body.tool, getExecutor(req))
        .catch(() => undefined);
    }
    // `resolved=false` just means the request already settled (double-click,
    // timed out, or run stopped) — not an error from the client's perspective.
    res.json({ ok: true, resolved });
  },

  /**
   * POST /api/ai/agent/enqueue — add a follow-up turn to the SERVER-side queue.
   * Used when a run is already in flight for the conversation. The queue is
   * persisted on the connected server and drained by the registry's
   * `onComplete`, so the chain keeps going even if the tab/app is closed. If no
   * run is active (the previous one already finished), the drain starts now.
   */
  async enqueue(req: Request, res: Response): Promise<void> {
    let body: z.infer<typeof enqueueSchema>;
    try {
      body = enqueueSchema.parse(req.body);
    } catch {
      res.status(400).json({ ok: false, error: apiErrorMessage(res.locals.locale, "validation") });
      return;
    }
    if (!body.userText.trim() && !body.attachments?.length) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "emptyMessage") });
      return;
    }
    const executor = getExecutor(req);
    const sessionUser = res.locals["user"] as SessionUser | undefined;

    const resolvedTarget = await resolveRunTarget(executor, {
      conversationId: body.conversationId,
      provider: body.provider,
      model: body.model,
      projectId: body.projectId ?? null,
      agentId: body.agentId ?? null,
    });

    const item = await enqueueAgentTurn(executor, {
      conversationId: body.conversationId,
      provider: resolvedTarget.provider,
      model: resolvedTarget.model,
      effort: body.effort,
      projectId: resolvedTarget.projectId ?? null,
      agentId: resolvedTarget.agentId ?? null,
      withContext: body.withContext,
      userText: body.userText,
      attachments: body.attachments,
      userId: sessionUser?.userId != null ? String(sessionUser.userId) : null,
      user: sessionUser ?? null,
      ...(body.planDecision ? { planDecision: body.planDecision } : {}),
    });

    await recoverConversation(executor, body.conversationId, sessionUser);
    if (!agentRunRegistry.isActive(body.conversationId, executor.target.id)) {
      void drainConversationQueue(executor, body.conversationId).catch((err) =>
        log.warn({ err: (err as Error).message }, "agent: enqueue drain failed"),
      );
    }

    const pending = await agentQueueRepository.listFor(executor, body.conversationId);
    res.json({
      ok: true,
      id: item.id,
      pending: pending.map((p) => ({ id: p.id, userText: p.userText })),
    });
  },

  /** GET /api/ai/agent/queue?conversationId= — list pending follow-ups. */
  async queueList(req: Request, res: Response): Promise<void> {
    const conversationId = String(req.query["conversationId"] ?? "");
    if (!conversationId) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "conversationIdRequired") });
      return;
    }
    const executor = getExecutor(req);
    const pending = await agentQueueRepository.listFor(executor, conversationId);
    res.json({ ok: true, pending: pending.map((p) => ({ id: p.id, userText: p.userText })) });
  },

  /**
   * GET /api/ai/agent/queue/:id — full content of one pending follow-up
   * (text + attachments), so the client can load it back into the composer for
   * editing. Attachments are returned inline (base64) on demand — they're NOT
   * included in the lightweight `queueList` to keep polling cheap.
   */
  async queueGet(req: Request, res: Response): Promise<void> {
    const id = String(req.params["id"] ?? "");
    if (!id) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "idRequired") });
      return;
    }
    const executor = getExecutor(req);
    const item = await agentQueueRepository.get(executor, id);
    if (!item) {
      res.status(404).json({ ok: false, error: apiErrorMessage(res.locals.locale, "notFound") });
      return;
    }
    res.json({
      ok: true,
      item: {
        id: item.id,
        userText: item.userText,
        provider: item.provider,
        projectId: item.projectId ?? null,
        attachments: item.attachments ?? [],
      },
    });
  },

  /** DELETE /api/ai/agent/queue/:id — cancel a pending follow-up. */
  async queueCancel(req: Request, res: Response): Promise<void> {
    const id = String(req.params["id"] ?? "");
    if (!id) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "idRequired") });
      return;
    }
    const executor = getExecutor(req);
    const removed = await agentQueueRepository.remove(executor, id);
    res.json({ ok: true, removed });
  },
};
