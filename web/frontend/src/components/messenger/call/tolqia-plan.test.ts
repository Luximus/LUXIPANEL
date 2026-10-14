// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — the Tolqia plan projection (the pure half of bloque F3-plan).
 *
 * Two behaviours are worth pinning down because they are invisible until they
 * break in production:
 *
 *  1. `fetchTolqiaPlan` asks the backend ONCE per page load (every consumer —
 *     the settings badge, the call overlay — shares one answer), and a failure
 *     degrades to "unlinked" instead of rejecting;
 *  2. `tolqiaReason` normalizes BOTH vocabularies into one: the backend error
 *     `code` (`TOLQIA_PLAN_INACTIVE`) and the room's `translation.reason`
 *     (`PLAN_LIMIT_TRANSLATION`) must land on the same localized sentence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ api: { get } }));

import {
  fetchTolqiaPlan,
  refreshTolqiaPlan,
  tolqiaReason,
  UNLINKED_PLAN,
  TOLQIA_CREDENTIALS_HREF,
  TOLQIA_PRICING_URL,
  type TolqiaPlan,
} from "./tolqia-plan";

const LINKED: TolqiaPlan = {
  configured: true,
  plan: "plus",
  status: "active",
  limits: { translationParticipants: 4, maxGroups: 10, maxMembers: 25 },
  translationAvailable: true,
};

beforeEach(() => {
  refreshTolqiaPlan();
  get.mockReset();
});

afterEach(() => {
  refreshTolqiaPlan();
});

describe("fetchTolqiaPlan", () => {
  it("pregunta al backend una sola vez y comparte la respuesta", async () => {
    get.mockResolvedValue({ ok: true, data: LINKED, status: 200 });

    const [a, b] = await Promise.all([fetchTolqiaPlan(), fetchTolqiaPlan()]);
    expect(a).toEqual(LINKED);
    expect(b).toBe(a);
    expect(await fetchTolqiaPlan()).toBe(a);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/api/chat/tolqia/plan");
  });

  it("refreshTolqiaPlan() vuelve a preguntar", async () => {
    get.mockResolvedValue({ ok: true, data: LINKED, status: 200 });
    await fetchTolqiaPlan();
    refreshTolqiaPlan();
    await fetchTolqiaPlan();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("un fallo del backend degrada a 'sin enlazar', nunca a un throw", async () => {
    get.mockResolvedValue({ ok: false, error: "boom", status: 500 });
    await expect(fetchTolqiaPlan()).resolves.toEqual(UNLINKED_PLAN);
  });

  it("una excepción de red también degrada a 'sin enlazar'", async () => {
    get.mockRejectedValue(new Error("offline"));
    await expect(fetchTolqiaPlan()).resolves.toEqual(UNLINKED_PLAN);
  });

  it("sin enlace no hay traducción disponible", () => {
    expect(UNLINKED_PLAN.configured).toBe(false);
    expect(UNLINKED_PLAN.translationAvailable).toBe(false);
  });
});

describe("tolqiaReason", () => {
  it("traduce los códigos de error del backend", () => {
    expect(tolqiaReason("TOLQIA_PLAN_INACTIVE")).toBe("PLAN_INACTIVE");
    expect(tolqiaReason("TOLQIA_PLAN_REQUIRED")).toBe("PLAN_REQUIRED");
    expect(tolqiaReason("TOLQIA_TOKEN_INVALID")).toBe("TOKEN_INVALID");
  });

  it("traduce los motivos que vienen en la sala", () => {
    expect(tolqiaReason("PLAN_LIMIT_TRANSLATION")).toBe("PLAN_LIMIT_TRANSLATION");
    expect(tolqiaReason("PLAN_INACTIVE")).toBe("PLAN_INACTIVE");
  });

  it("un motivo desconocido o ausente es null (el llamador usa su fallback)", () => {
    expect(tolqiaReason("SOMETHING_ELSE")).toBeNull();
    expect(tolqiaReason("")).toBeNull();
    expect(tolqiaReason(null)).toBeNull();
    expect(tolqiaReason(undefined)).toBeNull();
  });
});

describe("enlaces", () => {
  it("apuntan a las páginas públicas de Tolqia y al deep-link de credenciales", () => {
    expect(TOLQIA_PRICING_URL).toBe("https://tolqia.com/pricing");
    // `#cred-<id>` es el deep-link que resalta la tarjeta en Ajustes.
    expect(TOLQIA_CREDENTIALS_HREF).toBe("/panel/settings#cred-tolqia");
  });
});
