// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Round-trip coverage for the assistant config sidecar: every field the
 * Settings modal can change must survive a save→load (and a reconnect, which
 * is just a fresh load resolving the same per-user/shared namespace). Regression
 * guard for the "general-settings selects don't persist" class of bug — the
 * default-tab selects were only kept in browser localStorage before, so they
 * reverted on reconnect.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Controllable context user id (drives the per-user vs shared namespace).
const ctx = vi.hoisted(() => ({ uid: null as number | null }));
vi.mock("../../../shared/executor/context.js", () => ({
  getContextUserId: () => ctx.uid,
}));

// In-memory kv double keyed by `${module}/${collection}` → id → doc. Mirrors
// the real kv() surface the repository touches (get/set), mocked BEFORE import.
const stores = vi.hoisted(() => new Map<string, Map<string, Record<string, unknown>>>());
vi.mock("../../../shared/kv-store/index.js", () => ({
  kv: (_executor: unknown) => ({
    module: (mod: string) => ({
      collection: <T,>(col: string) => {
        const key = `${mod}/${col}`;
        if (!stores.has(key)) stores.set(key, new Map());
        const map = stores.get(key)!;
        return {
          async get(id: string) {
            return (map.get(String(id)) as T | undefined) ?? null;
          },
          async set(id: string, value: T) {
            const doc = { ...(value as Record<string, unknown>), id };
            map.set(String(id), doc);
            return doc;
          },
        };
      },
    }),
  }),
}));

import { assistantConfigRepository } from "./assistant-config.repository.js";
import { defaultAssistantConfig, redactAssistantConfig } from "../models/assistant-config.types.js";

beforeEach(() => {
  stores.clear();
  ctx.uid = null;
});

describe("assistantConfigRepository — full modal round-trip", () => {
  it("persists every general-settings field and reads it back (per-user)", async () => {
    ctx.uid = 1;
    await assistantConfigRepository.patch({
      activeProvider: "minimax",
      uiMode: "advanced",
      voice: {
        enabled: true,
        sttEngine: "auto",
        ttsEngine: "auto",
        ttsProvider: "cli",
        autoSpeak: true,
        voice: "nova",
      },
      approval: { mode: "auto", autoApproveTools: ["files.read"] },
      autoRouting: { enabled: false, maxTier: "high" },
      translation: {
        enabled: false,
        engine: "deepl",
        targetLanguage: "fr",
        aiFollowActive: false,
        deepl: { apiKey: "dk" },
      } as never,
      defaultAgentsTab: "projects",
      defaultConversationsTab: "agents",
    });

    const loaded = await assistantConfigRepository.load();
    expect(loaded.activeProvider).toBe("minimax");
    expect(loaded.uiMode).toBe("advanced");
    expect(loaded.voice.ttsProvider).toBe("cli");
    expect(loaded.voice.voice).toBe("nova");
    expect(loaded.voice.autoSpeak).toBe(true);
    expect(loaded.approval.mode).toBe("auto");
    expect(loaded.approval.autoApproveTools).toEqual(["files.read"]);
    expect(loaded.autoRouting).toEqual({ enabled: false, maxTier: "high" });
    expect(loaded.translation.engine).toBe("deepl");
    expect(loaded.translation.targetLanguage).toBe("fr");
    // The two selects that used to only live in localStorage:
    expect(loaded.defaultAgentsTab).toBe("projects");
    expect(loaded.defaultConversationsTab).toBe("agents");
  });

  it("default-tab selects survive a reconnect (fresh load, same user)", async () => {
    ctx.uid = 7;
    await assistantConfigRepository.patch({ defaultAgentsTab: "projects" });
    await assistantConfigRepository.patch({ defaultConversationsTab: "agents" });

    // Simulate reconnect: a brand-new load resolving the same per-user doc.
    const reloaded = await assistantConfigRepository.load();
    expect(reloaded.defaultAgentsTab).toBe("projects");
    expect(reloaded.defaultConversationsTab).toBe("agents");
  });

  it("a partial patch never wipes previously-saved default-tab values", async () => {
    ctx.uid = 3;
    await assistantConfigRepository.patch({ defaultAgentsTab: "projects", defaultConversationsTab: "agents" });
    // An unrelated later save (e.g. changing the active provider) must keep them.
    await assistantConfigRepository.patch({ activeProvider: "gemini" });
    const loaded = await assistantConfigRepository.load();
    expect(loaded.activeProvider).toBe("gemini");
    expect(loaded.defaultAgentsTab).toBe("projects");
    expect(loaded.defaultConversationsTab).toBe("agents");
  });

  it("falls back to historical defaults when unset", async () => {
    ctx.uid = 9;
    const loaded = await assistantConfigRepository.load();
    expect(loaded.defaultAgentsTab).toBe("leaders");
    expect(loaded.defaultConversationsTab).toBe("loose");
  });

  it("keeps default-tab prefs isolated per user", async () => {
    ctx.uid = 1;
    await assistantConfigRepository.patch({ defaultAgentsTab: "projects" });
    ctx.uid = 2;
    const other = await assistantConfigRepository.load();
    // User 2 has no own doc and no shared doc → historical default.
    expect(other.defaultAgentsTab).toBe("leaders");
    ctx.uid = 1;
    const mine = await assistantConfigRepository.load();
    expect(mine.defaultAgentsTab).toBe("projects");
  });

  it("redactAssistantConfig exposes the default-tab selects to the UI", () => {
    const cfg = { ...defaultAssistantConfig(), defaultAgentsTab: "projects" as const, defaultConversationsTab: "agents" as const };
    const red = redactAssistantConfig(cfg);
    expect(red.defaultAgentsTab).toBe("projects");
    expect(red.defaultConversationsTab).toBe("agents");
  });

  it("persists the new-chat default provider/model and reads it back", async () => {
    ctx.uid = 11;
    await assistantConfigRepository.patch({ defaultChatProvider: "gemini", defaultChatModel: "gemini-2.5-flash" });
    const loaded = await assistantConfigRepository.load();
    expect(loaded.defaultChatProvider).toBe("gemini");
    expect(loaded.defaultChatModel).toBe("gemini-2.5-flash");
  });

  it("new-chat provider/model default to unset (frontend falls back)", async () => {
    ctx.uid = 12;
    const loaded = await assistantConfigRepository.load();
    expect(loaded.defaultChatProvider).toBeUndefined();
    expect(loaded.defaultChatModel).toBeUndefined();
  });

  it("a partial patch never wipes the saved new-chat provider/model", async () => {
    ctx.uid = 13;
    await assistantConfigRepository.patch({ defaultChatProvider: "claude", defaultChatModel: "auto" });
    await assistantConfigRepository.patch({ activeProvider: "codex" });
    const loaded = await assistantConfigRepository.load();
    expect(loaded.activeProvider).toBe("codex");
    expect(loaded.defaultChatProvider).toBe("claude");
    expect(loaded.defaultChatModel).toBe("auto");
  });

  it("passing the key as undefined clears the new-chat provider/model", async () => {
    ctx.uid = 14;
    await assistantConfigRepository.patch({ defaultChatProvider: "grok", defaultChatModel: "grok-4" });
    // A patch that explicitly names the key with undefined clears it (the
    // controller maps a wire `null` to undefined before calling patch).
    await assistantConfigRepository.patch({ defaultChatProvider: undefined, defaultChatModel: undefined });
    const loaded = await assistantConfigRepository.load();
    expect(loaded.defaultChatProvider).toBeUndefined();
    expect(loaded.defaultChatModel).toBeUndefined();
  });

  it("redactAssistantConfig passes through the new-chat provider/model", () => {
    const cfg = { ...defaultAssistantConfig(), defaultChatProvider: "minimax" as const, defaultChatModel: "MiniMax-M3[1m]" };
    const red = redactAssistantConfig(cfg);
    expect(red.defaultChatProvider).toBe("minimax");
    expect(red.defaultChatModel).toBe("MiniMax-M3[1m]");
  });

  it("persists reasoning per user and preserves it through unrelated patches", async () => {
    ctx.uid = 21;
    await assistantConfigRepository.patch({ defaultChatEffort: "xhigh" });
    await assistantConfigRepository.patch({ defaultChatModel: "example-model" });
    expect((await assistantConfigRepository.load()).defaultChatEffort).toBe("xhigh");
    ctx.uid = 22;
    expect(redactAssistantConfig(await assistantConfigRepository.load()).defaultChatEffort).toBe("");
    ctx.uid = 21;
    expect(redactAssistantConfig(await assistantConfigRepository.load()).defaultChatEffort).toBe("xhigh");
  });

  it.each(["", undefined] as const)("clears reasoning back to Auto with %s", async (value) => {
    ctx.uid = 23;
    await assistantConfigRepository.patch({ defaultChatEffort: "high" });
    await assistantConfigRepository.patch({ defaultChatEffort: value });
    const loaded = await assistantConfigRepository.load();
    expect(loaded.defaultChatEffort).toBeUndefined();
    // The wire value must explicitly clear an old browser mirror.
    expect(redactAssistantConfig(loaded).defaultChatEffort).toBe("");
  });
});
