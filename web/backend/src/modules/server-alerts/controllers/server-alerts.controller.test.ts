// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: () => ({ target: { id: "server-1" } }) }));
vi.mock("../services/server-alerts.service.js", () => ({ serverAlertsService: { sendImmediate: vi.fn().mockResolvedValue({ panel: true }) } }));
vi.mock("../services/notification-delivery.service.js", () => ({ notificationDeliveryService: {} }));

import { serverAlertsService } from "../services/server-alerts.service.js";
import { serverAlertsController } from "./server-alerts.controller.js";

describe("localized server alert notifications", () => {
  it("sends the test notification in the request locale", async () => {
    const res = {
      locals: { locale: "ja", user: { userId: 42 } },
      json: vi.fn(),
    } as unknown as Response;
    serverAlertsController.test({} as Request, res, vi.fn() as NextFunction);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(serverAlertsService.sendImmediate).toHaveBeenCalledWith(expect.objectContaining({
      title: "通知テスト",
      body: "このアラートはアカウントの有効な通知先を確認するものです。",
      targetUserId: 42,
    }), "server-1");
  });
});
