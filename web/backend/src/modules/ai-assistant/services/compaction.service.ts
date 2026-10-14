// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Conversation compaction.
 *
 * Folds the OLDER turns of a long conversation into a single concise summary
 * message, keeping only the most recent few turns verbatim. This is what stops
 * a long chat from overrunning the model's context window (see
 * `context-window.service.ts`).
 *
 * Two halves:
 *   1. Summary — an LLM one-shot (`aiComplete`, reusing the translation engine's
 *      provider/key resolution) condenses the dropped turns. If no API key is
 *      configured anywhere (pure CLI setup), it degrades to a MECHANICAL note so
 *      the feature still shrinks context — it just won't read as a prose summary.
 *   2. Rewrite — `conversationsRepository.replaceMessages` swaps the stored doc
 *      for `[summary, ...recentTail]`, and the upstream CLI session marker is
 *      CLEARED so the next CLI turn starts a fresh (small) session instead of
 *      `--resume`-ing the pre-compaction transcript.
 */

import { env } from "../../../config/env.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { AssistantConfig } from "../models/assistant-config.types.js";
import {
  conversationsRepository,
  type ConversationMessage,
} from "../repositories/conversations.repository.js";
import { cliSessionsRepository } from "../repositories/cli-sessions.repository.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { aiComplete } from "./translation/ai-translator.js";
import { estimateContextTokens } from "./context-window.service.js";

const log = createModuleLogger("compaction-service");

/** Hard cap on how much transcript we feed the summarizer — the summary call is
 *  itself bounded by the model window. ~120k chars ≈ 30k tokens of input. */
const MAX_SUMMARY_INPUT_CHARS = 120_000;
/** Socket-level safety net for the summary call. */
const SUMMARY_TIMEOUT_MS = 60_000;

const SUMMARY_SYSTEM =
  "You compress a long technical assistant↔user conversation into a dense summary " +
  "that REPLACES the older turns as context for continuing the chat. Preserve, in order " +
  "of importance: the user's goal and any explicit preferences/constraints; concrete " +
  "decisions made and WHY; exact file paths, commands, identifiers, config values and URLs " +
  "mentioned; the current state of the work and what is still pending or unresolved. " +
  "Drop pleasantries, repetition and dead ends. Use compact bullet points. Do NOT invent " +
  "anything not in the transcript. Write the summary in the SAME language the conversation " +
  "is written in. Output ONLY the summary.";

export interface CompactionResult {
  /** True when messages were actually folded; false = nothing to do. */
  compacted: boolean;
  /** How the summary was produced. */
  method: "ai" | "mechanical" | "noop";
  /** Original message count before the rewrite. */
  before: number;
  /** Message count after (summary + kept tail). */
  after: number;
  /** Number of original messages folded into the summary. */
  summarizedCount: number;
  /** Estimated context tokens before / after the rewrite. */
  tokensBefore: number;
  tokensAfter: number;
  /** Set when the summary fell back to mechanical (e.g. no API key). */
  reason?: string;
}

/** Render the dropped turns as a plain transcript for the summarizer. Uses the
 *  canonical `content` (English when translation is active — cheap + consistent)
 *  and, for CLI turns, appends a trimmed terminal log so tool work is captured. */
function renderTranscript(messages: ConversationMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    const who = m.role === "user" ? "User" : "Assistant";
    let body = m.content ?? "";
    if (m.cliLog && m.cliLog.trim()) {
      // Keep only the head + tail of a huge CLI log so one turn can't dominate.
      const logTrim =
        m.cliLog.length > 4_000 ? `${m.cliLog.slice(0, 2_000)}\n…\n${m.cliLog.slice(-2_000)}` : m.cliLog;
      body = `${body}\n[server console]\n${logTrim}`;
    }
    lines.push(`${who}: ${body}`.trim());
  }
  let out = lines.join("\n\n");
  if (out.length > MAX_SUMMARY_INPUT_CHARS) {
    // Keep the TAIL (most recent of the folded range matters most for continuity).
    out = `…[transcript truncated]…\n\n${out.slice(-MAX_SUMMARY_INPUT_CHARS)}`;
  }
  return out;
}

/** Build the synthetic summary message that replaces the folded turns. */
function summaryMessage(text: string, summarizedCount: number): ConversationMessage {
  return {
    role: "user",
    content: `[Resumen de la conversación previa — ${summarizedCount} mensajes compactados]\n\n${text}`,
    ts: new Date().toISOString(),
    compacted: true,
    summarizedCount,
  };
}

/**
 * Compact a conversation. Idempotent / safe to call when there's nothing to do
 * (returns `compacted: false`). Never throws for an LLM failure — it degrades to
 * a mechanical summary so a caller (incl. the auto path) is never blocked.
 */
export async function compactConversation(
  executor: Executor | null | undefined,
  conversationId: string,
  opts: { config?: AssistantConfig; keep?: number; signal?: AbortSignal } = {},
): Promise<CompactionResult> {
  const keep = opts.keep ?? env.ASSISTANT_CONTEXT_COMPACT_KEEP;
  const all = await conversationsRepository.allMessages(executor, conversationId);
  const tokensBefore = estimateContextTokens(all);

  // Nothing meaningful to fold: need at least one older message beyond the tail.
  if (all.length <= keep + 1) {
    return { compacted: false, method: "noop", before: all.length, after: all.length, summarizedCount: 0, tokensBefore, tokensAfter: tokensBefore };
  }

  const older = all.slice(0, all.length - keep);
  const recent = all.slice(all.length - keep);
  const transcript = renderTranscript(older);

  let summaryText = "";
  let method: CompactionResult["method"] = "ai";
  let reason: string | undefined;
  try {
    const config = opts.config ?? (await assistantConfigRepository.load(executor));
    const signal = opts.signal ?? AbortSignal.timeout(SUMMARY_TIMEOUT_MS);
    const out = await aiComplete(config, { system: SUMMARY_SYSTEM, user: transcript, signal });
    summaryText = out.text.trim();
    if (!summaryText) throw new Error("empty summary output");
  } catch (err) {
    method = "mechanical";
    reason = (err as Error).message;
    log.warn({ conversationId, err: reason }, "compaction: AI summary unavailable — using mechanical fallback");
    summaryText = mechanicalSummary(older);
  }

  const next: ConversationMessage[] = [summaryMessage(summaryText, older.length), ...recent];
  await conversationsRepository.replaceMessages(executor, conversationId, next, all);
  // Resume of the old upstream CLI session would reload the pre-compaction
  // transcript → clear it so the next turn launches fresh from the summary.
  await cliSessionsRepository.clear(executor, conversationId).catch(() => undefined);

  const tokensAfter = estimateContextTokens(next);
  log.info(
    { conversationId, method, before: all.length, after: next.length, tokensBefore, tokensAfter },
    "conversation compacted",
  );
  return {
    compacted: true,
    method,
    before: all.length,
    after: next.length,
    summarizedCount: older.length,
    tokensBefore,
    tokensAfter,
    ...(reason ? { reason } : {}),
  };
}

/** Deterministic fallback when no LLM is reachable: keep the first user goal as
 *  an anchor and note how many turns were dropped. Still removes the bulk (huge
 *  CLI logs + intermediate turns) from the replayed context. */
function mechanicalSummary(older: ConversationMessage[]): string {
  const firstUser = older.find((m) => m.role === "user");
  const anchor = firstUser ? `Objetivo inicial del usuario: ${firstUser.content.slice(0, 800)}` : "";
  return [
    anchor,
    `Se compactaron ${older.length} mensajes anteriores para no exceder la ventana de contexto. ` +
      "El detalle completo no está disponible (sin motor de resumen configurado); " +
      "continúa desde el estado actual y pregunta al usuario si falta contexto.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
