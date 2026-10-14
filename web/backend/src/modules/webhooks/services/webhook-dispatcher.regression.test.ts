// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SECURITY REGRESSION — webhooks/services/webhook-dispatcher.service.ts
 *
 * Guards the crash-the-backend fix: `dispatch()` is fire-and-forget and runs
 * `runOnPanelHost(...).catch(...)`. A failing lookup, a hostile endpoint, or a
 * failing repository write must NEVER surface as an unhandled rejection — the
 * top-level handler in server.ts would terminate the process. These tests fail
 * if the `.catch()` / inner try-catches are removed (regression to the HIGH
 * finding where `void runOnPanelHost(...)` could tumble the whole backend).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ default: { request } }));
vi.mock("node:http", () => ({ default: { request } }));

// ── Seams ────────────────────────────────────────────────────────────────
vi.mock("../repositories/webhook.repository.js", () => ({
  webhookRepository: {
    findByEvent: vi.fn(),
    resetFailure: vi.fn(async () => undefined),
    incrementFailure: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
  },
}));

// Keep the real executor module surface; only override runOnPanelHost to invoke
// the callback (no AsyncLocalStorage needed in the unit under test).
vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, runOnPanelHost: vi.fn((fn: () => Promise<unknown>) => fn()) };
});

vi.mock("../../../shared/net/ssrf-guard.js", () => ({
  assertPublicUrlPinned: vi.fn(async () => ({ url: new URL("https://ok.example.com"), pinnedAddress: "93.184.216.34", family: 4 })),
}));

import { webhookDispatcher } from "./webhook-dispatcher.service.js";
import { webhookRepository } from "../repositories/webhook.repository.js";
import { assertPublicUrlPinned } from "../../../shared/net/ssrf-guard.js";

function hook(partial: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "h",
    url: "https://ok.example.com/hook",
    secret: "s",
    events: ["user.created"],
    enabled: true,
    failureCount: 0,
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  request.mockImplementation((_options, onResponse) => ({
    setTimeout: vi.fn(), on: vi.fn(), destroy: vi.fn(),
    end: vi.fn(() => onResponse({ statusCode: 204, resume: vi.fn() })),
  }));
  vi.mocked(assertPublicUrlPinned).mockResolvedValue({ url: new URL("https://ok.example.com"), pinnedAddress: "93.184.216.34", family: 4 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("dispatch() — fire-and-forget crash safety", () => {
  it("returns synchronously (void) and does not throw", () => {
    vi.mocked(webhookRepository.findByEvent).mockResolvedValue([]);
    expect(webhookDispatcher.dispatch("user.created", { a: 1 })).toBeUndefined();
  });

  it("a rejecting subscriber lookup never becomes an unhandled rejection", async () => {
    vi.mocked(webhookRepository.findByEvent).mockRejectedValue(new Error("redis down"));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    // dispatch swallows via .catch + inner try/catch.
    expect(() => webhookDispatcher.dispatch("user.created", {})).not.toThrow();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("_dispatchAsync resolves (never rejects) when lookup fails", async () => {
    vi.mocked(webhookRepository.findByEvent).mockRejectedValue(new Error("boom"));
    await expect(webhookDispatcher._dispatchAsync("user.created", {})).resolves.toBeUndefined();
  });
});

describe("delivery + failure accounting", () => {
  it("resets failure count on a 2xx delivery", async () => {
    vi.mocked(webhookRepository.findByEvent).mockResolvedValue([hook()] as never);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }) as Response));
    await webhookDispatcher._dispatchAsync("user.created", {});
    expect(webhookRepository.resetFailure).toHaveBeenCalledWith(1);
    expect(webhookRepository.incrementFailure).not.toHaveBeenCalled();
  });

  it("SSRF-blocked hook is treated as a failure and never fetched", async () => {
    vi.mocked(webhookRepository.findByEvent).mockResolvedValue([hook()] as never);
    vi.mocked(assertPublicUrlPinned).mockRejectedValue(new Error("private address"));
    const fetchSpy = request;
    await webhookDispatcher._dispatchAsync("user.created", {});
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webhookRepository.incrementFailure).toHaveBeenCalledWith(1);
  });

  it("disables a hook once it reaches MAX_FAILURES", async () => {
    // failureCount 9 → this failed delivery makes it 10 (MAX) → enabled:false.
    vi.mocked(webhookRepository.findByEvent).mockResolvedValue([hook({ failureCount: 9 })] as never);
    vi.useFakeTimers();
    request.mockImplementation(() => ({ setTimeout: vi.fn(), destroy: vi.fn(), end: vi.fn(), on: vi.fn((_event, handler) => queueMicrotask(handler)) }));
    const p = webhookDispatcher._dispatchAsync("user.created", {});
    await vi.runAllTimersAsync();
    await p;
    expect(webhookRepository.incrementFailure).toHaveBeenCalledWith(1);
    expect(webhookRepository.update).toHaveBeenCalledWith(1, { enabled: false });
  });

  it("a failing repository write during accounting does NOT propagate", async () => {
    vi.mocked(webhookRepository.findByEvent).mockResolvedValue([hook()] as never);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }) as Response));
    vi.mocked(webhookRepository.resetFailure).mockRejectedValue(new Error("disk full"));
    await expect(webhookDispatcher._dispatchAsync("user.created", {})).resolves.toBeUndefined();
  });
});
