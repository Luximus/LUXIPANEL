// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, expect, it, vi } from "vitest";
import { makeOpenAiResponsesProvider } from "./openai-responses.provider.js";
import { makeOpenAiCompatibleProvider } from "./openai-api.provider.js";
afterEach(() => vi.unstubAllGlobals());
it.each([undefined, "normal", "fast"] as const)("applies %s only to OpenAI transports", async speed => {
  const api = { apiKey: "test-key", model: "gpt-6-astra" };
  for (const transport of ["responses", "codex", "grok"] as const) {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return { ok: true, json: async () => transport === "responses"
        ? { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Listo" }] }] }
        : { choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Listo" } }] } };
    }));
    const provider = transport === "responses" ? makeOpenAiResponsesProvider(api)
      : makeOpenAiCompatibleProvider({ id: transport, api, defaultBaseUrl: "https://example.test" });
    const events = [];
    for await (const event of provider.run([{ role: "user", content: "Hola" }], { tools: [], systemPrompt: "Sistema", speed })) events.push(event);
    expect(events.at(-1)?.type).toBe("done");
    expect(requests).toHaveLength(1);
    expect(requests[0].service_tier).toBe(transport === "grok" || !speed ? undefined : speed === "fast" ? "fast" : "default");
  }
});
