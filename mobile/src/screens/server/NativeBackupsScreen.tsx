import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { TableSettingsContent } from "../../components/server/TableSettingsContent";
import { ModuleTabPanel } from "../../components/server/ModuleLayouts";
import { useWorkspaceModuleTab } from "../main/use-workspace-module-tab";
import { NativeStorageEditor, type BackupStorage } from "./NativeStorageEditor";
import React, { useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, TextInput, View, ScrollView } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { callServerApi, getDirect, unwrap, type HttpMethod } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { Checkbox, ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { ModuleGrid } from "../../components/server/ModuleLayouts";
import { Cloud, Folder, History } from "lucide-react-native";
import { loadSessionState } from "../../lib/session-state";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Backup = { id: number; label: string; provider: string; status: string; destination: string | null; sizeBytes: number | null; startedAt: string; error: string | null };
type Schedule = { id: number; name: string; schedule: string; enabled: boolean; provider?: string; lastRunAt?: string | null };
type Storage = BackupStorage & { id: number | string };
type ConfirmAction = { title: string; message: string; method: HttpMethod; path: string; body?: unknown };
const size = (bytes: number | null) => bytes == null ? "—" : bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** Archive history, on-demand jobs, and schedule controls in React Native. */
export function NativeBackupsScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const [tab, setTab] = useWorkspaceModuleTab<string>("overview");
  const [backupOpen, setBackupOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const language = loadSessionState().language;
  const archives = useServerResource<Backup[]>(() => callServerApi(panelId, token, "GET", "/api/backups"), [panelId, token], { enabled: true });
  const schedules = useServerResource<Schedule[]>(() => callServerApi(panelId, token, "GET", "/api/backups/schedules"), [panelId, token], { enabled: true });
  const storages = useServerResource<Storage[]>(() => callServerApi(panelId, token, "GET", "/api/backups/storages"), [panelId, token], { enabled: true });
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [storagePageSize,setStoragePageSize]=useState(10);
  const [storageHiddenActions,setStorageHiddenActions]=useState<string[]>([]);
  const [storageEdit, setStorageEdit] = useState<BackupStorage | null>(null);
  const [credentialEdit, setCredentialEdit] = useState<BackupStorage | null>(null);
  const [scheduleEdit, setScheduleEdit] = useState<number | null>(null);
  const [includePaths, setIncludePaths] = useState("");
  const [includeDatabases, setIncludeDatabases] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [databaseSelections, setDatabaseSelections] = useState<Array<{ engine: string; name: string }>>([]);
  const [localDir, setLocalDir] = useState("");
  const config = useServerResource<{ localDir: string; defaultRetainCount: number }>(() => callServerApi(panelId, token, "GET", "/api/backups/config"), [panelId, token], { enabled: true });
  const databases = useServerResource<Array<{ type: string; label: string; databases: string[]; error: boolean }>>(() => callServerApi(panelId, token, "GET", "/api/backups/databases"), [panelId, token], { enabled: includeDatabases });
  const credentials = useServerResource<Array<{ provider: string; configured: boolean; accessKeyId?: string; endpoint?: string; region?: string }>>(() => callServerApi(panelId, token, "GET", "/api/backups/provider-creds"), [panelId, token], { enabled: true });
  const [label, setLabel] = useState("manual");
  const [storageId, setStorageId] = useState("local");
  const [includeMail, setIncludeMail] = useState(false);
  const [includePanelConfig, setIncludePanelConfig] = useState(false);
  const [fullServer, setFullServer] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [cron, setCron] = useState("0 2 * * *");
  const [defaultRetainDraft,setDefaultRetainDraft]=useState<string|null>(null);
  const [retainCount, setRetainCount] = useState("7");
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 15, gap: 10 } as const;
  const rows = Array.isArray(archives.data) ? archives.data : [];
  const jobs = Array.isArray(schedules.data) ? schedules.data : [];
  const targets = Array.isArray(storages.data) ? storages.data : [];
  const reload = async () => { await Promise.all([archives.reload(), schedules.reload(), storages.reload(), config.reload(), databases.reload(), credentials.reload()]); };
  const mutate = async (method: HttpMethod, path: string, body?: unknown) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try { setError(null); setNotice(null);
    const result = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, path, body));
    if (!result.ok) { setError(result.error ?? nativeText("No se pudo completar la operación.")); return false; }
    setNotice(nativeText("Cambio aplicado en el servidor."));
    await reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const openNewSchedule = () => {
    setScheduleEdit(null); setScheduleName(""); setScheduleEnabled(true); setCron("0 2 * * *");
    setRetainCount(String(config.data?.defaultRetainCount ?? 7)); setError(null); setScheduleOpen(true);
  };
  const startBackup = () => {
    if (!label.trim()) { setError(nativeText("Escribe una etiqueta para la copia.")); return; }
    void mutate("POST", "/api/backups", { label: label.trim(), storageId, includeDatabase: false, includeDatabases, includeMail, includePanelConfig, fullServer, databaseSelections, includePaths: includePaths.split(/\r?\n/).map(path => path.trim()).filter(Boolean) }).then(ok => { if (ok) setBackupOpen(false); });
  };
  const createSchedule = () => {
    const count = Number(retainCount);
    if (scheduleName.trim().length < 2 || cron.trim().split(/\s+/).length !== 5 || !Number.isInteger(count) || count < 1 || count > 365) {
      setError(nativeText("Revisa el nombre, la expresión cron de 5 campos y la retención (1 a 365).")); return;
    }
    void mutate(scheduleEdit ? "PUT" : "POST", scheduleEdit ? `/api/backups/schedules/${scheduleEdit}` : "/api/backups/schedules", { name: scheduleName.trim(), schedule: cron.trim(), retainCount: count, storageId, includeDatabase: false, includeDatabases, includeMail, includePanelConfig, fullServer, databaseSelections, includePaths: includePaths.split(/\r?\n/).map(path => path.trim()).filter(Boolean), enabled: scheduleEnabled }).then(ok => { if (ok) { setScheduleEdit(null); setScheduleName(""); setScheduleOpen(false); } });
  };
  const download = async (backup: Backup) => {
    const target = getDirect(panelId);
    if (!target || !FileSystem.cacheDirectory) { setError(nativeText("Conecta el servidor para descargar la copia.")); return; }
    setBusy(true); setError(null);
    try {
      const safeName = (backup.label || `backup-${backup.id}`).replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 100);
      const uri = `${FileSystem.cacheDirectory}${safeName.endsWith(".tar.gz") ? safeName : `${safeName}.tar.gz`}`;
      const path = `/api/backups/${encodeURIComponent(backup.id)}/download`;
      const transfer = (current: typeof target) => FileSystem.downloadAsync(`${current.baseUrl}${path}`, uri, { headers: { Authorization: `Bearer ${current.jwt}`, "x-client-platform": "app", ...(current.bridgeSessionId ? {"X-Bridge-Session-Id":current.bridgeSessionId} : {}) } });
      let result = await transfer(target);
      if (result.status === 401 && target.relogin) {
        const fresh = await target.relogin();
        if (fresh) result = await transfer(fresh);
      }
      if (result.status < 200 || result.status >= 300) throw new Error(nativeText("Descarga fallida (HTTP {p0}).", {p0: String(result.status)}));
      if (!await Sharing.isAvailableAsync()) throw new Error(nativeText("No se puede compartir el archivo en este dispositivo."));
      await Sharing.shareAsync(result.uri);
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo descargar la copia.")); }
    finally { setBusy(false); }
  };

  const settingsPages = [
    {key:"table:storages",get label() { return nativeText("Destinos de almacenamiento"); },content:<TableSettingsContent pageSize={storagePageSize} onPageSize={setStoragePageSize} actions={[{id:"edit",get label() { return nativeText("Editar"); }},{id:"delete",get label() { return nativeText("Eliminar"); }}]} hidden={storageHiddenActions} onHidden={setStorageHiddenActions}/>},
    { key: "local", get label() { return nativeText("Almacenamiento local"); }, icon: <Folder size={20} color={colors.textMuted} />, content: <View style={{ gap: 16 }}>
      <Text style={{ color: colors.textPrimary }}>{nativeText("Carpeta actual:")}{" "}{config.data?.localDir ?? "…"}</Text>
      <Field label={nativeText("Nueva carpeta local")}><TextInput value={localDir} onChangeText={setLocalDir} autoCapitalize="none" style={inputStyle} /></Field>
      <Button label={nativeText("Revisar cambio de carpeta")} disabled={busy || !localDir.trim()} onPress={() => { void (async () => {
        const response = await callServerApi(panelId, token, "POST", "/api/backups/config/directory/preview", { localDir: localDir.trim() });
        const preview = unwrap<{ currentDir: string; localDir: string; deleteCount: number; destinationCount: number }>(response);
        if (!preview) { setError(response.error ?? nativeText("No se pudo revisar la carpeta.")); return; }
        if (preview.destinationCount) { setError(nativeText("La carpeta destino ya contiene copias. Elige una carpeta vacía.")); return; }
        setConfirm({ get title() { return nativeText("Cambiar carpeta de copias"); }, message: nativeText("Se eliminarán {p0} copias locales de {p1} y se usará {p2}.", {p0: String(preview.deleteCount), p1: String(preview.currentDir), p2: String(preview.localDir)}), method: "POST", path: "/api/backups/config/directory", body: { localDir: preview.localDir, expectedOldDir: preview.currentDir, expectedDeleteCount: preview.deleteCount, confirmDelete: true } });
      })(); }} />
      <Field label={nativeText("Retención predeterminada (actual: {p0})", {p0: String(config.data?.defaultRetainCount ?? "…")})}><TextInput value={defaultRetainDraft ?? String(config.data?.defaultRetainCount ?? "")} onChangeText={setDefaultRetainDraft} keyboardType="number-pad" style={inputStyle} /></Field>
      <Button label={nativeText("Guardar retención")} disabled={busy || defaultRetainDraft === null || !Number.isInteger(Number(defaultRetainDraft)) || Number(defaultRetainDraft) < 1 || Number(defaultRetainDraft) > 365} onPress={() => void mutate("PUT", "/api/backups/config", { defaultRetainCount: Number(defaultRetainDraft) })} /></View> },
    { key: "cloud", get label() { return nativeText("Almacenamiento en la nube"); }, icon: <Cloud size={20} color={colors.textMuted} />, content: <View style={{ gap: 16 }}>

      <Button label={nativeText("Añadir destino")} onPress={() => setStorageEdit({})} disabled={busy} />
      <ServerDataTable title={nativeText("Destinos de almacenamiento")} pageSizeOverride={storagePageSize} onPageSizeUpdate={setStoragePageSize} hiddenActionIds={storageHiddenActions} onHiddenActionsUpdate={setStorageHiddenActions} rows={targets} rowKey={row=>String(row.id)} columns={[{id:"name",get header() { return nativeText("Nombre"); },cell:r=>r.name??String(r.id),width:180},{id:"provider",get header() { return nativeText("Proveedor"); },cell:r=>r.provider??"local",width:120},{id:"bucket",get header() { return nativeText("Destino"); },cell:r=>r.bucket??"—",width:180}]} rowActions={[{id:"edit",get label() { return nativeText("Editar"); }},{id:"delete",get label() { return nativeText("Eliminar"); },danger:true}]} onRowAction={(id,target)=>{if(String(target.id)==="local")return;if(id==="edit")setStorageEdit(target);else setConfirm({get title() { return nativeText("Eliminar destino"); },message:nativeText("Se eliminará {p0}.", {p0: String(target.name)}),method:"DELETE",path:`/api/backups/storages/${target.id}`});}}/>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Credenciales compartidas")}</Text>
      {(credentials.data ?? []).map(item => <View key={item.provider} style={cardStyle}><Text style={{ color: colors.textPrimary }}>{item.provider.toUpperCase()} · {item.configured ? nativeText("Configurado") : nativeText("Sin configurar")}</Text><Button label={nativeText("Configurar")} onPress={() => setCredentialEdit(item)} disabled={busy} />{item.configured ? <Button label={nativeText("Eliminar credenciales")} variant="danger" disabled={busy} onPress={() => setConfirm({ get title() { return nativeText("Eliminar credenciales"); }, get message() { return nativeText("Los destinos que las utilizan dejarán de funcionar."); }, method: "DELETE", path: `/api/backups/provider-creds/${item.provider}` })} /> : null}</View>)}
</View> },
  ];
  return <ServerModuleScreen tabs={[{ key: "overview", get label() { return nativeText("Estado"); } }, { key: "schedules", get label() { return nativeText("Programaciones"); } }, { key: "history", get label() { return nativeText("Historial"); } }]} activeTab={tab} onTabChange={setTab} title={nativeText("Copias de seguridad")} subtitle={nativeText("Archivos y programación del servidor")} onBack={onBack} action={{ label: tab === "schedules" ? nativeText("Nueva programación") : nativeText("Crear copia"), onPress: () => tab === "schedules" ? openNewSchedule() : setBackupOpen(true) }} settingsPages={settingsPages} error={error ?? archives.error ?? schedules.error ?? storages.error ?? config.error ?? databases.error ?? credentials.error} guardCode={archives.guardCode ?? schedules.guardCode ?? storages.guardCode} onRetry={() => void reload()} onRefresh={() => void reload()} refreshing={archives.loading || schedules.loading || storages.loading}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    {(archives.loading || schedules.loading || storages.loading) && !archives.data && !schedules.data ? <ActivityIndicator color={colors.brand} /> : null}
    {tab === "overview" ? <ModuleGrid>
      <View style={cardStyle}><Text style={{ color: colors.textMuted }}>{nativeText("Última copia correcta")}</Text><Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{rows.find(row => row.status === "completed")?.startedAt ? new Date(rows.find(row => row.status === "completed")!.startedAt).toLocaleString() : "—"}</Text></View>
      <View style={cardStyle}><Text style={{ color: colors.textMuted }}>{nativeText("Copias locales")}</Text><Text style={{ color: colors.textPrimary, fontSize: 22 }}>{rows.filter(row => row.provider === "local").length}</Text></View>
      <View style={cardStyle}><Text style={{ color: colors.textMuted }}>{nativeText("Programaciones activas")}</Text><Text style={{ color: colors.textPrimary, fontSize: 22 }}>{jobs.filter(job => job.enabled).length}</Text></View>
    </ModuleGrid> : null}
    {rows.some(row => row.status === "running") ? <Text style={{ color: colors.brand }}>{nativeText("Creando copia de seguridad…")}</Text> : null}
    <ModuleTabPanel active={tab === "history"}><ServerDataTable settingsId="history" title={nativeText("Historial de copias")} rows={rows} rowKey={row => String(row.id)} loading={archives.loading} pageSizeOptions={[10, 25, 50, 100]}
      columns={[
        { id: "label", get header() { return nativeText("Nombre"); }, width: 160, cell: row => <Text style={{ color: colors.textPrimary }}>{row.label}</Text> },
        { id: "status", get header() { return nativeText("Estado"); }, cell: row => <Text style={{ color: row.status === "failed" ? colors.danger : colors.textSecondary }}>{row.status}</Text> },
        { id: "provider", get header() { return nativeText("Destino"); }, cell: row => <Text style={{ color: colors.textSecondary }}>{row.provider}</Text> },
        { id: "size", get header() { return nativeText("Tamaño"); }, cell: row => <Text style={{ color: colors.textSecondary }}>{size(row.sizeBytes)}</Text> },
        { id: "date", get header() { return nativeText("Fecha"); }, width: 180, cell: row => <Text style={{ color: colors.textSecondary }}>{new Date(row.startedAt).toLocaleString()}</Text> },
      ]} rowActions={[{ id: "download", get label() { return nativeText("Descargar"); } }, { id: "delete", get label() { return nativeText("Eliminar"); }, danger: true }]}
      onRowAction={(action, row) => { if (busy) return; if (action === "download") { if (row.status === "completed" && row.provider === "local") void download(row); else setError(nativeText("La descarga está disponible para copias locales completadas.")); } else if (row.status !== "running") setConfirm({ get title() { return nativeText("Eliminar copia"); }, message: nativeText("Se eliminará {p0}. Esta acción no se puede deshacer.", {p0: String(row.label)}), method: "DELETE", path: `/api/backups/${encodeURIComponent(row.id)}` }); }} /></ModuleTabPanel>
    <ModuleTabPanel active={tab === "schedules"}><ServerDataTable settingsId="schedules" title={nativeText("Programaciones")} rows={jobs} rowKey={job=>String(job.id)} loading={schedules.loading} columns={[{id:"name",get header() { return nativeText("Nombre"); },cell:job=>job.name,width:180},{id:"cron",get header() { return nativeText("Frecuencia"); },cell:job=>job.schedule,width:150},{id:"target",get header() { return nativeText("Destino"); },cell:job=>job.provider??"local",width:120},{id:"state",get header() { return nativeText("Estado"); },cell:job=>job.enabled?nativeText("Activa"):nativeText("Pausada"),width:110}]} rowActions={[{id:"edit",get label() { return nativeText("Editar"); }},{id:"toggle",get label() { return nativeText("Activar/pausar"); }},{id:"delete",get label() { return nativeText("Eliminar"); },danger:true}]} onRowAction={(action,job)=>{if(busy)return;if(action==="edit"){setScheduleOpen(true); setScheduleEdit(job.id); setScheduleEnabled(job.enabled); setScheduleName(job.name); setCron(job.schedule);
      const saved = job as Schedule & {retainCount?: number; includeDatabases?: boolean; includeMail?: boolean; includePanelConfig?: boolean; fullServer?: boolean; databaseSelections?: Array<{engine:string;name:string}>; includePaths?: string[]};
      setRetainCount(String(saved.retainCount ?? 7)); setIncludeDatabases(saved.includeDatabases ?? false); setIncludeMail(saved.includeMail ?? false); setIncludePanelConfig(saved.includePanelConfig ?? false); setFullServer(saved.fullServer ?? false); setDatabaseSelections(saved.databaseSelections ?? []); setIncludePaths((saved.includePaths ?? []).join("\n")); setStorageId(String((job as Schedule & {storageId?: string}).storageId ?? "local"));}else if(action==="toggle")void mutate("PUT",`/api/backups/schedules/${job.id}`,{enabled:!job.enabled});else setConfirm({get title() { return nativeText("Eliminar programación"); },message:nativeText("Se eliminará {p0}.", {p0: String(job.name)}),method:"DELETE",path:`/api/backups/schedules/${job.id}`});}}/></ModuleTabPanel>
    <FormDrawer visible={backupOpen} onClose={() => { if (!mutationPending.current) setBackupOpen(false); }} title={nativeText("Crear copia de seguridad")} language={language}>{error ? <Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text> : null}
      <View style={cardStyle}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Nueva copia")}</Text>
        <Field label={nativeText("Etiqueta")}><TextInput value={label} onChangeText={setLabel} maxLength={128} style={inputStyle} /></Field>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{nativeText("Destino")}</Text>
        <SegmentedControl items={[{ key: "local", get label() { return nativeText("Local"); } }, ...targets.filter((item) => String(item.id) !== "local").map((item) => ({ key: String(item.id), label: item.name || item.provider || String(item.id) }))]} value={storageId} onChange={setStorageId} scroll />
        <Checkbox value={includeDatabases} onChange={setIncludeDatabases} label={nativeText("Bases de datos")} />
        {includeDatabases ? (databases.data ?? []).map(group => <View key={group.type} style={{ gap: 8 }}><Text style={{ color: colors.textMuted }}>{group.label}{group.error ? nativeText(" · No se pudo cargar") : ""}</Text>{group.databases.map(name => <Checkbox key={name} label={name} value={databaseSelections.some(db => db.engine === group.type && db.name === name)} onChange={checked => setDatabaseSelections(current => checked ? [...current, { engine: group.type, name }] : current.filter(db => db.engine !== group.type || db.name !== name))} />)}</View>) : null}
        <Field label={nativeText("Directorios adicionales (uno por línea)")}><TextInput value={includePaths} onChangeText={setIncludePaths} multiline autoCapitalize="none" style={inputStyle} /></Field>
        <Checkbox value={includeMail} onChange={setIncludeMail} label={nativeText("Correo")} />
        <Checkbox value={includePanelConfig} onChange={setIncludePanelConfig} label={nativeText("Configuración del panel")} />
        <Checkbox value={fullServer} onChange={setFullServer} label={nativeText("Servidor completo")} />
        <Button label={nativeText("Iniciar copia")} onPress={startBackup} disabled={busy || !label.trim()} />
      </View>
    </FormDrawer>
    <FormDrawer visible={scheduleOpen} onClose={() => { if (!mutationPending.current) setScheduleOpen(false); }} title={scheduleEdit ? nativeText("Editar programación") : nativeText("Nueva programación")} language={language}>{error ? <Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text> : null}
      <View style={cardStyle}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Nueva programación")}</Text>
        <Field label={nativeText("Nombre")}><TextInput value={scheduleName} onChangeText={setScheduleName} maxLength={128} style={inputStyle} /></Field>
        <Field label={nativeText("Cron (minuto hora día mes semana)")}><TextInput value={cron} onChangeText={setCron} autoCapitalize="none" style={inputStyle} /></Field>
        <Field label={nativeText("Copias a conservar")}><TextInput value={retainCount} onChangeText={setRetainCount} keyboardType="number-pad" style={inputStyle} /></Field>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{nativeText("Usará el destino y los elementos seleccionados en Nueva copia.")}</Text>
        <Button label={scheduleEdit ? nativeText("Guardar programación") : nativeText("Crear programación")} onPress={createSchedule} disabled={busy || !scheduleName.trim()} />
      </View>
    </FormDrawer>
    {storageEdit ? <NativeStorageEditor initial={storageEdit} busy={busy} error={error} onClose={() => setStorageEdit(null)} onSave={form => { void mutate(storageEdit.id ? "PUT" : "POST", storageEdit.id ? `/api/backups/storages/${storageEdit.id}` : "/api/backups/storages", form).then(ok => { if (ok) setStorageEdit(null); }); }} /> : null}
    {credentialEdit ? <NativeStorageEditor initial={credentialEdit} credentials busy={busy} error={error} onClose={() => setCredentialEdit(null)} onSave={({ provider, ...form }) => { void mutate("PUT", `/api/backups/provider-creds/${provider}`, form).then(ok => { if (ok) setCredentialEdit(null); }); }} /> : null}
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Eliminar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const pending = confirm; void mutate(pending.method, pending.path, pending.body).then(ok => { if (ok) setConfirm(null); }); }} />
  </ServerModuleScreen>;
}
