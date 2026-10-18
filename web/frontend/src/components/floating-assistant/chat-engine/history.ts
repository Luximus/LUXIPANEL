// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ChatTurn, TurnAttachment } from "./types";
import type { ConversationMessage } from "../assistant-api";
import { attachmentUrl, displayText } from "../assistant-api";
import { deriveCliSummary, looksLikeCliTranscript, stripLaneTokens } from "./cli-lanes";
import { apiActivityTools } from "./api-activity";

/** History message → renderable turn, resolving attachment refs to URLs. */
export function historyTurn(m: ConversationMessage, fallbackProvider?: string): ChatTurn {
  const attachments: TurnAttachment[] | undefined = m.attachments?.length
    ? m.attachments.map((a) => ({ name: a.name, mimeType: a.mimeType, ...(a.voice ? { voice: a.voice } : {}), url: attachmentUrl(a.id) }))
    : undefined;
  const createdAt = m.ts ? Date.parse(m.ts) : NaN;
  // User turns: when background translation was active, `content` holds the
  // English text we actually forwarded to the agent, while the bubble shows the
  // user's own language (textOriginal). Surface that forwarded English in the
  // "input crudo" collapsible (reuses `raw`, otherwise unused for user turns).
  const forwardedEnglish =
    m.role === "user" && m.textOriginal && m.content && m.content !== m.textOriginal
      ? m.content
      : undefined;
  // Reloaded CLI assistant turn. New turns store the clean answer in `content`
  // and the verbose log in `cliLog`; pre-split turns put the whole log in
  // `content`. Either way: rebuild the collapsed console from the log (lane
  // tokens stripped — the reloaded box is a flat <pre>, not tabbed) and show the
  // clean answer in the bubble (`content`/`textTranslated` for new turns; derived
  // from the log for pre-split ones).
  const isCliAssistant = m.role === "assistant" && !!m.cli && (!!m.content || !!m.cliLog);
  const hasSplitLog = isCliAssistant && typeof m.cliLog === "string" && m.cliLog.length > 0;
  const cliRawLog = hasSplitLog ? m.cliLog! : isCliAssistant ? m.content : "";
  const persistedSummary = displayText(m);
  const cliSummary = m.pending ? "" : m.error || m.interrupted ? (looksLikeCliTranscript(persistedSummary) ? "" : persistedSummary) : hasSplitLog
    ? (
      persistedSummary.trim() && !looksLikeCliTranscript(persistedSummary)
        ? persistedSummary
        : deriveCliSummary(m.textTranslated, cliRawLog)
    )
    : deriveCliSummary(m.textTranslated, cliRawLog);
  const apiActivity = m.role === "assistant" && !m.cli ? m.apiActivity : undefined;
  return {
    role: m.role,
    ...(m.messageId ? { messageId: m.messageId } : {}),
    ...(m.presentation ? { presentation: m.presentation } : {}),
    ...(m.displaySummary ? { displaySummary: m.displaySummary } : {}),
    ...(m.role === "assistant" && m.pending ? { completionPending: true } : {}),
    ...(m.error ? { error: m.error } : {}),
    ...(m.interrupted ? { stopped: true } : {}),
    ...((m.provider ?? fallbackProvider) ? { provider: m.provider ?? fallbackProvider } : {}),
    // CLI turns: clean answer (split) or summary derived from the log
    // (pre-split); otherwise the user-facing variant when translation was active.
    // New contract responses always keep their canonical display body intact.
    text: isCliAssistant && !m.messageId && !m.presentation
      && (!persistedSummary.trim() || persistedSummary.trimStart().startsWith("$ ") || looksLikeCliTranscript(persistedSummary))
      ? cliSummary : displayText(m),
    tools: apiActivity ? apiActivityTools(apiActivity) : [],
    ...(apiActivity ? { apiActivity } : {}),
    ...(forwardedEnglish ? { raw: forwardedEnglish } : {}),
    ...(m.cli ? { cli: true } : {}),
    // Carry the persisted execution log so the collapsed console can be rebuilt
    // on reload; the clean answer above is shown below it.
    ...(isCliAssistant && cliRawLog ? { cliHistoryLog: stripLaneTokens(cliRawLog) } : {}),
    ...(m.ask?.length ? { ask: m.ask } : {}),
    ...(m.ask?.length && m.askKind ? { askKind: m.askKind } : {}),
    ...(m.tokens ? { tokens: m.tokens } : {}),
    ...(typeof m.durationMs === "number" ? { durationMs: m.durationMs } : {}),
    ...(m.textTranslationError ? { translationError: m.textTranslationError } : {}),
    ...(Number.isFinite(createdAt) ? { createdAt } : {}),
    ...(attachments ? { attachments } : {}),
    ...(m.compacted ? { compacted: true, summarizedCount: m.summarizedCount ?? 0 } : {}),
    ...(m.auto ? { auto: true } : {}),
  };
}

/** Map persisted messages to renderable turns while preserving per-turn provider
 *  branding across legacy rows that were stored without `provider`. */
export function historyTurns(items: ConversationMessage[], seedProvider?: string): ChatTurn[] {
  let currentProvider = seedProvider;
  return reconcileMessageTurns(items.map((m) => {
    const turn = historyTurn(m, currentProvider);
    if (m.provider) currentProvider = m.provider;
    else if (turn.provider) currentProvider = turn.provider;
    return turn;
  }));
}

function messageIdentity(turn: ChatTurn): string | undefined {
  return turn.messageId?.trim() ? JSON.stringify([turn.role, turn.messageId]) : undefined;
}

function mergeIdentifiedMessage(previous: ChatTurn, next: ChatTurn): ChatTurn {
  const awaiting = (turn: ChatTurn) => !!(turn.pending || turn.completionPending || turn.interrupted || turn.status);
  // A late pending snapshot cannot undo an already persisted terminal outcome.
  const keepPrevious = !awaiting(previous) && awaiting(next);
  const chosen = keepPrevious ? previous : next;
  const other = keepPrevious ? next : previous;
  return { ...chosen,
    tools: chosen.cliHistoryLog ? chosen.tools : [
      ...chosen.tools.map(tool => ({ ...tool,
        result: tool.result ?? other.tools.find(item => item.id === tool.id)?.result })),
      ...other.tools.filter(tool => !chosen.tools.some(item => item.id === tool.id)),
    ],
    ...(chosen.apiActivity || other.apiActivity ? { apiActivity: chosen.apiActivity ?? other.apiActivity } : {}),
    ...(chosen.addenda || other.addenda ? { addenda: chosen.addenda ?? other.addenda } : {}),
  };
}

/** Reconcile only explicit response identities within one conversation.
 * Legacy messages remain separate even when their text and timestamp match.
 * Known messages enrich matching rows, never insert missing rows into a page. */
export function reconcileMessageTurns(turns: ChatTurn[], known: ChatTurn[] = []): ChatTurn[] {
  const previous = new Map<string, ChatTurn>();
  for (const turn of known) {
    const identity = messageIdentity(turn);
    if (identity) previous.set(identity, turn);
  }
  const positions = new Map<string, number>();
  const result: ChatTurn[] = [];
  for (const turn of turns) {
    const identity = messageIdentity(turn);
    const position = identity ? positions.get(identity) : undefined;
    if (position === undefined) {
      if (identity) positions.set(identity, result.length);
      const existing = identity ? previous.get(identity) : undefined;
      result.push(existing ? mergeIdentifiedMessage(existing, turn) : turn);
    } else {
      result[position] = mergeIdentifiedMessage(result[position]!, turn);
    }
  }
  return result;
}
