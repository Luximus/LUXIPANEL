// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, expect, it, vi } from "vitest";
import { streamAgentResume } from "./agent-stream";
vi.mock("@/lib/api-client", () => ({ scopeHeaders: () => ({ "X-Test-Scope": "target-a" }) }));
afterEach(() => { vi.unstubAllGlobals(); });

it("only treats HTTP 204 as an absent run", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  expect(await streamAgentResume("conversation", 7, new AbortController().signal)).toBeNull();
});

it.each([401, 403, 503])("preserves a backend failure on HTTP %s instead of claiming there is no run", async status => {
  const message = status === 403 ? "Permiso insuficiente" : status === 401 ? "La sesión ha caducado" : "El servidor no respondió a tiempo";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message }), {
    status, headers: { "content-type": "application/json" },
  })));
  await expect(streamAgentResume("conversation", 7, new AbortController().signal)).rejects.toThrow(message);
});

it("keeps an empty successful response recoverable", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
  await expect(streamAgentResume("conversation", 7, new AbortController().signal)).rejects.toBeInstanceOf(TypeError);
});

it("reads phase and pending terminal frames with the original cursor and target scope", async () => {
  const fetch = vi.fn(async () => new Response(
    'id: 8\ndata: {"type":"text","phase":"commentary","delta":"Guardando"}\n\nid: 9\ndata: {"type":"done","pending":true}\n\n',
    { headers: { "content-type": "text/event-stream" } },
  ));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  const stream = await streamAgentResume("chat / id", 7, signal);
  const received = [];
  for await (const frame of stream!) received.push(frame);
  expect(fetch).toHaveBeenCalledWith("/api/ai/agent/stream?conversationId=chat%20%2F%20id&fromSeq=7",
    expect.objectContaining({ method: "GET", signal, headers: expect.objectContaining({ "X-Test-Scope": "target-a" }) }));
  expect(received).toEqual([
    { event: { type: "text", phase: "commentary", delta: "Guardando" }, seq: 8 },
    { event: { type: "done", pending: true }, seq: 9 },
  ]);
});
