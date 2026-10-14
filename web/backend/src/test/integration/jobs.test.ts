// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — jobs module HTTP contract.
 *
 * Locks:
 *   - `GET /api/jobs/:id` requires a session (401 without one).
 *   - job-id shape gate: a value not matching `/^[0-9a-fA-F-]{8,64}$/` → 404
 *     (typed NotFoundError via the shared errorHandler, never a raw 500).
 *   - `readJobStatus === null` → 200 `{ ok, data: { jobId, state: "unknown" } }`
 *     (graceful "stop polling", NOT a 404).
 *   - a real status is passed straight through as `{ ok, data: <status> }`.
 *   - STUCK watchdog: a job still "queued" past WRITE_QUEUE_STUCK_MS emits
 *     `Events.WRITE_QUEUE_STUCK` exactly ONCE per (targetId, jobId).
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

// Controller → remote-cache seam. Control the job status per test.
vi.mock("../../shared/remote-cache/submit-mutation.js", () => ({
  readJobStatus: vi.fn(),
}));

import { jobsRouter } from "../../modules/jobs/routes/jobs.routes.js";
import { readJobStatus } from "../../shared/remote-cache/submit-mutation.js";
import { eventBus, Events } from "../../shared/events/index.js";

const app = buildTestApp([(a) => a.use(jobsRouter)]);

const VALID_ID = "12345678-1234-1234-1234-123456789abc";

beforeEach(() => vi.clearAllMocks());

describe("jobs — GET /api/jobs/:id", () => {
  it("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).get(`/api/jobs/${VALID_ID}`);
    expect(res.status).toBe(401);
  });

  it("404s a job id that fails the hex/uuid shape gate", async () => {
    const res = await request(app)
      .get("/api/jobs/not-a-valid-hex-id-zzz")
      .set("Authorization", authHeader());
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("NOT_FOUND");
    // The shape gate short-circuits before touching the remote cache.
    expect(vi.mocked(readJobStatus)).not.toHaveBeenCalled();
  });

  it("reports state=unknown (200) when there is no status key", async () => {
    vi.mocked(readJobStatus).mockResolvedValue(null);
    const res = await request(app)
      .get(`/api/jobs/${VALID_ID}`)
      .set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { jobId: VALID_ID, state: "unknown" } });
  });

  it("passes a real status straight through (200)", async () => {
    const status = { jobId: VALID_ID, state: "done", ts: 1700000000, error: null };
    vi.mocked(readJobStatus).mockResolvedValue(status as never);
    const res = await request(app)
      .get(`/api/jobs/${VALID_ID}`)
      .set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: status });
  });

  it("emits WRITE_QUEUE_STUCK once for a long-queued job (de-duped)", async () => {
    // ts=0 → ageMs is effectively Date.now(), well past WRITE_QUEUE_STUCK_MS.
    vi.mocked(readJobStatus).mockResolvedValue({ jobId: VALID_ID, state: "queued", ts: 0 } as never);
    const seen: unknown[] = [];
    const handler = (p: unknown) => seen.push(p);
    eventBus.on(Events.WRITE_QUEUE_STUCK, handler);
    try {
      await request(app).get(`/api/jobs/${VALID_ID}`).set("Authorization", authHeader());
      await request(app).get(`/api/jobs/${VALID_ID}`).set("Authorization", authHeader());
    } finally {
      eventBus.off(Events.WRITE_QUEUE_STUCK, handler);
    }
    // Same (targetId, jobId) → alert fired only on the first poll.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ jobId: VALID_ID });
  });
});
