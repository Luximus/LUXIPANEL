import { type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { formatMessage, type Messages } from "../../i18n";
import { SortIcon, KebabIcon } from "./icons";
import { renderCellValue } from "./helpers";
import type { DataTableColumnConfig, DataTableRowActionConfig, DataTableValueBadgeConfig } from "./types";

type SortState<T extends Record<string, unknown>> = {
  accessorKey: keyof T & string;
  direction: "asc" | "desc";
} | null;

/**
 * Cabecera + cuerpo + fila de totales de la tabla. Componente presentacional:
 * recibe las columnas y filas ya derivadas (ordenadas/paginadas/filtradas) y los
 * callbacks del controlador; no calcula estado propio. El scroll/borde exterior
 * los pone el contenedor (`DataTable`).
 */
export function TableGrid<T extends Record<string, unknown>>({
  tableId,
  columns,
  rows,
  loading,
  rowActions,
  sortState,
  onToggleSort,
  selectedIds,
  allPageSelected,
  onTogglePage,
  onToggleRow,
  onOpenRowActions,
  badgeMap,
  columnSummaries,
  hasColumnSummaries,
  effectiveTitle,
  t,
}: {
  tableId: string;
  columns: DataTableColumnConfig<T>[];
  rows: T[];
  loading: boolean;
  rowActions: DataTableRowActionConfig<T>[];
  sortState: SortState<T>;
  onToggleSort: (column: DataTableColumnConfig<T>) => void;
  selectedIds: Record<string, boolean>;
  allPageSelected: boolean;
  onTogglePage: (checked: boolean) => void;
  onToggleRow: (rowId: string, checked: boolean) => void;
  onOpenRowActions: (event: ReactMouseEvent<HTMLButtonElement>, row: T, rowId: string, actions: DataTableRowActionConfig<T>[]) => void;
  badgeMap: Map<string, DataTableValueBadgeConfig>;
  columnSummaries: Map<string, ReactNode>;
  hasColumnSummaries: boolean;
  effectiveTitle: string;
  t: Messages;
}) {
  return (
    <table id={tableId} className="table table-pin-rows text-sm dt-table">
      <thead>
        <tr>
          <th className="sticky start-0 top-0 z-20 w-10 dt-header-cell">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={allPageSelected}
              onChange={(event) => onTogglePage(event.target.checked)}
              aria-label={t.dataTable.selectPageAria}
            />
          </th>
          {columns.map((column) => {
            const isSorted = sortState?.accessorKey === column.accessorKey ? sortState.direction : null;
            return (
              <th key={column.id} className="sticky top-0 z-10 dt-header-cell text-xs font-semibold tracking-wide">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 ${column.sortable === false ? "cursor-default" : "cursor-pointer"}`}
                  onClick={() => onToggleSort(column)}
                >
                  {column.header}
                  {column.sortable === false ? null : <SortIcon direction={isSorted} />}
                </button>
              </th>
            );
          })}
          {rowActions.length > 0 ? <th className="sticky top-0 z-10 dt-header-cell text-end">{t.dataTable.actions}</th> : null}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <tr key={`dt-skeleton-${idx}`} className={idx % 2 === 0 ? "dt-row-even" : "dt-row-odd"}>
              <td className={`sticky start-0 z-[1] dt-sticky-cell ${idx % 2 === 0 ? "dt-row-even" : "dt-row-odd"}`}>
                <div className="skeleton h-4 w-4 rounded-sm"></div>
              </td>
              {columns.map((column) => (
                <td key={column.id}><div className="skeleton h-4 w-full max-w-[180px]"></div></td>
              ))}
              {rowActions.length > 0 ? (
                <td className="text-end"><div className="skeleton ms-auto h-7 w-8 rounded-md"></div></td>
              ) : null}
            </tr>
          ))
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length + 2} className="text-center text-base-content/70">
              {formatMessage(t.dataTable.noResultsFor, { title: effectiveTitle })}
            </td>
          </tr>
        ) : (
          rows.map((row, rowIndex) => {
            const rowId = String(row.id ?? "");
            const visibleActions = rowActions.filter((action) => (action.visible ? action.visible(row) : true));
            const rowToneClass = rowIndex % 2 === 0 ? "dt-row-even" : "dt-row-odd";
            return (
              <tr key={rowId} className={rowToneClass}>
                <td className={`sticky start-0 z-[1] dt-sticky-cell ${rowToneClass}`}>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={Boolean(selectedIds[rowId])}
                    onChange={(event) => onToggleRow(rowId, event.target.checked)}
                    aria-label={t.dataTable.selectRowAria}
                  />
                </td>
                {columns.map((column) => (
                  <td key={column.id} className="text-sm">{column.cell ? column.cell(row) : renderCellValue(row[column.accessorKey], badgeMap, t.dataTable.noTags)}</td>
                ))}
                {rowActions.length > 0 ? (
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-circle btn-ghost"
                      data-menu-trigger={rowId}
                      onClick={(event) => onOpenRowActions(event, row, rowId, visibleActions)}
                    >
                      <KebabIcon />
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })
        )}
      </tbody>
      {hasColumnSummaries && !loading && rows.length > 0 ? (
        <tfoot>
          <tr className="dt-totals-row">
            <td className="sticky start-0 bottom-0 z-[11] dt-foot-cell" />
            {columns.map((column, index) => {
              const summary = columnSummaries.get(column.id);
              if (summary != null) {
                return (
                  <td key={column.id} className="sticky bottom-0 z-10 dt-foot-cell text-end text-sm font-semibold tabular-nums">
                    {summary}
                  </td>
                );
              }
              return (
                <td key={column.id} className="sticky bottom-0 z-10 dt-foot-cell text-xs font-semibold uppercase tracking-wide opacity-70">
                  {index === 0 ? t.dataTable.total : null}
                </td>
              );
            })}
            {rowActions.length > 0 ? <td className="sticky bottom-0 z-10 dt-foot-cell" /> : null}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
