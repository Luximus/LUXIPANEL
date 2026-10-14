// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests for the agent-teams controller: create name validation, update
 * ownership gate (403), remove detaches members + returns detachedCount, list
 * annotates memberCount.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// config/env fail-fasts on missing env (logger pulls it in). Set BEFORE imports.
process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

interface Team { id: string; name: string; ownerId?: number | null }
interface Agent { id: string; name: string; teamId?: string | null }

const teams = new Map<string, Team>();
const agents = new Map<string, Agent>();

vi.mock("../repositories/agent-teams.repository.js", () => ({
  agentTeamsRepository: {
    async list() {
      return [...teams.values()];
    },
    async get(id: string) {
      return teams.get(id) ?? null;
    },
    async create(data: { name: string }) {
      const doc = { id: `team-${teams.size + 1}`, ...data };
      teams.set(doc.id, doc);
      return doc;
    },
    async update(id: string, patch: Partial<Team>) {
      const cur = teams.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      teams.set(id, next);
      return next;
    },
    async delete(id: string) {
      return teams.delete(id);
    },
  },
}));

vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    async list() {
      return [...agents.values()];
    },
    async update(id: string, patch: Partial<Agent>) {
      const cur = agents.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      agents.set(id, next);
      return next;
    },
  },
}));

// Lazy backfill is exercised elsewhere; here it's a no-op.
vi.mock("../services/agent-teams-backfill.service.js", () => ({
  runBackfill: vi.fn(async () => {}),
}));

vi.mock("../../auth/repositories/panel-user.repository.js", () => ({
  panelUserRepository: { findAll: vi.fn(async () => []) },
}));

let currentUserId: number | null = 1;
vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return {
    ...actual,
    getExecutor: vi.fn(() => ({}) as never),
    getContextUserId: vi.fn(() => currentUserId),
  };
});

const { agentTeamsController } = await import("./agent-teams.controller.js");

/** Invoke an asyncHandler, flushing microtasks, and capture json or next(err). */
async function invoke(
  handler: (req: unknown, res: unknown, next: unknown) => void,
  req: Record<string, unknown>,
): Promise<{ body?: Record<string, unknown>; error?: { statusCode?: number; message: string } }> {
  let body: Record<string, unknown> | undefined;
  let error: { statusCode?: number; message: string } | undefined;
  const res = { json: (b: Record<string, unknown>) => { body = b; return res; }, locals: {} };
  const next = (e: { statusCode?: number; message: string }) => { error = e; };
  handler({ params: {}, body: {}, ...req }, res, next);
  await new Promise((r) => setImmediate(r));
  return { body, error };
}

beforeEach(() => {
  teams.clear();
  agents.clear();
  currentUserId = 1;
});

describe("agentTeamsController.create", () => {
  it("rejects an empty name (400)", async () => {
    const { error, body } = await invoke(agentTeamsController.create, { body: { name: "" } });
    expect(body).toBeUndefined();
    expect(error?.statusCode).toBe(400);
  });

  it("creates a team with a valid name", async () => {
    const { body, error } = await invoke(agentTeamsController.create, { body: { name: "Equipo A" } });
    expect(error).toBeUndefined();
    expect(body?.["ok"]).toBe(true);
    expect((body?.["team"] as Team).name).toBe("Equipo A");
  });
});

describe("agentTeamsController.update", () => {
  it("returns 403 when the caller is not the owner", async () => {
    teams.set("t1", { id: "t1", name: "Ajeno", ownerId: 99 });
    currentUserId = 1;
    const { error } = await invoke(agentTeamsController.update, { params: { id: "t1" }, body: { name: "X" } });
    expect(error?.statusCode).toBe(403);
  });

  it("lets the owner update", async () => {
    teams.set("t1", { id: "t1", name: "Mío", ownerId: 1 });
    const { body, error } = await invoke(agentTeamsController.update, { params: { id: "t1" }, body: { name: "Nuevo" } });
    expect(error).toBeUndefined();
    expect((body?.["team"] as Team).name).toBe("Nuevo");
  });
});

describe("agentTeamsController.remove", () => {
  it("deletes the team, detaches members and reports detachedCount", async () => {
    teams.set("t1", { id: "t1", name: "Equipo", ownerId: 1 });
    agents.set("a1", { id: "a1", name: "Uno", teamId: "t1" });
    agents.set("a2", { id: "a2", name: "Dos", teamId: "t1" });
    agents.set("a3", { id: "a3", name: "Otro", teamId: "t2" });
    const { body, error } = await invoke(agentTeamsController.remove, { params: { id: "t1" } });
    expect(error).toBeUndefined();
    expect(body?.["ok"]).toBe(true);
    expect(body?.["detachedCount"]).toBe(2);
    expect(agents.get("a1")!.teamId).toBeNull();
    expect(agents.get("a2")!.teamId).toBeNull();
    expect(agents.get("a3")!.teamId).toBe("t2"); // untouched
    expect(teams.has("t1")).toBe(false);
  });
});

describe("agentTeamsController.list", () => {
  it("annotates each team with its memberCount", async () => {
    teams.set("t1", { id: "t1", name: "A", ownerId: 1 });
    teams.set("t2", { id: "t2", name: "B", ownerId: 1 });
    agents.set("a1", { id: "a1", name: "x", teamId: "t1" });
    agents.set("a2", { id: "a2", name: "y", teamId: "t1" });
    agents.set("a3", { id: "a3", name: "z", teamId: "t2" });
    const { body } = await invoke(agentTeamsController.list, {});
    const list = body?.["teams"] as Array<{ id: string; memberCount: number }>;
    expect(list.find((t) => t.id === "t1")!.memberCount).toBe(2);
    expect(list.find((t) => t.id === "t2")!.memberCount).toBe(1);
  });
});
