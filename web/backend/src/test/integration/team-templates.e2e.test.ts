// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Quick e2e smoke test for the team-templates endpoints. Run with:
//   cd backend && npx vitest run src/test/integration/team-templates.e2e.test.ts
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Mock the auth config so the test secret from signTestToken verifies.
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
    },
  },
}));

// Mock the executor factory so requireAuth doesn't try to hit Redis/SSH.
vi.mock("../../shared/executor/factory.js", async () =>
  (await import("../helpers/executor.helper.js")).executorFactoryMock());

import { buildTestApp } from "../helpers/app.helper.js";
import { signTestToken, TEST_ADMIN_PAYLOAD } from "../helpers/token.helper.js";
import { registerAiModule } from "../../modules/ai-assistant/index.js";
import { runWithExecutor } from "../../shared/executor/index.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("team-templates API (e2e)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "lxp-tt-"));
  process.env.LUXIPANEL_CONFIG_DIR = tmp;

  // In-memory file store so reads after writes see the updated value. The
  // real executor in production goes through SFTP; here we just emulate a
  // tiny FS that the data-store can use as its backing sidecar.
  const fs = new Map<string, string>();
  const mockExecutor = {
    exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    writeFile: async (p: string, content: string) => {
      fs.set(p, content);
    },
    readFile: async (p: string) => fs.get(p) ?? "",
    exists: async (p: string) => fs.has(p),
    listDir: async () => [],
    remove: async (p: string) => {
      fs.delete(p);
    },
    mkdir: async () => undefined,
    env: {},
    target: { id: "test", name: "test" },
  };

  const app = buildTestApp([(a: import("express").Express) => {
    a.use((req, _res, next) => runWithExecutor(mockExecutor, () => next()));
    registerAiModule(a);
  }]);

  const token = signTestToken(TEST_ADMIN_PAYLOAD);
  const auth = `Bearer ${token}`;

  it("GET /team-templates returns 10 categories + 18 templates", async () => {
    const res = await request(app).get("/api/ai/team-templates").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.categories).toHaveLength(10);
    expect(res.body.templates).toHaveLength(18);
    expect(res.body.templates[0].slots[0].systemPrompt).toBeUndefined();
  });

  it("GET /team-templates/web-generic returns full template with systemPrompts", async () => {
    const res = await request(app).get("/api/ai/team-templates/web-generic").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.template.name).toBeTruthy();
    expect(res.body.template.slots.length).toBe(5);
    expect(res.body.template.slots[0].systemPrompt).toBeTruthy();
    const roots = res.body.template.slots.filter((s: { parentSlotId: string | null }) => s.parentSlotId === null);
    expect(roots).toHaveLength(1);
  });

  it("POST /team-templates/web-generic/apply creates 5 real agents with proper hierarchy", async () => {
    const res = await request(app)
      .post("/api/ai/team-templates/web-generic/apply")
      .set("Authorization", auth)
      .send({ namePrefix: "Test", slotOverrides: { ceo: { providerId: "codex", name: "Mi CEO" } } });
    expect(res.status).toBe(200);
    expect(res.body.agents).toHaveLength(5);
    expect(res.body.createdIds).toHaveLength(5);
    // The CEO is the only root (parentAgentId = null) and has the override.
    const roots = res.body.agents.filter((a: { parentAgentId: string | null }) => a.parentAgentId === null);
    expect(roots).toHaveLength(1);
    const ceo = roots[0];
    expect(ceo.name).toBe("Test · Mi CEO");
    expect(ceo.providerId).toBe("codex");
    expect(ceo.canSpawnChats).toBe(true);
    // Every other agent has the CEO as parent.
    const others = res.body.agents.filter((a: { id: string }) => a.id !== ceo.id);
    for (const a of others) {
      expect(a.parentAgentId).toBe(ceo.id);
    }
    // CEO is on top of the hierarchy: returned first in `agents` (topological order).
    expect(res.body.agents[0].id).toBe(ceo.id);
  });

  it("POST /apply with unknown slotId returns 400", async () => {
    const res = await request(app)
      .post("/api/ai/team-templates/web-generic/apply")
      .set("Authorization", auth)
      .send({ slotOverrides: { nonexistent: { name: "X" } } });
    expect(res.status).toBe(400);
  });

  it("POST /apply with unknown templateId returns 404", async () => {
    const res = await request(app)
      .post("/api/ai/team-templates/does-not-exist/apply")
      .set("Authorization", auth)
      .send({});
    expect(res.status).toBe(404);
  });
});
