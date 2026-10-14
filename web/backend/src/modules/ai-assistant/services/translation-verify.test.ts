// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, beforeEach, vi } from "vitest";

// Simulated per-engine behavior, keyed by "ai:<providerId>" or the engine id.
//   "ok"   → returns a real (different) translation
//   "fail" → throws (e.g. 429 quota / 401)
//   "echo" → returns the source verbatim (degraded engine — must count as fail)
const behavior: Record<string, "ok" | "fail" | "echo"> = {};

vi.mock("./translation/translation-factory.js", () => ({
  buildTranslationProvider: (config: { translation: { engine: string; ai?: { providerId?: string } } }) => {
    const t = config.translation;
    const key = t.engine === "ai" ? `ai:${t.ai?.providerId}` : t.engine;
    return {
      id: t.engine,
      ping: async () => ({ ok: true, detail: key }),
      translate: async (text: string) => {
        const b = behavior[key] ?? "fail";
        if (b === "fail") throw new Error(`${key} 429 quota exceeded`);
        if (b === "echo") return text; // untranslated → verification must reject
        return `[${key}] traducido`;
      },
    };
  },
}));

// Imported AFTER the mock so the service binds to the mocked factory.
const { translationService } = await import("./translation.service.js");

type AnyConfig = Parameters<typeof translationService.verifyWithFallback>[0];

function makeConfig(
  keyed: Partial<Record<string, boolean>>,
  ai: { providerId: string; model: string },
  opts: { activeProvider?: string; aiFollowActive?: boolean } = {},
): AnyConfig {
  const providers = ["claude", "codex", "gemini", "deepseek", "minimax"].reduce((acc, id) => {
    acc[id] = { mode: "api", api: { apiKey: keyed[id] ? "sk-test" : "", model: `${id}-model` }, cli: { installed: false, loggedIn: false } };
    return acc;
  }, {} as Record<string, unknown>);
  return {
    enabled: true,
    activeProvider: opts.activeProvider ?? "claude",
    providers,
    translation: {
      enabled: true,
      engine: "ai",
      targetLanguage: "es",
      ai,
      // Default these tests to an EXPLICIT pin so `ai.providerId` is honored;
      // follow-active behavior is covered separately below.
      aiFollowActive: opts.aiFollowActive ?? false,
      deepl: { apiKey: "" },
      google: { apiKey: "" },
      libretranslate: { baseUrl: "", apiKey: "" },
    },
    voice: {},
    uiMode: "simple",
  } as unknown as AnyConfig;
}

describe("translationService.verifyWithFallback", () => {
  beforeEach(() => {
    for (const k of Object.keys(behavior)) delete behavior[k];
  });

  it("keeps the chosen engine when it works (no fallback)", async () => {
    behavior["ai:gemini"] = "ok";
    const cfg = makeConfig({ gemini: true, claude: true }, { providerId: "gemini", model: "gemini-2.5-flash" });
    const r = await translationService.verifyWithFallback(cfg, cfg.translation);
    expect(r.enabled).toBe(true);
    expect(r.disabled).toBe(false);
    expect(r.fellBack).toBe(false);
    expect(r.translation.ai?.providerId).toBe("gemini");
  });

  it("falls back to the first working engine when the chosen one fails (429)", async () => {
    behavior["ai:gemini"] = "fail";
    behavior["ai:claude"] = "ok";
    const cfg = makeConfig({ gemini: true, claude: true }, { providerId: "gemini", model: "gemini-2.5-flash" });
    const r = await translationService.verifyWithFallback(cfg, cfg.translation);
    expect(r.enabled).toBe(true);
    expect(r.fellBack).toBe(true);
    expect(r.translation.enabled).toBe(true);
    expect(r.translation.ai?.providerId).toBe("claude");
    // The failing gemini attempt is recorded before the working claude one.
    expect(r.trials[0]).toMatchObject({ providerId: "gemini", ok: false });
    expect(r.trials.at(-1)).toMatchObject({ providerId: "claude", ok: true });
  });

  it("treats an untranslated echo as a failure and falls back", async () => {
    behavior["ai:gemini"] = "echo"; // returns the English sample verbatim
    behavior["ai:codex"] = "ok";
    const cfg = makeConfig({ gemini: true, codex: true }, { providerId: "gemini", model: "gemini-2.5-flash" });
    const r = await translationService.verifyWithFallback(cfg, cfg.translation);
    expect(r.fellBack).toBe(true);
    expect(r.translation.ai?.providerId).toBe("codex");
  });

  it("disables background translation when every engine fails", async () => {
    behavior["ai:gemini"] = "fail";
    behavior["ai:claude"] = "fail";
    behavior["ai:codex"] = "fail";
    const cfg = makeConfig({ gemini: true, claude: true, codex: true }, { providerId: "gemini", model: "gemini-2.5-flash" });
    const r = await translationService.verifyWithFallback(cfg, cfg.translation);
    expect(r.enabled).toBe(false);
    expect(r.disabled).toBe(true);
    expect(r.translation.enabled).toBe(false);
    // The user's engine selection is preserved so they can fix the key + re-enable.
    expect(r.translation.ai?.providerId).toBe("gemini");
    expect(r.trials.every((t) => !t.ok)).toBe(true);
  });

  it("follow-active: uses the active provider (ignores stale ai.providerId)", async () => {
    behavior["ai:gemini"] = "ok"; // active provider works
    // ai.providerId is a stale "claude" but aiFollowActive=true → must use gemini.
    const cfg = makeConfig({ gemini: true, claude: true }, { providerId: "claude", model: "x" }, {
      activeProvider: "gemini",
      aiFollowActive: true,
    });
    const r = await translationService.verifyWithFallback(cfg, cfg.translation);
    expect(r.enabled).toBe(true);
    expect(r.fellBack).toBe(false);
    expect(r.translation.ai?.providerId).toBe("gemini");
    expect(r.trials[0]).toMatchObject({ providerId: "gemini", ok: true });
  });

  it("follow-active: when the active provider fails, falls back AND pins it (aiFollowActive=false)", async () => {
    behavior["ai:gemini"] = "fail"; // active provider down
    behavior["ai:claude"] = "ok";
    const cfg = makeConfig({ gemini: true, claude: true }, { providerId: "gemini", model: "x" }, {
      activeProvider: "gemini",
      aiFollowActive: true,
    });
    const r = await translationService.verifyWithFallback(cfg, cfg.translation);
    expect(r.fellBack).toBe(true);
    expect(r.translation.ai?.providerId).toBe("claude");
    // The fallback must STICK — runtime would otherwise re-follow the failed active.
    expect(r.translation.aiFollowActive).toBe(false);
  });

  it("only probes engines that have credentials configured", async () => {
    behavior["ai:claude"] = "ok"; // claude has a key and works
    // gemini chosen but has NO key → skipped; claude is the only viable candidate.
    const cfg = makeConfig({ claude: true }, { providerId: "gemini", model: "gemini-2.5-flash" });
    const r = await translationService.verifyWithFallback(cfg, cfg.translation);
    expect(r.translation.ai?.providerId).toBe("claude");
    expect(r.trials.some((t) => t.providerId === "gemini")).toBe(false);
  });
});
