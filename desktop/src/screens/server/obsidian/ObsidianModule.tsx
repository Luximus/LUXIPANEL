/**
 * ObsidianModule (desktop) — pantalla NATIVA del módulo Obsidian de un servidor
 * standalone (conexión DIRECTA por `serverApi`). Port React DOM COMPLETO de
 * `app/src/screens/server/obsidian/ObsidianScreen.tsx`, conservando estilos
 * (Tailwind + daisyUI + lucide-react), i18n (`getMessages(...).serverObsidian`)
 * y contrato (`serverObsidianApi` + `callServerApi`, token `""` en modo directo).
 *
 * Vista maestro-detalle (paridad con app):
 *  - MAESTRO: DataTable de vaults (Nombre/Ruta/Notas/Estado) + "Nuevo vault"
 *    (create/register) + desregistrar (confirm, NO borra archivos) + diálogo de
 *    CONTENEDORES de contexto (lista + backfill idempotente `containers/sync`).
 *  - DETALLE (al abrir un vault): notas aplanadas del `tree` con buscador de
 *    contenido (`search`), "Nueva nota", "Contexto IA" (CLAUDE/AGENTS/GEMINI.md),
 *    "Nota diaria" y un editor nativo (readNote → textarea → writeNote) con panel
 *    de enlaces (wikilinks salientes + backlinks). Sin webview: textarea nativa.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Folder,
  FolderPlus,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import {
  callServerApi,
  serverObsidianApi,
  unwrap,
  type GatewayGuardCode,
} from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";
import type {
  AssistantContextResult,
  EditorState,
  NoteItem,
  NoteRow,
  SearchHit,
  VaultInfo,
  VaultRow,
} from "./obsidian-types";
import { GUARDS, enc, extractNotes, fmtBytes, fmtDate, runServerMutation } from "./obsidian-helpers";
import { ContainersDialog, DailyNoteDialog, NoteEditorDialog, VaultDialog } from "./obsidian-dialogs";

export function ObsidianModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverObsidian;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [selected, setSelected] = useState<VaultInfo | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);

  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [vaultOpen, setVaultOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [containersOpen, setContainersOpen] = useState(false);
  const [aiCtxBusy, setAiCtxBusy] = useState(false);

  // ── Carga ──────────────────────────────────────────────────────────────────
  const loadVaults = useCallback(async () => {
    const res = await serverObsidianApi.listVaults(serverId, "");
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setVaults(unwrap<VaultInfo[]>(res) ?? []);
  }, [serverId]);

  const loadTree = useCallback(async (vaultId: string) => {
    setLoadingNotes(true);
    const res = await serverObsidianApi.tree(serverId, "", vaultId);
    setLoadingNotes(false);
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setNotes(extractNotes(unwrap(res)));
  }, [serverId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    setLoading(true);
    void loadVaults().finally(() => setLoading(false));
  }, [loadVaults]);

  const openVault = useCallback((v: VaultInfo) => {
    setSelected(v);
    setNotes([]);
    setSearchHits(null);
    setQuery("");
    void loadTree(v.id);
  }, [loadTree]);

  const closeVault = useCallback(() => {
    setSelected(null);
    setNotes([]);
    setSearchHits(null);
    setQuery("");
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selected) await Promise.all([loadVaults(), loadTree(selected.id)]);
    else await loadVaults();
    setRefreshing(false);
  }, [selected, loadVaults, loadTree]);

  const runSearch = useCallback(async () => {
    if (!selected) return;
    const q = query.trim();
    if (!q) {
      setSearchHits(null);
      return;
    }
    setSearching(true);
    const res = await serverObsidianApi.search(serverId, "", selected.id, q);
    setSearching(false);
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setSearchHits(unwrap<SearchHit[]>(res) ?? []);
  }, [selected, query, serverId]);

  // ── Mutaciones ──────────────────────────────────────────────────────────────
  const doUnregister = useCallback(
    async (v: VaultInfo) => {
      const accepted = await confirm({
        title: t.confirm.unregisterTitle,
        danger: true,
        confirmLabel: t.confirm.unregisterConfirm,
        cancelLabel: t.confirm.cancel,
        message: formatMessage(t.confirm.unregisterMessage, { name: v.name }),
      });
      if (!accepted) return;
      const out = await runServerMutation(serverId, () => serverObsidianApi.deleteVault(serverId, "", v.id));
      if (out.ok) {
        toast.success(t.toasts.vaultUnregistered);
        if (selected?.id === v.id) closeVault();
        void loadVaults();
      } else toast.error(out.error ?? t.toasts.error);
    },
    [confirm, serverId, selected, closeVault, loadVaults, toast, t],
  );

  const doDeleteNote = useCallback(
    async (path: string) => {
      if (!selected) return;
      const accepted = await confirm({
        title: t.confirm.deleteNoteTitle,
        danger: true,
        confirmLabel: t.confirm.deleteNoteConfirm,
        cancelLabel: t.confirm.cancel,
        message: formatMessage(t.confirm.deleteNoteMessage, { path }),
      });
      if (!accepted) return;
      const out = await runServerMutation(serverId, () => serverObsidianApi.deleteNote(serverId, "", selected.id, path));
      if (out.ok) {
        toast.success(t.toasts.noteDeleted);
        void loadTree(selected.id);
      } else toast.error(out.error ?? t.toasts.error);
    },
    [confirm, selected, serverId, loadTree, toast, t],
  );

  /** Siembra los ficheros de contexto IA (CLAUDE/AGENTS/GEMINI.md) en el vault.
   *  Sin `overwrite`: si todos existían pide confirmación para sobrescribir. */
  const runAssistantContext = useCallback(
    async (overwrite: boolean) => {
      if (!selected) return;
      setAiCtxBusy(true);
      const res = await callServerApi<AssistantContextResult>(
        serverId,
        "",
        "POST",
        `/api/obsidian/vaults/${enc(selected.id)}/assistant-context`,
        { overwrite },
      );
      setAiCtxBusy(false);
      if (res.code && GUARDS.includes(res.code)) {
        setGuardCode(res.code as GatewayGuardCode);
        return;
      }
      if (!res.ok) {
        toast.error(res.error ?? t.toasts.error);
        return;
      }
      const data = unwrap<AssistantContextResult>(res) ?? {};
      const written = data.written ?? [];
      const skipped = data.skipped ?? [];
      if (!overwrite && written.length === 0 && skipped.length > 0) {
        const accepted = await confirm({
          title: t.assistantContext.overwriteTitle,
          confirmLabel: t.assistantContext.overwriteConfirm,
          cancelLabel: t.confirm.cancel,
          message: formatMessage(t.assistantContext.overwriteMessage, { skipped: skipped.join(", ") }),
        });
        // eslint-disable-next-line react-hooks/immutability -- reintento recursivo intencional del propio callback
        if (accepted) void runAssistantContext(true);
        return;
      }
      if (written.length > 0) {
        toast.success(formatMessage(t.assistantContext.toastWritten, { written: written.join(", ") }));
      } else {
        toast.success(formatMessage(t.assistantContext.toastNoChanges, { skipped: skipped.join(", ") || "—" }));
      }
    },
    [selected, serverId, confirm, toast, t],
  );

  // ── Filas / columnas (DataTable de desktop) ─────────────────────────────────
  const vaultRows = useMemo<VaultRow[]>(
    () =>
      vaults.map((v) => {
        const exists = v.exists !== false;
        return {
          id: v.id,
          name: v.name,
          path: v.path,
          noteCount: v.noteCount ?? -1,
          exists,
          stateLabel: exists ? t.vaults.stateOk : t.vaults.stateMissing,
          haystack: `${v.name} ${v.path}`,
        };
      }),
    [vaults, t],
  );
  const vaultColumns = useMemo<DataTableColumnConfig<VaultRow>[]>(
    () => [
      { id: "name", header: t.vaults.colName, accessorKey: "name" },
      { id: "path", header: t.vaults.colPath, accessorKey: "path", cell: (v) => <span className="font-mono text-xs">{v.path}</span> },
      { id: "notes", header: t.vaults.colNotes, accessorKey: "noteCount", cell: (v) => (v.noteCount >= 0 ? String(v.noteCount) : "—") },
      {
        id: "state",
        header: t.vaults.colState,
        accessorKey: "stateLabel",
        cell: (v) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${v.exists ? "border-success/30 bg-success/10 text-success" : "border-error/30 bg-error/10 text-error"}`}
          >
            {v.stateLabel}
          </span>
        ),
      },
    ],
    [t],
  );
  const vaultFilters = useMemo<DataTableFilterConfig<VaultRow>[]>(
    () => [{ id: "search", label: t.vaults.searchPlaceholder, accessorKey: "haystack", type: "text" }],
    [t],
  );
  const vaultActions = useMemo<DataTableRowActionConfig<VaultRow>[]>(
    () => [
      { id: "open", label: t.vaults.open },
      { id: "unregister", label: t.vaults.unregister, variant: "danger" },
    ],
    [t],
  );

  const noteRows = useMemo<NoteRow[]>(
    () =>
      notes.map((n) => ({
        id: n.path,
        name: n.name,
        path: n.path,
        sizeBytes: n.sizeBytes ?? 0,
        modifiedAt: n.modifiedAt ?? "",
        haystack: `${n.name} ${n.path}`,
      })),
    [notes],
  );
  const noteColumns = useMemo<DataTableColumnConfig<NoteRow>[]>(
    () => [
      { id: "name", header: t.notes.colName, accessorKey: "name", cell: (n) => <span className="font-medium">{n.name}</span> },
      { id: "path", header: t.notes.colPath, accessorKey: "path", cell: (n) => <span className="font-mono text-xs">{n.path}</span> },
      { id: "size", header: t.notes.colSize, accessorKey: "sizeBytes", cell: (n) => fmtBytes(n.sizeBytes) },
      { id: "modified", header: t.notes.colModified, accessorKey: "modifiedAt", cell: (n) => fmtDate(n.modifiedAt) },
    ],
    [t],
  );
  const noteFilters = useMemo<DataTableFilterConfig<NoteRow>[]>(
    () => [{ id: "search", label: t.notes.filterPlaceholder, accessorKey: "haystack", type: "text" }],
    [t],
  );
  const noteActions = useMemo<DataTableRowActionConfig<NoteRow>[]>(
    () => [
      { id: "open", label: t.notes.open },
      { id: "delete", label: t.notes.delete, variant: "danger" },
    ],
    [t],
  );

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
      {/* Cabecera + acción contextual + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        {selected ? (
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={closeVault} aria-label={t.notes.title}>
            <ArrowLeft size={16} />
          </button>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-base font-semibold">{selected ? selected.name : t.pageTitle}</h2>
          <p className="truncate text-xs text-base-content/60">{selected ? selected.path : t.subtitle}</p>
        </div>
        {selected ? (
          <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setDailyOpen(true)}>
            <NotebookPen size={14} /> {t.dailyNote}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setVaultOpen(true)}>
            <FolderPlus size={14} /> {t.newVault}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {selected ? (
        <div className="flex flex-col gap-4">
          {/* Buscador de contenido (search) */}
          <div className="flex items-center gap-2">
            <label className="input input-bordered input-sm flex flex-1 items-center gap-2">
              <Search size={14} className="opacity-60" />
              <input
                className="grow"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder={t.contentSearch.placeholder}
              />
            </label>
            <button type="button" className="btn btn-sm btn-primary gap-1.5" onClick={() => void runSearch()} disabled={searching}>
              {searching ? <span className="loading loading-spinner loading-xs" /> : <Search size={14} />} {t.contentSearch.button}
            </button>
          </div>

          {searchHits !== null ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold">{t.contentSearch.resultsTitle}</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setSearchHits(null);
                    setQuery("");
                  }}
                >
                  {t.contentSearch.back}
                </button>
              </div>
              {searchHits.length === 0 ? (
                <p className="text-sm text-base-content/50">{formatMessage(t.contentSearch.empty, { q: query })}</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
                  {searchHits.map((h, i) => (
                    <button
                      key={`${h.path}:${h.line ?? 0}:${i}`}
                      type="button"
                      className={`flex w-full flex-col gap-1 p-3 text-left hover:bg-base-200 ${i < searchHits.length - 1 ? "border-b border-base-300" : ""}`}
                      onClick={() => setEditor({ mode: "edit", path: h.path })}
                    >
                      <span className="flex items-center gap-2">
                        <FileText size={15} className="shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{h.path}</span>
                        {h.line != null ? (
                          <span className="text-[11px] text-base-content/50">{formatMessage(t.contentSearch.line, { line: h.line })}</span>
                        ) : null}
                      </span>
                      {h.text ? <span className="line-clamp-2 text-xs text-base-content/60">{h.text}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline gap-1.5"
                  onClick={() => void runAssistantContext(false)}
                  disabled={aiCtxBusy}
                >
                  {aiCtxBusy ? <span className="loading loading-spinner loading-xs" /> : <Sparkles size={14} />} {t.aiContext}
                </button>
                <button type="button" className="btn btn-sm btn-primary gap-1.5" onClick={() => setEditor({ mode: "create" })}>
                  <Plus size={14} /> {t.newNote}
                </button>
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
                <h3 className="text-sm font-bold">{t.notes.title}</h3>
                <DataTable<NoteRow>
                  tableId="server-obsidian-notes"
                  title={t.notes.title}
                  data={noteRows}
                  columns={noteColumns}
                  filters={noteFilters}
                  rowActions={noteActions}
                  language={language}
                  loading={loadingNotes}
                  onRowAction={(actionId, row) => {
                    if (actionId === "open") setEditor({ mode: "edit", path: row.path });
                    else if (actionId === "delete") void doDeleteNote(row.path);
                  }}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setContainersOpen(true)}>
              <Folder size={14} /> {t.containersButton}
            </button>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <h3 className="text-sm font-bold">{t.vaults.title}</h3>
            <DataTable<VaultRow>
              tableId="server-obsidian-vaults"
              title={t.vaults.title}
              data={vaultRows}
              columns={vaultColumns}
              filters={vaultFilters}
              rowActions={vaultActions}
              language={language}
              loading={loading}
              onRowAction={(actionId, row) => {
                const vault = vaults.find((v) => v.id === row.id);
                if (!vault) return;
                if (actionId === "open") openVault(vault);
                else if (actionId === "unregister") void doUnregister(vault);
              }}
            />
          </div>
        </div>
      )}

      {vaultOpen ? (
        <VaultDialog
          serverId={serverId}
          language={language}
          onClose={() => setVaultOpen(false)}
          onSaved={() => {
            setVaultOpen(false);
            void loadVaults();
          }}
        />
      ) : null}
      {dailyOpen && selected ? (
        <DailyNoteDialog
          serverId={serverId}
          language={language}
          vaultId={selected.id}
          onClose={() => setDailyOpen(false)}
          onSaved={() => {
            setDailyOpen(false);
            void loadTree(selected.id);
          }}
        />
      ) : null}
      {editor && selected ? (
        <NoteEditorDialog
          key={editor.path ?? "__create__"}
          serverId={serverId}
          language={language}
          vaultId={selected.id}
          mode={editor.mode}
          notePath={editor.path}
          notes={notes}
          onNavigate={(p) => setEditor({ mode: "edit", path: p })}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void loadTree(selected.id);
          }}
        />
      ) : null}
      {containersOpen ? (
        <ContainersDialog
          serverId={serverId}
          language={language}
          onClose={() => setContainersOpen(false)}
          onSynced={() => void loadVaults()}
        />
      ) : null}

      {dialog}
    </div>
  );
}
// (ModalShell/FieldLabel y los diálogos Vault/Daily/NoteEditor/Containers viven
//  en `obsidian-dialogs.tsx`; tipos en `obsidian-types.ts`; helpers puros en
//  `obsidian-helpers.ts`.)
