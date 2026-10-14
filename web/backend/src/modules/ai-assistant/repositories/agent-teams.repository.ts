// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI agent TEAMS repository — CRUD over a PANEL-HOST sidecar
 * (`${LUXIPANEL_CONFIG_DIR}/assistant/teams.json` on the panel host).
 *
 * Same storage domain as agents and roles (global instance state, not
 * per-server): every op runs inside `runOnPanelHost` so both the chat runtime
 * and the cron scheduler read/write the same store. Mirrors
 * agent-roles.repository.ts.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import { runOnPanelHost, getContextUserId } from "../../../shared/executor/index.js";
import type { AgentTeam } from "../models/assistant-team.types.js";

const MODULE = "assistant";
const COLLECTION = "teams";

/** Always the panel-host store — pass no executor; `runOnPanelHost` pins it. */
function store() {
  return dataStore<AgentTeam>(undefined, MODULE, COLLECTION, { idStrategy: "uuid" });
}

type CreateInput = Pick<AgentTeam, "name"> & Partial<Pick<AgentTeam, "description" | "icon" | "color" | "ownerId">>;
type UpdateInput = Partial<Pick<AgentTeam, "name" | "description" | "icon" | "color">>;

export const agentTeamsRepository = {
  async list(): Promise<AgentTeam[]> {
    return runOnPanelHost(async () => {
      const all = await store().list();
      return [...all].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    });
  },

  async get(id: string): Promise<AgentTeam | null> {
    if (!id) return null;
    return runOnPanelHost(() => store().get(id) as Promise<AgentTeam | null>);
  },

  async create(data: CreateInput): Promise<AgentTeam> {
    return runOnPanelHost(() =>
      store().create({
        name: (data.name || "").slice(0, 120) || "Equipo",
        description: (data.description || "").slice(0, 500),
        icon: (data.icon || "users-group").slice(0, 60),
        color: (data.color || "violet").slice(0, 30),
        // Backfill passes `ownerId: null` explicitly (global team) even inside a
        // GET request; the normal create path falls back to the context user.
        ownerId: data.ownerId !== undefined ? data.ownerId : (getContextUserId() ?? null),
      }),
    );
  },

  async update(id: string, patch: UpdateInput): Promise<AgentTeam | null> {
    const clean: Partial<AgentTeam> = {};
    if (patch.name !== undefined) clean.name = patch.name.slice(0, 120);
    if (patch.description !== undefined) clean.description = patch.description.slice(0, 500);
    if (patch.icon !== undefined) clean.icon = patch.icon.slice(0, 60);
    if (patch.color !== undefined) clean.color = patch.color.slice(0, 30);
    return runOnPanelHost(() => store().update(id, clean) as Promise<AgentTeam | null>);
  },

  async delete(id: string): Promise<boolean> {
    return runOnPanelHost(() => store().delete(id));
  },

  /** Case-insensitive, trimmed name lookup — for find-or-create without dupes. */
  async findByName(name: string): Promise<AgentTeam | null> {
    const needle = (name || "").trim().toLowerCase();
    if (!needle) return null;
    return runOnPanelHost(async () => {
      const all = await store().list();
      return all.find((t) => (t.name || "").trim().toLowerCase() === needle) ?? null;
    });
  },
};
