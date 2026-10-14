// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it } from "vitest";
import {
  CHAT_PREFS_STORAGE_KEY,
  DEFAULT_CHAT_PREFS,
  chatPrefs,
  mergeChatPrefs,
  normalizeChatPrefs,
} from "./chat-prefs";

describe("normalizeChatPrefs", () => {
  it("returns the defaults for junk", () => {
    expect(normalizeChatPrefs(null)).toEqual(DEFAULT_CHAT_PREFS);
    expect(normalizeChatPrefs("nope")).toEqual(DEFAULT_CHAT_PREFS);
    expect(normalizeChatPrefs({ general: 3 })).toEqual(DEFAULT_CHAT_PREFS);
  });
  it("validates each field independently", () => {
    const out = normalizeChatPrefs({
      general: { enterSends: false, soundOnNewMessage: "yes" },
      appearance: { density: "nope", fontSize: "lg" },
      groups: { latestPageSize: 7, collapsedByDefault: false },
      calls: { provider: "elevenlabs", language: "EN", ringtone: "off" },
    });
    expect(out.general.enterSends).toBe(false);
    expect(out.general.soundOnNewMessage).toBe(true); // invalid → default
    expect(out.appearance.density).toBe("comfortable");
    expect(out.appearance.fontSize).toBe("lg");
    expect(out.groups.latestPageSize).toBe(5); // 7 is not 5|10|15
    expect(out.groups.collapsedByDefault).toBe(false);
    expect(out.calls.provider).toBe("elevenlabs");
    expect(out.calls.language).toBe("es"); // "EN" is not lowercase ISO-639-1
    expect(out.calls.ringtone).toBe("off");
  });
  it("accepts the allowed page sizes", () => {
    for (const n of [5, 10, 15] as const) {
      expect(normalizeChatPrefs({ groups: { latestPageSize: n } }).groups.latestPageSize).toBe(n);
    }
  });
});

describe("mergeChatPrefs", () => {
  it("merges a section patch without dropping siblings", () => {
    const out = mergeChatPrefs(DEFAULT_CHAT_PREFS, { appearance: { fontSize: "sm" } });
    expect(out.appearance).toEqual({ density: "comfortable", fontSize: "sm" });
    expect(out.general).toEqual(DEFAULT_CHAT_PREFS.general);
  });
});

describe("chatPrefs store", () => {
  beforeEach(() => {
    window.localStorage.removeItem(CHAT_PREFS_STORAGE_KEY);
  });
  it("defaults when empty and persists a set()", () => {
    expect(chatPrefs.get()).toEqual(DEFAULT_CHAT_PREFS);
    chatPrefs.set({ general: { enterSends: false } });
    expect(chatPrefs.get().general.enterSends).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(CHAT_PREFS_STORAGE_KEY) || "{}").general.enterSends).toBe(false);
  });
  it("notifies subscribers", () => {
    let hits = 0;
    const off = chatPrefs.subscribe(() => { hits += 1; });
    chatPrefs.set({ groups: { latestPageSize: 10 } });
    off();
    chatPrefs.set({ groups: { latestPageSize: 15 } });
    expect(hits).toBe(1);
    expect(chatPrefs.get().groups.latestPageSize).toBe(15);
  });
  it("survives corrupt storage", () => {
    window.localStorage.setItem(CHAT_PREFS_STORAGE_KEY, "{not json");
    expect(chatPrefs.get()).toEqual(DEFAULT_CHAT_PREFS);
  });
});
