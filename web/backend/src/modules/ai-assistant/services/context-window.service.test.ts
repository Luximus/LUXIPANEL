// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, afterEach, vi } from "vitest";

// env.ts (pulled in transitively via the shared logger) fail-fasts on missing
// core vars — provide the minimal set BEFORE the module under test is imported.
process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

const ORIG = { ...process.env };

/** Re-import with a fresh env parse so each case sees its own guard config. */
async function load() {
  vi.resetModules();
  return import("./context-window.service.js");
}

describe("upstreamSessionResetBytes", () => {
  afterEach(() => {
    process.env = { ...ORIG };
  });

  it("derives the byte budget from window × CLI autocompact-ratio × 4 when the guard is enabled", async () => {
    process.env.ASSISTANT_CONTEXT_GUARD_ENABLED = "true";
    process.env.ASSISTANT_CONTEXT_WINDOW_TOKENS = "200000";
    // The upstream `.jsonl` budget is inherently CLI-only, so it uses the
    // (lower) CLI ratio, not the generic one.
    process.env.ASSISTANT_CONTEXT_AUTOCOMPACT_RATIO_CLI = "0.8";
    const { upstreamSessionResetBytes } = await load();
    // 200000 * 0.8 * 4 = 640000 bytes (~640 KB).
    expect(upstreamSessionResetBytes()).toBe(640_000);
  });

  it("scales with the configured context window", async () => {
    process.env.ASSISTANT_CONTEXT_GUARD_ENABLED = "true";
    process.env.ASSISTANT_CONTEXT_WINDOW_TOKENS = "1000000";
    process.env.ASSISTANT_CONTEXT_AUTOCOMPACT_RATIO_CLI = "0.8";
    const { upstreamSessionResetBytes } = await load();
    expect(upstreamSessionResetBytes()).toBe(3_200_000);
  });

  it("returns 0 (skip the reset check) when the context guard is disabled", async () => {
    process.env.ASSISTANT_CONTEXT_GUARD_ENABLED = "false";
    process.env.ASSISTANT_CONTEXT_WINDOW_TOKENS = "200000";
    const { upstreamSessionResetBytes } = await load();
    expect(upstreamSessionResetBytes()).toBe(0);
  });
});
