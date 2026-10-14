// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askTool,
  ASK_TOOL_NAME,
  ASK_TOOL_RESULT_MARKER,
  isAskToolName,
  parseAskToolResult,
} from "./ask-tool.js";
import type { AgentEvent } from "./providers/provider.types.js";

// The provider transitively imports config/env.ts (via the shared logger),
// which fail-fasts on missing env. Provide the minimal required vars BEFORE the
// dynamic import below so the test is self-contained (no real .env needed).
process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askTool handler", () => {
  it("has the canonical (registry-prefixed) name and is non-dangerous read", () => {
    expect(ASK_TOOL_NAME).toBe("assistant.ask");
    expect(askTool.name).toBe(ASK_TOOL_NAME);
    expect(askTool.kind).toBe("read");
    expect(askTool.dangerous).toBe(false);
  });

  it("validates and returns the marker + normalized AskRequest on valid input", async () => {
    const r = await askTool.handler({
      questions: [{ type: "single", text: "¿Motor?", options: ["nginx", "apache"] }],
    });
    expect(r.ok).toBe(true);
    const out = r.output as string;
    expect(out.startsWith(ASK_TOOL_RESULT_MARKER)).toBe(true);
    const ask = parseAskToolResult(out);
    expect(ask).not.toBeNull();
    expect(ask!.questions).toHaveLength(1);
    expect(ask!.questions[0]).toMatchObject({ id: "q1", type: "single", options: ["nginx", "apache"] });
  });

  it("returns ok:false (no marker) on invalid input so the model can correct", async () => {
    const r = await askTool.handler({ questions: [{ type: "single", text: "sin opciones" }] });
    expect(r.ok).toBe(false);
    expect(String(r.output)).not.toContain(ASK_TOOL_RESULT_MARKER);
    expect(parseAskToolResult(String(r.output))).toBeNull();
  });

  it("isAskToolName matches canonical name and alias only", () => {
    expect(isAskToolName("assistant.ask")).toBe(true);
    expect(isAskToolName("lxp_ask")).toBe(true);
    expect(isAskToolName("files.read")).toBe(false);
  });

  it("parseAskToolResult ignores output without the marker", () => {
    expect(parseAskToolResult("hola")).toBeNull();
    expect(parseAskToolResult(ASK_TOOL_RESULT_MARKER + "{not json")).toBeNull();
  });
});

/** Minimal Anthropic Messages response with a single tool_use block. */
function anthropicToolUse(name: string, input: unknown) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "tu_1", name, input }],
        usage: { input_tokens: 10, output_tokens: 5 },
      };
    },
    async text() {
      return "";
    },
  };
}

describe("claude-api provider — lxp_ask emits `ask` and ends the run", () => {
  it("turns a successful assistant.ask tool call into an `ask` event + done, no extra turn", async () => {
    // Wire name = assistant__ask (dot → __); the model would call it by that name.
    const fetchMock = vi.fn(async () =>
      anthropicToolUse("assistant__ask", {
        questions: [
          { type: "single", text: "¿Motor web?", options: ["nginx", "apache"] },
          { type: "text", text: "Dominio" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { makeClaudeApiProvider } = await import("./providers/claude-api.provider.js");
    const provider = makeClaudeApiProvider({
      id: "claude",
      api: { apiKey: "sk-test", model: "claude-test" },
    });

    const events: AgentEvent[] = [];
    for await (const ev of provider.run([{ role: "user", content: "haz algo" }], {
      systemPrompt: "sys",
      tools: [askTool],
    })) {
      events.push(ev);
    }

    // Exactly one upstream call — the run stopped after the ask (no second turn).
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const ask = events.find((e) => e.type === "ask");
    expect(ask).toBeDefined();
    expect(ask).toMatchObject({ type: "ask", id: "tu_1" });
    if (ask?.type === "ask") {
      expect(ask.questions).toHaveLength(2);
      expect(ask.questions[0]).toMatchObject({ type: "single", options: ["nginx", "apache"] });
    }

    // The ask precedes done, and done is the last event.
    const askIdx = events.findIndex((e) => e.type === "ask");
    const doneIdx = events.findIndex((e) => e.type === "done");
    expect(doneIdx).toBeGreaterThan(askIdx);
    expect(events[events.length - 1]!.type).toBe("done");

    // The internal marker never leaks as a streamed text delta.
    const text = events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
    expect(text).not.toContain(ASK_TOOL_RESULT_MARKER);
  });
});
