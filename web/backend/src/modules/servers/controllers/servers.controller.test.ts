// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../services/servers.service.js", () => ({ serversService: { list: vi.fn().mockResolvedValue([]) } }));

import { serversController } from "./servers.controller.js";

describe("localized server selector", () => {
  it("names the synthetic local server in the request locale", async () => {
    const res = {
      locals: { locale: "ja", user: { kind: "admin", userId: 1 } },
      json: vi.fn(),
    } as unknown as Response;
    serversController.list({} as Request, res, vi.fn() as NextFunction);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    const target = vi.mocked(res.json).mock.calls[0]?.[0]?.data?.[0];
    expect(target).toMatchObject({ id: "local", isLocal: true, active: true });
    expect(target.name).toMatch(/^ローカルサーバー \(.+\)$/);
  });
});
