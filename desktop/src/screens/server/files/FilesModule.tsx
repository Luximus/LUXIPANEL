/**
 * FilesModule (desktop) — pantalla NATIVA del módulo Archivos de un servidor
 * standalone (conexión DIRECTA por `serverApi`). Port React DOM COMPLETO de
 * `app/src/screens/server/files/FilesScreen.tsx`, conservando estilos
 * (Tailwind + daisyUI + lucide-react), i18n (`getMessages(...).serverFiles`) y
 * contrato (`callServerApi` + token `""` en modo directo).
 *
 * Paridad con app: explorador con breadcrumb, tabla (nombre/tamaño/permisos/
 * propietario/modificado) con el DataTable de desktop, click para entrar a
 * carpetas / editar archivos, operaciones (nueva carpeta, renombrar, eliminar,
 * copiar, chmod, chown, comprimir, extraer, ver comprimido), editor de texto,
 * subir/descargar por el gateway (`/api/files/upload|download`), panel Git
 * (estado/rama/cambios + commit/pull/push), Snapshots ("Modo cambios seguros"),
 * privacidad (.htpasswd), enlaces de compartir y el diálogo Herramientas
 * (escáneres + operaciones masivas). La lógica agnóstica (`files-list-logic`,
 * `files-types`) se reutiliza tal cual del gemelo de app.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Clock,
  File as FileIcon,
  Folder,
  FolderPlus,
  GitBranch,
  RefreshCw,
  Save,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import { callServerApi, downloadServerFile, unwrap, uploadServerFile, type GatewayGuardCode } from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";
import { sortEntries } from "./files-list-logic";
import { Modal, Field, DialogFooter, Pill, LoadingRow, api, runServerMutation, type PillKind } from "./files-ui";
import { OpDialog, PrivacyDialog, ShareDialog, ArchiveContentsDialog } from "./files-dialogs";
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

/** Fila plana para el DataTable de desktop (accessorKeys ordenables/filtrables). */
type FileRow = {
  id: string;
  name: string;
  sizeBytes: number;
  isDir: boolean;
  mode: string;
  owner: string;
  mtime: string;
  entry: Entry;
};

export function FilesModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverFiles;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const a = api(serverId);

  const showToast = useCallback((message: string, err = false) => (err ? toast.error(message) : toast.success(message)), [toast]);

  const [path, setPath] = useState("/var/www");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editor, setEditor] = useState<{ entry: Entry; content: string; loading: boolean; binary: boolean } | null>(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ entry: Entry; name: string } | null>(null);

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
  // Operaciones avanzadas + privacidad + compartir + herramientas + visor
  const [opDialog, setOpDialog] = useState<{ kind: OpKind; entry: Entry } | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [share, setShare] = useState<{ seedPath: string } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [archiveView, setArchiveView] = useState<Entry | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (dir: string) => {
      const res = await api(serverId).get<Entry[]>(`/api/files/list?path=${encodeURIComponent(dir)}`);
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
    [serverId, t.toasts.error],
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
    void callServerApi(serverId, "", "GET", `/api/files/git/in-repo?path=${encodeURIComponent(path)}`)
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
  }, [serverId, path]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(path);
    setRefreshing(false);
  }, [load, path]);

  // Carpetas primero, luego por nombre (ver `files-list-logic`, testeado).
  const sorted = useMemo(() => sortEntries(entries), [entries]);
  const rows = useMemo<FileRow[]>(
    () =>
      sorted.map((e) => ({
        id: e.path,
        name: e.name,
        sizeBytes: e.isDir ? -1 : e.size,
        isDir: e.isDir,
        mode: e.mode ?? "—",
        owner: e.owner ?? "—",
        mtime: e.mtime ? new Date(e.mtime).toLocaleDateString() : "—",
        entry: e,
      })),
    [sorted],
  );

  // ── Operaciones ────────────────────────────────────────────────────────────
  const openEntry = useCallback(
    async (e: Entry) => {
      if (e.isDir) {
        setPath(e.path);
        return;
      }
      setEditor({ entry: e, content: "", loading: true, binary: false });
      const res = await a.get<{ content?: string } | string>(`/api/files/read?path=${encodeURIComponent(e.path)}`);
      const data = unwrap<{ content?: string } | string>(res) as { content?: string } | string | null;
      const content = typeof data === "string" ? data : data?.content ?? "";
      const binary = !res.ok || content.includes("\u0000");
      setEditor({ entry: e, content: binary ? "" : content, loading: false, binary });
    },
    [a],
  );

  const saveEditor = useCallback(async () => {
    if (!editor) return;
    setSavingEditor(true);
    const out = await runServerMutation(serverId, () => a.put("/api/files/write", { path: editor.entry.path, content: editor.content, encoding: "utf-8" }));
    setSavingEditor(false);
    if (out.ok) {
      showToast(t.toasts.saved);
      setEditor(null);
    } else showToast(out.error ?? t.toasts.error, true);
  }, [editor, serverId, a, showToast, t.toasts]);

  const createFolder = useCallback(async () => {
    const name = (newFolder ?? "").trim();
    if (!name) return;
    const out = await runServerMutation(serverId, () => a.post("/api/files/mkdir", { path: joinPath(path, name) }));
    if (out.ok) {
      showToast(t.toasts.folderCreated);
      setNewFolder(null);
      void load(path);
    } else showToast(out.error ?? t.toasts.error, true);
  }, [newFolder, serverId, a, path, showToast, load, t.toasts]);

  const doRename = useCallback(async () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) return;
    const out = await runServerMutation(serverId, () => a.put("/api/files/rename", { from: renaming.entry.path, to: joinPath(parentOf(renaming.entry.path), name) }));
    if (out.ok) {
      showToast(t.toasts.renamed);
      setRenaming(null);
      void load(path);
    } else showToast(out.error ?? t.toasts.error, true);
  }, [renaming, serverId, a, path, showToast, load, t.toasts]);

  const doDelete = useCallback(
    async (e: Entry) => {
      const ok = await confirm({
        title: t.confirm.deleteTitle,
        message: formatMessage(t.confirm.delete, { name: e.name }),
        confirmLabel: t.confirm.confirm,
        cancelLabel: t.confirm.cancel,
        danger: true,
      });
      if (!ok) return;
      const out = await runServerMutation(serverId, () => a.del("/api/files", { path: e.path }));
      if (out.ok) {
        showToast(t.toasts.deleted);
        void load(path);
      } else showToast(out.error ?? t.toasts.error, true);
    },
    [confirm, serverId, a, path, showToast, load, t.confirm, t.toasts],
  );

  const download = useCallback(
    async (e: Entry) => {
      try {
        const blob = await downloadServerFile(serverId, "", `/api/files/download?path=${encodeURIComponent(e.path)}`);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = e.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(t.toasts.downloaded);
      } catch {
        showToast(t.toasts.error, true);
      }
    },
    [serverId, showToast, t.toasts],
  );

  const onFilePicked = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      ev.target.value = "";
      if (!file) return;
      const target = `/api/files/upload?dest=${encodeURIComponent(path)}&filename=${encodeURIComponent(file.name)}`;
      const res = await uploadServerFile(serverId, "", target, file, file.name);
      if (res.ok) {
        showToast(t.toasts.uploaded);
        void load(path);
      } else showToast(t.toasts.error, true);
    },
    [serverId, path, showToast, load, t.toasts],
  );

  // ── Git ──────────────────────────────────────────────────────────────────
  const loadGit = useCallback(async () => {
    setGitLoading(true);
    setGitErr(null);
    const res = await api(serverId).get<GitStatus>(`/api/files/git/status?path=${encodeURIComponent(path)}`);
    setGitLoading(false);
    if (!res.ok) {
      setGitErr(res.error ?? t.toasts.error);
      setGitData(null);
      return;
    }
    setGitData(unwrap<GitStatus>(res) ?? null);
  }, [serverId, path, t.toasts.error]);

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
      const out = await runServerMutation(serverId, () => a.post(`/api/files/git/${action}`, body));
      setGitBusy("");
      if (out.ok) {
        showToast(action === "commit" ? t.git.committed : action === "pull" ? t.git.pulled : t.git.pushed);
        if (action === "commit") setCommitMsg("");
        void loadGit();
        void load(path);
      } else showToast(out.error ?? t.toasts.error, true);
    },
    [gitData, path, commitMsg, serverId, a, showToast, loadGit, load, t.git, t.toasts.error],
  );

  // ── Snapshots ──────────────────────────────────────────────────────────────
  const loadSnaps = useCallback(async () => {
    setSnapsLoading(true);
    setSnapsErr(null);
    const res = await api(serverId).get<Snapshot[]>("/api/files/snapshots");
    setSnapsLoading(false);
    if (!res.ok) {
      setSnapsErr(res.error ?? t.toasts.error);
      setSnaps([]);
      return;
    }
    const list = unwrap<Snapshot[]>(res);
    setSnaps(Array.isArray(list) ? list : []);
  }, [serverId, t.toasts.error]);

  const openSnaps = useCallback(() => {
    setSnapsOpen(true);
    void loadSnaps();
  }, [loadSnaps]);

  const snapAction = useCallback(
    async (kind: "restore" | "delete", id: string, name: string) => {
      const ok = await confirm({
        title: kind === "restore" ? t.snapshots.restoreTitle : t.snapshots.deleteTitle,
        message: kind === "restore" ? formatMessage(t.snapshots.restoreMessage, { name }) : t.snapshots.deleteMessage,
        confirmLabel: kind === "restore" ? t.snapshots.confirmRestore : t.snapshots.confirmDelete,
        cancelLabel: t.snapshots.cancel,
        danger: kind === "delete",
      });
      if (!ok) return;
      const op =
        kind === "restore"
          ? () => a.post(`/api/files/snapshots/${encodeURIComponent(id)}/restore`)
          : () => a.del(`/api/files/snapshots/${encodeURIComponent(id)}`);
      const out = await runServerMutation(serverId, op);
      if (out.ok) {
        showToast(kind === "restore" ? t.snapshots.restored : t.snapshots.deleted);
        void loadSnaps();
        void load(path);
      } else showToast(out.error ?? t.toasts.error, true);
    },
    [confirm, a, serverId, showToast, loadSnaps, load, path, t.snapshots, t.toasts.error],
  );

  // ── Tabla ──────────────────────────────────────────────────────────────────
  const columns = useMemo<DataTableColumnConfig<FileRow>[]>(
    () => [
      {
        id: "name",
        header: t.cols.name,
        accessorKey: "name",
        cell: (r) => (
          <button type="button" className="flex min-w-0 items-center gap-2 text-left hover:text-primary" onClick={() => void openEntry(r.entry)}>
            {r.isDir ? <Folder size={16} className="shrink-0 text-primary" /> : <FileIcon size={16} className="shrink-0 text-base-content/50" />}
            <span className="truncate">{r.name}</span>
          </button>
        ),
      },
      { id: "size", header: t.cols.size, accessorKey: "sizeBytes", cell: (r) => (r.isDir ? "—" : fmtBytes(r.sizeBytes)) },
      { id: "mode", header: t.cols.mode, accessorKey: "mode" },
      { id: "owner", header: t.cols.owner, accessorKey: "owner" },
      { id: "mtime", header: t.cols.mtime, accessorKey: "mtime" },
    ],
    [t, openEntry],
  );
  const filters = useMemo<DataTableFilterConfig<FileRow>[]>(
    () => [{ id: "search", label: t.filterSearch, accessorKey: "name", type: "text" }],
    [t],
  );
  const rowActions = useMemo<DataTableRowActionConfig<FileRow>[]>(
    () => [
      { id: "edit", label: t.actions.edit, visible: (r) => !r.isDir },
      { id: "rename", label: t.actions.rename },
      { id: "download", label: t.actions.download, visible: (r) => !r.isDir },
      { id: "copy", label: t.actions.copy, visible: (r) => !r.isDir },
      { id: "share", label: t.share.action, visible: (r) => !r.isDir },
      { id: "chmod", label: t.ops.chmodAction },
      { id: "chown", label: t.ops.chownAction },
      { id: "compress", label: t.ops.compressAction },
      { id: "extract", label: t.ops.extractAction, visible: (r) => !r.isDir && isArchiveName(r.name) },
      { id: "viewArchive", label: t.archiveView.action, visible: (r) => !r.isDir && isArchiveName(r.name) },
      { id: "delete", label: t.actions.delete, variant: "danger" },
    ],
    [t],
  );

  const onRowAction = useCallback(
    (id: string, row: FileRow) => {
      const e = row.entry;
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
      } else if (id === "delete") void doDelete(e);
    },
    [openEntry, download, doDelete, showToast, t.ops, t.share, t.archiveView],
  );

  // Breadcrumb
  const segments = path.split("/").filter(Boolean);
  const gitFiles: GitFile[] = gitData?.files ?? [];

  // ── Render ──────────────────────────────────────────────────────────────────
  if (guardCode) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.pageTitle}</h2>
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{t.toasts.error}</p>
          <p className="font-mono text-xs text-base-content/50">{guardCode}</p>
          <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => void onRefresh()}>
            <RefreshCw size={14} /> {c.refresh}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-base-300 bg-base-100 px-2 py-1.5">
        <button type="button" className="rounded px-1.5 py-1 text-sm text-primary hover:underline" onClick={() => setPath("/")}>
          {t.root}
        </button>
        {segments.map((seg, i) => {
          const targetPath = "/" + segments.slice(0, i + 1).join("/");
          const last = i === segments.length - 1;
          return (
            <div key={targetPath} className="flex items-center">
              <ChevronRight size={14} className="text-base-content/40" />
              <button
                type="button"
                className={`rounded px-1 py-1 text-sm hover:underline ${last ? "font-bold text-base-content" : "text-primary"}`}
                onClick={() => setPath(targetPath)}
              >
                {seg}
              </button>
            </div>
          );
        })}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => setShare({ seedPath: "" })}>
          <Share2 size={15} /> {t.share.button}
        </button>
        <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => setPrivacyOpen(true)}>
          <ShieldCheck size={15} /> {t.privacy.button}
        </button>
        <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => setToolsOpen(true)}>
          <Wrench size={15} /> {t.tools.button}
        </button>
        <button type="button" className="btn btn-sm btn-outline gap-1" onClick={openSnaps}>
          <Clock size={15} /> {t.snapshots.button}
        </button>
        <button type="button" className="btn btn-sm btn-outline gap-1" onClick={openGit} disabled={inRepo === false}>
          <GitBranch size={15} /> {t.git.button}
        </button>
        <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => fileInputRef.current?.click()}>
          <Upload size={15} /> {t.actions.upload}
        </button>
        <button type="button" className="btn btn-sm btn-primary gap-1" onClick={() => setNewFolder("")}>
          <FolderPlus size={15} /> {t.actions.newFolder}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => void onFilePicked(e)} />
      </div>

      {error ? <InfoBar message={error} onRetry={() => void onRefresh()} retryLabel={c.refresh} /> : null}

      <DataTable<FileRow>
        tableId="server-files-explorer"
        title={t.pageTitle}
        data={rows}
        columns={columns}
        filters={filters}
        rowActions={rowActions}
        pageSizeOptions={[25, 50, 100]}
        language={language}
        loading={loading}
        onRowAction={onRowAction}
      />

      {/* Editor */}
      {editor ? (
        <Modal
          title={formatMessage(t.editor.title, { name: editor.entry.name })}
          onClose={() => setEditor(null)}
          width="xl"
          fillHeight
          footer={
            editor.binary ? (
              <button type="button" className="lp-modal-btn lp-modal-btn--ghost w-full" onClick={() => setEditor(null)}>
                {t.editor.cancel}
              </button>
            ) : (
              <DialogFooter onCancel={() => setEditor(null)} cancelLabel={t.editor.cancel} onSubmit={() => void saveEditor()} submitLabel={t.editor.save} submitting={savingEditor} />
            )
          }
        >
          {editor.loading ? (
            <LoadingRow label={t.editor.loading} />
          ) : editor.binary ? (
            <p className="text-sm text-base-content/60">{t.editor.binary}</p>
          ) : (
            <textarea
              className="lp-modal-textarea min-h-0 flex-1"
              value={editor.content}
              onChange={(e) => setEditor((cur) => (cur ? { ...cur, content: e.target.value } : cur))}
              spellCheck={false}
            />
          )}
        </Modal>
      ) : null}

      {/* Nueva carpeta */}
      {newFolder !== null ? (
        <Modal
          title={t.newFolderDialog.title}
          onClose={() => setNewFolder(null)}
          footer={<DialogFooter onCancel={() => setNewFolder(null)} cancelLabel={t.newFolderDialog.cancel} onSubmit={() => void createFolder()} submitLabel={t.newFolderDialog.create} />}
        >
          <Field label={t.newFolderDialog.label}>
            <input className="lp-modal-input" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder={t.newFolderDialog.placeholder} spellCheck={false} autoFocus />
          </Field>
        </Modal>
      ) : null}

      {/* Renombrar */}
      {renaming ? (
        <Modal
          title={t.renameDialog.title}
          onClose={() => setRenaming(null)}
          footer={<DialogFooter onCancel={() => setRenaming(null)} cancelLabel={t.renameDialog.cancel} onSubmit={() => void doRename()} submitLabel={t.renameDialog.save} />}
        >
          <Field label={t.renameDialog.label}>
            <input className="lp-modal-input" value={renaming.name} onChange={(e) => setRenaming((cur) => (cur ? { ...cur, name: e.target.value } : cur))} spellCheck={false} autoFocus />
          </Field>
        </Modal>
      ) : null}

      {/* Git */}
      {gitOpen ? (
        <Modal title={t.git.title} onClose={() => setGitOpen(false)} width="md" footer={<button type="button" className="lp-modal-btn lp-modal-btn--ghost w-full" onClick={() => setGitOpen(false)}>{t.git.close}</button>}>
          {gitLoading ? (
            <LoadingRow label={t.git.loading} />
          ) : gitErr ? (
            <p className="text-sm text-error">{gitErr}</p>
          ) : !gitData?.isRepo ? (
            <p className="text-sm text-base-content/60">{t.git.notRepo}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Rama + ahead/behind */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  <GitBranch size={14} /> {gitData.branch || "—"}
                </span>
                {gitData.ahead || gitData.behind ? (
                  <span className="text-xs text-base-content/50">{`↑${gitData.ahead ?? 0} ↓${gitData.behind ?? 0}`}</span>
                ) : null}
              </div>

              {/* Cambios */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-base-content/60">{formatMessage(t.git.changes, { n: gitFiles.length })}</span>
                {gitFiles.length === 0 ? (
                  <p className="text-sm text-base-content/60">{t.git.noChanges}</p>
                ) : (
                  <div className="rounded-lg border border-base-300">
                    {gitFiles.slice(0, 80).map((f, i) => {
                      const key = gitStatusKey(f);
                      const kind: PillKind = key === "new" || key === "added" ? "ok" : key === "deleted" ? "danger" : "warn";
                      return (
                        <div key={`${f.path}-${i}`} className={`flex items-center gap-2 px-2.5 py-2 ${i === 0 ? "" : "border-t border-base-300"}`}>
                          <Pill kind={kind} label={t.gitStatus[key]} />
                          <span className="min-w-0 flex-1 truncate font-mono text-xs text-base-content/70">{f.path}</span>
                        </div>
                      );
                    })}
                    {gitFiles.length > 80 ? <p className="p-2 text-[11px] text-base-content/50">{formatMessage(t.git.more, { n: gitFiles.length - 80 })}</p> : null}
                  </div>
                )}
              </div>

              {/* Mensaje de commit */}
              <Field label={t.git.commitLabel}>
                <input className="lp-modal-input" value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} placeholder={t.git.commitPlaceholder} spellCheck={false} />
              </Field>

              {/* Acciones git */}
              <div className="flex gap-2">
                <button type="button" className="btn btn-sm btn-primary flex-1 gap-1" onClick={() => void runGit("commit")} disabled={!commitMsg.trim() || gitBusy !== ""}>
                  {gitBusy === "commit" ? <span className="loading loading-spinner loading-xs" /> : <Save size={15} />} {t.git.commit}
                </button>
                <button type="button" className="btn btn-sm btn-outline flex-1 gap-1" onClick={() => void runGit("pull")} disabled={gitBusy !== ""}>
                  {gitBusy === "pull" ? <span className="loading loading-spinner loading-xs" /> : <ArrowDown size={15} />} {t.git.pull}
                </button>
                <button type="button" className="btn btn-sm btn-outline flex-1 gap-1" onClick={() => void runGit("push")} disabled={gitBusy !== ""}>
                  {gitBusy === "push" ? <span className="loading loading-spinner loading-xs" /> : <ArrowUp size={15} />} {t.git.push}
                </button>
              </div>
            </div>
          )}
        </Modal>
      ) : null}

      {/* Snapshots ("Modo cambios seguros") */}
      {snapsOpen ? (
        <Modal title={t.snapshots.title} onClose={() => setSnapsOpen(false)} width="md" fillHeight footer={<button type="button" className="lp-modal-btn lp-modal-btn--ghost w-full" onClick={() => setSnapsOpen(false)}>{t.snapshots.close}</button>}>
          <p className="text-xs text-base-content/60">{t.snapshots.subtitle}</p>
          {snapsLoading ? (
            <LoadingRow label={t.snapshots.loading} />
          ) : snapsErr ? (
            <p className="text-sm text-error">{snapsErr}</p>
          ) : snaps.length === 0 ? (
            <p className="text-sm text-base-content/60">{t.snapshots.empty}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
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
                return (
                  <div key={s.id} className="flex flex-col gap-1.5 rounded-xl border border-base-300 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                      {kindLabel ? <Pill kind="sky" label={kindLabel} /> : null}
                    </div>
                    {s.path ? <span className="truncate text-[11px] text-base-content/50">{s.path}</span> : null}
                    <span className="text-[11px] text-base-content/50">{[opLabel, when, sized ? fmtBytes(s.sizeBytes ?? 0) : ""].filter(Boolean).join(" · ")}</span>
                    <div className="flex justify-end gap-2">
                      {s.kind !== "skipped" ? (
                        <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm" onClick={() => void snapAction("restore", s.id, name)}>
                          <Archive size={14} /> {t.snapshots.restore}
                        </button>
                      ) : null}
                      <button type="button" className="lp-modal-btn lp-modal-btn--danger lp-modal-btn--sm" onClick={() => void snapAction("delete", s.id, name)}>
                        <Trash2 size={14} /> {t.snapshots.delete}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      ) : null}

      {/* Operaciones avanzadas (copiar / chmod / chown / comprimir / extraer) */}
      {opDialog ? (
        <OpDialog
          serverId={serverId}
          language={language}
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
      {privacyOpen ? <PrivacyDialog serverId={serverId} language={language} dir={path} onClose={() => setPrivacyOpen(false)} onToast={showToast} /> : null}

      {/* Enlaces de compartir */}
      {share ? <ShareDialog serverId={serverId} language={language} seedPath={share.seedPath} onClose={() => setShare(null)} onToast={showToast} /> : null}

      {/* Herramientas (escáneres + operaciones masivas) */}
      {toolsOpen ? <ToolsDialog serverId={serverId} language={language} dir={path} onClose={() => setToolsOpen(false)} onToast={showToast} onChanged={() => void load(path)} /> : null}

      {/* Visor de contenido de comprimidos */}
      {archiveView ? <ArchiveContentsDialog serverId={serverId} language={language} entry={archiveView} onClose={() => setArchiveView(null)} /> : null}

      {dialog}
    </div>
  );
}

/** Aviso de error de carga con reintento (equivalente al banner de app). */
function InfoBar({ message, onRetry, retryLabel }: { message: string; onRetry: () => void; retryLabel: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" className="btn btn-xs btn-outline gap-1" onClick={onRetry}>
        <RefreshCw size={13} /> {retryLabel}
      </button>
    </div>
  );
}
