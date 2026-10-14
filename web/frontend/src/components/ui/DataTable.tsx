// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import * as React from "react";
import { createPortal } from "react-dom";
import { initialWindow, windowAtPage, pageWindowLabels } from "@/lib/page-window";
import { DATATABLE_EVENTS } from "@/lib/datatable-events";
import {
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { ColumnSettingsDialog } from "./data-table/ColumnSettingsDialog";
import { RowActionsMenu } from "./data-table/RowActionsMenu";
import {
  DATA_TABLE_I18N_ES,
  DEFAULT_PAGE_SIZE_OPTIONS,
  EMPTY_FILTERS,
  EMPTY_ROW_ACTIONS,
  EMPTY_VALUE_BADGES,
} from "./data-table/constants";
import {
  dataColumnIds,
  dtFormat,
  formatColumnTotal,
  normalizeFilterValue,
  rowsEqual,
  withSentinels,
} from "./data-table/helpers";
import {
  type ExtPageState,
  useDataTableWindowEvents,
} from "./data-table/use-data-table-window-events";
import { useTanstackColumns } from "./data-table/use-tanstack-columns";
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableProps,
  DataTableValueBadgeConfig,
  FilterState,
  RowData,
} from "./data-table/types";

// Superficie pública preservada: los consumidores siguen importando estos
// tipos/constantes desde `@/components/ui/DataTable` (re-exportados aquí).
export type {
  DataTableColumnConfig,
  UsageBarCell,
  StatusDotCell,
  DataTableFilterConfig,
  DataTableRowActionConfig,
  DataTableQuickActionConfig,
  DataTableValueBadgeConfig,
  DataTableProps,
  DataTableI18n,
} from "./data-table/types";
export { DEFAULT_PAGE_SIZE_OPTIONS } from "./data-table/constants";

export function DataTable({
  tableId,
  scopedPreferences = false,
  title,
  columns: propColumns,
  data,
  filters: propFilters = EMPTY_FILTERS,
  rowActions = EMPTY_ROW_ACTIONS,
  quickActions,
  valueBadges = EMPTY_VALUE_BADGES,
  pageSizeOptions: propPageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  renderRowActions,
  renderCell,
  selectable = true,
  i18n,
  externalPagination = false,
  serverQuery: propServerQuery = false,
  settingsButtonContainer,
  pageWindowSource,
}: DataTableProps) {
  const tableRoot = React.useRef<HTMLDivElement>(null);
  const emit = (event: Event) => {
    const owner=tableRoot.current?.closest("[data-internal-module]");
    if(owner)Object.defineProperty(event,"__lxpModuleRoot",{value:owner});
    return window.dispatchEvent(event);
  };
  const tt = i18n ?? DATA_TABLE_I18N_ES;
  const pageSizeOptions = React.useMemo(() => propPageSizeOptions, [propPageSizeOptions.join(",")]);
  // Columnas en runtime: por defecto las del prop; un host con columnas
  // dinámicas (p.ej. el visor SQL de databases) las reemplaza vía el evento
  // `lxp:data-table:set-columns`. `null` = usa las del prop (sin cambio).
  const [dynamicColumns, setDynamicColumns] = React.useState<DataTableColumnConfig[] | null>(null);
  const columns = dynamicColumns ?? propColumns;
  // Estado del pie de paginación externa (solo si `externalPagination`).
  const [extPage, setExtPage] = React.useState<ExtPageState | null>(null);
  const serverQuery = propServerQuery || !!extPage?.serverQuery;
  const legacyExternal = externalPagination && !extPage?.window;
  const source = pageWindowSource ?? (extPage?.window ? {
    total: extPage.total ?? 0, version: extPage.version, totals: extPage.totals, hasMore: !!extPage.hasMore, loading: !!extPage.loading, error: extPage.error,
    onLoadMore: () => emit(new CustomEvent(DATATABLE_EVENTS.LOAD_MORE, { detail: { tableId, pageSize: pagination.pageSize } })),
  } : null);
  const [availableWindow, setAvailableWindow] = React.useState(initialWindow(pageSizeOptions[0] ?? 10));
  const requestedWindow = React.useRef("");
  const [rows, setRows] = React.useState<RowData[]>(data);
  const rowsFromFeed = React.useRef(false);
  const onFeedData = React.useCallback(()=>{rowsFromFeed.current=true;},[]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);
  const [filterState, setFilterState] = React.useState<FilterState>({});
  // The filter <input>s stay bound to `filterState` (instant echo on keypress),
  // but the expensive derivations (filteredRows → columnTotals → selectedRows,
  // three full passes over the row set) read this DEFERRED copy. React can then
  // interrupt/coalesce the recompute during fast typing instead of doing it on
  // every keystroke — a debounce without dropping the controlled-input feel.
  const deferredFilterState = React.useDeferredValue(filterState);
  // Filters as state so a page script can push new `options` after mount
  // via `lxp:data-table:set-filter-options`. Pages migrating an SSR fetch
  // to client-side use this to populate dropdowns once the data arrives,
  // letting the page render immediately with an empty filter rather than
  // blocking on the SSR round-trip.
  const [filters, setFilters] = React.useState<DataTableFilterConfig[]>(propFilters);
  React.useEffect(() => { setFilters(propFilters); }, [propFilters]);
  const [showSettings, setShowSettings] = React.useState(false);
  // El modal de "Configure table" usa el `<dialog>` nativo: el backdrop
  // (`::backdrop`) SÓLO se muestra cuando se abre con `showModal()`; el
  // atributo `open` lo pinta en línea sin overlay. Usamos un ref + efecto
  // para invocar `showModal()`/`close()` y mantenemos el estado de React
  // sincronizado con los cierres nativos (Escape, clic en backdrop).
  const settingsDialogRef = React.useRef<HTMLDialogElement | null>(null);
  React.useEffect(() => {
    const dialog = settingsDialogRef.current;
    if (!dialog) return;
    if (showSettings && !dialog.open) {
      dialog.showModal();
    } else if (!showSettings && dialog.open) {
      dialog.close();
    }
  }, [showSettings]);
  React.useEffect(() => {
    const dialog = settingsDialogRef.current;
    if (!dialog) return;
    const onClose = () => setShowSettings(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);
  const [openActions, setOpenActions] = React.useState<{ rowId: string; trigger: HTMLElement; rect: DOMRect; container: HTMLElement } | null>(null);
  const openActionsRowId = openActions?.rowId ?? null;
  // Loading = no data delivered yet. The page's vanilla script fetches the
  // dataset (an /api → backend → SSH round trip) and pushes it via the
  // `lxp:data-table:set-data` event. Until then we show a skeleton instead of
  // flashing "No hay resultados" for the whole remote round trip.
  const [loaded, setLoaded] = React.useState<boolean>(() => data.length > 0);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    // En paginación externa se muestran TODAS las filas recibidas (la página
    // que entrega el servidor); el slicing client-side queda anulado con un
    // pageSize enorme.
    pageSize: externalPagination && !serverQuery ? 1_000_000 : (pageSizeOptions[0] ?? 10),
  });

  // Per-table user prefs (persisted): page size + hidden row actions. Read once
  // from localStorage `lxp:data-table:prefs:<tableId>` and updated live via the
  // `lxp:data-table:apply-prefs` window event. Keeps the DataTable generic; the
  // module's own script bridges any module-specific config to this contract.
  const [hiddenActionIds, setHiddenActionIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (legacyExternal && !serverQuery) return;
    function apply(pageSize?: number, hiddenActions?: string[]) {
      if (typeof pageSize === "number" && pageSize > 0 && pageSizeOptions.includes(pageSize)) {
        setPagination((prev) => (prev.pageSize === pageSize ? prev : { pageIndex: 0, pageSize }));
      }
      if (Array.isArray(hiddenActions)) setHiddenActionIds(hiddenActions.map(String));
    }
    const prefKey = () => {
      if (!scopedPreferences) return `lxp:data-table:prefs:${tableId}`;
      const user = document.getElementById("messenger-link")?.getAttribute("data-me") || "anonymous";
      const target = document.getElementById("sidebar-server-switcher")?.getAttribute("data-current-target-id")
        || window.sessionStorage.getItem("panel-active-target-scope") || "local";
      return `lxp:prefs:${encodeURIComponent(user)}:${encodeURIComponent(target)}:data-table:${tableId}`;
    };
    const readPrefs = () => {
      setHiddenActionIds([]);
      setPagination((prev) => ({ ...prev, pageIndex: 0, pageSize: pageSizeOptions[0] ?? 10 }));
      try {
        const raw = window.localStorage.getItem(prefKey());
      if (raw) {
        const cfg = JSON.parse(raw) as { pageSize?: number; hiddenActions?: string[] };
        apply(cfg.pageSize, cfg.hiddenActions);
      }
      } catch { /* storage unavailable — defaults */ }
    };
    readPrefs();
    // Live updates.
    const onPrefs = (event: Event) => {
      const detail = (event as CustomEvent).detail as { tableId?: string; pageSize?: number; hiddenActions?: string[] } | undefined;
      if (!detail || detail.tableId !== tableId) return;
      apply(detail.pageSize, detail.hiddenActions);
    };
    window.addEventListener("lxp:data-table:apply-prefs", onPrefs as EventListener);
    if (scopedPreferences) window.addEventListener("luxipanel:target-changed", readPrefs);
    return () => {
      window.removeEventListener("lxp:data-table:apply-prefs", onPrefs as EventListener);
      window.removeEventListener("luxipanel:target-changed", readPrefs);
    };
  }, [tableId, pageSizeOptions, externalPagination, serverQuery, scopedPreferences]);

  const effectiveRowActions = React.useMemo(
    () => (hiddenActionIds.length === 0 ? rowActions : rowActions.filter((a) => !hiddenActionIds.includes(a.id))),
    [rowActions, hiddenActionIds],
  );

  const resolvedQuickActions = React.useMemo(() => quickActions ?? [], [quickActions]);
  const valueBadgesMap = React.useMemo(() => {
    const map = new Map<string, DataTableValueBadgeConfig>();
    for (const item of valueBadges) map.set(item.value, item);
    return map;
  }, [valueBadges]);

  React.useEffect(() => {
    if(rowsFromFeed.current && data.length===0)return;
    // Bail si el `data` prop trae el mismo contenido que `rows` por
    // referencia o por (id+campos). Sin esto colisiona con el listener
    // de `lxp:data-table:set-data` y dispara renders extra que invalidan
    // getCoreRowModel y disparan autoResetPageIndex.
    setRows((prev) => (prev === data || rowsEqual(prev, data) ? prev : data));
    // Cualquier dataset no vacío entregado por el prop ya cuenta como cargado
    // (oculta el skeleton aunque el script de la página nunca emita).
    if (data.length > 0) setLoaded(true);
  }, [data]);

  React.useEffect(() => {
    setColumnVisibility((prev) => {
      const next: Record<string, boolean> = { ...prev };
      const availableIds = new Set(columns.map((column) => column.id));

      for (const col of columns) {
        if (next[col.id] === undefined) next[col.id] = true;
      }

      for (const key of Object.keys(next)) {
        if (!availableIds.has(key)) delete next[key];
      }

      return next;
    });

    setColumnOrder((prev) => {
      const existingDataOrder = dataColumnIds(prev).filter((id) => columns.some((col) => col.id === id));
      const missing = columns.map((col) => col.id).filter((id) => !existingDataOrder.includes(id));
      return withSentinels([...existingDataOrder, ...missing]);
    });
  }, [columns]);

  const rowIds = React.useMemo(() => {
    const keys = rows.map(row => String(row.id ?? row._id ?? row.name ?? row.address ?? row.username ?? row.number ?? ""));
    const counts = new Map<string, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    // Generic tables may have repeated names and no primary key (SQL results,
    // logs). Keep those rows distinct instead of selecting their duplicates.
    return new Map(rows.map((row, index) => [row, keys[index] && counts.get(keys[index]!) === 1 ? `key:${keys[index]}` : `index:${index}`]));
  }, [rows]);
  const stableRowId = (row: Record<string, any>, index: number) => rowIds.get(row) ?? `index:${index}`;
  React.useEffect(() => {
    const ids = new Set(rows.map(stableRowId));
    setRowSelection(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => ids.has(id))));
  }, [rows]);
  // Los seis listeners `lxp:data-table:*` (SET_DATA, SET_COLUMNS,
  // SET_PAGINATION, SET_LOADING, SET_FILTER_OPTIONS, READY/REQUEST_READY).
  useDataTableWindowEvents({
    tableId,
    tableRoot,
    onData:onFeedData,
    setLoaded,
    setRows,
    setDynamicColumns,
    setExtPage,
    setFilters,
  });

  React.useEffect(() => {
    if (legacyExternal && !serverQuery) return;
    if (!pageSizeOptions.includes(pagination.pageSize)) {
      setPagination({ pageIndex: 0, pageSize: pageSizeOptions[0] ?? 10 });
    }
  }, [pageSizeOptions, pagination.pageSize, legacyExternal, serverQuery]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-data-table-actions-root='true']")) return;
      if (target?.closest("[data-data-table-actions-menu='true']")) return;
      setOpenActions(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenActions(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const filteredRows = React.useMemo(() => {
    if (serverQuery) return rows;
    return rows.filter((row) => {
      for (const filter of filters) {
        const rawFilter = deferredFilterState[filter.id] ?? "";
        const filterValue = rawFilter.trim().toLowerCase();
        if (!filterValue) continue;

        const sourceValue = normalizeFilterValue(row[filter.accessorKey]);
        if (filter.type === "select") {
          if (sourceValue !== filterValue) return false;
          continue;
        }

        if (!sourceValue.includes(filterValue)) return false;
      }

      return true;
    });
  }, [rows, filters, deferredFilterState, serverQuery]);

  const tanstackColumns = useTanstackColumns({
    columns,
    rowActions: effectiveRowActions,
    tableId,
    openActionsRowId,
    valueBadgesMap,
    renderRowActions,
    renderCell,
    selectable,
    resolvedQuickActions,
    tt,
    setOpenActions,
  });

  const table = useReactTable({
    manualSorting: serverQuery,
    manualPagination: legacyExternal,
    pageCount: legacyExternal ? undefined : Math.max(1, Math.ceil(Math.min(filteredRows.length, availableWindow) / pagination.pageSize)),
    getRowId: stableRowId,
    autoResetPageIndex: false,
    data: filteredRows,
    columns: tanstackColumns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnOrder,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  React.useEffect(() => {
    if (serverQuery || externalPagination) return;
    const last = Math.max(0, Math.ceil(filteredRows.length / pagination.pageSize) - 1);
    if (pagination.pageIndex > last) setPagination(previous => ({...previous, pageIndex: last}));
  }, [filteredRows.length, pagination.pageIndex, pagination.pageSize, serverQuery, externalPagination]);
  const lastServerQuery = React.useRef("");
  React.useEffect(() => {
    if (!serverQuery) return;
    const query = JSON.stringify([deferredFilterState, sorting, pagination.pageSize]);
    if (!lastServerQuery.current) {lastServerQuery.current=query;return;}
    
    if (query === lastServerQuery.current) return;
    const timer = setTimeout(() => {
      lastServerQuery.current = query;
      setRowSelection({});
      emit(new CustomEvent(DATATABLE_EVENTS.QUERY, { detail: { tableId, filters: deferredFilterState, sorting, pageSize: pagination.pageSize, filterDefinitions: filters.map(filter => ({key: filter.accessorKey, type: filter.type, value: deferredFilterState[filter.id] ?? ""})), sortDefinitions: sorting.map(sort => ({key: columns.find(column => column.id === sort.id)?.sortAccessor ?? columns.find(column => column.id === sort.id)?.accessorKey ?? sort.id, desc: sort.desc})) } }));
    }, 250);
    return () => clearTimeout(timer);
  }, [serverQuery, tableId, deferredFilterState, sorting, pagination.pageSize]);

  const selectedRows = React.useMemo(() => table.getSelectedRowModel().rows.map((row) => row.original), [table, rowSelection, filteredRows]);

  // Totales por columna: suma sobre TODAS las filas filtradas (no solo la
  // página visible) para cada columna que declare `total`. La fila se pinta
  // en el <tfoot>, fija al final de la tabla.
  const columnTotals = React.useMemo(() => {
    const totals = new Map<string, string>();
    for (const column of columns) {
      if (!column.total) continue;
      const accessor = column.totalAccessor ?? column.sortAccessor ?? column.accessorKey;
      if (serverQuery) {
        if (source?.totals?.[accessor] !== undefined) totals.set(column.id, formatColumnTotal(source.totals[accessor]!, column.totalFormat));
        continue;
      }
      let sum = 0;
      for (const row of filteredRows) {
        const n = Number(row[accessor]);
        if (Number.isFinite(n)) sum += n;
      }
      totals.set(column.id, formatColumnTotal(sum, column.totalFormat));
    }
    return totals;
  }, [columns, filteredRows, serverQuery, source?.totals]);
  const hasTotals = columnTotals.size > 0;

  // Columnas hoja visibles para el <tfoot> de totales y la columna donde va la
  // etiqueta "Total": la primera columna de datos visible sin total propio (no
  // pisar un número).
  const footerLeafColumns = table.getVisibleLeafColumns();
  const totalLabelColumnId = footerLeafColumns.find(
    (col) => col.id !== "_select" && col.id !== "_actions" && !columnTotals.has(col.id),
  )?.id;

  const filteredCount = source ? source.total : filteredRows.length;
  const totalPages = Math.max(1, table.getPageCount());
  const currentPage = table.getState().pagination.pageIndex + 1;
  React.useEffect(() => {
    setAvailableWindow(initialWindow(pagination.pageSize));
    requestedWindow.current = "";
    setRowSelection({});
    setPagination(previous => previous.pageIndex ? { ...previous, pageIndex: 0 } : previous);
  }, [tableId, pagination.pageSize, deferredFilterState, sorting, source?.version]);
  React.useEffect(() => {
    if (legacyExternal || source?.loading || source?.error) return;
    if(serverQuery && JSON.stringify([deferredFilterState,sorting,pagination.pageSize])!==lastServerQuery.current)return;
    const count = Math.min(filteredRows.length, availableWindow);
    const lastPage = Math.max(0, Math.ceil(count / pagination.pageSize) - 1);
    if (pagination.pageIndex < lastPage) return;
    if (filteredRows.length > availableWindow) {
      setAvailableWindow(previous => windowAtPage(pagination.pageIndex, pagination.pageSize, previous));
    } else if (source?.hasMore) {
      const key = `${tableId}:${filteredRows.length}:${pagination.pageSize}`;
      if (requestedWindow.current === key) return;
      requestedWindow.current = key;
      source.onLoadMore(pagination.pageSize);
    }
  }, [tableId, legacyExternal, filteredRows.length, availableWindow, pagination.pageIndex, pagination.pageSize, source?.hasMore, source?.loading, source?.error]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      table.setPageIndex(totalPages - 1);
    }
  }, [currentPage, totalPages, table]);

  const orderedColumns = React.useMemo(() => {
    const orderedIds = dataColumnIds(columnOrder);
    const fallbackIds = columns.map((col) => col.id).filter((id) => !orderedIds.includes(id));
    const finalIds = [...orderedIds, ...fallbackIds];
    const byId = new Map(columns.map((column) => [column.id, column]));
    return finalIds.map((id) => byId.get(id)).filter((column): column is DataTableColumnConfig => Boolean(column));
  }, [columnOrder, columns]);

  function updateFilter(filterId: string, value: string) {
    setFilterState((prev) => ({ ...prev, [filterId]: value }));
    table.setPageIndex(0);
  }

  function moveColumn(columnId: string, direction: "up" | "down") {
    setColumnOrder((prev) => {
      const dataOrder = dataColumnIds(prev);
      const index = dataOrder.indexOf(columnId);
      if (index < 0) return prev;

      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= dataOrder.length) return prev;

      const next = [...dataOrder];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return withSentinels(next);
    });
  }

  // Drag & drop: reordena la lista entera en una sola actualización moviendo
  // `sourceId` a la posición de `targetId` (mismo shape que los módulos).
  function reorderColumnsById(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setColumnOrder((prev) => {
      const dataOrder = dataColumnIds(prev);
      const srcIdx = dataOrder.indexOf(sourceId);
      const targetIdx = dataOrder.indexOf(targetId);
      if (srcIdx < 0 || targetIdx < 0) return prev;
      const next = [...dataOrder];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(targetIdx, 0, moved);
      return withSentinels(next);
    });
  }

  const settingsButton = <button type="button" data-data-table-configure={tableId}
    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent"
    onClick={() => setShowSettings(true)} title={tt.configure} aria-label={tt.configure}>
    <i className="ti ti-tool text-base" />
  </button>;

  return (
    <div className="space-y-4" ref={tableRoot} data-table-id={tableId} data-loaded-pages={legacyExternal ? undefined : totalPages} data-total-rows={filteredCount} aria-busy={source?.loading || undefined}>
      <div className="flex flex-row flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className={filter.type === "text" ? "min-w-0 flex-1" : "shrink-0"}
            >
              {filter.type === "select" ? (
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={filterState[filter.id] ?? ""}
                  onChange={(event) => updateFilter(filter.id, event.target.value)}
                >
                  <option value="">{filter.label}</option>
                  {(filter.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative w-full">
                  <i className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                  <input
                    className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground"
                    placeholder={filter.label}
                    value={filterState[filter.id] ?? ""}
                    onChange={(event) => updateFilter(filter.id, event.target.value)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {selectedRows.length > 0
            ? resolvedQuickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    action.variant === "danger"
                      ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                      : "border-border hover:bg-accent"
                  }`}
                  title={action.label}
                  aria-label={action.label}
                  onClick={() => {
                    emit(
                      new CustomEvent(DATATABLE_EVENTS.QUICK_ACTION, {
                        detail: { tableId, actionId: action.id, rows: selectedRows },
                      }),
                    );
                  }}
                >
                  <i className={`ti ${action.icon ?? "ti-bolt"} text-base`} />
                </button>
              ))
            : null}

          {settingsButtonContainer ? createPortal(settingsButton, settingsButtonContainer) : settingsButton}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border bg-muted/30">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className={`h-10 px-4 text-left ${header.id === "_actions" ? "sticky right-0 z-20 bg-[color-mix(in_srgb,var(--muted)_30%,var(--card))] text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.18)]" : ""}`}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {!loaded ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`lxp-skeleton-${i}`} className="border-b border-border last:border-0">
                    {table.getVisibleLeafColumns().map((col) => (
                      <td key={col.id} className="px-4 py-3.5">
                        <div className="h-4 w-full max-w-[180px] animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {dtFormat(tt.empty, { title: title ?? tt.defaultTitle })}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="group border-b border-border last:border-0 hover:bg-muted/20">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={`px-4 py-3 ${cell.column.id === "_actions" ? "sticky right-0 z-10 bg-card text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.18)] group-hover:bg-[color-mix(in_srgb,var(--muted)_20%,var(--card))]" : ""}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {loaded && hasTotals && filteredCount > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40">
                  {footerLeafColumns.map((col) => {
                    const isActions = col.id === "_actions";
                    const total = columnTotals.get(col.id);
                    const isLabel = !total && col.id === totalLabelColumnId;
                    return (
                      <td
                        key={col.id}
                        className={`px-4 py-3 ${
                          total ? "font-semibold text-foreground" : "text-muted-foreground"
                        } ${
                          isActions
                            ? "sticky right-0 z-10 bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.18)]"
                            : ""
                        }`}
                      >
                        {total ?? (isLabel ? tt.total : null)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {legacyExternal
            ? (extPage?.info ?? "")
            : selectedRows.length > 0
              ? dtFormat(tt.selectedSummary, { selected: selectedRows.length, shown: Math.min(filteredCount, pagination.pageSize), pageSize: pagination.pageSize, total: filteredCount })
              : dtFormat(tt.summary, { shown: Math.min(filteredCount, pagination.pageSize), pageSize: pagination.pageSize, total: filteredCount })}
        </p>

        <div className="flex items-center gap-2">
          {legacyExternal ? (
            <>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                disabled={!extPage?.canPrev}
                onClick={() => emit(new CustomEvent(DATATABLE_EVENTS.PAGE, { detail: { tableId, dir: "prev" } }))}
              >
                {tt.prev}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                disabled={!extPage?.canNext}
                onClick={() => emit(new CustomEvent(DATATABLE_EVENTS.PAGE, { detail: { tableId, dir: "next" } }))}
              >
                {tt.next}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                {tt.prev}
              </button>
              <span className="text-xs text-muted-foreground">
                {dtFormat(tt.pageOf, { currentPage, totalPages })}
              </span>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                {tt.next}
              </button>
            </>
          )}
        </div>
      </div>

      {source?.error ? <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
        <span>{source.error}</span>
        <button type="button" aria-label={tt.retry ?? pageWindowLabels(typeof document === "undefined" ? "es" : document.documentElement.lang).retry} className="rounded-lg border border-border px-3 py-1.5" onClick={() => { requestedWindow.current = ""; source.onLoadMore(pagination.pageSize); }}><i className="ti ti-refresh" /></button>
      </div> : null}
      {showSettings ? (
        <ColumnSettingsDialog
          ref={settingsDialogRef}
          title={tt.configureTitle}
          columnsAndOrderLabel={tt.columnsAndOrder}
          i18n={tt}
          columns={orderedColumns}
          visibility={columnVisibility}
          pageSize={pagination.pageSize}
          pageSizeOptions={pageSizeOptions}
          resultsPerPageLabel={tt.resultsPerPage}
          showPageSize={!legacyExternal || serverQuery}
          onToggle={(columnId, checked) =>
            setColumnVisibility((prev) => ({ ...prev, [columnId]: checked }))
          }
          onReorder={(sourceId, targetId) => reorderColumnsById(sourceId, targetId)}
          onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
          onClose={() => setShowSettings(false)}
        />
      ) : null}

      {openActions ? (
        <RowActionsMenu
          trigger={openActions.trigger}
          initialRect={openActions.rect}
          container={openActions.container}
          onClose={() => setOpenActions(null)}
          actions={effectiveRowActions.filter((action) => {
            if (!action.visibleWhen) return true;
            const row = table.getRowModel().rows.find((item) => item.id === openActions.rowId)?.original as Record<string, unknown> | undefined;
            return row?.[action.visibleWhen.field] === action.visibleWhen.equals;
          })}
          onSelect={(actionId) => {
            const rowModel = table.getRowModel().rows.find((r) => r.id === openActions.rowId);
            emit(
              new CustomEvent(DATATABLE_EVENTS.ROW_ACTION, {
                detail: { tableId, actionId, row: rowModel?.original ?? null },
              }),
            );
            setOpenActions(null);
          }}
        />
      ) : null}
    </div>
  );
}

export default DataTable;
