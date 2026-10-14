import { describe, it, expect, vi } from "vitest";
vi.mock("../../admin/services/module-registry.service.js", () => ({ moduleRegistryService: { getAll: () => [{ id: "files", name: "Files" }, { id: "mail", name: "Mail" }, { id: "users", name: "Users" }, { id: "terminal", name: "Terminal" }] } }));
import { normalizeRolePermissions, getRolePermissionsCatalog, buildEffectivePermissions, canAccessPath, mergeRolePermissions, validateRolePermissions } from "../../../shared/auth/role-permissions.js";
import { rebaseHostingPermissions, projectHostingLimits, hostingPermissionOverrides } from "./hosting-template-policy.js";
import { hostingTemplateInput } from "../models/hosting-template.model.js";
import { actionForHttp, actionForTool, actionRequiresAdmin } from "../../../shared/auth/module-actions.js";
const matrix = (actions: string[], paths = ["/home/account"]) => normalizeRolePermissions({ version: 2, sidebar: ["files"], views: ["panel.files"], actions, fileAccess: { allowPaths: paths, denyPaths: [], readOnlyPaths: [], defaultPath: paths[0] }, commandPolicy: {} });
describe("versioned hosting policy", () => {
  it("retains account reductions and never keeps a removed plan grant", () => {
    const previous = matrix(["files.read", "files.write", "files.delete"]);
    const current = matrix(["files.read", "files.delete"]);
    const next = matrix(["files.read", "files.write", "files.upload"]);
    expect(rebaseHostingPermissions(previous, current, next).actions).toEqual(["files.read", "files.upload"]);
  });
  it("retains an individual denial when a later plan re-adds the permission", () => {
    const base = matrix(["files.read", "files.write"]), own = matrix(["files.read"]);
    const overrides = hostingPermissionOverrides(base, own);
    const intermediate = rebaseHostingPermissions(base, own, matrix(["files.read"]), overrides);
    expect(rebaseHostingPermissions(matrix(["files.read"]), intermediate, base, overrides).actions).toEqual(["files.read"]);
  });
  it("narrows paths when the plan shrinks and clamps the start directory", () => {
    const previous = matrix(["files.read"]);
    const current = matrix(["files.read"], ["/home/account/private"]);
    const next = matrix(["files.read"], ["/home/account/public"]);
    const projected = rebaseHostingPermissions(previous, current, next);
    expect(projected.fileAccess.allowPaths).toEqual([]);
    expect(projected.fileAccess.defaultPath).toBeNull();
  });
  it("preserves individual quota reductions within the current ceiling", () => {
    const ceiling = { diskQuotaMb: 1000, maxDomains: 10, maxEmailAccounts: 20, maxDatabases: 5, maxSubUsers: 10, cpuPercent: 100, memoryMb: 1024, maxProcesses: 128 };
    expect(projectHostingLimits(ceiling, { maxDomains: 3, memoryMb: 4096 })).toMatchObject({ maxDomains: 3, memoryMb: 1024 });
    expect(projectHostingLimits({ ...ceiling, maxDomains: 2 }, { maxDomains: 3 }).maxDomains).toBe(2);
  });
  it("does not combine an action from one group with an unrelated path grant", () => {
    const read = matrix(["files.read"], ["/home/account/public"]);
    const write = matrix(["files.write"], ["/home/account/private"]);
    const user: any = { kind: "user", permissions: mergeRolePermissions([read, write]) };
    expect(canAccessPath(user, "/home/account/private/a", "write", "files.write")).toBe(true);
    expect(canAccessPath(user, "/home/account/public/a", "write", "files.write")).toBe(false);
  });
  it("treats a deliberately empty v2 matrix as deny-all", () => {
    expect(buildEffectivePermissions({ rolePermissions: { version: 2 }, modules: ["files", "mail"], isAdminKind: false }).actions).toEqual([]);
  });
  it("expands legacy wildcards into a finite snapshot", () => {
    const policy = normalizeRolePermissions({ actions: ["files.*"] });
    expect(policy.actions).toContain("files.read");
    expect(policy.actions).not.toContain("files.*");
  });
  it("rejects unknown IDs, relative paths and a default outside the scope", () => {
    expect(() => validateRolePermissions({ actions: ["made-up.root"] })).toThrow();
    expect(() => validateRolePermissions({ fileAccess: { allowPaths: ["relative"] } })).toThrow();
    expect(() => validateRolePermissions({ fileAccess: { allowPaths: ["/home/account"], defaultPath: "/etc" } })).toThrow();
  });
  it("deduplicates shell/module surfaces and exposes actions for every module", () => {
    const catalog = getRolePermissionsCatalog();
    expect(new Set(catalog.modules.map(m => m.module)).size).toBe(catalog.modules.length);
    for (const module of catalog.modules) expect(module.actions.length).toBeGreaterThan(0);
  });
  it("defaults the terminal off and rejects unbounded resource values", () => {
    expect(() => hostingTemplateInput.parse({ name: "Plan", permissions: {}, limits: { cpuPercent: 0 }, security: {} })).toThrow();
  });
});
describe("common HTTP and capability actions", () => {
  it.each([
    ["mail", "POST", "/api/mail/send", "mail.send"],
    ["mail", "PUT", "/api/mail/server-settings", "mail.connect"],
    ["databases", "POST", "/api/databases/query", "databases.query"],
    ["backups", "POST", "/api/backups/restore", "backups.restore"],
    ["expo", "POST", "/api/expo/builds", "expo.build"],
    ["cron", "GET", "/api/cron/jobs", "cron.read"],
    ["dns", "DELETE", "/api/nginx/sites/id", "dns.delete"],
    ["server-switcher", "POST", "/api/servers/connect", "server-switcher.connect"],
  ])("maps %s %s %s", (module, method, url, expected) => expect(actionForHttp(module, method, url)).toBe(expected));
  it("reserves system service installation and root modules", () => {
    for (const id of ["mail.service", "dns.install", "firewall.read", "hosting.templates", "admin.edit"]) expect(actionRequiresAdmin(id)).toBe(true);
    expect(actionRequiresAdmin("mail.send")).toBe(false);
  });
  it("maps legacy module-level capability slugs without granting an entire module", () => {
    expect(actionForTool("mail", "mail.send", "action", "mail")).toBe("mail.send");
    expect(actionForTool("files", "files.write_file", "action", "files.write")).toBe("files.write");
  });
});
