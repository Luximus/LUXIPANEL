// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Context-window guard.
 *
 * A long assistant conversation eventually overruns the model's usable context
 * window. CLI providers feel it worst: each turn RESUMES the upstream agent's
 * own (ever-growing) transcript, so once that transcript passes the window the
 * CLI silently auto-compacts/drops older turns and the user's recent requests
 * "no se quedan" — the thread stays anchored on a stale task.
 *
 * This module estimates how much of the window a conversation currently
 * occupies (chars/4 over the stored canonical `content` + the CLI terminal
 * `cliLog`, which is what the upstream session actually replays) and reports
 * whether the UI should offer to compact (WARN) or a send should auto-compact
 * first (AUTOCOMPACT). It owns NO state — pure estimation over a message list.
 */

import { env } from "../../../config/env.js";
import type { ConversationMessage } from "../repositories/conversations.repository.js";

/** Rough token estimate for arbitrary text: ~4 chars per token (English/code).
 *  Deliberately an over-estimate-friendly floor — the guard should trip a touch
 *  EARLY rather than let a conversation silently overrun the real window. */
export function estimateTokensForText(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Context cost of one stored message. The upstream CLI session replays the
 *  full terminal log, so `cliLog` counts toward the window — not just the clean
 *  `content` bubble. API providers only replay `content`, so this is an upper
 *  bound for them (safe: trips early). Attachments are not counted (their bytes
 *  live on the target, not in the text transcript). */
export function estimateMessageTokens(m: ConversationMessage): number {
  return estimateTokensForText(m.content) + estimateTokensForText(m.cliLog);
}

/** Sum the estimated context tokens across every stored message. */
export function estimateContextTokens(messages: ConversationMessage[]): number {
  let total = 0;
  for (const m of messages) total += estimateMessageTokens(m);
  return total;
}

export interface ContextAssessment {
  /** Guard active at all (env kill-switch). When false the UI hides the meter. */
  enabled: boolean;
  /** Estimated tokens the conversation currently occupies. */
  tokens: number;
  /** Usable window the estimate is measured against (tokens). */
  limit: number;
  /** tokens / limit, clamped to [0, …) (can exceed 1 when overrun). */
  ratio: number;
  /** Number of stored messages (drives "is there anything to compact"). */
  messageCount: number;
  /** Past the WARN ratio → the UI shows the manual "Compactar" button. */
  warn: boolean;
  /** Past the AUTOCOMPACT ratio → a send compacts first (best-effort). */
  shouldAutoCompact: boolean;
}

/** The usable context window (tokens) the guard measures against. Single
 *  instance-wide value today; kept a function so a per-provider/model map can
 *  slot in later without touching callers. */
export function contextWindowTokens(): number {
  return env.ASSISTANT_CONTEXT_WINDOW_TOKENS;
}

/** Bytes of upstream-session JSONL transcript that roughly map to one replayed
 *  context token. On `--resume` the CLI replays the WHOLE `.jsonl`; we reuse the
 *  same ~4-chars/token floor the panel-side estimate uses (a `.jsonl` is mostly
 *  ASCII, so bytes ≈ chars), so the byte budget below lines up with the token
 *  window the rest of the guard measures against. */
const JSONL_BYTES_PER_TOKEN = 4;

/**
 * Byte size at/above which an upstream CLI session transcript is past budget and
 * should be RESET (start a fresh session) instead of `--resume`d.
 *
 * Why a SEPARATE check from `assessContext`: that estimate only sees the stored
 * transcript (`content` + 32k-capped `cliLog`), which badly UNDER-counts the
 * real `.jsonl` a tool-heavy chat balloons (full file/tool I/O the panel never
 * stores). So the CLI bridge measures the actual file size and compares it to
 * this budget, derived from the same window × autocompact-ratio the token guard
 * uses so both trip at one place. Returns 0 when the guard is disabled → caller
 * skips the check and keeps the legacy always-resume behaviour.
 */
export function upstreamSessionResetBytes(): number {
  if (!env.ASSISTANT_CONTEXT_GUARD_ENABLED) return 0;
  return Math.round(
    contextWindowTokens() * env.ASSISTANT_CONTEXT_AUTOCOMPACT_RATIO_CLI * JSONL_BYTES_PER_TOKEN,
  );
}

/** Assess a conversation's context occupancy against the configured window. */
export function assessContext(messages: ConversationMessage[]): ContextAssessment {
  const enabled = env.ASSISTANT_CONTEXT_GUARD_ENABLED;
  const limit = contextWindowTokens();
  const tokens = estimateContextTokens(messages);
  const ratio = limit > 0 ? tokens / limit : 0;
  // Never offer to compact a conversation too small to have anything to fold:
  // it must have more than the "kept verbatim" tail plus at least one older msg.
  const compactable = messages.length > env.ASSISTANT_CONTEXT_COMPACT_KEEP + 1;
  // CLI conversations (any stored cliLog) auto-compact EARLIER: the chars/4
  // estimate badly under-counts the real upstream `.jsonl` a tool-heavy chat
  // replays on --resume, so waiting for the generic ratio means late resets
  // that lose the thread.
  const isCli = messages.some((m) => Boolean(m.cliLog));
  const autoRatio = isCli ? env.ASSISTANT_CONTEXT_AUTOCOMPACT_RATIO_CLI : env.ASSISTANT_CONTEXT_AUTOCOMPACT_RATIO;
  return {
    enabled,
    tokens,
    limit,
    ratio,
    messageCount: messages.length,
    warn: enabled && compactable && ratio >= env.ASSISTANT_CONTEXT_WARN_RATIO,
    shouldAutoCompact: enabled && compactable && ratio >= autoRatio,
  };
}
