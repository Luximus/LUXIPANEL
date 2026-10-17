import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../config/env.js", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("../../../shared/logger/index.js", () => ({ createModuleLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));
vi.mock("../../../config/paths.js", () => ({ panelConfigDir: () => "/test/config" }));
vi.mock("../../../shared/executor/index.js", () => ({ quoteArg: (value: string) => JSON.stringify(value), pathExists: vi.fn() }));
vi.mock("../../../shared/redis/index.js", () => ({ getRedis: vi.fn() }));
const m = vi.hoisted(() => ({ authenticate: vi.fn(), assertOperation: vi.fn(), download: vi.fn(), remove: vi.fn() }));
vi.mock("../services/provider.service.js", () => ({ providerService: { authenticate: m.authenticate, assertOperation: m.assertOperation } }));
vi.mock("../services/deployment-data-provider.mjs", () => ({ deploymentDataRequest: vi.fn() }));
vi.mock("../services/deployment-provider.service.js", async importOriginal => ({
  ...await importOriginal<typeof import("../services/deployment-provider.service.js")>(),
  deploymentProviderService: { staticArtifact: m.download, deleteStaticArtifact: m.remove },
}));
import { deploymentProviderRouter } from "./deployment-provider.routes.js";
const app = express(); app.use(express.json()); app.use(deploymentProviderRouter);
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(403).json({ ok: false }); });
const base = "/api/hosting/v1/accounts/account-a/deployments/project-a/jobs/job-a/static/forms";
beforeEach(() => { vi.resetAllMocks(); m.authenticate.mockResolvedValue({ id: "provider-a" }); m.download.mockResolvedValue({ bytes: Buffer.from("ZIP"), sha256: "a".repeat(64) }); m.remove.mockResolvedValue({ removed: true }); });
it("serves private ZIP bytes through the existing provider authentication and read permission", async () => {
  const res = await request(app).get(base).set("Authorization", "Bearer lhp_fixture");
  expect(res.status).toBe(200); expect(res.headers["content-type"]).toContain("application/zip");
  expect(res.headers["cache-control"]).toBe("private, no-store"); expect(res.headers["content-length"]).toBe("3");
  expect(m.assertOperation).toHaveBeenCalledWith({ id: "provider-a" }, "deployments.read");
  expect(m.download).toHaveBeenCalledWith({ id: "provider-a" }, "account-a", "project-a", "job-a", "forms");
});
it("requires authentication before reading or deleting", async () => {
  expect((await request(app).get(base)).status).toBe(403);
  expect((await request(app).delete(base)).status).toBe(403);
  expect(m.download).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
});
it("enforces live permissions before downloading", async () => {
  m.assertOperation.mockImplementation(() => { throw new Error("forbidden"); });
  expect((await request(app).get(base).set("Authorization", "Bearer lhp_fixture")).status).toBe(403);
  expect(m.download).not.toHaveBeenCalled();
});
it("requires write permission to clean the staged artifact", async () => {
  const res = await request(app).delete(base).set("Authorization", "Bearer lhp_fixture");
  expect(res.status).toBe(200); expect(res.body.data.removed).toBe(true);
  expect(m.assertOperation).toHaveBeenCalledWith({ id: "provider-a" }, "deployments.write");
  m.assertOperation.mockImplementation(() => { throw new Error("forbidden"); }); m.remove.mockClear();
  expect((await request(app).delete(base).set("Authorization", "Bearer lhp_fixture")).status).toBe(403);
  expect(m.remove).not.toHaveBeenCalled();
});
