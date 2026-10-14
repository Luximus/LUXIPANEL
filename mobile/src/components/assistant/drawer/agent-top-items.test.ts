// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import {
  buildAgentConversationTree,
  type AgentHierarchyLike,
  type ConversationLike,
} from "../../assistant-settings/agents/conversation-grouping";
import { collectRepresentedAgentIds, pickEmptyLeaderAgents } from "./agent-top-items";

type Convo = ConversationLike & { id: string };
const convo = (id: string, agentId: string | null, updatedAt = "2026-07-01T00:00:00Z"): Convo => ({ id, agentId, updatedAt });

const roster = (agents: AgentHierarchyLike[]) => new Map(agents.map((a) => [a.id, a]));

describe("collectRepresentedAgentIds", () => {
  it("registra líder, subordinados anidados y filas threaded", () => {
    // L lidera a S; S lidera a S2 (subordinado que TAMBIÉN es líder). X va suelto.
    const agents = roster([
      { id: "L", isTeamLeader: true, subordinateIds: ["S"] },
      { id: "S", parentAgentId: "L", isTeamLeader: true, subordinateIds: ["S2"] },
      { id: "S2", parentAgentId: "S" },
      { id: "X" },
    ]);
    const entries = buildAgentConversationTree(
      [convo("c1", "L"), convo("c2", "S"), convo("c3", "X")],
      agents,
      { seedRoster: true },
    );
    const represented = collectRepresentedAgentIds(entries);
    expect(represented.has("L")).toBe(true);
    expect(represented.has("S")).toBe(true); // ← anidado bajo L: antes NO se registraba
    expect(represented.has("X")).toBe(true);
  });

  it("registra el agente de una fila de grupo (2+ chats del mismo agente)", () => {
    const agents = roster([{ id: "X" }]);
    const entries = buildAgentConversationTree(
      [convo("c1", "X", "2026-07-02T00:00:00Z"), convo("c2", "X", "2026-07-01T00:00:00Z")],
      agents,
      { seedRoster: true },
    );
    expect([...collectRepresentedAgentIds(entries)]).toEqual(["X"]);
  });

  it("ignora los chats sueltos (sin agentId)", () => {
    const entries = buildAgentConversationTree([convo("c1", null)], roster([]), { seedRoster: true });
    expect(collectRepresentedAgentIds(entries).size).toBe(0);
  });
});

describe("pickEmptyLeaderAgents", () => {
  it("un subordinado que además es líder NO se duplica como tarjeta de primer nivel", () => {
    const agents = roster([
      { id: "L", isTeamLeader: true, subordinateIds: ["S"] },
      { id: "S", parentAgentId: "L", isTeamLeader: true, subordinateIds: ["S2"] },
      { id: "S2", parentAgentId: "S" },
    ]);
    const entries = buildAgentConversationTree([convo("c1", "L"), convo("c2", "S")], agents, { seedRoster: true });
    // `leaderAgents` del drawer = todo el que lidera equipo (L y S).
    const leaders = [{ id: "L" }, { id: "S" }];
    // S ya sale ANIDADO bajo L con sus chats: no debe repetirse arriba con "0".
    expect(pickEmptyLeaderAgents(entries, leaders)).toEqual([]);
  });

  it("un líder sin conversaciones ni presencia en el árbol sí se añade", () => {
    const agents = roster([
      { id: "L", isTeamLeader: true, subordinateIds: ["S"] },
      { id: "S", parentAgentId: "L" },
      { id: "Z", isTeamLeader: true },
    ]);
    const entries = buildAgentConversationTree([convo("c1", "L")], agents, { seedRoster: true });
    const leaders = [{ id: "L" }, { id: "Z" }];
    expect(pickEmptyLeaderAgents(entries, leaders).map((a) => a.id)).toEqual(["Z"]);
  });

  it("un subordinado sin chats tampoco aparece arriba (su sub-colapsable ya existe)", () => {
    const agents = roster([
      { id: "L", isTeamLeader: true, subordinateIds: ["S"] },
      { id: "S", parentAgentId: "L", isTeamLeader: true, subordinateIds: ["S2"] },
      { id: "S2", parentAgentId: "S" },
    ]);
    // Solo el líder tiene chats: S entra por roster-seed como sub vacía.
    const entries = buildAgentConversationTree([convo("c1", "L")], agents, { seedRoster: true });
    expect(pickEmptyLeaderAgents(entries, [{ id: "S" }])).toEqual([]);
  });
});
