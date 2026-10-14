// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableQuickActionConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { BADGE } from "./badges";
import { deleteAction, deleteSelectedAction, editAction } from "./table-actions";
import { type Dict, pick } from "./table-i18n";

// Localized labels live under the `users` i18n namespace (`users.table.*`).
// These builders take that namespace and fall back to Spanish so the table
// never renders empty if a key is missing. Filter/badge `value`s stay in
// Spanish on purpose: they must match the (Spanish) data cell values.
type UsersTableMessages = {
  // Cell values are rendered from these by the client script; filter values
  // and value badges MUST reuse them so they match across all locales.
  labels?: Dict;
  table?: {
    columns?: Dict;
    roleColumns?: Dict;
    filters?: Dict;
    rowActions?: Dict;
    quickActions?: Dict;
    roleRowActions?: Dict;
    roleQuickActions?: Dict;
  };
};

export function buildUserTableColumns(t?: UsersTableMessages): DataTableColumnConfig[] {
  const c = t?.table?.columns;
  return [
    { id: "username", header: pick(c, "username", "Usuario"), accessorKey: "username", sortable: true, hideable: true },
    { id: "displayName", header: pick(c, "displayName", "Nombre visible"), accessorKey: "displayName", sortable: true, hideable: true },
    { id: "status", header: pick(c, "status", "Estado"), accessorKey: "statusCell", sortable: false, hideable: true },
    { id: "connections", header: pick(c, "connections", "Conexiones"), accessorKey: "connections", sortable: true, hideable: true },
    { id: "uidGid", header: pick(c, "uidGid", "UID/GID"), accessorKey: "uidGid", sortable: true, hideable: true },
    { id: "homeDir", header: pick(c, "homeDir", "Home"), accessorKey: "homeDir", sortable: true, hideable: true },
    { id: "groupsLabel", header: pick(c, "groups", "Grupos"), accessorKey: "groupsLabel", sortable: false, hideable: true },
    { id: "modulesLabel", header: pick(c, "modules", "Módulos"), accessorKey: "modulesLabel", sortable: false, hideable: true },
    { id: "linuxPasswordState", header: pick(c, "linuxPasswordState", "Estado contraseña Linux"), accessorKey: "linuxPasswordState", sortable: true, hideable: true },
    { id: "lastLogin", header: pick(c, "lastLogin", "Último acceso"), accessorKey: "lastLoginLabel", sortable: true, sortAccessor: "lastLoginTs", hideable: true },
    { id: "createdAt", header: pick(c, "createdAt", "Creado"), accessorKey: "createdAtLabel", sortable: true, sortAccessor: "createdAtTs", hideable: true },
    { id: "updatedAt", header: pick(c, "updatedAt", "Actualizado"), accessorKey: "updatedAtLabel", sortable: true, sortAccessor: "updatedAtTs", hideable: true },
  ];
}

export function buildUserTableFilters(t?: UsersTableMessages): DataTableFilterConfig[] {
  const f = t?.table?.filters;
  const l = t?.labels;
  const available = pick(l, "statusAvailable", "Disponible");
  const blocked = pick(l, "statusLocked", "Bloqueado");
  return [
    { id: "searchUser", label: pick(f, "searchUser", "Buscar usuario..."), accessorKey: "username", type: "text" },
    {
      id: "filterLinuxState",
      label: pick(f, "linuxState", "Estado contraseña"),
      accessorKey: "linuxPasswordState",
      type: "select",
      options: [
        { label: available, value: available },
        { label: blocked, value: blocked },
      ],
    },
  ];
}

export function buildUserTableRowActions(t?: UsersTableMessages): DataTableRowActionConfig[] {
  const a = t?.table?.rowActions;
  return [
    editAction(a),
    { id: "ssh-keys", label: pick(a, "sshKeys", "Llaves SSH"), icon: "ti-terminal-2" },
    { id: "gen-key", label: pick(a, "genKey", "Generar llave de acceso"), icon: "ti-key" },
    { id: "change-password", label: pick(a, "changePassword", "Cambiar contraseña"), icon: "ti-lock-password" },
    { id: "review-activity", label: pick(a, "reviewActivity", "Revisar actividad"), icon: "ti-activity" },
    { id: "toggle-block", label: pick(a, "toggleBlock", "Bloquear / desbloquear"), icon: "ti-lock" },
    deleteAction(a),
  ];
}

export function buildUserTableQuickActions(t?: UsersTableMessages): DataTableQuickActionConfig[] {
  const q = t?.table?.quickActions;
  return [
    deleteSelectedAction(q),
    { id: "disable", label: pick(q, "disableKey", "Bloquear clave"), icon: "ti-lock" },
    { id: "enable", label: pick(q, "enableKey", "Habilitar clave"), icon: "ti-lock-open" },
  ];
}

export function buildUserTableValueBadges(t?: UsersTableMessages): DataTableValueBadgeConfig[] {
  const l = t?.labels;
  return [
    { value: pick(l, "statusAvailable", "Disponible"), className: BADGE.okPill },
    { value: pick(l, "statusLocked", "Bloqueado"), className: BADGE.dangerPill },
  ];
}

export function buildRoleTableColumns(t?: UsersTableMessages): DataTableColumnConfig[] {
  const c = t?.table?.roleColumns;
  return [
    { id: "name", header: pick(c, "name", "Grupo"), accessorKey: "name", sortable: true, hideable: true },
    { id: "kindLabel", header: pick(c, "kind", "Tipo"), accessorKey: "kindLabel", sortable: true, hideable: true },
    { id: "membersLabel", header: pick(c, "members", "Miembros"), accessorKey: "membersLabel", sortable: true, hideable: true },
    { id: "modulesLabel", header: pick(c, "modules", "Módulos"), accessorKey: "modulesLabel", sortable: false, hideable: true },
    { id: "description", header: pick(c, "description", "Descripción"), accessorKey: "description", sortable: true, hideable: true },
  ];
}

export function buildRoleTableFilters(t?: UsersTableMessages): DataTableFilterConfig[] {
  const f = t?.table?.filters;
  const l = t?.labels;
  const user = pick(l, "kindUser", "Usuario");
  const system = pick(l, "kindSystem", "Sistema");
  return [
    { id: "searchRole", label: pick(f, "searchRole", "Buscar grupo..."), accessorKey: "name", type: "text" },
    {
      id: "filterGroupKind",
      label: pick(f, "groupKind", "Tipo"),
      accessorKey: "kindLabel",
      type: "select",
      options: [
        { label: user, value: user },
        { label: system, value: system },
      ],
    },
  ];
}

export function buildRoleTableRowActions(t?: UsersTableMessages): DataTableRowActionConfig[] {
  const a = t?.table?.roleRowActions;
  return [
    editAction(pick(a, "editPermissions", "Editar permisos")),
    deleteAction(a),
  ];
}

export function buildRoleTableQuickActions(t?: UsersTableMessages): DataTableQuickActionConfig[] {
  const q = t?.table?.roleQuickActions;
  return [
    deleteSelectedAction(q),
  ];
}

export function buildRoleTableValueBadges(t?: UsersTableMessages): DataTableValueBadgeConfig[] {
  const l = t?.labels;
  return [
    {
      value: pick(l, "kindSystem", "Sistema"),
      className: BADGE.amberPill,
    },
    {
      value: pick(l, "kindUser", "Usuario"),
      className: BADGE.skyPill,
    },
  ];
}
