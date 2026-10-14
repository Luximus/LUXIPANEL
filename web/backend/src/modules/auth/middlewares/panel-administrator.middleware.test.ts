import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
const { resolve, local } = vi.hoisted(() => ({ resolve: vi.fn(), local: { target: { id: "local" } } }));
vi.mock("../../../shared/executor/index.js", () => ({ localExecutor: local }));
vi.mock("../services/live-authorization.service.js", () => ({ resolveLiveAuthorization: resolve }));
const { requirePanelAdministrator } = await import("./panel-administrator.middleware.js");
const base = { userId: 1, username: "owner", kind: "admin", local: true, targetId: "local" };
const call = async (authBaseUser: unknown, user = authBaseUser) => {
  const res = { locals: { authBaseUser, user } } as unknown as Response; const next = vi.fn();
  await requirePanelAdministrator({} as Request, res, next); return { res, next };
};
describe("Installation Logs authorization", () => {
  it("uses the signed local principal when the tab selects a remote target", async () => {
    resolve.mockResolvedValueOnce(base); const { res, next } = await call(base, { ...base, direct: true, targetId: "remote" });
    expect(next).toHaveBeenCalledWith(); expect(res.locals.logsUser).toEqual(base); expect(resolve).toHaveBeenLastCalledWith(base, local);
  });
  it("rejects a remotely authenticated admin and hosting sessions", async () => {
    for (const user of [{ ...base, local: false, direct: true }, { ...base, targetId: "panel:foreign" }, { ...base, tenantId: 42 }]) expect((await call(user)).next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
  it("rechecks local authorization instead of trusting an outdated admin claim", async () => {
    resolve.mockResolvedValueOnce({ ...base, kind: "user" }); const { next } = await call(base); expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
