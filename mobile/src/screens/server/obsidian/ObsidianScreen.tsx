import { nativeText } from '../../../i18n/native-text';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { ModuleLoading } from "../../../components/server/ModuleLoading";
import { ModuleSplitLayout } from "../../../components/server/ModuleLayouts";
import { NativeOperationCard } from "../NativeOperationCard";
import { MarkdownView } from "../../../components/MarkdownView";
import { useServerResource } from "../../../hooks/useServerApi";
import { ScrollView, useWindowDimensions } from "react-native";
/**
 * ObsidianScreen — réplica nativa del módulo Obsidian de LUXIPANEL
 * (`frontend/src/pages/panel/obsidian/index.astro`). Vista maestro-detalle:
 *  - MAESTRO: tabla de vaults (Nombre/Ruta/Notas/Estado) + "Nuevo vault" (name +
 *    path + modo create/register) + desregistrar (confirm, NO borra archivos).
 *  - DETALLE (al abrir un vault): notas aplanadas del `tree` con buscador de
 *    contenido (`search`), "Nueva nota" y un editor (readNote → multiline →
 *    writeNote), más la "Nota diaria" (dailyNote).
 * Datos por el gateway (`serverObsidianApi`); mutaciones con `runServerMutation`.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerFilter, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, DialogFooter } from "../../../components/server/Form";
import { pillColors } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import {
  TablerFolder,
  TablerFolderPlus,
  TablerFile,
  TablerPlus,
  TablerTrash,
  TablerSearch,
  TablerNotebook,
  TablerSparkles,
} from "../../../features/app/tabler-icons";
import { serverObsidianApi, unwrap, callServerApi } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];
const enc = encodeURIComponent;

type VaultInfo = { id: string; name: string; path: string; exists?: boolean; noteCount?: number | null };
type NoteItem = { path: string; name: string; sizeBytes?: number; modifiedAt?: string };
type SearchHit = { path: string; line?: number; text?: string };
type EditorState = { mode: "edit" | "create"; path?: string };

/** Contenedor de contexto (repo/proyecto/chat) que devuelve `GET /containers`. */
type ContainerItem = { id?: string; kind?: string; refKey?: string; name?: string; path?: string; vaultId?: string; repoPath?: string; createdAt?: string };
/** Resumen del backfill idempotente (`POST /containers/sync`). */
type ContainerSyncSummary = { baseDir?: string; created?: number; existing?: number; repos?: number; projects?: number; chats?: number; containers?: Array<{ kind?: string; name?: string; path?: string }> };
/** Grafo de wikilinks alrededor de una nota (`GET /vaults/:id/links`). */
type NoteLinks = { outgoing: string[]; backlinks: Array<{ path: string; line?: number; text?: string }> };
/** Resultado de sembrar los ficheros de contexto IA (CLAUDE/AGENTS/GEMINI.md). */
type AssistantContextResult = { written?: string[]; skipped?: string[] };

// ── Iconos locales (no están en tabler-icons.tsx; SVG inline estilo Tabler) ──
type LocalIconProps = { size?: number; color?: string };

function IconLink({ size = 18, color = "currentColor" }: LocalIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 15l6 -6" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconArrowUpRight({ size = 18, color = "currentColor" }: LocalIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 7l-10 10" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 7l9 0l0 9" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconArrowBackUp({ size = 18, color = "currentColor" }: LocalIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 14l-4 -4l4 -4" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 10h11a4 4 0 1 1 0 8h-1" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Extrae la lista de notas del árbol del vault de forma DEFENSIVA: el panel
 *  devuelve `{ folders, notes }`, pero puede llegar como array directo o con la
 *  lista de notas bajo otra clave; buscamos el primer array de objetos con path/name. */
function extractNotes(tree: unknown): NoteItem[] {
  if (!tree) return [];
  let candidates: unknown[] = [];
  if (Array.isArray(tree)) {
    candidates = tree;
  } else if (typeof tree === "object") {
    const obj = tree as Record<string, unknown>;
    if (Array.isArray(obj.notes)) {
      candidates = obj.notes;
    } else {
      for (const value of Object.values(obj)) {
        if (Array.isArray(value) && value.some((x) => x && typeof x === "object" && ("path" in x || "name" in x))) {
          candidates = value;
          break;
        }
      }
    }
  }
  const out: NoteItem[] = [];
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const path = typeof o.path === "string" ? o.path : typeof o.name === "string" ? o.name : "";
    if (!path) continue;
    const name = typeof o.name === "string" ? o.name : path.split("/").pop() ?? path;
    out.push({
      path,
      name,
      sizeBytes: typeof o.sizeBytes === "number" ? o.sizeBytes : undefined,
      modifiedAt: typeof o.modifiedAt === "string" ? o.modifiedAt : undefined,
    });
  }
  return out;
}

function fmtBytes(n?: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

export function ObsidianScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverObsidian;

  const {width} = useWindowDimensions();
  const [pane, setPane] = useState("tree");
  const prefs = useServerResource<{editorMode:"edit"|"preview"|"split";fontSize:number;lastVaultId?:string}>(()=>callServerApi(panelId,token,"GET","/api/obsidian/preferences"),[panelId,token]);
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
  const [confirmUnreg, setConfirmUnreg] = useState<VaultInfo | null>(null);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [containersOpen, setContainersOpen] = useState(false);
  const [aiCtxBusy, setAiCtxBusy] = useState(false);
  const [aiCtxSkipped, setAiCtxSkipped] = useState<string[] | null>(null);

  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  // ── Carga ──────────────────────────────────────────────────────────────────
  const loadVaults = useCallback(async () => {
    const res = await serverObsidianApi.listVaults(panelId, token);
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setVaults(unwrap<VaultInfo[]>(res) ?? []);
  }, [panelId, token]);

  const loadTree = useCallback(async (vaultId: string) => {
    setLoadingNotes(true);
    const res = await serverObsidianApi.tree(panelId, token, vaultId);
    setLoadingNotes(false);
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setNotes(extractNotes(unwrap(res)));
  }, [panelId, token]);

  useEffect(() => {
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
    const res = await serverObsidianApi.search(panelId, token, selected.id, q);
    setSearching(false);
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setSearchHits(unwrap<SearchHit[]>(res) ?? []);
  }, [selected, query, panelId, token]);

  // ── Mutaciones ──────────────────────────────────────────────────────────────
  const doUnregister = useCallback(async () => {
    if (!confirmUnreg) return;
    setConfirmBusy(true);
    try {
    const out = await runServerMutation(panelId, token, () => serverObsidianApi.deleteVault(panelId, token, confirmUnreg.id));
    if (out.ok) {
      showToast(t.toasts.vaultUnregistered);
      if (selected?.id === confirmUnreg.id) closeVault();
      void loadVaults();
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmUnreg(null);
    setConfirmBusy(false);
    } finally { setConfirmBusy(false); }
  }, [confirmUnreg, panelId, token, selected, closeVault, loadVaults, showToast, t.toasts]);

  const doDeleteNote = useCallback(async () => {
    if (!confirmDeleteNote || !selected) return;
    setConfirmBusy(true);
    try {
    const out = await runServerMutation(panelId, token, () => serverObsidianApi.deleteNote(panelId, token, selected.id, confirmDeleteNote));
    if (out.ok) {
      showToast(t.toasts.noteDeleted);
      void loadTree(selected.id);
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmDeleteNote(null);
    setConfirmBusy(false);
    } finally { setConfirmBusy(false); }
  }, [confirmDeleteNote, selected, panelId, token, loadTree, showToast, t.toasts]);

  /** Siembra los ficheros de contexto IA (CLAUDE/AGENTS/GEMINI.md) en el vault.
   *  Sin `overwrite`: si todos existían pide confirmación para sobrescribir. */
  const runAssistantContext = useCallback(
    async (overwrite: boolean) => {
      if (!selected) return;
      setAiCtxBusy(true);
      const res = await callServerApi<AssistantContextResult>(
        panelId,
        token,
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
        showToast(res.error ?? t.toasts.error, true);
        return;
      }
      const data = unwrap<AssistantContextResult>(res) ?? {};
      const written = data.written ?? [];
      const skipped = data.skipped ?? [];
      if (!overwrite && written.length === 0 && skipped.length > 0) {
        setAiCtxSkipped(skipped);
        return;
      }
      setAiCtxSkipped(null);
      if (written.length > 0) {
        showToast(formatMessage(t.assistantContext.toastWritten, { written: written.join(", ") }));
      } else {
        showToast(formatMessage(t.assistantContext.toastNoChanges, { skipped: skipped.join(", ") || "—" }));
      }
    },
    [selected, panelId, token, showToast, t.toasts, t.assistantContext],
  );

  // ── Celdas / columnas ────────────────────────────────────────────────────────
  const StatePill = ({ exists }: { exists: boolean }) => {
    const c = pillColors(tokens, exists ? "ok" : "danger");
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11 }}>{exists ? t.vaults.stateOk : t.vaults.stateMissing}</Text>
      </View>
    );
  };

  const vaultColumns: ServerColumn<VaultInfo>[] = useMemo(
    () => [
      { id: "name", header: t.vaults.colName, cell: (v) => v.name, sortable: true, sortValue: (v) => v.name, width: 160 },
      { id: "path", header: t.vaults.colPath, cell: (v) => v.path, width: 220 },
      { id: "notes", header: t.vaults.colNotes, cell: (v) => (v.noteCount != null ? String(v.noteCount) : "—"), sortable: true, sortValue: (v) => v.noteCount ?? -1, width: 90 },
      { id: "state", header: t.vaults.colState, cell: (v) => <StatePill exists={v.exists !== false} />, width: 110 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );
  const vaultFilters: ServerFilter<VaultInfo>[] = useMemo(
    () => [{ id: "search", kind: "search", placeholder: t.vaults.searchPlaceholder, match: (v, q) => v.name.toLowerCase().includes(q) || v.path.toLowerCase().includes(q) }],
    [t],
  );
  const vaultRowActions: ServerRowAction[] = useMemo(
    () => [
      { id: "open", label: t.vaults.open, icon: <TablerFolder size={18} /> },
      { id: "unregister", label: t.vaults.unregister, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );

  const noteColumns: ServerColumn<NoteItem>[] = useMemo(
    () => [
      { id: "name", header: t.notes.colName, cell: (n) => n.name, sortable: true, sortValue: (n) => n.name, width: 170 },
      { id: "path", header: t.notes.colPath, cell: (n) => n.path, width: 220 },
      { id: "size", header: t.notes.colSize, cell: (n) => fmtBytes(n.sizeBytes), sortable: true, sortValue: (n) => n.sizeBytes ?? 0, width: 90 },
      { id: "modified", header: t.notes.colModified, cell: (n) => fmtDate(n.modifiedAt), sortable: true, sortValue: (n) => n.modifiedAt ?? "", width: 150 },
    ],
    [t],
  );
  const noteFilters: ServerFilter<NoteItem>[] = useMemo(
    () => [{ id: "search", kind: "search", placeholder: t.notes.filterPlaceholder, match: (n, q) => n.path.toLowerCase().includes(q) || n.name.toLowerCase().includes(q) }],
    [t],
  );
  const noteRowActions: ServerRowAction[] = useMemo(
    () => [
      { id: "open", label: t.notes.open, icon: <TablerFile size={18} /> },
      { id: "delete", label: t.notes.delete, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );

  useEffect(()=>{if (!selected && vaults.length) openVault(vaults.find(v=>v.id===prefs.data?.lastVaultId) ?? vaults[0]);},[vaults, selected, prefs.data?.lastVaultId, openVault]);
  useEffect(()=>{if(editor)setPane("editor");},[editor]);
  const settingsPages = [
    {key:"appearance",get label() { return nativeText("Apariencia"); },content:<NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Editor")} readPath="/api/obsidian/preferences" path="/api/obsidian/preferences" method="PATCH" fields={[{key:"editorMode",get label() { return nativeText("Modo del editor"); },options:[{key:"edit",get label() { return nativeText("Editar"); }},{key:"preview",get label() { return nativeText("Vista previa"); }},{key:"split",get label() { return nativeText("Dividido"); }}]},{key:"fontSize",get label() { return nativeText("Tamaño del texto"); },options:[12,14,16,18,20].map(value=>({key:String(value),label:`${value} px`}))}]} toBody={v=>({editorMode:v.editorMode,fontSize:Number(v.fontSize)})} onSaved={()=>void prefs.reload()}/>},
    {key:"shortcuts",get label() { return nativeText("Atajos"); },content:<View style={{gap:12}}><Text style={{color:tokens.textSecondary}}>{nativeText("Guardar · Ctrl/⌘ + S")}</Text><Text style={{color:tokens.textSecondary}}>{nativeText("Buscar · Ctrl/⌘ + K")}</Text></View>},
    {key:"vaults",get label() { return nativeText("Vaults"); },content:<View style={{gap:12}}><Button label={t.newVault} onPress={()=>setVaultOpen(true)}/><ServerDataTable title={t.vaults.title} columns={vaultColumns} rows={vaults} rowKey={v=>v.id} rowActions={vaultRowActions} onRowAction={(id,v)=>id==="open"?openVault(v):setConfirmUnreg(v)}/></View>},
    {key:"ai",get label() { return nativeText("Contexto IA"); },content:<View style={{gap:12}}><Button label={t.aiContext} loading={aiCtxBusy} disabled={!selected} onPress={()=>void runAssistantContext(false)}/><Button label={t.containersButton} variant="secondary" onPress={()=>setContainersOpen(true)}/></View>},
  ];
  return (
    <>
      <ServerModuleScreen
        title={selected ? selected.name : t.pageTitle}
        subtitle={selected ? selected.path : t.subtitle}
        onBack={onBack}
        settingsPages={settingsPages}
        action={{label:t.newNote,onPress:()=>setEditor({mode:"create"})}}
        headerActions={<Button label={t.dailyNote} variant="secondary" size="sm" disabled={!selected} onPress={()=>setDailyOpen(true)}/>}
        guardCode={guardCode}
        onRetry={onRefresh}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <Select value={selected?.id ?? ""} placeholder={nativeText("Seleccionar vault")} options={vaults.map(v=>({value:v.id,label:v.name}))} onChange={id=>{const vault=vaults.find(v=>v.id===id);if(vault){setEditor(null);openVault(vault);}}}/>
        {width < 1024 ? <View style={{flexDirection:"row",gap:8}}><Button label={nativeText("Árbol")} variant={pane==="tree"?"primary":"ghost"} onPress={()=>setPane("tree")}/><Button label={nativeText("Editor")} variant={pane==="editor"?"primary":"ghost"} onPress={()=>setPane("editor")}/></View> : null}
        <ModuleSplitLayout sidebar={<View style={{display:width < 1024 && pane !== "tree"?"none":"flex",gap:10}}><Input value={query} onChangeText={setQuery} placeholder={t.contentSearch.placeholder} onSubmitEditing={runSearch}/><Button label={t.contentSearch.button} loading={searching} onPress={runSearch}/><ScrollView style={{maxHeight:560}}>{(searchHits ?? notes).map((note,index)=><Pressable key={`${note.path}:${index}`} accessibilityRole="button" onPress={()=>setEditor({mode:"edit",path:note.path})} style={{minHeight:44,paddingVertical:8,paddingLeft:Math.min(note.path.split("/").length-1,6)*12,gap:4,backgroundColor:editor?.path===note.path?tokens.brandDim:"transparent"}}><Text style={{color:tokens.textPrimary,fontSize:13}}>▱ {note.path}</Text>{"text" in note?<Text style={{color:tokens.textMuted,fontSize:12}}>{note.text}</Text>:null}</Pressable>)}</ScrollView></View>}>
          <View style={{display:width < 1024 && pane !== "editor"?"none":"flex",gap:12}}>
      {editor && selected ? (
        <NoteEditorDialog embedded editorMode={prefs.data?.editorMode ?? "edit"} fontSize={prefs.data?.fontSize ?? 14}
          key={editor.path ?? "__create__"}
          panelId={panelId}
          token={token}
          vaultId={selected.id}
          mode={editor.mode}
          notePath={editor.path}
          notes={notes}
          onNavigate={(p) => setEditor({ mode: "edit", path: p })}
          onClose={() => setEditor(null)}
          onToast={showToast}
          onSaved={() => {

            void loadTree(selected.id);
          }}
        />
      ) : null}
            {!editor ? <Text style={{color:tokens.textMuted,padding:24}}>{nativeText("Selecciona una nota para editarla.")}</Text> : null}
          </View>
        </ModuleSplitLayout>
      </ServerModuleScreen>

      {vaultOpen ? (
        <VaultDialog
          panelId={panelId}
          token={token}
          onClose={() => setVaultOpen(false)}
          onToast={showToast}
          onSaved={() => {
            setVaultOpen(false);
            void loadVaults();
          }}
        />
      ) : null}
      {dailyOpen && selected ? (
        <DailyNoteDialog
          panelId={panelId}
          token={token}
          vaultId={selected.id}
          onClose={() => setDailyOpen(false)}
          onToast={showToast}
          onSaved={() => {
            setDailyOpen(false);
            void loadTree(selected.id);
          }}
        />
      ) : null}
      {containersOpen ? (
        <ContainersDialog
          panelId={panelId}
          token={token}
          onClose={() => setContainersOpen(false)}
          onToast={showToast}
          onSynced={() => void loadVaults()}
        />
      ) : null}

      {confirmUnreg ? (
        <ConfirmDialog
          visible
          title={t.confirm.unregisterTitle}
          message={formatMessage(t.confirm.unregisterMessage, { name: confirmUnreg.name })}
          confirmLabel={t.confirm.unregisterConfirm}
          cancelLabel={t.confirm.cancel}
          submitting={confirmBusy}
          onConfirm={doUnregister}
          onCancel={() => setConfirmUnreg(null)}
        />
      ) : null}
      {confirmDeleteNote ? (
        <ConfirmDialog
          visible
          title={t.confirm.deleteNoteTitle}
          message={formatMessage(t.confirm.deleteNoteMessage, { path: confirmDeleteNote })}
          confirmLabel={t.confirm.deleteNoteConfirm}
          cancelLabel={t.confirm.cancel}
          submitting={confirmBusy}
          onConfirm={doDeleteNote}
          onCancel={() => setConfirmDeleteNote(null)}
        />
      ) : null}
      {aiCtxSkipped ? (
        <ConfirmDialog
          visible
          danger={false}
          title={t.assistantContext.overwriteTitle}
          message={formatMessage(t.assistantContext.overwriteMessage, { skipped: aiCtxSkipped.join(", ") })}
          confirmLabel={t.assistantContext.overwriteConfirm}
          cancelLabel={t.confirm.cancel}
          submitting={aiCtxBusy}
          onConfirm={() => void runAssistantContext(true)}
          onCancel={() => setAiCtxSkipped(null)}
        />
      ) : null}

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}

// ── Diálogos ───────────────────────────────────────────────────────────────

function VaultDialog({ panelId, token, onClose, onToast, onSaved }: { panelId: string; token: string; onClose: () => void; onToast: (m: string, e?: boolean) => void; onSaved: () => void }) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverObsidian;
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [mode, setMode] = useState<"create" | "register">("create");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const n = name.trim();
    const p = path.trim();
    if (!n || !p) {
      onToast(t.toasts.error, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => serverObsidianApi.createVault(panelId, token, { name: n, path: p, mode }));
    setBusy(false);
    if (out.ok) {
      onToast(t.toasts.vaultCreated);
      onSaved();
    } else throw new Error(out.error ?? t.toasts.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={t.vaultDialog.title} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.vaultDialog.cancel} onSubmit={submit} submitLabel={t.vaultDialog.save} submitting={busy} />}>
      <Field label={t.vaultDialog.labelName}>
        <Input value={name} onChangeText={setName} placeholder={t.vaultDialog.placeholderName} />
      </Field>
      <Field label={t.vaultDialog.labelPath}>
        <Input value={path} onChangeText={setPath} placeholder={t.vaultDialog.placeholderPath} autoCapitalize="none" textAlign="left" />
      </Field>
      <Field label={t.vaultDialog.labelMode} hint={mode === "create" ? t.vaultDialog.modeCreateHint : t.vaultDialog.modeRegisterHint}>
        <Select
          value={mode}
          onChange={(v) => setMode(v === "register" ? "register" : "create")}
          options={[
            { value: "create", label: t.vaultDialog.modeCreate },
            { value: "register", label: t.vaultDialog.modeRegister },
          ]}
        />
      </Field>
    </FormDrawer>
  );
}

function DailyNoteDialog({ panelId, token, vaultId, onClose, onToast, onSaved }: { panelId: string; token: string; vaultId: string; onClose: () => void; onToast: (m: string, e?: boolean) => void; onSaved: () => void }) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverObsidian;
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => serverObsidianApi.dailyNote(panelId, token, vaultId, content, date.trim() || undefined));
    setBusy(false);
    if (out.ok) {
      onToast(t.toasts.dailySaved);
      onSaved();
    } else throw new Error(out.error ?? t.toasts.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={t.dailyDialog.title} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.dailyDialog.cancel} onSubmit={submit} submitLabel={t.dailyDialog.save} submitting={busy} />}>
      <Field label={t.dailyDialog.labelContent}>
        <Input value={content} onChangeText={setContent} placeholder={t.dailyDialog.placeholderContent} multiline textAlign="left" textAlignVertical="top" style={{ minHeight: 90 }} />
      </Field>
      <Field label={t.dailyDialog.labelDate} hint={t.dailyDialog.hintDate}>
        <Input value={date} onChangeText={setDate} placeholder={t.dailyDialog.placeholderDate} autoCapitalize="none" textAlign="left" />
      </Field>
    </FormDrawer>
  );
}

function NoteEditorDialog({ embedded = false, editorMode = "edit", fontSize = 14, panelId, token, vaultId, mode, notePath, notes, onNavigate, onClose, onToast, onSaved }: { embedded?:boolean; editorMode?:"edit"|"preview"|"split";fontSize?:number; panelId: string; token: string; vaultId: string; mode: "edit" | "create"; notePath?: string; notes: NoteItem[]; onNavigate: (path: string) => void; onClose: () => void; onToast: (m: string, e?: boolean) => void; onSaved: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverObsidian;
  const [path, setPath] = useState(notePath ?? "");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [busy, setBusy] = useState(false);

  // ── Panel de enlaces (wikilinks salientes + backlinks entrantes) ──
  const [linksOpen, setLinksOpen] = useState(false);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksErr, setLinksErr] = useState<string | null>(null);
  const [links, setLinks] = useState<NoteLinks | null>(null);

  const toggleLinks = async () => {
    const next = !linksOpen;
    setLinksOpen(next);
    if (next && !links && !linksLoading && notePath) {
      setLinksLoading(true);
      setLinksErr(null);
      const res = await callServerApi<NoteLinks>(panelId, token, "GET", `/api/obsidian/vaults/${enc(vaultId)}/links?path=${enc(notePath)}`);
      setLinksLoading(false);
      if (!res.ok) {
        setLinksErr(res.error ?? t.links.error);
        return;
      }
      setLinks(unwrap<NoteLinks>(res) ?? { outgoing: [], backlinks: [] });
    }
  };

  /** Resuelve un `[[wikilink]]` saliente a una nota del árbol y navega a ella. */
  const navigateWikilink = (target: string) => {
    const clean = ((target.split("|")[0] ?? "").split("#")[0] ?? "").trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    const note =
      notes.find((n) => n.path.toLowerCase() === lower || n.path.toLowerCase() === `${lower}.md`) ??
      notes.find((n) => n.name.replace(/\.(md|canvas)$/i, "").toLowerCase() === lower);
    if (!note) {
      onToast(formatMessage(t.links.notFound, { name: clean }), true);
      return;
    }
    onNavigate(note.path);
  };

  useEffect(() => {
    if (mode !== "edit" || !notePath) return;
    let alive = true;
    void (async () => {
      const res = await serverObsidianApi.readNote(panelId, token, vaultId, notePath);
      if (!alive) return;
      const payload = unwrap<{ path?: string; content?: string }>(res);
      setContent(payload?.content ?? "");
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [mode, notePath, panelId, token, vaultId]);

  const submit = async () => {
    const rel = path.trim();
    if (!rel) {
      onToast(t.toasts.error, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => serverObsidianApi.writeNote(panelId, token, vaultId, rel, content));
    setBusy(false);
    if (out.ok) {
      onToast(t.toasts.noteSaved);
      onSaved();
    } else throw new Error(out.error ?? t.toasts.error);
  };

  const title = mode === "create" ? t.editor.createTitle : notePath ?? t.editor.createTitle;
  return (
    <View style={{gap:12}}><Text style={{color:tokens.textPrimary,fontWeight:"700"}}>{title}</Text><DialogFooter onCancel={onClose} cancelLabel={t.editor.cancel} onSubmit={submit} submitLabel={t.editor.save} submitting={busy} disabled={loading} />
      {mode === "create" ? (
        <Field label={t.editor.labelPath}>
          <Input value={path} onChangeText={setPath} placeholder={t.editor.placeholderPath} autoCapitalize="none" textAlign="left" />
        </Field>
      ) : null}
      {mode === "edit" && notePath ? (
        <View style={{ marginBottom: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-start" }}>
            <Button label={t.links.button} variant="secondary" size="sm" icon={<IconLink size={16} />} onPress={() => void toggleLinks()} />
          </View>
          {linksOpen ? (
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, overflow: "hidden" }}>
              {linksLoading ? (
                <ModuleLoading label={t.links.loading} />
              ) : linksErr ? (
                <Text style={{ color: tokens.danger, fontSize: 12, padding: 12 }}>{linksErr}</Text>
              ) : (
                <View style={{ padding: 12, gap: 12 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{t.links.outgoing}</Text>
                    {(links?.outgoing ?? []).length === 0 ? (
                      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.links.noOutgoing}</Text>
                    ) : (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {(links?.outgoing ?? []).map((target, i) => (
                          <Pressable
                            key={`${target}:${i}`}
                            onPress={() => navigateWikilink(target)}
                            style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgPrimary, paddingHorizontal: 8, paddingVertical: 4 }}
                          >
                            <IconArrowUpRight size={13} color={tokens.textMuted} />
                            <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{target}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: tokens.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{t.links.backlinks}</Text>
                    {(links?.backlinks ?? []).length === 0 ? (
                      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.links.noBacklinks}</Text>
                    ) : (
                      (links?.backlinks ?? []).map((b, i) => (
                        <Pressable
                          key={`${b.path}:${b.line ?? 0}:${i}`}
                          onPress={() => onNavigate(b.path)}
                          style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6 }}
                        >
                          <IconArrowBackUp size={13} color={tokens.textMuted} />
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 12, fontWeight: "600" }}>
                              {b.path}{b.line != null ? `:${b.line}` : ""}
                            </Text>
                            {b.text ? <Text numberOfLines={2} style={{ color: tokens.textMuted, fontSize: 11 }}>{b.text}</Text> : null}
                          </View>
                        </Pressable>
                      ))
                    )}
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
      <Field label={t.editor.labelContent}>
        {loading ? (
          <ModuleLoading label={t.editor.loading} />
        ) : (
          <View style={{gap:12}}>{editorMode !== "preview" ? <Input value={content} onChangeText={setContent} multiline textAlign="left" textAlignVertical="top" style={{minHeight:360,fontSize,fontFamily:"monospace"}}/> : null}{editorMode !== "edit" ? <MarkdownView text={content} tokens={tokens} fontSize={fontSize} copyLabel={nativeText("Copiar")} copiedLabel={nativeText("Copiado")}/> : null}</View>
        )}
      </Field>
    </View>
  );
}

/**
 * ContainersDialog — lista los CONTENEDORES de contexto (un vault por repo Git /
 * proyecto del asistente / chat suelto) y permite SINCRONIZARLOS (backfill
 * idempotente). Réplica del `obs-sync-containers` del web, más la lista que el
 * web no muestra (el toolbar solo sincronizaba). Reusa la primitiva genérica
 * `callServerApi` porque el wrapper `serverObsidianApi` no cubre estas rutas.
 */
function ContainersDialog({ panelId, token, onClose, onToast, onSynced }: { panelId: string; token: string; onClose: () => void; onToast: (m: string, e?: boolean) => void; onSynced: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverObsidian;
  const [items, setItems] = useState<ContainerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await callServerApi<ContainerItem[]>(panelId, token, "GET", "/api/obsidian/containers");
    setLoading(false);
    setItems(unwrap<ContainerItem[]>(res) ?? []);
  }, [panelId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const doSync = async () => {
    setSyncing(true);
    const res = await callServerApi<ContainerSyncSummary>(panelId, token, "POST", "/api/obsidian/containers/sync", {});
    setSyncing(false);
    if (res.code && GUARDS.includes(res.code)) {
      onToast(t.containers.error, true);
      return;
    }
    if (!res.ok) {
      onToast(res.error ?? t.containers.error, true);
      return;
    }
    const d = unwrap<ContainerSyncSummary>(res);
    if (d && typeof d.created === "number") {
      onToast(
        formatMessage(t.containers.toastSynced, {
          created: d.created ?? 0,
          existing: d.existing ?? 0,
          repos: d.repos ?? 0,
          projects: d.projects ?? 0,
          chats: d.chats ?? 0,
        }),
      );
    } else {
      onToast(t.containers.toastBasic);
    }
    await load();
    onSynced();
  };

  const kindLabel = (k?: string): string =>
    k === "repo" ? t.containers.kindRepo : k === "project" ? t.containers.kindProject : k === "chat" ? t.containers.kindChat : k ?? "—";
  const kindTone = (k?: string): "primary" | "sky" | "neutral" => (k === "repo" ? "primary" : k === "project" ? "sky" : "neutral");

  return (
    <Modal
      visible
      onClose={onClose}
      title={t.containers.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.containers.close} onSubmit={doSync} submitLabel={t.containers.sync} submitting={syncing} />}
    >
      <Text style={{ color: tokens.textMuted, fontSize: 12, marginBottom: 12 }}>{t.containers.subtitle}</Text>
      {loading ? (
        <ModuleLoading label={t.containers.loading} />
      ) : items.length === 0 ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.containers.empty}</Text>
      ) : (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, overflow: "hidden" }}>
          {items.map((c, i) => {
            const pc = pillColors(tokens, kindTone(c.kind));
            return (
              <View
                key={c.id ?? c.path ?? String(i)}
                style={{ padding: 12, gap: 4, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: tokens.border }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }}>{c.name ?? "—"}</Text>
                  <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: pc.bg, borderColor: pc.border }}>
                    <Text style={{ color: pc.text, fontSize: 11 }}>{kindLabel(c.kind)}</Text>
                  </View>
                </View>
                {c.path ? <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{c.path}</Text> : null}
              </View>
            );
          })}
        </View>
      )}
    </Modal>
  );
}
