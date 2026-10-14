// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests de la persistencia a disco del hilo de chat por panel y de su higiene
// de sesión: el store se auto-registra en `lib/store-reset` y el logout debe
// vaciar tanto la caché en memoria como la clave de AsyncStorage (los
// conversationId son datos del usuario saliente). Nativo mockeado; store real.
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => storage.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void storage.set(k, v)),
    removeItem: vi.fn(async (k: string) => void storage.delete(k)),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadChatSession, saveChatSession } from "./chat-session-store";
import { resetAllStores } from "./store-reset";

const KEY = "lp.app.chatSessions.v1";

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
  resetAllStores();
});

describe("chat-session-store", () => {
  it("persiste y recupera la sesión por panel", async () => {
    await saveChatSession("panel-a", { conversationId: "c-1", provider: "claude" });
    expect(await loadChatSession("panel-a")).toEqual({ conversationId: "c-1", provider: "claude" });
    expect(await loadChatSession("panel-otro")).toBeNull();
    expect(storage.has(KEY)).toBe(true);
  });

  it("logout → resetAllStores vacía la caché en memoria Y la clave de disco", async () => {
    await saveChatSession("panel-a", { conversationId: "c-priv", provider: "claude" });
    await saveChatSession("panel-b", { conversationId: "c-2", provider: "openai" });

    resetAllStores();

    // La caché en memoria queda vacía de inmediato (sin releer el disco viejo)…
    expect(await loadChatSession("panel-a")).toBeNull();
    expect(await loadChatSession("panel-b")).toBeNull();
    // …y el disco se borra (best-effort, pero aquí verificable).
    expect(vi.mocked(AsyncStorage.removeItem)).toHaveBeenCalledWith(KEY);
    await vi.waitFor(() => expect(storage.has(KEY)).toBe(false));
  });

  it("tras el reset, la cuenta entrante escribe desde cero sin residuo de la saliente", async () => {
    await saveChatSession("panel-a", { conversationId: "c-saliente", provider: "claude" });
    resetAllStores();
    await saveChatSession("panel-a", { conversationId: "c-entrante", provider: "gemini" });
    expect(await loadChatSession("panel-a")).toEqual({ conversationId: "c-entrante", provider: "gemini" });
    expect(JSON.parse(storage.get(KEY) ?? "{}")).toEqual({
      "panel-a": { conversationId: "c-entrante", provider: "gemini" },
    });
  });
});
