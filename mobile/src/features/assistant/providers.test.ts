// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests de la lógica pura de proveedores (fase A4): visión del modelo activo y
// elección del proveedor preferido para un chat nuevo.
import { describe, expect, it } from "vitest";
import { composerImageSupported, resolvePreferredProvider } from "./providers";

describe("composerImageSupported", () => {
  it("deepseek es text-only en ambos modos", () => {
    expect(composerImageSupported("deepseek", null)).toBe(false);
    expect(composerImageSupported("deepseek", { mode: "cli", model: "deepseek-chat" })).toBe(false);
  });

  it("sin config conocida cae al placeholder rico (true)", () => {
    expect(composerImageSupported("claude", null)).toBe(true);
  });

  it("modo CLI acepta imágenes (el agente lee archivos del working dir)", () => {
    expect(composerImageSupported("openai", { mode: "cli", model: "o3-mini" })).toBe(true);
  });

  it("modo API filtra modelos sin visión por nombre", () => {
    expect(composerImageSupported("openai", { mode: "api", model: "o3-mini" })).toBe(false);
    expect(composerImageSupported("minimax", { mode: "api", model: "MiniMax-M1" })).toBe(false);
    expect(composerImageSupported("claude", { mode: "api", model: "claude-sonnet-5" })).toBe(true);
  });
});

describe("resolvePreferredProvider", () => {
  const providers = ["claude", "gemini", "openai"];

  it("respeta el actual si sigue siendo usable (chat restaurado)", () => {
    expect(resolvePreferredProvider({ current: "gemini", defaultChatProvider: "claude", providers })).toBe("gemini");
  });

  it("sin actual usable manda defaultChatProvider, luego activeProvider, luego el 1.º", () => {
    expect(resolvePreferredProvider({ current: "", defaultChatProvider: "openai", activeProvider: "gemini", providers })).toBe("openai");
    expect(resolvePreferredProvider({ current: "", activeProvider: "gemini", providers })).toBe("gemini");
    expect(resolvePreferredProvider({ current: "", providers })).toBe("claude");
  });

  it("ignora candidatos fuera de la lista de usables", () => {
    expect(resolvePreferredProvider({ current: "copilot", defaultChatProvider: "grok", activeProvider: "gemini", providers })).toBe("gemini");
  });

  it("sin proveedores devuelve cadena vacía", () => {
    expect(resolvePreferredProvider({ current: "claude", providers: [] })).toBe("");
  });
});
