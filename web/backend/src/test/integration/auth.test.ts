// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration tests — Auth module endpoints
 *
 * All DB/Redis operations are mocked. Tests verify HTTP behavior:
 * status codes, response shape, cookie setting, CSRF enforcement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Mocks (must come before module imports) ──────────────────────────────

// Managed-only: requireAuth resolves a per-server executor. No real SSH
// target in tests → mock the factory to a benign fake executor.
vi.mock("../../shared/executor/factory.js", async () =>
  (await import("../helpers/executor.helper.js")).executorFactoryMock());

vi.mock("../../config/auth.js", () => ({
  authConfig: {
    jwt: {
      secret: "test-secret-key-at-least-32-characters-long!!",
      expiresIn: "1h",
      rememberExpiresIn: "7d",
    },
    cookie: {
      sessionName: "luxipanel_session",
      csrfName: "luxipanel_csrf",
      secure: false,
      sameSite: "lax" as const,
      domain: "",
      legacyDomains: [],
    },
  },
}));

vi.mock("../../modules/auth/services/hcaptcha.service.js", () => ({
  hcaptchaService: {
    verify: vi.fn().mockResolvedValue(undefined),
  },
}));

// POST /api/login enforces the per-panel login-methods policy (resolved via
// LP in managed mode) before authenticating; without this mock the resolver
// can't reach LP and password login is reported as disabled → 403.
vi.mock("../../modules/auth/services/login-methods.service.js", () => ({
  resolveEffectiveLoginMethods: vi.fn().mockResolvedValue({
    password: true,
    passkey: true,
    otp: true,
    qr: true,
    recovery: true,
  }),
}));

vi.mock("../../modules/auth/services/auth.service.js", () => ({
  authService: {
    // LUXIPANEL is self-hosted (standalone multi-node): login goes through
    // `loginLocal` (PAM against the host's real Linux accounts), NOT through
    // the legacy managed-mode `login()` (which used SSH handshakes to the
    // LP-LICENSE-SERVER SSH key). The controller calls `loginLocal`.
    loginLocal: vi.fn(),
    computeModules: vi.fn().mockReturnValue([]),
    buildTokenPayload: vi.fn(),
    buildLoginResponse: vi.fn().mockImplementation(async (_user, _remember, res) => {
      res.cookie("luxipanel_session", "fake-session-token");
      return { mfaPending: false, expiresAt: Date.now() + 3600000 };
    }),
    logAudit: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
  Events: { AUTH_LOGIN_SUCCESS: "auth:login_success" },
}));

vi.mock("../../modules/auth/repositories/index.js", () => ({
  panelUserRepository: {
    findByUsername: vi.fn(),
    findAllWithRoles: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  auditRepository: {
    append: vi.fn().mockResolvedValue(undefined),
  },
  passkeyRepository: {},
  otpRepository: {},
  recoveryRepository: {},
  totpRepository: {
    getByUser: vi.fn(),
    enable: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock compartido: implementa `call` (lo usa el RedisStore del rate-limiter) y
// `exists` (denylist de jti en tokenService.verify). Un stub con solo get/set
// hace que toda request acabe en 500 ("client.call is not a function").
vi.mock("../../shared/redis/index.js", () => import("../helpers/redis.mock.js"));

// ── Imports after mocks ───────────────────────────────────────────────────

import { buildTestApp } from "../helpers/app.helper.js";
import { registerAuthModule } from "../../modules/auth/index.js";
import { authService } from "../../modules/auth/services/auth.service.js";
import { totpRepository } from "../../modules/auth/repositories/index.js";
import { signTestToken, TEST_ADMIN_PAYLOAD } from "../helpers/token.helper.js";
import { getCookieValue } from "../helpers/app.helper.js";

const app = buildTestApp([registerAuthModule]);

// ── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and sets session cookie on valid credentials", async () => {
    const csrfToken = "test-csrf-token-12345";
    vi.mocked(authService.loginLocal).mockResolvedValue({
      id: TEST_ADMIN_PAYLOAD.userId,
      username: TEST_ADMIN_PAYLOAD.username,
      displayName: TEST_ADMIN_PAYLOAD.displayName,
      roleId: null,
      modules: null,
      groups: [],
      bridge: {
        bridgeSessionId: "test-bridge",
        targetId: "local",
        targetName: "Local",
        sshUsername: TEST_ADMIN_PAYLOAD.username,
        local: true,
      },
    });

    const res = await request(app)
      .post("/api/login")
      .set("Content-Type", "application/json")
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ user: "admin", pass: "ValidPass1" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.expiresAt).toBeGreaterThan(Date.now());

    // Session cookie should be set
    const sessionCookie = getCookieValue(
      res.headers as Record<string, string | string[]>,
      "luxipanel_session",
    );
    expect(sessionCookie).not.toBeNull();
  });

  it("returns 400 for missing username", async () => {
    const csrfToken = "test-csrf-token-12345";
    const res = await request(app)
      .post("/api/login")
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ pass: "ValidPass1" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("returns 401 when authService.loginLocal throws AuthError", async () => {
    const { AuthError } = await import("../../shared/errors/index.js");
    const csrfToken = "test-csrf-token-12345";
    vi.mocked(authService.loginLocal).mockRejectedValue(new AuthError("Invalid credentials"));

    const res = await request(app)
      .post("/api/login")
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ user: "admin", pass: "WrongPass9" });

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});

describe("GET /api/session", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/session");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("returns 200 with a valid Bearer token", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const res = await request(app)
      .get("/api/session")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.username).toBe("test-admin");
    expect(res.body.user.kind).toBe("admin");
  });

  it("returns 401 with a tampered token", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const tampered = token.slice(0, -8) + "xxxxxxxx";

    const res = await request(app)
      .get("/api/session")
      .set("Authorization", `Bearer ${tampered}`);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/logout", () => {
  it("returns 401 without authentication", async () => {
    const res = await request(app).post("/api/logout");
    expect(res.status).toBe(401);
  });

  it("succeeds without CSRF token (logout is idempotent, no CSRF gate)", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD);

    // Logout no longer requires CSRF: clearing your own cookie is idempotent,
    // and requiring CSRF bounced users whose CSRF cookie was never set.
    const res = await request(app)
      .post("/api/logout")
      .set("Cookie", `luxipanel_session=${token}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 200 when authenticated with valid CSRF token", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const csrfToken = "test-csrf-token-12345";

    const res = await request(app)
      .post("/api/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("POST /api/auth/otp/request", () => {
  it("is a public endpoint (no auth required)", async () => {
    vi.mock("../../modules/auth/services/otp.service.js", () => ({
      otpService: {
        request: vi.fn().mockResolvedValue(undefined),
      },
    }));

    const res = await request(app)
      .post("/api/auth/otp/request")
      .send({ username: "admin" });

    // Should not return 401
    expect(res.status).not.toBe(401);
  });
});

describe("PATCH /api/auth/totp/disable", () => {
  it("disables TOTP without deleting the secret", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const csrfToken = "test-csrf-token-12345";

    const res = await request(app)
      .patch("/api/auth/totp/disable")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(totpRepository.disable).toHaveBeenCalledTimes(1);
    expect(totpRepository.remove).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/auth/totp/activate", () => {
  it("activates an existing TOTP secret for login prompts", async () => {
    vi.mocked(totpRepository.getByUser).mockResolvedValue({
      enabled: false,
      secret: "TESTSECRET",
    } as never);

    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const csrfToken = "test-csrf-token-12345";

    const res = await request(app)
      .patch("/api/auth/totp/activate")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(totpRepository.enable).toHaveBeenCalledTimes(1);
  });
});
