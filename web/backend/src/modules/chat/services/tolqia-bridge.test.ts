// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — the Tolqia bridge (F3).
 *
 * The three things worth pinning down here are the ones that are expensive to
 * discover in production:
 *
 *  1. the `POST /v1/calls/rooms` contract, including the 409 "join the live
 *     room" path and a hard upstream failure surfacing as a 503;
 *  2. webhook verification — a good signature, a bad one, a replay outside the
 *     skew window and a duplicate `eventId` must all behave differently;
 *  3. the visible side effects: the "call ended" system message, the SSE frames
 *     on `chatBus`, and `dnd` suppressing the incoming push.
 *
 * Everything downstream (the real Tolqia server, SSH, sidecars) is mocked: the
 * bridge is pure orchestration and that is exactly what we want to test.
 */

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` factories are hoisted above every `const`, so the fixtures they
// close over have to be hoisted with them.
const { SERVICE_SECRET, WEBHOOK_SECRET, chatBus, CHAT_EVENTS, conv } = vi.hoisted(() => {
  const { EventEmitter: E } = require("node:events") as typeof import("node:events");
  return {
    SERVICE_SECRET: "service-secret",
    WEBHOOK_SECRET: "webhook-secret",
    chatBus: new E(),
    CHAT_EVENTS: {
      MESSAGE: "chat:message",
      READ: "chat:read",
      CONVERSATION: "chat:conversation",
      CALL: "chat:call",
    } as const,
    conv: {
      id: "dm_alice__bob",
      kind: "dm" as const,
      members: ["alice", "bob"],
      createdBy: "alice",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
});

vi.mock("../../../config/env.js", () => ({
  env: {
    // `shared/logger` reads these at import time.
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    CALL_ENABLED: true,
    TOLQIA_URL: "http://127.0.0.1:4500",
    TOLQIA_SERVICE_SECRET: SERVICE_SECRET,
    TOLQIA_WEBHOOK_SECRET: WEBHOOK_SECRET,
    TOLQIA_PUBLIC_PATH: "/tolqia",
    CALL_RING_TIMEOUT_MS: 45_000,
  },
}));

vi.mock("./chat.service.js", () => ({
  chatBus,
  CHAT_EVENTS,
  participantsOf: vi.fn(async () => ["alice", "bob"]),
  chatService: {
    getConversation: vi.fn(async () => conv),
    resolveRecipients: vi.fn(async (_e: unknown, users: string[]) =>
      users.map((username, i) => ({ username, userId: 100 + i })),
    ),
    postSystemMessage: vi.fn(async () => null),
  },
}));

vi.mock("./directory.service.js", () => ({
  directoryService: {
    displayNames: vi.fn(async () => new Map([["alice", "Alicia Ruiz"], ["bob", "Roberto Paz"]])),
  },
}));

vi.mock("../../ai-assistant/index.js", () => ({
  resolveCallProviderCredentials: vi.fn(async () => ({ openai: { apiKey: "sk-panel" } })),
}));

vi.mock("../../users/repositories/preferences.repository.js", () => ({
  preferencesRepository: { findByUserId: vi.fn(async () => undefined) },
}));

vi.mock("../../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn() },
  Events: { CHAT_MESSAGE_RECEIVED: "chat:message:received" },
}));

vi.mock("../repositories/messages.repository.js", () => ({
  messagesRepository: { get: vi.fn(async () => null) },
}));

// The server→tolqia.com link. Unlinked by default (the S2S-secret path); the
// "linked" tests flip `token` per case.
vi.mock("../repositories/tolqia-credential.repository.js", () => ({
  tolqiaCredentialRepository: {
    token: vi.fn(async () => null),
    redacted: vi.fn(async () => ({ tokenSet: false, tokenPreview: "" })),
    save: vi.fn(),
    clear: vi.fn(),
  },
  previewOf: (t: string) => t.slice(0, 12),
  TOLQIA_TOKEN_RE: /^tq_live_[A-Za-z0-9]{40}$/,
}));

import {
  tolqiaBridge,
  buildExternalId,
  parseExternalId,
  formatDuration,
  __resetTolqiaBridgeState,
} from "./tolqia-bridge.service.js";
import { capTranscript, normalizeTranscript, TRANSCRIPT_MAX_SEGMENTS } from "./call-transcript.js";
import { chatService } from "./chat.service.js";
import { messagesRepository } from "../repositories/messages.repository.js";
import { tolqiaCredentialRepository } from "../repositories/tolqia-credential.repository.js";
import { preferencesRepository } from "../../users/repositories/preferences.repository.js";
import { eventBus } from "../../../shared/events/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ChatCallEvent } from "../../../shared/chat-call-types.js";

const executor = { target: { id: "t1", name: "t1" } } as unknown as Executor;

/** A minimal Tolqia `RoomView`. */
function room(overrides: Record<string, unknown> = {}) {
  return {
    id: "room-1",
    externalId: buildExternalId("t1", conv.id),
    kind: "dm",
    state: "ringing",
    createdAt: 1_700_000_000_000,
    translation: { enabled: false, provider: "mock", mode: "cascade", credentialsPolicy: "host" },
    participants: [
      { id: "alice", displayName: "Alicia Ruiz", lang: "es", translate: false, role: "host", state: "joined", muted: false, speaking: false },
      { id: "bob", displayName: "Roberto Paz", lang: "es", translate: false, role: "member", state: "ringing", muted: false, speaking: false },
    ],
    ...overrides,
  };
}

/** Queue of canned `fetch` answers, consumed in order. */
let responses: Array<{ status: number; body: unknown }>;
let requests: Array<{ url: string; init: RequestInit }>;

function fetchMock(input: unknown, init: RequestInit) {
  requests.push({ url: String(input), init });
  const next = responses.shift() ?? { status: 500, body: { error: "no canned response" } };
  return Promise.resolve({
    ok: next.status >= 200 && next.status < 300,
    status: next.status,
    json: async () => next.body,
  } as Response);
}

/** Collect every `chatBus` call event emitted during `fn`. */
async function captureCallEvents(fn: () => Promise<unknown>): Promise<ChatCallEvent[]> {
  const seen: ChatCallEvent[] = [];
  const onCall = (e: ChatCallEvent) => seen.push(e);
  chatBus.on(CHAT_EVENTS.CALL, onCall);
  try {
    await fn();
  } finally {
    chatBus.off(CHAT_EVENTS.CALL, onCall);
  }
  return seen;
}

beforeEach(() => {
  responses = [];
  requests = [];
  __resetTolqiaBridgeState();
  // `clearAllMocks` wipes calls but keeps implementations, so a per-test
  // `mockImplementation` (the `dnd` case) would leak into the next test.
  vi.mocked(preferencesRepository.findByUserId).mockReset().mockResolvedValue(undefined);
  vi.mocked(messagesRepository.get).mockReset().mockResolvedValue(null);
  vi.mocked(tolqiaCredentialRepository.token).mockReset().mockResolvedValue(null);
  vi.stubGlobal("fetch", vi.fn(fetchMock));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("externalId", () => {
  it("round-trips a conversation id that itself contains a colon", () => {
    const id = buildExternalId("t1", "lg_a:b");
    expect(parseExternalId(id)).toEqual({ targetId: "t1", convId: "lg_a:b" });
  });

  it("rejects a foreign externalId", () => {
    expect(parseExternalId("zoom:1:2")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("pads mm:ss and grows to h:mm:ss", () => {
    expect(formatDuration(9)).toBe("00:09");
    expect(formatDuration(252)).toBe("04:12");
    expect(formatDuration(3_661)).toBe("1:01:01");
  });
});

describe("startCall", () => {
  it("creates a room, mints a token and rings the members", async () => {
    responses = [
      { status: 201, body: { room: room() } },
      { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/v1/calls/rooms/room-1/ws?token=jwt" } },
    ];

    let session!: Awaited<ReturnType<typeof tolqiaBridge.startCall>>;
    const events = await captureCallEvents(async () => {
      session = await tolqiaBridge.startCall(executor, "alice", conv.id);
    });

    expect(session.joined).toBe(false);
    // The wsUrl is forwarded VERBATIM — the public prefix is Tolqia's to choose.
    expect(session.wsUrl).toBe("/tolqia/v1/calls/rooms/room-1/ws?token=jwt");
    expect(session.call.participants.map((p) => p.displayName)).toEqual(["Alicia Ruiz", "Roberto Paz"]);
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("ring");
    expect(events[0]!.participants).toEqual(["alice", "bob"]);

    const create = JSON.parse(String(requests[0]!.init.body));
    expect(create.externalId).toBe("lxp:t1:dm_alice__bob");
    // Panel credentials travel room-level and never come back.
    expect(create.credentials).toEqual({ openai: { apiKey: "sk-panel" } });
    expect(JSON.stringify(session)).not.toContain("sk-panel");
    expect(String(requests[0]!.init.headers?.["authorization" as never])).toContain(SERVICE_SECRET);
  });

  it("treats a 409 as 'join the live room' instead of an error", async () => {
    responses = [
      { status: 409, body: { error: "room-active", room: room({ state: "active" }) } },
      { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/ws" } },
    ];

    const events = await captureCallEvents(async () => {
      const session = await tolqiaBridge.startCall(executor, "bob", conv.id);
      expect(session.joined).toBe(true);
      expect(session.call.state).toBe("active");
    });

    // Joining must NOT re-ring anybody.
    expect(events.map((e) => e.event)).toEqual(["state"]);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("surfaces an upstream 500 as a 503, never as a leaked upstream body", async () => {
    responses = [{ status: 500, body: { error: "internal", message: "postgres at db-internal:5432 down" } }];

    await expect(tolqiaBridge.startCall(executor, "alice", conv.id)).rejects.toMatchObject({
      statusCode: 503,
    });
    await expect(tolqiaBridge.startCall(executor, "alice", conv.id)).rejects.not.toMatchObject({
      message: expect.stringContaining("db-internal"),
    });
  });

  it("skips the incoming push for a member on do-not-disturb", async () => {
    vi.mocked(preferencesRepository.findByUserId).mockImplementation(async (userId: number) =>
      // bob is the second member → userId 101.
      userId === 101
        ? ({ data: { chat: { calls: { dnd: true } } } } as never)
        : (undefined as never),
    );
    responses = [
      { status: 201, body: { room: room() } },
      { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/ws" } },
    ];

    await tolqiaBridge.startCall(executor, "alice", conv.id);
    await new Promise((r) => setImmediate(r)); // the push is fire-and-forget

    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("pushes 'Llamada entrante de <nombre visible>' to an available member", async () => {
    responses = [
      { status: 201, body: { room: room() } },
      { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/ws" } },
    ];

    await tolqiaBridge.startCall(executor, "alice", conv.id);
    await new Promise((r) => setImmediate(r));

    expect(eventBus.emit).toHaveBeenCalledWith(
      "chat:message:received",
      expect.objectContaining({
        convId: conv.id,
        // The human name, never the Linux login (bloque B).
        title: "Llamada entrante de Alicia Ruiz",
        recipients: [{ username: "bob", userId: 100 }],
      }),
    );
  });
});

// ── Webhooks ────────────────────────────────────────────────────────────────

function signedHeaders(body: string, secret = WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000)) {
  return {
    "x-tolqia-timestamp": String(ts),
    "x-tolqia-signature": `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`,
  };
}

function endedPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    eventId: "evt-1",
    event: "room.ended",
    at: Date.now(),
    room: room({ state: "ended", endReason: "completed", endedAt: Date.now() }),
    externalId: buildExternalId("t1", conv.id),
    data: {
      reason: "completed",
      durationSec: 252,
      participants: [
        { id: "alice", displayName: "Alicia Ruiz", joinedSec: 250 },
        { id: "bob", displayName: "Roberto Paz", joinedSec: 240 },
      ],
    },
    ...overrides,
  });
}

/** Put a live room in the registry so the webhook has an executor to persist with. */
async function seedLiveRoom(): Promise<void> {
  responses = [
    { status: 201, body: { room: room() } },
    { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/ws" } },
  ];
  await tolqiaBridge.startCall(executor, "alice", conv.id);
  vi.clearAllMocks();
}

describe("handleWebhook", () => {
  it("accepts a correctly signed event, posts the system message and emits chat:call:end", async () => {
    await seedLiveRoom();
    const body = endedPayload();

    const events = await captureCallEvents(async () => {
      const res = await tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body));
      expect(res.ok).toBe(true);
    });

    expect(chatService.postSystemMessage).toHaveBeenCalledWith(
      executor,
      conv.id,
      "Llamada de voz · 04:12 · 2 participantes",
      {
        kind: "call",
        callId: "room-1",
        outcome: "completed",
        durationSec: 252,
        // DISPLAY NAMES only.
        participants: ["Alicia Ruiz", "Roberto Paz"],
      },
    );
    expect(events.map((e) => e.event)).toEqual(["end"]);
  });

  it("writes 'Llamada perdida' for room.missed", async () => {
    await seedLiveRoom();
    const body = endedPayload({
      event: "room.missed",
      room: room({ state: "ended", endReason: "missed" }),
      data: { reason: "missed", durationSec: 0, participants: [] },
    });

    await tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body));

    expect(chatService.postSystemMessage).toHaveBeenCalledWith(
      executor,
      conv.id,
      "Llamada perdida",
      expect.objectContaining({ outcome: "missed", durationSec: 0, participants: [] }),
    );
  });

  it("rejects a bad signature", async () => {
    const body = endedPayload();
    await expect(
      tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body, "wrong-secret")),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(chatService.postSystemMessage).not.toHaveBeenCalled();
  });

  it("rejects a replay outside the 5-minute skew window", async () => {
    const body = endedPayload();
    const stale = Math.floor(Date.now() / 1000) - 600;
    await expect(
      tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body, WEBHOOK_SECRET, stale)),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a tampered body even with a signature of the right shape", async () => {
    const body = endedPayload();
    const headers = signedHeaders(body);
    const tampered = endedPayload({ eventId: "evt-2" });
    await expect(tolqiaBridge.handleWebhook(Buffer.from(tampered), headers)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("dedupes a retry carrying the same eventId", async () => {
    await seedLiveRoom();
    const body = endedPayload();
    const headers = signedHeaders(body);

    await tolqiaBridge.handleWebhook(Buffer.from(body), headers);
    const second = await tolqiaBridge.handleWebhook(Buffer.from(body), headers);

    expect(second).toEqual({ ok: true, deduped: true });
    expect(chatService.postSystemMessage).toHaveBeenCalledTimes(1);
  });

  it("still broadcasts (without persisting) when the registry lost the room", async () => {
    const body = endedPayload();

    const events = await captureCallEvents(async () => {
      await tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body));
    });

    expect(chatService.postSystemMessage).not.toHaveBeenCalled();
    expect(events.map((e) => e.event)).toEqual(["end"]);
    expect(events[0]!.call.convId).toBe(conv.id); // recovered from externalId
  });

  it("relays a mid-call participant event as chat:call:state", async () => {
    await seedLiveRoom();
    const body = JSON.stringify({
      eventId: "evt-join",
      event: "participant.joined",
      at: Date.now(),
      room: room({ state: "active" }),
      externalId: buildExternalId("t1", conv.id),
      data: { participant: { id: "bob" } },
    });

    const events = await captureCallEvents(async () => {
      await tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body));
    });

    expect(events.map((e) => e.event)).toEqual(["state"]);
    expect(chatService.postSystemMessage).not.toHaveBeenCalled();
  });
});

describe("getActiveCall", () => {
  it("caches the answer for a couple of seconds", async () => {
    await seedLiveRoom();
    responses = [{ status: 200, body: { room: room({ state: "active" }) } }];

    const first = await tolqiaBridge.getActiveCall(executor, "alice", conv.id);
    const second = await tolqiaBridge.getActiveCall(executor, "alice", conv.id);

    expect(first?.id).toBe("room-1");
    expect(second).toBe(first);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1); // the second read hit the cache
  });

  it("reports no call once Tolqia says the room ended", async () => {
    await seedLiveRoom();
    responses = [{ status: 200, body: { room: room({ state: "ended" }) } }];

    expect(await tolqiaBridge.getActiveCall(executor, "alice", conv.id)).toBeNull();
  });
});

// ── Transcripts ─────────────────────────────────────────────────────────────

/** Two utterances in two languages, each translated into the other. */
function transcriptFixture() {
  return [
    {
      seq: 0,
      participantId: "alice",
      displayName: "Alicia",
      lang: "es",
      text: "Hola, ¿me escuchas?",
      translations: { en: "Hi, can you hear me?" },
      startMs: 0,
      endMs: 1_800,
    },
    {
      seq: 1,
      participantId: "bob",
      displayName: "Bob",
      lang: "en",
      text: "Yes, loud and clear.",
      translations: { es: "Sí, alto y claro." },
      startMs: 2_000,
      endMs: 3_400,
    },
  ];
}

describe("normalizeTranscript / capTranscript", () => {
  it("drops half-made segments instead of persisting them", () => {
    const out = normalizeTranscript([
      { participantId: "alice", text: "hola" },
      { participantId: "", text: "sin hablante" },
      { participantId: "bob", text: "   " },
      "nonsense",
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ participantId: "alice", lang: "und", translations: {} });
  });

  it("keeps only string translations under a well-formed language tag", () => {
    const [seg] = normalizeTranscript([
      { participantId: "a", text: "x", translations: { EN: "hi", "not a tag": "y", fr: 3 } },
    ]);
    expect(seg!.translations).toEqual({ en: "hi" });
  });

  it("caps by segment count and keeps the START of the call", () => {
    const many = Array.from({ length: TRANSCRIPT_MAX_SEGMENTS + 50 }, (_, i) => ({
      seq: i,
      participantId: "alice",
      displayName: "Alicia",
      lang: "es",
      text: `linea ${i}`,
      translations: {},
      startMs: i,
      endMs: i + 1,
    }));
    const capped = capTranscript(many);
    expect(capped.truncated).toBe(true);
    expect(capped.segments.length).toBeLessThanOrEqual(TRANSCRIPT_MAX_SEGMENTS);
    // The cap keeps the BEGINNING: a transcript starting mid-conversation is useless.
    expect(capped.segments[0]!.text).toBe("linea 0");
  });

  it("caps by BYTES when a few utterances are huge, and stays under the budget", () => {
    const fat = Array.from({ length: 200 }, (_, i) => ({
      seq: i,
      participantId: "alice",
      displayName: "Alicia",
      lang: "es",
      text: "x".repeat(3_000),
      translations: { en: "y".repeat(3_000) },
      startMs: i,
      endMs: i + 1,
    }));
    const capped = capTranscript(normalizeTranscript(fat));
    expect(capped.truncated).toBe(true);
    expect(capped.segments.length).toBeLessThan(200);
    expect(Buffer.byteLength(JSON.stringify(capped.segments), "utf8")).toBeLessThanOrEqual(200 * 1024);
  });
});

describe("webhook transcript", () => {
  it("persists the transcript that rides the webhook, with display names", async () => {
    await seedLiveRoom();
    const body = endedPayload({
      data: {
        reason: "completed",
        durationSec: 252,
        participants: [
          { id: "alice", displayName: "Alicia Ruiz", joinedSec: 250 },
          { id: "bob", displayName: "Roberto Paz", joinedSec: 240 },
        ],
        transcript: transcriptFixture(),
        transcriptTruncated: false,
      },
    });

    await tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body));

    const system = vi.mocked(chatService.postSystemMessage).mock.calls[0]![3] as Record<string, unknown>;
    expect(system.transcriptSegments).toBe(2);
    expect(system.transcriptTruncated).toBe(false);
    const segments = system.transcript as Array<Record<string, unknown>>;
    expect(segments.map((x) => x.text)).toEqual(["Hola, ¿me escuchas?", "Yes, loud and clear."]);
    expect(segments[1]!.translations).toEqual({ es: "Sí, alto y claro." });
    // No extra upstream round-trip: the payload already carried it.
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("falls back to GET /v1/calls/rooms/:id/transcript when the payload has none", async () => {
    await seedLiveRoom();
    responses = [{ status: 200, body: { roomId: "room-1", transcript: transcriptFixture(), truncated: true } }];
    const body = endedPayload();

    await tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body));

    expect(requests.map((r) => String(r.url)).join(" ")).toContain("/v1/calls/rooms/room-1/transcript");
    const system = vi.mocked(chatService.postSystemMessage).mock.calls[0]![3] as Record<string, unknown>;
    expect(system.transcriptSegments).toBe(2);
    expect(system.transcriptTruncated).toBe(true);
  });

  it("still posts the chip when the transcript endpoint is down (fail-open)", async () => {
    await seedLiveRoom();
    responses = [{ status: 500, body: { error: "boom" } }];
    const body = endedPayload();

    await tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body));

    const system = vi.mocked(chatService.postSystemMessage).mock.calls[0]![3] as Record<string, unknown>;
    expect(system.transcript).toBeUndefined();
    expect(system.outcome).toBe("completed");
  });

  it("does not chase a transcript for a missed call", async () => {
    await seedLiveRoom();
    const body = endedPayload({
      event: "room.missed",
      room: room({ state: "ended", endReason: "missed" }),
      data: { reason: "missed", durationSec: 0, participants: [] },
    });

    await tolqiaBridge.handleWebhook(Buffer.from(body), signedHeaders(body));

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe("getCallTranscript", () => {
  it("re-resolves display names from the LIVE directory and lists the speakers", async () => {
    vi.mocked(messagesRepository.get).mockResolvedValue({
      id: "m1",
      convId: conv.id,
      from: "_system",
      body: "Llamada de voz",
      attachments: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      system: {
        kind: "call",
        callId: "room-1",
        outcome: "completed",
        durationSec: 252,
        participants: ["Alicia Ruiz", "Roberto Paz"],
        // A STALE name persisted at call time — the directory must win.
        transcript: transcriptFixture(),
        transcriptSegments: 2,
      },
    } as never);

    const out = await tolqiaBridge.getCallTranscript(executor, "alice", conv.id, "m1");

    expect(out.segments.map((x) => x.displayName)).toEqual(["Alicia Ruiz", "Roberto Paz"]);
    expect(out.participants).toEqual([
      { username: "alice", displayName: "Alicia Ruiz", lang: "es" },
      { username: "bob", displayName: "Roberto Paz", lang: "en" },
    ]);
    expect(out.truncated).toBe(false);
  });

  it("rescues an empty persisted transcript from the 24-hour endpoint", async () => {
    vi.mocked(messagesRepository.get).mockResolvedValue({
      id: "m1",
      convId: conv.id,
      from: "_system",
      body: "Llamada de voz",
      attachments: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      system: { kind: "call", callId: "room-1", outcome: "completed", durationSec: 252, participants: [] },
    } as never);
    responses = [{ status: 200, body: { transcript: transcriptFixture(), truncated: false } }];

    const out = await tolqiaBridge.getCallTranscript(executor, "alice", conv.id, "m1");

    expect(out.segments).toHaveLength(2);
    expect(requests.map((r) => String(r.url)).join(" ")).toContain("/transcript");
  });

  it("404s for a message that is not a finished call", async () => {
    vi.mocked(messagesRepository.get).mockResolvedValue(null as never);
    await expect(
      tolqiaBridge.getCallTranscript(executor, "alice", conv.id, "nope"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── El enlace con tolqia.com (token de API por servidor) ────────────────────

describe("cuenta de Tolqia (token de API del servidor)", () => {
  const TOKEN = `tq_live_${"a".repeat(40)}`;

  it("sin token usa el secreto S2S y manda las credenciales del panel", async () => {
    responses = [
      { status: 201, body: { room: room() } },
      { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/ws" } },
    ];
    await tolqiaBridge.startCall(executor, "alice", conv.id);

    const create = JSON.parse(String(requests[0]!.init.body));
    expect(String(requests[0]!.init.headers?.["authorization" as never])).toBe(`Bearer ${SERVICE_SECRET}`);
    expect(create.credentials).toEqual({ openai: { apiKey: "sk-panel" } });
    // El panel paga ⇒ las claves de la sala son suyas.
    expect(create.translation.credentialsPolicy).toBe("host");
  });

  it("con token lo usa como Bearer y NO manda credenciales (paga el dueño)", async () => {
    vi.mocked(tolqiaCredentialRepository.token).mockResolvedValue(TOKEN);
    responses = [
      { status: 201, body: { room: room() } },
      { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/ws" } },
    ];
    const session = await tolqiaBridge.startCall(executor, "alice", conv.id);

    const create = JSON.parse(String(requests[0]!.init.body));
    expect(String(requests[0]!.init.headers?.["authorization" as never])).toBe(`Bearer ${TOKEN}`);
    expect(create.credentials).toBeUndefined();
    expect(create.translation.credentialsPolicy).toBeUndefined();
    // El token tampoco puede filtrarse por la respuesta.
    expect(JSON.stringify(session)).not.toContain(TOKEN);
    // Y el token de participante se pide con el MISMO bearer.
    expect(String(requests[1]!.init.headers?.["authorization" as never])).toBe(`Bearer ${TOKEN}`);
  });

  it("propaga el motivo cuando el plan no permite traducción", async () => {
    vi.mocked(tolqiaCredentialRepository.token).mockResolvedValue(TOKEN);
    responses = [
      {
        status: 201,
        body: {
          room: room({ translation: { enabled: false, provider: "mock", mode: "cascade" } }),
          reason: "PLAN_LIMIT_TRANSLATION",
        },
      },
      { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/ws" } },
    ];
    const session = await tolqiaBridge.startCall(executor, "alice", conv.id);
    expect(session.call.translation).toMatchObject({
      enabled: false,
      reason: "PLAN_LIMIT_TRANSLATION",
    });
  });

  it("nunca marca un motivo sobre una sala que SÍ traduce", async () => {
    responses = [
      {
        status: 201,
        body: {
          room: room({ translation: { enabled: true, provider: "elevenlabs", mode: "cascade", reason: "PLAN_LIMIT_TRANSLATION" } }),
        },
      },
      { status: 200, body: { token: "jwt", expiresAt: 1, wsUrl: "/tolqia/ws" } },
    ];
    const session = await tolqiaBridge.startCall(executor, "alice", conv.id);
    expect(session.call.translation.enabled).toBe(true);
    expect(session.call.translation.reason).toBeUndefined();
  });

  it.each([
    [401, "TOLQIA_TOKEN_INVALID"],
    [402, "TOLQIA_PLAN_INACTIVE"],
    [403, "TOLQIA_PLAN_REQUIRED"],
  ])("mapea el %i de Tolqia a %s (no a un 503 'reintenta')", async (status, code) => {
    vi.mocked(tolqiaCredentialRepository.token).mockResolvedValue(TOKEN);
    responses = [{ status, body: { ok: false, error: code } }];
    await expect(tolqiaBridge.startCall(executor, "alice", conv.id)).rejects.toMatchObject({
      statusCode: status,
      code,
    });
  });

  it("un 500 de Tolqia sigue siendo un 503 genérico", async () => {
    responses = [{ status: 500, body: { error: "boom" } }];
    await expect(tolqiaBridge.startCall(executor, "alice", conv.id)).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
