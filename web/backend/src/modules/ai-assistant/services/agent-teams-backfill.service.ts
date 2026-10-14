// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agent-teams BACKFILL — one-shot, idempotent migration from the legacy
 * name-prefix convention ("LUXIPANEL · Rol") to first-class `AgentTeam` records
 * + `AssistantAgent.teamId`.
 *
 * Before this entity existed, the frontend grouped agents by parsing a shared
 * name prefix split on " · " (space + U+00B7 + space) — the same derivation as
 * `agentWorkGroupKey`. This service reproduces that grouping ONCE per instance:
 * for every agent that (a) has NEVER been assigned a team (`teamId === undefined`)
 * and (b) carries such a prefix, it creates (or reuses) a team named after the
 * prefix and assigns the agent to it.
 *
 * Invariants:
 *  - `teamId === null` (explicitly removed) is NEVER re-assigned.
 *  - Backfilled teams are GLOBAL (`ownerId: null`) and grouping ignores agent
 *    ownership, reproducing today's UX where a prefix group spans shared agents.
 *  - `planBackfill` is PURE (no I/O) so it is trivially testable; `runBackfill`
 *    applies the plan and is guarded by an in-process mutex so two concurrent
 *    `GET /agent-teams` calls can't double-create.
 */

import { agentsRepository } from "../repositories/agents.repository.js";
import { agentTeamsRepository } from "../repositories/agent-teams.repository.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AgentTeam } from "../models/assistant-team.types.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-teams-backfill");

/** Prefix separator: space + U+00B7 (MIDDLE DOT) + space. */
const SEP = " · ";

export interface BackfillAssignment {
  agentId: string;
  /** Normalized (trim + lowercase) prefix — the grouping key. */
  key: string;
  /** Display team name (first-seen original-case prefix, trimmed). */
  name: string;
  /** Existing team id to reuse (matched by name), or null → a new team. */
  reuseTeamId: string | null;
}

export interface BackfillPlan {
  /** Distinct teams that must be CREATED (deduped by key; reuseTeamId === null). */
  teamsToCreate: Array<{ key: string; name: string }>;
  /** Every agent→team assignment to apply, referencing a team by `key`. */
  assignments: BackfillAssignment[];
}

/**
 * Derive the team prefix of an agent name, or null when it has none. Mirrors the
 * frontend's `agentWorkGroupKey`: the prefix is the text before the FIRST " · ",
 * and it must be non-empty (indexOf > 0).
 */
export function deriveNamePrefix(name: string | undefined): string | null {
  if (!name) return null;
  const idx = name.indexOf(SEP);
  if (idx <= 0) return null;
  const prefix = name.slice(0, idx).trim();
  return prefix || null;
}

/**
 * PURE planner: given the current agents + teams, compute which teams to create
 * and which agents to assign. No I/O.
 */
export function planBackfill(agents: AssistantAgent[], teams: AgentTeam[]): BackfillPlan {
  // Existing teams by normalized name → reuse without duplicating.
  const teamIdByName = new Map<string, string>();
  for (const t of teams) {
    const key = (t.name || "").trim().toLowerCase();
    if (key && t.id && !teamIdByName.has(key)) teamIdByName.set(key, t.id);
  }

  const assignments: BackfillAssignment[] = [];
  const toCreate = new Map<string, string>(); // key → display name (first seen)

  for (const a of agents) {
    // Only candidates NEVER assigned: undefined. `null` = explicitly removed.
    if (a.teamId !== undefined) continue;
    if (!a.id) continue;
    const prefix = deriveNamePrefix(a.name);
    if (!prefix) continue;
    const key = prefix.toLowerCase();
    const reuseTeamId = teamIdByName.get(key) ?? null;
    if (!reuseTeamId && !toCreate.has(key)) toCreate.set(key, prefix);
    assignments.push({ agentId: a.id, key, name: prefix, reuseTeamId });
  }

  return {
    teamsToCreate: [...toCreate.entries()].map(([key, name]) => ({ key, name })),
    assignments,
  };
}

// In-process mutex: a shared promise so overlapping GETs await the same run.
let inFlight: Promise<void> | null = null;

/** Apply the backfill plan (create missing teams + assign agents). Idempotent. */
export async function runBackfill(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [agents, teams] = await Promise.all([agentsRepository.list(), agentTeamsRepository.list()]);
    const plan = planBackfill(agents, teams);
    if (plan.assignments.length === 0) return;

    // Create the missing teams first, mapping key → freshly-minted id.
    const idByKey = new Map<string, string>();
    for (const t of plan.teamsToCreate) {
      try {
        const created = await agentTeamsRepository.create({ name: t.name, ownerId: null });
        if (created.id) idByKey.set(t.key, created.id);
      } catch (err) {
        log.warn({ err: (err as Error).message, team: t.name }, "backfill: no se pudo crear el equipo");
      }
    }

    // Assign each agent to its (created or reused) team. No ownership gate: the
    // prefix group intentionally spans shared agents (matches current UX).
    for (const asn of plan.assignments) {
      const teamId = asn.reuseTeamId ?? idByKey.get(asn.key) ?? null;
      if (!teamId) continue;
      try {
        await agentsRepository.update(asn.agentId, { teamId });
      } catch (err) {
        log.warn({ err: (err as Error).message, agentId: asn.agentId }, "backfill: no se pudo asignar el equipo");
      }
    }
    log.info(
      { created: plan.teamsToCreate.length, assigned: plan.assignments.length },
      "agent-teams backfill aplicado",
    );
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}
