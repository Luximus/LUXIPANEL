// Databases page — database + table navigation (left tree): list databases,
// list tables, select handlers, column metadata fetch, list highlighting.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openPrompt } from "/scripts/extracted/lib/confirm.js";
import { $, esc, fmtBytes, t, showToast } from "./dom";
import { state, type ColumnInfo, type DatabaseInfo, type TableInfo } from "./state";
import { resetView, setTab, updateToolbar } from "./views";

// ── Databases ─────────────────────────────────────────────────────────────────
export async function loadDatabases() {
  const el = $("db-databases");
  if (!el || !state.engine) return;
  el.innerHTML = `<p class="px-3 py-3 text-xs text-muted-foreground">${t("loading.generic", "Cargando…")}</p>`;
  const res = await api.get<DatabaseInfo[]>(`/api/databases/list?engine=${encodeURIComponent(state.engine)}`);
  if (!res.ok) {
    el.innerHTML = `<p class="px-3 py-3 text-xs text-destructive">${esc(res.error ?? t("errors.detectEngines", "Error al detectar motores"))}</p>`;
    return;
  }
  const dbs: DatabaseInfo[] = res.data ?? [];
  if (dbs.length === 0) {
    el.innerHTML = `<p class="px-3 py-3 text-xs text-muted-foreground">${t("empty.noDatabases", "Sin bases de datos.")}</p>`;
    return;
  }
  el.innerHTML = dbs
    .map(
      (d) => `<button data-db="${esc(d.name)}"
        class="db-item flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-accent">
        <span class="flex items-center gap-2 truncate"><i class="ti ti-database text-sm text-muted-foreground"></i><span class="truncate">${esc(d.name)}</span></span>
        <span class="shrink-0 text-[10px] text-muted-foreground">${d.tables != null ? `${d.tables} ${t("labels.tbl", "tbl")}` : ""}</span>
      </button>`,
    )
    .join("");
  el.querySelectorAll<HTMLButtonElement>(".db-item").forEach((btn) => {
    btn.addEventListener("click", () => selectDatabase(btn.dataset.db!));
  });
}

export async function createDatabase() {
  if (!state.engine) { showToast(t("toasts.selectEngineFirst", "Selecciona un motor primero"), false); return; }
  const prefix = $("db-databases")?.getAttribute("data-tenant-prefix") || "";
  const name = await openPrompt(prefix
    ? t("runtime.createPromptWithPrefix", "El nombre debe empezar por {prefix} y respetar tu cupo.").replace("{prefix}", prefix)
    : t("runtime.createPrompt", "Nombre de la nueva base de datos en el servidor activo."),
    { title: t("settings.createDatabase", "Crear base de datos"), placeholder: `${prefix}app`, okText: t("settings.create", "Crear") });
  if (name === null) return;
  const value = name.trim();
  if (!value || (prefix && !value.startsWith(prefix))) { showToast(t("runtime.invalidPrefix", "El nombre debe empezar por {prefix}").replace("{prefix}", prefix), false); return; }
  const res = await api.post("/api/databases/databases", { engine: state.engine, name: value });
  if (!res.ok) { showToast(res.error || t("runtime.createError", "No se pudo crear la base de datos."), false); return; }
  showToast(t("runtime.created", "Base de datos creada."));
  await loadDatabases();
}

async function selectDatabase(name: string) {
  state.database = name;
  state.table = null;
  resetView();
  highlightList("db-databases", "db", name);
  updateToolbar();
  await loadTables();
}

// ── Tables ─────────────────────────────────────────────────────────────────
async function loadTables() {
  const el = $("db-tables");
  if (!el || !state.engine || !state.database) return;
  el.innerHTML = `<p class="px-3 py-3 text-xs text-muted-foreground">${t("loading.generic", "Cargando…")}</p>`;
  const res = await api.get<TableInfo[]>(
    `/api/databases/tables?engine=${encodeURIComponent(state.engine)}&database=${encodeURIComponent(state.database)}`,
  );
  if (!res.ok) {
    el.innerHTML = `<p class="px-3 py-3 text-xs text-destructive">${esc(res.error ?? t("errors.detectEngines", "Error al detectar motores"))}</p>`;
    return;
  }
  const tables: TableInfo[] = res.data ?? [];
  if (tables.length === 0) {
    el.innerHTML = `<p class="px-3 py-3 text-xs text-muted-foreground">${t("empty.noTables", "Sin tablas.")}</p>`;
    return;
  }
  el.innerHTML = tables
    .map(
      (tbl) => `<button data-table="${esc(tbl.name)}"
        class="db-item flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-accent">
        <span class="flex items-center gap-2 truncate"><i class="ti ti-table text-sm text-muted-foreground"></i><span class="truncate">${esc(tbl.name)}</span></span>
        <span class="shrink-0 text-[10px] text-muted-foreground">${tbl.rows != null ? `${tbl.rows}` : ""} · ${fmtBytes(tbl.sizeBytes)}</span>
      </button>`,
    )
    .join("");
  el.querySelectorAll<HTMLButtonElement>(".db-item").forEach((btn) => {
    btn.addEventListener("click", () => void selectTable(btn.dataset.table!));
  });
}

async function selectTable(name: string) {
  state.table = name;
  state.offset = 0;
  state.columns = [];
  state.primaryKey = [];
  highlightList("db-tables", "table", name);
  $("db-breadcrumb")!.textContent = `${state.database} · ${name}`;
  await loadColumnsMeta();
  setTab("rows");
}

/** Fetch the current table's column metadata + primary key (for the editor). */
export async function loadColumnsMeta() {
  if (!state.engine || !state.database || !state.table) return;
  const qs = `engine=${encodeURIComponent(state.engine)}&database=${encodeURIComponent(state.database)}&table=${encodeURIComponent(state.table)}`;
  const res = await api.get<ColumnInfo[]>(`/api/databases/columns?${qs}`);
  state.columns = res.ok ? res.data ?? [] : [];
  state.primaryKey = state.columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
}

function highlightList(containerId: string, attr: string, value: string) {
  document.querySelectorAll<HTMLButtonElement>(`#${containerId} .db-item`).forEach((b) => {
    const active = b.dataset[attr] === value;
    b.classList.toggle("bg-accent", active);
    b.classList.toggle("font-medium", active);
  });
}
