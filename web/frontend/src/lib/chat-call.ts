// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat ↔ calls wire contract (F3) — BROWSER half.
 *
 * The twin of `backend/src/shared/chat-call-types.ts`. Backend and frontend are
 * separate npm projects, so neither can import the other: the shapes are
 * declared twice on purpose and the two files carry the same section headings
 * so a change on one side is obvious on the other.
 *
 * Nothing here is imported from `@tolqia/contracts`: what the panel renders is
 * its OWN projection (`ChatCallView`), which the backend guarantees is free of
 * Linux usernames and of provider credentials. The SDK's own types
 * (`ParticipantView`, `RoomView`) describe what the *socket* carries and are
 * used only inside the call components.
 */

/** Lifecycle of a call. */
export type ChatCallState = "ringing" | "active" | "ended";

/** Per-participant lifecycle. */
export type ChatCallParticipantState = "ringing" | "joined" | "left" | "rejected" | "missed";

/** Why a call ended. */
export type ChatCallEndReason =
  | "completed"
  | "hangup"
  | "missed"
  | "rejected"
  | "max-duration"
  | "error";

/**
 * One participant as the panel shows them. `id` is the Tolqia participant id
 * (the Linux login) — use it to tell "me" apart and to address a reject, and
 * render `displayName`, never `id`.
 */
export interface ChatCallParticipant {
  id: string;
  displayName: string;
  lang: string;
  translate: boolean;
  role: "host" | "member";
  state: ChatCallParticipantState;
  muted: boolean;
  speaking: boolean;
  joinedAt?: number;
}

/** The credential-free projection of a call. */
export interface ChatCallView {
  id: string;
  convId: string;
  kind: "dm" | "group";
  state: ChatCallState;
  createdAt: number;
  answeredAt?: number;
  endedAt?: number;
  endReason?: ChatCallEndReason;
  participants: ChatCallParticipant[];
  /**
   * Whether the room has real-time translation switched on.
   *
   * `reason` is present ONLY when Tolqia refused to switch it on and said why —
   * today `"PLAN_LIMIT_TRANSLATION"` (more participants wanted translation than
   * the linked tolqia.com plan allows) or `"PLAN_INACTIVE"`. With `enabled:false`
   * and no reason, nobody simply asked for translation.
   */
  translation: { enabled: boolean; provider: string; mode: string; reason?: string };
  startedBy: string;
}

/** What `POST .../call` and `POST .../accept` return. */
export interface ChatCallSession {
  call: ChatCallView;
  token: string;
  expiresAt: number;
  /**
   * Open this VERBATIM. It is host-relative and already carries the token and
   * the deployment's public path (`/tolqia`, or `/__luxipanel/tolqia` on an LP
   * mount) — the SDK prefixes the page origin and picks `ws:`/`wss:` from
   * `location.protocol`. Composing it by hand breaks every non-default mount.
   */
  wsUrl: string;
  /** True when we joined a call somebody else had already started. */
  joined: boolean;
}

// ── SSE (`GET /api/chat/stream`) ────────────────────────────────────────────

export const CHAT_CALL_SSE_EVENTS = {
  RING: "chat:call:ring",
  STATE: "chat:call:state",
  END: "chat:call:end",
} as const;

export type ChatCallSseEvent = "ring" | "state" | "end";

/** Payload of every `chat:call:*` SSE frame. */
export interface ChatCallEvent {
  targetId: string;
  participants: string[];
  event: ChatCallSseEvent;
  call: ChatCallView;
}

/** Parse one SSE frame, tolerating anything a stale backend might send. */
export function parseChatCallEvent(raw: string): ChatCallEvent | null {
  try {
    const data = JSON.parse(raw) as Partial<ChatCallEvent>;
    if (!data?.call?.id || !data.call.convId) return null;
    return {
      targetId: data.targetId ?? "",
      participants: Array.isArray(data.participants) ? data.participants : [],
      event: data.event === "ring" || data.event === "end" ? data.event : "state",
      call: data.call as ChatCallView,
    };
  } catch {
    return null;
  }
}

// ── System messages (the "call ended" chip) ─────────────────────────────────

export interface ChatCallSystemPayload {
  kind: "call";
  callId: string;
  outcome: "completed" | "missed" | "rejected";
  durationSec: number;
  /** Display names. Never usernames. */
  participants: string[];
  /**
   * How many transcript segments the call left behind. The backend STRIPS the
   * transcript itself from the thread listing and from the SSE frame (it is up
   * to 200 KB), so this counter is what tells the bubble whether to offer "ver
   * transcripción"; the body arrives from
   * `GET /api/chat/conversations/:id/messages/:mid/transcript`.
   */
  transcriptSegments?: number;
  transcriptTruncated?: boolean;
  /** Only present on a backend that did not strip it. Treated as a hint. */
  transcript?: ChatCallTranscriptSegment[];
}

// ── Call transcript ─────────────────────────────────────────────────────────

/** One utterance: what a participant said, in their language, plus translations. */
export interface ChatCallTranscriptSegment {
  seq: number;
  /** Linux username — the filter key. NEVER rendered. */
  participantId: string;
  displayName: string;
  lang: string;
  text: string;
  /** `lang → translation`. */
  translations: Record<string, string>;
  startMs: number;
  endMs: number;
}

/** One speaker, for the participant filter. */
export interface ChatCallTranscriptParticipant {
  username: string;
  displayName: string;
  lang: string;
}

/** `GET .../messages/:mid/transcript`. */
export interface ChatCallTranscript {
  segments: ChatCallTranscriptSegment[];
  truncated: boolean;
  participants: ChatCallTranscriptParticipant[];
}

export type ChatMessageSystem = ChatCallSystemPayload;

/** Narrow an unknown `message.system` to the call payload. */
export function asCallSystem(system: unknown): ChatCallSystemPayload | null {
  if (!system || typeof system !== "object") return null;
  const s = system as Partial<ChatCallSystemPayload>;
  if (s.kind !== "call") return null;
  return {
    kind: "call",
    callId: typeof s.callId === "string" ? s.callId : "",
    outcome: s.outcome === "missed" || s.outcome === "rejected" ? s.outcome : "completed",
    durationSec: typeof s.durationSec === "number" && Number.isFinite(s.durationSec) ? s.durationSec : 0,
    participants: Array.isArray(s.participants) ? s.participants.filter((p) => typeof p === "string") : [],
    ...(typeof s.transcriptSegments === "number" && s.transcriptSegments > 0
      ? { transcriptSegments: Math.floor(s.transcriptSegments) }
      : {}),
    ...(s.transcriptTruncated === true ? { transcriptTruncated: true } : {}),
    ...(Array.isArray(s.transcript) ? { transcript: normalizeTranscriptSegments(s.transcript) } : {}),
  };
}

/** How many utterances a finished call left, from either shape the backend may send. */
export function transcriptSegmentCount(system: ChatCallSystemPayload | null): number {
  if (!system) return 0;
  if (typeof system.transcriptSegments === "number") return system.transcriptSegments;
  return system.transcript?.length ?? 0;
}

/** Coerce whatever the network returned into renderable segments. */
export function normalizeTranscriptSegments(raw: unknown): ChatCallTranscriptSegment[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatCallTranscriptSegment[] = [];
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== "object") continue;
    const s = item as Partial<ChatCallTranscriptSegment>;
    if (typeof s.participantId !== "string" || !s.participantId) continue;
    if (typeof s.text !== "string" || !s.text.trim()) continue;
    const translations: Record<string, string> = {};
    if (s.translations && typeof s.translations === "object") {
      for (const [lang, text] of Object.entries(s.translations)) {
        if (typeof text === "string" && text.trim()) translations[lang.toLowerCase()] = text;
      }
    }
    out.push({
      seq: typeof s.seq === "number" && Number.isFinite(s.seq) ? s.seq : i,
      participantId: s.participantId,
      // Bloque B: the login is the LAST resort and only because a name is required.
      displayName: typeof s.displayName === "string" && s.displayName ? s.displayName : s.participantId,
      lang: typeof s.lang === "string" && s.lang ? s.lang.toLowerCase() : "und",
      text: s.text,
      translations,
      startMs: typeof s.startMs === "number" && Number.isFinite(s.startMs) ? Math.max(0, s.startMs) : 0,
      endMs: typeof s.endMs === "number" && Number.isFinite(s.endMs) ? Math.max(0, s.endMs) : 0,
    });
  }
  return out.sort((a, b) => (a.seq === b.seq ? a.startMs - b.startMs : a.seq - b.seq));
}

/**
 * Pick the translation a READER wants: their call language first, then any
 * available one. Returns the chosen tag too, so the UI can label it.
 */
export function pickTranslation(
  segment: ChatCallTranscriptSegment,
  readerLang: string,
): { lang: string; text: string } | null {
  const entries = Object.entries(segment.translations);
  if (!entries.length) return null;
  const base = readerLang.split("-")[0]?.toLowerCase() ?? "";
  // A translation INTO the language the person already spoke is not a translation.
  const usable = entries.filter(([lang]) => lang.split("-")[0] !== segment.lang.split("-")[0]);
  if (!usable.length) return null;
  const exact = usable.find(([lang]) => lang.split("-")[0] === base);
  const [lang, text] = exact ?? usable[0]!;
  return { lang, text };
}

/** `mm:ss` offset from the start of the call, for a transcript line. */
export function formatOffset(ms: number): string {
  return formatCallDuration(Math.max(0, Math.floor(ms / 1000)));
}

/** `mm:ss`, or `h:mm:ss` past an hour. Mirrors the backend's `formatDuration`. */
export function formatCallDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** True while a call is worth showing in the UI (ringing or in progress). */
export function isCallLive(call: ChatCallView | null | undefined): call is ChatCallView {
  return !!call && call.state !== "ended";
}

/** People actually in the room (a ringing callee is not "in" yet). */
export function joinedParticipants(call: ChatCallView): ChatCallParticipant[] {
  return call.participants.filter((p) => p.state === "joined");
}
