// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";

const { request, findById, record, assertPublicUrlPinned } = vi.hoisted(() => ({
  request: vi.fn(),
  findById: vi.fn(),
  record: vi.fn(),
  assertPublicUrlPinned: vi.fn(),
}));

vi.mock("node:http", () => ({ default: { request: vi.fn() } }));
vi.mock("node:https", () => ({ default: { request } }));
vi.mock("../repositories/webhook.repository.js", () => ({ webhookRepository: { findById } }));
vi.mock("../repositories/delivery.repository.js", () => ({ deliveryRepository: { record } }));
vi.mock("../../../shared/net/ssrf-guard.js", () => ({ assertPublicUrlPinned }));

import { webhookDispatcher } from "./webhook-dispatcher.service.js";

describe("webhook delivery DNS pinning", () => {
  it("connects to the vetted address while retaining Host and TLS SNI", async () => {
    findById.mockResolvedValue({ id: 7, url: "https://hooks.example/path?x=1", secret: "test-secret" });
    assertPublicUrlPinned.mockResolvedValue({
      url: new URL("https://hooks.example/path?x=1"),
      pinnedAddress: "93.184.216.34",
      family: 4,
    });
    request.mockImplementation((options, onResponse) => ({
      setTimeout: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
      end: vi.fn(() => onResponse({ statusCode: 204, resume: vi.fn() })),
    }));

    await expect(webhookDispatcher.test(7)).resolves.toEqual({ delivered: true, status: 204 });
    const options = request.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      hostname: "93.184.216.34",
      servername: "hooks.example",
      path: "/path?x=1",
      method: "POST",
      headers: { Host: "hooks.example" },
    });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ webhookId: 7, delivered: true }));
  });
});
