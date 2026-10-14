// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import path from "node:path";
import { z } from "zod";
import { buildEffectivePermissions, getRolePermissionsCatalog, normalizeRolePermissions, type RolePermissionsData } from "../../../shared/auth/role-permissions.js";
import { ValidationError } from "../../../shared/errors/index.js";

/** Paths in a provider template are relative to each account's own home. */
const relativePath = z.string().trim().min(1).max(512).refine(
  p => !p.startsWith("/") && !p.includes("\\") && !/[\x00-\x1f\x7f]/.test(p) && !p.split("/").includes(".."),
  "Usa una ruta relativa a la carpeta de la cuenta, sin '..'",
);
const ids = z.array(z.string().min(1).max(128)).max(500);
export const providerGroupTemplateSchema = z.object({
  version: z.literal(2).optional(),
  sidebar: ids, views: ids, actions: ids,
  fileAccess: z.object({
    allowAll: z.literal(false).default(false),
    allowPaths: z.array(relativePath).max(100),
    denyPaths: z.array(relativePath).max(100),
    readOnlyPaths: z.array(relativePath).max(100),
    defaultPath: relativePath.nullable(),
  }).strict(),
  commandPolicy: z.object({
    allowAll: z.boolean(), groups: ids,
    allowCommands: z.array(z.string().trim().min(1).max(1024)).max(100),
    denyCommands: z.array(z.string().trim().min(1).max(1024)).max(100),
  }).strict(),
}).strict();
export type ProviderGroupTemplate = z.infer<typeof providerGroupTemplateSchema>;

export function providerPermissionCatalog() {
  const catalog = getRolePermissionsCatalog();
  const modules = catalog.modules.filter(m => m.module !== "admin");
  return { ...catalog, modules,
    sidebarItems: catalog.sidebarItems.filter(id => id !== "settings"),
    views: catalog.views.filter(id => id !== "panel.settings"),
  };
}

export function normalizeProviderGroupTemplate(raw: unknown, modules: string[]): ProviderGroupTemplate {
  const p = providerGroupTemplateSchema.parse(raw);
  const catalog = providerPermissionCatalog();
  if (modules.includes("admin") || modules.some(m => !catalog.modules.some(entry => entry.module === m))) throw new ValidationError("Módulo no disponible para grupos de hosting");
  const surfaces = catalog.modules.filter(m => modules.includes(m.module));
  const grants = {
    sidebar: new Set(["dashboard", "preferences", ...surfaces.flatMap(m => m.sidebar)]),
    views: new Set(["panel.dashboard", "panel.preferences", ...surfaces.flatMap(m => m.views)]),
    actions: new Set(surfaces.flatMap(m => m.actions)),
  };
  for (const field of ["sidebar", "views", "actions"] as const) {
    if (p[field].some(id => !grants[field].has(id))) throw new ValidationError("El permiso no pertenece a los módulos seleccionados");
    p[field] = [...new Set(p[field])].sort();
  }
  if (p.commandPolicy.groups.some(g => !(catalog.commandGroups as string[]).includes(g))) throw new ValidationError("Grupo de comandos desconocido");
  const normalizePaths = (values: string[]) => [...new Set(values.map(v => path.posix.normalize(v)))];
  for (const field of ["allowPaths", "denyPaths", "readOnlyPaths"] as const) p.fileAccess[field] = normalizePaths(p.fileAccess[field]);
  if (p.fileAccess.defaultPath !== null) {
    p.fileAccess.defaultPath = path.posix.normalize(p.fileAccess.defaultPath);
    const start = p.fileAccess.defaultPath;
    const inside = (base: string) => base === "." || start === base || start.startsWith(base + "/");
    if (!p.fileAccess.allowPaths.some(inside) || p.fileAccess.denyPaths.some(inside)) throw new ValidationError("La carpeta inicial debe estar dentro de las carpetas permitidas");
  }
  return p;
}

/** Legacy providers retain the previous module defaults until edited. */
export function defaultProviderGroupTemplate(modules: string[]): ProviderGroupTemplate {
  const p = buildEffectivePermissions({ rolePermissions: {}, modules: modules.filter(m => m !== "admin"), isAdminKind: false });
  return { ...p, fileAccess: { allowAll: false, allowPaths: ["."], denyPaths: [], readOnlyPaths: [], defaultPath: "." } };
}

export function instantiateProviderGroupTemplate(template: ProviderGroupTemplate, modules: string[], homeRoot: string): RolePermissionsData {
  const p = normalizeProviderGroupTemplate(template, modules);
  if (!/^\/home\/[a-z][a-z0-9_-]{2,31}$/.test(homeRoot)) throw new ValidationError("Carpeta de cuenta inválida");
  const rebase = (relative: string) => path.posix.join(homeRoot, relative);
  return normalizeRolePermissions({ ...p, fileAccess: {
    allowAll: false, allowPaths: p.fileAccess.allowPaths.map(rebase),
    denyPaths: p.fileAccess.denyPaths.map(rebase), readOnlyPaths: p.fileAccess.readOnlyPaths.map(rebase),
    defaultPath: p.fileAccess.defaultPath === null ? null : rebase(p.fileAccess.defaultPath),
  } });
}
