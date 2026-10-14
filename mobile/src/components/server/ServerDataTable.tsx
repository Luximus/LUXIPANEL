import { nativeText } from '../../i18n/native-text';
import { TableSettingsContent } from "./TableSettingsContent";
/**
 * ServerDataTable — réplica nativa del DataTable de LUXIPANEL
 * (`frontend/src/components/ui/DataTable.tsx`) para las pantallas de módulos.
 *
 * Misma ESTRUCTURA que el web: toolbar (búsqueda + filtros select + acciones
 * bulk al seleccionar + engranaje "Configurar tabla"), tabla con SCROLL
 * HORIZONTAL y columna de acciones STICKY a la derecha (+ checkbox sticky a la
 * izquierda), header ordenable, celdas con nodos arbitrarios (status-dot / pills
 * los provee la pantalla), paginación, drawer de formularios de columnas, loading skeleton y
 * empty. Estilo = tokens de la app. Driven por props/callbacks (sin el bus DOM).
 *
 * ── RENDIMIENTO (por qué está escrito así) ────────────────────────────────────
 * La tabla ya está PAGINADA (10–100 filas), así que el problema nunca fue el nº
 * de nodos sino cuántas veces se re-renderizan. Reglas que hay que mantener:
 *
 * 1. Los defaults de props (`filters`, `rowActions`, `quickActions`,
 *    `pageSizeOptions`) son constantes de módulo. Si se escriben como literales
 *    (`filters = []`) cambian de identidad en cada render y el `useMemo` de
 *    filtrado deja de memoizar: refiltra y REORDENA todas las filas (miles, en
 *    un directorio o en la lista de procesos) en cada render.
 * 2. Las filas son componentes memoizados con props estables. Nada de declarar
 *    subcomponentes dentro del cuerpo (como estaba `Checkbox`): React los trata
 *    como un tipo nuevo en cada render y DESMONTA Y REMONTA el subárbol entero.
 * 3. La búsqueda va con debounce: sin él, cada tecla refiltraba+reordenaba todo
 *    el dataset y repintaba la tabla.
 *
 * NO virtualizar con `FlatList` aquí: la tabla vive dentro del `ScrollView`
 * vertical de `ServerModuleScreen`, así que una lista virtualizada del mismo eje
 * rompería el scroll y anularía la propia virtualización. La paginación ya acota
 * el nº de filas montadas.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { PanelText as Text } from "../ui/PanelText";
import { TableColumnDialog } from "./TableColumnDialog";
import { TableRowMenu, type TableMenuAnchor } from "./TableRowMenu";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../theme/colors";
import { getMessages, formatMessage } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import { Columns3, ListOrdered } from "lucide-react-native";
import { ModuleSettingsDrawer, SettingsColumns } from "../ui/ModuleSettingsDrawer";
import { useRegisterModuleSettingsPage } from "./module-settings-pages";
import { FormSheet } from "../ui/FormSheet";
import { Select } from "../ui/Select";
import {
  clampPage,
  hiddenColumnIds,
  filterAndSortRows,
  nextSort,
  pageRange,
  pageSlice,
  totalPageCount,
  visibleColumnsOf,
  type ServerColumn,
  type ServerFilter,
  type ServerQuickAction,
  type ServerRowAction,
  type ServerSort,
} from "./server-table-logic";
import { TablerSearch, TablerTool, TablerChevronLeft, TablerChevronRight } from "../../features/app/tabler-icons";
import {
  Checkbox,
  SelectCell,
  HeaderCell,
  DataRow,
  ActionCell,
  RowActionItem,
  ColumnToggle,
  FilterSelect,
  SearchField,
  HEAD_H,
  SELECT_W,
  ACTIONS_W,
  iconBtn,
  headCell,
  pagerBtn,
  noop,
} from "./server-table-cells";

// Los tipos viven en `server-table-logic` (lógica pura testeable) y se
// re-exportan para no tocar los imports de las pantallas.
export type { ServerColumn, ServerFilter, ServerRowAction, ServerQuickAction } from "./server-table-logic";

const SEARCH_DEBOUNCE_MS = 160;

/** Defaults ESTABLES: ver nota (1) de rendimiento arriba. */
const NO_FILTERS: ServerFilter<never>[] = [];
const NO_ROW_ACTIONS: ServerRowAction[] = [];
const NO_QUICK_ACTIONS: ServerQuickAction[] = [];
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];
const EMPTY_VALUES: Record<string, string> = {};

/** Retrasa la propagación de `value` para no refiltrar el dataset en cada tecla. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Identidad ESTABLE para callbacks que las pantallas pasan como arrow inline
 * (`rowKey={(e) => e.path}`, `onRowPress={...}`). Sin esto, cada render de la
 * pantalla cambiaba la identidad de la prop y tiraba abajo la memoización de
 * TODAS las filas. Se late-bindea por ref, así que siempre se llama a la última
 * versión (son accessors puros: el resultado es el mismo).
 */
function useStableFn<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}

export function ServerDataTable<Row>({
  title,
  settingsId,
  settingsIcon,
  settingsBeforeActions,
  settingsBulkActions = false,
  pageSizeOverride,
  onPageSizeUpdate,
  hiddenActionIds,
  onHiddenActionsUpdate,
  columns,
  rows,
  rowKey: rowKeyProp,
  filters = NO_FILTERS as unknown as ServerFilter<Row>[],
  rowActions = NO_ROW_ACTIONS,
  quickActions = NO_QUICK_ACTIONS,
  selectable = false,
  loading = false,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onRowAction,
  onQuickAction,
  onRowPress: onRowPressProp,
  compact = true,
  rowHeight = compact ? 48 : 52,
  headerHeight = compact ? 34 : HEAD_H,
}: {
  title: string;
  settingsId?: string;
  settingsIcon?: React.ReactNode;
  settingsBeforeActions?: React.ReactNode;
  settingsBulkActions?: boolean;
  pageSizeOverride?: number;
  onPageSizeUpdate?: (value:number)=>void;
  hiddenActionIds?: string[];
  onHiddenActionsUpdate?: (ids:string[])=>void;
  columns: ServerColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  filters?: ServerFilter<Row>[];
  rowActions?: ServerRowAction[];
  quickActions?: ServerQuickAction[];
  selectable?: boolean;
  loading?: boolean;
  pageSizeOptions?: number[];
  onRowAction?: (actionId: string, row: Row) => void;
  onQuickAction?: (actionId: string, rows: Row[]) => void;
  /** Tap sobre la fila (zona de datos) — p. ej. navegar a una carpeta. */
  onRowPress?: (row: Row) => void;
  /** Dense web drawer presentation, with details available in table settings. */
  compact?: boolean;
  rowHeight?: number;
  headerHeight?: number;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverTable;

  // Las pantallas pasan estos callbacks como arrows inline; los estabilizamos
  // aquí para no obligarlas a envolver cada uno en `useCallback`.
  const rowKey = useStableFn<[Row], string>(rowKeyProp);
  const onRowPressStable = useStableFn<[Row], void>(onRowPressProp ?? noop);
  const onRowPress = onRowPressProp ? onRowPressStable : undefined;

  const [searchValues, setSearchValues] = useState<Record<string, string>>(EMPTY_VALUES);
  const [selectValues, setSelectValues] = useState<Record<string, string>>(EMPTY_VALUES);
  const [sort, setSort] = useState<ServerSort>(null);
  const [page, setPage] = useState(0);
  const [localPageSize, setPageSize] = useState(pageSizeOptions[0] ?? 10);
  const pageSize = pageSizeOverride ?? localPageSize;
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map(col => [col.id, col]));
    return [...columnOrder.flatMap(id => byId.has(id) ? [byId.get(id)!] : []), ...columns.filter(col => !columnOrder.includes(col.id))];
  }, [columns, columnOrder]);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, boolean>>({});
  const hidden = useMemo(() => hiddenColumnIds(columns, columnOverrides), [columns, columnOverrides]);
  const [localHiddenActions, setHiddenActions] = useState<Set<string>>(() => new Set());
  const hiddenActions = hiddenActionIds ? new Set(hiddenActionIds) : localHiddenActions;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState("columns");
  const [menuRow, setMenuRow] = useState<Row | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<TableMenuAnchor | null>(null);
  const openRowMenu = useCallback((row: Row, anchor: TableMenuAnchor) => { setMenuAnchor(anchor); setMenuRow(row); }, []);
  const [tableWidth, setTableWidth] = useState(0);

  // El TextInput se pinta con `searchValues` (respuesta inmediata al teclear),
  // pero el filtrado usa la versión con debounce.
  const debouncedSearch = useDebouncedValue(searchValues, SEARCH_DEBOUNCE_MS);

  const visibleColumns = useMemo(() => visibleColumnsOf(orderedColumns, hidden), [orderedColumns, hidden]);

  const filtered = useMemo(
    () => filterAndSortRows(rows, columns, filters, debouncedSearch, selectValues, sort),
    [rows, columns, filters, debouncedSearch, selectValues, sort],
  );

  const total = filtered.length;
  const totalPages = totalPageCount(total, pageSize);
  const safePage = clampPage(page, total, pageSize);
  const pageRows = useMemo(() => pageSlice(filtered, page, pageSize), [filtered, page, pageSize]);
  const { from, to } = pageRange(total, page, pageSize);

  // Si al filtrar/borrar filas la página guardada queda fuera de rango, la
  // normalizamos. Antes `page` se quedaba con el valor viejo y los botones de
  // paginación necesitaban varios taps para "volver" al rango visible.
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const toggleSort = useCallback((col: ServerColumn<Row>) => {
    if (!col.sortable || !col.sortValue) return;
    setSort((prev) => nextSort(prev, col.id));
  }, []);

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(rowKey(r)));
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageRows.forEach((r) => next.delete(rowKey(r)));
      else pageRows.forEach((r) => next.add(rowKey(r)));
      return next;
    });
  }, [allOnPage, pageRows, rowKey]);

  // Filas realmente seleccionadas Y visibles: es lo que reciben las quick
  // actions, así que el contador debe contar esto (antes usaba `selected.size`,
  // que seguía contando claves de filas ya borradas o filtradas fuera).
  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(rowKey(r))),
    [filtered, selected, rowKey],
  );
  const selectedCount = selectedRows.length;

  const showSelect = selectable && quickActions.length > 0;
  const visibleActions = rowActions.filter(action => !hiddenActions.has(action.id));
  const showActions = visibleActions.length > 0;
  const selectWidth = SELECT_W;
  const actionsWidth = compact ? 72 : ACTIONS_W;
  const actionsLabel = nativeText("Acciones", undefined, language);
  const displayColumns = useMemo(() => {
    if (!compact || !visibleColumns.length) return visibleColumns;
    const available = tableWidth - 2 - (showSelect ? selectWidth : 0) - (showActions ? actionsWidth : 0);
    const extra = Math.max(0, available - visibleColumns.reduce((sum, col) => sum + (col.width ?? 150), 0));
    return visibleColumns.map((col, index) => index === 0 ? { ...col, width: (col.width ?? 150) + extra } : col);
  }, [compact, visibleColumns, tableWidth, showSelect, showActions, selectWidth, actionsWidth]);

  const cellTextStyle = useMemo(() => ({ color: tokens.textSecondary, fontSize: compact ? 11 : 13 }) as const, [tokens, compact]);

  const onSearchChange = useCallback((id: string, v: string) => {
    setSearchValues((prev) => ({ ...prev, [id]: v }));
    setPage(0);
  }, []);
  const onSelectChange = useCallback((id: string, v: string) => {
    setSelectValues((prev) => ({ ...prev, [id]: v }));
    setPage(0);
  }, []);

  const goPrev = useCallback(() => setPage(Math.max(0, safePage - 1)), [safePage]);
  const goNext = useCallback(() => setPage(Math.min(totalPages - 1, safePage + 1)), [safePage, totalPages]);

  const onPageSizeChange = useCallback((v: string) => {
    setPageSize(Number(v));
    onPageSizeUpdate?.(Number(v));
    setPage(0);
  }, [onPageSizeUpdate]);

  const toggleHidden = useCallback((id: string) => {
    setColumnOverrides(prev => ({ ...prev, [id]: !(prev[id] ?? columns.find(col => col.id === id)?.defaultHidden ?? false) }));
  }, [columns]);

  const moveColumn = (id: string, direction: -1 | 1) => {
    const ids = orderedColumns.map(col => col.id);
    const index = ids.indexOf(id), target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setColumnOrder(ids);
  };

  const runRowAction = useCallback(
    (actionId: string) => {
      const row = menuRow;
      setMenuRow(null);
      if (row) onRowAction?.(actionId, row);
    },
    [menuRow, onRowAction],
  );

  const pageSizeSelectOptions = useMemo(
    () => pageSizeOptions.map((n) => ({ value: String(n), label: String(n) })),
    [pageSizeOptions],
  );

  const lastIdx = pageRows.length - 1;
  const openModuleSettings = useRegisterModuleSettingsPage({key:`table:${settingsId ?? title}`,label:title,icon:settingsIcon ?? <Columns3 size={20} color={tokens.textMuted}/>,content:<TableSettingsContent pageSize={pageSize} pageSizes={pageSizeOptions} onPageSize={value=>onPageSizeChange(String(value))} actions={rowActions} hidden={[...hiddenActions]} onHidden={ids=>{setHiddenActions(new Set(ids));onHiddenActionsUpdate?.(ids);}} beforeActions={settingsBeforeActions} bulk={settingsBulkActions}/>});

  const pagination = (
        <View testID="server-table-pagination"
          style={{
            flexDirection: compact ? "column" : "row",
            flexWrap: "wrap",
            alignItems: compact ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: 8,
            paddingHorizontal: compact ? 0 : 12,
            paddingVertical: compact ? 0 : 10,
            borderTopWidth: compact ? 0 : 1,
            borderTopColor: tokens.border,
          }}
        >
          <Text style={{ color: tokens.textMuted, fontSize: compact ? 10 : 12 }}>
            {compact && selectedCount > 0 ? `${formatMessage(t.selected, { count: selectedCount })}, ` : ""}
            {compact ? nativeText("Mostrando {shown} de {pageSize} resultados; total: {total}", {shown:pageRows.length, pageSize, total}, language) : formatMessage(t.showing, { shown: total === 0 ? 0 : `${from}-${to}`, total })}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: compact ? 6 : 8 }}>
            <Pressable
              disabled={safePage <= 0}
              onPress={goPrev}
              accessibilityRole="button"
              style={[pagerBtn, compact && { borderRadius: 3, paddingHorizontal: 9, paddingVertical: 5 }, { borderColor: tokens.border, opacity: safePage <= 0 ? 0.4 : 1 }]}
            >
              {!compact ? <TablerChevronLeft size={14} color={tokens.textSecondary} /> : null}
              <Text style={{ color: tokens.textSecondary, fontSize: compact ? 10 : 12 }}>{t.prev}</Text>
            </Pressable>
            <Text style={{ color: tokens.textMuted, fontSize: compact ? 10 : 12 }}>
              {formatMessage(t.pageOf, { current: safePage + 1, total: totalPages })}
            </Text>
            <Pressable
              disabled={safePage >= totalPages - 1}
              onPress={goNext}
              accessibilityRole="button"
              style={[pagerBtn, compact && { borderRadius: 3, paddingHorizontal: 9, paddingVertical: 5 }, { borderColor: tokens.border, opacity: safePage >= totalPages - 1 ? 0.4 : 1 }]}
            >
              <Text style={{ color: tokens.textSecondary, fontSize: compact ? 10 : 12 }}>{t.next}</Text>
              {!compact ? <TablerChevronRight size={14} color={tokens.textSecondary} /> : null}
            </Pressable>
          </View>
        </View>
  );

  return (
    <View style={{ gap: compact ? 14 : 10 }}>
      {/* Toolbar */}
      <View testID="server-table-toolbar" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: compact ? 6 : 8 }}>
        {filters.map((f) =>
          f.kind === "search" ? (
            <View
              key={f.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                flexGrow: 1,
                flexShrink: compact ? 1 : 0,
                flexBasis: compact ? 0 : "auto",
                minWidth: compact ? 110 : 160,
                height: compact ? 30 : 38,
                borderRadius: compact ? 4 : 10,
                borderWidth: 1,
                paddingHorizontal: 10,
                backgroundColor: compact ? tokens.bgPrimary : tokens.bgInput,
                borderColor: tokens.border,
              }}
            >
              <TablerSearch size={compact ? 13 : 16} color={tokens.textMuted} />
              <SearchField
                id={f.id}
                placeholder={f.placeholder}
                value={searchValues[f.id] ?? ""}
                onChange={onSearchChange}
                color={tokens.textPrimary}
                placeholderColor={tokens.textMuted}
                compact={compact}
              />
            </View>
          ) : (
            <View key={f.id} style={compact ? { width: Math.min(160, Math.max(62, f.placeholder.length * 5.5 + 42)) } : { minWidth: 150, flexGrow: 1 }}>
              <FilterSelect
                id={f.id}
                value={selectValues[f.id] ?? ""}
                placeholder={f.placeholder}
                allLabel={t.all}
                options={f.options}
                onChange={onSelectChange}
                compact={compact}
              />
            </View>
          ),
        )}
        {/* Bulk quick-actions (al seleccionar) */}
        {selectedCount > 0
          ? quickActions.map((qa) => (
              <Pressable
                key={qa.id}
                accessibilityRole="button"
                accessibilityLabel={qa.label}
                onPress={() => onQuickAction?.(qa.id, selectedRows)}
                style={[iconBtn, compact && { width: 30, height: 30, borderRadius: 4 }, { borderColor: qa.danger ? withAlpha(tokens.danger, 0.5) : tokens.border }]}
              >
                {qa.icon
                  ? React.cloneElement(qa.icon as React.ReactElement<{ color?: string }>, {
                      color: qa.danger ? tokens.danger : tokens.textSecondary,
                    })
                  : null}
              </Pressable>
            ))
          : null}
        {/* Configurar tabla */}
        <Pressable accessibilityRole="button" accessibilityLabel={t.configureTitle} onPress={() => !compact && openModuleSettings ? openModuleSettings() : setSettingsOpen(true)} style={[iconBtn, { borderColor: tokens.border }, compact && { width: 30, height: 30, borderRadius: 4 }]}>
          <TablerTool size={16} color={tokens.textSecondary} />
        </Pressable>
      </View>

      {selectedCount > 0 && !compact ? (
        <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{formatMessage(t.selected, { count: selectedCount })}</Text>
      ) : null}

      {/* Tabla */}
      <View
        testID="server-table-frame"
        onLayout={event => setTableWidth(event.nativeEvent.layout.width)}
        style={{
          borderRadius: compact ? 4 : 12,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.bgCardSolid,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row" }}>
          {/* Columna fija izquierda: selección */}
          {showSelect ? (
            <View style={{ width: selectWidth }}>
              <View style={[headCell, { height: headerHeight, borderBottomColor: tokens.border, backgroundColor: withAlpha(tokens.textMuted, 0.06) }]}>
                <Checkbox on={allOnPage} onPress={toggleSelectAll} tokens={tokens} />
              </View>
              {pageRows.map((r, idx) => {
                const k = rowKey(r);
                return (
                  <SelectCell
                    key={k}
                    rowKey={k}
                    on={selected.has(k)}
                    onToggle={toggleSelect}
                    isLast={idx === lastIdx}
                    tokens={tokens}
                    height={rowHeight}
                  />
                );
              })}
            </View>
          ) : null}

          {/* Columnas de datos (scroll horizontal) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View>
              {/* Header */}
              <View style={{ flexDirection: "row" }}>
                {displayColumns.map((col) => (
                  <HeaderCell key={col.id} col={col} sort={sort} onPress={toggleSort} tokens={tokens} compact={compact} height={headerHeight} />
                ))}
              </View>
              {/* Body */}
              {pageRows.map((r, idx) => (
                <DataRow
                  key={rowKey(r)}
                  row={r}
                  columns={displayColumns}
                  onPress={onRowPress}
                  isLast={idx === lastIdx}
                  tokens={tokens}
                  cellTextStyle={cellTextStyle}
                  compact={compact}
                  height={rowHeight}
                />
              ))}
            </View>
          </ScrollView>

          {/* Columna fija derecha: acciones */}
          {showActions ? (
            <View style={{ width: actionsWidth, borderLeftWidth: compact ? 0 : 1, borderLeftColor: tokens.border }}>
              <View style={[headCell, { height: headerHeight, paddingHorizontal: compact ? 8 : 12, borderBottomColor: tokens.border, backgroundColor: withAlpha(tokens.textMuted, 0.06) }]}>{compact ? <Text numberOfLines={1} style={{color:tokens.textMuted,fontSize:11}}>{actionsLabel}</Text> : null}</View>
              {pageRows.map((r, idx) => (
                <ActionCell key={rowKey(r)} row={r} onPress={setMenuRow} onAnchor={compact ? openRowMenu : undefined} isLast={idx === lastIdx} tokens={tokens} compact={compact} height={rowHeight} label={`${actionsLabel}: ${rowKey(r)}`} />
              ))}
            </View>
          ) : null}
        </View>

        {/* Estado vacío / loading */}
        {loading ? (
          <View style={{ paddingVertical: 28, alignItems: "center" }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ height: 12, width: "80%", borderRadius: 6, backgroundColor: withAlpha(tokens.textMuted, 0.18), marginVertical: 6 }} />
            ))}
          </View>
        ) : pageRows.length === 0 ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{formatMessage(t.empty, { title })}</Text>
          </View>
        ) : null}

        {!compact ? pagination : null}
      </View>

      {compact ? pagination : null}

      {/* Menú de acción de fila */}
      {compact && menuRow && menuAnchor ? <TableRowMenu anchor={menuAnchor} actions={visibleActions} tokens={tokens} language={language} onSelect={runRowAction} onClose={() => setMenuRow(null)} /> : null}
      <FormSheet visible={!!menuRow && (!compact || !menuAnchor)} onClose={() => setMenuRow(null)} language={language}>
        <View style={{ gap: 4 }}>
          {visibleActions.map((a) => (
            <RowActionItem key={a.id} action={a} onPress={runRowAction} tokens={tokens} />
          ))}
        </View>
      </FormSheet>

      {/* Configurar tabla (columnas + page size) */}
      <TableColumnDialog visible={compact && settingsOpen} onClose={() => setSettingsOpen(false)} language={language} columns={orderedColumns} hidden={hidden} onToggle={toggleHidden} onMove={moveColumn} pageSize={pageSize} pageSizes={pageSizeOptions} onPageSize={onPageSizeChange} />
      <ModuleSettingsDrawer visible={!compact && settingsOpen} onClose={() => setSettingsOpen(false)} title={t.configureTitle} language={language}>
        <SettingsColumns language={language} value={settingsSection} onChange={setSettingsSection} sections={[
          { key: "columns", label: t.columns, icon: <Columns3 size={20} color={tokens.textMuted} /> },
          { key: "pagination", label: t.perPage, icon: <ListOrdered size={20} color={tokens.textMuted} /> },
        ]}>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 8 }} keyboardShouldPersistTaps="handled">
            {settingsSection === "columns" ? columns.map((col) => <ColumnToggle key={col.id} col={col} hidden={hidden.has(col.id)} onToggle={toggleHidden} tokens={tokens} />) : <Select value={String(pageSize)} options={pageSizeSelectOptions} onChange={onPageSizeChange} />}
          </ScrollView>
        </SettingsColumns>
      </ModuleSettingsDrawer>
    </View>
  );
}
