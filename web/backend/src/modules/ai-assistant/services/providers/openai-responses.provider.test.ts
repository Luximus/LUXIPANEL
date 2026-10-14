// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import { makeOpenAiResponsesProvider } from "./openai-responses.provider.js";
import type { AgentTool } from "../../../../shared/agent-capability/index.js";

describe("GPT-6 Responses tool loop", () => {
  it("keeps reasoning and function results in the stateless continuation", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    let turn = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
      requests.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
      turn++;
      return {
        ok: true,
        json: async () => turn === 1
          ? { output: [
              { type: "reasoning", id: "rs_1", encrypted_content: "opaque" },
              { type: "function_call", id: "fc_1", call_id: "call_1", name: "demo__echo", arguments: "{}" },
            ], usage: { input_tokens: 10, output_tokens: 5 } }
          : { output: [{ type: "message", content: [{ type: "output_text", text: "Listo" }] }], usage: { input_tokens: 12, output_tokens: 3 } },
      };
    }));
    const tool = {
      name: "demo.echo", description: "echo", inputSchema: { properties: {}, required: [] },
      handler: async () => ({ ok: true, output: "hecho" }),
    } as unknown as AgentTool;
    const provider = makeOpenAiResponsesProvider({ apiKey: "key", model: "gpt-6-astra" });
    const events = [];
    for await (const event of provider.run([{ role: "user", content: "hola" }], {
      systemPrompt: "Sistema", tools: [tool], effort: "xhigh",
    })) events.push(event);

    expect(requests.map((r) => r.url)).toEqual([
      "https://api.openai.com/v1/responses", "https://api.openai.com/v1/responses",
    ]);
    expect(requests[0]!.body).toMatchObject({ model: "gpt-6-astra", store: false, reasoning: { effort: "xhigh" } });
    expect(requests[0]!.body.tools).toMatchObject([{ type: "function", name: "demo__echo" }]);
    expect(requests[1]!.body.input).toEqual(expect.arrayContaining([
      { type: "reasoning", id: "rs_1", encrypted_content: "opaque" },
      { type: "function_call_output", call_id: "call_1", output: "hecho" },
    ]));
    expect(events).toContainEqual({ type: "text", delta: "Listo" });
    expect(events.at(-1)).toEqual({ type: "done" });
    vi.unstubAllGlobals();
  });
});
