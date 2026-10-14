// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableQuickActionConfig,
  DataTableRowActionConfig,
} from "@/components/ui/DataTable";
import { deleteAction, deleteSelectedAction, editAction } from "./table-actions";
import { type Dict, pick } from "./table-i18n";

// Localized labels live under the `terminal` i18n namespace (`terminal.tables.*`),
// loaded by TerminalPanel via getClientMessages. The builders take that `tables`
// subtree and fall back to Spanish per-key so the snippet category/tag tables
// never render empty before the slice resolves. `ID` stays a literal (universal).
export const TERMINAL_CATEGORY_TABLE_ID = "terminal-categories-table";
export const TERMINAL_TAG_TABLE_ID = "terminal-tags-table";
export const TERMINAL_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50];

// ── Categories table ───────────────────────────────────────────
export function buildCategoryTableColumns(t?: Dict): DataTableColumnConfig[] {
  return [
    { id: "id", header: "ID", accessorKey: "id", sortable: true, hideable: true },
    { id: "name", header: pick(t, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
  ];
}

export function buildCategoryTableFilters(t?: Dict): DataTableFilterConfig[] {
  return [
    { id: "searchCategory", label: pick(t, "searchCategory", "Buscar categoría..."), accessorKey: "name", type: "text" },
  ];
}

export function buildCategoryTableRowActions(t?: Dict): DataTableRowActionConfig[] {
  return [editAction(t), deleteAction(t)];
}

export function buildCategoryTableQuickActions(t?: Dict): DataTableQuickActionConfig[] {
  return [deleteSelectedAction(pick(t, "deleteSelectedCategories", "Eliminar seleccionadas"))];
}

// ── Tags table ─────────────────────────────────────────────────
export function buildTagTableColumns(t?: Dict): DataTableColumnConfig[] {
  return [
    { id: "id", header: "ID", accessorKey: "id", sortable: true, hideable: true },
    { id: "name", header: pick(t, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "categoryName", header: pick(t, "category", "Categoría"), accessorKey: "categoryName", sortable: true, hideable: true },
  ];
}

export function buildTagTableRowActions(t?: Dict): DataTableRowActionConfig[] {
  return [editAction(t), deleteAction(t)];
}

export function buildTagTableQuickActions(t?: Dict): DataTableQuickActionConfig[] {
  return [deleteSelectedAction(pick(t, "deleteSelectedTags", "Eliminar seleccionados"))];
}

export function buildTagTableFilters(
  categories: Array<{ id: number; name: string }>,
  t?: Dict,
): DataTableFilterConfig[] {
  return [
    { id: "searchTag", label: pick(t, "searchTag", "Buscar tag..."), accessorKey: "name", type: "text" },
    {
      id: "filterTagCategory",
      label: pick(t, "category", "Categoría"),
      accessorKey: "categoryName",
      type: "select",
      options: categories.map((cat) => ({ label: cat.name, value: cat.name })),
    },
  ];
}
