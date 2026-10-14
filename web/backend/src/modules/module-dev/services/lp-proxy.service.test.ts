import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock SIEMPRE antes de importar el módulo bajo prueba.
const {
  getContextExecutorMock,
  getContextUserMock,
  devListModulesMock,
  devModuleReviewsMock,
  cacheGetMock,
  cacheSetMock,
} = vi.hoisted(() => ({
  getContextExecutorMock: vi.fn(),
  getContextUserMock: vi.fn(),
  devListModulesMock: vi.fn(),
  devModuleReviewsMock: vi.fn(),
  cacheGetMock: vi.fn(),
  cacheSetMock: vi.fn(),
}));

vi.mock("../../../config/env.js", () => ({
  env: { NODE_ENV: "test", LOG_LEVEL: "error" },
}));

vi.mock("../../../shared/executor/context.js", () => ({
  getContextExecutor: getContextExecutorMock,
  getContextUser: getContextUserMock,
}));

vi.mock("../../../shared/marketplace-link/index.js", () => ({
  marketplaceLinkRepository: { getByModuleId: vi.fn(async () => ({ moduleId: "acme-cache" })) },
}));

vi.mock("../../license/panel-api.client.js", () => ({
  panelApiClient: {
    devListModules: devListModulesMock,
    devModuleReviews: devModuleReviewsMock,
    devSubmitModule: vi.fn(),
    devResubmitModule: vi.fn(),
    devUnpublishModule: vi.fn(),
    devRepublishModule: vi.fn(),
  },
}));

vi.mock("../repositories/lp-cache.repository.js", () => ({
  lpCacheRepository: { get: cacheGetMock, set: cacheSetMock },
}));

const { lpProxyService } = await import("./lp-proxy.service.js");
const { AppError } = await import("../../../shared/errors/index.js");

beforeEach(() => {
  getContextExecutorMock.mockReset();
  getContextUserMock.mockReset().mockReturnValue(null);
  devListModulesMock.mockReset();
  devModuleReviewsMock.mockReset();
  cacheGetMock.mockReset().mockResolvedValue(null);
  cacheSetMock.mockReset().mockResolvedValue(undefined);
});

describe("resolución de host (identidad del developer ante LP)", () => {
  it("usa el host explícito de la sesión (controller) y cachea con scope por host", async () => {
    devListModulesMock.mockResolvedValue([{ code: "acme-cache" }]);
    const out = await lpProxyService.listModules("acme.luxipanel.com");
    expect(devListModulesMock).toHaveBeenCalledWith({ host: "acme.luxipanel.com" });
    expect(cacheSetMock).toHaveBeenCalledWith("modules:acme.luxipanel.com", [{ code: "acme-cache" }]);
    expect(out.stale).toBe(false);
  });

  it("sin host explícito cae al targetHost del SessionUser del ALS (agent tools)", async () => {
    getContextUserMock.mockReturnValue({ targetHost: "acme.luxipanel.com" });
    devListModulesMock.mockResolvedValue([]);
    await lpProxyService.listModules();
    expect(devListModulesMock).toHaveBeenCalledWith({ host: "acme.luxipanel.com" });
  });

  it("sin host de sesión NI contexto → MODULE_DEV_NO_HOST (fail-closed, sin caché)", async () => {
    await expect(lpProxyService.listModules()).rejects.toMatchObject({
      code: "MODULE_DEV_NO_HOST",
    });
    expect(devListModulesMock).not.toHaveBeenCalled();
    expect(cacheGetMock).not.toHaveBeenCalled(); // jamás servir caché sin identidad
  });

  it("getReviews usa clave de caché con scope por host", async () => {
    devModuleReviewsMock.mockResolvedValue({ module: { code: "acme-cache" } });
    await lpProxyService.getReviews("acme-cache", "acme.luxipanel.com");
    expect(cacheSetMock).toHaveBeenCalledWith(
      "reviews:acme.luxipanel.com:acme-cache",
      { module: { code: "acme-cache" } },
    );
  });

  it("LP caído → sirve la caché del MISMO host con stale:true", async () => {
    devListModulesMock.mockRejectedValue(new Error("ECONNREFUSED"));
    cacheGetMock.mockResolvedValue({ data: [{ code: "acme-cache" }], fetchedAt: "2026-06-11T00:00:00Z" });
    const out = await lpProxyService.listModules("acme.luxipanel.com");
    expect(cacheGetMock).toHaveBeenCalledWith("modules:acme.luxipanel.com");
    expect(out.stale).toBe(true);
    expect(out.data).toEqual([{ code: "acme-cache" }]);
  });

  it("LP caído y sin caché → 502 tipado (AppError upstream)", async () => {
    devListModulesMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(lpProxyService.listModules("acme.luxipanel.com")).rejects.toBeInstanceOf(AppError);
  });
});
