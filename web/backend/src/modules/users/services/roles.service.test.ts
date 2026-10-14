// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Regression tests — the `admin` group's module set must stay in lockstep with
 * the canonical assignable-module catalog (no hand-maintained literal that goes
 * stale). Previously `VALID_MODULES` was a static array missing modules that
 * exist today (obsidian, databases, cloudflare, expo, hosting, terminal, …),
 * so the `admin` group's `modules[]` silently omitted them.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Canonical catalog stand-in: includes the modules the old literal was missing.
const CANONICAL_MODULES = [
  "users", "admin", "assistant", "mail", "monitor", "files", "firewall",
  "dns", "backups", "cron", "webhooks",
  // Previously MISSING from the stale VALID_MODULES literal:
  "obsidian", "databases", "cloudflare", "expo", "hosting", "terminal",
  "bitninja", "openclaw",
];

vi.mock("../../auth/services/role-permissions.service.js", () => ({
  assignableModuleSlugs: () => [...CANONICAL_MODULES],
  deriveModulesFromPermissions: vi.fn(() => ["files"]),
  validateRolePermissions: (raw: unknown) => (raw ?? {}) as Record<string, unknown>,
  normalizeRolePermissions: (raw: unknown) => (raw ?? {}) as Record<string, unknown>,
}));

vi.mock("../../../shared/auth/authorization-revision.js", () => ({ authorizationChanged: vi.fn() }));

const actor = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
const created: Array<{ name: string; modules: string[] }> = [];
vi.mock("../repositories/role.repository.js", () => ({
  roleRepository: {
    findByName: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(async (data: { name: string; modules: string[] }) => {
      created.push({ name: data.name, modules: data.modules });
      return { id: 1, name: data.name, description: null, modules: data.modules, permissions: {}, createdAt: new Date(), updatedAt: new Date() };
    }),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("./system-accounts.service.js", () => ({
  ROLE_GROUP_PREFIX: "lxp-role-",
  systemAccountsService: {
    ensureGroup: vi.fn().mockResolvedValue("admin"),
    renameGroup: vi.fn(),
    deleteGroup: vi.fn(),
  },
}));

vi.mock("../../auth/services/login-acl.service.js", () => ({
  loginAclService: { refresh: vi.fn() },
}));

vi.mock("../../../shared/executor/context.js", () => ({
  getContextExecutor: () => null,
  getContextUser: () => actor.user,
}));

vi.mock("../../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn() },
  Events: { ROLE_CREATED: "role:created", ROLE_UPDATED: "role:updated", ROLE_DELETED: "role:deleted" },
}));

vi.mock("../../../shared/logger/index.js", () => ({
  createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { rolesService, validModuleSlugs } from "./roles.service.js";

beforeEach(() => {
  actor.user = null;
  created.length = 0;
});

describe("roles.service — admin group module SSOT", () => {
  it("validModuleSlugs() == the canonical assignable catalog set", () => {
    expect([...validModuleSlugs()].sort()).toEqual([...CANONICAL_MODULES].sort());
  });

  it("the admin group receives the FULL canonical module set (incl. previously-missing modules)", async () => {
    await rolesService.create({ name: "admin" });
    const adminModules = created.find((r) => r.name === "admin")?.modules ?? [];
    expect([...adminModules].sort()).toEqual([...CANONICAL_MODULES].sort());
    // The entitlement bug: these existed but the stale literal omitted them.
    for (const m of ["obsidian", "databases", "cloudflare", "expo", "hosting", "terminal"]) {
      expect(adminModules).toContain(m);
    }
    // Admin marker must survive so the group stays admin kind.
    expect(adminModules).toContain("admin");
  });

  it("a non-admin group derives modules from its permissions (not the full set)", async () => {
    await rolesService.create({ name: "editors", permissions: { sidebar: ["files"] } });
    const editorModules = created.find((r) => r.name === "editors")?.modules ?? [];
    expect(editorModules).toEqual(["files"]);
  });
});

describe("non-hosting group mutation guard", () => {
  it("refuses administrator group escalation through a service/tool call", async () => {
    actor.user = { kind: "user", userId: 7, username: "internal-user" };
    await expect(rolesService.create({ name: "admin", permissions: {} })).rejects.toThrow("requires a hosting account");
    expect(created).toHaveLength(0);
  });
});
