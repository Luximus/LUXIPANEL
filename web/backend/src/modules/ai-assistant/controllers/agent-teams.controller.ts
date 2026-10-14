// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — agent TEAMS (first-class grouping of custom agents).
 *
 *   GET    /api/ai/agent-teams        list (runs lazy backfill; annotates memberCount)
 *   GET    /api/ai/agent-teams/:id    get
 *   POST   /api/ai/agent-teams        create
 *   PUT    /api/ai/agent-teams/:id    update
 *   DELETE /api/ai/agent-teams/:id    delete (detaches teamId from members)
 *
 * Teams are PANEL-HOST/global (see agent-teams.repository.ts). Deleting a team
 * detaches it from any agent (`teamId: null`) but NEVER deletes the agents.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { assertOwner } from "./ownership.js";
import { getExecutor, getContextUserId } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { agentTeamsRepository } from "../repositories/agent-teams.repository.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { runBackfill } from "../services/agent-teams-backfill.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-agent-teams");

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  icon: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
});

/** El equipo es del usuario actual (o legacy/global sin dueño) → puede editar/borrar. */
function assertCanModify(ownerId: number | null | undefined, locale: unknown): void {
  assertOwner(ownerId, locale);
}

export const agentTeamsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    // Lazy, idempotent migration from the legacy name-prefix convention.
    try {
      await runBackfill();
    } catch (err) {
      log.warn({ err: (err as Error).message }, "agent-teams backfill perezoso falló (best-effort)");
    }
    const uid = getContextUserId();
    const teams = await agentTeamsRepository.list();
    const agents = await agentsRepository.list();
    const memberCount = new Map<string, number>();
    for (const a of agents) {
      if (a.teamId) memberCount.set(a.teamId, (memberCount.get(a.teamId) ?? 0) + 1);
    }
    const users = await panelUserRepository.findAll(getExecutor(req)).catch(() => []);
    const nameById = new Map(users.map((u) => [u.id, u.displayName || u.username]));
    const annotated = teams.map((t) => {
      const ownerId = t.ownerId ?? null;
      const relation: "owner" | "shared" = ownerId == null || ownerId === uid ? "owner" : "shared";
      return {
        ...t,
        ownerId,
        relation,
        ownerName: ownerId != null ? (nameById.get(ownerId) ?? null) : null,
        memberCount: t.id ? (memberCount.get(t.id) ?? 0) : 0,
      };
    });
    res.json({ ok: true, teams: annotated });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const team = await agentTeamsRepository.get(String(req.params["id"] ?? ""));
    if (!team) throw assistantNotFound(res.locals.locale, "team");
    res.json({ ok: true, team });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const team = await agentTeamsRepository.create(parsed.data);
    res.json({ ok: true, team });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    const cur = await agentTeamsRepository.get(id);
    if (!cur) throw assistantNotFound(res.locals.locale, "team");
    assertCanModify(cur.ownerId, res.locals.locale);
    const team = await agentTeamsRepository.update(id, parsed.data);
    res.json({ ok: true, team });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const cur = await agentTeamsRepository.get(id);
    if (!cur) throw assistantNotFound(res.locals.locale, "team");
    assertCanModify(cur.ownerId, res.locals.locale);
    const ok = await agentTeamsRepository.delete(id);
    // Detach the deleted team from its members (NEVER delete the agents).
    let detachedCount = 0;
    if (ok) {
      try {
        const agents = await agentsRepository.list();
        for (const a of agents) {
          if (a.id && a.teamId === id) {
            await agentsRepository.update(a.id, { teamId: null });
            detachedCount++;
          }
        }
      } catch {
        /* best-effort detach; an unknown teamId is harmless at run time */
      }
    }
    res.json({ ok, detachedCount });
  }),
};
