// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_HISTORY_CACHE_LIMIT,
  chatHistoryCacheKey,
  clearAllChatHistoryCache,
  loadChatHistoryCache,
  saveChatHistoryCache,
} from "./chat-history-cache";
import type { ChatTurn } from "./chat-engine";

/** Build a deterministic ChatTurn stub — minimum shape the loader validates. */
function makeTurn(i: number, role: "user" | "assistant" = i % 2 === 0 ? "user" : "assistant"): ChatTurn {
  return {
    role,
    text: `turn-${i}`,
    tools: [],
  };
}

describe("chat-history-cache", () => {
  beforeEach(() => {
    // Start every test from a clean slate so keys from a previous run don't leak.
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("chatHistoryCacheKey", () => {
    it("returns the prefixed key for a valid session id", () => {
      expect(chatHistoryCacheKey("conv-123")).toBe("lxp:assistant:chat:conv-123");
    });
    it("returns null for null/undefined/empty", () => {
      expect(chatHistoryCacheKey(null)).toBeNull();
      expect(chatHistoryCacheKey(undefined)).toBeNull();
      expect(chatHistoryCacheKey("")).toBeNull();
    });
  });

  describe("saveChatHistoryCache", () => {
    it("writes the last ≤ CHAT_HISTORY_CACHE_LIMIT turns to localStorage under the prefixed key", () => {
      const turns: ChatTurn[] = Array.from({ length: CHAT_HISTORY_CACHE_LIMIT + 10 }, (_, i) => makeTurn(i));
      const setSpy = vi.spyOn(Storage.prototype, "setItem");

      saveChatHistoryCache("conv-A", turns);

      expect(setSpy).toHaveBeenCalledTimes(1);
      const [key, raw] = setSpy.mock.calls[0]!;
      expect(key).toBe("lxp:assistant:chat:conv-A");
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      // Cap = 50, so the 10 oldest turns are dropped, leaving exactly 50.
      expect(parsed.length).toBe(CHAT_HISTORY_CACHE_LIMIT);
      // The slice keeps the tail (most recent), so the first surviving turn
      // is the one at index 10 (turn-10) and the last is turn-59.
      expect(parsed[0].text).toBe("turn-10");
      expect(parsed[parsed.length - 1].text).toBe(`turn-${CHAT_HISTORY_CACHE_LIMIT + 10 - 1}`);
    });

    it("writes all turns when fewer than the cap", () => {
      const turns: ChatTurn[] = [makeTurn(1), makeTurn(2), makeTurn(3)];
      saveChatHistoryCache("conv-small", turns);

      const raw = window.localStorage.getItem("lxp:assistant:chat:conv-small");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(3);
      expect(parsed.map((t: ChatTurn) => t.text)).toEqual(["turn-1", "turn-2", "turn-3"]);
    });

    it("is a no-op for null/undefined session id", () => {
      const setSpy = vi.spyOn(Storage.prototype, "setItem");
      saveChatHistoryCache(null, [makeTurn(1)]);
      saveChatHistoryCache(undefined, [makeTurn(1)]);
      saveChatHistoryCache("", [makeTurn(1)]);
      expect(setSpy).not.toHaveBeenCalled();
    });

    it("is a no-op for an empty turn array", () => {
      const setSpy = vi.spyOn(Storage.prototype, "setItem");
      saveChatHistoryCache("conv-empty", []);
      expect(setSpy).not.toHaveBeenCalled();
    });

    it("silently swallows quota exceeded errors (no throw)", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });
      expect(() => saveChatHistoryCache("conv-quota", [makeTurn(1)])).not.toThrow();
    });
  });

  describe("loadChatHistoryCache", () => {
    it("hydrates with stored turns on remount", () => {
      const turns = [makeTurn(1, "user"), makeTurn(2, "assistant"), makeTurn(3, "user")];
      window.localStorage.setItem("lxp:assistant:chat:conv-hydrate", JSON.stringify(turns));

      const loaded = loadChatHistoryCache("conv-hydrate");

      expect(loaded).not.toBeNull();
      expect(loaded).toHaveLength(3);
      expect(loaded![0]!.text).toBe("turn-1");
      expect(loaded![1]!.text).toBe("turn-2");
      expect(loaded![2]!.text).toBe("turn-3");
    });

    it("returns null when nothing is cached", () => {
      expect(loadChatHistoryCache("conv-missing")).toBeNull();
    });

    it("returns null for invalid session id", () => {
      expect(loadChatHistoryCache(null)).toBeNull();
      expect(loadChatHistoryCache(undefined)).toBeNull();
      expect(loadChatHistoryCache("")).toBeNull();
    });

    it("returns null when the cached JSON is malformed", () => {
      window.localStorage.setItem("lxp:assistant:chat:conv-bad", "{not-json");
      expect(loadChatHistoryCache("conv-bad")).toBeNull();
    });

    it("returns null when the cached payload is the wrong shape (not an array)", () => {
      window.localStorage.setItem("lxp:assistant:chat:conv-shape", JSON.stringify({ turns: [] }));
      expect(loadChatHistoryCache("conv-shape")).toBeNull();
    });

    it("filters out entries that don't match the ChatTurn shape", () => {
      const dirty = [
        makeTurn(1, "user"),
        { role: "system", text: "intruder" }, // wrong role
        { role: "user", text: 12345 },         // wrong text type
        makeTurn(2, "assistant"),
        null,                                  // not an object
      ];
      window.localStorage.setItem("lxp:assistant:chat:conv-dirty", JSON.stringify(dirty));

      const loaded = loadChatHistoryCache("conv-dirty");

      // Only the two well-formed turns survive the filter.
      expect(loaded).toHaveLength(2);
      expect(loaded![0]!.text).toBe("turn-1");
      expect(loaded![1]!.text).toBe("turn-2");
    });

    it("returns null when every entry is filtered out", () => {
      window.localStorage.setItem(
        "lxp:assistant:chat:conv-allbad",
        JSON.stringify([{ role: "system", text: "x" }, null]),
      );
      expect(loadChatHistoryCache("conv-allbad")).toBeNull();
    });

    it("survives a localStorage.getItem throw (private mode etc.)", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(() => loadChatHistoryCache("conv-err")).not.toThrow();
      expect(loadChatHistoryCache("conv-err")).toBeNull();
    });
  });

  describe("round-trip after remount", () => {
    it("saves 60 turns, mounts again, loads the last 50", () => {
      const sessionId = "conv-roundtrip";
      const turns: ChatTurn[] = Array.from({ length: 60 }, (_, i) => makeTurn(i));

      // Simulate first mount: 60 turns exist in memory, we persist the tail.
      saveChatHistoryCache(sessionId, turns);

      // Simulate remount (or page reload): the in-memory chatEngine is empty,
      // but localStorage still has the cache.
      const hydrated = loadChatHistoryCache(sessionId);

      expect(hydrated).not.toBeNull();
      expect(hydrated).toHaveLength(CHAT_HISTORY_CACHE_LIMIT);
      // Tail semantics: the first loaded turn is the 11th (index 10) of the
      // original 60 and the last is the 60th.
      expect(hydrated![0]!.text).toBe("turn-10");
      expect(hydrated![hydrated!.length - 1]!.text).toBe("turn-59");
    });
  });

  describe("clearAllChatHistoryCache", () => {
    it("removes every cache entry but leaves unrelated keys alone", () => {
      window.localStorage.setItem("lxp:assistant:chat:a", "[]");
      window.localStorage.setItem("lxp:assistant:chat:b", "[]");
      window.localStorage.setItem("lxp.assistant.uiPrefs", "{}");

      clearAllChatHistoryCache();

      expect(window.localStorage.getItem("lxp:assistant:chat:a")).toBeNull();
      expect(window.localStorage.getItem("lxp:assistant:chat:b")).toBeNull();
      // Unrelated keys are NOT touched (we share the localStorage namespace).
      expect(window.localStorage.getItem("lxp.assistant.uiPrefs")).toBe("{}");
    });
  });
});