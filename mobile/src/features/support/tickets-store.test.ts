// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del store module-level de tickets de soporte (fase B4, dominio tickets).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/client", () => ({
  getTickets: vi.fn(),
}));
vi.mock("../../storage/portalDataCache", () => ({
  loadTicketsCache: vi.fn(),
  saveTicketsCache: vi.fn().mockResolvedValue(undefined),
}));

import { getTickets as fetchTickets } from "../../api/client";
import { loadTicketsCache, saveTicketsCache } from "../../storage/portalDataCache";
import type { Ticket } from "../../types/models";
import {
  __resetTicketsForTests,
  applyTicketCreated,
  applyTicketDeleted,
  applyTicketUpdated,
  getTickets,
  hydrateTicketsFromCache,
  refreshTickets,
  replaceTickets,
} from "./tickets-store";

const fetchMock = vi.mocked(fetchTickets);
const loadCacheMock = vi.mocked(loadTicketsCache);
const saveCacheMock = vi.mocked(saveTicketsCache);

const ticket = (id: string, extra: Partial<Ticket> = {}): Ticket =>
  ({ id, title: `t-${id}`, status: "open", priority: "medium", createdAt: "2026-07-13T00:00:00.000Z", ...extra }) as Ticket;

beforeEach(() => {
  __resetTicketsForTests();
  fetchMock.mockReset();
  loadCacheMock.mockReset();
  saveCacheMock.mockClear();
});

describe("hydrateTicketsFromCache", () => {
  it("siembra desde cache sin persistir de vuelta", async () => {
    loadCacheMock.mockResolvedValueOnce({ tickets: [ticket("a")] } as Awaited<ReturnType<typeof loadTicketsCache>>);
    await hydrateTicketsFromCache("u@x.com");
    expect(getTickets().map((x) => x.id)).toEqual(["a"]);
    expect(saveCacheMock).not.toHaveBeenCalled();
  });

  it("NO pisa datos frescos de un fetch/replace previo", async () => {
    replaceTickets("u@x.com", [ticket("fresh")]);
    loadCacheMock.mockResolvedValueOnce({ tickets: [ticket("stale")] } as Awaited<ReturnType<typeof loadTicketsCache>>);
    await hydrateTicketsFromCache("u@x.com");
    expect(getTickets().map((x) => x.id)).toEqual(["fresh"]);
  });
});

describe("refreshTickets", () => {
  it("marca busy, persiste el cache y devuelve las filas", async () => {
    fetchMock.mockResolvedValueOnce([ticket("a")]);
    const rows = await refreshTickets("tok", "u@x.com");
    expect(rows.map((x) => x.id)).toEqual(["a"]);
    expect(getTickets().map((x) => x.id)).toEqual(["a"]);
    expect(saveCacheMock).toHaveBeenCalledWith("u@x.com", rows);
  });

  it("propaga el error y apaga busy en finally", async () => {
    fetchMock.mockRejectedValueOnce(new Error("net"));
    await expect(refreshTickets("tok", "u@x.com")).rejects.toThrow("net");
    expect(getTickets()).toEqual([]);
  });
});

describe("mutadores locales", () => {
  it("created hace prepend y persiste", () => {
    replaceTickets("u@x.com", [ticket("a")]);
    applyTicketCreated("u@x.com", ticket("b"));
    expect(getTickets().map((x) => x.id)).toEqual(["b", "a"]);
    expect(saveCacheMock).toHaveBeenLastCalledWith("u@x.com", getTickets());
  });

  it("updated aplica el updater solo a la fila objetivo", () => {
    replaceTickets("u@x.com", [ticket("a", { messageCount: 1 }), ticket("b", { messageCount: 5 })]);
    applyTicketUpdated("u@x.com", "a", (x) => ({ ...x, messageCount: (x.messageCount ?? 0) + 1 }));
    expect(getTickets().find((x) => x.id === "a")?.messageCount).toBe(2);
    expect(getTickets().find((x) => x.id === "b")?.messageCount).toBe(5);
  });

  it("deleted quita la fila y persiste", () => {
    replaceTickets("u@x.com", [ticket("a"), ticket("b")]);
    applyTicketDeleted("u@x.com", "a");
    expect(getTickets().map((x) => x.id)).toEqual(["b"]);
  });
});
