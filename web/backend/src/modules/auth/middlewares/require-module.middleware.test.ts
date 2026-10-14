// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

const isEnabledMock = vi.fn(async () => true);
const getByIdMock = vi.fn((module: string) => ({ id: module, tag: "premium" }));
const isValidMock = vi.fn(() => true);

vi.mock("../../admin/services/module-registry.service.js", async (original) => ({
  ...await original<typeof import("../../admin/services/module-registry.service.js")>(),
  moduleRegistryService: {
    ...(await original<typeof import("../../admin/services/module-registry.service.js")>()).moduleRegistryService,
    isEnabled: (...args: unknown[]) => isEnabledMock(...args),
    getById: (...args: unknown[]) => getByIdMock(...args),
  },
}));

vi.mock("../../license/license-client.service.js", () => ({
  licenseService: {
    isValid: () => isValidMock(),
  },
}));

import { requireModule } from "./require-module.middleware.js";
import { getContextExecutor, getContextUserId, runWithExecutor } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/types.js";

function createRes(user: { kind: string; modules: string[]; permissions?: unknown }) {
  return { locals: { user } };
}

describe("requireModule", () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    isEnabledMock.mockResolvedValue(true);
    getByIdMock.mockClear();
    isValidMock.mockReset();
    isValidMock.mockReturnValue(true);
  });

  it("returns 404 when the module is disabled", async () => {
    isEnabledMock.mockResolvedValueOnce(false);
    const middleware = requireModule("mail");
    const next = vi.fn();

    await middleware({} as never, createRes({ kind: "admin", modules: ["mail"] }) as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]?.statusCode).toBe(404);
  });

  it("allows access when the module is enabled and the user has it", async () => {
    isEnabledMock.mockResolvedValueOnce(true);
    const middleware = requireModule("mail");
    const next = vi.fn();

    await middleware({ method: "GET", originalUrl: "/api/mail" } as never, createRes({ kind: "user", modules: ["mail"], permissions: { views: ["panel.mail"], actions: ["mail.read"] } }) as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("reads activation in the authenticated server and user context", async () => {
    const executor = { target: { id: "selected-server" } } as Executor;
    isEnabledMock.mockImplementationOnce(async () => {
      expect(getContextExecutor()).toBe(executor);
      expect(getContextUserId()).toBe(42);
      return false;
    });
    const next = vi.fn();

    await runWithExecutor(executor, () => requireModule("mail")(
      { method: "GET", originalUrl: "/api/mail" } as never,
      createRes({ kind: "admin", modules: ["mail"] }) as never,
      next,
    ), 42);

    expect(isEnabledMock).toHaveBeenCalledWith("mail");
    expect(next.mock.calls[0]?.[0]?.statusCode).toBe(404);
  });

  it("returns 403 when the user lacks the module", async () => {
    isEnabledMock.mockResolvedValueOnce(true);
    const middleware = requireModule("admin");
    const next = vi.fn();

    await middleware({} as never, createRes({ kind: "user", modules: ["mail"] }) as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]?.statusCode).toBe(403);
  });
});
