vi.mock("../../shared/redis/index.js", () => ({ getRedis: () => ({ exists: async () => 0, get: async () => null, set: async () => "OK", incr: async () => 1, publish: async () => 0 }) }));
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration tests — `GET/PUT /api/preferences/chat` (Block E).
 *
 * Contract under test:
 *   • GET always returns the COMPLETE object (defaults deep-merged with what is
 *     stored) — the client never has to know the defaults.
 *   • PUT validates with Zod (400 on an out-of-enum value) and merges PER
 *     SECTION, so a one-key patch cannot wipe the other sections.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
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
    findById: vi.fn().mockResolvedValue({
      id: 2,
      username: "test-user",
      displayName: "Test User",
      phoneE164: null,
      createdAt: new Date(),
    }),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("../../modules/auth/repositories/index.js", () => ({
  panelUserRepository: { findByUsername: vi.fn(), findAllWithRoles: vi.fn().mockResolvedValue([]) },
  auditRepository: { append: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../modules/users/repositories/role.repository.js", () => ({
  roleRepository: { findAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../modules/users/services/roles.service.js", () => ({
  rolesService: { list: vi.fn().mockResolvedValue([]), seedDefaults: vi.fn() },
}));

vi.mock("../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
  Events: {},
}));

/** In-memory stand-in for the preferences sidecar (per test). */
let storedPrefs: Record<string, unknown> = {};

vi.mock("../../modules/users/services/users.service.js", () => ({
  usersService: {
    list: vi.fn(),
    getById: vi.fn(),
    getPreferences: vi.fn(async () => storedPrefs),
    updatePreferences: vi.fn(async (_userId: number, patch: Record<string, unknown>) => {
      storedPrefs = { ...storedPrefs, ...patch };
      return storedPrefs;
    }),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────

import { buildTestApp } from "../helpers/app.helper.js";
import { registerUsersModule } from "../../modules/users/index.js";
import { signTestToken, TEST_USER_PAYLOAD } from "../helpers/token.helper.js";
import { CHAT_PREFERENCES_DEFAULTS } from "../../modules/users/models/preferences.model.js";

const app = buildTestApp([registerUsersModule]);
const userAuth = () => `Bearer ${signTestToken(TEST_USER_PAYLOAD)}`;

const CSRF = "csrf-token-for-tests";
/** Double-submit cookie: the same value in the cookie and the header. */
const withCsrf = (req: request.Test) =>
  req.set("Cookie", [`luxipanel_csrf=${CSRF}`]).set("X-CSRF-Token", CSRF);

beforeEach(() => {
  storedPrefs = {};
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/preferences/chat", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/preferences/chat");
    expect(res.status).toBe(401);
  });

  it("returns the complete defaults for a user with nothing stored", async () => {
    const res = await request(app).get("/api/preferences/chat").set("Authorization", userAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(CHAT_PREFERENCES_DEFAULTS);
  });

  it("deep-merges stored values over the defaults (never a partial object)", async () => {
    storedPrefs = { chat: { general: { enterSends: false } } };

    const res = await request(app).get("/api/preferences/chat").set("Authorization", userAuth());

    expect(res.status).toBe(200);
    expect(res.body.data.general).toEqual({
      ...CHAT_PREFERENCES_DEFAULTS.general,
      enterSends: false,
    });
    expect(res.body.data.calls).toEqual(CHAT_PREFERENCES_DEFAULTS.calls);
  });
});

describe("PUT /api/preferences/chat", () => {
  it("returns 401 without auth", async () => {
    const res = await withCsrf(request(app).put("/api/preferences/chat")).send({});
    expect(res.status).toBe(401);
  });

  it("returns 403 without a CSRF token", async () => {
    const res = await request(app)
      .put("/api/preferences/chat")
      .set("Authorization", userAuth())
      .send({ general: { enterSends: false } });

    expect(res.status).toBe(403);
  });

  it("stores a partial patch and answers the full resulting object", async () => {
    const res = await withCsrf(request(app).put("/api/preferences/chat"))
      .set("Authorization", userAuth())
      .send({ appearance: { density: "compact" } });

    expect(res.status).toBe(200);
    expect(res.body.data.appearance).toEqual({ density: "compact", fontSize: "md" });
    expect(storedPrefs["chat"]).toEqual({ appearance: { density: "compact" } });
  });

  it("merges per section — a later patch keeps the other sections and keys", async () => {
    await withCsrf(request(app).put("/api/preferences/chat"))
      .set("Authorization", userAuth())
      .send({ general: { enterSends: false }, calls: { language: "pt-BR", translate: true } });

    const res = await withCsrf(request(app).put("/api/preferences/chat"))
      .set("Authorization", userAuth())
      .send({ groups: { latestPageSize: 15 } });

    expect(res.status).toBe(200);
    // The earlier sections survived…
    expect(res.body.data.general.enterSends).toBe(false);
    expect(res.body.data.calls).toEqual({
      ...CHAT_PREFERENCES_DEFAULTS.calls,
      language: "pt-BR",
      translate: true,
    });
    // …and so did the untouched key of the section just patched.
    expect(res.body.data.groups).toEqual({ collapsedByDefault: true, latestPageSize: 15 });
  });

  it("keeps unrelated top-level preferences (theme) untouched", async () => {
    storedPrefs = { theme: "dark" };

    await withCsrf(request(app).put("/api/preferences/chat"))
      .set("Authorization", userAuth())
      .send({ general: { soundOnNewMessage: false } });

    expect(storedPrefs["theme"]).toBe("dark");
  });

  it.each([
    ["appearance.density", { appearance: { density: "cozy" } }],
    ["appearance.fontSize", { appearance: { fontSize: "xl" } }],
    ["groups.latestPageSize", { groups: { latestPageSize: 7 } }],
    ["calls.provider", { calls: { provider: "whisper" } }],
    ["calls.micDefault", { calls: { micDefault: "loud" } }],
    ["calls.ringtone", { calls: { ringtone: "disco" } }],
    ["calls.language", { calls: { language: "espanyol-largo" } }],
    ["general.enterSends type", { general: { enterSends: "yes" } }],
  ])("returns 400 for an invalid %s", async (_label, payload) => {
    const res = await withCsrf(request(app).put("/api/preferences/chat"))
      .set("Authorization", userAuth())
      .send(payload);

    expect(res.status).toBe(400);
    expect(storedPrefs["chat"]).toBeUndefined();
  });

  it("accepts every valid enum value", async () => {
    const res = await withCsrf(request(app).put("/api/preferences/chat"))
      .set("Authorization", userAuth())
      .send({
        appearance: { density: "compact", fontSize: "lg" },
        groups: { collapsedByDefault: false, latestPageSize: 10 },
        calls: {
          language: "en",
          translate: true,
          provider: "elevenlabs",
          micDefault: "muted",
          ringtone: "off",
          dnd: true,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.calls.provider).toBe("elevenlabs");
    expect(res.body.data.groups.latestPageSize).toBe(10);
  });
});
