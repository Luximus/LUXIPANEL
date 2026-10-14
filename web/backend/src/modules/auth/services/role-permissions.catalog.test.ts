import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../../shared/types/index.js";
import { getRolePermissionsCatalog, normalizeRolePermissions, deriveModulesFromPermissions,
  buildEffectivePermissions, canUseModule, canAccessPath, canExecuteCommand, mergeRolePermissions } from "./role-permissions.service.js";

const catalog = getRolePermissionsCatalog();
const viewModules = catalog.modules.filter((entry) => entry.module !== "admin" && entry.views.length > 0);
function user(modules: string[], permissions: ReturnType<typeof buildEffectivePermissions>): SessionUser {
  return { userId: 1, username: "reader", displayName: "Reader", role: "user", kind: "user", modules, permissions };
}
describe("every assignable module", () => {
  it.each(viewModules)("preserves and derives $module menu/view permissions", (entry) => {
    const raw = { sidebar: entry.sidebar, views: entry.views, actions: entry.actions };
    const normalized = normalizeRolePermissions(raw);
    expect(normalized.sidebar).toEqual(expect.arrayContaining(entry.sidebar));
    expect(normalized.views).toEqual(expect.arrayContaining(entry.views));
    expect(deriveModulesFromPermissions(raw)).toContain(entry.module);
    const effective = buildEffectivePermissions({ rolePermissions: raw, modules: [entry.module], isAdminKind: false });
    expect(canUseModule(user([entry.module], effective), entry.module)).toBe(true);
  });
  it.each(viewModules)("separates $module menu visibility from API access", (entry) => {
    const effective = buildEffectivePermissions({ rolePermissions: { sidebar: entry.sidebar, actions: entry.actions }, modules: [entry.module], isAdminKind: false });
    expect(canUseModule(user([entry.module], { ...effective, views: [] }), entry.module)).toBe(false);
    expect(canUseModule(user([], { ...effective, views: entry.views }), entry.module)).toBe(false);
    expect(canUseModule(user([entry.module], { ...effective, sidebar: [], views: entry.views }), entry.module)).toBe(true);
  });
  it.each(viewModules)("supports legacy module-only grant for $module", (entry) => {
    const effective = buildEffectivePermissions({ rolePermissions: {}, modules: [entry.module], isAdminKind: false });
    expect(effective.views).toEqual(expect.arrayContaining(entry.views));
  });
  it("rejects undeclared grants and never derives admin from file actions", () => {
    expect(normalizeRolePermissions({ sidebar: ["invented"], views: ["panel.invented"], actions: ["invented.*"] }).actions).toEqual([]);
    expect(deriveModulesFromPermissions({ actions: ["files.chmod", "files.chown", "terminal.*"] })).not.toContain("admin");
  });
});

describe("union of real group grants", () => {
  const matrix = (raw: unknown) => buildEffectivePermissions({ rolePermissions: raw, modules: [], isAdminKind: false });
  it("does not let an unrelated mail group erase file exclusions or command denials", () => {
    const files = matrix({ views: ["panel.files"], fileAccess: { allowAll: true, denyPaths: ["/private"] },
      commandPolicy: { allowAll: true, denyCommands: ["rm*"] } });
    const mail = matrix({ views: ["panel.mail"] });
    const current = user(["files", "mail"], mergeRolePermissions([files, mail]));
    expect(canAccessPath(current, "/private/key", "read")).toBe(false);
    expect(canAccessPath(current, "/public/file", "read")).toBe(true);
    expect(canExecuteCommand(current, "ls; rm important")).toBe(false);
  });
  it("grants write only when a contributing group grants that same path", () => {
    const reader = matrix({ views: ["panel.files"], fileAccess: { allowPaths: ["/work"], readOnlyPaths: ["/work"] } });
    const writer = matrix({ views: ["panel.files"], fileAccess: { allowPaths: ["/work/project"] } });
    const current = user(["files"], mergeRolePermissions([reader, writer]));
    expect(canAccessPath(current, "/work/project/a", "write")).toBe(true);
    expect(canAccessPath(current, "/work/other/a", "write")).toBe(false);
    expect(canAccessPath(current, "/work/other/a", "read")).toBe(true);
    const third = matrix({ views: ["panel.mail"] });
    expect(canAccessPath(user(["files"], mergeRolePermissions([current.permissions!, third])), "/work/other/a", "write")).toBe(false);
  });
});
