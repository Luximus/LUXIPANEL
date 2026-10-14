import { afterEach, expect, it, vi } from "vitest";

const target = { baseUrl: "https://panel.example", jwt: "session", csrf: null };
vi.mock("./serverApi", () => ({
  getDirect: () => target,
  invalidateServerCache: vi.fn(),
}));

import { streamDirectAgent } from "./directAgent";

class Xhr {
  static sent: Xhr[] = [];
  status = 400;
  responseText = JSON.stringify({ ok: false, error: "Parámetros inválidos" });
  onload?: () => void;
  onerror?: () => void;
  onprogress?: () => void;
  onabort?: () => void;
  body = "";
  open() {}
  setRequestHeader() {}
  getResponseHeader(): string | null { return "application/json"; }
  abort() {}
  send(body: string) {
    this.body = body;
    Xhr.sent.push(this);
    queueMicrotask(() => this.onload?.());
  }
}

afterEach(() => {
  Xhr.sent = [];
  vi.unstubAllGlobals();
});

it("termina un stream sin actividad y libera el estado de envío", async () => {
  vi.useFakeTimers();
  class HangingXhr extends Xhr {
    override send(body: string) { this.body = body; HangingXhr.sent.push(this); }
    override abort() { this.onabort?.(); }
  }
  vi.stubGlobal("XMLHttpRequest", HangingXhr);
  const result = streamDirectAgent("box", { messages: [{ role: "user", content: "hola" }] }, () => {});
  await vi.advanceTimersByTimeAsync(180_000);
  expect(await result).toEqual({ ok: false, error: "La conexión con el agente dejó de responder." });
  vi.useRealTimers();
});

it("actualiza el chat al primer progreso aunque RN aún no exponga Content-Type", async () => {
  class ProgressiveXhr extends Xhr {
    status = 200;
    responseText = "";
    override getResponseHeader() { return null; }
    override send(body: string) {
      this.body = body;
      queueMicrotask(() => {
        this.responseText = 'data: {"type":"text","delta":"hola"}\n\n';
        this.onprogress?.();
        this.responseText += 'data: {"type":"done"}\n\n';
        this.onload?.();
      });
    }
  }
  vi.stubGlobal("XMLHttpRequest", ProgressiveXhr);
  const events: string[] = [];
  expect(await streamDirectAgent("box", { messages: [{ role: "user", content: "hola" }] }, event => events.push(event.type))).toEqual({ ok: true });
  expect(events).toEqual(["text", "done"]);
});

it("sends the MIME field expected by the panel and reports a rejected request", async () => {
  vi.stubGlobal("XMLHttpRequest", Xhr);
  const result = await streamDirectAgent("box", {
    messages: [{ role: "user", content: "Revisa esta imagen" }],
    attachments: [{ name: "imagen.jpg", dataBase64: "YQ==", mime: "image/jpeg" }],
  }, () => {});
  expect(JSON.parse(Xhr.sent[0]!.body).attachments).toEqual([
    { name: "imagen.jpg", dataBase64: "YQ==", mimeType: "image/jpeg" },
  ]);
  expect(result).toEqual({ ok: false, error: "Parámetros inválidos", code: "REJECTED" });
});
