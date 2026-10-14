// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  classifyComplexity,
  clampTier,
  resolveModel,
  effortForTier,
  type RoutingContext,
} from "./auto-router.service.js";
import type { AgentMessage } from "./providers/provider.types.js";

const ctx = (over: Partial<RoutingContext> = {}): RoutingContext => ({
  attachments: 0,
  toolCount: 5,
  conversationTurns: 1,
  ...over,
});

const userMsg = (content: string): AgentMessage[] => [{ role: "user", content }];

describe("auto-router · classifyComplexity", () => {
  it("trivial chat → low tier, no multi-agent", () => {
    const d = classifyComplexity(userMsg("hola, ¿cómo estás?"), ctx());
    expect(d.tier).toBe("low");
    expect(d.multiAgent).toBe(false);
  });

  it("a heavy single-verb request escalates above low", () => {
    const d = classifyComplexity(userMsg("refactoriza esta función"), ctx());
    expect(["medium", "high"]).toContain(d.tier);
  });

  it("audit-everything multi-part request → max + multiAgent", () => {
    const text =
      "Audita y refactoriza todo el proyecto paso a paso:\n" +
      "1. revisa la arquitectura\n2. optimiza el rendimiento\n3. depura los errores conocidos\n" +
      "y también analiza la seguridad de cada módulo.";
    const d = classifyComplexity(userMsg(text), ctx({ conversationTurns: 14, toolCount: 25 }));
    expect(d.tier).toBe("max");
    expect(d.multiAgent).toBe(true);
  });

  it("attachments raise the tier", () => {
    const low = classifyComplexity(userMsg("¿qué ves?"), ctx());
    const withImgs = classifyComplexity(userMsg("¿qué ves?"), ctx({ attachments: 3 }));
    expect(withImgs.tier).not.toBe("low");
    expect(low.tier).toBe("low");
  });
});

describe("auto-router · clampTier", () => {
  it("clamps above the cap", () => {
    expect(clampTier("max", "medium")).toBe("medium");
    expect(clampTier("high", "low")).toBe("low");
  });
  it("leaves tiers at or below the cap untouched", () => {
    expect(clampTier("low", "max")).toBe("low");
    expect(clampTier("medium", "medium")).toBe("medium");
  });
});

describe("auto-router · resolveModel", () => {
  it("maps claude tiers to the expected models", () => {
    expect(resolveModel("claude", "low", false)).toBe("claude-haiku-4-5");
    expect(resolveModel("claude", "medium", false)).toBe("claude-sonnet-5");
    expect(resolveModel("claude", "high", false)).toBe("claude-sonnet-5");
    expect(resolveModel("claude", "max", false)).toBe("claude-opus-5-5");
  });

  it("uses the current single public Grok model for every tier", () => {
    expect(resolveModel("grok", "low", true)).toBe("grok-4.7");
    expect(resolveModel("grok", "max", false)).toBe("grok-4.7");
  });

  it("routes DeepSeek image requests to Flash even from the Pro tier", () => {
    expect(resolveModel("deepseek", "low", true)).toBe("deepseek-flash");
    expect(resolveModel("deepseek", "max", true)).toBe("deepseek-flash");
    expect(resolveModel("deepseek", "max", false)).toBe("deepseek-v4-pro");
  });

  it("routes MiniMax image requests from M2.7 to M3", () => {
    expect(resolveModel("minimax", "low", true)).toBe("MiniMax-M3");
  });
});

describe("auto-router · effortForTier", () => {
  it("maps tiers to effort levels", () => {
    expect(effortForTier("low")).toBe("low");
    expect(effortForTier("max")).toBe("xhigh");
  });
});
