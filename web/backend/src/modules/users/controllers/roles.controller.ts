// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Groups controller — lists REAL Linux groups (cache-first `getent group`),
 * overlays each group's optional permission record (by NAME), and exposes CRUD
 * keyed by group name. The API path stays `/api/roles` for back-compat; the
 * concept is "Linux groups with optional permissions" now.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { rolesService } from "../services/roles.service.js";
import { getRolePermissionsCatalog } from "../../../shared/auth/role-permissions.js";
import { systemAccountsService, ROLE_GROUP_PREFIX, SYSTEM_GID_MAX } from "../services/system-accounts.service.js";
import { roleRepository } from "../repositories/role.repository.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { getExecutor, quoteCmd } from "../../../shared/executor/index.js";
import { serveCachedDataTable } from "../../../shared/remote-cache/serve-cached-datatable.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { isHostingSession, getTenantEnvelope, tenantGroupPrefix } from "../../../shared/tenant/tenant-scope.js";

interface RawGroupRow {
  id: number;
  name: string;
  members: string[];
}

async function readLinuxGroupsFromServer(req: Request): Promise<RawGroupRow[]> {
  const executor = getExecutor(req);
  let stdout = "";
  try {
    const result = await executor.exec(quoteCmd("getent", ["group"]));
    stdout = result.stdout;
  } catch {
    return [];
  }

  const groups: RawGroupRow[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [name, , gidRaw, membersRaw] = line.split(":");
    if (!name || !gidRaw) continue;
    const gid = Number.parseInt(gidRaw, 10);
    if (!Number.isFinite(gid)) continue;
    const members = (membersRaw ?? "").split(",").map((m) => m.trim()).filter(Boolean);
    groups.push({ id: gid, name, members });
  }
  return groups;
}

const createGroupSchema = z.object({
  name: z.string().min(2).max(64).trim(),
  description: z.string().max(256).optional(),
  permissions: z.record(z.any()).optional(),
});

const updateGroupSchema = z.object({
  newName: z.string().min(2).max(64).trim().optional(),
  description: z.string().max(256).nullable().optional(),
  permissions: z.record(z.any()).optional(),
});

export const rolesController = {
  /** GET /api/roles — list real Linux groups, overlaid with permission records. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cached = await serveCachedDataTable<RawGroupRow>({
      executor, module: CACHE_KEYS.users.roles.module, collection: CACHE_KEYS.users.roles.collection,
      liveLoader: () => readLinuxGroupsFromServer(req),
    });

    const records = await roleRepository.findAll().catch(() => []);
    const byName = new Map(records.map((r) => [r.name, r]));

    // User Private Groups (UPG): `useradd` creates a group named after the user
    // with the same primary GID. They're not assignable permission groups, so
    // hide them (unless someone deliberately attached a permission record).
    const users = await panelUserRepository.findAll().catch(() => []);
    const primaryGidByName = new Map(users.map((u) => [u.username, u.systemGid]));
    const isUserPrivateGroup = (name: string, gid: number): boolean => {
      const primaryGid = primaryGidByName.get(name);
      return primaryGid != null && primaryGid === gid;
    };

    const data = cached.rows
      .filter((g) => !g.name.startsWith(ROLE_GROUP_PREFIX)) // hide legacy synthetic groups
      .filter((g) => byName.has(g.name) || !isUserPrivateGroup(g.name, g.id)) // hide UPGs w/o a record
      .map((g) => {
        const rec = byName.get(g.name);
        return {
          id: g.id, // GID
          name: g.name,
          kind: g.id <= SYSTEM_GID_MAX ? "system" : "user",
          members: g.members,
          description: rec?.description ?? null,
          modules: Array.isArray(rec?.modules) ? (rec!.modules as unknown as string[]) : [],
          permissions: rec?.permissions ?? null,
          hasPermissions: Boolean(rec),
        };
      });

    // ── Fase 3: hosting tenant scoping. A tenant only sees its own groups: the
    //    root tenant group (read-only — it's the provider-managed template) plus
    //    its tenant-local child groups (h-<owner>-*). Admin sees all groups.
    let out = data;
    const ctx = getContextUser();
    if (isHostingSession(ctx)) {
      const env = getTenantEnvelope(ctx!);
      const prefix = tenantGroupPrefix(env);
      out = data.filter((g) => g.name === env.tenantGroup || g.name.startsWith(prefix));
    }

    const { hostingAccountRepository } = await import("../../hosting/repositories/hosting-account.repository.js");
    const { hostingTemplateService } = await import("../../hosting/services/hosting-template.service.js");
    const accounts = (await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, executor)).rows;
    const projected = await Promise.all(out.map(async group => {
      const account = accounts.find(a => a.templateId && a.tenantGroup === group.name);
      if (!account) return group;
      const plan = await hostingTemplateService.get(executor, account.templateId!);
      const effective = await hostingTemplateService.project(executor, account, plan);
      return { ...group, permissions: effective.permissionTemplate, modules: effective.allowedModules,
        hostingTemplate: { id: plan.id, name: plan.name, revision: plan.revision, state: effective.policyState }, permissionCeiling: effective.templateBase ?? effective.permissionTemplate };
    }));
    res.json({ ok: true, data: projected });
  }),

  catalog: asyncHandler(async (_req: Request, res: Response) => {
    // Built dynamically from the module registry (modules are not hardcoded;
    // a new/dynamic module appears here automatically).
    res.json({ ok: true, data: getRolePermissionsCatalog() });
  }),

  /** POST /api/roles — create a real Linux group + permission record. */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createGroupSchema.parse(req.body);
    const role = await rolesService.create(body);
    res.status(201).json({ ok: true, data: role });
  }),

  /** PUT /api/roles/:name — update a group's permission record (and optionally rename it). */
  update: asyncHandler(async (req: Request, res: Response) => {
    const name = decodeURIComponent(String(req.params.name));
    const body = updateGroupSchema.parse(req.body);

    // Renaming a SYSTEM group (GID < 1000) is forbidden; editing its permission
    // matrix is allowed.
    if (body.newName && body.newName.trim() !== name) {
      const gids = await systemAccountsService.listGroupGids();
      const gid = gids.get(name);
      if (gid !== undefined && gid <= SYSTEM_GID_MAX) {
        throw new ForbiddenError("No se puede renombrar un grupo del sistema");
      }
    }

    const role = await rolesService.updateByName(name, body);
    res.json({ ok: true, data: role });
  }),

  /** DELETE /api/roles/:name — delete a (user-created) Linux group + its record. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const name = decodeURIComponent(String(req.params.name));
    if (name.startsWith(ROLE_GROUP_PREFIX)) {
      throw new ForbiddenError("Grupo reservado del sistema (legacy)");
    }
    const gids = await systemAccountsService.listGroupGids();
    const gid = gids.get(name);
    if (gid !== undefined && gid <= SYSTEM_GID_MAX) {
      throw new ForbiddenError("No se puede eliminar un grupo del sistema");
    }
    await rolesService.deleteByName(name);
    res.json({ ok: true });
  }),
};
