// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — the pure half of the call layer (bloque F).
 *
 * Everything here runs on data that arrives from the network (an SSE frame, a
 * persisted `message.system`, a stored preferences blob), so the property worth
 * pinning down in each case is the same one: a malformed or stale payload
 * degrades to a sane default instead of crashing the thread.
 */
import { describe, expect, it } from "vitest";
import {
  asCallSystem,
  formatCallDuration,
  formatOffset,
  isCallLive,
  joinedParticipants,
  normalizeTranscriptSegments,
  parseChatCallEvent,
  pickTranslation,
  transcriptSegmentCount,
  type ChatCallView,
} from "@/lib/chat-call";
import { langBadge, shouldRing } from "./call-prefs";
import { DEFAULT_CHAT_PREFS } from "../chat-prefs";

function view(overrides: Partial<ChatCallView> = {}): ChatCallView {
  return {
    id: "room-1",
    convId: "dm_a__b",
    kind: "dm",
    state: "active",
    createdAt: 1,
    participants: [
      { id: "alice", displayName: "Alicia", lang: "es", translate: false, role: "host", state: "joined", muted: false, speaking: false },
      { id: "bob", displayName: "Roberto", lang: "en", translate: true, role: "member", state: "ringing", muted: false, speaking: false },
    ],
    translation: { enabled: true, provider: "elevenlabs", mode: "cascade" },
    startedBy: "alice",
    ...overrides,
  };
}

describe("formatCallDuration", () => {
  it("pads mm:ss and grows to h:mm:ss (mirrors the backend)", () => {
    expect(formatCallDuration(0)).toBe("00:00");
    expect(formatCallDuration(252)).toBe("04:12");
    expect(formatCallDuration(3_661)).toBe("1:01:01");
  });

  it("never renders a negative or fractional duration", () => {
    expect(formatCallDuration(-5)).toBe("00:00");
    expect(formatCallDuration(9.7)).toBe("00:09");
  });
});

describe("isCallLive / joinedParticipants", () => {
  it("counts only people actually in the room, not the ones still ringing", () => {
    expect(joinedParticipants(view())).toHaveLength(1);
  });

  it("an ended call is not live", () => {
    expect(isCallLive(view({ state: "ended" }))).toBe(false);
    expect(isCallLive(null)).toBe(false);
    expect(isCallLive(view())).toBe(true);
  });
});

describe("parseChatCallEvent", () => {
  it("parses a well-formed frame", () => {
    const parsed = parseChatCallEvent(
      JSON.stringify({ targetId: "t1", participants: ["alice"], event: "ring", call: view() }),
    );
    expect(parsed?.event).toBe("ring");
    expect(parsed?.call.id).toBe("room-1");
  });

  it("falls back to 'state' for an event name it does not know", () => {
    const parsed = parseChatCallEvent(JSON.stringify({ event: "sneeze", call: view() }));
    expect(parsed?.event).toBe("state");
  });

  it("returns null on malformed JSON or a frame without a call", () => {
    expect(parseChatCallEvent("{oops")).toBeNull();
    expect(parseChatCallEvent(JSON.stringify({ event: "ring" }))).toBeNull();
    expect(parseChatCallEvent(JSON.stringify({ call: { id: "x" } }))).toBeNull();
  });
});

describe("asCallSystem", () => {
  it("narrows a persisted call payload", () => {
    expect(
      asCallSystem({ kind: "call", callId: "r1", outcome: "missed", durationSec: 0, participants: ["Alicia"] }),
    ).toEqual({ kind: "call", callId: "r1", outcome: "missed", durationSec: 0, participants: ["Alicia"] });
  });

  it("ignores anything that is not a call payload", () => {
    expect(asCallSystem(null)).toBeNull();
    expect(asCallSystem({ kind: "poll" })).toBeNull();
    expect(asCallSystem("call")).toBeNull();
  });

  it("repairs a corrupt row instead of propagating it into the chip", () => {
    const out = asCallSystem({ kind: "call", outcome: "exploded", durationSec: "NaN", participants: [1, "Ana"] });
    expect(out).toEqual({
      kind: "call",
      callId: "",
      outcome: "completed",
      durationSec: 0,
      participants: ["Ana"],
    });
  });
});

describe("call preferences projection", () => {
  it("rings by default and stays silent under DND or a muted ringtone", () => {
    const base = DEFAULT_CHAT_PREFS.calls;
    expect(shouldRing(base)).toBe(true);
    expect(shouldRing({ ...base, dnd: true })).toBe(false);
    expect(shouldRing({ ...base, ringtone: "off" })).toBe(false);
  });

  it("shows the base language in the badge, never the region", () => {
    expect(langBadge("pt-BR")).toBe("PT");
    expect(langBadge("es")).toBe("ES");
    expect(langBadge(null)).toBe("");
  });
});

// ── Transcript ──────────────────────────────────────────────────────────────

describe("normalizeTranscriptSegments", () => {
  it("drops segments with no speaker or no text and sorts by seq", () => {
    const out = normalizeTranscriptSegments([
      { seq: 2, participantId: "bob", text: "second" },
      { seq: 1, participantId: "alice", text: "first" },
      { seq: 3, participantId: "", text: "no speaker" },
      { seq: 4, participantId: "carol", text: "   " },
      "garbage",
    ]);
    expect(out.map((s) => s.text)).toEqual(["first", "second"]);
  });

  it("falls back to the login only because a name is required, and lowercases tags", () => {
    const [seg] = normalizeTranscriptSegments([
      { seq: 0, participantId: "alice", text: "hola", lang: "ES", translations: { EN: "hi", de: 7 } },
    ]);
    expect(seg!.displayName).toBe("alice");
    expect(seg!.lang).toBe("es");
    expect(seg!.translations).toEqual({ en: "hi" });
  });

  it("never crashes on a non-array payload", () => {
    expect(normalizeTranscriptSegments(null)).toEqual([]);
    expect(normalizeTranscriptSegments({ nope: true })).toEqual([]);
  });
});

describe("pickTranslation", () => {
  const seg = normalizeTranscriptSegments([
    { seq: 0, participantId: "alice", text: "hola", lang: "es", translations: { en: "hi", fr: "salut" } },
  ])[0]!;

  it("prefers the reader's language, region-insensitively", () => {
    expect(pickTranslation(seg, "en-GB")).toEqual({ lang: "en", text: "hi" });
  });

  it("falls back to the first available translation", () => {
    expect(pickTranslation(seg, "ja")?.text).toBeTruthy();
  });

  it("never offers a 'translation' into the language actually spoken", () => {
    const spanish = normalizeTranscriptSegments([
      { seq: 0, participantId: "alice", text: "hola", lang: "es", translations: { es: "hola" } },
    ])[0]!;
    expect(pickTranslation(spanish, "es")).toBeNull();
  });

  it("returns null when nothing was translated", () => {
    const bare = normalizeTranscriptSegments([{ seq: 0, participantId: "a", text: "x", lang: "es" }])[0]!;
    expect(pickTranslation(bare, "en")).toBeNull();
  });
});

describe("transcriptSegmentCount", () => {
  it("uses the counter the backend sends after stripping the body", () => {
    const system = asCallSystem({
      kind: "call",
      callId: "r1",
      outcome: "completed",
      durationSec: 10,
      participants: ["Alicia"],
      transcriptSegments: 42,
    });
    expect(transcriptSegmentCount(system)).toBe(42);
  });

  it("falls back to the inline transcript of an un-stripped payload", () => {
    const system = asCallSystem({
      kind: "call",
      callId: "r1",
      outcome: "completed",
      durationSec: 10,
      participants: [],
      transcript: [{ seq: 0, participantId: "alice", text: "hola" }],
    });
    expect(transcriptSegmentCount(system)).toBe(1);
  });

  it("is zero for a call with no transcript at all", () => {
    expect(transcriptSegmentCount(asCallSystem({ kind: "call", outcome: "missed" }))).toBe(0);
    expect(transcriptSegmentCount(null)).toBe(0);
  });
});

describe("formatOffset", () => {
  it("renders a millisecond offset as mm:ss from the start of the call", () => {
    expect(formatOffset(0)).toBe("00:00");
    expect(formatOffset(65_400)).toBe("01:05");
    expect(formatOffset(-10)).toBe("00:00");
  });
});
