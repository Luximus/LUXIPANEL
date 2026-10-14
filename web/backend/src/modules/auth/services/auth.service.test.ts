// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — auth/services/auth.service.ts
 *
 * Tests the pure business logic in computeModules and buildTokenPayload.
 * login() is excluded because it requires DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock dependencies ----
vi.mock("../../../config/auth.js", () => ({
  authConfig: {
    jwt: {
      secret: "test-secret-at-least-32-characters-long!",
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

vi.mock("../repositories/index.js", () => ({
  panelUserRepository: {
    findByUsername: vi.fn(),
    findById: vi.fn().mockResolvedValue(undefined),
  },
  auditRepository: {
    append: vi.fn().mockResolvedValue(undefined),
  },
  totpRepository: {
    getByUser: vi.fn(),
  },
}));

// Group permission records (real Linux groups) — the source of group-union perms.
vi.mock("../../users/repositories/role.repository.js", () => ({
  roleRepository: {
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../admin/services/security-settings.service.js", () => ({
  securitySettingsService: {
    read: vi.fn(),
    write: vi.fn(),
  },
}));

vi.mock("./token.service.js", () => ({
  tokenService: {
    sign: vi.fn().mockReturnValue({ token: "full-token", expiresAt: 123456 }),
    signWithExpiry: vi.fn().mockReturnValue({ token: "full-token", expiresAt: 123456 }),
    signPartial: vi.fn().mockReturnValue({ token: "partial-token", expiresAt: 654321 }),
    setSessionCookie: vi.fn(),
  },
  parseDuration: (_value: string, fallback = 86_400_000) => fallback,
}));

vi.mock("../../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
  Events: {
    AUTH_LOGIN_SUCCESS: "auth:login_success",
    ROLE_CREATED: "users:role:created",
    ROLE_UPDATED: "users:role:updated",
    ROLE_DELETED: "users:role:deleted",
  },
}));

// login-acl mirror — `refresh` is fire-and-forget in buildTokenPayload's admin
// branch. We force it to reject to prove the detached call is `.catch()`-ed and
// never bubbles up as an unhandledRejection (which server.ts turns into a crash).
vi.mock("./login-acl.service.js", () => ({
  loginAclService: {
    read: vi.fn().mockResolvedValue(null),
    refresh: vi.fn().mockRejectedValue(new Error("ssh transient failure")),
  },
}));

import { authService, invalidateRolesCache } from "./auth.service.js";
import { loginAclService } from "./login-acl.service.js";
import { securitySettingsService } from "../../admin/services/security-settings.service.js";
import { auditRepository, totpRepository } from "../repositories/index.js";
import { roleRepository } from "../../users/repositories/role.repository.js";

import type { SecuritySettings } from "../../admin/services/security-settings.service.js";

/** Full SecuritySettings with overrides — securitySettingsService.read mock. */
function settings(overrides: Partial<SecuritySettings> = {}): SecuritySettings {
  return {
    requireTwoFa: false,
    auditLogEnabled: true,
    sessionDurationHours: 1,
    maxFailedLoginAttempts: 5,
    loginAllowPassword: true,
    loginAllowPasskey: false,
    loginAllowRecovery: false,
    ...overrides,
  };
}
import { tokenService } from "./token.service.js";

describe("authService.computeModules", () => {
  it("returns parsed modules from JSON string", () => {
    const modules = authService.computeModules({ modules: '["mail","admin"]' });
    expect(modules).toEqual(["mail", "admin"]);
  });

  it("returns empty array for null modules", () => {
    expect(authService.computeModules({ modules: null })).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(authService.computeModules({ modules: "not-json" })).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(authService.computeModules({ modules: '{"key":"value"}' })).toEqual([]);
  });
});

describe("authService.buildTokenPayload", () => {
  // The per-target role list is memoized (60s TTL); tests reuse the "local"
  // target, so clear it between cases to honor each `mockResolvedValueOnce`.
  beforeEach(() => {
    invalidateRolesCache();
  });

  it("keeps the reserved real admin group administrative with an explicit matrix", async () => {
    vi.mocked(roleRepository.findAll).mockResolvedValueOnce([
      { id: 1, name: "admin", modules: ["admin"], permissions: { views: ["panel.files"], actions: ["files.read"] } },
    ] as never);
    const payload = await authService.buildTokenPayload({ id: 1, username: "alice", groups: ["admin"] });
    expect(payload.kind).toBe("admin");
  });

  it("uses user-level modules if present", async () => {
    const payload = await authService.buildTokenPayload({
      id: 1,
      username: "alice",
      displayName: "Alice",
      roleId: null,
      modules: '["mail","admin"]',
    });

    expect(payload.modules).toEqual(["mail", "admin"]);
    expect(payload.kind).toBe("admin"); // has "admin" module
  });

  it("derives modules from the user's Linux groups when no override", async () => {
    vi.mocked(roleRepository.findAll).mockResolvedValueOnce([
      { id: 1, name: "mail-operator", description: null, modules: ["mail", "users"], permissions: {} },
    ] as never);

    const payload = await authService.buildTokenPayload({
      id: 5,
      username: "bob",
      displayName: "Bob",
      modules: null,
      groups: ["mail-operator"],
    });

    expect(payload.modules).toContain("mail");
    expect(payload.modules).toContain("users");
    expect(payload.kind).toBe("user"); // no "admin" module
  });

  it("kind is admin when a group's record carries the admin module", async () => {
    vi.mocked(roleRepository.findAll).mockResolvedValueOnce([
      { id: 1, name: "admin", description: null, modules: ["admin", "mail"], permissions: {} },
    ] as never);

    const payload = await authService.buildTokenPayload({
      id: 6,
      username: "owner",
      displayName: null,
      modules: null,
      groups: ["admin"],
    });

    expect(payload.kind).toBe("admin");
  });

  it("empty group-union falls back to dashboard-only", async () => {
    vi.mocked(roleRepository.findAll).mockResolvedValueOnce([] as never);

    const payload = await authService.buildTokenPayload({
      id: 7,
      username: "newbie",
      displayName: null,
      modules: null,
      groups: [],
    });

    expect(payload.kind).toBe("user");
    expect(payload.modules).toEqual([]);
    expect(payload.permissions?.sidebar).toContain("dashboard");
  });

  it("sets displayName to username when displayName is null", async () => {
    const payload = await authService.buildTokenPayload({
      id: 1,
      username: "charlie",
      displayName: null,
      roleId: null,
      modules: '["admin"]',
    });

    expect(payload.displayName).toBe("charlie");
  });

  it("kind is admin when modules includes admin", async () => {
    const payload = await authService.buildTokenPayload({
      id: 1,
      username: "superadmin",
      displayName: null,
      roleId: null,
      modules: '["admin","mail","users"]',
    });

    expect(payload.kind).toBe("admin");
  });

  it("kind is user when modules do not include admin", async () => {
    const payload = await authService.buildTokenPayload({
      id: 2,
      username: "mailop",
      displayName: null,
      roleId: null,
      modules: '["mail","users"]',
    });

    expect(payload.kind).toBe("user");
  });

  it("a rejected loginAclService.refresh does NOT produce an unhandledRejection", async () => {
    // server.ts turns unhandledRejection into process.exit(1) = full backend
    // crash. The admin branch fires `loginAclService.refresh` detached; a
    // transient SSH failure there must be swallowed by its `.catch()`.
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const payload = await authService.buildTokenPayload({
        id: 99,
        username: "owner",
        displayName: null,
        roleId: null,
        modules: '["admin"]', // forces the isAdmin branch that calls refresh
      });
      expect(payload.kind).toBe("admin");
      expect(vi.mocked(loginAclService.refresh)).toHaveBeenCalled();

      // Let the rejected (but caught) promise settle, then flush microtasks so
      // any would-be unhandledRejection has had a chance to fire.
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

describe("authService.buildLoginResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a full session when 2FA is not required and TOTP is disabled", async () => {
    vi.mocked(securitySettingsService.read).mockResolvedValue(settings({ requireTwoFa: false }));
    vi.mocked(totpRepository.getByUser).mockResolvedValue({ enabled: false } as never);

    const result = await authService.buildLoginResponse(
      { id: 1, username: "alice", displayName: "Alice", roleId: null, modules: '["mail"]' },
      false,
      {} as never,
    );

    expect(result).toEqual({ mfaPending: false, expiresAt: 123456 });
    expect(tokenService.signWithExpiry).toHaveBeenCalled();
    expect(tokenService.signPartial).not.toHaveBeenCalled();
  });

  it("requires TOTP when the global 2FA setting is enabled", async () => {
    vi.mocked(securitySettingsService.read).mockResolvedValue(settings({ requireTwoFa: true }));
    vi.mocked(totpRepository.getByUser).mockResolvedValue({ enabled: false } as never);

    await expect(
      authService.buildLoginResponse(
        { id: 1, username: "alice", displayName: "Alice", roleId: null, modules: '["mail"]' },
        false,
        {} as never,
      ),
    ).rejects.toThrow("requiere 2FA");
  });

  it("keeps the MFA pending flow when global 2FA is enabled and TOTP exists", async () => {
    vi.mocked(securitySettingsService.read).mockResolvedValue(settings({ requireTwoFa: true }));
    vi.mocked(totpRepository.getByUser).mockResolvedValue({ enabled: true } as never);

    const result = await authService.buildLoginResponse(
      { id: 1, username: "alice", displayName: "Alice", roleId: null, modules: '["mail"]' },
      true,
      {} as never,
    );

    expect(result).toEqual({ mfaPending: true });
    expect(tokenService.signPartial).toHaveBeenCalled();
    expect(tokenService.sign).not.toHaveBeenCalled();
  });
});

describe("authService.logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips audit writes when audit logging is disabled", async () => {
    vi.mocked(securitySettingsService.read).mockResolvedValue(settings({ auditLogEnabled: false }));

    await authService.logAudit(
      "login_success",
      1,
      "info",
      { ip: "127.0.0.1", userAgent: "test" },
      { foo: "bar" },
    );

    expect(vi.mocked(auditRepository.append)).not.toHaveBeenCalled();
    expect(vi.mocked(securitySettingsService.read)).toHaveBeenCalled();
  });

  it("writes audit entries when audit logging is enabled", async () => {
    vi.mocked(securitySettingsService.read).mockResolvedValue(settings({ auditLogEnabled: true }));

    await authService.logAudit(
      "login_success",
      1,
      "info",
      { ip: "127.0.0.1", userAgent: "test" },
      { foo: "bar" },
    );

    expect(vi.mocked(securitySettingsService.read)).toHaveBeenCalled();
    expect(vi.mocked(auditRepository.append)).toHaveBeenCalledTimes(1);
  });
});
