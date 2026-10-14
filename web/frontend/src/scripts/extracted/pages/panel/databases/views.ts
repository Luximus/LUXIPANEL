// Databases page — toolbar visibility, tab switching, and the Rows / Structure
// views (feed the DataTables via table-bridge).
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { highlightPillTabs, tabDirectionOf } from "/scripts/extracted/lib/tabs.js";
import { animateViewEnter } from "/scripts/extracted/lib/dom.js";
import { $, fmt, showToast, t } from "./dom";
import { DB_ROWS_TABLE_ID, DB_STRUCT_TABLE_ID, state, dbCache, type ColumnInfo, type QueryResult, type Tab } from "./state";
import { dynColumns, dynRows, publishDb, setDbLoading } from "./table-bridge";
import { loadColumnsMeta } from "./navigation";

// ── Toolbar (export / add-record visibility) ─────────────────────────────────
export function updateToolbar() {
  const exportBtn = $("db-export-btn");
  const addBtn = $("db-add-record");
  const hasDb = !!state.database;
  const canAdd = !!state.table && state.tab === "rows" && state.columns.length > 0;
  if (exportBtn) {
    exportBtn.classList.toggle("hidden", !hasDb);
    exportBtn.classList.toggle("inline-flex", hasDb);
  }
  if (addBtn) {
    addBtn.classList.toggle("hidden", !canAdd);
    addBtn.classList.toggle("inline-flex", canAdd);
  }
}

// ── Tabs (E-03: estilo "pill" compartido en /scripts/extracted/lib/tabs.js) ──
export function highlightTabs() {
  highlightPillTabs(".db-tab", (b) => b.dataset.tab === state.tab);
}

export function setTab(tab: Tab) {
  if (tab === "console" && !document.querySelector('.db-tab[data-tab="console"]')) return;
  const prevTab = state.tab;
  state.tab = tab;
  highlightTabs();
  const consoleEl = $("db-console")!;
  const noTable = !state.table;
  const rowsWrap = $("db-rows-wrap");
  const structWrap = $("db-structure-wrap");
  const emptyEl = $("db-empty");
  const panes = [consoleEl, rowsWrap, structWrap, emptyEl];
  const hiddenBefore = new Set(panes.filter((p) => p?.classList.contains("hidden")));

  consoleEl.classList.toggle("hidden", tab !== "console");
  consoleEl.classList.toggle("flex", tab === "console");
  // Rows / Structure need a selected table; otherwise show the empty placeholder.
  rowsWrap?.classList.toggle("hidden", tab !== "rows" || noTable);
  structWrap?.classList.toggle("hidden", tab !== "structure" || noTable);
  emptyEl?.classList.toggle("hidden", tab === "console" || !noTable);
  // Entrada animada del panel que pasa a visible (preset motion.css).
  const direction = tabDirectionOf(
    document.querySelectorAll<HTMLButtonElement>(".db-tab"),
    (b) => b.dataset.tab === prevTab,
    (b) => b.dataset.tab === tab,
  );
  for (const pane of panes) {
    if (pane && hiddenBefore.has(pane) && !pane.classList.contains("hidden")) animateViewEnter(pane, direction);
  }
  updateToolbar();

  if (tab === "console") return;
  if (noTable) return;
  if (tab === "rows") void loadRows();
  else void loadStructure();
}

export function resetView() {
  $("db-empty")?.classList.remove("hidden");
  $("db-rows-wrap")?.classList.add("hidden");
  $("db-structure-wrap")?.classList.add("hidden");
  const bc = $("db-breadcrumb");
  if (bc) bc.textContent = state.database ? `${state.database}` : t("common.selectTable", "Selecciona una tabla.");
  updateToolbar();
}

// ── Rows ─────────────────────────────────────────────────────────────────────
let rowsGeneration = 0;
let rowsLoading = false, rowsWindowVersion=0, rowsWindowContext="";
export async function loadRows(append = false) {
  const nextContext=`${resolveTargetScope()}:${state.engine}:${state.database}:${state.table}`;
  if(append && rowsWindowContext!==nextContext) append=false;
  if (!state.engine || !state.database || !state.table || (append && rowsLoading)) return;
  const generation = ++rowsGeneration;
  const context = nextContext;
  rowsWindowContext=context;
  const current = () => generation === rowsGeneration && context === `${resolveTargetScope()}:${state.engine}:${state.database}:${state.table}`;
  rowsLoading = true;
  const previous = append ? [...state.rows] : [];
  let offset = append ? previous.length : 0;
  if (!append) setDbLoading(DB_ROWS_TABLE_ID, true);
  const pending = { window: true, version:append ? rowsWindowVersion : ++rowsWindowVersion, total: previous.length, hasMore: true, loading: true, error: null, canPrev: false, canNext: false, info: "" };
  window.dispatchEvent(new CustomEvent("lxp:data-table:set-pagination", { detail: { tableId: DB_ROWS_TABLE_ID, ...pending } }));
  let hasMore = false, total = previous.length;
  try {
    for (let page = 0; page < 2; page++) {
      const params = new URLSearchParams({engine: state.engine, database: state.database, table: state.table, limit: String(state.limit), offset: String(offset)});
      const sort = state.rowSorting[0];
      if (sort) {
        const name = state.rowColumns[Number(sort.id.replace(/^c/, ""))];
        if (name) { params.set("sortBy", name); params.set("sortDir", sort.desc ? "desc" : "asc"); }
      }
      const res = await api.get<QueryResult>(`/api/databases/rows?${params}`);
      if (!current()) return;
      if (!res.ok || !res.data) throw new Error(res.error ?? t("errors.loadRows", "Error al cargar filas"));
      previous.push(...res.data.rows);
      offset += res.data.rows.length;
      state.rowColumns = res.data.columns;
      total = res.data.total ?? previous.length;
      hasMore = res.data.total !== undefined ? previous.length < res.data.total : res.data.rows.length >= state.limit;
      if (!hasMore) break;
    }
    state.rows = previous;
    state.offset = 0;
    publishDb(DB_ROWS_TABLE_ID, dynColumns(state.rowColumns), dynRows(state.rowColumns, previous),
      { window: true, version:rowsWindowVersion, total, hasMore, loading: false, error: null, canPrev: false, canNext: hasMore, info: "" });
    updateToolbar();
  } catch (error) {
    if (!current()) return;
    const message = error instanceof Error ? error.message : t("errors.loadRows", "Error al cargar filas");
    showToast(message, false);
    setDbLoading(DB_ROWS_TABLE_ID, false);
    const pagination = { ...pending, loading: false, error: message };
    window.dispatchEvent(new CustomEvent("lxp:data-table:set-pagination", { detail: { tableId: DB_ROWS_TABLE_ID, ...pagination } }));
    if (dbCache[DB_ROWS_TABLE_ID]) dbCache[DB_ROWS_TABLE_ID]!.pagination = pagination;
  } finally { if (current()) rowsLoading = false; }
}

// ── Structure ─────────────────────────────────────────────────────────────────
export async function loadStructure() {
  if (!state.engine || !state.database || !state.table) return;
  setDbLoading(DB_STRUCT_TABLE_ID, true);
  // Reuse the cached column metadata when available; otherwise fetch it.
  if (state.columns.length === 0) await loadColumnsMeta();
  const cols: ColumnInfo[] = state.columns;
  const rows = cols.map((c, idx) => ({
    id: idx,
    // Columnas FIJAS (accessorKey espejo de buildDbStructureColumns).
    name: c.key === "PRI" ? `🔑 ${c.name}` : c.name,
    type: c.dataType,
    nullable: c.nullable ? t("labels.yes", "YES") : t("labels.no", "NO"),
    key: c.key ?? "",
    default: c.default == null ? "—" : c.default,
  }));
  // columns = null → la tabla conserva sus columnas fijas del prop.
  publishDb(DB_STRUCT_TABLE_ID, null, rows);
}
