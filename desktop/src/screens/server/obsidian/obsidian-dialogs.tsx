/**
 * obsidian-dialogs — diálogos modales del módulo Obsidian de desktop
 * (shell `lp-modal-*` + VaultDialog / DailyNoteDialog / NoteEditorDialog /
 * ContainersDialog). Extraídos de `ObsidianModule.tsx` (split conservador,
 * sin cambios de forma): todos reciben su estado por props, sin closures del
 * componente padre.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, CornerUpLeft, Link2, X } from "lucide-react";
import { useToast } from "../../../components/ToastProvider";
import { callServerApi, serverObsidianApi, unwrap } from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ContainerItem, ContainerSyncSummary, NoteItem, NoteLinks } from "./obsidian-types";
import { GUARDS, enc, runServerMutation } from "./obsidian-helpers";

// ── Modal shell (lp-modal-*) ─────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  cancelLabel,
  onSubmit,
  submitLabel,
  submitting,
  submitDisabled,
  maxWidth = "max-w-lg",
  fillHeight = false,
  children,
}: {
  title: string;
  onClose: () => void;
  cancelLabel: string;
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  maxWidth?: string;
  fillHeight?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
      <div
        className={`lp-modal-card flex w-full flex-col ${maxWidth} ${fillHeight ? "h-[calc(100%-2rem)] max-h-full" : "max-h-full"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={cancelLabel}>
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body flex flex-col gap-3">{children}</div>
        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          {onSubmit && submitLabel ? (
            <button
              type="button"
              className="lp-modal-btn lp-modal-btn--primary"
              onClick={onSubmit}
              disabled={submitting || submitDisabled}
            >
              {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
              {submitLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-medium text-base-content/70">{children}</span>;
}

// ── Diálogos ─────────────────────────────────────────────────────────────────

export function VaultDialog({
  serverId,
  language,
  onClose,
  onSaved,
}: {
  serverId: string;
  language?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = getMessages(language).serverObsidian;
  const toast = useToast();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [mode, setMode] = useState<"create" | "register">("create");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = name.trim();
    const p = path.trim();
    if (!n || !p) {
      toast.error(t.toasts.error);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(serverId, () => serverObsidianApi.createVault(serverId, "", { name: n, path: p, mode }));
    setBusy(false);
    if (out.ok) {
      toast.success(t.toasts.vaultCreated);
      onSaved();
    } else toast.error(out.error ?? t.toasts.error);
  };

  return (
    <ModalShell
      title={t.vaultDialog.title}
      onClose={onClose}
      cancelLabel={t.vaultDialog.cancel}
      onSubmit={() => void submit()}
      submitLabel={t.vaultDialog.save}
      submitting={busy}
    >
      <label className="flex flex-col gap-1">
        <FieldLabel>{t.vaultDialog.labelName}</FieldLabel>
        <input className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.vaultDialog.placeholderName} autoFocus />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>{t.vaultDialog.labelPath}</FieldLabel>
        <input className="input input-bordered w-full font-mono text-sm" value={path} onChange={(e) => setPath(e.target.value)} placeholder={t.vaultDialog.placeholderPath} />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>{t.vaultDialog.labelMode}</FieldLabel>
        <select className="select select-bordered w-full" value={mode} onChange={(e) => setMode(e.target.value === "register" ? "register" : "create")}>
          <option value="create">{t.vaultDialog.modeCreate}</option>
          <option value="register">{t.vaultDialog.modeRegister}</option>
        </select>
        <span className="text-[11px] text-base-content/50">{mode === "create" ? t.vaultDialog.modeCreateHint : t.vaultDialog.modeRegisterHint}</span>
      </label>
    </ModalShell>
  );
}

export function DailyNoteDialog({
  serverId,
  language,
  vaultId,
  onClose,
  onSaved,
}: {
  serverId: string;
  language?: string;
  vaultId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = getMessages(language).serverObsidian;
  const toast = useToast();
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(serverId, () => serverObsidianApi.dailyNote(serverId, "", vaultId, content, date.trim() || undefined));
    setBusy(false);
    if (out.ok) {
      toast.success(t.toasts.dailySaved);
      onSaved();
    } else toast.error(out.error ?? t.toasts.error);
  };

  return (
    <ModalShell
      title={t.dailyDialog.title}
      onClose={onClose}
      cancelLabel={t.dailyDialog.cancel}
      onSubmit={() => void submit()}
      submitLabel={t.dailyDialog.save}
      submitting={busy}
    >
      <label className="flex flex-col gap-1">
        <FieldLabel>{t.dailyDialog.labelContent}</FieldLabel>
        <textarea
          className="textarea textarea-bordered w-full"
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t.dailyDialog.placeholderContent}
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>{t.dailyDialog.labelDate}</FieldLabel>
        <input className="input input-bordered w-full font-mono text-sm" value={date} onChange={(e) => setDate(e.target.value)} placeholder={t.dailyDialog.placeholderDate} />
        <span className="text-[11px] text-base-content/50">{t.dailyDialog.hintDate}</span>
      </label>
    </ModalShell>
  );
}

export function NoteEditorDialog({
  serverId,
  language,
  vaultId,
  mode,
  notePath,
  notes,
  onNavigate,
  onClose,
  onSaved,
}: {
  serverId: string;
  language?: string;
  vaultId: string;
  mode: "edit" | "create";
  notePath?: string;
  notes: NoteItem[];
  onNavigate: (path: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = getMessages(language).serverObsidian;
  const toast = useToast();
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
      const res = await callServerApi<NoteLinks>(serverId, "", "GET", `/api/obsidian/vaults/${enc(vaultId)}/links?path=${enc(notePath)}`);
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
      toast.error(formatMessage(t.links.notFound, { name: clean }));
      return;
    }
    onNavigate(note.path);
  };

  useEffect(() => {
    if (mode !== "edit" || !notePath) return;
    let alive = true;
    void (async () => {
      const res = await serverObsidianApi.readNote(serverId, "", vaultId, notePath);
      if (!alive) return;
      const payload = unwrap<{ path?: string; content?: string }>(res);
      setContent(payload?.content ?? "");
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [mode, notePath, serverId, vaultId]);

  const submit = async () => {
    const rel = path.trim();
    if (!rel) {
      toast.error(t.toasts.error);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(serverId, () => serverObsidianApi.writeNote(serverId, "", vaultId, rel, content));
    setBusy(false);
    if (out.ok) {
      toast.success(t.toasts.noteSaved);
      onSaved();
    } else toast.error(out.error ?? t.toasts.error);
  };

  const title = mode === "create" ? t.editor.createTitle : notePath ?? t.editor.createTitle;

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      cancelLabel={t.editor.cancel}
      onSubmit={() => void submit()}
      submitLabel={t.editor.save}
      submitting={busy}
      submitDisabled={loading}
      maxWidth="max-w-3xl"
      fillHeight
    >
      {mode === "create" ? (
        <label className="flex flex-col gap-1">
          <FieldLabel>{t.editor.labelPath}</FieldLabel>
          <input className="input input-bordered w-full font-mono text-sm" value={path} onChange={(e) => setPath(e.target.value)} placeholder={t.editor.placeholderPath} autoFocus />
        </label>
      ) : null}

      {mode === "edit" && notePath ? (
        <div className="flex flex-col gap-2">
          <div>
            <button type="button" className="btn btn-xs btn-outline gap-1.5" onClick={() => void toggleLinks()}>
              <Link2 size={13} /> {t.links.button}
            </button>
          </div>
          {linksOpen ? (
            <div className="overflow-hidden rounded-lg border border-base-300 bg-base-200/40">
              {linksLoading ? (
                <p className="p-3 text-xs text-base-content/50">{t.links.loading}</p>
              ) : linksErr ? (
                <p className="p-3 text-xs text-error">{linksErr}</p>
              ) : (
                <div className="flex flex-col gap-3 p-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase text-base-content/50">{t.links.outgoing}</span>
                    {(links?.outgoing ?? []).length === 0 ? (
                      <span className="text-xs text-base-content/50">{t.links.noOutgoing}</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(links?.outgoing ?? []).map((target, i) => (
                          <button
                            key={`${target}:${i}`}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-base-300 bg-base-100 px-2 py-1 text-xs hover:bg-base-200"
                            onClick={() => navigateWikilink(target)}
                          >
                            <ArrowUpRight size={12} className="text-base-content/50" />
                            {target}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase text-base-content/50">{t.links.backlinks}</span>
                    {(links?.backlinks ?? []).length === 0 ? (
                      <span className="text-xs text-base-content/50">{t.links.noBacklinks}</span>
                    ) : (
                      (links?.backlinks ?? []).map((b, i) => (
                        <button
                          key={`${b.path}:${b.line ?? 0}:${i}`}
                          type="button"
                          className="flex items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-base-200"
                          onClick={() => onNavigate(b.path)}
                        >
                          <CornerUpLeft size={13} className="mt-0.5 shrink-0 text-base-content/50" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold">
                              {b.path}
                              {b.line != null ? `:${b.line}` : ""}
                            </span>
                            {b.text ? <span className="line-clamp-2 text-[11px] text-base-content/50">{b.text}</span> : null}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="flex min-h-0 flex-1 flex-col gap-1">
        <FieldLabel>{t.editor.labelContent}</FieldLabel>
        {loading ? (
          <p className="text-sm text-base-content/50">{t.editor.loading}</p>
        ) : (
          <textarea
            className="textarea textarea-bordered min-h-[280px] w-full flex-1 font-mono text-sm leading-relaxed"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}
      </label>
    </ModalShell>
  );
}

/**
 * ContainersDialog — lista los CONTENEDORES de contexto (un vault por repo Git /
 * proyecto del asistente / chat suelto) y permite SINCRONIZARLOS (backfill
 * idempotente). Reusa la primitiva genérica `callServerApi` porque el wrapper
 * `serverObsidianApi` no cubre estas rutas.
 */
export function ContainersDialog({
  serverId,
  language,
  onClose,
  onSynced,
}: {
  serverId: string;
  language?: string;
  onClose: () => void;
  onSynced: () => void;
}) {
  const t = getMessages(language).serverObsidian;
  const toast = useToast();
  const [items, setItems] = useState<ContainerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await callServerApi<ContainerItem[]>(serverId, "", "GET", "/api/obsidian/containers");
    setLoading(false);
    setItems(unwrap<ContainerItem[]>(res) ?? []);
  }, [serverId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    void load();
  }, [load]);

  const doSync = async () => {
    setSyncing(true);
    const res = await callServerApi<ContainerSyncSummary>(serverId, "", "POST", "/api/obsidian/containers/sync", {});
    setSyncing(false);
    if (res.code && GUARDS.includes(res.code)) {
      toast.error(t.containers.error);
      return;
    }
    if (!res.ok) {
      toast.error(res.error ?? t.containers.error);
      return;
    }
    const d = unwrap<ContainerSyncSummary>(res);
    if (d && typeof d.created === "number") {
      toast.success(
        formatMessage(t.containers.toastSynced, {
          created: d.created ?? 0,
          existing: d.existing ?? 0,
          repos: d.repos ?? 0,
          projects: d.projects ?? 0,
          chats: d.chats ?? 0,
        }),
      );
    } else {
      toast.success(t.containers.toastBasic);
    }
    await load();
    onSynced();
  };

  const kindLabel = (k?: string): string =>
    k === "repo" ? t.containers.kindRepo : k === "project" ? t.containers.kindProject : k === "chat" ? t.containers.kindChat : k ?? "—";
  const kindClass = (k?: string): string =>
    k === "repo"
      ? "border-primary/30 bg-primary/10 text-primary"
      : k === "project"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : "border-base-300 bg-base-200 text-base-content/60";

  return (
    <ModalShell
      title={t.containers.title}
      onClose={onClose}
      cancelLabel={t.containers.close}
      onSubmit={() => void doSync()}
      submitLabel={t.containers.sync}
      submitting={syncing}
    >
      <p className="text-xs text-base-content/60">{t.containers.subtitle}</p>
      {loading ? (
        <p className="text-sm text-base-content/50">{t.containers.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-base-content/50">{t.containers.empty}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
          {items.map((cItem, i) => (
            <div key={cItem.id ?? cItem.path ?? String(i)} className={`flex flex-col gap-1 p-3 ${i < items.length - 1 ? "border-b border-base-300" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{cItem.name ?? "—"}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${kindClass(cItem.kind)}`}>{kindLabel(cItem.kind)}</span>
              </div>
              {cItem.path ? <span className="truncate font-mono text-[11px] text-base-content/50">{cItem.path}</span> : null}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
