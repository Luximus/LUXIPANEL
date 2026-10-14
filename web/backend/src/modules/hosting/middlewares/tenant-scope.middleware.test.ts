import { describe, expect, it, vi } from "vitest";
import type { Response, Request } from "express";
import { requireAdminOrApiKey, isAdminSession } from "./tenant-scope.middleware.js";
describe("consistent hosting administration permissions", () => {
  it.each(["user", "hosting", "mfa_pending", "external-guest"])("does not treat %s module metadata as an admin session", async (kind) => {
    const res = { locals: { user: { kind, modules: ["admin"] } } } as unknown as Response;
    const next = vi.fn();
    await requireAdminOrApiKey({} as Request, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(isAdminSession(res)).toBe(false);
  });
  it("keeps actual admin sessions authorized", async () => {
    const res = { locals: { user: { kind: "admin", modules: [] } } } as unknown as Response;
    const next = vi.fn();
    await requireAdminOrApiKey({} as Request, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(isAdminSession(res)).toBe(true);
  });
});
