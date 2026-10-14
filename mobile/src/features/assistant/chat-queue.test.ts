import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/client", () => ({
  luxAssistantProxy: vi.fn(async () => null),
  luxAssistantProxyOk: vi.fn(async () => true),
  streamServerAssistant: vi.fn(),
  getServerAssistantProviders: vi.fn(async () => null),
}));
vi.mock("./attachments", () => ({ deleteLocalFile: vi.fn(async () => {}), guessMime: vi.fn() }));
vi.mock("../../lib/chat-session-store", () => ({ saveChatSession: vi.fn(), loadChatSession: vi.fn() }));

import { streamServerAssistant, type AssistantEvent, type AssistantStreamResult } from "../../api/client";
import { resetAllStores } from "../../lib/store-reset";
import { chatController } from "./chat-controller";
import { chatStore } from "./chat-store";

const streamMock = vi.mocked(streamServerAssistant);
const panel = "queue-panel";
let turns: Array<{ emit: (event: AssistantEvent) => void; finish: (result: AssistantStreamResult) => void }>;

beforeEach(() => {
  vi.useFakeTimers();
  turns = [];
  streamMock.mockReset();
  streamMock.mockImplementation((_panel, _history, _token, emit) => new Promise((finish) => {
    turns.push({ emit, finish });
  }));
  chatController.configure(panel, { token: "test-token" });
  chatStore.patchSession(panel, { conversationId: "queued-chat" });
});

afterEach(() => {
  resetAllStores();
  vi.clearAllTimers();
  vi.useRealTimers();
});

async function startWithQueue() {
  const first = chatController.send(panel, { text: "uno" });
  expect(turns).toHaveLength(1);
  await chatController.send(panel, { text: "dos" });
  turns[0].emit({ type: "text", delta: "respuesta uno" });
  turns[0].finish({ ok: true });
  await first;
}

describe("continuidad de la cola móvil", () => {
  it.each(["api", "cli"])("publica el progreso de tres turnos %s sin recargar, incluso al volver a la pantalla", async (mode) => {
    const visible: string[] = [];
    const observe = () => {
      const last = chatStore.getChat(panel).messages.at(-1);
      visible.push(mode === "cli" ? last?.tools?.[0]?.output ?? "" : last?.content ?? "");
    };
    let unsubscribe = chatStore.subscribeChat(panel, observe);
    const first = chatController.send(panel, { text: "uno" });
    await chatController.send(panel, { text: "dos" });
    await chatController.send(panel, { text: "tres" });

    for (let i = 0; i < 3; i++) {
      expect(turns).toHaveLength(i + 1);
      expect(chatStore.getComposer(panel).busy).toBe(true);
      if (i === 1) unsubscribe(); // Pantalla oculta; el controller conserva el stream.
      if (mode === "cli") turns[i].emit({ type: "tool_use", id: `cli-${i}`, name: "codex.cli" });
      turns[i].emit({ type: "text", delta: `progreso ${i}` });
      if (i === 1) {
        unsubscribe = chatStore.subscribeChat(panel, observe);
        observe(); // useSyncExternalStore lee la instantánea al montar.
      }
      expect(visible).toContain(`progreso ${i}`);
      expect(chatStore.getChat(panel).messages.at(-1)?.pending).toBe(true);
      if (mode === "cli") {
        turns[i].emit({ type: "tool_result", id: `cli-${i}`, output: `respuesta ${i}`, success: true });
      }
      turns[i].emit({ type: "done" });
      turns[i].finish({ ok: true });
      if (i === 0) await first;
      await vi.advanceTimersByTimeAsync(1);
    }

    expect(streamMock.mock.calls.map((call) => call[1].at(-1)?.content)).toEqual(["uno", "dos", "tres"]);
    expect(streamMock.mock.calls.every((call) => call[4]?.conversationId === "queued-chat")).toBe(true);
    expect(chatStore.getChat(panel).messages).toHaveLength(6);
    expect(chatStore.getComposer(panel)).toMatchObject({ busy: false, queued: [] });
    unsubscribe();
  });

  it("conserva el borrador y los adjuntos al enviar el siguiente mensaje en cola", async () => {
    const first = chatController.send(panel, { text: "uno" });
    await chatController.send(panel, { text: "dos" });
    const attachments = [{ name: "borrador.txt", dataBase64: "YQ==", mime: "text/plain" }];
    chatStore.patchComposer(panel, { input: "todavía escribiendo" });
    chatStore.setAttachments(panel, attachments);
    turns[0].finish({ ok: true });
    await first;
    await vi.advanceTimersByTimeAsync(1);
    expect(streamMock.mock.calls[1][1].at(-1)?.content).toBe("dos");
    expect(streamMock.mock.calls[1][4]?.attachments).toBeUndefined();
    expect(chatStore.getComposer(panel).input).toBe("todavía escribiendo");
    expect(chatStore.getChat(panel).attachments).toEqual(attachments);
  });

  it("no sustituye el mensaje en cola por texto escrito durante el relevo", async () => {
    await startWithQueue();
    chatStore.patchComposer(panel, { input: "borrador nuevo" });
    await vi.advanceTimersByTimeAsync(1);
    expect(streamMock.mock.calls[1][1].at(-1)?.content).toBe("dos");
    expect(chatStore.getComposer(panel).input).toBe("borrador nuevo");
  });

  it.each(["stop", "thread", "logout"])("cancela el relevo pendiente tras %s", async (action) => {
    await startWithQueue();
    if (action === "stop") chatController.stopStream(panel);
    if (action === "thread") chatController.newConversation(panel);
    if (action === "logout") {
      resetAllStores();
      chatController.configure(panel, { token: "other-account" });
    }
    chatStore.patchComposer(panel, { input: "no enviar este borrador" });
    await vi.advanceTimersByTimeAsync(1);
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(chatStore.getComposer(panel).input).toBe("no enviar este borrador");
  });

  it("permite retirar el mensaje pendiente durante el relevo", async () => {
    await startWithQueue();
    chatController.removeQueued(panel, 0);
    await vi.advanceTimersByTimeAsync(1);
    expect(streamMock).toHaveBeenCalledTimes(1);
  });
});
