// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

import type { ConversationMessage } from "../repositories/conversations.repository.js";
import { stripAskBlock } from "./ask-protocol.js";
import { humanizePreview } from "../../../shared/text/humanize-preview.js";

const ESC = String.fromCharCode(27);
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const NUL = String.fromCharCode(0);
const LANE_TOKEN_RE = new RegExp(NUL + "\\{[^" + NUL + "]*\\}" + NUL, "g");
const CLI_PREFIX_RE =
  /^\s*(?:\$ (?:claude|codex|gemini|minimax)\b|Reading additional input from stdin\.\.\.|● (?:Claude Code|Codex|Gemini|MiniMax))/m;
// Ruido de transporte MCP del CLI upstream (p.ej. bearer muerto del server
// `luxipanel` en codex): "2026-07-01T02:14:31.4Z ERROR rmcp::transport::worker: …".
// Se filtra de la respuesta limpia (content); el cliLog completo lo conserva.
const MCP_TRANSPORT_NOISE_RE =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?[ \t]+(?:ERROR|WARN)[ \t]+rmcp\b.*$/gm;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

function stripLaneTokens(s: string): string {
  return s.includes(NUL) ? s.replace(LANE_TOKEN_RE, "") : s;
}

function stripMcpTransportNoise(s: string): string {
  return s.replace(MCP_TRANSPORT_NOISE_RE, "");
}

export function cleanCliText(raw: string): string {
  return stripAskBlock(
    stripMcpTransportNoise(stripAnsi(stripLaneTokens(raw)))
      .replace(/\r\n?/g, "\n")
      .replace(/^\s*\$ .*\n/, "")
      .replace(/^Reading additional input from stdin\.\.\.\n/, "")
      .replace(/^● (?:Claude Code|Codex|Gemini|MiniMax)\b.*\n/, "")
      .replace(/^[ \t]*─{3,}[ \t]*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export function extractCliFinalNarrative(cleaned: string): string {
  // The clean answer is the LAST narrative block the agent wrote: a run of
  // unindented prose lines that is neither a tool marker (`⏺ …`, `  ⎿ …`,
  // `$ …`, `● …`, stdin banner) nor the indented continuation of one. A run
  // that ended mid-tool (timeout / stop / overflow) has no prose after the
  // last marker — we must then fall back to the previous narrative block, and
  // to "" when there is none. NEVER return the whole log: the bubble would
  // render the raw console stream (unreadable), which is exactly the bug seen
  // on reloaded team-orchestration chats (2026-08-25).
  const lines = cleaned.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inMarker = false;
  const flush = () => {
    const text = current.join("\n").trim();
    if (text) blocks.push(text);
    current = [];
  };
  for (const line of lines) {
    const isMarker = /^(?:⏺ | {2}⎿ |\$ |Reading additional input from stdin\.\.\.|● )/.test(line);
    if (isMarker) { flush(); inMarker = true; continue; }
    if (inMarker && /^\s/.test(line)) continue; // indented continuation of a tool line
    if (inMarker && !line.trim()) continue; // blank gap right after a tool block
    inMarker = false;
    current.push(line);
  }
  flush();
  return blocks.length ? blocks[blocks.length - 1]! : "";
}

export function deriveCliSummary(translated: string | undefined, rawLog: string): string {
  const t = translated == null ? undefined : stripMcpTransportNoise(translated).trim() || undefined;
  if (t && !t.startsWith("$ ") && t !== rawLog.trim()) return t;
  return extractCliFinalNarrative(cleanCliText(t && t.startsWith("$ ") ? t : rawLog));
}

/**
 * Resumen de UNA LÍNEA legible para la campana / push de notificaciones.
 *
 * Reutiliza la misma cadena que la burbuja del chat (`deriveCliSummary` →
 * último bloque narrativo, nunca el log entero) y luego lo pasa por
 * `humanizePreview`, que traduce un JSON de respuesta a texto
 * ("Riesgo: medio · Amenazas: …") y quita ANSI/markdown. Devuelve "" cuando
 * no hay nada narrativo que enseñar — el llamante decide su texto por defecto.
 */
export function deriveNotificationPreview(
  translated: string | undefined,
  raw: string,
  max = 160,
): string {
  const summary = deriveCliSummary(translated, raw ?? "");
  // Sin bloque narrativo (turno cortado a mitad de herramienta) devolvemos ""
  // en lugar del log: la campana mostraría la consola cruda otra vez.
  return summary ? humanizePreview(summary, max) : "";
}

function looksLikeCliTranscript(text: string): boolean {
  return CLI_PREFIX_RE.test(text);
}

function normalizeCliAssistantMessage(message: ConversationMessage): ConversationMessage {
  // Identified answers already come from the structured final event. A code
  // sample or document may itself contain CLI markers: never parse it as a log.
  if (message.messageId) return message;
  const content = String(message.content ?? "");
  const cliLog = typeof message.cliLog === "string" ? message.cliLog : "";
  const rawTranscript = cliLog || content;
  // Split logs may be truncated before the final answer. Preserve canonical
  // content, and never turn old progress into a final answer after a failure.
  const cleanContent = stripAskBlock(stripMcpTransportNoise(stripAnsi(content))).trim();
  const contentIsTranscript = looksLikeCliTranscript(content) || /^(?:⏺ | {2}⎿ )/m.test(content);
  const cleanAnswer = message.pending ? "" : message.error || message.interrupted
    ? (contentIsTranscript ? "" : cleanContent)
    : cliLog && cleanContent && !contentIsTranscript
      ? cleanContent
      : deriveCliSummary(message.textTranslated, rawTranscript);
  const cleanLog = stripAskBlock(stripAnsi(stripLaneTokens(rawTranscript))).trim();
  const next: ConversationMessage = {
    ...message,
    cli: true,
    content: cleanAnswer,
  };
  if (message.pending) delete next.textTranslated;
  if (cleanLog && cleanLog !== cleanAnswer.trim()) next.cliLog = cleanLog;
  else delete next.cliLog;
  return next;
}

function isCliAssistant(message: ConversationMessage): boolean {
  if (message.role !== "assistant") return false;
  if (message.cli || typeof message.cliLog === "string") return true;
  return looksLikeCliTranscript(String(message.content ?? "")) || looksLikeCliTranscript(String(message.textTranslated ?? ""));
}

export function normalizeConversationMessage(message: ConversationMessage): ConversationMessage {
  return isCliAssistant(message) ? normalizeCliAssistantMessage(message) : message;
}

export function normalizeConversationMessages(messages: ConversationMessage[]): {
  messages: ConversationMessage[];
  changed: boolean;
} {
  let changed = false;
  const normalized = messages.map((message) => {
    const next = normalizeConversationMessage(message);
    if (next !== message) changed = true;
    else if (
      next.cli !== message.cli ||
      next.content !== message.content ||
      (next.cliLog ?? "") !== (message.cliLog ?? "")
    ) {
      changed = true;
    }
    return next;
  });
  return { messages: normalized, changed };
}
