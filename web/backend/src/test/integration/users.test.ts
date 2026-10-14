vi.mock("../../shared/redis/index.js", () => ({ getRedis: () => ({ exists: async () => 0, get: async () => null, set: async () => "OK", incr: async () => 1, publish: async () => 0 }) }));
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration tests — Users & Roles endpoints
 *
 * Verifies authentication guards, module permission guards,
 * and basic CRUD response shapes with mocked repositories.
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// ── Mocks ────────────────────────────────────────────────────────────────

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

vi.mock("../../modules/auth/repositories/panel-user.repository.js", () => ({
  panelUserRepository: {
    findAll: vi.fn().mockResolvedValue([]),
    // preferencesController.get 404s when the user record does not exist, so
    // the default mock must return a user for the authenticated userId.
    findById: vi.fn().mockResolvedValue({
      id: 2,
      username: "test-user",
      displayName: "Test User",
      phoneE164: null,
      createdAt: new Date(),
    }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("../../modules/users/repositories/role.repository.js", () => ({
  roleRepository: {
    findAll: vi.fn().mockResolvedValue([
      { id: 1, name: "admin", description: "Administrator", modules: ["admin", "mail"], createdAt: new Date() },
    ]),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../modules/users/repositories/preferences.repository.js", () => ({
  preferencesRepository: {
    findByUserId: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../modules/users/services/users.service.js", () => ({
  usersService: {
    list: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    changePassword: vi.fn().mockResolvedValue(undefined),
    changeOwnPassword: vi.fn().mockResolvedValue(undefined),
    getPreferences: vi.fn().mockResolvedValue({ theme: "dark" }),
    updatePreferences: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../modules/users/services/roles.service.js", () => ({
  rolesService: {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    seedDefaults: vi.fn().mockResolvedValue(undefined),
    validateModules: vi.fn(),
  },
}));

vi.mock("../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
  Events: { USER_CREATED: "user:created", USER_DELETED: "user:deleted" },
}));

vi.mock("../../modules/auth/repositories/index.js", () => ({
  panelUserRepository: {
    findByUsername: vi.fn(),
    findAllWithRoles: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  auditRepository: { append: vi.fn().mockResolvedValue(undefined) },
}));

// ── Imports ───────────────────────────────────────────────────────────────

import { buildTestApp } from "../helpers/app.helper.js";
import { registerUsersModule } from "../../modules/users/index.js";
import {
  signTestToken,
  TEST_ADMIN_PAYLOAD,
  TEST_USER_PAYLOAD,
} from "../helpers/token.helper.js";

const app = buildTestApp([registerUsersModule]);

const adminAuth = () => `Bearer ${signTestToken(TEST_ADMIN_PAYLOAD)}`;
const userAuth  = () => `Bearer ${signTestToken(TEST_USER_PAYLOAD)}`;

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user (no users module)", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", userAuth());
    // TEST_USER_PAYLOAD only has "mail" module, not "users"
    expect(res.status).toBe(403);
  });

  it("returns 200 for admin user", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("GET /api/roles", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/roles");
    expect(res.status).toBe(401);
  });

  it("returns 200 for admin user with roles list", async () => {
    const { rolesService } = vi.mocked(
      await import("../../modules/users/services/roles.service.js"),
    );
    vi.mocked(rolesService.list).mockResolvedValue([
      { id: 1, name: "admin", description: "Superadmin", modules: ["admin"], createdAt: new Date() },
    ] as never);

    const res = await request(app)
      .get("/api/roles")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("GET /api/preferences", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/preferences");
    expect(res.status).toBe(401);
  });

  it("returns 200 for any authenticated user", async () => {
    const res = await request(app)
      .get("/api/preferences")
      .set("Authorization", userAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
