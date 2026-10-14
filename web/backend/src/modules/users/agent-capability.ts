import { getContextUser } from "../../shared/executor/context.js";
import { isHostingSession, getTenantEnvelope, filterTenantUsers, tenantGroupPrefix } from "../../shared/tenant/tenant-scope.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Users — AI agent capability.
 *
 * Full CRUD over the connected server's Linux users and groups (groups carry
 * an optional permission record: general/panel/server). Every handler runs in
 * the chat request's executor scope, so mutations land on the target via the
 * same service layer the panel UI uses (write-behind queue, sudo, sync).
 *
 * Mutating tools declare a `permission` slug (admin-only for non-admins) and a
 * `kind: "action"` so the assistant runtime defaults them to require-confirm.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { usersService } from "./services/users.service.js";
import { rolesService } from "./services/roles.service.js";
import { panelUserRepository } from "../auth/repositories/panel-user.repository.js";
import { roleRepository } from "./repositories/role.repository.js";
import { systemAccountsService, ROLE_GROUP_PREFIX, SYSTEM_GID_MAX } from "./services/system-accounts.service.js";
import { ForbiddenError } from "../../shared/errors/index.js";

/** Mirror the controller guard: refuse to touch a system group (GID < 1000)
 *  or the legacy synthetic groups. */
async function assertNotSystemGroup(name: string): Promise<void> {
  if (name.startsWith(ROLE_GROUP_PREFIX)) {
    throw new ForbiddenError("Grupo reservado del sistema (legacy)");
  }
  const gid = (await systemAccountsService.listGroupGids()).get(name);
  if (gid !== undefined && gid <= SYSTEM_GID_MAX) {
    throw new ForbiddenError("No se puede modificar un grupo del sistema");
  }
}

/** Run a mutating handler and turn thrown AppErrors into a tool-level failure
 *  message (so the agent can relay it instead of aborting the loop). */
async function guard(fn: () => Promise<unknown>): Promise<{ ok: boolean; output: unknown }> {
  try {
    return { ok: true, output: await fn() };
  } catch (err) {
    return { ok: false, output: (err as Error).message ?? "Operation failed" };
  }
}

/** Shared description of the optional group permission matrix. */
const PERMISSIONS_DESC =
  "Optional permission matrix attached to the group. Shape: " +
  "{ sidebar: string[] (panel menu items), views: string[] (panel route ids like " +
  "'panel.mail'), actions: string[] (action slugs like 'mail.create'), " +
  "fileAccess: { allowAll: boolean, allowPaths: string[], readOnlyPaths: string[], " +
  "denyPaths: string[] }, commandPolicy: { allowAll: boolean, groups: string[], " +
  "allowCommands: string[], denyCommands: string[] } }. The accessible panel " +
  "modules are DERIVED automatically from the chosen sidebar/views/actions.";

export const usersAgentCapability: AgentCapability = {
  moduleId: "users",
  version: 1,
  tools: [
    {
      name: "users.list",
      title: "Listar usuarios del panel",
      description:
        "List the server's users with username, email, display name, Linux UID/GID, group " +
        "memberships, effective modules and enabled flag. Passwords / 2FA secrets are never returned.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const allUsers = await panelUserRepository.findAll();
        const actor = getContextUser();
        const users = actor && isHostingSession(actor) ? filterTenantUsers(getTenantEnvelope(actor), allUsers) : allUsers;
        const records = await roleRepository.findAll().catch(() => []);
        const modulesByGroup = new Map(
          records.map((r) => [r.name, Array.isArray(r.modules) ? (r.modules as unknown as string[]) : []]),
        );
        const safe = users.map((u) => {
          const groups = (u.groups ?? []).filter((g) => !g.startsWith(ROLE_GROUP_PREFIX) && g !== u.username);
          const modules = [...new Set(groups.flatMap((g) => modulesByGroup.get(g) ?? []))].sort();
          return {
            id: u.id,
            username: u.username,
            email: u.email,
            displayName: u.displayName,
            uid: u.systemUid,
            gid: u.systemGid,
            groups,
            modules,
            enabled: u.enabled,
          };
        });
        return { ok: true, output: safe };
      },
    },
    {
      name: "users.create",
      title: "Crear usuario",
      description:
        "Create a new Linux user on the connected server. Requires a username and password; " +
        "displayName, email, supplementary Linux group names and enabled flag are optional.",
      kind: "action",
      permission: "users.create",
      inputSchema: {
        type: "object",
        properties: {
          username: { type: "string", description: "Linux username (lowercase)." },
          password: { type: "string", description: "Initial password (min 8 chars, with upper/lower/digit)." },
          displayName: { type: "string", description: "GECOS display name." },
          email: { type: "string", description: "Recovery email." },
          groups: { type: "array", items: { type: "string" }, description: "Supplementary Linux group names." },
          enabled: { type: "boolean", description: "Whether the account is active (default true)." },
        },
        required: ["username", "password"],
      },
      handler: async (input) =>
        guard(async () => {
          const i = (input ?? {}) as Record<string, unknown>;
          const { user, job } = await usersService.create({
            username: String(i.username ?? ""),
            password: String(i.password ?? ""),
            displayName: typeof i.displayName === "string" ? i.displayName : undefined,
            email: typeof i.email === "string" ? i.email : undefined,
            groups: Array.isArray(i.groups) ? i.groups.map(String) : undefined,
            enabled: typeof i.enabled === "boolean" ? i.enabled : undefined,
          });
          return { id: user.id, username: user.username, job };
        }),
    },
    {
      name: "users.update",
      title: "Editar usuario",
      description:
        "Update an existing user identified by `username`. Any provided field is changed: " +
        "newUsername (rename), displayName, email, enabled (lock/unlock the Linux password), " +
        "and groups (the FULL desired set of supplementary group memberships, reconciled).",
      kind: "action",
      permission: "users.edit",
      inputSchema: {
        type: "object",
        properties: {
          username: { type: "string", description: "Current username of the target user." },
          newUsername: { type: "string", description: "Rename the user to this." },
          displayName: { type: "string" },
          email: { type: "string" },
          enabled: { type: "boolean", description: "true = unlock Linux password, false = lock." },
          groups: { type: "array", items: { type: "string" }, description: "Full desired supplementary group set." },
        },
        required: ["username"],
      },
      handler: async (input) =>
        guard(async () => {
          const i = (input ?? {}) as Record<string, unknown>;
          const username = String(i.username ?? "");
          const job = await usersService.update(-1, {
            _lookupUsername: username,
            username: typeof i.newUsername === "string" ? i.newUsername : undefined,
            displayName: typeof i.displayName === "string" ? i.displayName : undefined,
            email: typeof i.email === "string" ? i.email : undefined,
            enabled: typeof i.enabled === "boolean" ? i.enabled : undefined,
            groups: Array.isArray(i.groups) ? i.groups.map(String) : undefined,
          });
          return { username, job };
        }),
    },
    {
      name: "users.delete",
      title: "Eliminar usuario",
      description: "Delete a user (and its Linux account) identified by `username`. The root user and the last admin are protected.",
      kind: "action",
      permission: "users.delete",
      inputSchema: {
        type: "object",
        properties: { username: { type: "string", description: "Username to delete." } },
        required: ["username"],
      },
      handler: async (input) =>
        guard(async () => {
          const username = String((input as Record<string, unknown>)?.username ?? "");
          const job = await usersService.delete(-1, username);
          return { username, job };
        }),
    },
    {
      name: "users.groups_list",
      title: "Listar grupos con permisos",
      description:
        "List the groups that carry a panel permission record, with their description, derived " +
        "modules and full permission matrix (sidebar/views/actions + file/command policy).",
      kind: "read",
      permission: "roles.view",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const allRecords = await rolesService.list();
        const actor = getContextUser(), envelope = actor && isHostingSession(actor) ? getTenantEnvelope(actor) : null;
        const records = envelope ? allRecords.filter(r => r.name === envelope.tenantGroup || r.name.startsWith(tenantGroupPrefix(envelope))) : allRecords;
        const safe = records.map((r) => ({
          name: r.name,
          description: r.description ?? null,
          modules: Array.isArray(r.modules) ? (r.modules as unknown as string[]) : [],
          permissions: r.permissions ?? {},
        }));
        return { ok: true, output: safe };
      },
    },
    {
      name: "users.group_create",
      title: "Crear grupo",
      description:
        "Create a real Linux group on the connected server and attach an optional permission " +
        "record to it. " + PERMISSIONS_DESC,
      kind: "action",
      permission: "roles.create",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Linux group name." },
          description: { type: "string" },
          permissions: { type: "object", description: "Permission matrix (see description)." },
        },
        required: ["name"],
      },
      handler: async (input) =>
        guard(async () => {
          const i = (input ?? {}) as Record<string, unknown>;
          const role = await rolesService.create({
            name: String(i.name ?? ""),
            description: typeof i.description === "string" ? i.description : undefined,
            permissions: (i.permissions as Record<string, unknown>) ?? undefined,
          });
          return { name: role.name, modules: role.modules };
        }),
    },
    {
      name: "users.group_update",
      title: "Editar grupo",
      description:
        "Update a group's permission record by `name` (creating the record if it had none). " +
        "Can rename the real Linux group via newName (user-created groups only). " + PERMISSIONS_DESC,
      kind: "action",
      permission: "roles.edit",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Current group name." },
          newName: { type: "string", description: "Rename the group to this (user groups only)." },
          description: { type: "string" },
          permissions: { type: "object", description: "Permission matrix (see description)." },
        },
        required: ["name"],
      },
      handler: async (input) =>
        guard(async () => {
          const i = (input ?? {}) as Record<string, unknown>;
          const name = String(i.name ?? "");
          // Renaming a system group is forbidden (editing its matrix is fine).
          if (typeof i.newName === "string" && i.newName.trim() !== name) {
            await assertNotSystemGroup(name);
          }
          const role = await rolesService.updateByName(name, {
            newName: typeof i.newName === "string" ? i.newName : undefined,
            description: typeof i.description === "string" ? i.description : undefined,
            permissions: (i.permissions as Record<string, unknown>) ?? undefined,
          });
          return { name: role.name, modules: role.modules };
        }),
    },
    {
      name: "users.group_delete",
      title: "Eliminar grupo",
      description: "Delete a user-created Linux group (and its permission record) by `name`. System groups (GID < 1000) are protected.",
      kind: "action",
      permission: "roles.delete",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Group name to delete." } },
        required: ["name"],
      },
      handler: async (input) =>
        guard(async () => {
          const name = String((input as Record<string, unknown>)?.name ?? "");
          await assertNotSystemGroup(name);
          await rolesService.deleteByName(name);
          return { name, deleted: true };
        }),
    },
  ],
  suggestedPrompts: [
    "¿Qué usuarios tiene el servidor?",
    "Crea un usuario llamado soporte con acceso al módulo de correo",
    "Lista los grupos con permisos del panel",
  ],
};
