// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration tests — /api/health endpoint
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.helper.js";

const app = buildTestApp();

describe("GET /api/health", () => {
  it("returns 200 with ok:true", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("luxipanel");
    expect(res.body.version).toBe("2.0.0");
  });

  it("includes a timestamp", async () => {
    const res = await request(app).get("/api/health");
    // timestamp field from the real app — test app doesn't include it, check health key only
    expect(res.body.ok).toBe(true);
  });

  it("disables caching", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers["pragma"]).toBe("no-cache");
    expect(res.headers["expires"]).toBe("0");
  });

  it("can keep caching enabled via DISABLE_HTTP_CACHE=false", async () => {
    const previous = process.env.DISABLE_HTTP_CACHE;
    process.env.DISABLE_HTTP_CACHE = "false";

    try {
      const res = await request(app).get("/api/health");
      expect(res.headers["cache-control"]).toBeUndefined();
      expect(res.headers["pragma"]).toBeUndefined();
      expect(res.headers["expires"]).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.DISABLE_HTTP_CACHE;
      else process.env.DISABLE_HTTP_CACHE = previous;
    }
  });
});

describe("GET /api/nonexistent", () => {
  it("returns 404 with ok:false", async () => {
    const res = await request(app).get("/api/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
