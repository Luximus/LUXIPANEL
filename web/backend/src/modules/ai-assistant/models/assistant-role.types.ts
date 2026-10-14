// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI agent ROLES — a reusable profile (name + description + system prompt +
 * default tool allowlist) that can be assigned to one or more custom agents.
 *
 * A role is layered UNDER the agent at run time: the role's system prompt is
 * injected first (the base persona/policy), then the agent's own prompt refines
 * it; the role's `allowedTools` and the agent's `allowedTools` are BOTH applied
 * as narrowing intersections (a role can cap what its agents may ever touch; the
 * agent can narrow further, never widen).
 *
 * Storage: like agents, roles are PANEL-HOST instance state (global across every
 * server the panel manages), persisted in `assistant/roles.json` on the panel
 * host (see agent-roles.repository.ts).
 */

import { sanitizeAllowedTools } from "./assistant-agent.types.js";

export interface AssistantRole {
  id?: string;
  /** Display name (e.g. "Auditor de seguridad", "Coordinador"). */
  name: string;
  /** Short human description shown in the card / used as a prompt preamble. */
  description: string;
  /** Base system-prompt block injected before the agent's own prompt. */
  systemPrompt: string;
  /**
   * Default allowed tool NAMES for agents with this role. `null`/absent = no
   * restriction from the role. A list caps the agents' tool set (intersected at
   * run time, so it can only ever narrow the permitted set).
   */
  allowedTools: string[] | null;
  /** Presentation only. */
  icon?: string;
  color?: string;
  /**
   * Permission granted by this role (a "cargo"): agents with this role may act
   * as supervisors and create chats for their subordinates (`chats.create`).
   * Effective if the role OR the agent itself grants it.
   */
  canSpawnChats?: boolean;
  /** Panel user id that created the role (global store → distinguishes owner). */
  ownerId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export { sanitizeAllowedTools };
