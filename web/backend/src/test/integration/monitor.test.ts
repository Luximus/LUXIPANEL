vi.mock("../../shared/redis/index.js", () => ({ getRedis: () => ({ exists: async () => 0, get: async () => null, set: async () => "OK", incr: async () => 1, publish: async () => 0 }) }));
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration tests — Monitor module endpoints
 *
 * Tests authentication guards, response shapes, and history query params.
 * statsCollectorService and DB repos are mocked.
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { statsCollectorService } from "../../modules/monitor/services/stats-collector.service.js";

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

vi.mock("../../modules/auth/repositories/index.js", () => ({
  panelUserRepository: {
    findAllWithRoles: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(3),
  },
  auditRepository: { append: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../modules/mail/repositories/index.js", () => ({
  accountRepository: {
    count: vi.fn().mockResolvedValue(10),
  },
}));

// vi.hoisted: vi.mock factories are hoisted above top-level `const`s, so any
// shared fixture they reference must be hoisted too.
const { mockSnapshot } = vi.hoisted(() => ({
  mockSnapshot: {
    ts: Date.now(),
    cpu: { usagePercent: 12.5, loadAvg1m: 0.5, loadAvg5m: 0.4, loadAvg15m: 0.3 },
    memory: { totalBytes: 8192, usedBytes: 4096, freeBytes: 4096, usagePercent: 50 },
    disk: { totalBytes: 100, usedBytes: 40, availableBytes: 60, usagePercent: 40 },
    network: { rxBytesPerSec: 1024, txBytesPerSec: 512 },
  },
}));

vi.mock("../../modules/monitor/services/stats-collector.service.js", () => ({
  statsCollectorService: {
    getLatest: vi.fn().mockReturnValue(mockSnapshot),
    getHistory: vi.fn().mockResolvedValue([mockSnapshot]),
    start: vi.fn(),
    stop: vi.fn(),
    setAlertEvaluator: vi.fn(),
    _collect: vi.fn(),
  },
}));

vi.mock("../../modules/monitor/repositories/alert.repository.js", () => ({
  alertRepository: {
    findAllRules: vi.fn().mockResolvedValue([]),
    findEnabledRules: vi.fn().mockResolvedValue([]),
    findRuleById: vi.fn().mockResolvedValue(null),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    findRecentEvents: vi.fn().mockResolvedValue([]),
    createEvent: vi.fn(),
    resolveEvent: vi.fn(),
  },
}));

vi.mock("../../modules/monitor/services/alert-evaluator.service.js", () => ({
  alertEvaluatorService: {
    evaluate: vi.fn().mockResolvedValue(undefined),
    firingRuleIds: vi.fn().mockReturnValue([]),
  },
}));

vi.mock("../../modules/monitor/services/sse.service.js", () => ({
  sseService: {
    attach: vi.fn(),
    broadcastAlert: vi.fn(),
    clientCount: 0,
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────

import { buildTestApp } from "../helpers/app.helper.js";
import { registerMonitorModule } from "../../modules/monitor/index.js";
import { signTestToken, TEST_ADMIN_PAYLOAD, TEST_USER_PAYLOAD } from "../helpers/token.helper.js";

const app = buildTestApp([registerMonitorModule]);

const adminAuth = () => `Bearer ${signTestToken(TEST_ADMIN_PAYLOAD)}`;
const userAuth  = () => `Bearer ${signTestToken(TEST_USER_PAYLOAD)}`;

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/monitor/system", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/monitor/system");
    expect(res.status).toBe(401);
  });

  it("returns 200 with system info for authenticated admin", async () => {
    const res = await request(app)
      .get("/api/monitor/system")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.hostname).toBe("string");
    expect(res.body.data.cpu).toBeDefined();
    expect(res.body.data.memory).toBeDefined();
  });

  it("returns 403 for non-admin user without the monitor module", async () => {
    // /api/monitor/* is gated by requireModule("monitor") now;
    // TEST_USER_PAYLOAD only has "mail".
    const res = await request(app)
      .get("/api/monitor/system")
      .set("Authorization", userAuth());

    expect(res.status).toBe(403);
  });

  it("denies global server metrics even when a non-admin group grants monitor.read", async () => {
    const res = await request(app)
      .get("/api/monitor/system")
      .set("Authorization", `Bearer ${signTestToken({ ...TEST_USER_PAYLOAD, modules: ["monitor"], permissions: { ...TEST_USER_PAYLOAD.permissions!, views: ["panel.monitor"], actions: ["monitor.read"] } })}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/monitor/stats", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/monitor/stats");
    expect(res.status).toBe(401);
  });

  it("returns 200 with stats summary", async () => {
    const res = await request(app)
      .get("/api/monitor/stats")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.data.accounts).toBe("number");
    expect(typeof res.body.data.users).toBe("number");
  });
});

describe("GET /api/monitor/history", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/monitor/history");
    expect(res.status).toBe(401);
  });

  it("returns 200 with default 1h range", async () => {
    const res = await request(app)
      .get("/api/monitor/history")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.range).toBe("1h");
  });

  it("accepts a valid range query parameter", async () => {
    const res = await request(app)
      .get("/api/monitor/history?range=6h")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.range).toBe("6h");
  });

  it("accepts explicit comparison windows and reports the original sample count", async () => {
    const res = await request(app)
      .get("/api/monitor/history?from=1000&to=2000")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.totalSamples).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(statsCollectorService.getHistory).toHaveBeenLastCalledWith(1000, 2000, expect.any(String));
  });

  it("returns aggregated chart data across the full 7-day window", async () => {
    const res = await request(app)
      .get("/api/monitor/history?range=7d&resolution=chart")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.data.bucketMs).toBe(2 * 60 * 60_000);
    expect(res.body.data.totalSamples).toBe(1);
    expect(res.body.data.buckets).toHaveLength(1);
    expect(res.body.data.summary.cpu.average).toBe(12.5);
  });
});

describe("GET /api/monitor/alerts/rules", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/monitor/alerts/rules");
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty alerts list", async () => {
    const res = await request(app)
      .get("/api/monitor/alerts/rules")
      .set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("POST /api/monitor/alerts/rules", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app)
      .post("/api/monitor/alerts/rules")
      .send({ name: "CPU High", metric: "cpu_usage_percent", operator: "gt", threshold: 80 });
    expect(res.status).toBe(401);
  });

  it("returns 403 without CSRF token", async () => {
    const token = signTestToken(TEST_ADMIN_PAYLOAD);
    const res = await request(app)
      .post("/api/monitor/alerts/rules")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "CPU High", metric: "cpu_usage_percent", operator: "gt", threshold: 80 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_ERROR");
  });

  it("returns 201 with valid auth and CSRF", async () => {
    const { alertRepository } = vi.mocked(
      await import("../../modules/monitor/repositories/alert.repository.js"),
    );
    vi.mocked(alertRepository.createRule).mockResolvedValue({
      id: 1,
      name: "CPU High",
      metric: "cpu_usage_percent",
      operator: "gt",
      threshold: 80,
      sustainedSamples: 1,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const csrfToken = "test-csrf-12345";
    const res = await request(app)
      .post("/api/monitor/alerts/rules")
      .set("Authorization", adminAuth())
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken)
      .send({
        name: "CPU High",
        metric: "cpu_usage_percent",
        operator: "gt",
        threshold: 80,
        sustainedSamples: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.name).toBe("CPU High");
  });
});
