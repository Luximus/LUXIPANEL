// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tolqia bridge (F3) — LUXIPANEL's integration with the audio-call engine.
 *
 * Tolqia (`/var/www/tolqia`, pm2 `tolqia`, `127.0.0.1:4500`) is a SEPARATE
 * product: it owns rooms, mixing and the translation pipeline. LUXIPANEL is an
 * integrator, and this service is the whole of that integration:
 *
 *   panel → Tolqia   `POST /v1/calls/rooms`, `/tokens`, `/end`, `/reject`
 *   Tolqia → panel   signed webhooks on `POST /api/chat/calls/webhook`
 *
 * ## Invariants
 * - **Never a Linux username in the UI.** Tolqia's `participantId` IS the login
 *   (the only stable per-server identity), but every `displayName` we send is
 *   the GECOS name, and `ChatCallView` is projected so the browser renders
 *   names only. Tolqia itself never renders anything.
 * - **Credentials never reach the browser.** OpenAI/ElevenLabs keys are read
 *   from the target's assistant config and posted room-level to Tolqia; they
 *   appear in no response, no SSE frame and no log line.
 * - **Per-server isolation.** Every call belongs to one `Executor`; the room
 *   registry is keyed by target so a call on server X is invisible to a session
 *   bridged to server Y.
 * - **State is in memory** (as it is in Tolqia). A backend restart forgets the
 *   registry: live calls keep working in the browser (the socket is direct),
 *   but the "call ended" system message can no longer be persisted — the SSE
 *   frame still goes out, so the UI closes correctly.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env.js";
import { fetchWithTimeout } from "../../../shared/http/fetch-timeout.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../shared/errors/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type {
  ChatCallEvent,
  ChatCallParticipant,
  ChatCallSession,
  ChatCallSseEvent,
  ChatCallView,
  ChatCallSystemPayload,
  ChatCallTranscriptResponse,
  ChatCallTranscriptSegment,
} from "../../../shared/chat-call-types.js";
import { resolveCallProviderCredentials } from "../../ai-assistant/index.js";
import { preferencesRepository } from "../../users/repositories/preferences.repository.js";
import { toChatPreferences } from "../../users/models/preferences.model.js";
import { directoryService } from "./directory.service.js";
import { capTranscript, normalizeTranscript, projectTranscript } from "./call-transcript.js";
import { messagesRepository } from "../repositories/messages.repository.js";
import { tolqiaCredentialRepository } from "../repositories/tolqia-credential.repository.js";
import { planErrorFor } from "./tolqia-errors.js";
import { chatBus, chatService, CHAT_EVENTS, participantsOf } from "./chat.service.js";
import type { ChatConversation } from "../models/chat.model.js";

const log = createModuleLogger("tolqia-bridge");

/** Upstream call budget. Tolqia answers in single-digit ms on loopback. */
const HTTP_TIMEOUT_MS = 5_000;
/** `getActiveCall` cache window — the thread header polls it on every render. */
const ACTIVE_CACHE_MS = 2_000;
/** Webhook replay window, per Tolqia's contract. */
const WEBHOOK_MAX_SKEW_SEC = 300;
/** Bounded dedupe ring for `eventId` (Tolqia retries 3×). */
const DEDUPE_MAX = 500;

// ── In-memory registry ──────────────────────────────────────────────────────

interface RoomRecord {
  roomId: string;
  convId: string;
  targetId: string;
  startedBy: string;
  /** The executor that created the call — reused by the webhook path. */
  executor: Executor;
  conv: ChatConversation;
}

/** roomId → record. */
const rooms = new Map<string, RoomRecord>();
/** `${targetId}::${convId}` → roomId, for "is there a live call here?". */
const liveByConv = new Map<string, string>();
/** Seen webhook `eventId`s, insertion-ordered so the oldest is evictable. */
const seenEvents = new Set<string>();
/** `${targetId}::${convId}` → cached snapshot. */
const activeCache = new Map<string, { at: number; value: ChatCallView | null }>();

const convKey = (targetId: string, convId: string) => `${targetId}::${convId}`;

function register(record: RoomRecord): void {
  rooms.set(record.roomId, record);
  liveByConv.set(convKey(record.targetId, record.convId), record.roomId);
}

function forget(roomId: string): void {
  const record = rooms.get(roomId);
  if (!record) return;
  rooms.delete(roomId);
  const key = convKey(record.targetId, record.convId);
  if (liveByConv.get(key) === roomId) liveByConv.delete(key);
  activeCache.delete(key);
}

/** Test seam — the module keeps process-wide state by design. */
export function __resetTolqiaBridgeState(): void {
  rooms.clear();
  liveByConv.clear();
  seenEvents.clear();
  activeCache.clear();
}

// ── externalId ──────────────────────────────────────────────────────────────

/**
 * `lxp:<targetId>:<convId>` — unique among Tolqia's LIVE rooms, which is
 * exactly the uniqueness we want: one call per conversation per server.
 * `convId` may itself contain `:`; the parser therefore splits only twice.
 */
export function buildExternalId(targetId: string, convId: string): string {
  return `lxp:${targetId}:${convId}`;
}

export function parseExternalId(externalId: string): { targetId: string; convId: string } | null {
  if (!externalId?.startsWith("lxp:")) return null;
  const rest = externalId.slice(4);
  const cut = rest.indexOf(":");
  if (cut <= 0) return null;
  return { targetId: rest.slice(0, cut), convId: rest.slice(cut + 1) };
}

// ── HTTP client ─────────────────────────────────────────────────────────────

function assertEnabled(): void {
  if (!env.CALL_ENABLED) throw new NotFoundError("Las llamadas están desactivadas");
}

/** How this server authenticates against Tolqia for one request. */
interface TolqiaAuth {
  bearer: string;
  /**
   * True when the bearer is the SERVER'S OWN tolqia.com API token. Scoped calls
   * must NOT carry `credentials`: Tolqia bills the pipeline to the token owner
   * and uses THEIR ElevenLabs/OpenAI keys, so sending ours would both leak them
   * and be ignored.
   */
  scoped: boolean;
}

/**
 * Pick the bearer for this server: its own `tq_live_…` API token when the admin
 * linked the panel to a tolqia.com account, otherwise the internal S2S secret
 * (the pre-link behaviour, still used for loopback deployments and tests).
 *
 * Throws only when NEITHER exists — with no credential at all the feature is
 * not configured, which is what the message says.
 */
async function resolveAuth(executor?: Executor | null): Promise<TolqiaAuth> {
  if (executor) {
    const token = await tolqiaCredentialRepository.token(executor).catch(() => null);
    if (token) return { bearer: token, scoped: true };
  }
  if (env.TOLQIA_SERVICE_SECRET) return { bearer: env.TOLQIA_SERVICE_SECRET, scoped: false };
  throw new ServiceUnavailableError("El servicio de llamadas no está configurado");
}

/**
 * One upstream request. Upstream failures are logged with detail and reflected
 * as a generic 503 — an upstream body may echo an `error` code but never
 * reaches the client verbatim (it could carry internal host names).
 *
 * The exception is the PLAN gate (401/402/403): those are actionable by a human
 * and are mapped to typed errors so the frontend can localize them by `code`.
 */
async function s2s<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  bearer: string = env.TOLQIA_SERVICE_SECRET,
): Promise<{ status: number; data: T }> {
  const url = `${env.TOLQIA_URL.replace(/\/+$/, "")}${path}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method,
        headers: {
          authorization: `Bearer ${bearer}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          accept: "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      HTTP_TIMEOUT_MS,
    );
  } catch (err) {
    log.error({ path, err: (err as Error).message }, "Tolqia unreachable");
    throw new ServiceUnavailableError("El servicio de llamadas no responde");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  // 409 is a CONTRACT response ("there is already a live room"), not a failure.
  if (!res.ok && res.status !== 409) {
    // Plan/token gate FIRST: 401/402/403 are billing answers, not outages.
    const planError = planErrorFor(res.status);
    if (planError) {
      log.warn({ path, status: res.status, code: planError.code }, "Tolqia plan gate");
      throw planError;
    }
    log.error({ path, status: res.status, body: data }, "Tolqia call failed");
    if (res.status === 404) throw new NotFoundError("La llamada ya no existe");
    throw new ServiceUnavailableError("El servicio de llamadas ha fallado");
  }
  return { status: res.status, data: data as T };
}

// ── Projection ──────────────────────────────────────────────────────────────

/** Tolqia `RoomView` (structurally; we do not depend on `@tolqia/contracts`). */
interface RoomView {
  id: string;
  externalId: string;
  kind: "dm" | "group";
  state: "ringing" | "active" | "ended";
  createdAt: number;
  answeredAt?: number;
  endedAt?: number;
  endReason?: ChatCallView["endReason"];
  /**
   * `reason` appears when Tolqia REFUSED translation and said why — today
   * `"PLAN_LIMIT_TRANSLATION"` / `"PLAN_INACTIVE"` on a token-scoped room.
   */
  translation?: { enabled?: boolean; provider?: string; mode?: string; reason?: string };
  participants?: Array<{
    id: string;
    displayName?: string;
    lang?: string;
    translate?: boolean;
    role?: "host" | "member";
    state?: ChatCallParticipant["state"];
    muted?: boolean;
    speaking?: boolean;
    joinedAt?: number;
  }>;
}

/**
 * `RoomView` → `ChatCallView`, re-resolving every `displayName` against the
 * LIVE directory: the room was created minutes ago and a GECOS rename must be
 * reflected immediately, exactly like `fromDisplayName` on messages.
 */
export function projectRoom(
  room: RoomView,
  convId: string,
  startedBy: string,
  display?: Map<string, string>,
): ChatCallView {
  return {
    id: room.id,
    convId,
    kind: room.kind,
    state: room.state,
    createdAt: room.createdAt,
    ...(room.answeredAt !== undefined ? { answeredAt: room.answeredAt } : {}),
    ...(room.endedAt !== undefined ? { endedAt: room.endedAt } : {}),
    ...(room.endReason !== undefined ? { endReason: room.endReason } : {}),
    participants: (room.participants ?? []).map((p) => ({
      id: p.id,
      // Never the raw login: the directory wins, the room's copy is the fallback.
      displayName: display?.get(p.id) ?? p.displayName ?? p.id,
      lang: p.lang ?? "es",
      translate: p.translate ?? false,
      role: p.role ?? "member",
      state: p.state ?? "ringing",
      muted: p.muted ?? false,
      speaking: p.speaking ?? false,
      ...(p.joinedAt !== undefined ? { joinedAt: p.joinedAt } : {}),
    })),
    translation: {
      enabled: room.translation?.enabled ?? false,
      provider: room.translation?.provider ?? "mock",
      mode: room.translation?.mode ?? "cascade",
      // Only meaningful when translation is OFF; carrying it while enabled
      // would let the UI show a "your plan does not allow…" notice over a
      // room that is in fact translating.
      ...(room.translation?.enabled !== true && room.translation?.reason
        ? { reason: room.translation.reason }
        : {}),
    },
    startedBy,
  };
}

// ── Preferences ─────────────────────────────────────────────────────────────

interface MemberCallPrefs {
  lang: string;
  translate: boolean;
  provider: "auto" | "elevenlabs" | "openai-realtime";
  dnd: boolean;
}

const DEFAULT_MEMBER_PREFS: MemberCallPrefs = {
  lang: "es",
  translate: false,
  provider: "auto",
  dnd: false,
};

/**
 * `username → calls preferences` for a member list.
 *
 * Preferences are keyed by the numeric panel userId, so we first map usernames
 * through the panel-user sidecar (the same single-read mapping `sendMessage`
 * uses for pushes). A member with no panel account, or an unreadable row, gets
 * the defaults — a missing preference must never block a call.
 */
export async function loadMemberCallPrefs(
  executor: Executor,
  usernames: string[],
): Promise<Map<string, MemberCallPrefs>> {
  const out = new Map<string, MemberCallPrefs>();
  for (const u of usernames) out.set(u, DEFAULT_MEMBER_PREFS);
  const resolved = await chatService.resolveRecipients(executor, usernames).catch(() => []);
  await Promise.all(
    resolved.map(async (r) => {
      if (typeof r.userId !== "number") return;
      try {
        const row = await preferencesRepository.findByUserId(r.userId, executor);
        if (!row) return;
        const calls = toChatPreferences(row.data ?? {}).calls;
        out.set(r.username, {
          lang: calls.language,
          translate: calls.translate,
          provider: calls.provider,
          dnd: calls.dnd,
        });
      } catch {
        /* keep the defaults */
      }
    }),
  );
  return out;
}

/** Room-level provider: the caller's choice wins, then any member's, else auto. */
function pickProvider(me: string, prefs: Map<string, MemberCallPrefs>): "elevenlabs" | "openai-realtime" | undefined {
  const mine = prefs.get(me)?.provider;
  if (mine && mine !== "auto") return mine;
  for (const p of prefs.values()) if (p.provider !== "auto") return p.provider;
  return undefined;
}

// ── SSE + push ──────────────────────────────────────────────────────────────

function emitCall(targetId: string, participants: string[], event: ChatCallSseEvent, call: ChatCallView): void {
  const payload: ChatCallEvent = { targetId, participants, event, call };
  chatBus.emit(CHAT_EVENTS.CALL, payload);
}

// ── Public API ──────────────────────────────────────────────────────────────

export const tolqiaBridge = {
  /** Only known live rooms need catch-up. Do not enumerate every conversation. */
  activeConversationIds(targetId: string, username: string): string[] {
    return [...rooms.values()].filter(room => room.targetId === targetId && room.conv.members.includes(username)).map(room => room.convId);
  },
  /**
   * Start (or join) the call of a conversation.
   *
   * The membership gate is `chatService.getConversation`. Tolqia enforces "one
   * live room per externalId" for us: a `409` means somebody already started
   * this call, so we simply mint a token for the live room and report
   * `joined: true` — that is the "Unirse" path in the UI, and it makes the
   * endpoint idempotent under a double click.
   */
  async startCall(executor: Executor, me: string, convId: string): Promise<ChatCallSession> {
    assertEnabled();
    const conv = await chatService.getConversation(executor, me, convId);
    const targetId = executor.target.id;
    const members = await participantsOf(executor, conv);
    if (members.length < 2) throw new ValidationError("La conversación no tiene a nadie más");

    // The bearer decides WHO PAYS: with the server's own tolqia.com token the
    // pipeline runs on the token owner's ElevenLabs/OpenAI keys, so we must not
    // resolve — let alone send — the panel's own credentials.
    const auth = await resolveAuth(executor);
    const [display, prefs, credentials] = await Promise.all([
      directoryService.displayNames(executor).catch(() => new Map<string, string>()),
      loadMemberCallPrefs(executor, members),
      auth.scoped ? Promise.resolve({}) : resolveCallProviderCredentials(executor).catch(() => ({})),
    ]);

    const nameOf = (u: string) => display.get(u) ?? u;
    const participantInput = (u: string) => {
      const p = prefs.get(u) ?? DEFAULT_MEMBER_PREFS;
      return { participantId: u, displayName: nameOf(u), lang: p.lang, translate: p.translate };
    };
    const invitees = members.filter((u) => u !== me);
    const provider = pickProvider(me, prefs);
    const translationEnabled = members.some((u) => (prefs.get(u) ?? DEFAULT_MEMBER_PREFS).translate);

    const { status, data } = await s2s<{ room: RoomView; reason?: string; translation?: { reason?: string } }>(
      "POST",
      "/v1/calls/rooms",
      {
        externalId: buildExternalId(targetId, convId),
        kind: conv.kind === "dm" ? "dm" : "group",
        createdBy: participantInput(me),
        invitees: invitees.map(participantInput),
        translation: {
          enabled: translationEnabled,
          ...(provider ? { provider } : {}),
          // Unscoped: every key comes from THIS panel's credential vault, so
          // the room-level ("host") keys are the honest description of who
          // pays. Scoped: the token owner's keys are, and Tolqia picks them.
          ...(auth.scoped ? {} : { credentialsPolicy: "host" as const }),
        },
        ...(Object.keys(credentials).length ? { credentials } : {}),
        metadata: { conversationId: convId, targetId },
      },
      auth.bearer,
    );

    const room = data?.room;
    if (!room?.id) throw new ServiceUnavailableError("El servicio de llamadas ha fallado");
    const joined = status === 409;

    // "Translation was refused and here is why" may ride the room, the envelope
    // or a sibling `translation` block depending on how Tolqia ships it — take
    // whichever arrived, and only when translation actually came back off.
    const planReason = room.translation?.reason ?? data?.translation?.reason ?? data?.reason;
    if (planReason && room.translation?.enabled !== true) {
      room.translation = { ...(room.translation ?? {}), reason: planReason };
    }

    const existing = rooms.get(room.id);
    const startedBy = existing?.startedBy ?? (joined ? (room.participants?.find((p) => p.role === "host")?.id ?? me) : me);
    register({ roomId: room.id, convId, targetId, startedBy, executor, conv });
    activeCache.delete(convKey(targetId, convId));

    const session = await this.mintToken(room, convId, startedBy, me, display, auth.bearer);

    // Ring everyone else. A fresh room rings; joining a live one only refreshes
    // the state (the callees are already ringing from the first create).
    emitCall(targetId, members, joined ? "state" : "ring", session.call);
    if (!joined) void this.pushIncoming(executor, conv, me, members, prefs, nameOf(me));
    return { ...session, joined };
  },

  /** Mint the participant token for `me` and build the session envelope. */
  async mintToken(
    room: RoomView,
    convId: string,
    startedBy: string,
    me: string,
    display: Map<string, string>,
    bearer?: string,
  ): Promise<Omit<ChatCallSession, "joined">> {
    const { data } = await s2s<{ token: string; expiresAt: number; wsUrl: string }>(
      "POST",
      "/v1/calls/tokens",
      { roomId: room.id, participantId: me, displayName: display.get(me) ?? me },
      bearer,
    );
    if (!data?.token || !data?.wsUrl) throw new ServiceUnavailableError("No se pudo unir a la llamada");
    return {
      call: projectRoom(room, convId, startedBy, display),
      token: data.token,
      expiresAt: data.expiresAt,
      // VERBATIM: it already carries the token and the deployment's public path.
      wsUrl: data.wsUrl,
    };
  },

  /**
   * Bell + device push for members who are not looking at the panel, so a call
   * reaches a closed tab. `dnd` members are skipped entirely — "no molestar"
   * means no push, and Tolqia will time them out as `missed`.
   */
  async pushIncoming(
    executor: Executor,
    conv: ChatConversation,
    from: string,
    members: string[],
    prefs: Map<string, MemberCallPrefs>,
    fromName: string,
  ): Promise<void> {
    try {
      const targets = members.filter((u) => u !== from && !(prefs.get(u)?.dnd ?? false));
      if (!targets.length) return;
      const recipients = await chatService.resolveRecipients(executor, targets);
      eventBus.emit(Events.CHAT_MESSAGE_RECEIVED, {
        host: null,
        targetId: executor.target.id,
        convId: conv.id,
        title: `Llamada entrante de ${fromName}`,
        body: fromName,
        recipients,
      });
    } catch (err) {
      log.warn({ err: (err as Error).message }, "call push failed");
    }
  },

  /** Accept a ringing call: membership gate + a token for the live room. */
  async acceptCall(executor: Executor, me: string, callId: string): Promise<ChatCallSession> {
    assertEnabled();
    const { record, room } = await this.loadRoom(executor, me, callId);
    if (room.state === "ended") throw new NotFoundError("La llamada ya ha terminado");
    const display = await directoryService.displayNames(executor).catch(() => new Map<string, string>());
    const bearer = (await resolveAuth(executor)).bearer;
    const session = await this.mintToken(room, record.convId, record.startedBy, me, display, bearer);
    return { ...session, joined: true };
  },

  /** Decline: the callee is marked `rejected` (a DM reject ends the room). */
  async rejectCall(executor: Executor, me: string, callId: string): Promise<ChatCallView> {
    assertEnabled();
    const { record } = await this.loadRoom(executor, me, callId);
    const { data } = await s2s<{ room: RoomView }>(
      "POST",
      `/v1/calls/rooms/${encodeURIComponent(callId)}/participants/${encodeURIComponent(me)}/reject`,
      undefined,
      (await resolveAuth(executor)).bearer,
    );
    return this.afterMutation(executor, record, data?.room);
  },

  /** Hang up for everyone. Idempotent upstream. */
  async endCall(executor: Executor, me: string, callId: string): Promise<ChatCallView> {
    assertEnabled();
    const { record } = await this.loadRoom(executor, me, callId);
    const { data } = await s2s<{ room: RoomView }>(
      "POST",
      `/v1/calls/rooms/${encodeURIComponent(callId)}/end`,
      { reason: "hangup" },
      (await resolveAuth(executor)).bearer,
    );
    return this.afterMutation(executor, record, data?.room);
  },

  /** Re-project + broadcast after a mutation, so every client agrees at once. */
  async afterMutation(
    executor: Executor,
    record: RoomRecord,
    room: RoomView | undefined,
  ): Promise<ChatCallView> {
    if (!room?.id) throw new ServiceUnavailableError("El servicio de llamadas ha fallado");
    const display = await directoryService.displayNames(executor).catch(() => new Map<string, string>());
    const call = projectRoom(room, record.convId, record.startedBy, display);
    const members = await participantsOf(executor, record.conv).catch(() => record.conv.members ?? []);
    activeCache.delete(convKey(record.targetId, record.convId));
    emitCall(record.targetId, members, call.state === "ended" ? "end" : "state", call);
    if (call.state === "ended") forget(record.roomId);
    return call;
  },

  /** Snapshot of one call, membership-gated. */
  async getCall(executor: Executor, me: string, callId: string): Promise<ChatCallView> {
    assertEnabled();
    const { record, room } = await this.loadRoom(executor, me, callId);
    const display = await directoryService.displayNames(executor).catch(() => new Map<string, string>());
    return projectRoom(room, record.convId, record.startedBy, display);
  },

  /**
   * The live call of a conversation, or `null`.
   *
   * Cached for 2 s per (target, conversation): the thread header and every
   * conversation row ask for it, and a stale-by-2-s answer is corrected by the
   * SSE stream long before a human notices.
   */
  async getActiveCall(executor: Executor, me: string, convId: string): Promise<ChatCallView | null> {
    if (!env.CALL_ENABLED) return null;
    await chatService.getConversation(executor, me, convId); // membership gate
    const targetId = executor.target.id;
    const key = convKey(targetId, convId);
    const hit = activeCache.get(key);
    if (hit && Date.now() - hit.at < ACTIVE_CACHE_MS) return hit.value;

    const roomId = liveByConv.get(key);
    let value: ChatCallView | null = null;
    if (roomId) {
      try {
        const record = rooms.get(roomId)!;
        const { data } = await s2s<{ room: RoomView }>(
          "GET",
          `/v1/calls/rooms/${encodeURIComponent(roomId)}`,
          undefined,
          (await resolveAuth(executor)).bearer,
        );
        const room = data?.room;
        if (room && room.state !== "ended") {
          const display = await directoryService.displayNames(executor).catch(() => new Map<string, string>());
          value = projectRoom(room, convId, record.startedBy, display);
        } else {
          forget(roomId);
        }
      } catch {
        // Upstream hiccup or a room Tolqia forgot: report "no call" rather than
        // failing the whole thread render.
        forget(roomId);
        value = null;
      }
    }
    activeCache.set(key, { at: Date.now(), value });
    return value;
  },

  /** Resolve a callId to its registry record + fresh room, with the auth gate. */
  async loadRoom(
    executor: Executor,
    me: string,
    callId: string,
  ): Promise<{ record: RoomRecord; room: RoomView }> {
    const record = rooms.get(callId);
    if (!record) throw new NotFoundError("La llamada no existe");
    // Per-server isolation FIRST: a session bridged elsewhere must not even
    // learn that this call id exists.
    if (record.targetId !== executor.target.id) throw new NotFoundError("La llamada no existe");
    const members = await participantsOf(executor, record.conv).catch(() => record.conv.members ?? []);
    if (!members.includes(me)) throw new ForbiddenError("No participas en esta llamada");
    const { data } = await s2s<{ room: RoomView }>(
      "GET",
      `/v1/calls/rooms/${encodeURIComponent(callId)}`,
      undefined,
      (await resolveAuth(executor)).bearer,
    );
    if (!data?.room) throw new NotFoundError("La llamada no existe");
    return { record, room: data.room };
  },

  // ── Transcripts ───────────────────────────────────────────────────────────

  /**
   * Pull the transcript of a finished room from Tolqia (available 24 h).
   *
   * FAIL-OPEN on purpose: this runs inside the webhook, where throwing would
   * cost us the "call ended" system message and the SSE frame. An unreachable
   * or not-yet-deployed endpoint simply means "no transcript".
   */
  async fetchTranscript(
    roomId: string,
    executor?: Executor | null,
  ): Promise<{ segments: ChatCallTranscriptSegment[]; truncated: boolean }> {
    if (!env.CALL_ENABLED) return { segments: [], truncated: false };
    try {
      // Fail-open all the way down: a server with neither a Tolqia token nor an
      // S2S secret simply has no transcript to pull.
      const auth = await resolveAuth(executor).catch(() => null);
      if (!auth) return { segments: [], truncated: false };
      const { data } = await s2s<{ transcript?: unknown; truncated?: boolean }>(
        "GET",
        `/v1/calls/rooms/${encodeURIComponent(roomId)}/transcript`,
        undefined,
        auth.bearer,
      );
      return {
        segments: normalizeTranscript(data?.transcript),
        truncated: data?.truncated === true,
      };
    } catch (err) {
      log.warn({ roomId, err: (err as Error).message }, "call transcript fetch failed");
      return { segments: [], truncated: false };
    }
  },

  /**
   * `GET /api/chat/conversations/:id/messages/:mid/transcript`.
   *
   * The gate is conversation MEMBERSHIP (`getConversation`), the same one that
   * lets a user read the thread at all — a transcript is part of the thread.
   * The persisted copy is authoritative; the upstream pull is only a rescue for
   * a call whose webhook arrived before Tolqia had the transcript ready, and it
   * is never written back (the message is immutable once posted).
   */
  async getCallTranscript(
    executor: Executor,
    me: string,
    convId: string,
    messageId: string,
  ): Promise<ChatCallTranscriptResponse> {
    await chatService.getConversation(executor, me, convId); // membership gate
    const message = await messagesRepository.get(executor, convId, messageId);
    const system = message?.system;
    if (!message || !system || system.kind !== "call") {
      throw new NotFoundError("La transcripción no existe");
    }

    let segments = normalizeTranscript(system.transcript);
    let truncated = system.transcriptTruncated === true;
    if (segments.length === 0 && system.callId) {
      const pulled = await this.fetchTranscript(system.callId, executor);
      segments = pulled.segments;
      truncated = truncated || pulled.truncated;
    }

    const display = await directoryService.displayNames(executor).catch(() => new Map<string, string>());
    const projected = projectTranscript(segments, display);
    return { segments: projected.segments, truncated, participants: projected.participants };
  },

  // ── Webhooks ──────────────────────────────────────────────────────────────

  /**
   * Verify + apply one Tolqia webhook.
   *
   * Order matters and is the contract's: skew window → HMAC over the RAW bytes
   * → parse → dedupe. Parsing before the signature matches would hand attacker
   * input to the JSON parser; comparing with `===` would leak timing.
   */
  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ ok: boolean; deduped?: boolean }> {
    if (!env.CALL_ENABLED) throw new NotFoundError("Las llamadas están desactivadas");
    const secret = env.TOLQIA_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableError("Webhook de llamadas no configurado");

    const header = (name: string): string => {
      const v = headers[name];
      return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
    };

    const ts = Number.parseInt(header("x-tolqia-timestamp"), 10);
    if (!Number.isFinite(ts)) throw new ForbiddenError("Firma inválida");
    if (Math.abs(Date.now() / 1000 - ts) > WEBHOOK_MAX_SKEW_SEC) throw new ForbiddenError("Firma caducada");

    const expected = `sha256=${createHmac("sha256", secret).update(`${ts}.${rawBody.toString("utf8")}`).digest("hex")}`;
    const got = header("x-tolqia-signature");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(got, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenError("Firma inválida");

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as WebhookPayload;
    } catch {
      throw new ValidationError("Cuerpo inválido");
    }

    const eventId = payload.eventId || header("idempotency-key") || randomUUID();
    if (seenEvents.has(eventId)) return { ok: true, deduped: true };
    seenEvents.add(eventId);
    while (seenEvents.size > DEDUPE_MAX) {
      const oldest = seenEvents.values().next().value;
      if (oldest === undefined) break;
      seenEvents.delete(oldest);
    }

    await this.applyWebhook(payload);
    return { ok: true };
  },

  /** Apply a VERIFIED webhook: persist the outcome, then broadcast. */
  async applyWebhook(payload: WebhookPayload): Promise<void> {
    const room = payload.room;
    if (!room?.id) return;
    const record = rooms.get(room.id);
    const parsed = parseExternalId(payload.externalId ?? room.externalId ?? "");
    const convId = record?.convId ?? parsed?.convId;
    const targetId = record?.targetId ?? parsed?.targetId;
    if (!convId || !targetId) return;

    const executor = record?.executor;
    const display = executor
      ? await directoryService.displayNames(executor).catch(() => new Map<string, string>())
      : new Map<string, string>();
    const call = projectRoom(room, convId, record?.startedBy ?? "", display);

    const ended = payload.event === "room.ended" || payload.event === "room.missed";

    // Persist the outcome BEFORE the SSE frame so a client that refetches the
    // thread on `chat:call:end` already sees the chip.
    if (ended && executor && record) {
      const data = (payload.data ?? {}) as RoomEndedData;
      const outcome: ChatCallSystemPayload["outcome"] =
        payload.event === "room.missed" || room.endReason === "missed"
          ? "missed"
          : room.endReason === "rejected"
            ? "rejected"
            : "completed";
      const names = (data.participants ?? [])
        .filter((p) => (p.joinedSec ?? 0) > 0)
        .map((p) => display.get(p.id) ?? p.displayName ?? p.id);
      const durationSec = Math.max(0, Math.round(data.durationSec ?? 0));

      // The transcript rides the webhook when Tolqia can afford it; otherwise
      // we pull it from the 24-hour endpoint. Both paths are FAIL-OPEN: a call
      // must leave its chip in the thread even if the transcript is lost.
      let segments = normalizeTranscript(data.transcript);
      let upstreamTruncated = data.transcriptTruncated === true;
      if (segments.length === 0 && outcome === "completed") {
        const pulled = await this.fetchTranscript(room.id, executor);
        segments = pulled.segments;
        upstreamTruncated = upstreamTruncated || pulled.truncated;
      }
      const capped = capTranscript(segments);

      const system: ChatCallSystemPayload = {
        kind: "call",
        callId: room.id,
        outcome,
        durationSec,
        participants: names,
        ...(capped.segments.length
          ? {
              transcript: capped.segments,
              transcriptSegments: capped.segments.length,
              transcriptTruncated: upstreamTruncated || capped.truncated,
            }
          : {}),
      };
      const body =
        outcome === "completed"
          ? `Llamada de voz · ${formatDuration(durationSec)} · ${names.length} participantes`
          : outcome === "rejected"
            ? "Llamada rechazada"
            : "Llamada perdida";
      await chatService.postSystemMessage(executor, convId, body, system).catch((err: Error) => {
        log.warn({ err: err.message, convId }, "call system message failed");
        return null;
      });
    }

    const members = record
      ? await participantsOf(record.executor, record.conv).catch(() => record.conv.members ?? [])
      : call.participants.map((p) => p.id);
    emitCall(targetId, members, ended ? "end" : "state", call);
    if (ended) forget(room.id);
    else if (record) activeCache.delete(convKey(targetId, convId));
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** `mm:ss`, or `h:mm:ss` past an hour. Mirrors the SDK's `formatDuration`. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m).padStart(2, "0");
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

interface RoomEndedData {
  reason?: string;
  durationSec?: number;
  participants?: Array<{ id: string; displayName?: string; joinedSec?: number }>;
  /** Per-speaker history. Added by Tolqia after the first release of F3, hence optional. */
  transcript?: unknown;
  transcriptTruncated?: boolean;
}

interface WebhookPayload {
  eventId: string;
  event: string;
  at: number;
  room: RoomView;
  externalId?: string;
  data?: unknown;
}

/** Exported for the controller's `GET /api/chat/conversations/:id/call`. */
export type { RoomView as TolqiaRoomView };
