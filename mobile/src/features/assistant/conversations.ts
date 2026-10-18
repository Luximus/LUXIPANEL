// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Mapeo PURO de mensajes persistidos (`GET /api/ai/conversations/:id/messages`)
 * a turnos del chat (fase A4). Antes vivía triplicado en el pane
 * (`openConversation` / `reloadMessages` / `recoverInterruptedTurn`).
 */

import type { ChatMsg, TurnTokens } from "./types";
import type { AssistantAskQuestion } from "./types";
import { stripAnsi } from "../../lib/strip-ansi";

/** Forma cruda de un mensaje persistido tal como lo devuelve LUXIPANEL. */
export type StoredMsg = {
  displaySummary?: string;
  error?: string; interrupted?: boolean;
  role?: string; content?: string; text?: string; ts?: string;
  textOriginal?: string; textTranslated?: string;
  provider?: string; cli?: boolean; cliLog?: string; auto?: boolean;
  textTranslationError?: string;
  attachments?: { id?: string; name?: string; mimeType?: string }[];
  tokens?: TurnTokens; durationMs?: number; summarizedCount?: number;
  ask?: AssistantAskQuestion[]; askKind?: "plan-approval";
};

/** Old CLI messages stored the complete console in content. Keep it available
 * in the process disclosure and extract only the last prose block as answer. */
function legacyCliAnswer(log: string): string {
  const lines = stripAnsi(log).replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inTool = false;
  const flush = () => { const value = current.join("\n").trim(); if (value) blocks.push(value); current = []; };
  for (const line of lines) {
    if (/^(?:\$ |⏺ | {2}⎿ |● |Reading additional input from stdin\.\.\.)/.test(line)) { flush(); inTool = true; continue; }
    if (inTool && (!line.trim() || /^\s/.test(line))) continue;
    inTool = false;
    current.push(line);
  }
  flush();
  return blocks.at(-1) ?? "";
}

/** Respuesta del endpoint de mensajes (array plano o envuelto). */
export type StoredMessagesResponse = { items?: StoredMsg[]; messages?: StoredMsg[] } | StoredMsg[] | null;

/** Mapea la respuesta cruda a `ChatMsg[]` (misma semántica que el inline del
 *  pane): usuario → textOriginal, asistente → textTranslated, con fallback a
 *  content/text; conserva tokens/duración y los divisores de compactación. */
export function mapStoredMessages(res: StoredMessagesResponse): ChatMsg[] {
  const raw = Array.isArray(res) ? res : (res?.items ?? res?.messages ?? []);
  let currentProvider: string | undefined;
  return (Array.isArray(raw) ? raw : [])
    .map((m) => {
      const role = (m.role === "user" ? "user" : "assistant") as "user" | "assistant";
      if (m.provider) currentProvider = m.provider;
      const persisted = String(m.content ?? m.text ?? "");
      const cliLog = role === "assistant" && m.cli
        ? (m.cliLog || (/^(?:\$ |⏺ |● )/m.test(persisted) ? persisted : ""))
        : "";
      const content = role === "user"
        ? String(m.textOriginal ?? persisted)
        : m.cli && cliLog === persisted
          ? m.error || m.interrupted ? "" : String(m.textTranslated && !m.textTranslated.startsWith("$ ") ? m.textTranslated : legacyCliAnswer(cliLog))
          : String(m.textTranslated ?? persisted);
      const ts = m.ts ? Date.parse(m.ts) : NaN;
      const attachments = (m.attachments ?? []).flatMap((a) =>
        typeof a.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(a.id) && typeof a.name === "string"
          ? [{ name: a.name, mimeType: a.mimeType ?? "application/octet-stream", url: `/api/ai/attachments/${encodeURIComponent(a.id)}` }]
          : []);
      return {
        role,
        ...(m.error ? { error: m.error } : {}),
        ...(m.interrupted ? { stopped: true } : {}),
        content,
        ...(m.displaySummary ? { displaySummary: m.displaySummary } : {}),
        ...(currentProvider ? { provider: currentProvider } : {}),
        ...(role === "user" && m.textOriginal && persisted !== m.textOriginal ? { raw: persisted } : {}),
        ...(m.auto ? { auto: true } : {}),
        ...(m.cli ? { cli: true } : {}),
        ...(cliLog ? { cliHistoryLog: cliLog } : {}),
        ...(attachments.length ? { attachments } : {}),
        createdAt: Number.isFinite(ts) ? ts : undefined,
        tokens: m.tokens,
        durationMs: m.durationMs,
        ...(m.textTranslationError ? { translationError: m.textTranslationError } : {}),
        ...(role === "assistant" && m.ask?.length ? { ask: m.ask, ...(m.askKind === "plan-approval" ? { askKind: m.askKind } : {}) } : {}),
        // Compactación persistida: un turno-resumen que reemplaza N mensajes.
        ...(typeof m.summarizedCount === "number" && m.summarizedCount > 0 ? { summarizedCount: m.summarizedCount } : {}),
      };
    })
    .filter((m) => m.content || m.error || m.stopped || m.attachments?.length || m.cliHistoryLog || m.auto || (m.ask?.length ?? 0) > 0 || (m.summarizedCount ?? 0) > 0);
}
