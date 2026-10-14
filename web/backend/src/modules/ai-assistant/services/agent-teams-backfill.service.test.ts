// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests for the PURE backfill planner (`planBackfill`) — no I/O, so it
 * needs no mocks. Covers: prefix grouping, no-prefix skip, case-insensitive
 * merge into one team, `teamId: null` never re-assigned, reuse of an existing
 * team by name.
 */
import { describe, it, expect } from "vitest";
import { planBackfill, deriveNamePrefix } from "./agent-teams-backfill.service.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AgentTeam } from "../models/assistant-team.types.js";

function agent(partial: Partial<AssistantAgent> & { id: string; name: string }): AssistantAgent {
  return { description: "", systemPrompt: "", providerId: "claude", model: "", allowedTools: null, ...partial };
}

describe("deriveNamePrefix", () => {
  it("extracts the text before the first ' · '", () => {
    expect(deriveNamePrefix("LUXIPANEL · Backend")).toBe("LUXIPANEL");
  });
  it("returns null without a separator or with empty prefix", () => {
    expect(deriveNamePrefix("SoloNombre")).toBeNull();
    expect(deriveNamePrefix(" · Huérfano")).toBeNull(); // indexOf === 0 → no prefix
    expect(deriveNamePrefix(undefined)).toBeNull();
  });
});

describe("planBackfill", () => {
  it("groups prefixed, never-assigned agents into teams to create + assignments", () => {
    const agents = [
      agent({ id: "a1", name: "Equipo A · Frontend" }),
      agent({ id: "a2", name: "Equipo A · Backend" }),
      agent({ id: "a3", name: "Equipo B · QA" }),
    ];
    const plan = planBackfill(agents, []);
    expect(plan.teamsToCreate).toHaveLength(2);
    expect(plan.teamsToCreate.map((t) => t.name).sort()).toEqual(["Equipo A", "Equipo B"]);
    expect(plan.assignments).toHaveLength(3);
    // Both Equipo A members share the same key.
    const a1 = plan.assignments.find((x) => x.agentId === "a1")!;
    const a2 = plan.assignments.find((x) => x.agentId === "a2")!;
    expect(a1.key).toBe(a2.key);
    expect(a1.reuseTeamId).toBeNull();
  });

  it("skips agents without a prefix", () => {
    const plan = planBackfill([agent({ id: "a1", name: "AgenteSuelto" })], []);
    expect(plan.teamsToCreate).toHaveLength(0);
    expect(plan.assignments).toHaveLength(0);
  });

  it("merges case-differing prefixes into a single team", () => {
    const agents = [
      agent({ id: "a1", name: "Equipo · Uno" }),
      agent({ id: "a2", name: "EQUIPO · Dos" }),
    ];
    const plan = planBackfill(agents, []);
    expect(plan.teamsToCreate).toHaveLength(1);
    expect(plan.assignments.map((x) => x.key)).toEqual(["equipo", "equipo"]);
  });

  it("never re-assigns an agent whose teamId is explicitly null", () => {
    const agents = [
      agent({ id: "a1", name: "Equipo A · Frontend", teamId: null }),
      agent({ id: "a2", name: "Equipo A · Backend" }), // undefined → candidate
    ];
    const plan = planBackfill(agents, []);
    expect(plan.assignments.map((x) => x.agentId)).toEqual(["a2"]);
  });

  it("reuses an existing team (by name) instead of creating a duplicate", () => {
    const teams: AgentTeam[] = [{ id: "team-existing", name: "Equipo A" }];
    const agents = [agent({ id: "a1", name: "equipo a · Frontend" })];
    const plan = planBackfill(agents, teams);
    expect(plan.teamsToCreate).toHaveLength(0);
    expect(plan.assignments).toHaveLength(1);
    expect(plan.assignments[0]!.reuseTeamId).toBe("team-existing");
  });
});
