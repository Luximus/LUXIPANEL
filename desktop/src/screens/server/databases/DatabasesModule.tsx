/* eslint-disable react-hooks/set-state-in-effect -- carga remota dependiente de la selección */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Database, Play, Plus, RefreshCw, Table2 } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Engine = "mysql" | "postgresql";
type EngineInfo = { type: Engine; label: string; installed: boolean; running: boolean; version?: string | null };
type DatabaseInfo = { name: string; type: Engine; tables?: number | null; sizeBytes?: number | null };
type TableInfo = { name: string; rows?: number | null; sizeBytes?: number | null };
type ColumnInfo = { name: string; dataType: string; nullable: boolean; key?: string | null; isPrimaryKey?: boolean };
type RowsResult = { columns?: string[]; rows?: Array<string[] | Record<string, unknown>>; total?: number; limit?: number; offset?: number };
type QueryResult = { columns?: string[]; rows?: string[][]; rowCount?: number; kind?: string; affectedRows?: number; durationMs?: number; truncated?: boolean };
const q = (params: Record<string, string | number>) => new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();

export function DatabasesModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [engine, setEngine] = useState<Engine>("mysql");
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [database, setDatabase] = useState("");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [table, setTable] = useState("");
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<RowsResult | null>(null);
  const [offset, setOffset] = useState(0);
  const [sql, setSql] = useState("");
  const [allowWrite, setAllowWrite] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadEngines = useCallback(async () => {
    const res = await callServerApi(serverId, "", "GET", "/api/databases/engines");
    const data = unwrap<EngineInfo[]>(res);
    if (Array.isArray(data)) setEngines(data);
    else setError(es ? "No se pudo detectar los motores de base de datos." : "Could not detect database engines.");
  }, [es, serverId]);
  useEffect(() => { void loadEngines(); }, [loadEngines]);
  useEffect(() => {
    let live = true;
    setDatabases([]); setDatabase(""); setTables([]); setTable(""); setRows(null);
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", `/api/databases/list?${q({ engine })}`);
      const data = unwrap<DatabaseInfo[]>(res);
      if (live) { if (Array.isArray(data)) setDatabases(data); else setError(es ? "No se pudo listar las bases de datos." : "Could not list databases."); }
    })();
    return () => { live = false; };
  }, [engine, es, serverId]);
  useEffect(() => {
    if (!database) return;
    let live = true;
    setTables([]); setTable(""); setRows(null);
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", `/api/databases/tables?${q({ engine, database })}`);
      const data = unwrap<TableInfo[]>(res);
      if (live) { if (Array.isArray(data)) setTables(data); else setError(es ? "No se pudo listar las tablas." : "Could not list tables."); }
    })();
    return () => { live = false; };
  }, [database, engine, es, serverId]);
  const loadTable = useCallback(async (nextOffset = 0) => {
    if (!database || !table) return;
    setBusy(true); setError("");
    const common = q({ engine, database, table });
    const [colRes, rowsRes] = await Promise.all([
      callServerApi(serverId, "", "GET", `/api/databases/columns?${common}`),
      callServerApi(serverId, "", "GET", `/api/databases/rows?${common}&limit=50&offset=${nextOffset}`),
    ]);
    const colData = unwrap<ColumnInfo[]>(colRes);
    if (Array.isArray(colData)) setColumns(colData);
    setRows(unwrap<RowsResult>(rowsRes)); setOffset(nextOffset);
    if (!colRes.ok || !rowsRes.ok) setError(es ? "No se pudo leer esta tabla." : "Could not read this table.");
    setBusy(false);
  }, [database, engine, es, serverId, table]);
  useEffect(() => { void loadTable(0); }, [loadTable]);

  const createDatabase = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const res = await callServerApi(serverId, "", "POST", "/api/databases/databases", { engine, name: newName.trim() });
    setBusy(false);
    if (!res.ok) { setError(res.error || (es ? "No se pudo crear la base de datos." : "Could not create database.")); return; }
    setNotice(es ? "Base de datos creada." : "Database created."); setNewName("");
    const list = await callServerApi(serverId, "", "GET", `/api/databases/list?${q({ engine })}`);
    const data = unwrap<DatabaseInfo[]>(list); if (Array.isArray(data)) setDatabases(data);
  };
  const runQuery = async (event: FormEvent) => {
    event.preventDefault();
    if (allowWrite && !window.confirm(es ? "¿Ejecutar SQL con permiso de escritura?" : "Run SQL with write access?")) return;
    setBusy(true); setError(""); setQueryResult(null);
    const res = await callServerApi(serverId, "", "POST", "/api/databases/query", { engine, database: database || undefined, sql, limit: 100, allowWrite });
    const data = unwrap<QueryResult>(res);
    if (data) setQueryResult(data);
    else setError(res.error || (es ? "La consulta falló." : "Query failed."));
    setBusy(false);
  };
  const rowValues = rows?.rows ?? [];
  const rowHeaders = rows?.columns ?? columns.map((column) => column.name);
  return <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-8">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Database size={22} className="text-primary" /><div><h2 className="text-xl font-semibold">{es ? "Bases de datos" : "Databases"}</h2><p className="text-xs opacity-60">MySQL / MariaDB · PostgreSQL</p></div></div><button type="button" className="btn btn-outline btn-sm" onClick={() => { void loadEngines(); void loadTable(offset); }} disabled={busy}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />{es ? "Actualizar" : "Refresh"}</button></div>
    {error ? <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p> : null}{notice ? <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p> : null}
    <div className="flex flex-wrap gap-2">{engines.map((item) => <button key={item.type} type="button" onClick={() => setEngine(item.type)} className={`btn btn-sm ${engine === item.type ? "btn-primary" : "btn-outline"}`}>{item.label}<span className={`badge badge-xs ${item.running ? "badge-success" : "badge-warning"}`}>{item.running ? (es ? "Activo" : "Running") : item.installed ? (es ? "Detenido" : "Stopped") : (es ? "Sin instalar" : "Not installed")}</span></button>)}</div>
    <div className="grid min-h-96 gap-3 lg:grid-cols-[15rem_15rem_minmax(0,1fr)]"><section className="rounded-xl border border-base-300 bg-base-100 p-3"><h3 className="mb-2 text-sm font-semibold">{es ? "Bases de datos" : "Databases"}</h3><div className="max-h-80 space-y-1 overflow-auto">{databases.map((item) => <button type="button" key={item.name} onClick={() => setDatabase(item.name)} className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-sm ${database === item.name ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}>{item.name}</button>)}</div><form className="mt-3 border-t border-base-300 pt-3" onSubmit={(event) => void createDatabase(event)}><label className="text-xs">{es ? "Crear base de datos" : "Create database"}<input className="input input-bordered input-sm mt-1 w-full" required value={newName} onChange={(event) => setNewName(event.target.value)} /></label><button type="submit" className="btn btn-primary btn-xs mt-2" disabled={busy}><Plus size={13} />{es ? "Crear" : "Create"}</button></form></section><section className="rounded-xl border border-base-300 bg-base-100 p-3"><h3 className="mb-2 text-sm font-semibold">{es ? "Tablas" : "Tables"}</h3><div className="max-h-96 space-y-1 overflow-auto">{tables.map((item) => <button type="button" key={item.name} onClick={() => setTable(item.name)} className={`flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-sm ${table === item.name ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}><Table2 size={14} />{item.name}</button>)}</div></section><section className="min-w-0 overflow-hidden rounded-xl border border-base-300 bg-base-100"><div className="border-b border-base-300 px-3 py-2 text-sm font-semibold">{table || (es ? "Selecciona una tabla" : "Select a table")}</div>{table ? <><div className="max-h-80 overflow-auto"><table className="table table-xs"><thead><tr>{rowHeaders.map((head, i) => <th key={`${head}-${i}`} className="whitespace-nowrap">{head}</th>)}</tr></thead><tbody>{rowValues.map((row, i) => <tr key={i}>{rowHeaders.map((head, j) => <td key={`${head}-${j}`} className="max-w-56 truncate font-mono text-[11px]" title={String(Array.isArray(row) ? row[j] ?? "" : row[head] ?? "")}>{String(Array.isArray(row) ? row[j] ?? "" : row[head] ?? "")}</td>)}</tr>)}</tbody></table></div><div className="flex justify-end gap-2 border-t border-base-300 p-2"><button type="button" className="btn btn-outline btn-xs" disabled={busy || offset === 0} onClick={() => void loadTable(Math.max(0, offset - 50))}>←</button><span className="px-2 py-1 font-mono text-xs">{offset + 1}–{offset + rowValues.length}</span><button type="button" className="btn btn-outline btn-xs" disabled={busy || rowValues.length < 50} onClick={() => void loadTable(offset + 50)}>→</button></div></> : null}</section></div>
    <form onSubmit={(event) => void runQuery(event)} className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-2 text-sm font-semibold">Consola SQL</h3><textarea className="textarea textarea-bordered min-h-28 w-full font-mono text-xs" value={sql} onChange={(event) => setSql(event.target.value)} placeholder="SELECT * FROM … LIMIT 100;" required /><div className="mt-2 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" className="checkbox checkbox-sm" checked={allowWrite} onChange={(event) => setAllowWrite(event.target.checked)} />{es ? "Permitir escritura (admin)" : "Allow writes (admin)"}</label><button type="submit" className="btn btn-primary btn-sm" disabled={busy || !sql.trim()}><Play size={14} />{es ? "Ejecutar" : "Run"}</button></div>{queryResult ? <div className="mt-3 overflow-auto rounded-lg border border-base-300"><p className="border-b border-base-300 px-3 py-2 text-xs opacity-70">{queryResult.kind} · {queryResult.rowCount ?? queryResult.affectedRows ?? 0} {es ? "filas" : "rows"} · {queryResult.durationMs ?? 0} ms</p><table className="table table-xs"><thead><tr>{queryResult.columns?.map((head, i) => <th key={`${head}-${i}`}>{head}</th>)}</tr></thead><tbody>{queryResult.rows?.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j} className="font-mono text-xs">{value}</td>)}</tr>)}</tbody></table></div> : null}</form>
  </div>;
}
