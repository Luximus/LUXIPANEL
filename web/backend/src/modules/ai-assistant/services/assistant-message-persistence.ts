// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Executor } from "../../../shared/executor/index.js";
import type { AskQuestion } from "../models/ask.types.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { stripAskBlock } from "./ask-protocol.js";
import { ANSI_RE } from "./providers/cli/shell.js";

export const MAX_MSG_CONTENT = 32_000;

/**
 * Append the assistant's answer once the run finishes. Called exactly once
 * from the registry's `onComplete` (after the user message was already
 * persisted at run start). Questions, errors and interruptions are persisted even without an answer so
 * reloading the chat preserves its controls and actual outcome.
 */
export async function persistAssistantMessage(
  executor: Executor | null,
  conversationId: string,
  assistantText: string,
  provider: string | undefined,
  cli: boolean,
  ask?: AskQuestion[],
  translation?: { text: string; lang: string; error?: string },
  tokens?: { input: number; output: number; total: number; estimated?: boolean },
  durationMs?: number,
  cliLog?: string,
  askKind?: "plan-approval",
  outcome?: { error?: string; interrupted?: boolean },
): Promise<void> {
  // Drop the raw ask sentinel block from the persisted text — the question is
  // stored structurally in `ask` and re-rendered as controls on reload.
  const content = stripAskBlock(assistantText.replace(ANSI_RE, ""));
  // CLI runs: persist the full terminal log separately (ANSI-stripped, capped)
  // so the reloaded console box rebuilds from it while `content` stays the clean
  // answer. Only when it actually differs from the answer (no point duplicating).
  const log = cli && cliLog ? stripAskBlock(cliLog.replace(ANSI_RE, "")).slice(0, MAX_MSG_CONTENT) : "";
  const cliLogField = log.trim() && log.trim() !== content.trim() ? log : "";
  // Persist when there's text OR a pending question (an ask with no preamble
  // would otherwise be lost, leaving the thread frozen at the user's turn).
  if (!content.trim() && !ask?.length && !outcome?.error && !outcome?.interrupted) return;
  await conversationsRepository
    .appendMessages(
      executor,
      conversationId,
      [
        {
          // `content` stays English (cheap context replay); `textTranslated` is
          // the user-language answer the chat renders when translation was active.
          role: "assistant",
          ...(outcome?.error ? { error: outcome.error } : {}),
          ...(outcome?.interrupted ? { interrupted: true } : {}),
          ...(provider ? { provider } : {}),
          content,
          ts: new Date().toISOString(),
          ...(cli ? { cli: true } : {}),
          ...(cliLogField ? { cliLog: cliLogField } : {}),
          ...(ask?.length ? { ask } : {}),
          ...(ask?.length && askKind ? { askKind } : {}),
          ...(tokens ? { tokens } : {}),
          ...(typeof durationMs === "number" && durationMs >= 0 ? { durationMs } : {}),
          ...(translation ? { textTranslated: translation.text, lang: translation.lang } : {}),
          ...(translation?.error ? { textTranslationError: translation.error } : {}),
        },
      ],
      // The run just finished → mark it for review until the user opens it.
      // Surfaces "ended but unreviewed" on the Dashboard across panel reloads.
      { unreviewed: true },
    )
    .catch(() => undefined);
}
