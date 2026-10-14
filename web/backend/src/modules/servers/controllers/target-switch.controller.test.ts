// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * POST /api/servers/local/switch — explicit return to the CONNECTED (local)
 * server. Pins the invariant that returning to local disposes the per-tab AND
 * cookie bridges and re-signs the session cookie WITHOUT any target/bridge claim
 * (so a JWT-pinned remote session can escape, not just a header-driven one).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  verify: vi.fn(),
  signWithExpiry: vi.fn(() => ({ token: "FRESH_LOCAL_JWT", expiresAt: 4102444800000 })),
  setSessionCookie: vi.fn(),
  revoke: vi.fn(async () => true),
  extractToken: vi.fn(),
  disposeDirectExecutor: vi.fn(async () => {}),
  cachePut: vi.fn(async () => {}),
  cacheGet: vi.fn(async () => null),
  cacheDelete: vi.fn(async () => {}),
  getMaterial: vi.fn(),
}));

vi.mock("../../auth/services/token.service.js", () => ({
  parseDuration: (v: string) => (v === "24h" ? 86400000 : 60000),
  tokenService: {
    verify: h.verify,
    signWithExpiry: h.signWithExpiry,
    setSessionCookie: h.setSessionCookie,
    revoke: h.revoke,
  },
}));
vi.mock("../../auth/middlewares/session.middleware.js", () => ({ extractToken: h.extractToken }));
vi.mock("../../../shared/executor/factory.js", () => ({ disposeDirectExecutor: h.disposeDirectExecutor }));
vi.mock("../../auth/services/ssh-credentials-cache.service.js", () => ({
  sshCredentialsCache: { put: h.cachePut, get: h.cacheGet, delete: h.cacheDelete },
}));
vi.mock("../repositories/targets.repository.js", () => ({
  targetsRepository: { getMaterial: h.getMaterial },
}));
vi.mock("../../../shared/net/host-policy.js", () => ({
  assertSafeTargetHost: vi.fn(async () => ({ pinnedAddress: "1.2.3.4" })),
}));
vi.mock("../../../shared/executor/index.js", () => ({
  runOnPanelHost: (fn: () => unknown) => fn(),
}));
vi.mock("../services/servers.service.js", () => ({ userMayUseTarget: () => true }));
vi.mock("../../../config/auth.js", () => ({ authConfig: { jwt: { expiresIn: "24h" } } }));

import { targetSwitchController } from "./target-switch.controller.js";

type NextErr = Error | undefined;

function makeCtx(opts: {
  id: string;
  header?: string;
  user?: Record<string, unknown>;
}) {
  const jsonSpy = vi.fn();
  const req = {
    params: { id: opts.id },
    headers: opts.header ? { "x-bridge-session-id": opts.header } : {},
  } as unknown as import("express").Request;
  const res = {
    locals: { user: opts.user ?? { userId: 1, username: "operator", kind: "admin" } },
    json: jsonSpy,
  } as unknown as import("express").Response;
  let err: NextErr;
  const next = (e?: unknown) => { err = e as NextErr; };
  return { req, res, next, jsonSpy, getErr: () => err };
}

/** asyncHandler swallows the handler promise (fire-and-forget .catch(next)), so
 *  drain the microtask/immediate queue to let the awaited mocks settle. */
const flush = () => new Promise((r) => setImmediate(r));

describe("POST /api/servers/local/switch (switchToLocal)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disposes header + cookie bridges and re-signs a bridge-free LOCAL cookie", async () => {
    h.extractToken.mockReturnValue("COOKIE_JWT");
    h.verify.mockResolvedValue({
      userId: 1, username: "operator", displayName: "Jose", role: "admin",
      modules: ["admin"], kind: "admin",
      bridgeSessionId: "cookie-bridge", targetId: "remote-abc", targetName: "FRONTEND",
      direct: true, targetHost: "host.example", iat: 1, exp: 2000000000, iss: "luxipanel", sub: "1", jti: "j1",
    });

    const { req, res, next, jsonSpy, getErr } = makeCtx({ id: "local", header: "tab-bridge" });
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();

    expect(getErr()).toBeUndefined();
    // Both the per-tab override AND the cookie's own bridge are torn down.
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("tab-bridge");
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("cookie-bridge");

    // Re-signed payload is stripped of every bridge/target + reserved claim.
    const [payload] = h.signWithExpiry.mock.calls[0]!;
    for (const k of ["bridgeSessionId", "remoteSessionId", "remoteUserId", "targetId",
      "targetName", "targetHost", "direct", "iat", "exp", "nbf", "iss", "sub", "jti"]) {
      expect(payload).not.toHaveProperty(k);
    }
    expect(payload).toMatchObject({ userId: 1, username: "operator", kind: "admin", local: true });
    expect(h.setSessionCookie).toHaveBeenCalledWith(res, "FRESH_LOCAL_JWT", false, 4102444800000);
    // The previous cookie token is revoked (denylist) so it can't keep riding.
    expect(h.revoke).toHaveBeenCalledWith("COOKIE_JWT");

    expect(jsonSpy).toHaveBeenCalledWith({
      ok: true,
      data: { local: true, targetId: "local", targetName: "Local", bridgeSessionId: "", clearBridge: true },
    });
  });

  it("switchLocal (literal /local/switch route, NO :id param) returns to LOCAL instead of 404", async () => {
    h.extractToken.mockReturnValue("COOKIE_JWT");
    h.verify.mockResolvedValue({
      userId: 1, username: "operator", displayName: "Jose", role: "admin",
      modules: ["admin"], kind: "admin",
      bridgeSessionId: "cookie-bridge", targetId: "remote-abc", targetName: "FRONTEND",
      direct: true, targetHost: "host.example", iat: 1, exp: 2000000000, iss: "luxipanel", sub: "1", jti: "j1",
    });

    // The literal route has no `:id` segment → req.params is EMPTY. Routing it
    // through `switch` turned `String(undefined)` into a vault lookup → 404.
    const { req, res, next, jsonSpy, getErr } = makeCtx({ id: "", header: "tab-bridge" });
    (req as unknown as { params: Record<string, string> }).params = {};
    await (targetSwitchController.switchLocal as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();

    expect(getErr()).toBeUndefined();
    expect(h.getMaterial).not.toHaveBeenCalled();
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("tab-bridge");
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("cookie-bridge");
    expect(jsonSpy).toHaveBeenCalledWith({
      ok: true,
      data: { local: true, targetId: "local", targetName: "Local", bridgeSessionId: "", clearBridge: true },
    });
  });

  it("does not double-dispose when header and cookie share the same bridge id", async () => {
    h.extractToken.mockReturnValue("COOKIE_JWT");
    h.verify.mockResolvedValue({
      userId: 1, username: "operator", displayName: "Jose", role: "admin",
      modules: ["admin"], kind: "admin",
      bridgeSessionId: "same-bridge", targetId: "remote-abc", direct: true,
      iat: 1, exp: 2000000000, iss: "luxipanel", sub: "1", jti: "j1",
    });
    const { req, res, next } = makeCtx({ id: "local", header: "same-bridge" });
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();
    expect(h.disposeDirectExecutor).toHaveBeenCalledTimes(1);
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("same-bridge");
  });

  it("rejects a hosting session (bound to its tenant target by design)", async () => {
    const { req, res, next, jsonSpy, getErr } = makeCtx({
      id: "local", user: { userId: 5, username: "acct", kind: "hosting" },
    });
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();
    const err = getErr();
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toMatch(/Validation/i);
    expect(h.signWithExpiry).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("still clears the client bridge when there is no cookie token to re-sign", async () => {
    h.extractToken.mockReturnValue(null);
    const { req, res, next, jsonSpy } = makeCtx({ id: "local", header: "tab-bridge" });
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("tab-bridge");
    expect(h.signWithExpiry).not.toHaveBeenCalled();
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      ok: true, data: expect.objectContaining({ clearBridge: true, local: true }),
    }));
  });
});

describe("POST /api/servers/:id/switch (remote target)", () => {
  beforeEach(() => vi.clearAllMocks());

  const remoteTarget = {
    id: "remote-xyz",
    name: "FRONTEND",
    enabled: true,
    hostFingerprint: "sha256:AAA",
    host: "example.host",
    visibility: "global",
  };

  function primeRemote(cookieBridge?: { bridgeSessionId?: string; targetId?: string }) {
    h.getMaterial.mockResolvedValue({
      target: remoteTarget,
      material: { host: "example.host", secret: "KEY" },
    });
    h.extractToken.mockReturnValue("COOKIE_JWT");
    h.verify.mockResolvedValue({
      userId: 1, username: "operator", displayName: "Jose", role: "admin",
      modules: ["admin"], kind: "admin",
      ...(cookieBridge ?? {}),
      direct: cookieBridge ? true : undefined,
      iat: 1, exp: 2000000000, iss: "luxipanel", sub: "1", jti: "j1",
    });
  }

  it("re-signs the cookie with direct:true + targetId + a fresh bridgeSessionId, revokes the old jti", async () => {
    primeRemote();
    const { req, res, next, jsonSpy, getErr } = makeCtx({ id: "remote-xyz" });
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();

    expect(getErr()).toBeUndefined();
    // The bridgeSessionId minted for the cache put is the same one sealed in the
    // re-signed cookie and returned in the body — one identity end to end.
    const mintedBridgeId = h.cachePut.mock.calls[0]![0] as string;
    expect(typeof mintedBridgeId).toBe("string");

    const [payload] = h.signWithExpiry.mock.calls[0]!;
    expect(payload).toMatchObject({
      userId: 1, kind: "admin", direct: true,
      targetId: "remote-xyz", targetName: "FRONTEND", bridgeSessionId: mintedBridgeId,
    });
    // Reserved claims are not re-supplied (jsonwebtoken would throw otherwise).
    for (const k of ["iat", "exp", "nbf", "iss", "sub", "jti", "local"]) {
      expect(payload).not.toHaveProperty(k);
    }
    expect(h.setSessionCookie).toHaveBeenCalledWith(res, "FRESH_LOCAL_JWT", false, 4102444800000);
    expect(h.revoke).toHaveBeenCalledWith("COOKIE_JWT");

    // Contract unchanged: body still carries the bridgeSessionId for sessionStorage.
    expect(jsonSpy).toHaveBeenCalledWith({
      ok: true,
      data: { bridgeSessionId: mintedBridgeId, targetId: "remote-xyz", targetName: "FRONTEND" },
    });
  });

  it("creates a native context without revoking the base token or disposing existing terminals", async () => {
    primeRemote({ bridgeSessionId: "base-cookie-bridge", targetId: "base" });
    const { req, res, next, jsonSpy, getErr } = makeCtx({ id: "remote-xyz", header: "existing-terminal" });
    Object.assign(req, {body:{sessionMode:"context"}});
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();
    expect(getErr()).toBeUndefined();
    const bridgeSessionId = h.cachePut.mock.calls[0]![0];
    expect(jsonSpy).toHaveBeenCalledWith({ok:true,data:{bridgeSessionId,targetId:"remote-xyz",targetName:"FRONTEND",sessionMode:"context"}});
    expect(h.revoke).not.toHaveBeenCalled();
    expect(h.signWithExpiry).not.toHaveBeenCalled();
    expect(h.disposeDirectExecutor).not.toHaveBeenCalled();
  });

  it("disposes the previous header + cookie bridges (remote→remote) without dropping the new one", async () => {
    primeRemote({ bridgeSessionId: "old-cookie-bridge", targetId: "remote-old" });
    const { req, res, next } = makeCtx({ id: "remote-xyz", header: "old-tab-bridge" });
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();

    const mintedBridgeId = h.cachePut.mock.calls[0]![0] as string;
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("old-tab-bridge");
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("old-cookie-bridge");
    expect(h.disposeDirectExecutor).not.toHaveBeenCalledWith(mintedBridgeId);
  });

  it("rejects a hosting session before touching the vault", async () => {
    primeRemote();
    const { req, res, next, jsonSpy, getErr } = makeCtx({
      id: "remote-xyz", user: { userId: 5, username: "acct", kind: "hosting" },
    });
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();

    const err = getErr();
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toMatch(/Validation/i);
    expect(h.getMaterial).not.toHaveBeenCalled();
    expect(h.cachePut).not.toHaveBeenCalled();
    expect(h.signWithExpiry).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});

describe("escape hatch: return to local with dead SSH material", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["local", "remote-xyz"])("rejects switching normal tenant users to %s", async (id) => {
    const ctx = makeCtx({ id, user: { userId: 91, username: "acct", kind: "user", tenantId: 7 } });
    targetSwitchController.switch(ctx.req, ctx.res, ctx.next);
    await flush();
    expect(ctx.getErr()).toBeInstanceOf(Error);
    expect(h.getMaterial).not.toHaveBeenCalled();
    expect(h.signWithExpiry).not.toHaveBeenCalled();
  });

  it("switchToLocal succeeds for a JWT-pinned direct session whose material expired", async () => {
    // The cookie pins a remote direct target, but its cached material is gone
    // (sshCredentialsCache.get → null). The controller never reads the executor,
    // so the return-to-local still re-signs a LOCAL cookie and tears the bridge down.
    h.cacheGet.mockResolvedValue(null);
    h.extractToken.mockReturnValue("COOKIE_JWT");
    h.verify.mockResolvedValue({
      userId: 1, username: "operator", displayName: "Jose", role: "admin",
      modules: ["admin"], kind: "admin",
      bridgeSessionId: "dead-bridge", targetId: "remote-gone", direct: true,
      iat: 1, exp: 2000000000, iss: "luxipanel", sub: "1", jti: "j1",
    });

    const { req, res, next, jsonSpy, getErr } = makeCtx({ id: "local" });
    await (targetSwitchController.switch as unknown as (a: unknown, b: unknown, c: unknown) => Promise<void>)(req, res, next);
    await flush();

    expect(getErr()).toBeUndefined();
    expect(h.disposeDirectExecutor).toHaveBeenCalledWith("dead-bridge");
    const [payload] = h.signWithExpiry.mock.calls[0]!;
    expect(payload).toMatchObject({ local: true });
    expect(payload).not.toHaveProperty("direct");
    expect(h.revoke).toHaveBeenCalledWith("COOKIE_JWT");
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      ok: true, data: expect.objectContaining({ local: true, clearBridge: true }),
    }));
  });
});
