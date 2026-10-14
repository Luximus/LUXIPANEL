import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { DataTableSettings, type DataTableSettingsAdvanced } from "./DataTableSettings";
import { formatMessage, getMessages } from "../i18n";
import { parseLocaleNumber, normalizeText, normalizeSelectValues } from "./dataTable/helpers";
import { RowActionsMenu, type OpenMenuState } from "./dataTable/RowActionsMenu";
import { Pagination } from "./dataTable/Pagination";
import { Toolbar } from "./dataTable/Toolbar";
import { TableGrid } from "./dataTable/TableGrid";
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableQuickActionConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "./dataTable/types";

// Los tipos de configuración pública viven en `dataTable/types` y se re-exportan
// aquí para no romper a los importadores (`from "./DataTable"`).
export type {
  DataTableColumnSummary,
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
  DataTableQuickActionConfig,
  DataTableValueBadgeConfig,
} from "./dataTable/types";

type SortState<T extends Record<string, unknown>> = {
  accessorKey: keyof T & string;
  direction: "asc" | "desc";
} | null;

type DataTableProps<T extends Record<string, unknown>> = {
  tableId: string;
  title?: string;
  data: T[];
  columns: DataTableColumnConfig<T>[];
  filters?: DataTableFilterConfig<T>[];
  rowActions?: DataTableRowActionConfig<T>[];
  quickActions?: DataTableQuickActionConfig<T>[];
  valueBadges?: DataTableValueBadgeConfig[];
  pageSizeOptions?: number[];
  language?: string;
  onRowAction?: (actionId: string, row: T) => void;
  onSettings?: () => void;
  settingsAdvanced?: DataTableSettingsAdvanced;
  /** Controlled open-state for the settings modal (optional). When provided,
   *  an external trigger (e.g. a floating Config button) can open it; otherwise
   *  the table self-manages it via its inline "Configurar" button. */
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  /** Hide the inline "Configurar" toolbar button (e.g. when a floating Config
   *  FAB drives the settings modal instead). */
  hideSettingsButton?: boolean;
  /** Renderiza los filtros y la barra de acciones (incl. "Configurar") en una
   *  sola fila en vez de dos filas apiladas. Útil en paneles estrechos como el
   *  tab SSH del lateral, donde "Buscar" y "Configurar" deben ir juntos. */
  inlineToolbar?: boolean;
  /** Muestra filas skeleton en el cuerpo mientras se recargan los datos
   *  (p. ej. al pulsar "Actualizar"). El resto del chrome (filtros, columnas,
   *  paginación) se mantiene visible. */
  loading?: boolean;
  /** Estira la tabla para llenar el alto de su contenedor y ancla la paginación
   *  abajo (como la grilla de tarjetas de paneles). Por defecto `false`: flujo
   *  natural (uso en modales). Solo se activa en el panel lateral embebido. */
  fillHeight?: boolean;
};

export default function DataTable<T extends Record<string, unknown>>({
  tableId,
  title,
  data,
  columns,
  filters = [],
  rowActions = [],
  quickActions = [],
  valueBadges = [],
  pageSizeOptions = [10],
  language,
  onRowAction,
  onSettings: _onSettings,
  settingsAdvanced,
  settingsOpen: controlledSettingsOpen,
  onSettingsOpenChange,
  hideSettingsButton = false,
  inlineToolbar = false,
  loading = false,
  fillHeight = false,
}: DataTableProps<T>) {
  void _onSettings;
  const t = getMessages(language);
  const effectiveTitle = title ?? "—";
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [sortState, setSortState] = useState<SortState<T>>(null);
  const effectivePageSizeOptions = pageSizeOptions.length > 0 ? pageSizeOptions : [10];
  const [pageSize, setPageSize] = useState<number>(Math.max(1, effectivePageSizeOptions[0] ?? 10));
  const [pageIndex, setPageIndex] = useState(0);
  const [openMenu, setOpenMenu] = useState<OpenMenuState<T> | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Settings modal: self-managed by default, or controlled by the parent when
  // `settingsOpen`/`onSettingsOpenChange` are provided (e.g. a floating Config FAB).
  const [settingsOpenInternal, setSettingsOpenInternal] = useState(false);
  const settingsControlled = controlledSettingsOpen !== undefined;
  const settingsOpen = settingsControlled ? controlledSettingsOpen : settingsOpenInternal;
  const setSettingsOpen = (open: boolean) => {
    if (settingsControlled) onSettingsOpenChange?.(open);
    else setSettingsOpenInternal(open);
  };

  const visibilityStorageKey = `lps-dt-vis:${tableId}`;
  const orderStorageKey = `lps-dt-order:${tableId}`;
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem(visibilityStorageKey);
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      /* ignore */
    }
    return {};
  });
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(orderStorageKey);
      if (raw) return JSON.parse(raw) as string[];
    } catch {
      /* ignore */
    }
    return columns.map((c) => c.id);
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(visibilityStorageKey, JSON.stringify(columnVisibility));
    } catch {
      /* ignore */
    }
  }, [columnVisibility, visibilityStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(orderStorageKey, JSON.stringify(columnOrder));
    } catch {
      /* ignore */
    }
  }, [columnOrder, orderStorageKey]);

  const orderedVisibleColumns = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    const ordered: typeof columns = [];
    for (const id of columnOrder) {
      const col = byId.get(id);
      if (col) {
        ordered.push(col);
        byId.delete(id);
      }
    }
    for (const remaining of byId.values()) ordered.push(remaining);
    return ordered.filter((c) => columnVisibility[c.id] !== false);
  }, [columns, columnOrder, columnVisibility]);

  const badgeMap = useMemo(() => {
    const map = new Map<string, DataTableValueBadgeConfig>();
    for (const item of valueBadges) {
      map.set(item.value, item);
      map.set(item.value.toLowerCase(), item);
    }
    return map;
  }, [valueBadges]);

  const filterOptions = useMemo(() => {
    const map = new Map<string, Array<{ label: string; value: string }>>();
    for (const filter of filters) {
      if (filter.type !== "select") continue;
      if (filter.options?.length) {
        map.set(filter.id, filter.options);
        continue;
      }

      const values = new Map<string, string>();
      for (const row of data) {
        for (const value of normalizeSelectValues(row[filter.accessorKey])) {
          const normalized = value.toLowerCase();
          if (!values.has(normalized)) values.set(normalized, value);
        }
      }

      map.set(
        filter.id,
        Array.from(values.entries())
          .sort((a, b) => a[1].localeCompare(b[1], "es"))
          .map(([value, label]) => ({ value, label })),
      );
    }
    return map;
  }, [data, filters]);

  const filteredRows = useMemo(() => {
    return data.filter((row) => {
      for (const filter of filters) {
        const filterValue = (filterState[filter.id] ?? "").trim().toLowerCase();
        if (!filterValue) continue;

        if (filter.type === "select") {
          const rowValues = normalizeSelectValues(row[filter.accessorKey]).map((item) => item.toLowerCase());
          if (!rowValues.includes(filterValue)) return false;
          continue;
        }

        const sourceValue = normalizeText(row[filter.accessorKey]);
        if (!sourceValue.includes(filterValue)) return false;
      }
      return true;
    });
  }, [data, filters, filterState]);

  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows;
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const left = String(a[sortState.accessorKey] ?? "");
      const right = String(b[sortState.accessorKey] ?? "");
      const result = left.localeCompare(right, "es", { numeric: true, sensitivity: "base" });
      return sortState.direction === "asc" ? result : -result;
    });
    return rows;
  }, [filteredRows, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedRows = sortedRows.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);

  const selectedRows = useMemo(() => {
    return sortedRows.filter((row) => selectedIds[String(row.id ?? "")]);
  }, [selectedIds, sortedRows]);

  const allPageSelected = pagedRows.length > 0 && pagedRows.every((row) => selectedIds[String(row.id ?? "")]);

  // Totales por columna para la fila fija al pie. Se suma sobre TODO el
  // resultado filtrado (sortedRows), no solo la página visible.
  const columnSummaries = useMemo(() => {
    const result = new Map<string, ReactNode>();
    for (const column of columns) {
      if (!column.summary) continue;
      const getValue = column.summary.value
        ?? ((row: T) => parseLocaleNumber(row[column.accessorKey]));
      let total = 0;
      let counted = false;
      for (const row of sortedRows) {
        const raw = getValue(row);
        if (raw == null || !Number.isFinite(raw)) continue;
        total += raw;
        counted = true;
      }
      if (!counted) continue;
      const format = column.summary.format
        ?? ((value: number) => new Intl.NumberFormat(language || "es-CO").format(value));
      result.set(column.id, format(total));
    }
    return result;
  }, [columns, sortedRows, language]);

  const hasColumnSummaries = orderedVisibleColumns.some((col) => columnSummaries.has(col.id));

  const shownFrom = sortedRows.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const shownTo = sortedRows.length === 0 ? 0 : Math.min(safePageIndex * pageSize + pagedRows.length, sortedRows.length);

  const pageButtons = useMemo(() => {
    if (totalPages <= 1) return [1];
    const current = safePageIndex + 1;
    const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
    return Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  }, [safePageIndex, totalPages]);

  useEffect(() => {
    if (!openMenu) return;

    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      const trigger = event.target as HTMLElement;
      if (trigger.closest(`[data-menu-trigger="${openMenu.rowId}"]`)) return;
      setOpenMenu(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };

    const onViewportChange = () => setOpenMenu(null);

    window.addEventListener("mousedown", onOutsideClick);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);

    return () => {
      window.removeEventListener("mousedown", onOutsideClick);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [openMenu]);

  function toggleSort(column: DataTableColumnConfig<T>) {
    if (column.sortable === false) return;
    setPageIndex(0);
    setSortState((current) => {
      if (!current || current.accessorKey !== column.accessorKey) {
        return { accessorKey: column.accessorKey, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { accessorKey: column.accessorKey, direction: "desc" };
      }
      return null;
    });
  }

  function handleFilterChange(filterId: string, value: string) {
    setFilterState((current) => ({ ...current, [filterId]: value }));
    setPageIndex(0);
  }

  function togglePageSelection(checked: boolean) {
    setSelectedIds((current) => {
      const next = { ...current };
      for (const row of pagedRows) {
        next[String(row.id ?? "")] = checked;
      }
      return next;
    });
  }

  function toggleRowSelection(rowId: string, checked: boolean) {
    setSelectedIds((current) => ({ ...current, [rowId]: checked }));
  }

  function openRowActions(event: ReactMouseEvent<HTMLButtonElement>, row: T, rowId: string, actions: DataTableRowActionConfig<T>[]) {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 224;
    const estimatedHeight = Math.max(140, actions.length * 42 + 16);
    const viewportLeft = Math.max(10, Math.min(window.innerWidth - menuWidth - 10, rect.right - menuWidth));
    const canOpenBelow = window.innerHeight - rect.bottom >= estimatedHeight;
    const viewportTop = canOpenBelow ? rect.bottom + 4 : Math.max(10, rect.top - estimatedHeight - 4);
    const left = viewportLeft + window.scrollX;
    const top = viewportTop + window.scrollY;
    setOpenMenu({ row, rowId, actions, top, left });
  }

  const visibleQuickActions = quickActions.filter(
    (action) => action.requiresSelection !== true || selectedRows.length > 0,
  );

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
      <Toolbar
        filters={filters}
        filterState={filterState}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        inlineToolbar={inlineToolbar}
        visibleQuickActions={visibleQuickActions}
        selectedRows={selectedRows}
        hideSettingsButton={hideSettingsButton}
        onOpenSettings={() => setSettingsOpen(true)}
        configureLabel={t.dataTable.configure}
      />

      <div className="dt-table-shell rounded-2xl border bg-base-100 shadow-xs dark:border-zinc-700 dark:bg-zinc-900/55">
        <div className="dt-table-scroll max-h-[460px] overflow-auto rounded-2xl">
          <TableGrid
            tableId={tableId}
            columns={orderedVisibleColumns}
            rows={pagedRows}
            loading={loading}
            rowActions={rowActions}
            sortState={sortState}
            onToggleSort={toggleSort}
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onTogglePage={togglePageSelection}
            onToggleRow={toggleRowSelection}
            onOpenRowActions={openRowActions}
            badgeMap={badgeMap}
            columnSummaries={columnSummaries}
            hasColumnSummaries={hasColumnSummaries}
            effectiveTitle={effectiveTitle}
            t={t}
          />
        </div>
      </div>

      <div className={`flex flex-col gap-3 border-t border-base-300/70 pt-3 md:flex-row md:items-center md:justify-between ${fillHeight ? "mt-auto" : ""}`}>
        <p className="text-sm text-base-content/70">
          {selectedRows.length > 0
            ? formatMessage(t.dataTable.selectedAndShowing, { selected: selectedRows.length, from: shownFrom, to: shownTo, total: sortedRows.length })
            : formatMessage(t.dataTable.showing, { from: shownFrom, to: shownTo, total: sortedRows.length })}
        </p>

        <Pagination
          safePageIndex={safePageIndex}
          totalPages={totalPages}
          pageButtons={pageButtons}
          setPageIndex={setPageIndex}
          prevAria={t.dataTable.prevPageAria}
          nextAria={t.dataTable.nextPageAria}
        />
      </div>

      {openMenu ? (
        <RowActionsMenu
          menu={openMenu}
          menuRef={menuRef}
          onSelect={(actionId, row) => {
            onRowAction?.(actionId, row);
            setOpenMenu(null);
          }}
        />
      ) : null}

      <DataTableSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tableId={tableId}
        language={language}
        columns={columns.filter((c) => c.hideable !== false).map((c) => ({ id: c.id, header: c.header }))}
        columnVisibility={columnVisibility}
        setColumnVisibility={setColumnVisibility}
        columnOrder={columnOrder}
        setColumnOrder={setColumnOrder}
        pageSize={pageSize}
        pageSizeOptions={effectivePageSizeOptions}
        setPageSize={(next) => {
          setPageSize(next);
          setPageIndex(0);
        }}
        advanced={settingsAdvanced}
      />
    </div>
  );
}
