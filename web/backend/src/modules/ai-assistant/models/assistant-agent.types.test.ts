// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { sanitizeAllowedTools, isAssistantProviderId } from "./assistant-agent.types.js";

describe("sanitizeAllowedTools", () => {
  it("null/undefined → null (no restriction)", () => {
    expect(sanitizeAllowedTools(null)).toBeNull();
    expect(sanitizeAllowedTools(undefined)).toBeNull();
  });

  it("non-array → null (no restriction)", () => {
    expect(sanitizeAllowedTools("files.read")).toBeNull();
    expect(sanitizeAllowedTools({})).toBeNull();
  });

  it("empty array → empty list (explicit: no tools allowed)", () => {
    expect(sanitizeAllowedTools([])).toEqual([]);
  });

  it("keeps valid tool names, dedups, drops junk + bad charsets", () => {
    const out = sanitizeAllowedTools([
      "files.read", "files.read", "monitor.cpu_top",
      "bad name", "evil;rm", "", 123, null, "obsidian.search_notes",
    ]);
    expect(out).toEqual(["files.read", "monitor.cpu_top", "obsidian.search_notes"]);
  });

  it("caps the list length", () => {
    const many = Array.from({ length: 600 }, (_, i) => `mod.tool${i}`);
    expect(sanitizeAllowedTools(many)?.length).toBe(500);
  });
});

describe("isAssistantProviderId", () => {
  it("accepts known providers", () => {
    for (const id of ["claude", "codex", "gemini", "deepseek", "grok", "minimax"]) {
      expect(isAssistantProviderId(id)).toBe(true);
    }
  });
  it("rejects unknown / non-strings", () => {
    expect(isAssistantProviderId("gpt5")).toBe(false);
    expect(isAssistantProviderId(null)).toBe(false);
    expect(isAssistantProviderId(42)).toBe(false);
  });
});

describe("sanitizeAgentCredential", () => {
  it("acepta credencial válida y recorta label", async () => {
    const { sanitizeAgentCredential } = await import("./assistant-agent.types.js");
    expect(sanitizeAgentCredential({ username: " qa ", secret: "s3cr3t!", label: "  staging  " })).toEqual({
      label: "staging",
      username: "qa",
      secret: "s3cr3t!",
    });
    expect(sanitizeAgentCredential({ username: "qa", secret: "x" })).toEqual({ username: "qa", secret: "x" });
  });

  it("null/inválidos/incompletos → null (sin credencial)", async () => {
    const { sanitizeAgentCredential } = await import("./assistant-agent.types.js");
    expect(sanitizeAgentCredential(null)).toBeNull();
    expect(sanitizeAgentCredential("qa:pass")).toBeNull();
    expect(sanitizeAgentCredential({ username: "", secret: "x" })).toBeNull();
    expect(sanitizeAgentCredential({ username: "qa", secret: "" })).toBeNull();
    expect(sanitizeAgentCredential({ username: "a".repeat(121), secret: "x" })).toBeNull();
    expect(sanitizeAgentCredential({ username: "qa", secret: "x".repeat(241) })).toBeNull();
    // Control chars (inyección en prompt/headers) → rechazo.
    expect(sanitizeAgentCredential({ username: "qa\nadmin", secret: "x" })).toBeNull();
    expect(sanitizeAgentCredential({ username: "qa", secret: "x\r\ny" })).toBeNull();
  });
});
