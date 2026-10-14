// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { BADGE } from "./badges";
import { deleteAction, deleteSelectedAction, editAction } from "./table-actions";
import { type Dict, pick } from "./table-i18n";

// Localized labels live under the `backups` i18n namespace (`backups.table.*`).
// These builders take that subtree and fall back to Spanish so the table never
// renders empty if a key is missing. Filter/badge `value`s and machine codes
// (local/s3/r2) stay verbatim: they must match the data cell values.
type BackupsTableMessages = {
  columns?: Dict;
  storagesColumns?: Dict;
  filters?: Dict;
  rowActions?: Dict;
  quickActions?: Dict;
  storagesRowActions?: Dict;
};

export function buildBackupsTableColumns(t?: BackupsTableMessages): DataTableColumnConfig[] {
  const c = t?.columns;
  return [
    { id: "label", header: pick(c, "label", "Nombre"), accessorKey: "label", sortable: true, hideable: false },
    { id: "status", header: pick(c, "status", "Estado"), accessorKey: "status", sortable: true, hideable: true },
    { id: "size", header: pick(c, "size", "Tamaño"), accessorKey: "size", sortable: true, hideable: true },
    { id: "storage", header: pick(c, "storage", "Destino"), accessorKey: "storage", sortable: true, hideable: true },
    { id: "fecha", header: pick(c, "fecha", "Fecha"), accessorKey: "fecha", sortable: true, hideable: true },
  ];
}

export function buildBackupsTableFilters(t?: BackupsTableMessages): DataTableFilterConfig[] {
  const f = t?.filters;
  return [
    { id: "searchBackupLabel", label: pick(f, "searchBackupLabel", "Buscar copia..."), accessorKey: "label", type: "text" },
    {
      id: "filterBackupStorage",
      label: pick(f, "filterBackupStorage", "Destino"),
      accessorKey: "storage",
      type: "select",
      options: [
        { label: "local", value: "local" },
        { label: "s3", value: "s3" },
        { label: "r2", value: "r2" },
      ],
    },
  ];
}

export function buildBackupsTableRowActions(t?: BackupsTableMessages): DataTableRowActionConfig[] {
  const a = t?.rowActions;
  return [
    { id: "download", label: pick(a, "download", "Descargar"), icon: "ti-download", visibleWhen: { field: "canDownload", equals: true } },
    { ...deleteAction(a), visibleWhen: { field: "canDeleteFile", equals: true } },
    { id: "removeRecord", label: pick(a, "removeRecord", "Quitar del historial"), icon: "ti-history", visibleWhen: { field: "canRemoveHistory", equals: true } },
    { id: "details", label: pick(a, "details", "Ver error"), icon: "ti-alert-circle", visibleWhen: { field: "hasError", equals: true } },
    { id: "refresh", label: pick(a, "refresh", "Actualizar estado"), icon: "ti-refresh", visibleWhen: { field: "statusCode", equals: "running" } },
  ];
}

export function buildBackupsTableQuickActions(t?: BackupsTableMessages) {
  const q = t?.quickActions;
  return [
    deleteSelectedAction(q),
  ];
}

export const BACKUPS_TABLE_VALUE_BADGES: DataTableValueBadgeConfig[] = [
  { value: "local", className: BADGE.neutralPill },
  { value: "s3", className: BADGE.primaryPill },
  { value: "r2", className: BADGE.primaryPill },
];

// ── Cloud storage targets (S3 / R2) ──────────────────────────────────────────
export function buildStoragesTableColumns(t?: BackupsTableMessages): DataTableColumnConfig[] {
  const c = t?.storagesColumns;
  return [
    { id: "name", header: pick(c, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "provider", header: pick(c, "provider", "Proveedor"), accessorKey: "provider", sortable: true, hideable: true },
    { id: "bucket", header: pick(c, "bucket", "Bucket"), accessorKey: "bucket", sortable: true, hideable: true },
    { id: "endpoint", header: pick(c, "endpoint", "Endpoint"), accessorKey: "endpoint", sortable: false, hideable: true },
  ];
}

export function buildStoragesTableFilters(t?: BackupsTableMessages): DataTableFilterConfig[] {
  const f = t?.filters;
  return [
    { id: "searchStorageName", label: pick(f, "searchStorageName", "Buscar nombre..."), accessorKey: "name", type: "text" },
    {
      id: "filterStorageProvider",
      label: pick(f, "filterStorageProvider", "Proveedor"),
      accessorKey: "provider",
      type: "select",
      options: [
        { label: "S3", value: "s3" },
        { label: "R2", value: "r2" },
      ],
    },
  ];
}

export function buildStoragesTableRowActions(t?: BackupsTableMessages): DataTableRowActionConfig[] {
  const a = t?.storagesRowActions;
  return [
    editAction(a),
    deleteAction(a),
  ];
}

export const STORAGES_TABLE_VALUE_BADGES: DataTableValueBadgeConfig[] = [
  {
    value: "s3",
    className: BADGE.warnPill,
  },
  {
    value: "r2",
    className: "inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600",
  },
];
