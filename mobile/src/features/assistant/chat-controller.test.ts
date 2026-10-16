vi.mock("./realtime-voice", () => ({ stopRealtimeVoice: vi.fn(async () => {}) }));
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del controller module-level del chat (fase A4, la crítica): envío con
// creación de conversación, cola FIFO, stop sin turno fantasma, recovery de
// runs desacoplados (stream caído / re-attach al abrir), editar-reenviar,
// permisos y restauración desde disco. API y nativo mockeados; el store es real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/client", () => ({
  luxAssistantProxy: vi.fn(async () => null),
  luxAssistantProxyOk: vi.fn(async () => true),
  streamServerAssistant: vi.fn(async () => ({ ok: true })),
  getServerAssistantProviders: vi.fn(async () => null),
}));
vi.mock("./attachments", () => ({
  guessMime: vi.fn(() => "application/octet-stream"),
  pickDocuments: vi.fn(async () => ({ attachments: [], oversize: false, failed: false })),
  readClipboardImage: vi.fn(async () => null),
}));
vi.mock("../../lib/chat-session-store", () => ({
  loadChatSession: vi.fn(async () => null),
  saveChatSession: vi.fn(async () => undefined),
}));

import {
  getServerAssistantProviders,
  luxAssistantProxy,
  luxAssistantProxyOk,
  streamServerAssistant,
  type AssistantEvent,
  type AssistantStreamResult,
} from "../../api/client";
import { loadChatSession, saveChatSession } from "../../lib/chat-session-store";
import { chatController } from "./chat-controller";
import { chatStore } from "./chat-store";
import { setVoiceInputLock } from "./input-lock";

const proxyMock = vi.mocked(luxAssistantProxy);
const proxyOkMock = vi.mocked(luxAssistantProxyOk);
const streamMock = vi.mocked(streamServerAssistant);
const providersMock = vi.mocked(getServerAssistantProviders);

// El store/controller son singletons de módulo: cada test usa un panelId propio.
let seq = 0;
function setupPanel(): string {
  const p = `panel-ctl-${++seq}`;
  chatController.configure(p, { token: "tok" });
  return p;
}

/** Enruta el proxy SSO por método+ruta (devuelve null para el resto). */
function mockProxy(handler: (method: string, path: string, body?: unknown) => unknown): void {
  proxyMock.mockImplementation(async (_panel, _token, method, path, body) =>
    (handler(method, path, body) ?? defaultConversationResponse(method, path)) as never);
}

type StreamOpts = Parameters<typeof streamServerAssistant>[4];

function defaultConversationResponse(method: string, path: string) {
  const match = /^\/api\/ai\/conversations\/([^/]+)$/.exec(path);
  return match && (method === "GET" || method === "PATCH") ? { conversation: { id: match[1], provider: "codex", approvalMode: "manual" } } : null;
}

beforeEach(() => {
  proxyMock.mockReset();
  proxyMock.mockImplementation(async (_p, _t, method, path) => defaultConversationResponse(method, path) as never);
  proxyOkMock.mockReset();
  proxyOkMock.mockResolvedValue(true);
  streamMock.mockReset();
  streamMock.mockResolvedValue({ ok: true });
  vi.mocked(saveChatSession).mockClear();
  vi.mocked(loadChatSession).mockReset();
  vi.mocked(loadChatSession).mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chatController.send", () => {
  it("al aprobar un plan envía la señal estructurada y cambia a modo automático", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-plan" });
    chatStore.patchComposer(p, { approvalMode: "plan" });
    expect(chatController.sendQuick(p, "Aprobar plan", { planDecision: "approve" })).toBe(true);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(streamMock.mock.calls[0]?.[4]).toMatchObject({ planDecision: "approve", approvalMode: "auto" });
    expect(chatStore.getComposer(p).approvalMode).toBe("auto");
  });
  it("crea la conversación, streamea deltas al store y asienta el turno", async () => {
    const p = setupPanel();
    mockProxy((method, path) =>
      method === "POST" && path === "/api/ai/conversations" ? { conversation: { id: "c1" } } : null);
    streamMock.mockImplementationOnce(async (_p, history, _t, onEvent) => {
      expect(history).toEqual([{ role: "user", content: "hola" }]);
      onEvent({ type: "text", delta: "ho" });
      onEvent({ type: "text", delta: "la" });
      return { ok: true };
    });
    chatStore.patchComposer(p, { input: "  hola  " });
    await chatController.send(p);
    const msgs = chatStore.getChat(p).messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: "user", content: "hola" });
    expect(msgs[1]).toMatchObject({ role: "assistant", content: "hola", pending: false });
    expect(msgs[1].durationMs).toBeGreaterThanOrEqual(0);
    expect(chatStore.getSession(p).conversationId).toBe("c1");
    expect(chatStore.getComposer(p)).toMatchObject({ busy: false, input: "" });
    expect(chatStore.getChat(p).usageRefreshKey).toBe(1);
    expect(saveChatSession).toHaveBeenCalledWith(p, { conversationId: "c1", provider: "" });
  });

  it("cierra la consola y permite reintentar cuando el agente termina sin respuesta final", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-no-final" });
    streamMock.mockImplementationOnce(async (_p, _history, _token, onEvent) => {
      onEvent({ type: "tool_use", id: "cli-1", name: "codex.cli" });
      onEvent({ type: "text", delta: "ERR_MODULE_NOT_FOUND" });
      onEvent({ type: "done" });
      return { ok: true };
    });
    chatStore.patchComposer(p, { input: "revisa el servidor" });
    await chatController.send(p);
    const reply = chatStore.getChat(p).messages.at(-1);
    expect(reply).toMatchObject({ pending: false, error: "NO_FINAL_RESPONSE", tools: [{ done: true, success: false }] });
    expect(chatStore.getComposer(p).busy).toBe(false);
    expect(chatController.sendQuick(p, "reintenta")).toBe(true);
  });

  it("conserva el turno cuando el stream informa un error explícito del agente", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-error" });
    streamMock.mockImplementationOnce(async (_p, _history, _token, onEvent) => {
      onEvent({ type: "error", message: "No se pudo cargar el módulo" });
      return { ok: false, code: "ERROR" };
    });
    chatStore.patchComposer(p, { input: "hola" });
    await chatController.send(p);
    expect(chatStore.getChat(p).messages).toMatchObject([
      { role: "user", content: "hola" },
      { role: "assistant", pending: false, error: "No se pudo cargar el módulo" },
    ]);
    expect(chatStore.getHeader(p).backgroundRunning).toBe(false);
  });

  it("run en curso: encola FIFO y despacha al terminar", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-fifo" });
    const histories: string[][] = [];
    let finishFirst!: (r: AssistantStreamResult) => void;
    streamMock.mockImplementationOnce((_p, history) => {
      histories.push(history.map((h) => h.content));
      return new Promise((res) => { finishFirst = res; });
    });
    streamMock.mockImplementationOnce(async (_p, history) => {
      histories.push(history.map((h) => h.content));
      return { ok: true };
    });
    chatStore.patchComposer(p, { input: "uno" });
    const first = chatController.send(p);
    await vi.waitFor(() => expect(histories).toHaveLength(1));
    // Con el run vivo, send() encola en vez de despachar.
    chatStore.patchComposer(p, { input: "dos" });
    await chatController.send(p);
    expect(chatStore.getComposer(p).queued).toEqual(["dos"]);
    finishFirst({ ok: true });
    await first;
    // El despacho FIFO sale por setTimeout(0).
    await vi.waitFor(() => expect(histories).toHaveLength(2));
    // Historia del 2.º turno: el par anterior asentado + el mensaje encolado.
    // El turno de asistente quedó VACÍO (el stream no emitió texto) y la
    // ventana saliente lo descarta (buildOutgoingHistory).
    expect(histories[1]).toEqual(["uno", "dos"]);
    expect(chatStore.getComposer(p).queued).toEqual([]);
  });

  it("mantiene la cola durante voz y la reanuda al cerrar todos los canales de audio", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-voice-fifo" });
    let finish!: (r: AssistantStreamResult) => void;
    streamMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    chatStore.patchComposer(p, { input: "primero" });
    const first = chatController.send(p);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    chatStore.patchComposer(p, { input: "segundo" });
    await chatController.send(p);
    chatStore.patchComposer(p, { input: "borrador separado" });
    setVoiceInputLock(p, "realtime", true);
    setVoiceInputLock(p, "note", true);
    finish({ ok: true });
    await first;
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(chatStore.getComposer(p).queued).toEqual(["segundo"]);
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(chatController.sendQuick(p, "texto rápido")).toBe(false);
    setVoiceInputLock(p, "note", false);
    expect(chatStore.getComposer(p).queued).toEqual(["segundo"]);
    setVoiceInputLock(p, "realtime", false);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2));
    expect(chatStore.getComposer(p).queued).toEqual([]);
    expect(chatStore.getComposer(p).input).toBe("borrador separado");
  });

  it("código de no-disponible: retira el turno no entregado, avisa y devuelve el texto al composer", async () => {
    const p = setupPanel();
    mockProxy((method, path) =>
      method === "POST" && path === "/api/ai/conversations" ? { conversation: { id: "c2" } } : null);
    streamMock.mockResolvedValueOnce({ ok: false, code: "NO_CREDENTIALS" });
    chatStore.patchComposer(p, { input: "hola" });
    await chatController.send(p);
    // El mensaje NO llegó al agente: no queda pintado como enviado, y el
    // borrador vuelve al composer para reintentar sin re-escribirlo.
    expect(chatStore.getChat(p).messages).toHaveLength(0);
    expect(chatStore.getChat(p).notice).toEqual({ kind: "unavailable" });
    expect(chatStore.getComposer(p).input).toBe("hola");
  });

  it("REJECTED del gateway: devuelve también los adjuntos preparados al composer", async () => {
    const p = setupPanel();
    mockProxy((method, path) =>
      method === "POST" && path === "/api/ai/conversations" ? { conversation: { id: "c-rej" } } : null);
    streamMock.mockResolvedValueOnce({ ok: false, code: "REJECTED" });
    chatStore.setAttachments(p, [{ name: "foto.png", dataBase64: "QUJD", mime: "image/png" }]);
    chatStore.patchComposer(p, { input: "mira esto" });
    await chatController.send(p);
    expect(chatStore.getChat(p).messages).toHaveLength(0);
    expect(chatStore.getChat(p).notice).toEqual({ kind: "error" });
    expect(chatStore.getComposer(p).input).toBe("mira esto");
    expect(chatStore.getChat(p).attachments).toEqual([{ name: "foto.png", dataBase64: "QUJD", mime: "image/png" }]);
  });

  it("abrir OTRO hilo durante un stream desliga el asentado del run viejo", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-old" });
    mockProxy((method, path) => {
      if (method === "GET" && path.startsWith("/api/ai/conversations/c-new/messages")) {
        return { items: [{ role: "user", textOriginal: "otro" }, { role: "assistant", textTranslated: "hilo" }] };
      }
      if (method === "GET" && path === "/api/ai/agent/active") return { runs: [] };
      return null;
    });
    let finish!: (r: AssistantStreamResult) => void;
    streamMock.mockImplementationOnce(() => new Promise((res) => { finish = res; }));
    chatStore.patchComposer(p, { input: "trabaja" });
    const run = chatController.send(p);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalled());
    // El usuario abre otro hilo con el run en curso.
    chatController.openConversation(p, "c-new");
    await vi.waitFor(() => expect(chatStore.getChat(p).messages).toHaveLength(2));
    // El run viejo asienta con error de transporte: NO debe tocar el hilo nuevo
    // (ni turno interrumpido, ni notice, ni borrar mensajes).
    finish({ ok: false, code: "ERROR" });
    await run;
    const msgs = chatStore.getChat(p).messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toMatchObject({ role: "assistant", content: "hilo" });
    expect(msgs.some((m) => m.interrupted)).toBe(false);
    expect(chatStore.getChat(p).notice).toBeNull();
    expect(chatStore.getComposer(p).busy).toBe(false);
  });

  it("el cierre tardío del hilo anterior no desbloquea el nuevo envío activo", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-old" });
    let finishOld!: (r: AssistantStreamResult) => void;
    let finishNew!: (r: AssistantStreamResult) => void;
    streamMock.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    streamMock.mockImplementationOnce(() => new Promise((resolve) => { finishNew = resolve; }));
    chatStore.patchComposer(p, { input: "primero" });
    const oldRun = chatController.send(p);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    chatController.newConversation(p);
    chatStore.patchComposer(p, { input: "segundo" });
    const newRun = chatController.send(p);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2));
    finishOld({ ok: false, code: "ERROR" });
    await oldRun;
    expect(chatStore.getComposer(p).busy).toBe(true);
    expect(chatStore.getChat(p).messages[0]).toMatchObject({ role: "user", content: "segundo" });
    finishNew({ ok: true });
    await newRun;
    expect(chatStore.getComposer(p).busy).toBe(false);
  });

  it("cambiar de hilo descarta los borradores del saliente (adjuntos + cola)", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-a" });
    chatStore.setAttachments(p, [{ name: "a.txt", dataBase64: "QQ==", mime: "text/plain" }]);
    chatStore.patchComposer(p, { queued: ["pendiente"] });
    mockProxy((method, path) => {
      if (method === "GET" && path.startsWith("/api/ai/conversations/c-b/messages")) {
        return { items: [{ role: "user", textOriginal: "hola" }, { role: "assistant", textTranslated: "listo" }] };
      }
      if (method === "GET" && path === "/api/ai/agent/active") return { runs: [] };
      return null;
    });
    chatController.openConversation(p, "c-b");
    expect(chatStore.getChat(p).attachments).toEqual([]);
    expect(chatStore.getComposer(p).queued).toEqual([]);
    await vi.waitFor(() => expect(chatStore.getChat(p).messages).toHaveLength(2));
  });

  it("cambiar de hilo MIENTRAS se crea la conversación no secuestra la sesión ni el hilo nuevo", async () => {
    const p = setupPanel();
    let releaseCreate!: () => void;
    mockProxy((method, path) => {
      if (method === "POST" && path === "/api/ai/conversations") return { conversation: { id: "c-nueva" } };
      if (method === "GET" && path.startsWith("/api/ai/conversations/c-otra/messages")) {
        return { items: [{ role: "user", textOriginal: "otro" }, { role: "assistant", textTranslated: "hilo" }] };
      }
      if (method === "GET" && path === "/api/ai/agent/active") return { runs: [] };
      return null;
    });
    // El POST de creación queda EN VUELO mientras el usuario abre otro hilo.
    const realProxy = proxyMock.getMockImplementation()!;
    proxyMock.mockImplementation(async (panel, token, method, path, body) => {
      if (method === "POST" && path === "/api/ai/conversations") {
        await new Promise<void>((res) => { releaseCreate = res; });
      }
      return realProxy(panel, token, method, path, body);
    });
    chatStore.patchComposer(p, { input: "hola" });
    const run = chatController.send(p);
    await vi.waitFor(() => expect(releaseCreate).toBeDefined());
    chatController.openConversation(p, "c-otra");
    await vi.waitFor(() => expect(chatStore.getChat(p).messages).toHaveLength(2));
    releaseCreate();
    await run;
    // La conversación creada NO se fija (la sesión sigue en el hilo abierto), no
    // se streamea el turno viejo y el transcript del hilo nuevo queda intacto.
    expect(chatStore.getSession(p).conversationId).toBe("c-otra");
    expect(streamMock).not.toHaveBeenCalled();
    expect(chatStore.getChat(p).messages.map((m) => m.content)).toEqual(["otro", "hilo"]);
    expect(chatStore.getComposer(p).busy).toBe(false);
  });

  it("stopStream durante la creación de la conversación corta el envío", async () => {
    const p = setupPanel();
    let releaseCreate!: () => void;
    proxyMock.mockImplementation(async (_panel, _token, method, path) => {
      if (method === "POST" && path === "/api/ai/conversations") {
        await new Promise<void>((res) => { releaseCreate = res; });
        return { conversation: { id: "c-stop-win" } } as never;
      }
      return null as never;
    });
    chatStore.patchComposer(p, { input: "hola" });
    const run = chatController.send(p);
    await vi.waitFor(() => expect(releaseCreate).toBeDefined());
    chatController.stopStream(p);
    releaseCreate();
    await run;
    expect(streamMock).not.toHaveBeenCalled();
    const msgs = chatStore.getChat(p).messages;
    expect(msgs[msgs.length - 1]).toMatchObject({ role: "assistant", pending: false, stopped: true });
    expect(chatStore.getComposer(p).busy).toBe(false);
  });

  it("stream caído con run desacoplado: turno interrumpido + recovery por sondeo", async () => {
    vi.useFakeTimers();
    const p = setupPanel();
    mockProxy((method, path) => {
      if (method === "POST" && path === "/api/ai/conversations") return { conversation: { id: "c9" } };
      if (method === "GET" && path.startsWith("/api/ai/conversations/c9/messages")) {
        return { items: [{ role: "user", textOriginal: "hola" }, { role: "assistant", textTranslated: "respuesta final" }] };
      }
      return null;
    });
    streamMock.mockResolvedValueOnce({ ok: false, code: "ERROR" });
    chatStore.patchComposer(p, { input: "hola" });
    await chatController.send(p);
    let msgs = chatStore.getChat(p).messages;
    expect(msgs[1]).toMatchObject({ role: "assistant", interrupted: true });
    expect(chatStore.getHeader(p).backgroundRunning).toBe(true);
    // 1er sondeo (3s): la respuesta ya está persistida → reemplaza el hilo.
    await vi.advanceTimersByTimeAsync(3100);
    msgs = chatStore.getChat(p).messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toMatchObject({ role: "assistant", content: "respuesta final" });
    expect(msgs[1].interrupted).toBeUndefined();
  });
});

describe("chatController.recoverInterruptedTurn", () => {
  /** Hilo con el turno "interrumpido" a la vista y sin respuesta persistida. */
  function interruptedThread(convId: string): string {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: convId });
    chatStore.setMessages(p, [
      { role: "user", content: "haz algo" },
      { role: "assistant", content: "", interrupted: true, tools: [] },
    ]);
    return p;
  }

  it("agotado el sondeo deja el turno en estado terminal (no 'en el servidor' eterno)", async () => {
    vi.useFakeTimers();
    const p = interruptedThread("c-timeout");
    mockProxy((method, path) =>
      method === "GET" && path.startsWith("/api/ai/conversations/c-timeout/messages")
        ? { items: [{ role: "user", textOriginal: "haz algo" }] }
        : null);
    const done = chatController.recoverInterruptedTurn(p, "c-timeout");
    expect(chatStore.getHeader(p).backgroundRunning).toBe(true);
    await vi.advanceTimersByTimeAsync(20 * 3100);
    await done;
    const msgs = chatStore.getChat(p).messages;
    expect(msgs[1].interrupted).toBeUndefined();
    expect(msgs[1]).toMatchObject({ role: "assistant", stopped: true });
    expect(chatStore.getChat(p).notice).toEqual({ kind: "error" });
    expect(chatStore.getHeader(p).backgroundRunning).toBe(false);
  });

  it("no duplica el bucle de sondeo sobre la misma conversación", async () => {
    vi.useFakeTimers();
    const p = interruptedThread("c-dup");
    let polls = 0;
    mockProxy((method, path) => {
      if (method === "GET" && path.startsWith("/api/ai/conversations/c-dup/messages")) {
        polls++;
        return { items: [{ role: "user", textOriginal: "haz algo" }] };
      }
      return null;
    });
    const first = chatController.recoverInterruptedTurn(p, "c-dup");
    // Reabrir el hilo / compactar relanzaba un segundo sondeo sobre lo mismo.
    const second = chatController.recoverInterruptedTurn(p, "c-dup");
    await vi.advanceTimersByTimeAsync(3100);
    expect(polls).toBe(1);
    await second;
    await vi.advanceTimersByTimeAsync(20 * 3100);
    await first;
  });
});

describe("chatController.stopStream", () => {
  it("aborta el XHR, marca stopped sin turno fantasma y postea agent/stop", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-stop" });
    const proxyCalls: Array<[string, string]> = [];
    mockProxy((method, path) => { proxyCalls.push([method, path]); return null; });
    let aborted = false;
    streamMock.mockImplementationOnce((_p, _m, _t, _e, opts: StreamOpts) =>
      new Promise((res) => { opts?.register?.(() => { aborted = true; res({ ok: true }); }); }));
    chatStore.patchComposer(p, { input: "trabaja" });
    const run = chatController.send(p);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalled());
    chatController.stopStream(p);
    expect(aborted).toBe(true);
    await run;
    const msgs = chatStore.getChat(p).messages;
    expect(msgs[1]).toMatchObject({ role: "assistant", stopped: true, pending: false });
    expect(proxyCalls).toContainEqual(["POST", "/api/ai/agent/stop"]);
    expect(chatStore.getComposer(p).busy).toBe(false);
  });

  it("stop descarta la cola FIFO pendiente: ningún turno encolado se despacha", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-stop-fifo" });
    let streamCalls = 0;
    streamMock.mockImplementation((_p, _m, _t, _e, opts: StreamOpts) => {
      streamCalls++;
      return new Promise((res) => { opts?.register?.(() => res({ ok: true })); });
    });
    chatStore.patchComposer(p, { input: "uno" });
    const first = chatController.send(p);
    await vi.waitFor(() => expect(streamCalls).toBe(1));
    // Run vivo: los dos envíos siguientes quedan encolados (FIFO).
    chatStore.patchComposer(p, { input: "dos" });
    await chatController.send(p);
    chatStore.patchComposer(p, { input: "tres" });
    await chatController.send(p);
    expect(chatStore.getComposer(p).queued).toEqual(["dos", "tres"]);
    // Stop = parar TODO: aborta el turno activo Y vacía la cola.
    chatController.stopStream(p);
    expect(chatStore.getComposer(p).queued).toEqual([]);
    await first;
    // El drenaje FIFO saldría por setTimeout(0): margen y cero streams nuevos.
    await new Promise((res) => setTimeout(res, 10));
    expect(streamCalls).toBe(1);
    expect(chatStore.getComposer(p).busy).toBe(false);
    const msgs = chatStore.getChat(p).messages;
    expect(msgs[msgs.length - 1]).toMatchObject({ role: "assistant", stopped: true, pending: false });
  });
});

describe("chatController.editMessage", () => {
  it("descarta el par parado y reenvía solo el mensaje editado", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-edit" });
    chatStore.setMessages(p, [
      { role: "user", content: "malo" },
      { role: "assistant", content: "", pending: true, tools: [] },
    ]);
    const histories: string[][] = [];
    streamMock.mockImplementationOnce(async (_p, history) => {
      histories.push(history.map((h) => h.content));
      return { ok: true };
    });
    chatController.editMessage(p, "bueno");
    expect(chatStore.getComposer(p).input).toBe("bueno");
    await chatController.send(p);
    expect(histories[0]).toEqual(["bueno"]);
    expect(chatStore.getChat(p).messages.map((m) => m.content)).toEqual(["bueno", ""]);
  });
});

describe("chatController.decidePermission", () => {
  const gatedTurn = (id: string) => [
    { role: "assistant" as const, content: "", pending: true, permission: { id, tool: "Bash", title: "Ejecutar" } },
  ];

  it("limpia el gate de forma optimista y postea la decisión", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-perm" });
    chatStore.setMessages(p, gatedTurn("req1"));
    chatController.decidePermission(p, "req1", "allow", "Bash");
    expect(chatStore.getChat(p).messages[0].permission).toBeNull();
    await vi.waitFor(() => expect(proxyOkMock).toHaveBeenCalledTimes(1));
    expect(proxyOkMock).toHaveBeenCalledWith(p, "tok", "POST", "/api/ai/agent/permission",
      { conversationId: "c-perm", requestId: "req1", decision: "allow", tool: "Bash" });
    expect(chatStore.getChat(p).notice).toBeNull();
  });

  it("si la decisión NO viaja, restaura el gate y avisa (reintentable)", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-perm-ko" });
    chatStore.setMessages(p, gatedTurn("req2"));
    proxyOkMock.mockResolvedValueOnce(false);
    chatController.decidePermission(p, "req2", "deny");
    // Optimista: el gate desaparece…
    expect(chatStore.getChat(p).messages[0].permission).toBeNull();
    // …pero el gateway rechazó la decisión → vuelven los botones + aviso de error.
    await vi.waitFor(() => expect(chatStore.getChat(p).messages[0].permission).toEqual(
      { id: "req2", tool: "Bash", title: "Ejecutar" }));
    expect(chatStore.getChat(p).notice).toEqual({ kind: "error" });
  });

  it("sin conversación activa no limpia el gate ni postea nada", async () => {
    const p = setupPanel();
    chatStore.setMessages(p, gatedTurn("req3"));
    chatController.decidePermission(p, "req3", "allow");
    expect(chatStore.getChat(p).messages[0].permission).toMatchObject({ id: "req3" });
    expect(chatStore.getChat(p).notice).toEqual({ kind: "error" });
    expect(proxyOkMock).not.toHaveBeenCalled();
  });
});

describe("chatController.retryLast", () => {
  it("reenvía el último mensaje sin duplicar la burbuja de usuario", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-retry" });
    chatStore.setMessages(p, [
      { role: "user", content: "primero" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "falla" },
      { role: "assistant", content: "", error: "boom", tools: [] },
    ]);
    const histories: string[][] = [];
    streamMock.mockImplementationOnce(async (_p, history) => {
      histories.push(history.map((h) => h.content));
      return { ok: true };
    });
    chatController.retryLast(p);
    await vi.waitFor(() => expect(histories).toHaveLength(1));
    // El par errado se poda: ni turno duplicado en el transcript…
    const msgs = chatStore.getChat(p).messages;
    expect(msgs.map((m) => [m.role, m.content])).toEqual([
      ["user", "primero"], ["assistant", "ok"], ["user", "falla"], ["assistant", ""],
    ]);
    // …ni dos mensajes de usuario idénticos seguidos en el historial saliente.
    expect(histories[0]).toEqual(["primero", "ok", "falla"]);
    // El reintento no toca el borrador del composer.
    expect(chatStore.getComposer(p).input).toBe("");
  });

  it("no consume los adjuntos preparados ni pisa el borrador (envío rápido)", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-quick" });
    chatStore.setAttachments(p, [{ name: "a.png", dataBase64: "QQ==", mime: "image/png" }]);
    chatStore.patchComposer(p, { input: "borrador" });
    let sentAtts: unknown;
    streamMock.mockImplementationOnce(async (_p, _h, _t, _e, opts: StreamOpts) => {
      sentAtts = opts?.attachments;
      return { ok: true };
    });
    expect(chatController.sendQuick(p, "opción A")).toBe(true);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalled());
    expect(sentAtts).toBeUndefined();
    expect(chatStore.getChat(p).attachments).toHaveLength(1);
    expect(chatStore.getComposer(p).input).toBe("borrador");
    expect(chatStore.getChat(p).messages[0]).toMatchObject({ role: "user", content: "opción A" });
  });

  it("con el panel bloqueado (SSH caído) no despacha nada", () => {
    const p = setupPanel();
    chatStore.patchComposer(p, { blocked: true, input: "hola" });
    expect(chatController.sendQuick(p, "x")).toBe(false);
    void chatController.send(p);
    expect(streamMock).not.toHaveBeenCalled();
    expect(chatStore.getChat(p).messages).toHaveLength(0);
  });
});

describe("chatController.setProvider", () => {
  it("el cambio de proveedor conserva la conversación y sus mensajes", () => {
    const p = setupPanel();
    chatController.setProvider(p, "claude"); // inicial (prev "")
    chatStore.patchSession(p, { conversationId: "c-prov" });
    chatStore.setMessages(p, [{ role: "user", content: "hola" }]);
    chatController.setProvider(p, "claude"); // sin cambio → no-op
    expect(chatStore.getChat(p).messages).toHaveLength(1);
    chatController.setProvider(p, "gemini"); // continúa en el mismo chat
    expect(chatStore.getSession(p).conversationId).toBe("c-prov");
    expect(chatStore.getChat(p).messages).toHaveLength(1);
  });
});

describe("chatController.openConversation", () => {
  it("ignora un fallo tardío de una apertura anterior del mismo hilo", async () => {
    const p = setupPanel();
    const pending: Array<(value: unknown) => void> = [];
    proxyMock.mockImplementation((_panel, _token, method, path) => {
      if (method === "GET" && path.startsWith("/api/ai/conversations/c-race/messages"))
        return new Promise((resolve) => { pending.push(resolve); }) as never;
      return Promise.resolve(defaultConversationResponse(method, path) ?? { runs: [] }) as never;
    });
    chatController.openConversation(p, "c-race");
    chatController.openConversation(p, "c-race");
    expect(pending).toHaveLength(2);
    pending[1]({ items: [{ role: "user", content: "reciente" }] });
    await vi.waitFor(() => expect(chatStore.getChat(p).messages[0]?.content).toBe("reciente"));
    pending[0](null);
    await Promise.resolve();
    expect(chatStore.getChat(p).messages[0]?.content).toBe("reciente");
    expect(chatStore.getChat(p).notice).toBeNull();
  });

  it("re-adjunta a un run vivo (agent/active) y recupera la respuesta al asentar", async () => {
    vi.useFakeTimers();
    const p = setupPanel();
    let phase = 0;
    mockProxy((method, path) => {
      if (method === "GET" && path.startsWith("/api/ai/conversations/c7/messages")) {
        return phase === 0
          ? { items: [{ role: "user", textOriginal: "haz algo" }] }
          : { items: [{ role: "user", textOriginal: "haz algo" }, { role: "assistant", textTranslated: "hecho" }] };
      }
      if (method === "GET" && path === "/api/ai/agent/active") return { runs: [{ id: "c7" }] };
      return null;
    });
    chatStore.patchSession(p, { agentId: "agente-x", agentName: "Agente X" });
    chatController.openConversation(p, "c7");
    // Skeleton inmediato + abrir un hilo desliga el agente recién elegido.
    expect(chatStore.getChat(p).messages[0]).toMatchObject({ role: "assistant", pending: true });
    expect(chatStore.getSession(p)).toMatchObject({ agentId: null, agentName: null, conversationId: "c7" });
    expect(chatStore.getComposer(p).started).toBe(true);
    // Cargan los mensajes + el check de runs vivos → turno "en el servidor".
    await vi.advanceTimersByTimeAsync(1);
    let msgs = chatStore.getChat(p).messages;
    expect(msgs[msgs.length - 1]).toMatchObject({ role: "assistant", interrupted: true });
    // El run termina y persiste su respuesta → el sondeo la trae.
    phase = 1;
    await vi.advanceTimersByTimeAsync(3100);
    msgs = chatStore.getChat(p).messages;
    expect(msgs[msgs.length - 1]).toMatchObject({ role: "assistant", content: "hecho" });
  });

  it("sin run vivo no añade turno interrumpido", async () => {
    const p = setupPanel();
    chatStore.patchChat(p, { notice: { kind: "error" } });
    mockProxy((method, path) => {
      if (method === "GET" && path.startsWith("/api/ai/conversations/c8/messages")) {
        return { items: [{ role: "user", textOriginal: "hola" }, { role: "assistant", textTranslated: "listo" }] };
      }
      if (method === "GET" && path === "/api/ai/agent/active") return { runs: [] };
      return null;
    });
    chatController.openConversation(p, "c8");
    expect(chatStore.getChat(p).notice).toBeNull();
    await vi.waitFor(() => expect(chatStore.getChat(p).messages).toHaveLength(2));
    expect(chatStore.getChat(p).messages[1]).toMatchObject({ role: "assistant", content: "listo" });
    expect(chatStore.getChat(p).notice).toBeNull();
  });
});

describe("chatController — cola explícita y portada", () => {
  it("queueCurrent/editQueued/removeQueued gestionan los chips", () => {
    const p = setupPanel();
    chatStore.patchComposer(p, { input: "primero" });
    chatController.queueCurrent(p);
    chatStore.patchComposer(p, { input: "segundo" });
    chatController.queueCurrent(p);
    expect(chatStore.getComposer(p).queued).toEqual(["primero", "segundo"]);
    chatController.editQueued(p, 0);
    expect(chatStore.getComposer(p)).toMatchObject({ input: "primero", queued: ["segundo"] });
    chatController.removeQueued(p, 0);
    expect(chatStore.getComposer(p).queued).toEqual([]);
  });

  it("coverConversation limpia el hilo y vuelve a portada", () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "c-cover" });
    chatStore.setMessages(p, [{ role: "user", content: "hola" }]);
    chatController.coverConversation(p);
    expect(chatStore.getSession(p).conversationId).toBeNull();
    expect(chatStore.getChat(p).messages).toEqual([]);
    expect(chatStore.getComposer(p).started).toBe(false);
    expect(chatStore.getSession(p).title).toBeNull();
  });
});

describe("chatController.ensureDiskRestore", () => {
  it("reabre el hilo persistido (proveedor incluido) una sola vez por proceso", async () => {
    const p = `panel-ctl-${++seq}`;
    vi.mocked(loadChatSession).mockResolvedValueOnce({ conversationId: "c-disk", provider: "gemini" });
    mockProxy((method, path) =>
      method === "GET" && path.startsWith("/api/ai/conversations/c-disk/messages")
        ? { items: [{ role: "user", textOriginal: "restaurado" }, { role: "assistant", textTranslated: "ok" }] }
        : null);
    chatController.configure(p, { token: "tok" });
    chatController.ensureDiskRestore(p);
    await vi.waitFor(() => expect(chatStore.getSession(p).conversationId).toBe("c-disk"));
    expect(chatStore.getSession(p).provider).toBe("codex");
    expect(chatStore.getComposer(p).started).toBe(true);
    await vi.waitFor(() => expect(chatStore.getChat(p).messages).toHaveLength(2));
    // Segunda llamada: ya intentado → no vuelve a leer disco.
    vi.mocked(loadChatSession).mockClear();
    chatController.ensureDiskRestore(p);
    expect(loadChatSession).not.toHaveBeenCalled();
  });
});

describe("chatController.loadProviders", () => {
  it("publica la lista y fija el preferido (default de config primero)", async () => {
    const p = setupPanel();
    providersMock.mockResolvedValueOnce({ providers: ["claude", "gemini"], activeProvider: "gemini" } as never);
    mockProxy((method, path) =>
      method === "GET" && path === "/api/ai/config" ? { config: { defaultChatProvider: "claude" } } : null);
    chatController.loadProviders(p);
    await vi.waitFor(() => expect(chatStore.getSession(p).provider).toBe("claude"));
    expect(chatStore.getSession(p).providers).toEqual(["claude", "gemini"]);
    // Idempotente: una sola carga por panel.
    chatController.loadProviders(p);
    expect(providersMock).toHaveBeenCalledTimes(1);
  });

  it("un fallo transitorio NO deja el panel sin proveedores: se reintenta", async () => {
    const p = setupPanel();
    providersMock.mockClear();
    providersMock.mockResolvedValueOnce(null as never);
    chatController.loadProviders(p);
    await new Promise((res) => setTimeout(res, 0));
    expect(providersMock).toHaveBeenCalledTimes(1);
    expect(chatStore.getSession(p).providers).toEqual([]);
    // El cerrojo se revirtió → el siguiente montaje del chat vuelve a intentarlo.
    providersMock.mockResolvedValueOnce({ providers: ["claude"], activeProvider: "claude" } as never);
    chatController.loadProviders(p);
    await vi.waitFor(() => expect(chatStore.getSession(p).providers).toEqual(["claude"]));
    expect(providersMock).toHaveBeenCalledTimes(2);
  });
});

describe("opciones propias de cada conversación", () => {
  it("restaura proveedor, modelo, esfuerzo, aprobación y proyecto al cambiar de chat", async () => {
    const p = setupPanel();
    const metas = {
      a: { id: "a", provider: "codex", model: "model-a", effort: "high", approvalMode: "plan", projectId: "pa" },
      b: { id: "b", provider: "claude", model: "model-b", effort: "low", approvalMode: "manual", projectId: null },
    };
    mockProxy((method, path) => {
      if (path.endsWith("/messages?limit=200&offset=0")) return { items: [] };
      if (path.includes("/messages")) return { items: [{ role: "assistant", content: "ok" }] };
      const id = path.split("/").at(-1) as keyof typeof metas;
      if (method === "GET" && metas[id]) return { conversation: metas[id] };
      return null;
    });
    chatController.openConversation(p, "a");
    await vi.waitFor(() => expect(chatStore.getComposer(p).approvalMode).toBe("plan"));
    expect(chatStore.getSession(p)).toMatchObject({ provider: "codex", model: "model-a", effort: "high", projectId: "pa" });
    chatController.openConversation(p, "b");
    await vi.waitFor(() => expect(chatStore.getSession(p).model).toBe("model-b"));
    expect(chatStore.getSession(p)).toMatchObject({ provider: "claude", effort: "low", projectId: null });
    expect(chatStore.getComposer(p).approvalMode).toBe("manual");
    chatController.newConversation(p);
    expect(chatStore.getSession(p)).toMatchObject({ model: "", projectId: null });
    expect(chatStore.getComposer(p).approvalMode).toBe("manual");
  });

  it("un cambio del selector solo escribe en el chat capturado", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "a", provider: "codex" });
    await chatController.setOptions(p, { model: "ma", approvalMode: "plan" });
    expect(proxyMock).toHaveBeenCalledWith(p, "tok", "PATCH", "/api/ai/conversations/a", { model: "ma", approvalMode: "plan" });
    expect(proxyMock.mock.calls.some(c => c[3] === "/api/ai/config")).toBe(false);
  });

  it("espera un guardado pendiente al volver rápidamente al mismo chat", async () => {
    const p = setupPanel();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let model = "anterior";
    proxyMock.mockImplementation(async (_panel, _token, method, path, body) => {
      if (method === "PATCH") {
        await pending;
        model = (body as { model: string }).model;
        return { conversation: { id: "a", model } } as never;
      }
      if (path.includes("/messages")) return { items: [{ role: "assistant", content: "ok" }] } as never;
      return { conversation: { id: path.split("/").at(-1), provider: "codex", model, approvalMode: "manual" } } as never;
    });
    chatStore.patchSession(p, { conversationId: "a", provider: "codex" });
    const write = chatController.setOptions(p, { model: "guardado" });
    await Promise.resolve();
    chatController.openConversation(p, "b");
    chatController.openConversation(p, "a");
    await Promise.resolve();
    expect(proxyMock.mock.calls.some(c => c[2] === "GET" && c[3] === "/api/ai/conversations/a")).toBe(false);
    release(); await write;
    await vi.waitFor(() => expect(chatStore.getSession(p).model).toBe("guardado"));
  });

  it("un fallo al guardar las opciones impide enviar con otra política", async () => {
    const p = setupPanel(); chatStore.patchSession(p, { conversationId: "a" });
    proxyMock.mockResolvedValue(null);
    expect(await chatController.setOptions(p, { approvalMode: "auto" })).toBe(false);
    await chatController.send(p, { text: "hazlo" });
    expect(streamMock).not.toHaveBeenCalled();
    expect(chatStore.getChat(p).notice).toEqual({ kind: "error" });
  });
});


describe("automatic MCP recovery", () => {
  it("repairs a real stream error without a user action or an initial banner", async () => {
    const p = setupPanel();
    chatStore.patchSession(p, { conversationId: "mcp-auto", provider: "codex" });
    mockProxy((method, path) => method === "POST" && path === "/api/ai/mcp/repair" ? { ok: true } : null);
    streamMock.mockImplementationOnce(async (_p, _h, _t, onEvent) => {
      onEvent({ type: "text", delta: JSON.stringify({ type: "item.completed", item: { type: "mcp_tool_call", error: { message: "[MCP_SESSION_EXPIRED]" } } }) + "\n" });
      expect(chatStore.getComposer(p).mcpExpired).toBe(false);
      onEvent({ type: "text", delta: "continuing" }); return { ok: true };
    });
    chatStore.patchComposer(p, { input: "test" }); await chatController.send(p);
    await vi.waitFor(() => expect(proxyMock.mock.calls.some(c => c[3] === "/api/ai/mcp/repair")).toBe(true));
    expect(proxyMock.mock.calls.filter(c => c[3] === "/api/ai/mcp/repair")).toHaveLength(1);
    expect(chatStore.getComposer(p).mcpExpired).toBe(false);
  });
});
