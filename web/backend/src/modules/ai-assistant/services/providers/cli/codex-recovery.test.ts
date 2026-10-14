// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { codexFailure, codexContinuationPrompt } from "./codex-recovery.js";

describe("codexFailure", () => {
  it("detects a structured overload even when Codex also reports a missing thread", () => {
    const log = [
      JSON.stringify({ type: "turn.failed", error: { message: "Selected model is at capacity. Please try a different model.", codex_error_info: "server_overloaded" } }),
      "2026-10-05T18:45:51Z ERROR codex_core::session: failed to record rollout items: thread 01a10cc5-2afc-7d81-ae90-503a452b325a not found",
    ].join("\n");
    expect(codexFailure(log, 1)).toBe("overloaded");
  });

  it("detects a missing upstream session on a failed resume", () => {
    expect(codexFailure("ERROR codex_core::session: thread 01a10cc5-2afc-7d81-ae90-503a452b325a not found", 1)).toBe("missing-session");
  });

  it("detects an active writer conflict without treating it as a missing session", () => {
    const log = "2026-10-06T00:30:44Z ERROR codex_core::session: Failed to create session: thread-store conflict: thread 01a10cc5-2afc-7d81-ae90-503a452b325a already has an active writer";
    expect(codexFailure(log, 1)).toBe("active-writer");
  });

  it("does not mistake quoted errors or successful turns for a failed run", () => {
    const quoted = JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "Selected model is at capacity" } });
    expect(codexFailure(quoted, 1)).toBeNull();
    expect(codexFailure("Selected model is at capacity", 0)).toBeNull();
    expect(codexFailure([JSON.stringify({ type: "error", message: "server_overloaded" }), JSON.stringify({ type: "turn.completed" })].join("\n"), 0)).toBeNull();
  });
});

it("asks the retry to inspect existing side effects before continuing", () => {
  const prompt = codexContinuationPrompt("Publica el sitio");
  expect(prompt).toContain("No repitas acciones");
  expect(prompt).toContain("Publica el sitio");
});
