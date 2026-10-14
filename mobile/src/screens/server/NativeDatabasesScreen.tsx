import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { RelatedModuleSettings } from "../../components/server/RelatedModuleSettings";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { NativeRecordEditor } from "./NativeRecordEditor";
import React, { useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { callServerApi, unwrap } from "../../api/serverApi";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { ModuleSplitLayout } from "../../components/server/ModuleLayouts";
import { FormSheet } from "../../components/ui/FormSheet";
import { Select } from "../../components/ui/Select";
import { Columns3, TerminalSquare } from "lucide-react-native";
import { loadSessionState } from "../../lib/session-state";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { Checkbox, ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Engine = "mysql" | "postgresql";
type EngineInfo = { type: Engine; label: string; installed: boolean; running: boolean; version: string | null };
type DatabaseInfo = { name: string; tables?: number | null; sizeBytes?: number | null };
type TableInfo = { name: string; rows: number | null; sizeBytes: number | null };
type ColumnInfo = { name: string; dataType: string; nullable: boolean; isPrimaryKey?: boolean };
type QueryResult = { columns: string[]; rows: string[][]; rowCount: number; kind: "read" | "write"; affectedRows?: number | null; durationMs: number; truncated?: boolean };
const emptyList = Promise.resolve({ ok: true, data: { ok: true, data: [] } });

/** Engine, schema and row browser with a native SQL console. */
export function NativeDatabasesScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const [view, setView] = useState("rows");
  const [createOpen, setCreateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [allowWrite, setAllowWrite] = useState(false);
  const language = loadSessionState().language;
  const [engine, setEngine] = useState<Engine>("mysql");
  const [database, setDatabase] = useState<string | null>(null);
  const [table, setTable] = useState<string | null>(null);
  const [pageSize,setPageSize] = useState("50");
  const [offset, setOffset] = useState(0);
  const [sql, setSql] = useState("");
  const [newDatabase, setNewDatabase] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<{ original: string[] | null; values: Record<string, string | null> } | null>(null);
  const [deleteRow, setDeleteRow] = useState<string[] | null>(null);
  const [installConfirm, setInstallConfirm] = useState(false);
  const [includeExportData, setIncludeExportData] = useState(true);
  const [confirmWrite, setConfirmWrite] = useState(false);
  const engines = useServerResource<EngineInfo[]>(() => callServerApi(panelId, token, "GET", "/api/databases/engines"), [panelId, token]);
  const databases = useServerResource<DatabaseInfo[]>(() => callServerApi(panelId, token, "GET", `/api/databases/list?engine=${engine}`), [panelId, token, engine]);
  const tables = useServerResource<TableInfo[]>(() => database ? callServerApi(panelId, token, "GET", `/api/databases/tables?engine=${engine}&database=${encodeURIComponent(database)}`) : emptyList, [panelId, token, engine, database]);
  const columns = useServerResource<ColumnInfo[]>(() => database && table ? callServerApi(panelId, token, "GET", `/api/databases/columns?engine=${engine}&database=${encodeURIComponent(database)}&table=${encodeURIComponent(table)}`) : emptyList, [panelId, token, engine, database, table]);
  const rows = useServerResource<QueryResult>(() => database && table ? callServerApi(panelId, token, "GET", `/api/databases/rows?engine=${engine}&database=${encodeURIComponent(database)}&table=${encodeURIComponent(table)}&limit=${pageSize}&offset=${offset}`) : Promise.resolve({ ok: true, data: { ok: true, data: null } }), [panelId, token, engine, database, table, offset, pageSize]);
  useEffect(() => {
    const info = engines.data;
    if (!Array.isArray(info) || info.length === 0) return;
    if (!info.some((entry) => entry.type === engine && entry.running)) {
      const first = info.find((entry) => entry.running);
      if (first) setEngine(first.type);
    }
  }, [engines.data, engine]);
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 8 } as const;
  const reload = async () => { await Promise.all([engines.reload(), databases.reload(), tables.reload(), columns.reload(), rows.reload()]); };
  const createDatabase = async () => {
    const name = newDatabase.trim();
    if (!/^[A-Za-z0-9_$][A-Za-z0-9_$. -]{0,127}$/.test(name)) { setError(nativeText("Nombre de base de datos inválido.")); return; }
    if (pending.current) return;
    pending.current = true;
    try {
    setBusy(true); setError(null);
    const outcome = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/databases/databases", { engine, name }));
    if (!outcome.ok) { setError(outcome.error ?? nativeText("No se pudo crear la base de datos.")); return; }
    setNewDatabase(""); setCreateOpen(false);
    await databases.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); }
    finally { pending.current = false; setBusy(false); }
  };
  const runQuery = async (allowWrite: boolean) => {
    if (!sql.trim()) return;
    if (pending.current) return;
    pending.current = true;
    try {
    setBusy(true); setError(null); setResult(null);
    const response = await callServerApi(panelId, token, "POST", "/api/databases/query", { engine, ...(database ? { database } : {}), sql: sql.trim(), limit: Number(pageSize), allowWrite });
    if (!response.ok) { setError(response.error ?? nativeText("No se pudo ejecutar la consulta.")); return; }
    setConfirmWrite(false);
    setResult(unwrap<QueryResult>(response) ?? null);
    if (allowWrite) await Promise.all([databases.reload(), tables.reload(), columns.reload(), rows.reload()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); }
    finally { pending.current = false; setBusy(false); }
  };
  const info = Array.isArray(engines.data) ? engines.data : [];
  const dbList = Array.isArray(databases.data) ? databases.data : [];
  const tableList = Array.isArray(tables.data) ? tables.data : [];
  const columnList = Array.isArray(columns.data) ? columns.data : [];
  const currentRows = rows.data;
  const primaryKeys = columnList.filter(column => column.isPrimaryKey).map(column => column.name);
  const identify = (row: string[]) => Object.fromEntries(primaryKeys.map(key => [key, row[currentRows?.columns.indexOf(key) ?? -1] ?? null]));
  const saveRecord = async (values: Record<string, string | null>) => {
    if (!record || !database || !table || busy) return;
    if (pending.current) return;
    pending.current = true;
    try {
    setBusy(true); setError(null);
    const response = await runServerMutation(panelId, token, () => callServerApi(panelId, token, record.original ? "PATCH" : "POST", "/api/databases/records", { engine, database, table, values, ...(record.original ? { where: identify(record.original) } : {}) }));
    if (!response.ok) { setError(response.error ?? nativeText("No se pudo guardar el registro.")); return; }
    setRecord(null); await rows.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); }
    finally { pending.current = false; setBusy(false); }
  };
  const removeRecord = async () => {
    if (!deleteRow || !primaryKeys.length || busy) return;
    if (pending.current) return;
    pending.current = true;
    try {
    setBusy(true); setError(null);
    const response = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "DELETE", "/api/databases/records", { engine, database, table, where: identify(deleteRow) }));
    if (!response.ok) setError(response.error ?? nativeText("No se pudo eliminar el registro.")); else { setDeleteRow(null); await rows.reload(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); }
    finally { pending.current = false; setBusy(false); }
  };
  const installEngine = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
    setBusy(true); setError(null);
    const response = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/databases/install", { engine: engine === "mysql" ? "mariadb" : "postgresql" }));
    if (!response.ok) setError(response.error ?? nativeText("No se pudo instalar el motor.")); else { setInstallConfirm(false); await reload(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); }
    finally { pending.current = false; setBusy(false); }
  };
  const exportDatabase = async () => {
    if (!database || !FileSystem.cacheDirectory) return;
    setBusy(true); setError(null);
    try {
      const response = await callServerApi<string>(panelId, token, "POST", "/api/databases/export", { engine, database, tables: table ? [table] : [], includeData: includeExportData });
      if (!response.ok || typeof response.data !== "string") throw new Error(response.error ?? nativeText("No se pudo exportar la base de datos."));
      const uri = `${FileSystem.cacheDirectory}${database.replace(/[^A-Za-z0-9_.-]/g, "_")}.sql`;
      await FileSystem.writeAsStringAsync(uri, response.data);
      if (!await Sharing.isAvailableAsync()) throw new Error(nativeText("No se puede compartir el archivo en este dispositivo."));
      await Sharing.shareAsync(uri, { mimeType: "application/sql" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("Error de exportación.")); }
    finally { setBusy(false); }
  };
  const showRows = (data: QueryResult | null) => data ? <View style={{ gap: 12 }}>
    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{data.rowCount} {nativeText("filas ·")}{" "}{data.durationMs} ms{data.truncated ? nativeText(" · resultado limitado") : ""}{data.affectedRows != null ? nativeText(" · {p0} afectadas", {p0: String(data.affectedRows)}) : ""}</Text>
    <ServerDataTable title={data === currentRows ? nativeText("Filas") : nativeText("Resultado SQL")} rows={(data.rows ?? []).map((values, index) => ({ values, index }))} rowKey={row => String(row.index)} pageSizeOptions={[Number(pageSize)]} pageSizeOverride={Number(pageSize)}
      columns={(data.columns ?? []).map((name, index) => ({ id: `${index}:${name}`, header: name, width: 160, cell: (row: { values: string[] }) => <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>{row.values[index] ?? "NULL"}</Text> }))}
      rowActions={data === currentRows && primaryKeys.length ? [{ id: "edit", get label() { return nativeText("Editar"); } }, { id: "delete", get label() { return nativeText("Eliminar"); }, danger: true }] : []}
      onRowAction={(action, row) => { if (busy) return; if (action === "edit") setRecord({ original: row.values, values: Object.fromEntries(data.columns.map((key, index) => [key, row.values[index] ?? null])) }); else setDeleteRow(row.values); }} />
  </View> : null;
  return <ServerModuleScreen title={nativeText("Bases de datos")} subtitle={table ? `${database} / ${table}` : database ?? "MySQL · PostgreSQL"} onBack={onBack}
    tabs={[{ key: "rows", get label() { return nativeText("Filas"); } }, { key: "structure", get label() { return nativeText("Estructura"); } }, { key: "console", get label() { return nativeText("Consola SQL"); } }]} activeTab={view} onTabChange={setView}
    settingsPages={[{key:"table",get label() { return nativeText("Tabla"); },content:<View style={{gap:20}}><Field label={nativeText("Filas por página")}><Select value={pageSize} onChange={v=>{setPageSize(v);setOffset(0);}} options={[25,50,100,200].map(n=>({value:String(n),label:String(n)}))}/></Field><RelatedModuleSettings modules={["hosting","backups","files"]}/></View>},{ key: "console", get label() { return nativeText("Consola"); }, icon: <TerminalSquare size={20} color={colors.textMuted} />, content: <View style={{ gap: 12 }}><Text style={{ color: colors.textSecondary }}>{nativeText("Permisos de la consola SQL")}</Text><Checkbox value={allowWrite} onChange={setAllowWrite} label={nativeText("Permitir consultas de escritura")} /></View> }]}
    error={error ?? engines.error ?? databases.error ?? tables.error ?? columns.error ?? rows.error} guardCode={engines.guardCode ?? databases.guardCode ?? tables.guardCode ?? columns.guardCode ?? rows.guardCode} onRetry={() => void reload()} onRefresh={() => void reload()} refreshing={engines.loading || databases.loading || tables.loading || rows.loading}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <View style={{ minWidth: 180, flex: 1 }}><Select value={engine} options={[{ value: "mysql", label: "MySQL / MariaDB" }, { value: "postgresql", label: nativeText("PostgreSQL") }]} onChange={value => { setEngine(value as Engine); setDatabase(null); setTable(null); setOffset(0); setResult(null); }} /></View>
      <Text style={{ color: colors.textMuted }}>{info.find(item => item.type === engine)?.running ? nativeText("En ejecución") : info.find(item => item.type === engine)?.installed ? nativeText("Detenido") : nativeText("No instalado")} · {info.find(item => item.type === engine)?.version ?? "—"}</Text>
      {!info.find(item => item.type === engine)?.installed ? <Button label={nativeText("Instalar motor")} disabled={busy || engines.loading} onPress={() => setInstallConfirm(true)} /> : null}
    </View>
    <ModuleSplitLayout sidebar={<>
      <View style={cardStyle}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{nativeText("Bases de datos")}</Text><Button label={nativeText("Crear")} size="sm" variant="secondary" onPress={() => setCreateOpen(true)} /></View>
        <ScrollView style={{ maxHeight: 256 }} nestedScrollEnabled>{dbList.map(item => <Pressable key={item.name} accessibilityRole="button" accessibilityState={{ selected: item.name === database }} onPress={() => { setDatabase(item.name); setTable(null); setOffset(0); }} style={{ padding: 12, backgroundColor: item.name === database ? colors.brandDim : "transparent" }}><Text style={{ color: colors.textPrimary }}>{item.name}</Text></Pressable>)}{!dbList.length && !databases.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("No hay bases de datos visibles.")}</Text> : null}</ScrollView>
      </View>
      <View style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{nativeText("Tablas")}</Text><ScrollView style={{ maxHeight: 352 }} nestedScrollEnabled>{tableList.map(item => <Pressable key={item.name} accessibilityRole="button" accessibilityState={{ selected: item.name === table }} onPress={() => { setTable(item.name); setOffset(0); setView("rows"); }} style={{ padding: 12, backgroundColor: item.name === table ? colors.brandDim : "transparent" }}><Text style={{ color: colors.textPrimary }}>{item.name}</Text><Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.rows ?? "—"} {nativeText("filas")}</Text></Pressable>)}{!database ? <Text style={{ color: colors.textMuted }}>{nativeText("Selecciona una base de datos.")}</Text> : null}</ScrollView></View>
    </>}>
      <View style={cardStyle}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Text style={{ color: colors.textSecondary, flex: 1 }}>{table ? `${database} / ${table}` : database ?? nativeText("Selecciona una tabla")}</Text>{database ? <Button label={nativeText("Exportar")} size="sm" variant="secondary" onPress={() => setExportOpen(true)} /> : null}{view === "rows" && table ? <Button label={nativeText("Insertar registro")} size="sm" disabled={busy || !columnList.length} onPress={() => setRecord({ original: null, values: {} })} /> : null}</View>
        {view !== "console" && !table ? <Text style={{ color: colors.textMuted, paddingVertical: 36, textAlign: "center" }}>{nativeText("Selecciona una tabla para explorar su contenido.")}</Text> : null}
        {view === "rows" && table ? <>{showRows(currentRows)}<View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Button label={nativeText("Anterior")} variant="ghost" onPress={() => setOffset(Math.max(0, offset - Number(pageSize)))} disabled={offset === 0 || rows.loading} /><Button label={nativeText("Siguiente")} variant="ghost" onPress={() => setOffset(offset + Number(pageSize))} disabled={rows.loading || !currentRows?.truncated} /></View></> : null}
        {view === "structure" && table ? <ServerDataTable title={nativeText("Estructura")} rows={columnList} rowKey={column => column.name} columns={[
          { id: "name", get header() { return nativeText("Columna"); }, cell: column => <Text style={{ color: colors.textPrimary }}>{column.name}</Text> },
          { id: "type", get header() { return nativeText("Tipo"); }, cell: column => <Text style={{ color: colors.textSecondary }}>{column.dataType}</Text> },
          { id: "null", header: "NULL", cell: column => <Text style={{ color: colors.textSecondary }}>{column.nullable ? nativeText("Sí") : nativeText("No")}</Text> },
          { id: "key", get header() { return nativeText("Clave"); }, cell: column => <Text style={{ color: colors.textSecondary }}>{column.isPrimaryKey ? "PK" : "—"}</Text> },
        ]} /> : null}
        {view === "console" ? <><TextInput value={sql} onChangeText={setSql} multiline autoCapitalize="none" autoCorrect={false} placeholder="SELECT …" placeholderTextColor={colors.textMuted} style={[inputStyle, { minHeight: 180, textAlignVertical: "top", paddingVertical: 10, fontFamily: "monospace" }]} /><Checkbox value={allowWrite} onChange={setAllowWrite} label={nativeText("Permitir escritura")} /><Button label={nativeText("Ejecutar consulta")} onPress={() => allowWrite ? setConfirmWrite(true) : void runQuery(false)} disabled={busy || !sql.trim()} />{showRows(result)}</> : null}
      </View>
    </ModuleSplitLayout>
    <FormDrawer visible={createOpen} onClose={() => { if (!pending.current) setCreateOpen(false); }} title={nativeText("Crear base de datos")} language={language}><View style={{ gap: 12 }}><Field label={nativeText("Nombre")}><TextInput value={newDatabase} onChangeText={setNewDatabase} autoCapitalize="none" style={inputStyle} /></Field><Button label={nativeText("Crear")} onPress={() => void createDatabase()} disabled={busy || !newDatabase.trim()} />{error ? <Text style={{ color: colors.danger }}>{localizeServerError(error)}</Text> : null}</View></FormDrawer>
    <FormSheet visible={exportOpen} onClose={() => setExportOpen(false)} title={nativeText("Exportar {p0}", {p0: String(table ?? database ?? "")})} language={language}><View style={{ gap: 12 }}><Checkbox value={includeExportData} onChange={setIncludeExportData} label={nativeText("Incluir datos")} /><Button label={nativeText("Descargar SQL")} onPress={() => void exportDatabase()} disabled={busy} /></View></FormSheet>
    {record ? <NativeRecordEditor columns={columnList} initial={record.values} busy={busy} error={error} onClose={() => { if (!pending.current) setRecord(null); }} onSave={values => void saveRecord(values)} /> : null}
    <ConfirmDialog visible={deleteRow !== null} title={nativeText("Eliminar registro")} message={nativeText("Se eliminará la fila seleccionada mediante su clave primaria.")} confirmLabel={nativeText("Eliminar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => setDeleteRow(null)} onConfirm={() => void removeRecord()} />
    <ConfirmDialog visible={installConfirm} title={nativeText("Instalar motor")} message={nativeText("Se instalará el motor de base de datos en este servidor.")} confirmLabel={nativeText("Instalar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => setInstallConfirm(false)} onConfirm={() => void installEngine()} />
    <ConfirmDialog visible={confirmWrite} title={nativeText("Ejecutar escritura SQL")} message={nativeText("Esta consulta puede modificar o eliminar datos del servidor. Revisa el SQL antes de continuar.")} confirmLabel={nativeText("Ejecutar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => setConfirmWrite(false)} onConfirm={() => { void runQuery(true); }} />
  </ServerModuleScreen>;
}
