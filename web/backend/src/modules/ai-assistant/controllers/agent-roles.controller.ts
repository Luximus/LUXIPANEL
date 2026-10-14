// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — agent ROLES (reusable profile assigned to custom agents).
 *
 *   GET    /api/ai/agent-roles        list
 *   GET    /api/ai/agent-roles/:id    get
 *   POST   /api/ai/agent-roles        create
 *   PUT    /api/ai/agent-roles/:id    update
 *   DELETE /api/ai/agent-roles/:id    delete
 *
 * Roles are PANEL-HOST/global (see agent-roles.repository.ts). Deleting a role
 * also detaches it from any agent that referenced it (no dangling roleId).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { assertOwner } from "./ownership.js";
import { getExecutor, getContextUserId } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { agentRolesRepository } from "../repositories/agent-roles.repository.js";
import { normalizeAllowedTools } from "../services/tool-allowlist.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  systemPrompt: z.string().max(20000).default(""),
  allowedTools: z.array(z.string().max(120)).max(500).nullable().optional(),
  icon: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
  canSpawnChats: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().max(20000).optional(),
  allowedTools: z.array(z.string().max(120)).max(500).nullable().optional(),
  icon: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
  canSpawnChats: z.boolean().optional(),
});

/** El rol es del usuario actual (o legacy sin dueño) → puede editar/borrar. */
function assertCanModify(ownerId: number | null | undefined, locale: unknown): void {
  assertOwner(ownerId, locale);
}

export async function loadAssistantRoles(req: Request, _res: Response) {
    const uid = getContextUserId();
    const roles = await agentRolesRepository.list();
    const users = await panelUserRepository.findAll(getExecutor(req)).catch(() => []);
    const nameById = new Map(users.map((u) => [u.id, u.displayName || u.username]));
    const annotated = roles.map((r) => {
      const ownerId = r.ownerId ?? null;
      const relation: "owner" | "shared" = ownerId == null || ownerId === uid ? "owner" : "shared";
      return { ...r, ownerId, relation, ownerName: ownerId != null ? (nameById.get(ownerId) ?? null) : null };
    });
    return annotated;
}

export const agentRolesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, roles: await loadAssistantRoles(req, res) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const role = await agentRolesRepository.get(String(req.params["id"] ?? ""));
    if (!role) throw assistantNotFound(res.locals.locale, "role");
    res.json({ ok: true, role });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    if (Array.isArray(parsed.data.allowedTools)) {
      parsed.data.allowedTools = normalizeAllowedTools(parsed.data.allowedTools, {
        onUnknown: "reject",
        context: "agent-roles.create",
      })!.valid;
    }
    const role = await agentRolesRepository.create(parsed.data);
    res.json({ ok: true, role });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const cur = await agentRolesRepository.get(id);
    if (!cur) throw assistantNotFound(res.locals.locale, "role");
    assertCanModify(cur.ownerId, res.locals.locale);
    if (Array.isArray(parsed.data.allowedTools)) {
      parsed.data.allowedTools = normalizeAllowedTools(parsed.data.allowedTools, {
        onUnknown: "reject",
        context: "agent-roles.update",
      })!.valid;
    }
    const role = await agentRolesRepository.update(id, parsed.data);
    res.json({ ok: true, role });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const cur = await agentRolesRepository.get(id);
    if (!cur) throw assistantNotFound(res.locals.locale, "role");
    assertCanModify(cur.ownerId, res.locals.locale);
    const ok = await agentRolesRepository.delete(id);
    // Detach the deleted role from any agent that still references it.
    if (ok) {
      try {
        const agents = await agentsRepository.list();
        for (const a of agents) {
          if (a.id && a.roleId === id) await agentsRepository.update(a.id, { roleId: null });
        }
      } catch {
        /* best-effort cleanup; the runtime ignores an unknown roleId anyway */
      }
    }
    res.json({ ok });
  }),
};
