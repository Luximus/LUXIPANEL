// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi } from "vitest";
import { makeClaudeApiProvider } from "./claude-api.provider.js";
import type { AgentTool } from "../../../../shared/agent-capability/index.js";

const tool = (name: string): AgentTool =>
  ({ name, description: "d", inputSchema: { properties: {}, required: [] }, handler: async () => ({ ok: true, output: "x" }) }) as unknown as AgentTool;

function mockFetch(captured: { body?: Record<string, unknown> }) {
  return vi.fn(async (_url: string, init: { body: string }) => {
    captured.body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "hi" }], usage: { input_tokens: 1, output_tokens: 1 } }),
    };
  });
}

async function drain(gen: AsyncGenerator<unknown>): Promise<void> {
  for await (const _ of gen) { /* consume */ }
}

describe("claude-api prompt caching", () => {
  it("claude: stable 1h-cached system + sorted tools + volatile snapshot on the turn tail", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    const fetchMock = mockFetch(captured);
    vi.stubGlobal("fetch", fetchMock);
    const p = makeClaudeApiProvider({ id: "claude", api: { apiKey: "k", model: "claude-opus-4-8" } as never });
    await drain(p.run([{ role: "user", content: "hola" }], { systemPrompt: "BASE", systemContext: "CTX", tools: [tool("zeta.b"), tool("alpha.a")] }));

    const b = captured.body as { system: Array<{ type: string; text: string; cache_control?: unknown }>; tools: Array<{ name: string }>; messages: Array<{ content: unknown }> };
    // System is STABLE-ONLY now (no volatile CTX block) and cached with the 1h TTL.
    expect(Array.isArray(b.system)).toBe(true);
    expect(b.system).toHaveLength(1);
    expect(b.system[0]).toMatchObject({ type: "text", text: "BASE", cache_control: { type: "ephemeral", ttl: "1h" } });
    // 1h TTL requires the beta header.
    const init = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers["anthropic-beta"]).toBe("extended-cache-ttl-2025-04-11");
    // Tools deterministically sorted by (anthropic) name.
    const names = b.tools.map((t) => t.name);
    expect(names).toEqual([...names].sort());
    // The volatile snapshot rides on the current user turn as a trailing block,
    // and that turn carries the (5-minute) breakpoint.
    const lastMsg = b.messages[b.messages.length - 1]!;
    const blocks = lastMsg.content as Array<{ type: string; text?: string; cache_control?: unknown }>;
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.map((x) => x.text)).toEqual(["hola", "CTX"]);
    expect(blocks[blocks.length - 1]!.cache_control).toEqual({ type: "ephemeral" });
  });

  it("claude: multi-turn places a 1h breakpoint at the stable prior-history boundary", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    vi.stubGlobal("fetch", mockFetch(captured));
    const p = makeClaudeApiProvider({ id: "claude", api: { apiKey: "k", model: "claude-opus-4-8" } as never });
    await drain(p.run(
      [
        { role: "user", content: "t1" },
        { role: "assistant", content: "a1" },
        { role: "user", content: "t2" },
      ],
      { systemPrompt: "BASE", systemContext: "CTX", tools: [] },
    ));

    const b = captured.body as { messages: Array<{ role: string; content: unknown }> };
    // Prior-turn boundary (the assistant message before the current turn) gets
    // the long-TTL breakpoint so turns 0..N-1 cache-read on the next request.
    const prior = b.messages[1]!;
    const priorBlocks = prior.content as Array<{ cache_control?: unknown }>;
    expect(priorBlocks[priorBlocks.length - 1]!.cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    // Current turn keeps the moving 5-minute breakpoint + the snapshot.
    const cur = b.messages[2]!;
    const curBlocks = cur.content as Array<{ text?: string; cache_control?: unknown }>;
    expect(curBlocks.map((x) => x.text)).toEqual(["t2", "CTX"]);
    expect(curBlocks[curBlocks.length - 1]!.cache_control).toEqual({ type: "ephemeral" });
  });

  it("minimax (non-anthropic): plain string system, no cache_control", async () => {
    const captured: { body?: Record<string, unknown> } = {};
    vi.stubGlobal("fetch", mockFetch(captured));
    const p = makeClaudeApiProvider({ id: "minimax", api: { apiKey: "k", model: "m", baseUrl: "https://api.minimax.io/anthropic" } as never, defaultBaseUrl: "https://api.minimax.io/anthropic" });
    await drain(p.run([{ role: "user", content: "hi" }], { systemPrompt: "BASE", systemContext: "CTX", tools: [] }));

    const b = captured.body as { system: unknown; messages: Array<{ content: unknown }> };
    expect(typeof b.system).toBe("string");
    expect(b.system).toBe("BASE\n\nCTX");
    // No cache breakpoint injected for non-anthropic endpoints.
    const lastMsg = b.messages[b.messages.length - 1]!;
    expect(typeof lastMsg.content).toBe("string");
  });
});
