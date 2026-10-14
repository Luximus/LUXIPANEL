// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI agent ROLES repository — CRUD over a PANEL-HOST sidecar
 * (`${LUXIPANEL_CONFIG_DIR}/assistant/roles.json` on the panel host).
 *
 * Same storage domain as agents (global instance state, not per-server): every
 * op runs inside `runOnPanelHost` so both the chat runtime and the cron
 * scheduler read/write the same store. Mirrors agents.repository.ts.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import { runOnPanelHost, getContextUserId } from "../../../shared/executor/index.js";
import { type AssistantRole, sanitizeAllowedTools } from "../models/assistant-role.types.js";

const MODULE = "assistant";
const COLLECTION = "roles";

/** Always the panel-host store — pass no executor; `runOnPanelHost` pins it. */
function store() {
  return dataStore<AssistantRole>(undefined, MODULE, COLLECTION, { idStrategy: "uuid" });
}

type CreateInput = Pick<AssistantRole, "name" | "description" | "systemPrompt"> &
  Partial<Pick<AssistantRole, "allowedTools" | "icon" | "color" | "canSpawnChats">>;
type UpdateInput = Partial<
  Pick<AssistantRole, "name" | "description" | "systemPrompt" | "allowedTools" | "icon" | "color" | "canSpawnChats">
>;

export const agentRolesRepository = {
  async list(): Promise<AssistantRole[]> {
    return runOnPanelHost(async () => {
      const all = await store().list();
      return [...all].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    });
  },

  async get(id: string): Promise<AssistantRole | null> {
    if (!id) return null;
    return runOnPanelHost(() => store().get(id) as Promise<AssistantRole | null>);
  },

  async create(data: CreateInput): Promise<AssistantRole> {
    return runOnPanelHost(() =>
      store().create({
        name: (data.name || "").slice(0, 120) || "Rol",
        description: (data.description || "").slice(0, 500),
        systemPrompt: (data.systemPrompt || "").slice(0, 20000),
        allowedTools: sanitizeAllowedTools(data.allowedTools),
        icon: (data.icon || "shield").slice(0, 60),
        color: (data.color || "indigo").slice(0, 30),
        canSpawnChats: Boolean(data.canSpawnChats),
        ownerId: getContextUserId() ?? null,
      }),
    );
  },

  async update(id: string, patch: UpdateInput): Promise<AssistantRole | null> {
    const clean: Partial<AssistantRole> = {};
    if (patch.name !== undefined) clean.name = patch.name.slice(0, 120);
    if (patch.description !== undefined) clean.description = patch.description.slice(0, 500);
    if (patch.systemPrompt !== undefined) clean.systemPrompt = patch.systemPrompt.slice(0, 20000);
    if (patch.allowedTools !== undefined) clean.allowedTools = sanitizeAllowedTools(patch.allowedTools);
    if (patch.icon !== undefined) clean.icon = patch.icon.slice(0, 60);
    if (patch.color !== undefined) clean.color = patch.color.slice(0, 30);
    if (patch.canSpawnChats !== undefined) clean.canSpawnChats = Boolean(patch.canSpawnChats);
    return runOnPanelHost(() => store().update(id, clean) as Promise<AssistantRole | null>);
  },

  async delete(id: string): Promise<boolean> {
    return runOnPanelHost(() => store().delete(id));
  },
};
