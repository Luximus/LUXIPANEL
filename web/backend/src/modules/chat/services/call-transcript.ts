// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Call transcripts — the PURE half (normalise + cap + project).
 *
 * A transcript arrives from Tolqia over the wire (a webhook body, or the
 * 24-hour `GET /v1/calls/rooms/:id/transcript` fallback) and ends up inside a
 * chat system message, which lives in the per-conversation sidecar
 * `chat/messages_<convId>.json`. That sidecar is read and rewritten whole on
 * every insert, so an unbounded transcript would make every later message in
 * that conversation more expensive to write — hence a hard cap, applied here
 * and not at the edges.
 *
 * Nothing in this file does I/O: the bridge owns the network and the directory,
 * this module owns the shape.
 */

import type {
  ChatCallTranscriptParticipant,
  ChatCallTranscriptSegment,
} from "../../../shared/chat-call-types.js";

/** Hard cap on persisted segments (a 45-minute call diarises to ~600). */
export const TRANSCRIPT_MAX_SEGMENTS = 2_000;
/** Hard cap on the persisted JSON size — the sidecar is rewritten whole. */
export const TRANSCRIPT_MAX_BYTES = 200 * 1024;
/** Per-utterance text cap: one runaway ASR frame must not eat the budget. */
const TEXT_MAX = 4_000;

const str = (v: unknown, max = TEXT_MAX): string =>
  typeof v === "string" ? v.slice(0, max) : "";

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;

/** `Record<lang, text>` from anything, dropping non-string values. */
function normalizeTranslations(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [lang, text] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof text !== "string" || !text.trim()) continue;
    const tag = String(lang).slice(0, 16).toLowerCase();
    if (!/^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(tag)) continue;
    out[tag] = text.slice(0, TEXT_MAX);
  }
  return out;
}

/**
 * Coerce whatever Tolqia sent into segments we are willing to persist.
 *
 * TOLERANT BY DESIGN: this contract is being built on the other side of the
 * wire right now, so a missing field degrades to a sane default and a segment
 * without a speaker or without text is dropped rather than persisted half-made.
 */
export function normalizeTranscript(raw: unknown): ChatCallTranscriptSegment[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatCallTranscriptSegment[] = [];
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const participantId = str(s.participantId, 64).trim();
    const text = str(s.text).trim();
    if (!participantId || !text) continue;
    out.push({
      seq: typeof s.seq === "number" && Number.isFinite(s.seq) ? Math.round(s.seq) : i,
      participantId,
      displayName: str(s.displayName, 128).trim() || participantId,
      lang: str(s.lang, 16).trim().toLowerCase() || "und",
      text,
      translations: normalizeTranslations(s.translations),
      startMs: num(s.startMs),
      endMs: num(s.endMs),
    });
  }
  return out.sort((a, b) => (a.seq === b.seq ? a.startMs - b.startMs : a.seq - b.seq));
}

/**
 * Apply the persistence cap.
 *
 * When it bites we keep the FIRST segments, not the last: a transcript is read
 * top-down and a conversation that starts mid-sentence is useless. The byte
 * budget is measured on the real serialisation, so a few very long utterances
 * cap earlier than 2000 short ones.
 */
export function capTranscript(segments: ChatCallTranscriptSegment[]): {
  segments: ChatCallTranscriptSegment[];
  truncated: boolean;
} {
  let kept = segments.slice(0, TRANSCRIPT_MAX_SEGMENTS);
  let truncated = kept.length < segments.length;
  let bytes = Buffer.byteLength(JSON.stringify(kept), "utf8");
  while (kept.length > 0 && bytes > TRANSCRIPT_MAX_BYTES) {
    // Drop a proportional slice instead of one row at a time: re-serialising
    // 2000 segments per removal would be quadratic on a pathological payload.
    const ratio = TRANSCRIPT_MAX_BYTES / bytes;
    const next = Math.max(1, Math.min(kept.length - 1, Math.floor(kept.length * ratio)));
    kept = kept.slice(0, next);
    truncated = true;
    bytes = Buffer.byteLength(JSON.stringify(kept), "utf8");
  }
  return { segments: kept, truncated };
}

/**
 * Re-resolve every `displayName` against the live directory (bloque B) and
 * derive the speaker list the participant filter needs.
 *
 * The directory wins, the persisted copy is the fallback, the login is the last
 * resort — the same precedence `projectRoom` uses for a live call.
 */
export function projectTranscript(
  segments: ChatCallTranscriptSegment[],
  display: Map<string, string>,
): { segments: ChatCallTranscriptSegment[]; participants: ChatCallTranscriptParticipant[] } {
  const seen = new Map<string, ChatCallTranscriptParticipant>();
  const projected = segments.map((s) => {
    const displayName = display.get(s.participantId) ?? s.displayName ?? s.participantId;
    if (!seen.has(s.participantId)) {
      seen.set(s.participantId, { username: s.participantId, displayName, lang: s.lang });
    }
    return { ...s, displayName };
  });
  return { segments: projected, participants: [...seen.values()] };
}
