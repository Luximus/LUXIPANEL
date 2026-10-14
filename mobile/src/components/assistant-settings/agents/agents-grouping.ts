// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Lógica PURA de agrupación de agentes — puerto 1:1 de las funciones de
 * WEB/floating-assistant/assistant-api.ts. La lista principal y los pickers del
 * editor bucketan por equipo de primera clase (`teamId`) y, en su defecto, por
 * el prefijo de nombre legacy ("Equipo · Rol"). Sin DOM.
 */
import type { AssistantAgent, AgentTeam } from "../types";

/**
 * Deriva la "clave de grupo de trabajo" desde el nombre del agente. Convención:
 * un nombre "Equipo · Rol" (p. ej. "PTFL · Arquitecto Backend") pertenece al
 * grupo "PTFL"; la parte antes de " · " (U+00B7 con espacios simples) es la
 * etiqueta. Nombres sin ese separador caen a "General".
 */
export function agentWorkGroupKey(agent: Pick<AssistantAgent, "name"> | { name?: string | null }): string {
  const name = (agent?.name ?? "").trim();
  if (!name) return "General";
  const idx = name.indexOf(" · ");
  if (idx <= 0) return "General";
  const prefix = name.slice(0, idx).trim();
  return prefix || "General";
}

/** Orden de display estable para grupos conocidos (alfabético, "General" último). */
export function orderWorkGroupKeys(keys: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (k !== "General") out.push(k);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (seen.has("General")) out.push("General");
  return out;
}

/**
 * Rankea agentes dentro de un grupo por profundidad jerárquica (BFS sobre
 * `parentAgentId`) para pintar un badge numérico ("1" = cabeza del grupo). Un
 * "root" = sin padre O con el padre FUERA del grupo. Empates → alfabético.
 * Huérfanos/ciclos reciben el siguiente rango libre para no perderse.
 */
export function rankAgentsInGroup(agents: AssistantAgent[]): Map<string, number> {
  const ranks = new Map<string, number>();
  if (agents.length === 0) return ranks;
  const byId = new Map<string, AssistantAgent>();
  for (const a of agents) byId.set(a.id, a);
  const groupIds = new Set(byId.keys());

  const roots = agents
    .filter((a) => !a.parentAgentId || !groupIds.has(a.parentAgentId))
    .map((a) => a.id)
    .sort((x, y) =>
      (byId.get(x)?.name ?? "").localeCompare(byId.get(y)?.name ?? "", undefined, { sensitivity: "base" }),
    );

  const queue: { id: string; rank: number }[] = roots.map((id) => ({ id, rank: 1 }));
  const childrenOf = new Map<string, string[]>();
  for (const a of agents) {
    if (a.parentAgentId && groupIds.has(a.parentAgentId)) {
      const arr = childrenOf.get(a.parentAgentId) ?? [];
      arr.push(a.id);
      childrenOf.set(a.parentAgentId, arr);
    }
  }
  for (const [, arr] of childrenOf) {
    arr.sort((x, y) =>
      (byId.get(x)?.name ?? "").localeCompare(byId.get(y)?.name ?? "", undefined, { sensitivity: "base" }),
    );
  }

  while (queue.length) {
    const next = queue.shift();
    if (!next) break;
    const { id, rank } = next;
    if (ranks.has(id)) continue; // cycle guard
    ranks.set(id, rank);
    for (const childId of childrenOf.get(id) ?? []) {
      if (!ranks.has(childId)) queue.push({ id: childId, rank: rank + 1 });
    }
  }

  const orphans = agents.filter((a) => !ranks.has(a.id));
  if (orphans.length > 0) {
    const maxRank = Math.max(0, ...Array.from(ranks.values()));
    orphans
      .map((a) => a.id)
      .sort((x, y) =>
        (byId.get(x)?.name ?? "").localeCompare(byId.get(y)?.name ?? "", undefined, { sensitivity: "base" }),
      )
      .forEach((id, i) => ranks.set(id, maxRank + 1 + i));
  }
  return ranks;
}

/**
 * Los agentes "líder" de cada grupo de trabajo: rango-1 por grupo. Ordenados
 * por `orderWorkGroupKeys`, luego alfabético dentro del grupo.
 */
export function leaderAgentsOf(agents: AssistantAgent[]): AssistantAgent[] {
  const groups = new Map<string, AssistantAgent[]>();
  for (const a of agents) {
    const key = agentWorkGroupKey(a);
    const arr = groups.get(key) ?? [];
    arr.push(a);
    groups.set(key, arr);
  }
  const out: AssistantAgent[] = [];
  for (const key of orderWorkGroupKeys(groups.keys())) {
    const list = groups.get(key) ?? [];
    if (list.length === 0) continue;
    const ranks = rankAgentsInGroup(list);
    const leaders = list
      .filter((a) => ranks.get(a.id) === 1)
      .sort((x, y) => (x.name ?? "").localeCompare(y.name ?? "", undefined, { sensitivity: "base" }));
    out.push(...leaders);
  }
  return out;
}

/**
 * Bucketea un agente para la agrupación de la lista. Los equipos de primera
 * clase tienen prioridad: si el agente tiene `teamId` presente en `teamsById`,
 * cae en `team:${id}` (label = nombre del equipo). Si no, cae al prefijo legacy
 * `agentWorkGroupKey`.
 */
export function agentGroupBucket(
  agent: Pick<AssistantAgent, "name" | "teamId">,
  teamsById: Map<string, AgentTeam>,
): { key: string; label: string; team?: AgentTeam } {
  const teamId = agent.teamId;
  if (teamId && teamsById.has(teamId)) {
    const team = teamsById.get(teamId);
    if (team) return { key: `team:${teamId}`, label: team.name, team };
  }
  const legacy = agentWorkGroupKey(agent);
  return { key: legacy, label: legacy };
}

/**
 * Agrupa un SUBCONJUNTO de agentes en buckets ordenados NO vacíos para los
 * pickers del editor (checklist de conexiones, selector "superior", miembros de
 * equipo). Mismo bucketing que la lista, pero omite equipos vacíos. Orden:
 * equipos/grupos alfabético por label; el bucket legacy "General" ("Sueltos")
 * siempre al final.
 */
export function groupAgentsForPicker(
  agents: AssistantAgent[],
  teamsById: Map<string, AgentTeam>,
): { key: string; label: string; team?: AgentTeam; agents: AssistantAgent[] }[] {
  const groups = new Map<string, { key: string; label: string; team?: AgentTeam; agents: AssistantAgent[] }>();
  for (const a of agents) {
    const b = agentGroupBucket(a, teamsById);
    const existing = groups.get(b.key);
    if (existing) existing.agents.push(a);
    else groups.set(b.key, { key: b.key, label: b.label, team: b.team, agents: [a] });
  }
  return [...groups.values()].sort((x, y) => {
    const xGen = x.key === "General";
    const yGen = y.key === "General";
    if (xGen !== yGen) return xGen ? 1 : -1;
    return x.label.localeCompare(y.label, undefined, { sensitivity: "base" });
  });
}
