// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del reset central de stores module-level en logout/cambio de cuenta:
// cada store por-usuario se auto-registra al cargarse y `resetAllStores()` los
// devuelve a su estado inicial, abortando además los streams del asistente en
// curso (higiene entre cuentas). API y nativo mockeados; los stores son reales.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ AppState: { currentState: "active" }, Platform: { OS: "ios", Version: 18 }, PermissionsAndroid: {} }));

vi.mock("../api/client", () => ({
  getSshKeys: vi.fn(async () => []),
  getTickets: vi.fn(async () => []),
  luxAssistantProxy: vi.fn(async () => null),
  streamServerAssistant: vi.fn(async () => ({ ok: true })),
  getServerAssistantProviders: vi.fn(async () => null),
}));
vi.mock("../storage/portalDataCache", () => ({
  loadTicketsCache: vi.fn(async () => null),
  saveTicketsCache: vi.fn(async () => undefined),
}));
vi.mock("./chat-session-store", () => ({
  loadChatSession: vi.fn(async () => null),
  saveChatSession: vi.fn(async () => undefined),
}));
vi.mock("../features/assistant/attachments", () => ({
  guessMime: vi.fn(() => "application/octet-stream"),
  pickDocuments: vi.fn(async () => []),
  readClipboardImage: vi.fn(async () => null),
}));

import { streamServerAssistant, type SshKeySummary } from "../api/client";
import type { Ticket } from "../types/models";
import { registerStoreReset, resetAllStores } from "./store-reset";
import { applySshKeyCreated, getSshKeys } from "../features/servers/ssh-keys-store";
import { getTickets, replaceTickets } from "../features/support/tickets-store";
import { chatStore } from "../features/assistant/chat-store";
import { chatController } from "../features/assistant/chat-controller";
import { getTabSessions, openNewTab } from "../navigation/tab-sessions-store";

const streamMock = vi.mocked(streamServerAssistant);

type StreamOpts = Parameters<typeof streamServerAssistant>[4];

const ticket = (id: string): Ticket =>
  ({ id, title: `t-${id}`, status: "open", priority: "medium", createdAt: "2026-07-13T00:00:00.000Z" }) as Ticket;

beforeEach(() => {
  // Dogfooding: el propio reset bajo test aísla los stores singleton entre tests.
  resetAllStores();
  streamMock.mockReset();
  streamMock.mockResolvedValue({ ok: true });
});

describe("registerStoreReset / resetAllStores", () => {
  it("ejecuta los resets registrados y la baja los quita", () => {
    const reset = vi.fn();
    const unregister = registerStoreReset(reset);
    resetAllStores();
    expect(reset).toHaveBeenCalledTimes(1);
    unregister();
    resetAllStores();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("un reset roto no impide la limpieza del resto", () => {
    const bye1 = registerStoreReset(() => { throw new Error("boom"); });
    const ok = vi.fn();
    const bye2 = registerStoreReset(ok);
    expect(() => resetAllStores()).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
    bye1();
    bye2();
  });
});

describe("logout → resetAllStores", () => {
  it("vacía los stores por-usuario poblados (llaves SSH, tickets, chat, pestañas)", () => {
    // Puebla ≥2 dominios como lo haría una sesión activa.
    applySshKeyCreated({ id: "k1", name: "deploy", panelIds: [] } as unknown as SshKeySummary);
    applySshKeyCreated({ id: "k2", name: "backup", panelIds: [] } as unknown as SshKeySummary);
    replaceTickets("saliente@x.com", [ticket("t1"), ticket("t2")]);
    chatStore.patchSession("panel-a", { conversationId: "c-priv", provider: "claude" });
    chatStore.setMessages("panel-a", [
      { role: "user", content: "dato sensible" },
      { role: "assistant", content: "respuesta privada", tools: [] },
    ]);
    openNewTab();
    expect(getSshKeys()).toHaveLength(2);
    expect(getTickets()).toHaveLength(2);
    expect(getTabSessions().tabs).toHaveLength(2);

    resetAllStores();

    expect(getSshKeys()).toEqual([]);
    expect(getTickets()).toEqual([]);
    expect(chatStore.getChat("panel-a").messages).toEqual([]);
    expect(chatStore.getSession("panel-a")).toMatchObject({ conversationId: null, provider: "", title: null });
    expect(chatStore.getComposer("panel-a")).toMatchObject({ started: false, busy: false, queued: [] });
    expect(getTabSessions()).toMatchObject({ activeTabId: "tab-1", hydrated: false });
    expect(getTabSessions().tabs).toHaveLength(1);
  });

  it("aborta el stream activo del asistente y mata el drenaje FIFO pendiente", async () => {
    const p = "panel-reset";
    chatController.configure(p, { token: "tok-saliente" });
    let aborted = false;
    streamMock.mockImplementation((_p, _m, _t, _e, opts: StreamOpts) =>
      new Promise((res) => { opts?.register?.(() => { aborted = true; res({ ok: true }); }); }));
    chatStore.patchComposer(p, { input: "trabaja" });
    const run = chatController.send(p);
    await vi.waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    // Run vivo + un turno encolado: el logout debe cortar ambos.
    chatStore.patchComposer(p, { input: "encolado" });
    await chatController.send(p);
    expect(chatStore.getComposer(p).queued).toEqual(["encolado"]);

    resetAllStores();

    expect(aborted).toBe(true);
    await run;
    await new Promise((res) => setTimeout(res, 10));
    // Ni el turno abortado revive ni la cola se despacha con la cuenta nueva.
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(chatStore.getChat(p).messages).toEqual([]);
    expect(chatStore.getComposer(p).queued).toEqual([]);
    expect(chatStore.getSession(p).conversationId).toBeNull();
  });
});
