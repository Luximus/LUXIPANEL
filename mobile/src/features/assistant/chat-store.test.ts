// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del store module-level del chat (fase A4): mutadores de alto nivel,
// derivaciones (tokens/título/started/background), dedup de emisiones y ciclo de
// vida de los ficheros temporales de los adjuntos.
import { afterEach, describe, expect, it, vi } from "vitest";

// El store borra los temporales con un import DIFERIDO de expo (no lo arrastra
// en su grafo): aquí se intercepta ese módulo.
const deleteAsync = vi.fn(async () => {});
vi.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  deleteAsync: (...a: unknown[]) => deleteAsync(...(a as [])),
}));

import { chatStore } from "./chat-store";
import { resetAllStores } from "../../lib/store-reset";
import type { ChatAttachment, ChatMsg } from "./types";

afterEach(() => { vi.useRealTimers(); });

/** Vacía la cola async del borrado (el store hace `import()` diferido de expo).
 *  Vuelve a timers reales: el import no lo destraba `advanceTimersByTime`. */
const flush = async () => { vi.useRealTimers(); await new Promise((r) => setTimeout(r, 20)); };

/** Adjunto del picker: lleva el fichero temporal del que se leyó. */
const picked = (name: string, mime: string, uri: string): ChatAttachment =>
  ({ name, mime, dataBase64: "QUJD", localUri: uri } as ChatAttachment);

// El store es un singleton de módulo: cada test usa un panelId propio.
let seq = 0;
const panel = () => `panel-store-${++seq}`;

describe("chatStore — dedup de emisiones", () => {
  it("no emite si el patch no cambia nada", () => {
    const p = panel();
    const listener = vi.fn();
    chatStore.subscribeSession(p, listener);
    chatStore.patchSession(p, { provider: "claude" });
    chatStore.patchSession(p, { provider: "claude" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("providers se compara por contenido, no por referencia", () => {
    const p = panel();
    const listener = vi.fn();
    chatStore.subscribeSession(p, listener);
    chatStore.patchSession(p, { providers: ["a", "b"] });
    chatStore.patchSession(p, { providers: ["a", "b"] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe deja de notificar", () => {
    const p = panel();
    const listener = vi.fn();
    const off = chatStore.subscribeComposer(p, listener);
    chatStore.patchComposer(p, { input: "x" });
    off();
    chatStore.patchComposer(p, { input: "y" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("chatStore — derivaciones de setMessages", () => {
  it("suma tokens/turnos del asistente y cuenta adjuntos (header)", () => {
    const p = panel();
    chatStore.setMessages(p, [
      { role: "user", content: "hola", attachmentName: "a.png" },
      { role: "assistant", content: "1", tokens: { input: 1, output: 2, total: 3 } },
      { role: "user", content: "sigue" },
      { role: "assistant", content: "2", tokens: { input: 2, output: 3, total: 5, estimated: true } },
    ]);
    const h = chatStore.getHeader(p);
    expect(h.tokensTotal).toBe(8);
    expect(h.assistantTurns).toBe(2);
    expect(h.tokensEstimated).toBe(true);
    expect(h.attachmentsCount).toBe(1);
  });

  it("deriva started (chat con mensajes cuenta como iniciado) y el título", () => {
    const p = panel();
    expect(chatStore.getComposer(p).started).toBe(false);
    chatStore.setMessages(p, [{ role: "user", content: "  título   del chat  " }]);
    expect(chatStore.getComposer(p).started).toBe(true);
    expect(chatStore.getSession(p).title).toBe("título del chat");
  });

  it("recorta el título a 48 caracteres y colapsa espacios", () => {
    const p = panel();
    chatStore.setMessages(p, [{ role: "user", content: `${"x".repeat(60)}` }]);
    expect(chatStore.getSession(p).title).toHaveLength(48);
  });

  it("acepta updater funcional y respeta la referencia intacta (sin emit)", () => {
    const p = panel();
    const msgs: ChatMsg[] = [{ role: "user", content: "a" }];
    chatStore.setMessages(p, msgs);
    const listener = vi.fn();
    chatStore.subscribeChat(p, listener);
    chatStore.setMessages(p, (prev) => prev); // misma referencia → no-op
    expect(listener).not.toHaveBeenCalled();
    chatStore.setMessages(p, (prev) => [...prev, { role: "assistant", content: "b" }]);
    expect(chatStore.getChat(p).messages).toHaveLength(2);
  });
});

describe("chatStore — setBusy y background", () => {
  it("propaga busy al composer y streaming/cronómetro al header", () => {
    const p = panel();
    chatStore.setBusy(p, true, 123);
    expect(chatStore.getComposer(p).busy).toBe(true);
    expect(chatStore.getHeader(p)).toMatchObject({ streaming: true, streamStartedAt: 123 });
    chatStore.setBusy(p, false, null);
    expect(chatStore.getHeader(p)).toMatchObject({ streaming: false, streamStartedAt: null });
  });

  it("backgroundRunning = hay turno interrumpido y NO se está streameando aquí", () => {
    const p = panel();
    chatStore.setMessages(p, [{ role: "assistant", content: "", interrupted: true }]);
    expect(chatStore.getHeader(p).backgroundRunning).toBe(true);
    chatStore.setBusy(p, true, Date.now());
    expect(chatStore.getHeader(p).backgroundRunning).toBe(false);
  });
});

describe("chatStore — adjuntos y portada", () => {
  it("publica nombres y previews (miniatura solo para imágenes)", () => {
    const p = panel();
    chatStore.setAttachments(p, [
      { name: "foto.png", dataBase64: "QUJD", mime: "image/png" },
      { name: "log.txt", dataBase64: "QUJD", mime: "text/plain" },
    ]);
    const c = chatStore.getComposer(p);
    expect(c.attachmentNames).toEqual(["foto.png", "log.txt"]);
    expect(c.attachments[0].previewUri).toBe("data:image/png;base64,QUJD");
    expect(c.attachments[1].previewUri).toBeUndefined();
  });

  it("setStarted(false) tras limpiar mensajes vuelve a portada y anula el título", () => {
    const p = panel();
    chatStore.setMessages(p, [{ role: "user", content: "hola" }]);
    expect(chatStore.getSession(p).title).toBe("hola");
    chatStore.setMessages(p, []);
    chatStore.setStarted(p, false);
    expect(chatStore.getComposer(p).started).toBe(false);
    expect(chatStore.getSession(p).title).toBeNull();
  });

  it("bumpScroll y bumpUsageKey incrementan las secuencias", () => {
    const p = panel();
    chatStore.bumpScroll(p);
    chatStore.bumpUsageKey(p);
    chatStore.bumpUsageKey(p);
    expect(chatStore.getChat(p).scrollSeq).toBe(1);
    expect(chatStore.getChat(p).usageRefreshKey).toBe(2);
  });
});

describe("chatStore — miniaturas y temporales de los adjuntos", () => {
  it("la miniatura de una imagen del picker es el FICHERO local, no el data-URI", () => {
    const p = panel();
    chatStore.setAttachments(p, [
      picked("foto.png", "image/png", "file:///cache/foto.png"),
      picked("log.txt", "text/plain", "file:///cache/log.txt"),
    ]);
    const c = chatStore.getComposer(p);
    // Un data-URI duplicaría hasta ~8M caracteres de base64 por imagen y forzaría
    // a decodificar el bitmap entero para una miniatura de 26×26.
    expect(c.attachments[0].previewUri).toBe("file:///cache/foto.png");
    expect(c.attachments[1].previewUri).toBeUndefined();
  });

  it("sin fichero local (portapapeles/conector) sigue el data-URI", () => {
    const p = panel();
    chatStore.setAttachments(p, [{ name: "pegada.png", dataBase64: "QUJD", mime: "image/png" }]);
    expect(chatStore.getComposer(p).attachments[0].previewUri).toBe("data:image/png;base64,QUJD");
  });

  it("teclear con adjuntos intactos NO re-emite (sameAttachments compara por identidad)", () => {
    const p = panel();
    chatStore.setAttachments(p, [picked("foto.png", "image/png", "file:///cache/foto.png")]);
    const listener = vi.fn();
    chatStore.subscribeComposer(p, listener);
    chatStore.patchComposer(p, { input: "h" });
    chatStore.patchComposer(p, { input: "h" }); // mismo input → dedup
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("borra el temporal del adjunto que sale del composer (tras la gracia)", async () => {
    deleteAsync.mockClear();
    vi.useFakeTimers();
    const p = panel();
    chatStore.setAttachments(p, [picked("foto.png", "image/png", "file:///cache/foto.png")]);
    chatStore.setAttachments(p, []); // enviado / quitado con la X
    expect(deleteAsync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(deleteAsync).toHaveBeenCalledWith("file:///cache/foto.png", { idempotent: true });
  });

  it("si el controller DEVUELVE el adjunto (envío rechazado) el borrado se cancela", async () => {
    deleteAsync.mockClear();
    vi.useFakeTimers();
    const p = panel();
    const att = picked("foto.png", "image/png", "file:///cache/restaurada.png");
    chatStore.setAttachments(p, [att]);
    chatStore.setAttachments(p, []);      // send() vacía el composer…
    chatStore.setAttachments(p, [att]);   // …y el gateway rechaza → se restaura
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(deleteAsync).not.toHaveBeenCalled();
    expect(chatStore.getComposer(p).attachments[0].previewUri).toBe("file:///cache/restaurada.png");
  });

  it("el logout borra los temporales aún preparados, sin esperar la gracia", async () => {
    deleteAsync.mockClear();
    const p = panel();
    chatStore.setAttachments(p, [picked("foto.png", "image/png", "file:///cache/logout.png")]);
    resetAllStores();
    await flush();
    expect(deleteAsync).toHaveBeenCalledWith("file:///cache/logout.png", { idempotent: true });
    expect(chatStore.getChat(p).attachments).toEqual([]);
  });
});
