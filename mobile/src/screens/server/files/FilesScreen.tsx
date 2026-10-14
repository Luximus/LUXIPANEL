import { nativeText } from '../../../i18n/native-text';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { ModuleLoading } from "../../../components/server/ModuleLoading";
import { FileSnapshotPrune } from "./FileSnapshotPrune";
import { NativeOperationCard } from "../NativeOperationCard";
import { ModuleGrid } from "../../../components/server/ModuleLayouts";
import { Select } from "../../../components/ui/Select";
import { useServerResource } from "../../../hooks/useServerApi";
/**
 * FilesScreen — réplica nativa del módulo Archivos de LUXIPANEL. Explorador con
 * breadcrumb, tabla (nombre/tamaño/permisos/propietario/modificado), tap para
 * entrar a carpetas / editar archivos, operaciones (nueva carpeta, renombrar,
 * eliminar), editor de texto nativo, y subir/descargar por el gateway
 * (`/api/files/upload|download`). Incluye además panel Git (estado/rama/cambios
 * + commit/pull/push) y Snapshots ("Modo cambios seguros": restaurar/eliminar
 * respaldos). Escáneres avanzados: siguiente incremento.
 *
 * Los subcomponentes y helpers viven en archivos co-localizados sin cambio de
 * comportamiento: `files-types` (tipos + helpers puros), `files-icons` (iconos),
 * `files-dialogs` (OpDialog/PrivacyDialog/ShareDialog/ArchiveContentsDialog) y
 * `files-tools` (diálogo "Herramientas" + sus pestañas).
 */
import { NativeModuleContext } from "../../main/native-module-context";
import { FormSheet } from "../../../components/ui/FormSheet";
import { NativeEditorAssistant } from "./NativeEditorAssistant";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { sortEntries } from "./files-list-logic";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerFilter, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, DialogFooter } from "../../../components/server/Form";
import { pillColors, type PillKind } from "../../../components/server/badges";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import { TablerFolder, TablerFile, TablerFolderPlus, TablerUpload, TablerDownload, TablerEdit, TablerTrash, TablerChevronRight, TablerArrowDown, TablerArrowUp, TablerDeviceFloppy, TablerClock, TablerArchive } from "../../../features/app/tabler-icons";
import { callServerApi, unwrap, downloadServerFile, uploadServerFile } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";
import { CopyIcon, EyeIcon, FileZipIcon, GitBranchIcon, LockIcon, ShareIcon, ShieldLockIcon, ToolIcon, UserCogIcon } from "./files-icons";
import { ArchiveContentsDialog, OpDialog, PrivacyDialog, ShareDialog } from "./files-dialogs";
import { ToolsDialog } from "./files-tools";
import {
  type Entry,
  type GitFile,
  type GitStatus,
  type OpKind,
  type Snapshot,
  GUARDS,
  fmtBytes,
  gitStatusKey,
  isArchiveName,
  joinPath,
  parentOf,
} from "./files-types";

export function FilesScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const preferences = useServerResource<{showHidden?:boolean;mode?:string;favoriteRoots?:string[]}>(()=>callServerApi(panelId,token,"GET","/api/files/preferences"),[panelId,token]);
  const [layout, setLayout] = useState("list");
  const [path, setPath] = useState("/var/www");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editor, setEditor] = useState<{ entry: Entry; content: string; loading: boolean; binary: boolean } | null>(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const workspace=useContext(NativeModuleContext);
  const [chooseEditorFile,setChooseEditorFile]=useState(false);
  useEffect(()=>{if(workspace?.selectedView === "editor" && !editor)setChooseEditorFile(true);},[workspace?.selectedView,workspace?.viewRevision]);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ entry: Entry; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Entry | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  // Git
  const [inRepo, setInRepo] = useState<boolean | null>(null);
  const [gitOpen, setGitOpen] = useState(false);
  const [gitData, setGitData] = useState<GitStatus | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitErr, setGitErr] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [gitBusy, setGitBusy] = useState<"" | "commit" | "pull" | "push">("");
  // Snapshots ("Modo cambios seguros")
  const [snapsOpen, setSnapsOpen] = useState(false);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [snapsLoading, setSnapsLoading] = useState(false);
  const [snapsErr, setSnapsErr] = useState<string | null>(null);
  const [snapConfirm, setSnapConfirm] = useState<{ kind: "restore" | "delete"; id: string; name: string } | null>(null);
  const [snapBusy, setSnapBusy] = useState(false);
  // Operaciones avanzadas (chmod/chown/copiar/comprimir/extraer) + privacidad + compartir
  const [opDialog, setOpDialog] = useState<{ kind: OpKind; entry: Entry } | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [share, setShare] = useState<{ seedPath: string } | null>(null);
  // Herramientas (escáneres + operaciones masivas) + visor de comprimidos
  const [toolsOpen, setToolsOpen] = useState(false);
  const [archiveView, setArchiveView] = useState<Entry | null>(null);

  const load = useCallback(
    async (dir: string) => {
      const res = await callServerApi(panelId, token, "GET", `/api/files/list?path=${encodeURIComponent(dir)}`);
      if (res.code && GUARDS.includes(res.code)) {
        setGuardCode(res.code as GatewayGuardCode);
        return;
      }
      setGuardCode(null);
      if (!res.ok) {
        setError(t.toasts.error);
        return;
      }
      setError(null);
      const list = unwrap<Entry[]>(res);
      setEntries(Array.isArray(list) ? list : []);
    },
    [panelId, token, t.toasts.error],
  );

  useEffect(() => {
    setLoading(true);
    void load(path).finally(() => setLoading(false));
  }, [load, path]);

  // ¿La carpeta actual está en un repo git? (fail-open: ante error → desconocido,
  // botón Git habilitado). Solo decide la habilitación del botón; el diálogo
  // recarga el estado real al abrirse.
  useEffect(() => {
    let alive = true;
    setInRepo(null);
    void callServerApi(panelId, token, "GET", `/api/files/git/in-repo?path=${encodeURIComponent(path)}`)
      .then((res) => {
        if (!alive) return;
        const d = unwrap<{ inRepo?: boolean }>(res);
        setInRepo(res.ok ? !!d?.inRepo : null);
      })
      .catch(() => {
        if (alive) setInRepo(null);
      });
    return () => {
      alive = false;
    };
  }, [panelId, token, path]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(path);
    setRefreshing(false);
  }, [load, path]);

  // Carpetas primero, luego por nombre (ver `files-list-logic`, testeado).
  const sorted = useMemo(() => sortEntries(entries.filter(entry=>preferences.data?.showHidden !== false || !entry.name.startsWith("."))), [entries,preferences.data?.showHidden]);

  /** Estable: un arrow inline aquí rompe la memoización de las filas de la tabla. */
  const entryRowKey = useCallback((e: Entry) => e.path, []);

  // ── Operaciones ────────────────────────────────────────────────────────────
  const openEntry = useCallback(
    async (e: Entry) => {
      if (e.isDir) {
        setPath(e.path);
        return;
      }
      setEditor({ entry: e, content: "", loading: true, binary: false });
      const res = await callServerApi(panelId, token, "GET", `/api/files/read?path=${encodeURIComponent(e.path)}`);
      const data = unwrap<{ content?: string } | string>(res) as { content?: string } | string | null;
      const content = typeof data === "string" ? data : data?.content ?? "";
      const binary = !res.ok || content.includes("\u0000");
      setEditor({ entry: e, content: binary ? "" : content, loading: false, binary });
    },
    [panelId, token],
  );

  const saveEditor = useCallback(async () => {
    if (!editor) return;
    setSavingEditor(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/files/write", { path: editor.entry.path, content: editor.content, encoding: "utf-8" }));
    setSavingEditor(false);
    if (out.ok) {
      showToast(t.toasts.saved);
    } else showToast(out.error ?? t.toasts.error, true);
  }, [editor, panelId, token, showToast, t.toasts]);

  const createFolder = useCallback(async () => {
    const name = (newFolder ?? "").trim();
    if (!name) return;
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/files/mkdir", { path: joinPath(path, name) }));
    if (out.ok) {
      showToast(t.toasts.folderCreated);
      setNewFolder(null);
      void load(path);
    } else throw new Error(out.error ?? t.toasts.error);
  }, [newFolder, panelId, token, path, showToast, load, t.toasts]);

  const doRename = useCallback(async () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) return;
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/files/rename", { from: renaming.entry.path, to: joinPath(parentOf(renaming.entry.path), name) }));
    if (out.ok) {
      showToast(t.toasts.renamed);
      setRenaming(null);
      void load(path);
    } else throw new Error(out.error ?? t.toasts.error);
  }, [renaming, panelId, token, path, showToast, load, t.toasts]);

  const doDelete = useCallback(async () => {
    if (!confirmDel) return;
    setConfirmBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "DELETE", "/api/files", { path: confirmDel.path }));
    setConfirmBusy(false);
    if (out.ok) {
      showToast(t.toasts.deleted);
      void load(path);
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmDel(null);
  }, [confirmDel, panelId, token, path, showToast, load, t.toasts]);

  const download = useCallback(
    async (e: Entry) => {
      try {
        const blob = await downloadServerFile(panelId, token, `/api/files/download?path=${encodeURIComponent(e.path)}`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        // API moderna de expo-file-system (SDK 54): File/Paths. Tipos nativos
        // opacos → casts puntuales; el try/catch degrada con un toast si falla.
        const file = new File(Paths.cache, e.name) as unknown as { create?: (o?: unknown) => void; write: (b: Uint8Array) => void; uri: string };
        try { file.create?.({ overwrite: true }); } catch { /* ya existe */ }
        file.write(bytes);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
        showToast(t.toasts.downloaded);
      } catch {
        showToast(t.toasts.error, true);
      }
    },
    [panelId, token, showToast, t.toasts],
  );

  const upload = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const a = picked.assets[0];
      const target = `/api/files/upload?dest=${encodeURIComponent(path)}&filename=${encodeURIComponent(a.name)}`;
      const res = await uploadServerFile(panelId, token, target, { uri: a.uri, name: a.name, type: a.mimeType ?? "application/octet-stream" });
      if (res.ok) {
        showToast(t.toasts.uploaded);
        void load(path);
      } else showToast(t.toasts.error, true);
    } catch {
      showToast(t.toasts.error, true);
    }
  }, [panelId, token, path, showToast, load, t.toasts]);

  // ── Git ──────────────────────────────────────────────────────────────────
  const loadGit = useCallback(async () => {
    setGitLoading(true);
    setGitErr(null);
    const res = await callServerApi(panelId, token, "GET", `/api/files/git/status?path=${encodeURIComponent(path)}`);
    setGitLoading(false);
    if (!res.ok) {
      setGitErr(res.error ?? t.toasts.error);
      setGitData(null);
      return;
    }
    setGitData(unwrap<GitStatus>(res) ?? null);
  }, [panelId, token, path, t.toasts.error]);

  const openGit = useCallback(() => {
    setCommitMsg("");
    setGitOpen(true);
    void loadGit();
  }, [loadGit]);

  const runGit = useCallback(
    async (action: "commit" | "pull" | "push") => {
      const root = gitData?.root || path;
      const msg = commitMsg.trim();
      if (action === "commit" && !msg) {
        showToast(t.git.enterCommitMsg, true);
        return;
      }
      setGitBusy(action);
      const body = action === "commit" ? { path: root, message: msg } : { path: root };
      const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", `/api/files/git/${action}`, body));
      setGitBusy("");
      if (out.ok) {
        showToast(action === "commit" ? t.git.committed : action === "pull" ? t.git.pulled : t.git.pushed);
        if (action === "commit") setCommitMsg("");
        void loadGit();
        void load(path);
      } else showToast(out.error ?? t.toasts.error, true);
    },
    [gitData, path, commitMsg, panelId, token, showToast, loadGit, load, t.git, t.toasts.error],
  );

  // ── Snapshots ──────────────────────────────────────────────────────────────
  const loadSnaps = useCallback(async () => {
    setSnapsLoading(true);
    setSnapsErr(null);
    const res = await callServerApi(panelId, token, "GET", "/api/files/snapshots");
    setSnapsLoading(false);
    if (!res.ok) {
      setSnapsErr(res.error ?? t.toasts.error);
      setSnaps([]);
      return;
    }
    const list = unwrap<Snapshot[]>(res);
    setSnaps(Array.isArray(list) ? list : []);
  }, [panelId, token, t.toasts.error]);

  const openSnaps = useCallback(() => {
    setSnapsOpen(true);
    void loadSnaps();
  }, [loadSnaps]);

  const doSnapAction = useCallback(async () => {
    if (!snapConfirm) return;
    setSnapBusy(true);
    const id = snapConfirm.id;
    const op =
      snapConfirm.kind === "restore"
        ? () => callServerApi(panelId, token, "POST", `/api/files/snapshots/${encodeURIComponent(id)}/restore`)
        : () => callServerApi(panelId, token, "DELETE", `/api/files/snapshots/${encodeURIComponent(id)}`);
    const out = await runServerMutation(panelId, token, op);
    setSnapBusy(false);
    if (out.ok) {
      showToast(snapConfirm.kind === "restore" ? t.snapshots.restored : t.snapshots.deleted);
      void loadSnaps();
      void load(path);
    } else throw new Error(out.error ?? t.toasts.error);
    setSnapConfirm(null);
  }, [snapConfirm, panelId, token, showToast, loadSnaps, load, path, t.snapshots, t.toasts.error]);

  // ── Tabla ──────────────────────────────────────────────────────────────────
  const columns: ServerColumn<Entry>[] = useMemo(
    () => [
      {
        id: "name",
        header: t.cols.name,
        cell: (e) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {e.isDir ? <TablerFolder size={16} color={tokens.brand} /> : <TablerFile size={16} color={tokens.textMuted} />}
            <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 13 }}>{e.name}</Text>
          </View>
        ),
        sortable: true,
        sortValue: (e) => `${e.isDir ? 0 : 1}${e.name}`,
        width: 200,
      },
      { id: "size", header: t.cols.size, cell: (e) => (e.isDir ? "—" : fmtBytes(e.size)), width: 90 },
      { id: "mode", header: t.cols.mode, cell: (e) => e.mode ?? "—", width: 90, defaultHidden: true },
      { id: "owner", header: t.cols.owner, cell: (e) => e.owner ?? "—", width: 110, defaultHidden: true },
      { id: "mtime", header: t.cols.mtime, cell: (e) => (e.mtime ? new Date(e.mtime).toLocaleDateString() : "—"), width: 120, defaultHidden: true },
    ],
    [t, tokens],
  );
  const filters: ServerFilter<Entry>[] = useMemo(() => [{ id: "search", kind: "search", placeholder: t.filterSearch, match: (e, q) => e.name.toLowerCase().includes(q) }], [t]);
  const rowActions: ServerRowAction[] = useMemo(
    () => [
      { id: "edit", label: t.actions.edit, icon: <TablerEdit size={18} /> },
      { id: "rename", label: t.actions.rename, icon: <TablerEdit size={18} /> },
      { id: "download", label: t.actions.download, icon: <TablerDownload size={18} /> },
      { id: "copy", label: t.actions.copy, icon: <CopyIcon size={18} /> },
      { id: "share", label: t.share.action, icon: <ShareIcon size={18} /> },
      { id: "chmod", label: t.ops.chmodAction, icon: <LockIcon size={18} /> },
      { id: "chown", label: t.ops.chownAction, icon: <UserCogIcon size={18} /> },
      { id: "compress", label: t.ops.compressAction, icon: <TablerArchive size={18} /> },
      { id: "extract", label: t.ops.extractAction, icon: <FileZipIcon size={18} /> },
      { id: "viewArchive", label: t.archiveView.action, icon: <EyeIcon size={18} /> },
      { id: "delete", label: t.actions.delete, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );

  const onRowAction = useCallback(
    (id: string, e: Entry) => {
      if (id === "edit") void openEntry(e);
      else if (id === "rename") setRenaming({ entry: e, name: e.name });
      else if (id === "download" && !e.isDir) void download(e);
      else if (id === "copy") {
        if (e.isDir) showToast(t.ops.copyOnlyFiles, true);
        else setOpDialog({ kind: "copy", entry: e });
      } else if (id === "share") {
        if (e.isDir) showToast(t.ops.copyOnlyFiles, true);
        else setShare({ seedPath: e.path });
      } else if (id === "chmod") setOpDialog({ kind: "chmod", entry: e });
      else if (id === "chown") setOpDialog({ kind: "chown", entry: e });
      else if (id === "compress") setOpDialog({ kind: "compress", entry: e });
      else if (id === "extract") {
        if (!e.isDir && isArchiveName(e.name)) setOpDialog({ kind: "extract", entry: e });
        else showToast(t.ops.extractNotArchive, true);
      } else if (id === "viewArchive") {
        if (!e.isDir && isArchiveName(e.name)) setArchiveView(e);
        else showToast(t.archiveView.notArchive, true);
      } else if (id === "delete") setConfirmDel(e);
    },
    [openEntry, download, showToast, t.ops, t.share, t.archiveView],
  );

  // Breadcrumb
  const segments = path.split("/").filter(Boolean);
  const gitFiles: GitFile[] = gitData?.files ?? [];

  return (
    <>
      <ServerModuleScreen title={t.pageTitle} subtitle={t.subtitle} onBack={onBack} guardCode={guardCode} error={error} onRetry={onRefresh} refreshing={refreshing} onRefresh={onRefresh} settingsPages={[
          {key:"general",get label() { return nativeText("General"); },content:<View style={{gap:20}}><NativeOperationCard embedded title={nativeText("Preferencias del explorador")} panelId={panelId} token={token} readPath="/api/files/preferences" path="/api/files/preferences" method="PATCH" fields={[{key:"mode",get label() { return nativeText("Modo"); },options:[{key:"client",get label() { return nativeText("Cliente"); }},{key:"developer",get label() { return nativeText("Desarrollador"); }}]},{key:"showHidden",get label() { return nativeText("Mostrar archivos ocultos"); },type:"boolean"}]} toBody={v=>({mode:v.mode,showHidden:v.showHidden})} onSaved={()=>void preferences.reload()}/></View>},
          {key:"shortcuts",get label() { return nativeText("Atajos"); },content:<View style={{gap:20}}><NativeOperationCard embedded fieldGroups={[{key:"files",get label() { return nativeText("Archivos"); }},{key:"nav",get label() { return nativeText("Navegación"); }},{key:"tools",get label() { return nativeText("Herramientas"); }}]} title={nativeText("Atajos de teclado")} panelId={panelId} token={token} readPath="/api/files/preferences" path="/api/files/preferences" method="PATCH" fields={[
            ["newFile",nativeText("Nuevo archivo")],["newFolder",nativeText("Nueva carpeta")],["upload",nativeText("Subir")],["paste","Pegar"],["save",nativeText("Guardar")],["delete",nativeText("Eliminar")],["back",nativeText("Atrás")],["refresh",nativeText("Actualizar")],["search",nativeText("Buscar")],["newTab",nativeText("Nueva pestaña")],["clearSelection",nativeText("Limpiar selección")],["openFiles",nativeText("Abrir archivos")],["toggleEditor",nativeText("Mostrar editor")],["viewList",nativeText("Lista")],["viewGrid",nativeText("Cuadrícula")],["projects",nativeText("Proyectos")],["rescanProjects",nativeText("Explorar proyectos")],["projectMap",nativeText("Mapa de proyecto")],["compare","Comparar"],["git",nativeText("Git")],["copyPath",nativeText("Copiar ruta")],["download",nativeText("Descargar")]
          ].map(([key,label],index)=>({key:`shortcuts.${key}`,label,group:index<6?"files":index<13?"nav":"tools"}))} toBody={values=>({shortcuts:values.shortcuts})}/></View>},
          {key:"roots",get label() { return nativeText("Raíces"); },content:<View style={{gap:20}}><NativeOperationCard embedded title={nativeText("Carpetas favoritas")} panelId={panelId} token={token} readPath="/api/files/preferences" path="/api/files/preferences" method="PATCH" fields={[{key:"favoriteRoots",get label() { return nativeText("Carpetas favoritas"); },type:"lines"},{key:"treeExpansionMode",get label() { return nativeText("Expansión del árbol"); },options:[{key:"multiple",get label() { return nativeText("Múltiple"); }},{key:"single",get label() { return nativeText("Única"); }}]}]} toBody={v=>({favoriteRoots:v.favoriteRoots,treeExpansionMode:v.treeExpansionMode})} onSaved={()=>void preferences.reload()}/></View>},
          {key:"operation",get label() { return nativeText("Operación"); },content:<View style={{gap:20}}><NativeOperationCard embedded afterField={key=>key === "snapshotMaxTotal" ? <FileSnapshotPrune panelId={panelId} token={token}/> : null} title={nativeText("Límites y copias de archivos")} panelId={panelId} token={token} readPath="/api/files/config" path="/api/files/config" method="PATCH" selectData={data=>{const v=(data ?? {}) as Record<string,unknown>;return {...v,uploadMiB:Number(v.uploadMaxBytes)/1048576,snapshotMiB:Number(v.snapshotMaxBytes)/1048576,shareHours:Number(v.shareMaxExpiryMin)/60};}} fields={[
            {key:"uploadMiB",get heading() { return nativeText("Transferencias"); },get label() { return nativeText("Tamaño máximo de subida (MiB)"); },type:"number",min:1},{key:"snapshotsEnabled",get heading() { return nativeText("Copias de archivos"); },get label() { return nativeText("Activar copias"); },type:"boolean"},{key:"snapshotMiB",get label() { return nativeText("Tamaño máximo por copia (MiB)"); },type:"number",min:1},{key:"snapshotMaxPerPath",get label() { return nativeText("Copias por archivo"); },type:"number",min:1},{key:"snapshotMaxTotal",get label() { return nativeText("Copias totales"); },type:"number",min:1},{key:"sharingEnabled",get heading() { return nativeText("Enlaces compartidos"); },get label() { return nativeText("Permitir compartir"); },type:"boolean"},{key:"shareHours",get label() { return nativeText("Caducidad máxima (horas)"); },type:"number",min:1,max:720},{key:"sharePasswordRequired",get label() { return nativeText("Exigir contraseña"); },type:"boolean"}
          ]} toBody={v=>({uploadMaxBytes:Number(v.uploadMiB)*1048576,snapshotsEnabled:v.snapshotsEnabled,snapshotMaxBytes:Number(v.snapshotMiB)*1048576,snapshotMaxPerPath:v.snapshotMaxPerPath,snapshotMaxTotal:v.snapshotMaxTotal,sharingEnabled:v.sharingEnabled,shareMaxExpiryMin:Number(v.shareHours)*60,sharePasswordRequired:v.sharePasswordRequired})}/></View>}
        ]} headerActions={<>
          <Button label={t.share.button} icon={<ShareIcon size={16} />} variant="secondary" size="sm" onPress={() => setShare({ seedPath: "" })} />
          <Button label={t.privacy.button} icon={<ShieldLockIcon size={16} />} variant="secondary" size="sm" onPress={() => setPrivacyOpen(true)} />
          <Button label={t.tools.button} icon={<ToolIcon size={16} />} variant="secondary" size="sm" onPress={() => setToolsOpen(true)} />
          <Button label={t.snapshots.button} icon={<TablerClock size={16} />} variant="secondary" size="sm" onPress={openSnaps} />
          <Button label={t.git.button} icon={<GitBranchIcon size={16} />} variant="secondary" size="sm" onPress={openGit} disabled={inRepo === false} />
          <Button label={t.actions.upload} icon={<TablerUpload size={16} />} variant="secondary" size="sm" onPress={upload} />
          <Button label={t.actions.newFolder} icon={<TablerFolderPlus size={16} />} size="sm" onPress={() => setNewFolder("")} />
        </>}>
        <View style={{flexDirection:"row",gap:8}}><View style={{flex:1}}><Select value={path} onChange={setPath} options={[...new Set([path,"/",...(preferences.data?.favoriteRoots ?? [])])].map(value=>({value,label:value}))}/></View><Button label={layout==="list"?nativeText("Cuadrícula"):nativeText("Lista")} variant="ghost" onPress={()=>setLayout(layout==="list"?"grid":"list")}/></View>
        {/* Breadcrumb */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Pressable onPress={() => setPath("/")} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
              <Text style={{ color: tokens.brand, fontSize: 13 }}>{t.root}</Text>
            </Pressable>
            {segments.map((seg, i) => {
              const target = "/" + segments.slice(0, i + 1).join("/");
              const last = i === segments.length - 1;
              return (
                <View key={target} style={{ flexDirection: "row", alignItems: "center" }}>
                  <TablerChevronRight size={14} color={tokens.textMuted} />
                  <Pressable onPress={() => setPath(target)} style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
                    <Text style={{ color: last ? tokens.textPrimary : tokens.brand, fontSize: 13, fontWeight: last ? "700" : "400" }}>{seg}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>



        {editor ? null : layout === "grid" ? <ModuleGrid columns={4}>{sorted.map(entry=><Pressable key={entry.path} accessibilityRole="button" onPress={()=>void openEntry(entry)} style={{padding:14,minHeight:80,borderWidth:1,borderColor:tokens.border,borderRadius:8}}><Text style={{color:tokens.brand,fontSize:24}}>{entry.isDir?"▱":"▤"}</Text><Text style={{color:tokens.textPrimary}}>{entry.name}</Text></Pressable>)}</ModuleGrid> : <ServerDataTable
          title={t.pageTitle}
          columns={columns}
          rows={sorted}
          rowKey={entryRowKey}
          filters={filters}
          rowActions={rowActions}
          loading={loading}
          onRowAction={onRowAction}
          onRowPress={openEntry}
        />}
      {editor ? (
        <View style={{gap:12}}><View style={{flexDirection:"row",gap:8,alignItems:"center"}}><Text style={{color:tokens.textPrimary,flex:1}}>{editor.entry.path}</Text><Button label={t.editor.save} disabled={editor.loading || editor.binary} loading={savingEditor} onPress={saveEditor}/><Button label={t.editor.cancel} variant="ghost" onPress={()=>setEditor(null)}/></View>
          {editor.loading ? (
            <ModuleLoading label={t.editor.loading} />
          ) : editor.binary ? (
            <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.editor.binary}</Text>
          ) : (
            <View style={{gap:12}}><NativeEditorAssistant key={editor.entry.path} panelId={panelId} token={token} path={editor.entry.path} content={editor.content} onChange={content => setEditor(current => current ? {...current, content} : current)} />
            <TextInput
              value={editor.content}
              onChangeText={(v) => setEditor((cur) => (cur ? { ...cur, content: v } : cur))}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              style={{ minHeight: 260, color: tokens.textSecondary, fontSize: 12, fontFamily: "monospace", textAlignVertical: "top", backgroundColor: tokens.bgInput, borderRadius: 8, borderWidth: 1, borderColor: tokens.border, padding: 10 }}
            /></View>
          )}
        </View>
      ) : null}


      </ServerModuleScreen>

      {/* Editor */}
      <FormSheet visible={chooseEditorFile} onClose={()=>setChooseEditorFile(false)} title={language.startsWith("es")?nativeText("Seleccionar archivo para editar"):nativeText("Select file to edit")} language={language}><View style={{gap:10}}>{sorted.filter(entry=>!entry.isDir).map(entry=><Button key={entry.path} label={entry.name} variant="ghost" onPress={()=>{setChooseEditorFile(false);void openEntry(entry);}}/>)}{!sorted.some(entry=>!entry.isDir)?<Text style={{color:tokens.textMuted}}>{language.startsWith("es")?nativeText("Abre una carpeta en el explorador para seleccionar un archivo."):nativeText("Open a folder in the browser to select a file.")}</Text>:null}</View></FormSheet>
      {/* Nueva carpeta */}
      {newFolder !== null ? (
        <FormDrawer visible onClose={() => setNewFolder(null)} title={t.newFolderDialog.title} language={language} footer={<DialogFooter onCancel={() => setNewFolder(null)} cancelLabel={t.newFolderDialog.cancel} onSubmit={createFolder} submitLabel={t.newFolderDialog.create} />}>
          <Field label={t.newFolderDialog.label}>
            <Input value={newFolder} onChangeText={setNewFolder} placeholder={t.newFolderDialog.placeholder} autoCapitalize="none" />
          </Field>
        </FormDrawer>
      ) : null}

      {/* Renombrar */}
      {renaming ? (
        <FormDrawer visible onClose={() => setRenaming(null)} title={t.renameDialog.title} language={language} footer={<DialogFooter onCancel={() => setRenaming(null)} cancelLabel={t.renameDialog.cancel} onSubmit={doRename} submitLabel={t.renameDialog.save} />}>
          <Field label={t.renameDialog.label}>
            <Input value={renaming.name} onChangeText={(v) => setRenaming((cur) => (cur ? { ...cur, name: v } : cur))} autoCapitalize="none" />
          </Field>
        </FormDrawer>
      ) : null}

      {confirmDel ? (
        <ConfirmDialog visible title={t.confirm.deleteTitle} message={formatMessage(t.confirm.delete, { name: confirmDel.name })} confirmLabel={t.confirm.confirm} cancelLabel={t.confirm.cancel} submitting={confirmBusy} onConfirm={doDelete} onCancel={() => setConfirmDel(null)} />
      ) : null}

      {/* Git */}
      {gitOpen ? (
        <FormDrawer visible onClose={() => setGitOpen(false)} title={t.git.title} language={language} footer={<Button label={t.git.close} variant="ghost" onPress={() => setGitOpen(false)} style={{ flex: 1 }} />}>
          {gitLoading ? (
            <ModuleLoading label={t.git.loading} />
          ) : gitErr ? (
            <Text style={{ color: tokens.danger, fontSize: 13 }}>{gitErr}</Text>
          ) : !gitData?.isRepo ? (
            <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.git.notRepo}</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {/* Rama + ahead/behind */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {(() => {
                  const bc = pillColors(tokens, "primary");
                  return (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: bc.bg, borderColor: bc.border }}>
                      <GitBranchIcon size={14} color={bc.text} />
                      <Text style={{ color: bc.text, fontSize: 12, fontWeight: "700" }}>{gitData.branch || "—"}</Text>
                    </View>
                  );
                })()}
                {gitData.ahead || gitData.behind ? <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{`↑${gitData.ahead ?? 0} ↓${gitData.behind ?? 0}`}</Text> : null}
              </View>

              {/* Cambios */}
              <View style={{ gap: 6 }}>
                <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{formatMessage(t.git.changes, { n: gitFiles.length })}</Text>
                {gitFiles.length === 0 ? (
                  <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.git.noChanges}</Text>
                ) : (
                  <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 8 }}>
                    {gitFiles.slice(0, 80).map((f, i) => {
                      const key = gitStatusKey(f);
                      const kind: PillKind = key === "new" || key === "added" ? "ok" : key === "deleted" ? "danger" : "warn";
                      const c = pillColors(tokens, kind);
                      return (
                        <View key={`${f.path}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: tokens.border }}>
                          <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: c.bg, borderColor: c.border }}>
                            <Text style={{ color: c.text, fontSize: 10 }}>{t.gitStatus[key]}</Text>
                          </View>
                          <Text numberOfLines={1} style={{ flex: 1, color: tokens.textSecondary, fontSize: 12, fontFamily: "monospace" }}>{f.path}</Text>
                        </View>
                      );
                    })}
                    {gitFiles.length > 80 ? <Text style={{ color: tokens.textMuted, fontSize: 11, padding: 8 }}>{formatMessage(t.git.more, { n: gitFiles.length - 80 })}</Text> : null}
                  </View>
                )}
              </View>

              {/* Mensaje de commit */}
              <Field label={t.git.commitLabel}>
                <Input value={commitMsg} onChangeText={setCommitMsg} placeholder={t.git.commitPlaceholder} autoCapitalize="none" />
              </Field>

              {/* Acciones git */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button label={t.git.commit} icon={<TablerDeviceFloppy size={16} />} onPress={() => runGit("commit")} loading={gitBusy === "commit"} disabled={!commitMsg.trim() || gitBusy !== ""} style={{ flex: 1 }} />
                <Button label={t.git.pull} icon={<TablerArrowDown size={16} />} variant="secondary" onPress={() => runGit("pull")} loading={gitBusy === "pull"} disabled={gitBusy !== ""} style={{ flex: 1 }} />
                <Button label={t.git.push} icon={<TablerArrowUp size={16} />} variant="secondary" onPress={() => runGit("push")} loading={gitBusy === "push"} disabled={gitBusy !== ""} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </FormDrawer>
      ) : null}

      {/* Snapshots ("Modo cambios seguros") */}
      {snapsOpen ? (
        <Modal visible onClose={() => setSnapsOpen(false)} title={t.snapshots.title} language={language} fillHeight footer={<Button label={t.snapshots.close} variant="ghost" onPress={() => setSnapsOpen(false)} style={{ flex: 1 }} />}>
          <Text style={{ color: tokens.textMuted, fontSize: 12, marginBottom: 10 }}>{t.snapshots.subtitle}</Text>
          {snapsLoading ? (
            <ModuleLoading label={t.snapshots.loading} />
          ) : snapsErr ? (
            <Text style={{ color: tokens.danger, fontSize: 13 }}>{snapsErr}</Text>
          ) : snaps.length === 0 ? (
            <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.snapshots.empty}</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {snaps.map((s) => {
                const name = (s.path ?? "").replace(/\/+$/, "").split("/").pop() || s.path || s.id;
                const raw = s.capturedAt ?? s.createdAt;
                const when = (() => {
                  try {
                    return raw ? new Date(raw).toLocaleString() : "—";
                  } catch {
                    return raw ?? "—";
                  }
                })();
                const opLabel = (t.historyOp as Record<string, string>)[s.op ?? ""] ?? s.op ?? "";
                const kindLabel = s.kind === "dir" ? t.snapshots.kindFolder : s.kind === "absent" ? t.snapshots.kindAbsent : s.kind === "skipped" ? t.snapshots.kindSkipped : "";
                const sized = s.kind === "file" || s.kind === "dir";
                const sky = pillColors(tokens, "sky");
                return (
                  <View key={s.id} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{name}</Text>
                      {kindLabel ? (
                        <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: sky.bg, borderColor: sky.border }}>
                          <Text style={{ color: sky.text, fontSize: 10 }}>{kindLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    {s.path ? <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{s.path}</Text> : null}
                    <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{[opLabel, when, sized ? fmtBytes(s.sizeBytes ?? 0) : ""].filter(Boolean).join(" · ")}</Text>
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                      {s.kind !== "skipped" ? <Button label={t.snapshots.restore} icon={<TablerArchive size={16} />} variant="secondary" size="sm" onPress={() => setSnapConfirm({ kind: "restore", id: s.id, name })} /> : null}
                      <Button label={t.snapshots.delete} icon={<TablerTrash size={16} />} variant="danger" size="sm" onPress={() => setSnapConfirm({ kind: "delete", id: s.id, name })} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Modal>
      ) : null}

      {snapConfirm ? (
        <ConfirmDialog
          visible
          title={snapConfirm.kind === "restore" ? t.snapshots.restoreTitle : t.snapshots.deleteTitle}
          message={snapConfirm.kind === "restore" ? formatMessage(t.snapshots.restoreMessage, { name: snapConfirm.name }) : t.snapshots.deleteMessage}
          confirmLabel={snapConfirm.kind === "restore" ? t.snapshots.confirmRestore : t.snapshots.confirmDelete}
          cancelLabel={t.snapshots.cancel}
          danger={snapConfirm.kind === "delete"}
          submitting={snapBusy}
          onConfirm={doSnapAction}
          onCancel={() => setSnapConfirm(null)}
        />
      ) : null}

      {/* Operaciones avanzadas (copiar / chmod / chown / comprimir / extraer) */}
      {opDialog ? (
        <OpDialog
          panelId={panelId}
          token={token}
          kind={opDialog.kind}
          entry={opDialog.entry}
          onClose={() => setOpDialog(null)}
          onDone={(msg) => {
            setOpDialog(null);
            showToast(msg);
            void load(path);
          }}
          onError={(msg) => showToast(msg, true)}
        />
      ) : null}

      {/* Privacidad de la carpeta actual (.htpasswd) */}
      {privacyOpen ? (
        <PrivacyDialog panelId={panelId} token={token} dir={path} onClose={() => setPrivacyOpen(false)} onToast={showToast} />
      ) : null}

      {/* Enlaces de compartir */}
      {share ? (
        <ShareDialog panelId={panelId} token={token} seedPath={share.seedPath} onClose={() => setShare(null)} onToast={showToast} />
      ) : null}

      {/* Herramientas (escáneres + operaciones masivas) */}
      {toolsOpen ? (
        <ToolsDialog panelId={panelId} token={token} dir={path} onClose={() => setToolsOpen(false)} onToast={showToast} onChanged={() => void load(path)} />
      ) : null}

      {/* Visor de contenido de comprimidos */}
      {archiveView ? (
        <ArchiveContentsDialog panelId={panelId} token={token} entry={archiveView} onClose={() => setArchiveView(null)} />
      ) : null}

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}
