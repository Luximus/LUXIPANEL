// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat ↔ calls wire contract (F3).
 *
 * This file is the BACKEND half of a twin pair: `frontend/src/lib/chat-call.ts`
 * declares the exact same shapes for the browser. Neither side imports the
 * other (they are separate npm projects), so any change here must be mirrored
 * there — the twin carries the same section headings to make that obvious.
 *
 * What travels between them:
 *   1. `ChatCallView` — the projection of a Tolqia `RoomView` that the panel is
 *      allowed to show. It NEVER carries a Linux username (bloque B: the UI
 *      renders display names only) and NEVER carries provider credentials.
 *   2. The SSE events pushed on `GET /api/chat/stream` (`chat:call:*`).
 *   3. `ChatMessageSystem` — the `system` payload of the message posted when a
 *      call ends, which the bubble renders as a chip.
 *
 * Deliberately dependency-free: it must be importable from `shared/` without
 * dragging Tolqia's `@tolqia/contracts` into the backend's dependency tree.
 */

/** Lifecycle of a call, mirroring Tolqia's `RoomState`. */
export type ChatCallState = "ringing" | "active" | "ended";

/** Per-participant lifecycle, mirroring Tolqia's `ParticipantState`. */
export type ChatCallParticipantState = "ringing" | "joined" | "left" | "rejected" | "missed";

/** Why a call ended, mirroring Tolqia's `RoomEndReason`. */
export type ChatCallEndReason =
  | "completed"
  | "hangup"
  | "missed"
  | "rejected"
  | "max-duration"
  | "error";

/**
 * One participant as the PANEL shows them.
 *
 * `id` is the Tolqia participant id, which is the Linux username — it is the
 * only stable per-server identity we have, and Tolqia never renders it. The UI
 * must render `displayName`; `id` exists so the client can tell "me" apart and
 * so `POST .../reject` can address a participant.
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

/** The credential-free projection of a Tolqia room the panel may render. */
export interface ChatCallView {
  /** Tolqia room id. Used as `callId` in every route below. */
  id: string;
  /** Conversation this call belongs to. */
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
   * the linked tolqia.com plan allows) or `"PLAN_INACTIVE"`. The UI turns it
   * into a discreet notice with a link to the pricing page; an absent `reason`
   * with `enabled:false` simply means nobody asked for translation.
   */
  translation: { enabled: boolean; provider: string; mode: string; reason?: string };
  /** Username that pressed "call" (never rendered — use `participants`). */
  startedBy: string;
}

/** `POST /api/chat/conversations/:id/call` and `.../calls/:id/accept` → 200. */
export interface ChatCallSession {
  call: ChatCallView;
  /** Participant JWT for THIS user. Short-lived (5 min). */
  token: string;
  /** Epoch ms. */
  expiresAt: number;
  /**
   * The URL the browser must open, verbatim. It is host-relative and already
   * carries the token AND the deployment's public path — never rebuild it.
   */
  wsUrl: string;
  /** Whether the caller joined an already-live room instead of creating one. */
  joined: boolean;
}

// ── SSE (`GET /api/chat/stream`) ────────────────────────────────────────────

/** Event names pushed over the chat SSE stream for calls. */
export const CHAT_CALL_SSE_EVENTS = {
  RING: "chat:call:ring",
  STATE: "chat:call:state",
  END: "chat:call:end",
} as const;

export type ChatCallSseEvent = "ring" | "state" | "end";

/** Payload of every `chat:call:*` SSE frame (and of the `CHAT_EVENTS.CALL` bus event). */
export interface ChatCallEvent {
  /** Server scope — only sessions bridged to this target receive it. */
  targetId: string;
  /** Usernames allowed to receive this event. */
  participants: string[];
  /** Which flavour of event this is (also encoded in the SSE event name). */
  event: ChatCallSseEvent;
  call: ChatCallView;
}

// ── System messages (the "call ended" chip) ─────────────────────────────────

/** `ChatMessage.system` payload for a finished call. */
export interface ChatCallSystemPayload {
  kind: "call";
  callId: string;
  outcome: "completed" | "missed" | "rejected";
  durationSec: number;
  /** DISPLAY NAMES of everyone who took part. Never usernames. */
  participants: string[];
  /**
   * What each participant said, in their language, plus the translations that
   * were produced. Persisted with the message (capped — see
   * `capCallTranscript`), and DELIBERATELY stripped from the thread listing and
   * from the SSE frame: the bubble only needs `transcriptSegments` to offer the
   * "ver transcripción" affordance, and fetches the body on demand.
   */
  transcript?: ChatCallTranscriptSegment[];
  /** True when Tolqia truncated the transcript, or when our cap did. */
  transcriptTruncated?: boolean;
  /** Number of persisted segments — survives the strip above. */
  transcriptSegments?: number;
}

/** Discriminated union of every system-message payload (only calls today). */
export type ChatMessageSystem = ChatCallSystemPayload;

// ── Call transcript (per-speaker history) ───────────────────────────────────

/**
 * One utterance of a call, exactly as Tolqia diarised it.
 *
 * `participantId` is the Linux login (Tolqia's participant id) and is the JOIN
 * key, never a label: `displayName` is re-resolved against the live directory
 * on every read, like `fromDisplayName` on a message, so a GECOS rename shows
 * up in old transcripts too.
 */
export interface ChatCallTranscriptSegment {
  /** Monotonic order within the call. */
  seq: number;
  /** Linux username — the join key. NEVER rendered. */
  participantId: string;
  /** Human name (decorated on read, not authoritative in the sidecar). */
  displayName: string;
  /** BCP-47-ish tag of the language the person actually spoke. */
  lang: string;
  /** What they said, in their own language. */
  text: string;
  /** `lang → translation`. May be empty when nobody needed a translation. */
  translations: Record<string, string>;
  /** Milliseconds from the start of the call. */
  startMs: number;
  endMs: number;
}

/** One speaker of a transcript, for the participant filter. */
export interface ChatCallTranscriptParticipant {
  /** Linux username — used only as a filter key, never rendered. */
  username: string;
  displayName: string;
  lang: string;
}

/** `GET /api/chat/conversations/:id/messages/:mid/transcript`. */
export interface ChatCallTranscriptResponse {
  segments: ChatCallTranscriptSegment[];
  /** True when Tolqia dropped utterances, or when our cap did. */
  truncated: boolean;
  participants: ChatCallTranscriptParticipant[];
}
