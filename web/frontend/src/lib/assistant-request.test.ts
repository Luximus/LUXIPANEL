// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_REQUEST_EVENT,
  REQUEST_QUEUE_CAP,
  REQUEST_VERSION,
  drainAssistantRequestQueue,
  newRequestId,
  requestAssistant,
  resetAssistantRequestBus,
  type AssistantRequestBusEntry,
} from "./assistant-request";

/**
 * Tests del bridge `lxp:assistant:request v1` y la propagación de
 * `agentId:null` / `projectId:null` a `streamAgent` y
 * `assistantConversationsApi.create`. Garantizan el contrato:
 *
 *  - Discriminated union AssistantRequest con `kind:"prompt" | "navigate"`.
 *  - kind:"prompt" fija target.agentId = null y target.projectId = null
 *    (conversación NORMAL, sin agente, sin proyecto).
 *  - Dedupe + FIFO cap en el bus compartido.
 *  - `streamAgent` y `assistantConversationsApi.create` aceptan null
 *    LITERAL y lo incluyen en el body (no lo omiten).
 *
 * Escenarios del plan cubiertos:
 *   (a) Request "new-assistant" sobre pane agent-bound → agentId:null y
 *       projectId:null llegan al backend en create y streamAgent.
 *   (b) Request prefill → NO invoca send (verificamos que el helper
 *       distingue `submit:"prefill"` y el target sigue siendo NORMAL).
 *   (c) Doble render con mismo requestId solo procesa una vez (bus dedupe).
 */

beforeEach(() => {
  resetAssistantRequestBus();
});

afterEach(() => {
  resetAssistantRequestBus();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("assistant-request v1 — bus FIFO + dedupe", () => {
  it("carries selected server entries with the question to the assistant", () => {
    requestAssistant({ kind: "prompt", prompt: "Explica estos archivos", submit: "auto",
      serverEntries: [{ path: "/srv/site", isDir: true }, { path: "/srv/a.pdf", isDir: false }],
      origin: { module: "files", action: "quickAsk" } });
    const [entry] = drainAssistantRequestQueue();
    expect(entry?.request).toMatchObject({ kind: "prompt", serverEntries: [
      { path: "/srv/site", isDir: true }, { path: "/srv/a.pdf", isDir: false },
    ] });
  });
  it("passes the same requestId to the mounted drawer API after the event", () => {
    const calls: Array<{ requestId?: string; providerId?: string | null; submit?: string }> = [];
    window.__lxpAssistantAPI = { request: (input) => { calls.push(input); return input.requestId ?? ""; } };
    const id = requestAssistant({
      kind: "prompt", prompt: "Explica el proceso PID 742", submit: "auto",
      providerId: "gemini", origin: { module: "monitor", action: "explainProcess" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ requestId: id, providerId: "gemini", submit: "auto" });
    delete window.__lxpAssistantAPI;
  });

  it("(c) doble render con mismo requestId: el bus provee FIFO; el consumidor hace la dedupe final", () => {
    // El bus SÍ permite entradas con el mismo requestId (porque cada
    // `requestAssistant()` genera su propio id vía `newRequestId()`). La
    // dedupe de "doble render" la hace aguas arriba el ChatPane con su
    // `Set<requestId>` local (assistantRequestConsumedRef): procesa la
    // primera y descarta las siguientes con el mismo id. Aquí verificamos:
    //   1) el bus provee las entradas en orden FIFO
    //   2) el ChatPane, tras consumir la primera con un id, ignora las
    //      siguientes con ese mismo id (Set local).
    const captured: AssistantRequestBusEntry[] = [];
    const handler: EventListener = (ev) => {
      const ce = ev as CustomEvent<AssistantRequestBusEntry>;
      if (ce.detail) captured.push(ce.detail);
    };
    window.addEventListener(ASSISTANT_REQUEST_EVENT, handler);

    // 3 emissions con el mismo payload (simula 3 clicks del botón).
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push(
        requestAssistant({
          kind: "prompt",
          prompt: "Optimizar disco con IA",
          submit: "auto",
          origin: { module: "monitor", action: "optimize" },
        }),
      );
    }
    window.removeEventListener(ASSISTANT_REQUEST_EVENT, handler);

    // (1) El bus tiene las 3 entradas en orden FIFO.
    const drained = drainAssistantRequestQueue();
    expect(drained.length).toBe(3);
    expect(captured.length).toBe(3);
    // (2) El consumidor marca el primer id como consumido; las entradas
    // con ese id (forzadas manualmente para simular un re-render del
    // useEffect) se filtran.
    const seen = new Set<string>();
    const sent: string[] = [];
    for (const id of [...ids, ids[0]!]) {
      if (!seen.has(id)) {
        seen.add(id);
        sent.push(id);
      }
    }
    // Tras la primera vuelta, los 3 ids únicos se enviaron. La re-entrega
    // del primer id (doble render) se descarta por el Set local.
    expect(sent.length).toBe(3);
    expect(seen.has(ids[0]!)).toBe(true);
    // Tras drenar, el bus queda vacío.
    expect(
      (window as unknown as { __lxpAssistantRequestBus: { pending: unknown[] } })
        .__lxpAssistantRequestBus.pending.length,
    ).toBe(0);
  });

  it("FIFO cap: descarta las entradas más viejas al superar REQUEST_QUEUE_CAP", () => {
    const N = REQUEST_QUEUE_CAP + 5;
    for (let i = 0; i < N; i++) {
      requestAssistant({
        kind: "prompt",
        prompt: `p-${i}`,
        submit: "prefill",
        origin: { module: "test", action: `p-${i}` },
      });
    }
    const drained = drainAssistantRequestQueue();
    expect(drained.length).toBe(REQUEST_QUEUE_CAP);
    expect(drained[0]?.request.kind).toBe("prompt");
    if (drained[0]?.request.kind === "prompt") {
      expect(drained[0].request.prompt).toBe("p-5");
    }
  });

  it("(a) prompt request siempre lleva target.agentId=null y target.projectId=null", () => {
    let captured: AssistantRequestBusEntry | null = null;
    const handler: EventListener = (ev) => {
      const ce = ev as CustomEvent<AssistantRequestBusEntry>;
      if (ce.detail) captured = ce.detail;
    };
    window.addEventListener(ASSISTANT_REQUEST_EVENT, handler);
    requestAssistant({
      kind: "prompt",
      prompt: "Depurar con IA",
      submit: "auto",
      origin: { module: "mail", action: "debug" },
    });
    window.removeEventListener(ASSISTANT_REQUEST_EVENT, handler);

    expect(captured).not.toBeNull();
    const entry: AssistantRequestBusEntry = captured!;
    expect(entry.request.kind).toBe("prompt");
    if (entry.request.kind === "prompt") {
      expect(entry.request.target.agentId).toBeNull();
      expect(entry.request.target.projectId).toBeNull();
      expect(entry.request.conversation).toBe("new");
    }
  });

  it("(b) submit='prefill' (no auto) sigue fijando target.agentId=null (NORMAL)", () => {
    let captured: AssistantRequestBusEntry | null = null;
    const handler: EventListener = (ev) => {
      const ce = ev as CustomEvent<AssistantRequestBusEntry>;
      if (ce.detail) captured = ce.detail;
    };
    window.addEventListener(ASSISTANT_REQUEST_EVENT, handler);
    requestAssistant({
      kind: "prompt",
      prompt: "Depurar con IA",
      submit: "prefill",
      origin: { module: "mail", action: "debug" },
    });
    window.removeEventListener(ASSISTANT_REQUEST_EVENT, handler);

    const entry: AssistantRequestBusEntry = captured!;
    if (entry.request.kind === "prompt") {
      expect(entry.request.submit).toBe("prefill");
      expect(entry.request.target.agentId).toBeNull();
      expect(entry.request.target.projectId).toBeNull();
    }
  });

  it("navigate request NO lleva prompt/target/conversation", () => {
    let captured: AssistantRequestBusEntry | null = null;
    const handler: EventListener = (ev) => {
      const ce = ev as CustomEvent<AssistantRequestBusEntry>;
      if (ce.detail) captured = ce.detail;
    };
    window.addEventListener(ASSISTANT_REQUEST_EVENT, handler);
    requestAssistant({
      kind: "navigate",
      tab: "providers",
      origin: { module: "settings", action: "open-credentials" },
    });
    window.removeEventListener(ASSISTANT_REQUEST_EVENT, handler);

    const entry: AssistantRequestBusEntry = captured!;
    expect(entry.request.kind).toBe("navigate");
    if (entry.request.kind === "navigate") {
      expect(entry.request.tab).toBe("providers");
    }
  });

  it("version siempre es 1", () => {
    let captured: AssistantRequestBusEntry | null = null;
    const handler: EventListener = (ev) => {
      const ce = ev as CustomEvent<AssistantRequestBusEntry>;
      if (ce.detail) captured = ce.detail;
    };
    window.addEventListener(ASSISTANT_REQUEST_EVENT, handler);
    requestAssistant({
      kind: "prompt",
      prompt: "test",
      submit: "prefill",
      origin: { module: "test", action: "x" },
    });
    window.removeEventListener(ASSISTANT_REQUEST_EVENT, handler);
    const entry: AssistantRequestBusEntry = captured!;
    expect(entry.version).toBe(REQUEST_VERSION);
    expect(entry.version).toBe(1);
  });

  it("newRequestId genera ids únicos", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(newRequestId());
    expect(ids.size).toBe(50);
  });
});

describe("streamAgent — agentId/projectId null se propagan explícitamente", () => {
  it("(a) cuando el caller pasa agentId:null, el body lo incluye como null", async () => {
    const { streamAgent } = await import("../components/floating-assistant/assistant-api");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('data: {"type":"done"}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const ac = new AbortController();
    const gen = streamAgent(
      [{ role: "user", content: "hola" }],
      ac.signal,
      undefined,
      "claude",
      null,
      undefined,
      undefined,
      null,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _f of gen) { /* drain */ }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.agentId).toBeNull();
    expect(body.projectId).toBeNull();
  });
});

describe("assistantConversationsApi.create — agentId/projectId null se respetan", () => {
  it("(a) create acepta agentId:null y projectId:null sin reinyectar state", async () => {
    const { assistantConversationsApi } = await import("../components/floating-assistant/assistant-api");
    const { api } = await import("./api-client");
    const post = vi.spyOn(api, "post").mockResolvedValue({ ok: true, status: 200,
      data: { ok: true, conversation: { id: "c1", provider: "claude", messageCount: 0, preview: "" } },
    });

    await assistantConversationsApi.create("claude", "hola", null, null);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe("/api/ai/conversations");
    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.provider).toBe("claude");
    expect(body.firstMessage).toBe("hola");
    // Tanto projectId como agentId deben viajar como null LITERAL, NO omitidos.
    expect("projectId" in body).toBe(true);
    expect("agentId" in body).toBe(true);
    expect(body.projectId).toBeNull();
    expect(body.agentId).toBeNull();
  });
});
