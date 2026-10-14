// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — auth/services/token.service.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the authConfig before importing the service
vi.mock("../../../config/auth.js", () => ({
  authConfig: {
    jwt: {
      secret: ("test-" + "secret-key-with-at-least-32-characters-long"),
      expiresIn: "1h",
      rememberExpiresIn: "7d",
    },
    cookie: {
      sessionName: "luxipanel_session",
      secure: false,
      sameSite: "lax" as const,
      domain: "",
    },
  },
}));

// Controllable Redis mock for the denylist path (revoke/verify). `exists`
// defaults to 0 (not revoked) so the existing verify tests keep passing.
const redisExists = vi.fn(async (_key: string) => 0);
const redisSet = vi.fn(async (..._args: unknown[]) => "OK");
const redisDel = vi.fn(async (..._args: unknown[]) => 1);
vi.mock("../../../shared/redis/index.js", () => ({
  getRedis: () => ({ exists: redisExists, set: redisSet, del: redisDel, incr: async () => 1, publish: async () => 0 }),
}));

import { tokenService, type TokenPayload } from "./token.service.js";

const samplePayload: TokenPayload = {
  userId: 1,
  username: "testuser",
  displayName: "Test User",
  role: "admin",
  modules: ["mail", "admin"],
  kind: "admin",
};

describe("tokenService.sign", () => {
  it("returns a token string and expiration", () => {
    const { token, expiresAt } = tokenService.sign(samplePayload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT format
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it("produces different expiry with remember=true", () => {
    const normal   = tokenService.sign(samplePayload, false);
    const remember = tokenService.sign(samplePayload, true);
    expect(remember.expiresAt).toBeGreaterThan(normal.expiresAt);
  });
});

describe("tokenService.verify", () => {
  it("returns the payload for a valid token", async () => {
    const { token } = tokenService.sign(samplePayload);
    const decoded = await tokenService.verify(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(1);
    expect(decoded?.username).toBe("testuser");
    expect(decoded?.modules).toEqual(["mail", "admin"]);
  });

  it("returns null for a tampered token", async () => {
    const { token } = tokenService.sign(samplePayload);
    const tampered = token.slice(0, -10) + "tampered!!";
    await expect(tokenService.verify(tampered)).resolves.toBeNull();
  });

  it("returns null for an empty string", async () => {
    await expect(tokenService.verify("")).resolves.toBeNull();
  });

  it("returns null for a completely invalid string", async () => {
    await expect(tokenService.verify("not.a.jwt")).resolves.toBeNull();
  });
});

describe("tokenService.verify — denylist + algorithm pinning", () => {
  beforeEach(() => {
    redisExists.mockClear();
    redisExists.mockResolvedValue(0);
  });

  it("rejects a token whose jti is on the denylist (revoked)", async () => {
    const { token } = tokenService.sign(samplePayload);
    redisExists.mockResolvedValueOnce(1); // key present ⇒ revoked
    await expect(tokenService.verify(token)).resolves.toBeNull();
    expect(redisExists).toHaveBeenCalledTimes(1);
    // Checked against the per-token jti namespace.
    expect(redisExists.mock.calls[0]![0]).toMatch(/^auth:revoked:jti:/);
  });

  it("accepts a valid token when its jti is NOT on the denylist", async () => {
    const { token } = tokenService.sign(samplePayload);
    const decoded = await tokenService.verify(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(1);
  });

  it("rejects the token when Redis is unavailable during the denylist check", async () => {
    const { token } = tokenService.sign(samplePayload);
    redisExists.mockRejectedValueOnce(new Error("redis down"));
    const decoded = await tokenService.verify(token);
    expect(decoded).toBeNull();
  });

  it("rejects a token forged with alg=none (algorithm confusion)", async () => {
    // header {alg:none}. base64url of {"alg":"none","typ":"JWT"} + a payload,
    // empty signature. verify() pins HS256 so this must be refused.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ ...samplePayload, jti: "x", iss: "luxipanel" })).toString("base64url");
    const forged = `${header}.${body}.`;
    await expect(tokenService.verify(forged)).resolves.toBeNull();
  });
});

describe("tokenService.revoke — denylist is append-only (no purge path)", () => {
  beforeEach(() => {
    redisSet.mockClear();
    redisDel.mockClear();
    redisSet.mockResolvedValue("OK");
  });

  it("adds the token's jti to the denylist with a bounded TTL (SET … PX)", async () => {
    const { token } = tokenService.sign(samplePayload);
    const ok = await tokenService.revoke(token);
    expect(ok).toBe(true);
    expect(redisSet).toHaveBeenCalledTimes(1);
    const [key, val, mode, ttl] = redisSet.mock.calls[0]! as [string, string, string, number];
    expect(key).toMatch(/^auth:revoked:jti:/);
    expect(val).toBe("1");
    expect(mode).toBe("PX");
    expect(ttl).toBeGreaterThan(0);
    // SECURITY: revoke only ADDS to the denylist. It never DELETEs — there is
    // no code path that un-revokes a jti, so a token can never purge another
    // session's revocation. (Logout is also gated by requireAuth, which fully
    // verifies the signature before revoke ever runs.)
    expect(redisDel).not.toHaveBeenCalled();
  });

  it("returns false for a token without a jti (nothing to key the denylist on)", async () => {
    // A raw jwt.sign without jwtid → no jti claim.
    const jwt = (await import("jsonwebtoken")).default;
    const noJti = jwt.sign({ userId: 1 }, ("test-" + "secret-key-with-at-least-32-characters-long"));
    const ok = await tokenService.revoke(noJti);
    expect(ok).toBe(false);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("is a no-op (returns true) for an already-expired token", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const expired = jwt.sign(
      { userId: 1 },
      ("test-" + "secret-key-with-at-least-32-characters-long"),
      { jwtid: "j1", expiresIn: -10 },
    );
    const ok = await tokenService.revoke(expired);
    expect(ok).toBe(true);
    expect(redisSet).not.toHaveBeenCalled(); // already dead; nothing to deny
  });
});

describe("tokenService.toSessionUser", () => {
  it("maps token payload to session user", async () => {
    const { token } = tokenService.sign(samplePayload);
    const decoded = (await tokenService.verify(token))!;
    const sessionUser = tokenService.toSessionUser(decoded);
    expect(sessionUser.userId).toBe(1);
    expect(sessionUser.username).toBe("testuser");
    expect(sessionUser.kind).toBe("admin");
    expect(sessionUser.modules).toContain("admin");
  });
});
