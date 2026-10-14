import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { getExecutorMock, listModulesMock } = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
  listModulesMock: vi.fn(),
}));

vi.mock("../../../shared/executor/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/executor/index.js")>()),
  getExecutor: getExecutorMock,
}));
vi.mock("../services/lp-proxy.service.js", () => ({
  lpProxyService: { listModules: listModulesMock },
}));

const { moduleDevController } = await import("./module-dev.controller.js");

function callList(targetId: string, targetHost?: string): Promise<unknown> {
  getExecutorMock.mockReturnValue({ target: { id: targetId } });
  return new Promise((resolve, reject) => {
    const res = {
      locals: { user: { kind: "admin", targetHost } },
      json: (body: unknown) => { resolve(body); },
    } as unknown as Response;
    moduleDevController.listModules({} as Request, res, reject);
  });
}

beforeEach(() => {
  getExecutorMock.mockReset();
  listModulesMock.mockReset();
});

describe("module-dev local and managed modes", () => {
  it("serves local development without querying LP or requiring a session host", async () => {
    await expect(callList("local")).resolves.toMatchObject({
      ok: true,
      data: { modules: [], stale: false, marketplaceAvailable: false },
    });
    expect(listModulesMock).not.toHaveBeenCalled();
  });

  it("uses the session host for a managed panel", async () => {
    listModulesMock.mockResolvedValue({ data: [], stale: false, fetchedAt: "2026-09-28T00:00:00Z" });
    await expect(callList("remote", "acme.luxipanel.com")).resolves.toMatchObject({
      ok: true,
      data: { marketplaceAvailable: true },
    });
    expect(listModulesMock).toHaveBeenCalledWith("acme.luxipanel.com");
  });

  it("keeps remote sessions without a trusted host closed", async () => {
    await expect(callList("remote")).rejects.toMatchObject({ code: "MODULE_DEV_NO_HOST" });
    expect(listModulesMock).not.toHaveBeenCalled();
  });
});
