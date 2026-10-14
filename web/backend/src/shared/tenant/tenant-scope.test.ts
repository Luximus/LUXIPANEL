// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import type { SessionUser } from "../types/index.js";
import type { RolePermissionsData } from "../auth/role-permissions.js";
import {
  isHostingSession,
  getTenantEnvelope,
  isTenantDbName,
  tenantDbPrefix,
  tenantGroupPrefix,
  isTenantGroupName,
  isTenantMember,
  filterTenantUsers,
  clampGroupsToTenant,
  clampModulesToTenant,
  assertWithinSubUserQuota,
  assertTenantUsernameSafe,
  assertTargetInTenant,
  assertNotOwner,
  assertTenantGroupCreatable,
  assertTenantGroupMutable,
  clampPermissionsToEnvelope,
  type TenantEnvelope,
} from "./tenant-scope.js";

const template: RolePermissionsData = {
  sidebar: ["dashboard", "files", "users"],
  views: ["panel.dashboard", "panel.files", "panel.users"],
  actions: ["files.read", "files.write", "users.view", "users.create"],
  fileAccess: {
    allowAll: false,
    allowPaths: ["/home/acme"],
    denyPaths: [],
    readOnlyPaths: [],
    defaultPath: "/home/acme",
  },
  commandPolicy: { allowAll: false, groups: ["filesystem"], allowCommands: [], denyCommands: [] },
};

const env: TenantEnvelope = {
  owner: "acme",
  tenantGroup: "h-acme",
  homeRoot: "/home/acme",
  maxSubUsers: 3,
  maxDomains: 5,
  maxEmailAccounts: 10,
  maxDatabases: 2,
  diskQuotaMb: 1024,
  allowedModules: ["files", "users"],
  permissionTemplate: template,
};

function session(over: Partial<SessionUser> = {}): SessionUser {
  return {
    userId: 1, username: "acme", displayName: "Acme", role: "hosting",
    modules: ["files", "users"], kind: "hosting",
    owner: "acme", tenantGroup: "h-acme", homeRoot: "/home/acme", maxSubUsers: 3,
    permissions: template,
    ...over,
  };
}

describe("tenant-scope", () => {
  it("keeps databases of nested account names separate", () => {
    const owners = ["acme", "acme_shop", "other"];
    expect(isTenantDbName(env, "acme_store", owners)).toBe(true);
    expect(isTenantDbName(env, "acme_shop_orders", owners)).toBe(false);
    expect(isTenantDbName(env, "other_orders", owners)).toBe(false);
  });
  it("uses a valid stable database prefix for Linux usernames with hyphens", () => {
    const hyphenOwner = { ...env, owner: "acme-shop" };
    const prefix = tenantDbPrefix(hyphenOwner);
    expect(prefix).toMatch(/^lxp_[0-9a-f]{16}_$/);
    expect(isTenantDbName(hyphenOwner, `${prefix}orders`)).toBe(true);
    expect(isTenantDbName(hyphenOwner, "acme-shop_orders")).toBe(false);
  });
  it("applies tenant isolation to hosting and scoped ordinary users", () => {
    expect(isHostingSession(session())).toBe(true);
    expect(isHostingSession(session({ kind: "user", tenantId: 7 }))).toBe(true);
    expect(isHostingSession(session({ kind: "user", tenantId: undefined }))).toBe(false);
    expect(isHostingSession(session({ kind: "admin" }))).toBe(false);
    expect(isHostingSession(null)).toBe(false);
  });

  it("getTenantEnvelope builds from a complete token", () => {
    expect(getTenantEnvelope(session())).toMatchObject({
      owner: "acme", tenantGroup: "h-acme", homeRoot: "/home/acme", maxSubUsers: 3,
    });
  });

  it("getTenantEnvelope fails closed on a pre-Fase3 token", () => {
    expect(() => getTenantEnvelope(session({ tenantGroup: undefined }))).toThrow();
    expect(() => getTenantEnvelope(session({ maxSubUsers: undefined }))).toThrow();
  });

  it("getTenantEnvelope falls back to allowPaths[0] for homeRoot", () => {
    const e = getTenantEnvelope(session({ homeRoot: undefined }));
    expect(e.homeRoot).toBe("/home/acme");
  });

  it("getTenantEnvelope rejects a degenerate homeRoot (cross-tenant guard)", () => {
    // "/" would make almost every VPS user a tenant member via isTenantMember.
    expect(() => getTenantEnvelope(session({ homeRoot: "/" }))).toThrow();
    expect(() => getTenantEnvelope(session({ homeRoot: "//" }))).toThrow();
    expect(() => getTenantEnvelope(session({ homeRoot: "home/acme" }))).toThrow(); // relative
    expect(() => getTenantEnvelope(session({ homeRoot: "/home/../etc" }))).toThrow(); // traversal
  });

  it("getTenantEnvelope normalizes a trailing slash on homeRoot", () => {
    expect(getTenantEnvelope(session({ homeRoot: "/home/acme/" })).homeRoot).toBe("/home/acme");
  });

  it("group prefix + name validation", () => {
    expect(tenantGroupPrefix(env)).toBe("h-acme-");
    expect(isTenantGroupName(env, "h-acme")).toBe(true);
    expect(isTenantGroupName(env, "h-acme-devs")).toBe(true);
    expect(isTenantGroupName(env, "admin")).toBe(false);
    expect(isTenantGroupName(env, "sudo")).toBe(false);
    expect(isTenantGroupName(env, "h-other-devs")).toBe(false);
  });

  it("isTenantMember: owner, group member, home under root", () => {
    expect(isTenantMember(env, { username: "acme" })).toBe(true);
    expect(isTenantMember(env, { username: "sub1", groups: ["h-acme"] })).toBe(true);
    expect(isTenantMember(env, { username: "sub2", homeDir: "/home/acme/sub2" })).toBe(true);
    expect(isTenantMember(env, { username: "stranger", homeDir: "/home/stranger" })).toBe(false);
    expect(isTenantMember(env, { username: "root", homeDir: "/root", groups: ["sudo"] })).toBe(false);
  });

  it("home-root prefix is exact (no /home/acme-evil bypass)", () => {
    expect(isTenantMember(env, { username: "x", homeDir: "/home/acme-evil" })).toBe(false);
  });

  it("filterTenantUsers keeps only members", () => {
    const out = filterTenantUsers(env, [
      { username: "acme", homeDir: "/home/acme" },
      { username: "sub1", homeDir: "/home/acme/sub1" },
      { username: "root", homeDir: "/root" },
      { username: "www-data", homeDir: "/var/www" },
    ]);
    expect(out.map((u) => u.username)).toEqual(["acme", "sub1"]);
  });

  it("clampGroupsToTenant drops system/foreign groups, dedupes", () => {
    expect(clampGroupsToTenant(env, ["h-acme", "h-acme-devs", "sudo", "h-other", "admin"]))
      .toEqual(["h-acme", "h-acme-devs"]);
  });

  it("clampModulesToTenant restricts to allowedModules", () => {
    expect(clampModulesToTenant(env, ["files", "admin", "mail", "users"]))
      .toEqual(["files", "users"]);
  });

  it("quota enforcement", () => {
    expect(() => assertWithinSubUserQuota(env, 2)).not.toThrow();
    expect(() => assertWithinSubUserQuota(env, 3)).toThrow();
    expect(() => assertWithinSubUserQuota(env, 4)).toThrow();
  });

  it("username safety blocks system names", () => {
    expect(() => assertTenantUsernameSafe("sub1")).not.toThrow();
    expect(() => assertTenantUsernameSafe("root")).toThrow();
    expect(() => assertTenantUsernameSafe("admin")).toThrow();
  });

  it("assertTargetInTenant + assertNotOwner", () => {
    expect(() => assertTargetInTenant(env, { username: "sub1", groups: ["h-acme"] })).not.toThrow();
    expect(() => assertTargetInTenant(env, { username: "stranger", homeDir: "/home/x" })).toThrow();
    expect(() => assertNotOwner(env, "sub1")).not.toThrow();
    expect(() => assertNotOwner(env, "acme")).toThrow();
  });

  it("group create/mutate guards", () => {
    expect(() => assertTenantGroupCreatable(env, "h-acme-devs")).not.toThrow();
    expect(() => assertTenantGroupCreatable(env, "h-acme")).toThrow();   // root is provider-managed
    expect(() => assertTenantGroupCreatable(env, "devs")).toThrow();     // wrong prefix
    expect(() => assertTenantGroupCreatable(env, "admin")).toThrow();

    expect(() => assertTenantGroupMutable(env, "h-acme-devs")).not.toThrow();
    expect(() => assertTenantGroupMutable(env, "h-acme")).toThrow();     // can't touch root
    expect(() => assertTenantGroupMutable(env, "sudo")).toThrow();
  });

  it("clampPermissionsToEnvelope: ⊆ template, fileAccess ⊆ homeRoot, no allowAll", () => {
    const clamped = clampPermissionsToEnvelope(env, {
      sidebar: ["dashboard", "files", "settings"],            // settings dropped (not in template)
      views: ["panel.files", "panel.settings"],               // settings view dropped
      actions: ["files.read", "files.chmod", "users.create"], // files.chmod dropped (not in template)
      fileAccess: {
        allowAll: true,                                       // forced false → [homeRoot]
        allowPaths: ["/etc", "/home/acme/www"],               // /etc dropped
        denyPaths: ["/home/acme/secret"],
        readOnlyPaths: ["/"],                                 // "/" → homeRoot
        defaultPath: "/etc",                                  // outside → homeRoot
      },
      commandPolicy: { allowAll: true, groups: ["filesystem", "network"], allowCommands: [], denyCommands: [] },
    });

    expect(clamped.sidebar).toEqual(["dashboard", "files"]);
    expect(clamped.views).toEqual(["panel.files"]);
    expect(clamped.actions).toEqual(["files.read", "users.create"]);
    expect(clamped.fileAccess.allowAll).toBe(false);
    expect(clamped.fileAccess.allowPaths).toEqual(["/home/acme"]); // allowAll collapsed to root
    expect(clamped.fileAccess.readOnlyPaths).toEqual(["/home/acme"]);
    expect(clamped.fileAccess.defaultPath).toBe("/home/acme");
    expect(clamped.commandPolicy.allowAll).toBe(false);
    expect(clamped.commandPolicy.groups).toEqual(["filesystem"]); // network dropped
  });

  it("clampPermissionsToEnvelope honours template wildcard actions", () => {
    const wildcardEnv: TenantEnvelope = {
      ...env,
      permissionTemplate: { ...template, actions: ["files.*"] },
    };
    const clamped = clampPermissionsToEnvelope(wildcardEnv, {
      ...template,
      actions: ["files.read", "files.write", "users.create"],
    });
    expect(clamped.actions).toEqual(["files.read", "files.write"]); // users.create dropped
  });

  it("cannot delegate wider paths, write access or commands than the parent group permits", () => {
    const restricted = { ...env, permissionTemplate: { ...template,
      fileAccess: { ...template.fileAccess, allowPaths: ["/home/acme/www"], denyPaths: ["/home/acme/www/private"], readOnlyPaths: ["/home/acme/www"] },
      commandPolicy: { allowAll: false, groups: ["filesystem"], allowCommands: ["ls"], denyCommands: ["rm*"] } } };
    const requested = { ...template, fileAccess: { ...template.fileAccess, allowAll: true },
      commandPolicy: { allowAll: true, groups: ["filesystem", "network"], allowCommands: ["ls", "sudo*"], denyCommands: [] } };
    const result = clampPermissionsToEnvelope(restricted, requested);
    expect(result.fileAccess.allowPaths).toEqual(["/home/acme/www"]);
    expect(result.fileAccess.denyPaths).toEqual(["/home/acme/www/private"]);
    expect(result.fileAccess.readOnlyPaths).toEqual(["/home/acme/www"]);
    expect(result.commandPolicy.allowCommands).toEqual(["ls"]);
    expect(result.commandPolicy.denyCommands).toEqual(["rm*"]);
  });
});
