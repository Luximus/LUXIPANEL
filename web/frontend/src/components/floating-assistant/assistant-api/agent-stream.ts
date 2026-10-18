// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { scopeHeaders } from "@/lib/api-client";
import { modelSupportsVision, modelSupportsPdf } from "../vision-support";
import type { TeamTaskView } from "./team";

// ── Agent SSE chat ────────────────────────────────────────────────────────

export type AskQuestionType = "single" | "multi" | "text";

/** An interactive question a CLI agent posed instead of guessing. */
export interface AskQuestion {
  id: string;
  text: string;
  type: AskQuestionType;
  options?: string[];
}

// Frontend twin of the backend AgentEvent union. Keep in lockstep with
// backend/src/modules/ai-assistant/services/providers/provider.types.ts — the
// SSE `event:` payloads are decoded here by `type`, so a divergence silently
// drops or mis-handles a frame.
export interface AgentStreamState {
  type: "stream_state";
  runId: string;
  nextSeq: number;
  replayFromSeq: number;
  done: boolean;
}

export interface AgentStreamRecovery {
  reason: "run_changed" | "cursor_out_of_range" | "run_id_required";
  runId: string;
  requestedRunId?: string;
  nextSeq: number;
  done: boolean;
}

export type AgentEvent = (
  | AgentStreamState
  | { type: "text"; delta: string; phase?: "commentary" | "final_answer" }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; success: boolean; output: string }
  | { type: "usage"; model: string; inputTokens: number; outputTokens: number; estimated?: boolean }
  // `kind: "plan-approval"` → el ask es la aprobación de un plan (modo plan):
  // responder con la PRIMERA opción envía `planDecision:"approve"` para que el
  // siguiente turno pueda ejecutar con el gate manual.
  | { type: "ask"; id: string; questions: AskQuestion[]; kind?: "plan-approval" }
  // Background translation: live English deltas are suppressed; the bubble shows
  // this transient state, then the final answer arrives as one `text` event.
  | { type: "status"; state: "working" | "translating" }
  // Background translation degraded after retries: answer delivered untranslated
  // (English), this carries the reason. Rendered as a collapsed notice.
  | { type: "translation_error"; message: string }
  // Interactive permission gate (Claude CLI): the agent wants to run a mutating
  // tool. The bubble renders approve/deny buttons; the decision is POSTed back
  // mid-run (sendPermissionDecision) and the SAME turn continues.
  | { type: "permission_request"; id: string; tool: string; title: string; detail?: string }
  // The pending permission_request `id` was settled — clears the buttons (also
  // fires on buffer replay so a reconnecting client never re-shows it).
  | { type: "permission_resolved"; id: string; decision: "allow" | "deny" }
  // Team delegation (leader agents): a background task the leader assigned via
  // `team.assign` changed state. Injected into the leader's live stream so the
  // chat renders live progress cards; the board also rehydrates via
  // `teamApi.listTasks` after a reload.
  | { type: "team_task_update"; task: TeamTaskView }
  | { type: "done"; pending?: true; displaySummary?: string }
  | { type: "error"; message: string; code?: "AGENT_STREAM_RECONCILE_REQUIRED"; recovery?: AgentStreamRecovery }
) & { runId?: string };

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  /** Original user recording; only its transcript is sent to the agent. */
  voice?: { transcript: string };
  dataBase64: string;
}

/**
 * Per-(provider, mode, model) attachment capability. API providers accept what
 * the ACTIVE model's multimodal endpoint supports — gating per model, not just
 * provider, is what stops images reaching a text-only model (DeepSeek, MiniMax,
 * OpenAI o-mini) and erroring. CLI providers accept anything (the file is
 * written into the working dir and referenced in the prompt).
 */
const IMAGE = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const PDF = ["application/pdf"];
const DOCX = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

type AttachmentSupport = { enabled: boolean; accepts(mime: string): boolean; acceptAttr: string; label: string };

function makeAttachmentSupport(mimes: string[], label: string): AttachmentSupport {
  const set = new Set(mimes);
  return {
    enabled: mimes.length > 0,
    accepts: (mime: string) => set.has(mime),
    acceptAttr: mimes.join(","),
    label,
  };
}

export function attachmentSupport(
  provider: string,
  mode: "api" | "cli",
  model?: string,
): AttachmentSupport {
  if (mode === "cli") {
    // CLI reads files from the working dir — accept common doc/image types.
    // DeepSeek keeps its own text-only path; MiniMax uses the shared CLI bridge
    // and can consume uploaded file paths from the prompt like the other CLIs.
    if (provider === "deepseek") return makeAttachmentSupport([], "");
    return makeAttachmentSupport([...IMAGE, ...PDF, ...DOCX, "text/plain", "text/markdown"], "imágenes, pdf, docx, txt");
  }
  // API mode: gate by the active model's real vision/PDF capability.
  const img = modelSupportsVision(provider, model);
  const pdf = modelSupportsPdf(provider, model);
  if (img && pdf) return makeAttachmentSupport([...IMAGE, ...PDF], "imágenes, pdf");
  if (img) return makeAttachmentSupport([...IMAGE], "imágenes");
  return makeAttachmentSupport([], ""); // text-only model → attachments disabled
}

/**
 * One parsed SSE frame: the agent event plus its server sequence number
 * (`id:` line). `seq` lets a reconnecting client resume from where it left
 * off (`Last-Event-ID`) instead of replaying the whole stream.
 */
export interface AgentEventFrame {
  event: AgentEvent;
  seq: number;
}

/** Parse the SSE body of an agent stream into ordered event frames. */
async function* parseAgentSse(res: Response): AsyncGenerator<AgentEventFrame> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are separated by blank lines.
      let idx = buf.indexOf("\n\n");
      while (idx >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        idx = buf.indexOf("\n\n");
        const lines = frame.split("\n");
        let seq = -1; // Transport metadata has no id; never inherit the previous frame cursor.
        const idLine = lines.find((l) => l.startsWith("id: "));
        if (idLine) {
          const n = Number(idLine.slice(4).trim());
          if (Number.isSafeInteger(n) && n >= -1) seq = n;
        }
        const dataLine = lines.find((l) => l.startsWith("data: "));
        if (!dataLine) continue; // comment/heartbeat frame
        try {
          yield { event: JSON.parse(dataLine.slice(6)) as AgentEvent, seq };
        } catch {
          /* ignore non-JSON frame */
        }
      }
    }
  } finally {
    // Reconciliation can stop replay early and open another run explicitly.
    try { await reader.cancel(); } catch { /* The transport may already be closed. */ }
    reader.releaseLock();
  }
}

/** Read the backend's failure reason from a non-OK response. */
async function readErrorDetail(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { error?: string; message?: string };
      return j?.error || j?.message || "";
    }
    return (await res.text()).trim().slice(0, 300);
  } catch {
    return "";
  }
}

/**
 * Stream agent events from POST /api/ai/agent. Uses fetch + manual SSE
 * parser so we can ship the messages array as POST body (EventSource only
 * supports GET). Yields {event, seq} frames.
 */
export async function* streamAgent(
  messages: AgentMessage[],
  signal: AbortSignal,
  conversationId?: string,
  provider?: string,
  projectId?: string | null,
  attachments?: ChatAttachment[],
  // Per-turn model override (in-chat model selector). Optional contract field the
  // backend uses ONLY for this turn; absent → the provider's configured model.
  model?: string,
  // Custom agent bound to this conversation (system prompt + tool subset + provider/model).
  agentId?: string | null,
  // "approve" cuando este turno responde a un ask `kind:"plan-approval"` con su
  // primera opción (botón "Aprobar plan"). El backend lo re-valida server-side.
  planDecision?: "approve",
  effort?: "low" | "medium" | "high" | "xhigh" | "max",
): AsyncGenerator<AgentEventFrame> {
  const res = await fetch("/api/ai/agent", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "fetch",
      ...scopeHeaders(true),
    },
    // `agentId` / `projectId`: incluye el campo cuando llega un valor EXPRESO
    // (`string` o `null`). El truco `...(agentId ? { agentId } : {})` descartaba
    // `null`, así que las solicitudes kind "prompt" del bridge externo (que pasan
    // null explícito para sobreescribir el state del pane) acababan enviando el
    // campo omitido y el backend reusaba la conversación previa. Distinguimos:
    //   - string no vacío → include con ese id (chat del agente)
    //   - null literal   → include como null (chat NORMAL, reset)
    //   - undefined       → omit (no se quiere tocar el campo)
    body: JSON.stringify({
      messages,
      withContext: true,
      conversationId,
      provider,
      // projectId: incluimos SIEMPRE (string, null, o lo que llegue). El backend
      // acepta `projectId: null` para chats sueltos; omitirlo deja el projectId
      // anterior de una conversación ya persistida.
      projectId,
      attachments,
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      ...(agentId === undefined ? {} : { agentId: agentId ?? null }),
      ...(planDecision ? { planDecision } : {}),
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    // Surface the backend's reason so the bubble explains *why* it failed
    // instead of a bare status code.
    const detail = await readErrorDetail(res);
    const reason = detail ? ` · ${detail}` : "";
    yield { event: { type: "error", message: `HTTP ${res.status} ${res.statusText}${reason}` }, seq: -1 };
    return;
  }
  yield* parseAgentSse(res);
}

/**
 * Resume an in-flight (or just-finished) run via GET /api/ai/agent/stream,
 * WITHOUT starting a new one. Returns `null` when the backend has no buffered
 * run for the conversation (HTTP 204) — the caller should then reload the
 * conversation history instead. Absence alone proves no admission or completion.
 *
 * `lastSeenSeq` is the highest `seq` already applied locally; the backend
 * replays only events after it.
 */
export async function streamAgentResume(
  conversationId: string,
  lastSeenSeq: number,
  signal: AbortSignal,
  runId?: string,
): Promise<AsyncGenerator<AgentEventFrame> | null> {
  const qs = `conversationId=${encodeURIComponent(conversationId)}&fromSeq=${lastSeenSeq}`
    + (runId ? `&runId=${encodeURIComponent(runId)}` : "");
  const res = await fetch(`/api/ai/agent/stream?${qs}`, {
    method: "GET",
    credentials: "include",
    headers: { "X-Requested-With": "fetch", ...scopeHeaders() },
    signal,
  });
  if (res.status === 204) return null; // nothing to resume → reload history
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `HTTP ${res.status} ${res.statusText}`);
  }
  // Only 204 means the registry has no run. A broken response must stay
  // recoverable instead of being mistaken for a completed, persisted turn.
  if (!res.body) throw new TypeError("Agent stream response has no body");
  return parseAgentSse(res);
}

/** Explicitly stop an in-flight run on the backend (user pressed "stop"). */
export async function stopAgent(conversationId: string): Promise<void> {
  try {
    await fetch("/api/ai/agent/stop", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch", ...scopeHeaders(true) },
      body: JSON.stringify({ conversationId }),
    });
  } catch {
    /* best-effort — the local abort already stopped the UI */
  }
}

/**
 * Steer the live run: inject an additional user message ("añadidura") into the
 * turn already in flight, so the agent picks it up mid-run without waiting for
 * the current task to finish. Backed by providers that support live input
 * (claude `--input-format stream-json`, codex `app-server turn/steer`). Throws
 * on HTTP 409 ("no active run") so the caller can fall back to a continuation.
 */
export async function steerAgent(conversationId: string, text: string): Promise<void> {
  const res = await fetch("/api/ai/agent/input", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Requested-With": "fetch", ...scopeHeaders(true) },
    body: JSON.stringify({ conversationId, text }),
  });
  if (!res.ok) throw new Error(`steer failed: HTTP ${res.status}`);
}

/**
 * Send the user's approve/deny for a pending permission_request. Resolves the
 * blocked `permissions.approve` MCP call so the Claude CLI continues (allow) or
 * backs off (deny) within the SAME turn — no new message, no session resume.
 */
export async function sendPermissionDecision(
  conversationId: string,
  requestId: string,
  decision: "allow" | "deny" | "always",
  tool?: string,
): Promise<void> {
  await fetch("/api/ai/agent/permission", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Requested-With": "fetch", ...scopeHeaders(true) },
    // `tool` lets the backend remember "never ask again" for that tool.
    body: JSON.stringify({ conversationId, requestId, decision, ...(tool ? { tool } : {}) }),
  });
}

export interface QueuedTurnRef {
  id: string;
  userText: string;
}

/**
 * Enqueue a follow-up turn on the SERVER while a run is in flight. The queue is
 * persisted on the connected server and drained in the background by the
 * registry's onComplete — so it keeps going even if the tab/app is closed.
 */
export async function enqueueAgentTurn(
  conversationId: string,
  p: { provider?: string; projectId?: string | null; agentId?: string | null; userText: string; attachments?: ChatAttachment[]; model?: string; effort?: "low" | "medium" | "high" | "xhigh" | "max"; planDecision?: "approve" },
): Promise<{ id: string; pending: QueuedTurnRef[] }> {
  const res = await fetch("/api/ai/agent/enqueue", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Requested-With": "fetch", ...scopeHeaders(true) },
    body: JSON.stringify({
      conversationId,
      provider: p.provider,
      projectId: p.projectId ?? null,
      agentId: p.agentId ?? null,
      userText: p.userText,
      attachments: p.attachments,
      ...(p.model ? { model: p.model } : {}),
      ...(p.effort ? { effort: p.effort } : {}),
      ...(p.planDecision ? { planDecision: p.planDecision } : {}),
    }),
  });
  if (!res.ok) throw new Error(`enqueue failed: HTTP ${res.status}`);
  const data = (await res.json()) as { ok: boolean; id: string; pending: QueuedTurnRef[] };
  return { id: data.id, pending: data.pending ?? [] };
}

/** Full content of one queued turn (text + attachments) — for editing. */
export interface QueuedTurnFull {
  id: string;
  userText: string;
  provider?: string;
  projectId?: string | null;
  attachments: ChatAttachment[];
}

/** Fetch a single queued turn with its attachments, to edit it in the composer. */
export async function getAgentQueueItem(id: string): Promise<QueuedTurnFull | null> {
  try {
    const res = await fetch(`/api/ai/agent/queue/${encodeURIComponent(id)}`, {
      method: "GET",
      credentials: "include",
      headers: { "X-Requested-With": "fetch", ...scopeHeaders() },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok: boolean; item?: QueuedTurnFull };
    return data.item ?? null;
  } catch {
    return null;
  }
}

/** List pending follow-up turns for a conversation (chips on reopen). */
export async function listAgentQueue(conversationId: string): Promise<QueuedTurnRef[]> {
  try {
    const res = await fetch(`/api/ai/agent/queue?conversationId=${encodeURIComponent(conversationId)}`, {
      method: "GET",
      credentials: "include",
      headers: { "X-Requested-With": "fetch", ...scopeHeaders() },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { ok: boolean; pending: QueuedTurnRef[] };
    return data.pending ?? [];
  } catch {
    return [];
  }
}

/** A conversation with a live background run, as reported by the backend. */
export interface ActiveRunRef {
  id: string;
  provider: string | null;
  cli: boolean;
  /** True when the run is blocked on a permission prompt awaiting the user —
   *  drives the "needs review" yellow dot in the chat list + Dashboard. */
  pendingPermission?: boolean;
}

/**
 * List conversations that have a live run still streaming on the backend.
 * Lets the Dashboard + chat list repaint "en curso" state after a WebView
 * reload wiped the in-memory engine — the run kept going server-side, but the
 * client had no way to know without opening each chat. Scoped server-side to
 * the requester's own conversations.
 */
export async function listActiveRuns(): Promise<ActiveRunRef[]> {
    const res = await fetch("/api/ai/agent/active", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "X-Requested-With": "fetch", ...scopeHeaders() },
    });
    if (!res.ok) throw new Error(`Active runs: HTTP ${res.status}`);
    const data = (await res.json()) as { ok: boolean; runs: ActiveRunRef[] };
    if (!data.ok || !Array.isArray(data.runs)) throw new Error("Invalid active runs snapshot");
    return data.runs;
}

/**
 * Kick server-side restart recovery: re-attach to CLI background jobs that
 * survived a panel restart and re-drain queued follow-ups for this server/user.
 * Fire-and-forget on drawer open / return to foreground — the backend is
 * idempotent (guarded by the run registry), so repeated calls are cheap once
 * everything is recovered. Returns the counts for optional logging.
 */
export async function resumeBackgroundRuns(): Promise<{ recovered: number; drained: number }> {
  try {
    const res = await fetch("/api/ai/agent/resume", {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "fetch", "Content-Type": "application/json", ...scopeHeaders(true) },
      body: "{}",
    });
    if (!res.ok) return { recovered: 0, drained: 0 };
    const data = (await res.json()) as { ok: boolean; recovered?: number; drained?: number };
    return { recovered: data.recovered ?? 0, drained: data.drained ?? 0 };
  } catch {
    return { recovered: 0, drained: 0 };
  }
}

/** Cancel a pending follow-up turn by id. */
export async function cancelAgentQueue(id: string): Promise<void> {
  try {
    await fetch(`/api/ai/agent/queue/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-Requested-With": "fetch", ...scopeHeaders(true) },
    });
  } catch {
    /* best-effort */
  }
}
