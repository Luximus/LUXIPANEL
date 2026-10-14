// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableRowActionConfig,
} from "@/components/ui/DataTable";
import { deleteAction, editAction } from "./table-actions";
import { pick, type TableMessages } from "./table-i18n";

// Visor SQL (databases). Tres tablas DataTable:
//  · db-rows-table     → filas SQL: columnas DINÁMICAS (las empuja el script con
//                        `lxp:data-table:set-columns`) + paginación EXTERNA
//                        (server-side) + acciones por fila editar/eliminar.
//  · db-structure-table → estructura: columnas FIJAS (definidas aquí).
//  · db-console-table   → resultado de consola: columnas DINÁMICAS, sin acciones.
//
// Etiquetas del namespace i18n `databases` (`labels.*`, `actions.*`,
// `confirm.*`); fallback español vía `pick()`.

export type DatabasesTableMessages = TableMessages<"labels" | "actions" | "confirm">;

// Columnas fijas de la pestaña Estructura.
export function buildDbStructureColumns(t?: DatabasesTableMessages): DataTableColumnConfig[] {
  const l = t?.labels;
  return [
    { id: "name", header: pick(l, "colName", "Columna"), accessorKey: "name", sortable: true, hideable: false },
    { id: "type", header: pick(l, "colType", "Tipo"), accessorKey: "type", sortable: true, hideable: true },
    { id: "nullable", header: pick(l, "colNullable", "Nulo"), accessorKey: "nullable", sortable: true, hideable: true },
    { id: "key", header: pick(l, "colKey", "Clave"), accessorKey: "key", sortable: true, hideable: true },
    { id: "default", header: pick(l, "colDefault", "Por defecto"), accessorKey: "default", sortable: false, hideable: true },
  ];
}

// Acciones por fila de la tabla de filas (gateadas en el script: solo si la
// tabla SQL tiene clave primaria).
export function buildDbRowsRowActions(t?: DatabasesTableMessages): DataTableRowActionConfig[] {
  const a = t?.actions;
  const c = t?.confirm;
  return [
    editAction(a),
    deleteAction(pick(c, "deleteTitle", "Eliminar registro")),
  ];
}
