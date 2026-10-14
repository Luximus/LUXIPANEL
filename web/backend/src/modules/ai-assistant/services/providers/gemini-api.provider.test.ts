// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import { makeGeminiApiProvider } from "./gemini-api.provider.js";
import type { AgentTool } from "../../../../shared/agent-capability/index.js";

describe("Gemini 3 function responses", () => {
  it("echoes the API function-call id in the tool result", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    let turn = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body) as Record<string, unknown>);
      turn++;
      return { ok: true, json: async () => turn === 1
        ? { candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "fc_api_1", name: "demo__echo", args: {} }, thoughtSignature: "opaque" }] } }] }
        : { candidates: [{ content: { role: "model", parts: [{ text: "Listo" }] } }] } };
    }));
    const tool = {
      name: "demo.echo", description: "echo", inputSchema: { properties: {}, required: [] },
      handler: async () => ({ ok: true, output: "hecho" }),
    } as unknown as AgentTool;
    const provider = makeGeminiApiProvider({ apiKey: "key", model: "gemini-3.8-flash" });
    for await (const _ of provider.run([{ role: "user", content: "hola" }], { systemPrompt: "Sistema", tools: [tool] })) { /* drain */ }
    const contents = bodies[1]!.contents as Array<{ parts: Array<{ functionResponse?: { id: string; name: string } }> }>;
    expect(contents.at(-1)?.parts[0]?.functionResponse).toMatchObject({ id: "fc_api_1", name: "demo__echo" });
    expect(contents.at(-2)?.parts[0]).toMatchObject({ thoughtSignature: "opaque" });
    vi.unstubAllGlobals();
  });
});
