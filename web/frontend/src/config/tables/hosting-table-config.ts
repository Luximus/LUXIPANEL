// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { BADGE } from "./badges";
import { deleteAction, editAction } from "./table-actions";
import { type Dict, pick } from "./table-i18n";

// Localized labels live under the `hosting` i18n namespace. The existing
// `hosting.table.*` key is used for other strings, so these table builders
// read `hosting.dataTable.*`. They take that namespace subtree and fall back
// to Spanish so the table never renders empty if a key is missing.
// Filter/badge `value`s (machine codes / Spanish data cell values) stay
// verbatim on purpose so they match across all locales.
type HostingTableMessages = {
  dataTable?: {
    columns?: Dict;
    filters?: Dict;
    rowActions?: Dict;
  };
};

// ── Columnas (modelo real HostingAccount) ──────────────────────────
// accessorKey DEBE mapear EXACTO a las props que produce load() en el
// script extraído (index-script1.ts).
export function buildHostingTableColumns(t?: HostingTableMessages): DataTableColumnConfig[] {
  const c = t?.dataTable?.columns;
  return [
    { id: "username", header: pick(c, "username", "Usuario"), accessorKey: "username", sortable: true, hideable: false },
    { id: "plan", header: pick(c, "plan", "Plan"), accessorKey: "plan", sortable: true, hideable: true },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true, hideable: false },
    { id: "modulos", header: pick(c, "modulos", "Módulos"), accessorKey: "modulos", sortable: false, hideable: true },
    { id: "tenantGroup", header: pick(c, "tenantGroup", "Grupo"), accessorKey: "tenantGroup", sortable: true, hideable: true },
    { id: "homeRoot", header: pick(c, "homeRoot", "Home"), accessorKey: "homeRoot", sortable: false, hideable: true },
    { id: "creado", header: pick(c, "creado", "Creado"), accessorKey: "creado", sortable: true, hideable: true },
    { id: "actualizado", header: pick(c, "actualizado", "Actualizado"), accessorKey: "actualizado", sortable: true, hideable: true },
  ];
}

export function buildHostingTableFilters(t?: HostingTableMessages): DataTableFilterConfig[] {
  const f = t?.dataTable?.filters;
  return [
    { id: "searchHostingUser", label: pick(f, "searchUser", "Buscar por usuario…"), accessorKey: "username", type: "text" },
    {
      id: "filterHostingEstado",
      label: pick(f, "estado", "Estado"),
      accessorKey: "estado",
      type: "select",
      options: [
        { label: pick(f, "statusActive", "Activa"), value: "Activa" },
        { label: pick(f, "statusSuspended", "Suspendida"), value: "Suspendida" },
        { label: pick(f, "statusTerminated", "Terminada"), value: "Terminada" },
      ],
    },
    {
      id: "filterHostingPlan",
      label: pick(f, "plan", "Plan"),
      accessorKey: "plan",
      type: "select",
      options: [
        { label: "BASIC", value: "BASIC" },
        { label: "PRO", value: "PRO" },
        { label: "BUSINESS", value: "BUSINESS" },
        { label: "CUSTOM", value: "CUSTOM" },
      ],
    },
  ];
}

export function buildHostingTableRowActions(t?: HostingTableMessages): DataTableRowActionConfig[] {
  const a = t?.dataTable?.rowActions;
  return [
    editAction(a),
    { id: "viewStats", label: pick(a, "viewStats", "Ver uso"), icon: "ti-chart-bar" },
    { id: "viewAudit", label: pick(a, "viewAudit", "Ver auditoría"), icon: "ti-history" },
    { id: "password", label: pick(a, "password", "Cambiar contraseña"), icon: "ti-key" },
    { id: "suspend", label: pick(a, "suspend", "Suspender"), icon: "ti-player-pause" },
    { id: "unsuspend", label: pick(a, "unsuspend", "Reactivar"), icon: "ti-player-play" },
    { id: "enableJail", label: pick(a, "enableJail", "Activar jaula"), icon: "ti-lock" },
    { id: "disableJail", label: pick(a, "disableJail", "Desactivar jaula"), icon: "ti-lock-open" },
    deleteAction(a),
  ];
}

export function buildHostingTableValueBadges(_t?: HostingTableMessages): DataTableValueBadgeConfig[] {
  return [
    {
      value: "Activa",
      className: BADGE.okPill,
    },
    {
      value: "Suspendida",
      className: BADGE.amberPill,
    },
    {
      value: "Terminada",
      className: BADGE.dangerPill,
    },
    {
      value: "BASIC",
      className: "inline-flex items-center rounded-md border border-blue-600/30 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-300",
    },
    {
      value: "PRO",
      className: "inline-flex items-center rounded-md border border-purple-600/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-300",
    },
    {
      value: "BUSINESS",
      className: "inline-flex items-center rounded-md border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-300",
    },
    {
      value: "CUSTOM",
      className: "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground",
    },
  ];
}
