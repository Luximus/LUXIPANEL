// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import express from "express";
import supertest from "supertest";

const h = vi.hoisted(() => ({ override: vi.fn(), hydrate: vi.fn(), verify: vi.fn(), executor: { target: { id: "selected" } } }));
vi.mock("../services/token.service.js", () => ({ tokenService: {
  verify: h.verify,
  toSessionUser: (payload: unknown) => ({ ...payload as object }),
} }));
vi.mock("../../../shared/session/bridge-header.js", () => ({
  readBridgeHeader: (headers: Record<string, unknown>) => headers["x-bridge-session-id"] ?? null,
  resolveOverrideBridge: h.override,
}));
vi.mock("../../../shared/executor/factory.js", () => ({
  hydrateDirectSshExecutor: h.hydrate,
  getExecutorAsync: async () => h.executor,
  getDirectExecutorByBridgeSessionId: async () => h.executor,
}));
vi.mock("../services/live-authorization.service.js", () => ({ resolveLiveAuthorization: async (user: unknown) => user }));

vi.mock("../../../shared/github/user-connection.js", async importOriginal => { const actual=await importOriginal<typeof import("../../../shared/github/user-connection.js")>();return {...actual,requireGithub:vi.fn(async()=>undefined),githubStatus:vi.fn(async()=>({required:true,connected:true}))}; });

import { optionalAuth, requireAuth, requireAuthNoExecutor, requireMfaPending } from "./session.middleware.js";
import { getContextExecutor } from "../../../shared/executor/context.js";

function request(bridge: string) {
  const res = { locals: {} } as Response;
  const req = { headers: { authorization: "Bearer token", "x-bridge-session-id": bridge },
    method: "GET", originalUrl: "/api/notifications", res } as unknown as Request;
  return { req, res };
}

describe("HTTP selected server resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.verify.mockResolvedValue({ userId: 1, username: "admin", role: "admin", kind: "admin", modules: [] });
  });

  it.each([null, { bridgeSessionId: "selected-bridge", targetId: "" }])("rejects an unavailable explicit bridge without touching the cookie server: %s", async override => {
    h.override.mockResolvedValue(override);
    const { req, res } = request("selected-bridge");
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 428, code: "BRIDGE_SESSION_REQUIRED" }));
    expect(h.hydrate).not.toHaveBeenCalled();
  });

  it("pins a valid tab override before invoking server APIs", async () => {
    h.override.mockResolvedValue({ bridgeSessionId: "selected-bridge", targetId: "selected", targetName: "Selected", direct: true });
    const { req, res } = request("selected-bridge");
    const next = vi.fn(() => expect(getContextExecutor()).toBe(h.executor));
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.bridgedSession.targetId).toBe("selected");
  });

  it.each([requireAuth, optionalAuth, requireAuthNoExecutor, requireMfaPending])("forwards asynchronous verification failures to Express", async handler => {
    const error = new Error("Verification unavailable");
    h.verify.mockRejectedValueOnce(error);
    const { req, res } = request("selected-bridge");
    const next = vi.fn();
    await handler(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(error);
  });

  it("returns a reconnection response through a credential gate that does not return the auth Promise", async () => {
    h.override.mockResolvedValue(null);
    const app = express();
    app.get("/notifications", (req, res, next) => { void requireAuth(req, res, next); }, (_req, res) => { res.sendStatus(200); });
    app.use((error: { statusCode?: number; code?: string }, _req: Request, res: Response, _next: import("express").NextFunction) => {
      res.status(error.statusCode ?? 500).json({ code: error.code });
    });
    await supertest(app).get("/notifications").set("Authorization", "Bearer token").set("X-Bridge-Session-Id", "expired")
      .timeout({ response: 1000, deadline: 2000 }).expect(428, { code: "BRIDGE_SESSION_REQUIRED" });
    expect(h.hydrate).not.toHaveBeenCalled();
  });
  it.each(["modules", "graph", "cross"])("does not accept a %s MCP token as an ordinary HTTP session", async mcpScope => {
    h.verify.mockResolvedValue({ userId: 1, username: "admin", role: "admin", kind: "admin", modules: [], mcpScope });
    for (const handler of [requireAuth, optionalAuth, requireAuthNoExecutor]) {
      const { req, res } = request("selected-bridge"), next = vi.fn();
      await handler(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    }
    expect(h.hydrate).not.toHaveBeenCalled();
  });

});
