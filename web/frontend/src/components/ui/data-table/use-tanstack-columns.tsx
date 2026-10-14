// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { formatCellValue, IndeterminateCheckbox } from "./cells";
import type {
  DataTableColumnConfig,
  DataTableI18n,
  DataTableProps,
  DataTableQuickActionConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
  RowData,
} from "./types";

type OpenActions = { rowId: string; trigger: HTMLElement; rect: DOMRect; container: HTMLElement } | null;

type Params = {
  columns: DataTableColumnConfig[];
  rowActions: DataTableRowActionConfig[];
  tableId: string;
  openActionsRowId: string | null;
  valueBadgesMap: Map<string, DataTableValueBadgeConfig>;
  renderRowActions: DataTableProps["renderRowActions"];
  renderCell: DataTableProps["renderCell"];
  selectable: boolean;
  resolvedQuickActions: DataTableQuickActionConfig[];
  tt: DataTableI18n;
  setOpenActions: React.Dispatch<React.SetStateAction<OpenActions>>;
};

/**
 * Construye las `ColumnDef` de TanStack a partir de la config de columnas del
 * panel: la columna centinela de selección (sólo si hay acciones masivas), las
 * columnas de datos (con header ordenable + sorting numérico opcional y celda
 * con override `renderCell`) y la columna centinela de acciones (menú ⋯ o
 * `renderRowActions` inline). `useMemo` con dependencias idénticas al original.
 */
export function useTanstackColumns({
  columns,
  rowActions,
  tableId,
  openActionsRowId,
  valueBadgesMap,
  renderRowActions,
  renderCell,
  selectable,
  resolvedQuickActions,
  tt,
  setOpenActions,
}: Params): ColumnDef<RowData>[] {
  return React.useMemo<ColumnDef<RowData>[]>(() => {
    // La selección múltiple sólo sirve para disparar acciones masivas
    // (`quickActions`). Sin ninguna acción masiva, los checkboxes no hacen
    // nada → se omite la columna de selección por completo.
    const showSelection = selectable && resolvedQuickActions.length > 0;
    const defs: ColumnDef<RowData>[] = showSelection
      ? [
          {
            id: "_select",
            header: ({ table }) => (
              <IndeterminateCheckbox
                checked={table.getIsAllPageRowsSelected()}
                indeterminate={table.getIsSomePageRowsSelected()}
                onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                ariaLabel={tt.selectPage}
              />
            ),
            cell: ({ row }) => (
              <IndeterminateCheckbox
                checked={row.getIsSelected()}
                onChange={(checked) => row.toggleSelected(checked)}
                ariaLabel={tt.selectRow}
              />
            ),
            enableSorting: false,
            enableHiding: false,
          },
        ]
      : [];

    for (const column of columns) {
      const sortAccessor = column.sortAccessor;
      const numericSortingFn =
        sortAccessor !== undefined
          ? (rowA: { original: Record<string, unknown> }, rowB: { original: Record<string, unknown> }) => {
              const av = Number(rowA.original?.[sortAccessor]);
              const bv = Number(rowB.original?.[sortAccessor]);
              const an = Number.isFinite(av) ? av : Number.NEGATIVE_INFINITY;
              const bn = Number.isFinite(bv) ? bv : Number.NEGATIVE_INFINITY;
              return an === bn ? 0 : an < bn ? -1 : 1;
            }
          : undefined;
      defs.push({
        id: column.id,
        accessorKey: column.accessorKey,
        enableSorting: column.sortable !== false,
        enableHiding: column.hideable !== false,
        ...(numericSortingFn ? { sortingFn: numericSortingFn } : {}),
        header: ({ column: tableColumn }) => {
          if (column.sortable === false) {
            return <span className="font-medium text-muted-foreground">{column.header}</span>;
          }

          const sorted = tableColumn.getIsSorted();
          const iconClass =
            sorted === "asc"
              ? "ti ti-sort-ascending-2"
              : sorted === "desc"
                ? "ti ti-sort-descending-2"
                : "ti ti-selector";

          return (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => tableColumn.toggleSorting(sorted === "asc")}
            >
              {column.header}
              <i className={`${iconClass} text-xs`} />
            </button>
          );
        },
        cell: ({ row, getValue }) => {
          if (column.actionId && column.actionLabel) {
            const subject = column.actionLabelAccessor ? String(row.original[column.actionLabelAccessor] ?? "") : "";
            const label = subject ? `${column.actionLabel}: ${subject}` : column.actionLabel;
            return (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/5 text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={label}
                aria-label={label}
                onClick={(event) => {
                  event.stopPropagation();
                  window.dispatchEvent(new CustomEvent("lxp:data-table:row-action", {
                    detail: { tableId, actionId: column.actionId, row: row.original },
                  }));
                }}
              >
                <i className={`ti ${column.actionIcon ?? "ti-help"} text-base`} aria-hidden="true" />
              </button>
            );
          }
          const override = renderCell?.[column.id];
          if (override) return <>{override(row.original)}</>;
          return <>{formatCellValue(getValue(), valueBadgesMap, tt)}</>;
        },
      });
    }

    // Sin acciones (ni `renderRowActions` ni `rowActions`) la columna
    // "Acciones" no aporta nada → se omite por completo.
    const hasActions = Boolean(renderRowActions) || rowActions.length > 0;
    if (hasActions) defs.push({
      id: "_actions",
      header: () => <span className="block text-right font-medium text-muted-foreground">{tt.actions}</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        if (renderRowActions) {
          return (
            <div className="flex items-center justify-end gap-1" data-data-table-actions-root="true">
              {renderRowActions(row.original)}
            </div>
          );
        }
        const isOpen = openActionsRowId === row.id;
        return (
          <div className="flex items-center justify-end" data-data-table-actions-root="true">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={tt.actions}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={(event) => {
                event.stopPropagation();
                const trigger = event.currentTarget;
                // Capture the trigger's rect NOW: opening the menu changes
                // `openActionsRowId`, which rebuilds the columns and can detach
                // this button from the DOM → a later getBoundingClientRect() on
                // it returns zeros and the menu is positioned off-screen. The
                // snapshot is the reliable anchor (see RowActionsMenu).
                const rect = trigger.getBoundingClientRect();
                setOpenActions((prev) =>
                  prev?.rowId === row.id ? null : {
                    rowId: row.id,
                    trigger,
                    rect,
                    container: trigger.closest<HTMLDialogElement>("dialog[open]")
                      ?? trigger.closest<HTMLElement>(".lxp-workspace-quick-drawer")
                      ?? document.body,
                  },
                );
              }}
            >
              <i className="ti ti-dots text-base" />
            </button>
          </div>
        );
      },
    });

    return defs;
  }, [columns, rowActions, tableId, openActionsRowId, valueBadgesMap, renderRowActions, renderCell, selectable, resolvedQuickActions, tt]);
}
