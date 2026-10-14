// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — mergeRolePermissions (most-permissive group union).
 */

import { describe, it, expect } from "vitest";
import { mergeRolePermissions, type RolePermissionsData } from "./role-permissions.service.js";

function perm(overrides: Partial<RolePermissionsData> = {}): RolePermissionsData {
  return {
    sidebar: [],
    views: [],
    actions: [],
    fileAccess: { allowAll: false, allowPaths: [], denyPaths: [], readOnlyPaths: [] },
    commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] },
    ...overrides,
  };
}

describe("mergeRolePermissions", () => {
  it("empty list → empty permissions", () => {
    const out = mergeRolePermissions([]);
    expect(out.sidebar).toEqual([]);
    expect(out.fileAccess.allowAll).toBe(false);
  });

  it("single entry is returned unchanged", () => {
    const a = perm({ sidebar: ["mail"], actions: ["users.view"] });
    expect(mergeRolePermissions([a])).toBe(a);
  });

  it("unions sidebar/views/actions across groups", () => {
    const a = perm({ sidebar: ["mail"], views: ["panel.mail"], actions: ["users.view"] });
    const b = perm({ sidebar: ["files"], views: ["panel.files"], actions: ["files.read"] });
    const out = mergeRolePermissions([a, b]);
    expect(out.sidebar.sort()).toEqual(["files", "mail"]);
    expect(out.views.sort()).toEqual(["panel.files", "panel.mail"]);
    expect(out.actions.sort()).toEqual(["files.read", "users.view"]);
  });

  it("OR for allowAll flags; union for allow/readonly paths and command groups", () => {
    const a = perm({
      fileAccess: { allowAll: false, allowPaths: ["/home"], denyPaths: [], readOnlyPaths: ["/etc"] },
      commandPolicy: { allowAll: false, groups: ["filesystem"], allowCommands: ["ls"], denyCommands: [] },
    });
    const b = perm({
      fileAccess: { allowAll: true, allowPaths: ["/var"], denyPaths: [], readOnlyPaths: [] },
      commandPolicy: { allowAll: false, groups: ["network"], allowCommands: ["ping"], denyCommands: [] },
    });
    const out = mergeRolePermissions([a, b]);
    expect(out.fileAccess.allowAll).toBe(true);
    expect(out.fileAccess.allowPaths.sort()).toEqual(["/home", "/var"]);
    expect(out.fileAccess.readOnlyPaths).toEqual(["/etc"]);
    expect(out.commandPolicy.groups.sort()).toEqual(["filesystem", "network"]);
    expect(out.commandPolicy.allowCommands.sort()).toEqual(["ls", "ping"]);
  });

  it("INTERSECTS denyPaths/denyCommands — a deny only sticks if ALL groups deny it", () => {
    const a = perm({
      fileAccess: { allowAll: false, allowPaths: [], denyPaths: ["/root", "/secret"], readOnlyPaths: [] },
      commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: ["rm", "dd"] },
    });
    const b = perm({
      fileAccess: { allowAll: false, allowPaths: [], denyPaths: ["/secret"], readOnlyPaths: [] },
      commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: ["rm"] },
    });
    const out = mergeRolePermissions([a, b]);
    // Only the deny present in BOTH groups survives (most-permissive).
    expect(out.fileAccess.denyPaths).toEqual(["/secret"]);
    expect(out.commandPolicy.denyCommands).toEqual(["rm"]);
  });
});
