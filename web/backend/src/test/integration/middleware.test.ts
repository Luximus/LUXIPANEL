vi.mock("../../shared/redis/index.js", () => ({ getRedis: () => ({ exists: async () => 0, get: async () => null, set: async () => "OK", incr: async () => 1, publish: async () => 0 }) }));
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration tests — shared middleware behavior
 *
 * Tests error handler, 404 fallback, CSRF, and auth middleware
 * in isolation using a minimal Express app.
 */

import { describe, it, expect, vi } from "vitest";
vi.mock("../../modules/auth/services/live-authorization.service.js", () => ({ resolveLiveAuthorization: async (user: unknown) => user }));
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

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

vi.mock("../../modules/admin/services/module-registry.service.js", () => ({
  moduleRegistryService: {
    isEnabled: vi.fn(async () => true),
    getById: vi.fn((module: string) => ({ id: module, tag: "premium" })),
  },
}));

import { errorHandler } from "../../shared/errors/error-handler.js";
import {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors/index.js";
import { csrfProtection, csrfCookieSetter } from "../../modules/auth/middlewares/csrf.middleware.js";
import { requireAuth } from "../../modules/auth/middlewares/session.middleware.js";
import { requireModule } from "../../modules/auth/middlewares/require-module.middleware.js";
import { moduleRegistryService } from "../../modules/admin/services/module-registry.service.js";
import { signTestToken, TEST_ADMIN_PAYLOAD, TEST_USER_PAYLOAD } from "../helpers/token.helper.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  return app;
}

// ── Error handler ─────────────────────────────────────────────────────────

describe("Error handler middleware", () => {
  it("returns 400 for ValidationError", async () => {
    const app = buildApp();
    app.get("/test", () => { throw new ValidationError("Bad input"); });
    app.use(errorHandler);

    const res = await request(app).get("/test");
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 for AuthError", async () => {
    const app = buildApp();
    app.get("/test", () => { throw new AuthError("Not authenticated"); });
    app.use(errorHandler);

    const res = await request(app).get("/test");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_ERROR");
  });

  it("returns 403 for ForbiddenError", async () => {
    const app = buildApp();
    app.get("/test", () => { throw new ForbiddenError("Access denied"); });
    app.use(errorHandler);

    const res = await request(app).get("/test");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns 404 for NotFoundError", async () => {
    const app = buildApp();
    app.get("/test", () => { throw new NotFoundError("Item"); });
    app.use(errorHandler);

    const res = await request(app).get("/test");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("returns 500 for unexpected errors (does not leak message in production)", async () => {
    // The handler only masks unexpected error messages when NODE_ENV=production
    // (in dev/test it surfaces err.message to ease debugging).
    vi.stubEnv("NODE_ENV", "production");
    try {
      const app = buildApp();
      app.get("/test", () => { throw new Error("Unexpected!"); });
      app.use(errorHandler);

      const res = await request(app).get("/test");
      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      // Should not leak internal error message in production
      expect(res.body.error).not.toContain("Unexpected!");
      expect(res.body.error).toBe("Internal server error");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns custom statusCode for AppError subclasses", async () => {
    const app = buildApp();
    app.get("/test", () => { throw new AppError("Conflict", 409, "CONFLICT"); });
    app.use(errorHandler);

    const res = await request(app).get("/test");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });
});

// ── CSRF middleware ───────────────────────────────────────────────────────

describe("CSRF middleware", () => {
  const csrfCookieName = "luxipanel_csrf";

  function buildCsrfApp() {
    const app = buildApp();
    app.use(csrfCookieSetter);
    app.post("/protected", csrfProtection, (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);
    return app;
  }

  it("sets CSRF cookie on requests", async () => {
    const app = buildCsrfApp();
    const res = await request(app).post("/protected");
    const cookies = res.headers["set-cookie"];
    const hasCsrf = Array.isArray(cookies)
      ? cookies.some((c: string) => c.startsWith(csrfCookieName))
      : typeof cookies === "string" && cookies.startsWith(csrfCookieName);
    expect(hasCsrf).toBe(true);
  });

  it("returns 403 when CSRF token is missing", async () => {
    const app = buildCsrfApp();
    const res = await request(app)
      .post("/protected")
      .set("Cookie", `${csrfCookieName}=some-token`);
    // No X-CSRF-Token header
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_ERROR");
  });

  it("returns 403 when cookie and header do not match", async () => {
    const app = buildCsrfApp();
    const res = await request(app)
      .post("/protected")
      .set("Cookie", `${csrfCookieName}=cookie-token`)
      .set("X-CSRF-Token", "different-header-token");

    expect(res.status).toBe(403);
  });

  it("passes when cookie and header match", async () => {
    const app = buildCsrfApp();
    const csrfToken = "matching-token-12345";

    const res = await request(app)
      .post("/protected")
      .set("Cookie", `${csrfCookieName}=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("allows GET requests through without CSRF check", async () => {
    const app = buildApp();
    app.use(csrfCookieSetter);
    app.get("/safe", csrfProtection, (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);

    const res = await request(app).get("/safe"); // No CSRF token needed
    expect(res.status).toBe(200);
  });
});

// ── Auth middleware ───────────────────────────────────────────────────────

describe("requireAuth middleware", () => {
  function buildAuthApp() {
    const app = buildApp();
    app.get("/protected", requireAuth, (_req, res) => {
      res.json({ ok: true, user: (res.locals as { user: unknown }).user });
    });
    app.use(errorHandler);
    return app;
  }

  it("returns 401 with no token", async () => {
    const res = await request(buildAuthApp()).get("/protected");
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const res = await request(buildAuthApp())
      .get("/protected")
      .set("Authorization", "Bearer invalid.jwt.token");
    expect(res.status).toBe(401);
  });

  it("populates res.locals.user with valid token", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const res = await request(buildAuthApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(TEST_ADMIN_PAYLOAD.userId);
    expect(res.body.user.username).toBe("test-admin");
  });

  it("reads token from cookie", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const res = await request(buildAuthApp())
      .get("/protected")
      .set("Cookie", `luxipanel_session=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(1);
  });
});

// ── requireModule middleware ──────────────────────────────────────────────

describe("requireModule middleware", () => {
  function buildModuleApp(requiredModule: string) {
    const app = buildApp();
    app.get(
      "/protected",
      requireAuth,
      requireModule(requiredModule),
      (_req, res) => { res.json({ ok: true }); },
    );
    app.use(errorHandler);
    return app;
  }

  it("allows access when user has the required module", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD); // has all modules
    const res = await request(buildModuleApp("mail"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it("returns 403 when user lacks the required module", async () => {
    const token = signTestToken(TEST_USER_PAYLOAD); // only has "mail"
    const res = await request(buildModuleApp("admin"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns 403 when user has no modules at all", async () => {
    const token = signTestToken({ ...TEST_USER_PAYLOAD, modules: [] });
    const res = await request(buildModuleApp("mail"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 when the module is disabled", async () => {
    vi.mocked(moduleRegistryService.isEnabled).mockResolvedValueOnce(false);
    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const res = await request(buildModuleApp("mail"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
