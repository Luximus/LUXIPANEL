// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — system-deps module HTTP contract.
 *
 * Locks:
 *   - an unknown `:module` → 404 `{ ok:false, error:"UNKNOWN_MODULE" }`
 *     BEFORE any entitlement check (never feed arbitrary input downstream).
 *   - the entitlement-slug remap (`nginx → dns`, `backup → backups`) is applied
 *     when delegating to `requireModule`.
 *   - GET returns `{ ok, data }` from `checkModuleDependencies`; a null result
 *     (module vanished) → 404 UNKNOWN_MODULE.
 *   - POST install echoes `{ ok, code, data:{ results, output, code } }` so the
 *     shared install-modal / withSudo helper can drive the sudo prompt — and it
 *     is ALWAYS HTTP 200, even for a SUDO_PASSWORD_REQUIRED outcome.
 *
 * `requireModule` and `csrfProtection` are stubbed to pass-through so this test
 * exercises the module's own routing/controller logic, not the shared gates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.helper.js";
import { authHeader } from "../helpers/token.helper.js";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("../../shared/executor/factory.js", async () =>
  (await import("../helpers/executor.helper.js")).executorFactoryMock());

vi.mock("../../config/auth.js", () => ({
  authConfig: {
    jwt: { secret: "test-secret-key-at-least-32-characters-long!!", expiresIn: "1h", rememberExpiresIn: "7d" },
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

vi.mock("../../modules/auth/repositories/index.js", () => ({
  panelUserRepository: { findAllWithRoles: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  auditRepository: { append: vi.fn().mockResolvedValue(undefined) },
}));

// Spyable pass-through for requireModule so we can assert the entitlement slug.
// vi.hoisted: the spy must exist before the hoisted vi.mock factory runs.
const { requireModuleFactory } = vi.hoisted(() => ({
  requireModuleFactory: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));
vi.mock("../../modules/auth/middlewares/require-module.middleware.js", () => ({
  requireModule: requireModuleFactory,
}));
vi.mock("../../modules/auth/middlewares/csrf.middleware.js", () => ({
  csrfProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Dependency registry seam.
vi.mock("../../shared/system/module-deps.js", () => ({
  isKnownDepsModule: vi.fn(),
  checkModuleDependencies: vi.fn(),
  installModuleDependencies: vi.fn(),
}));

import { systemDepsRouter } from "../../modules/system-deps/routes/system-deps.routes.js";
import {
  isKnownDepsModule,
  checkModuleDependencies,
  installModuleDependencies,
} from "../../shared/system/module-deps.js";

const app = buildTestApp([(a) => a.use(systemDepsRouter)]);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: every module id in these tests is "known".
  vi.mocked(isKnownDepsModule).mockReturnValue(true);
});

describe("system-deps — param gate", () => {
  it("401 without a session", async () => {
    const res = await request(app).get("/api/system-deps/mail");
    expect(res.status).toBe(401);
  });

  it("404 UNKNOWN_MODULE for an unregistered module (before entitlement)", async () => {
    vi.mocked(isKnownDepsModule).mockReturnValue(false);
    const res = await request(app)
      .get("/api/system-deps/bogus")
      .set("Authorization", authHeader());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "UNKNOWN_MODULE" });
    expect(requireModuleFactory).not.toHaveBeenCalled();
    expect(vi.mocked(checkModuleDependencies)).not.toHaveBeenCalled();
  });

  it("remaps entitlement slugs (nginx → dns, backup → backups)", async () => {
    vi.mocked(checkModuleDependencies).mockResolvedValue({ module: "nginx" } as never);
    await request(app).get("/api/system-deps/nginx").set("Authorization", authHeader());
    expect(requireModuleFactory).toHaveBeenCalledWith("dns");

    requireModuleFactory.mockClear();
    vi.mocked(checkModuleDependencies).mockResolvedValue({ module: "backup" } as never);
    await request(app).get("/api/system-deps/backup").set("Authorization", authHeader());
    expect(requireModuleFactory).toHaveBeenCalledWith("backups");
  });

  it("passes a non-remapped id straight to requireModule", async () => {
    vi.mocked(checkModuleDependencies).mockResolvedValue({ module: "mail" } as never);
    await request(app).get("/api/system-deps/mail").set("Authorization", authHeader());
    expect(requireModuleFactory).toHaveBeenCalledWith("mail");
  });
});

describe("system-deps — GET status", () => {
  it("returns { ok, data } from checkModuleDependencies", async () => {
    const data = { module: "mail", dependencies: [], allRequiredInstalled: true, anyInstalled: false };
    vi.mocked(checkModuleDependencies).mockResolvedValue(data as never);
    const res = await request(app).get("/api/system-deps/mail").set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data });
  });

  it("404 UNKNOWN_MODULE when the registry lookup returns null", async () => {
    vi.mocked(checkModuleDependencies).mockResolvedValue(null as never);
    const res = await request(app).get("/api/system-deps/mail").set("Authorization", authHeader());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "UNKNOWN_MODULE" });
  });
});

describe("system-deps — POST install", () => {
  it("echoes the install result inside data (HTTP 200 on success)", async () => {
    const result = {
      ok: true,
      code: "OK",
      results: [{ key: "dovecot", ok: true }],
      output: "=== done ===",
    };
    vi.mocked(installModuleDependencies).mockResolvedValue(result as never);
    const res = await request(app)
      .post("/api/system-deps/mail/install")
      .set("Authorization", authHeader())
      .send({ keys: ["dovecot"] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      code: "OK",
      data: { results: result.results, output: result.output, code: "OK" },
    });
  });

  it("still returns HTTP 200 when a sudo password is required", async () => {
    const result = {
      ok: false,
      code: "SUDO_PASSWORD_REQUIRED",
      results: [{ key: "dovecot", ok: false, code: "SUDO_PASSWORD_REQUIRED" }],
      output: "=== Dovecot ===",
    };
    vi.mocked(installModuleDependencies).mockResolvedValue(result as never);
    const res = await request(app)
      .post("/api/system-deps/mail/install")
      .set("Authorization", authHeader())
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("SUDO_PASSWORD_REQUIRED");
    expect(res.body.data.code).toBe("SUDO_PASSWORD_REQUIRED");
  });

  it("404 UNKNOWN_MODULE when install can't resolve the module", async () => {
    vi.mocked(installModuleDependencies).mockResolvedValue(null as never);
    const res = await request(app)
      .post("/api/system-deps/mail/install")
      .set("Authorization", authHeader())
      .send({});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "UNKNOWN_MODULE" });
  });
});
