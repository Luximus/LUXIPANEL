// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Coverage for the team-templates "Equipo rápido" → first-class AgentTeam wiring:
 * apply with `namePrefix` find-or-creates a team and stamps its id onto every
 * agent it materialises.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

const createdAgents: Array<Record<string, unknown>> = [];
let agentSeq = 0;

vi.mock("../repositories/agents.repository.js", () => ({
  agentsRepository: {
    async create(data: Record<string, unknown>) {
      const doc = { ...data, id: `agent-${++agentSeq}` };
      createdAgents.push(doc);
      return doc;
    },
    async update(_id: string, _patch: Record<string, unknown>) {
      return null;
    },
    async get(id: string) {
      return createdAgents.find((a) => a["id"] === id) ?? null;
    },
  },
}));

const findByName = vi.fn<(name: string) => Promise<{ id: string; name: string } | null>>();
const createTeam = vi.fn(async (data: { name: string }) => ({ id: "team-new", name: data.name }));

vi.mock("../repositories/agent-teams.repository.js", () => ({
  agentTeamsRepository: {
    findByName: (name: string) => findByName(name),
    create: (data: { name: string }) => createTeam(data),
  },
}));

const { teamTemplatesService } = await import("./team-templates.service.js");

beforeEach(() => {
  createdAgents.length = 0;
  agentSeq = 0;
  findByName.mockReset();
  createTeam.mockClear();
});

describe("teamTemplatesService.apply — namePrefix → AgentTeam", () => {
  it("creates the team (no match) and stamps teamId onto every created agent", async () => {
    findByName.mockResolvedValue(null);
    const res = await teamTemplatesService.apply("app-mobile", { namePrefix: "Equipo App" });
    expect(findByName).toHaveBeenCalledWith("Equipo App");
    expect(createTeam).toHaveBeenCalledWith({ name: "Equipo App" });
    expect(createdAgents.length).toBeGreaterThan(0);
    expect(res.createdIds.length).toBe(createdAgents.length);
    for (const a of createdAgents) expect(a["teamId"]).toBe("team-new");
  });

  it("reuses an existing team (name match) without creating a duplicate", async () => {
    findByName.mockResolvedValue({ id: "team-existing", name: "Equipo App" });
    await teamTemplatesService.apply("app-mobile", { namePrefix: "Equipo App" });
    expect(createTeam).not.toHaveBeenCalled();
    for (const a of createdAgents) expect(a["teamId"]).toBe("team-existing");
  });

  it("does not touch teams when no namePrefix is given (teamId null)", async () => {
    await teamTemplatesService.apply("app-mobile", {});
    expect(findByName).not.toHaveBeenCalled();
    expect(createTeam).not.toHaveBeenCalled();
    for (const a of createdAgents) expect(a["teamId"]).toBeNull();
  });
});
