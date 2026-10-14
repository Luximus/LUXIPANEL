// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI agent TEAM — a first-class grouping entity for custom agents.
 *
 * Historically "teams" in the assistant were only a NAME PREFIX convention
 * ("LUXIPANEL · Rol") that the frontend parsed (`agentWorkGroupKey`); no entity
 * existed. `AgentTeam` promotes that grouping to a real record so agents can be
 * assigned to a team explicitly (via `AssistantAgent.teamId`) and the team can
 * carry its own metadata (icon/color/description).
 *
 * Storage: like agents and roles, teams are PANEL-HOST instance state (global
 * across every server the panel manages), persisted in `assistant/teams.json`
 * on the panel host (see agent-teams.repository.ts). This does NOT touch the
 * runtime delegation model (`parentAgentId` + team-tools.ts), which stays as-is.
 */

export interface AgentTeam {
  id?: string;
  /** Display name (1..120). Used as the group label and for prefix backfill. */
  name: string;
  /** Short human description shown in the card (≤500). */
  description?: string;
  /** Presentation only (lucide icon slug, ≤60; default "users-group"). */
  icon?: string;
  /** Presentation only (color slug, ≤30; default "violet"). */
  color?: string;
  /**
   * Panel user id that created the team. The store is GLOBAL (panel host), so
   * `ownerId` distinguishes "yours" from "shared by another admin". `null` =
   * global/legacy/backfilled (visible to all).
   */
  ownerId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}
