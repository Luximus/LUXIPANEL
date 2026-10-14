import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { Executor } from "../../../shared/executor/types.js";
import { getContextExecutor, getContextUser, runWithExecutor } from "../../../shared/executor/context.js";

const mocks = vi.hoisted(() => ({ get: vi.fn(), material: vi.fn(), allowed: vi.fn(), pin: vi.fn(),
  put: vi.fn(), direct: vi.fn() }));
vi.mock("../../servers/repositories/targets.repository.js", () => ({ targetsRepository: { get: mocks.get, getMaterial: mocks.material } }));
vi.mock("../../servers/services/servers.service.js", () => ({ userMayUseTarget: mocks.allowed }));
vi.mock("../../servers/controllers/servers.controller.js", () => ({ viewerOf: (res: Response) => ({ userId: res.locals.user.userId, isAdmin: false }) }));
vi.mock("../../../shared/net/host-policy.js", () => ({ assertSafeTargetHost: mocks.pin }));
vi.mock("../../auth/services/ssh-credentials-cache.service.js", () => ({ sshCredentialsCache: { put: mocks.put } }));
vi.mock("../../../shared/executor/factory.js", () => ({ getExecutor: (req: Request) => req.res!.locals.mailExecutor ?? req.res!.locals.activeExecutor,
  getDirectExecutorByBridgeSessionId: mocks.direct }));
import { resolveMailServer } from "./mail-server-selection.js";
import { mailServerMiddleware } from "../middlewares/mail-server.middleware.js";

const active = { target: { id: "active", name: "Active" } } as Executor;
const selected = { target: { id: "mail-server", name: "Mail" } } as Executor;
const target = { id: "mail-server", name: "Mail", host: "mail.example.test", enabled: true,
  updatedAt: "one", secretEnc: "encrypted", hostFingerprint: "approved" };
function request(userId = 1, kind = "admin") {
  const user = { userId, kind };
  const res = { locals: { user, activeExecutor: active, bridgedSession: { bridgeSessionId: "panel-bridge" }, locale: "en" } } as unknown as Response;
  const req = { res, get: () => "mail-server" } as unknown as Request;
  return { req, res, user };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue(target);
  mocks.material.mockResolvedValue({ target, material: { host: target.host, expectedHostFingerprint: "approved", privateKeyPem: "secret" } });
  mocks.allowed.mockReturnValue(true);
  mocks.pin.mockResolvedValue({ pinnedAddress: "203.0.113.10" });
  mocks.direct.mockResolvedValue(selected);
});
describe("mail server isolation", () => {
  it("keeps the active executor when no independent server is selected", async () => {
    const { req, res } = request();
    expect(await resolveMailServer(req, res, "")).toBe(active);
    expect(await resolveMailServer(req, res, "active")).toBe(active);
    expect(mocks.material).not.toHaveBeenCalled();
  });
  it("does not decrypt, connect or disclose inaccessible servers", async () => {
    const { req, res } = request();
    mocks.allowed.mockReturnValue(false);
    await expect(resolveMailServer(req, res, "private")).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.material).not.toHaveBeenCalled();
    expect(mocks.pin).not.toHaveBeenCalled();
    expect(mocks.direct).not.toHaveBeenCalled();
  });
  it("keeps hosting accounts on their original tenant target", async () => {
    const { req, res } = request(1, "hosting");
    await expect(resolveMailServer(req, res, "mail-server")).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("also keeps normal panel users linked to a tenant on the original target", async () => {
    const { req, res } = request(1, "user");
    res.locals.user.tenantId = 7;
    await expect(resolveMailServer(req, res, "mail-server")).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it.each([{ enabled: false }, { hostFingerprint: null }])("rejects disabled/unapproved targets before networking: %j", async changes => {
    mocks.get.mockResolvedValue({ ...target, ...changes });
    const { req, res } = request();
    await expect(resolveMailServer(req, res, "mail-server")).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.pin).not.toHaveBeenCalled();
  });
  it("pins the host, seals ownership and keeps panel bridge metadata unchanged", async () => {
    const { req, res } = request();
    expect(await resolveMailServer(req, res, "mail-server")).toBe(selected);
    expect(mocks.put).toHaveBeenCalledWith(expect.stringMatching(/^mail:[a-f0-9]{64}$/),
      expect.objectContaining({ host: "203.0.113.10", userId: 1, targetId: "mail-server", expectedHostFingerprint: "approved" }), 300);
    expect(res.locals.bridgedSession).toEqual({ bridgeSessionId: "panel-bridge" });
  });
  it("separates users and rebuilds cache identities after credential changes", async () => {
    for (const userId of [1, 2]) {
      const { req, res } = request(userId); await resolveMailServer(req, res, "mail-server");
    }
    mocks.get.mockResolvedValue({ ...target, updatedAt: "two", secretEnc: "rotated" });
    mocks.material.mockResolvedValue({ target: { ...target, updatedAt: "two", secretEnc: "rotated" }, material: { host: target.host } });
    const { req, res } = request(); await resolveMailServer(req, res, "mail-server");
    expect(new Set(mocks.put.mock.calls.map(args => args[0])).size).toBe(3);
  });
  it("fails closed if the vault record changes during resolution", async () => {
    mocks.material.mockResolvedValue({ target: { ...target, host: "other.test" }, material: {} });
    const { req, res } = request();
    await expect(resolveMailServer(req, res, "mail-server")).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.direct).not.toHaveBeenCalled();
  });
  it("rechecks visibility and enablement on every request, including cache hits", async () => {
    const { req, res } = request(); await resolveMailServer(req, res, "mail-server");
    mocks.get.mockResolvedValue({ ...target, enabled: false });
    await expect(resolveMailServer(req, res, "mail-server")).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.direct).toHaveBeenCalledOnce();
  });
  it("pins explicit controllers and ambient sockets/sidecars together without changing outer context", async () => {
    const { req, res, user } = request();
    await runWithExecutor(active, async () => {
      await new Promise<void>((resolve, reject) => {
        void mailServerMiddleware(req, res, error => {
          if (error) { reject(error); return; }
          expect(getContextExecutor()).toBe(selected);
          expect(getContextUser()).toBe(user);
          expect(res.locals.mailExecutor).toBe(selected);
          expect(res.locals.activeExecutor).toBe(active);
          resolve();
        });
      });
      expect(getContextExecutor()).toBe(active);
    });
  });
  it("never calls the controller after a rejected target", async () => {
    mocks.get.mockResolvedValue(null);
    const { req, res } = request(); const next = vi.fn();
    await mailServerMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(res.locals.mailExecutor).toBeUndefined();
  });
});
