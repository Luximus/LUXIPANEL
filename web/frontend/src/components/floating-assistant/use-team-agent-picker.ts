// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared "pick agents for a team" logic (F-11).
 *
 * `TeamEditModal` (inline attach while creating/renaming) and
 * `TeamAddAgentsModal` (standalone picker) had the same ~40 lines twice:
 * candidate filter, `teamsById`, `candidateGroups`, `openKeys`, the
 * `selected` set + `toggle()`, and the `assistantAgentsApi.update(id,{teamId})`
 * loop that accumulates per-agent failures.
 */
import { useMemo, useState } from "react";
import {
  assistantAgentsApi,
  groupAgentsForPicker,
  type AgentTeam,
  type AssistantAgent,
} from "./assistant-api";

export interface TeamAgentPicker {
  /** Agents the user owns that are not already in this team. */
  candidates: AssistantAgent[];
  /** `candidates` grouped by team (+ trailing "loose" bucket). */
  candidateGroups: ReturnType<typeof groupAgentsForPicker>;
  /** Every group key — the picker starts fully expanded (no preselection). */
  openKeys: Set<string>;
  selected: Set<string>;
  toggle(id: string): void;
  /**
   * Move every selected agent into `teamId`. Returns the display names of the
   * agents whose update failed (empty array = full success); the caller decides
   * how to surface them.
   */
  assignSelected(teamId: string): Promise<string[]>;
}

export function useTeamAgentPicker(
  agents: AssistantAgent[],
  teams: AgentTeam[],
  teamId: string | undefined,
): TeamAgentPicker {
  // Eligible = agents the current user owns (relation !== "shared" avoids a 403)
  // that are not already in THIS team. Agents in OTHER teams may be moved here.
  const candidates = agents.filter((a) => a.relation !== "shared" && a.teamId !== teamId);
  const teamsById = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const candidateGroups = useMemo(() => groupAgentsForPicker(candidates, teamsById), [candidates, teamsById]);
  // Picker with no preselection: expand every group so candidates are visible;
  // the headers just organise a long list by team.
  const openKeys = useMemo(() => new Set(candidateGroups.map((g) => g.key)), [candidateGroups]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function assignSelected(target: string): Promise<string[]> {
    const failures: string[] = [];
    for (const id of selected) {
      try {
        await assistantAgentsApi.update(id, { teamId: target });
      } catch {
        failures.push(candidates.find((a) => a.id === id)?.name ?? id);
      }
    }
    return failures;
  }

  return { candidates, candidateGroups, openKeys, selected, toggle, assignSelected };
}
