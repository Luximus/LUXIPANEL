// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Role-permission facade — re-exports the canonical implementation from
 * the auth module.
 *
 * Modules that need role/permission helpers (canAccessPath, hasActionPermission,
 * etc.) should import from here rather than reaching into auth/services.
 * This keeps a single canonical home while letting consumers stay
 * decoupled from auth's internal file layout.
 */

export {
  normalizeRolePermissions,
  validateRolePermissions,
  deriveModulesFromPermissions,
  canAccessPath,
  hasActionPermission,
  hasViewPermission,
  canUseModule,
  hasSidebarPermission,
  canExecuteCommand,
  getRolePermissionsCatalog,
  buildEffectivePermissions,
  mergeRolePermissions,
  assignableModuleSlugs,
  FILE_ACTION_IDS,
  SIDEBAR_ITEMS,
  type RolePermissionsData,
} from "../../modules/auth/services/role-permissions.service.js";
