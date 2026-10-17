// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentTool } from "../../../../shared/agent-capability/index.js";
import type { AgentEvent, AgentProvider } from "./provider.types.js";
import { makeClaudeApiProvider } from "./claude-api.provider.js";
import { makeOpenAiCompatibleProvider } from "./openai-api.provider.js";
import { makeOpenAiResponsesProvider } from "./openai-responses.provider.js";
import { makeGeminiApiProvider } from "./gemini-api.provider.js";
vi.mock("./api-loop.js", async importOriginal => {
  const actual = await importOriginal<typeof import("./api-loop.js")>();
  return { ...actual, MAX_TURNS: 2, compressForHistory: async (outcome: { output: string }) => ({ modelOutput: outcome.output, savedTokens: 0 }) };
});

const api = { apiKey: "test-key", model: "test-model" };
const cases = [
  {
    name: "Claude", provider: () => makeClaudeApiProvider({ id: "claude", api }),
    tool: { stop_reason: "tool_use", content: [{ type: "text", text: "Revisando" }, { type: "tool_use", id: "t1", name: "demo__read", input: {} }] },
    final: { stop_reason: "end_turn", content: [{ type: "text", text: "Verificado" }] },
    incomplete: { stop_reason: "max_tokens", content: [{ type: "tool_use", id: "t1", name: "demo__read", input: {} }] },
    empty: { stop_reason: "end_turn", content: [] },
  },
  {
    name: "OpenAI-compatible", provider: () => makeOpenAiCompatibleProvider({ id: "codex", api, defaultBaseUrl: "https://example.test" }),
    tool: { choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: "Revisando", tool_calls: [{ type: "function", id: "t1", function: { name: "demo__read", arguments: "{}" } }] } }] },
    final: { choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Verificado" } }] },
    incomplete: { choices: [{ finish_reason: "length", message: { role: "assistant", content: "Parcial" } }] },
    empty: { choices: [] },
  },
  {
    name: "Responses", provider: () => makeOpenAiResponsesProvider(api),
    tool: { status: "completed", output: [{ type: "function_call", call_id: "t1", name: "demo__read", arguments: "{}" }] },
    final: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Verificado" }] }] },
    incomplete: { status: "incomplete", output: [{ type: "function_call", call_id: "t1", name: "demo__read", arguments: "{}" }] },
    empty: { status: "completed", output: [] },
  },
  {
    name: "Gemini", provider: () => makeGeminiApiProvider(api),
    tool: { candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ functionCall: { id: "t1", name: "demo__read", args: {} } }] } }] },
    final: { candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: "Verificado" }] } }] },
    incomplete: { candidates: [{ finishReason: "MAX_TOKENS", content: { role: "model", parts: [{ functionCall: { id: "t1", name: "demo__read", args: {} } }] } }] },
    empty: { candidates: [] },
  },
];
afterEach(() => vi.unstubAllGlobals());
function responses(...items: unknown[]) {
  let n = 0;
  const fetch = vi.fn(async () => ({ ok: true, json: async () => items[Math.min(n++, items.length - 1)] }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
async function collect(provider: AgentProvider, handler = vi.fn<AgentTool["handler"]>(async () => ({ ok: true, output: "evidencia" }))) {
  const tool = { name: "demo.read", kind: "read", description: "read", inputSchema: { properties: {}, required: [] }, handler } as AgentTool;
  const events: AgentEvent[] = [];
  for await (const event of provider.run([{ role: "user", content: "Comprueba" }], { systemPrompt: "Sistema", tools: [tool] })) events.push(event);
  return { events, handler };
}
describe.each(cases)("$name completion", example => {
  it("ends successfully only after the tool result and final response", async () => {
    responses(example.tool, example.final);
    const { events, handler } = await collect(example.provider());
    expect(handler).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toEqual({ type: "done" });
  });
  it("reports the round-trip ceiling without restarting or completing the task", async () => {
    const fetch = responses(example.tool);
    const { events, handler } = await collect(example.provider());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(events.at(-1)?.type).toBe("error");
    expect(events.some(event => event.type === "done")).toBe(false);
  });
  it("does not execute truncated tool input", async () => {
    responses(example.incomplete);
    const { events, handler } = await collect(example.provider());
    expect(events.at(-1)?.type).toBe("error");
    expect(handler).not.toHaveBeenCalled();
  });
  it("does not accept an empty response as success", async () => {
    responses(example.empty);
    const { events } = await collect(example.provider());
    expect(events.at(-1)?.type).toBe("error");
  });
  it("does not ask the model to retry an operation with an unconfirmed result", async () => {
    const fetch = responses(example.tool);
    const handler = vi.fn<AgentTool["handler"]>(async () => ({ ok: false, output: {
      operationStatus: "unconfirmed", message: "El servidor no respondió a tiempo.",
      nextStep: "Comprueba el estado antes de repetir la operación.",
    } }));
    const { events } = await collect(example.provider(), handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toEqual({ type: "error", message: "El servidor no respondió a tiempo. Comprueba el estado antes de repetir la operación." });
  });
});

it("does not concatenate Responses commentary with its final message", async () => {
  responses({ status: "completed", output: [
    { type: "message", phase: "commentary", content: [{ type: "output_text", text: "Voy a cambiarlo" }] },
    { type: "message", phase: "final_answer", content: [{ type: "output_text", text: "Verificado" }] },
  ] });
  const { events } = await collect(makeOpenAiResponsesProvider(api));
  expect(events.filter(e => e.type === "text" && e.phase !== "commentary").map(e => e.type === "text" ? e.delta : "").join("")).toBe("Verificado");
  expect(events.some(e => e.type === "text" && e.phase === "commentary")).toBe(true);
});
