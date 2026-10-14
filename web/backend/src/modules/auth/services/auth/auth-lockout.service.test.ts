// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — auth/services/auth/auth-lockout.service.ts
 *
 * Characterizes the shared failed-login lockout counter (security path):
 * case-insensitive keying (no bypass by changing username case), the 30-minute
 * window set on the first failure, and the threshold/lock semantics of the
 * shared message formatter (incl. admin-disabled lockout = threshold <= 0).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
const incr = vi.fn(async (k: string) => {
  const n = (Number.parseInt(store.get(k) ?? "0", 10) || 0) + 1;
  store.set(k, String(n));
  return n;
});
const expire = vi.fn(async (_k: string, _s: number) => 1);
const del = vi.fn(async (k: string) => (store.delete(k) ? 1 : 0));
const get = vi.fn(async (k: string) => store.get(k) ?? null);

vi.mock("../../../../shared/redis/index.js", () => ({
  getRedis: () => ({ incr, expire, del, get }),
}));

const read = vi.fn(async () => ({ maxFailedLoginAttempts: 5 }));
vi.mock("../../../admin/services/security-settings.service.js", () => ({
  securitySettingsService: { read: () => read() },
}));

vi.mock("./auth-audit.service.js", () => ({
  authAuditService: { logAudit: vi.fn(async () => undefined) },
}));

import {
  getFailedCount,
  bumpFailedCount,
  clearFailedCount,
  bumpAndFormatFailedMessage,
  resolveLockScope,
} from "./auth-lockout.service.js";

beforeEach(() => {
  store.clear();
  incr.mockClear();
  expire.mockClear();
  del.mockClear();
  read.mockClear();
  read.mockResolvedValue({ maxFailedLoginAttempts: 5 });
});

describe("failed-login counter keying", () => {
  it("counts username case-insensitively (no lockout bypass by changing case)", async () => {
    await bumpFailedCount("local", "Alice");
    await bumpFailedCount("local", "alice");
    await bumpFailedCount("local", "ALICE");
    expect(await getFailedCount("local", "alice")).toBe(3);
  });

  it("scopes the counter per (scope, username) so different panels don't share buckets", async () => {
    await bumpFailedCount("boxA", "bob");
    await bumpFailedCount("boxB", "bob");
    expect(await getFailedCount("boxA", "bob")).toBe(1);
    expect(await getFailedCount("boxB", "bob")).toBe(1);
  });

  it("sets the 30-minute window only on the first failure", async () => {
    await bumpFailedCount("local", "carol"); // 1 → sets expire
    await bumpFailedCount("local", "carol"); // 2 → no re-arm
    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledWith(expect.stringContaining("carol"), 30 * 60);
  });

  it("clears the counter on success", async () => {
    await bumpFailedCount("local", "dave");
    await clearFailedCount("local", "dave");
    expect(del).toHaveBeenCalledTimes(1);
    expect(await getFailedCount("local", "dave")).toBe(0);
  });
});

describe("bumpAndFormatFailedMessage — threshold semantics", () => {
  it("locks the account once the failure count reaches the threshold", async () => {
    read.mockResolvedValue({ maxFailedLoginAttempts: 2 });
    const first = await bumpAndFormatFailedMessage("local", "eve", "Credenciales inválidas");
    expect(first.locked).toBe(false);
    const second = await bumpAndFormatFailedMessage("local", "eve", "Credenciales inválidas");
    expect(second.locked).toBe(true);
    expect(second.message).toContain("bloqueada");
  });

  it("never locks when the admin disabled lockout (threshold <= 0)", async () => {
    read.mockResolvedValue({ maxFailedLoginAttempts: 0 });
    for (let i = 0; i < 10; i++) {
      const r = await bumpAndFormatFailedMessage("local", "frank", "nope");
      expect(r.locked).toBe(false);
      expect(r.message).toBe("nope"); // no remaining-attempts suffix
    }
  });

  it("reports remaining attempts before the lock trips", async () => {
    read.mockResolvedValue({ maxFailedLoginAttempts: 5 });
    const r = await bumpAndFormatFailedMessage("local", "grace", "bad");
    expect(r.failedCount).toBe(1);
    expect(r.threshold).toBe(5);
    expect(r.message).toContain("4 intentos restantes");
  });
});

describe("resolveLockScope", () => {
  it("falls back to 'local' when the host has no subdomain", () => {
    expect(resolveLockScope(undefined)).toBe("local");
    expect(resolveLockScope("example.com")).toBe("local");
  });
});
