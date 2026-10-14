/**
 * files-dialogs — diálogos del módulo Archivos (desktop), port React DOM del
 * gemelo nativo de `app/` sin cambio de comportamiento: operaciones avanzadas
 * (copiar/chmod/chown/comprimir/extraer), privacidad de directorio (.htpasswd),
 * enlaces de compartir y visor de contenido de comprimidos. Estilos
 * Tailwind + daisyUI + `lp-modal-*`; iconos lucide-react.
 */
import { useCallback, useEffect, useState } from "react";
import { Copy, Share2, ShieldCheck, Trash2, File as FileIcon } from "lucide-react";
import { getMessages, formatMessage } from "../../../i18n";
import { useConfirm } from "../../../components/ConfirmDialog";
import { unwrap } from "../../../api/serverApi";
import { Modal, Field, DialogFooter, InfoBox, Pill, LoadingRow, api, runServerMutation } from "./files-ui";
import {
  type Entry,
  type OpKind,
  type PrivacyStatus,
  type Recommend,
  type ShareItem,
  type ShareRoot,
  extForFormat,
  parentOf,
  stripArchiveExt,
} from "./files-types";

// ── Diálogo de operaciones (copiar / chmod / chown / comprimir / extraer) ────
export function OpDialog({
  serverId,
  language,
  kind,
  entry,
  onClose,
  onDone,
  onError,
}: {
  serverId: string;
  language?: string;
  kind: OpKind;
  entry: Entry;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);

  const [busy, setBusy] = useState(false);
  const [dest, setDest] = useState(entry.path); // copy
  const [mode, setMode] = useState(""); // chmod
  const [rec, setRec] = useState<Recommend | null>(null);
  const [recLoading, setRecLoading] = useState(kind === "chmod");
  const [owner, setOwner] = useState(""); // chown
  const [group, setGroup] = useState("");
  const [format, setFormat] = useState("tar.gz"); // compress
  const [archiveDest, setArchiveDest] = useState(entry.path + ".tar.gz");
  const [extractDest, setExtractDest] = useState(parentOf(entry.path)); // extract

  useEffect(() => {
    if (kind !== "chmod") return;
    let alive = true;
    setRecLoading(true);
    void a
      .get<Recommend>(`/api/files/permissions/recommend?path=${encodeURIComponent(entry.path)}`)
      .then((res) => {
        if (!alive) return;
        const d = unwrap<Recommend>(res);
        if (d) {
          setRec(d);
          setMode((cur) => cur || d.mode || "");
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setRecLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, serverId, entry.path]);

  const setFmt = (f: string) => {
    setFormat(f);
    setArchiveDest((cur) => stripArchiveExt(cur) + extForFormat(f));
  };

  const title =
    kind === "copy" ? t.ops.copyTitle : kind === "chmod" ? t.ops.chmodTitle : kind === "chown" ? t.ops.chownTitle : kind === "compress" ? t.ops.compressTitle : t.ops.extractTitle;

  const submit = async () => {
    let op: (() => ReturnType<typeof a.post>) | null = null;
    let okMsg = "";
    if (kind === "copy") {
      const to = dest.trim();
      if (!to || to === entry.path) return;
      op = () => a.post("/api/files/copy", { from: entry.path, to });
      okMsg = t.ops.copied;
    } else if (kind === "chmod") {
      const m = mode.trim();
      if (!/^[0-7]{3,4}$/.test(m)) {
        onError(t.ops.chmodInvalid);
        return;
      }
      op = () => a.put("/api/files/chmod", { path: entry.path, mode: m });
      okMsg = t.ops.chmodChanged;
    } else if (kind === "chown") {
      const o = owner.trim();
      if (!o) return;
      const g = group.trim();
      op = () => a.put("/api/files/chown", { path: entry.path, owner: o, ...(g ? { group: g } : {}) });
      okMsg = t.ops.chownChanged;
    } else if (kind === "compress") {
      const d = archiveDest.trim();
      if (!d) return;
      op = () => a.post("/api/files/compress", { sources: [entry.path], dest: d, format });
      okMsg = t.ops.compressed;
    } else {
      const d = extractDest.trim();
      if (!d) return;
      op = () => a.post("/api/files/extract", { archive: entry.path, destDir: d });
      okMsg = t.ops.extracted;
    }
    if (!op) return;
    setBusy(true);
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onDone(okMsg);
    else onError(out.error ?? t.toasts.error);
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.ops.cancel} onSubmit={submit} submitLabel={t.ops.save} submitting={busy} />}
    >
      <p className="truncate text-xs text-base-content/50">{entry.path}</p>

      {kind === "copy" ? (
        <Field label={t.ops.copyLabel} hint={t.ops.copyHint}>
          <input className="lp-modal-input" value={dest} onChange={(e) => setDest(e.target.value)} autoCapitalize="none" spellCheck={false} />
        </Field>
      ) : null}

      {kind === "chmod" ? (
        <>
          {recLoading ? (
            <LoadingRow label={t.privacy.loading} />
          ) : rec ? (
            <InfoBox tone={rec.level === "danger" ? "danger" : rec.level === "warning" ? "warn" : "info"}>
              <div className="flex flex-col gap-1">
                <span>{formatMessage(t.ops.chmodCurrent, { mode: rec.mode ?? "—" })}</span>
                <span>{formatMessage(t.ops.chmodRecommended, { mode: rec.recommended ?? "—" })}</span>
                {(rec.reasons ?? []).slice(0, 3).map((r, i) => (
                  <span key={i} className="text-[11px] opacity-80">• {r}</span>
                ))}
                {rec.recommended ? (
                  <button type="button" className="mt-1 self-start text-xs font-semibold text-primary hover:underline" onClick={() => setMode(rec.recommended ?? "")}>
                    {t.ops.chmodUseRecommended}
                  </button>
                ) : null}
              </div>
            </InfoBox>
          ) : null}
          <Field label={t.ops.chmodLabel}>
            <input className="lp-modal-input" value={mode} onChange={(e) => setMode(e.target.value)} placeholder={t.ops.chmodPlaceholder} inputMode="numeric" />
          </Field>
        </>
      ) : null}

      {kind === "chown" ? (
        <>
          <Field label={t.ops.chownOwner}>
            <input className="lp-modal-input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="www-data" spellCheck={false} />
          </Field>
          <Field label={t.ops.chownGroup}>
            <input className="lp-modal-input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="www-data" spellCheck={false} />
          </Field>
        </>
      ) : null}

      {kind === "compress" ? (
        <>
          <Field label={t.ops.compressFormat}>
            <select className="lp-modal-select" value={format} onChange={(e) => setFmt(e.target.value)}>
              <option value="tar.gz">tar.gz</option>
              <option value="tar.bz2">tar.bz2</option>
              <option value="zip">zip</option>
            </select>
          </Field>
          <Field label={t.ops.compressDest}>
            <input className="lp-modal-input" value={archiveDest} onChange={(e) => setArchiveDest(e.target.value)} spellCheck={false} />
          </Field>
        </>
      ) : null}

      {kind === "extract" ? (
        <Field label={t.ops.extractDest}>
          <input className="lp-modal-input" value={extractDest} onChange={(e) => setExtractDest(e.target.value)} spellCheck={false} />
        </Field>
      ) : null}
    </Modal>
  );
}

// ── Privacidad de directorio (.htpasswd) ─────────────────────────────────────
export function PrivacyDialog({
  serverId,
  language,
  dir,
  onClose,
  onToast,
}: {
  serverId: string;
  language?: string;
  dir: string;
  onClose: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);
  const { confirm, dialog } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [realm, setRealm] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const res = await api(serverId).get<PrivacyStatus>(`/api/files/privacy?path=${encodeURIComponent(dir)}`);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error ?? t.toasts.error);
      setStatus(null);
      return;
    }
    setStatus(unwrap<PrivacyStatus>(res) ?? null);
  }, [serverId, dir, t.toasts.error]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const protect = async () => {
    const u = username.trim();
    if (!u || !password) return;
    setBusy(true);
    const r = realm.trim();
    const out = await runServerMutation(serverId, () =>
      a.post("/api/files/privacy/protect", { path: dir, username: u, password, ...(r ? { realm: r } : {}) }),
    );
    setBusy(false);
    if (out.ok) {
      onToast(t.privacy.savedToast);
      setUsername("");
      setPassword("");
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
  };

  const unprotect = async () => {
    const ok = await confirm({ title: t.privacy.unprotectTitle, message: t.privacy.unprotectMessage, confirmLabel: t.privacy.confirmUnprotect, cancelLabel: t.privacy.cancel, danger: true });
    if (!ok) return;
    const out = await runServerMutation(serverId, () => a.post("/api/files/privacy/unprotect", { path: dir }));
    if (out.ok) {
      onToast(t.privacy.unprotectedToast);
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
  };

  const removeUser = async (name: string) => {
    const ok = await confirm({ title: t.privacy.removeUserTitle, message: formatMessage(t.privacy.removeUserMessage, { name }), confirmLabel: t.privacy.confirmRemove, cancelLabel: t.privacy.cancel, danger: true });
    if (!ok) return;
    const out = await runServerMutation(serverId, () => a.post("/api/files/privacy/user/remove", { path: dir, username: name }));
    if (out.ok) {
      onToast(t.privacy.removedUserToast);
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
  };

  const isProt = !!status?.protected;
  const users = status?.users ?? [];
  const enforced = !!status?.enforcement?.enforced;

  return (
    <Modal title={t.privacy.title} onClose={onClose} width="md" fillHeight footer={<button type="button" className="lp-modal-btn lp-modal-btn--ghost w-full" onClick={onClose}>{t.privacy.close}</button>}>
      <p className="text-xs text-base-content/60">{t.privacy.subtitle}</p>
      <p className="truncate text-[11px] text-base-content/50">{dir}</p>
      {loading ? (
        <LoadingRow label={t.privacy.loading} />
      ) : err ? (
        <p className="text-sm text-error">{err}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill kind={isProt ? "ok" : "neutral"} label={isProt ? t.privacy.statusProtected : t.privacy.unprotected} />
          </div>
          {isProt ? <p className={`text-[11px] ${enforced ? "text-success" : "text-warning"}`}>{enforced ? t.privacy.enforcedOn : t.privacy.enforcedOff}</p> : null}

          {isProt ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-base-content/60">{t.privacy.usersTitle}</span>
              {users.length === 0 ? (
                <p className="text-sm text-base-content/50">{t.privacy.noUsers}</p>
              ) : (
                <div className="rounded-lg border border-base-300">
                  {users.map((u, i) => (
                    <div key={u} className={`flex items-center gap-2 px-2.5 py-2 ${i === 0 ? "" : "border-t border-base-300"}`}>
                      <span className="min-w-0 flex-1 truncate text-sm">{u}</span>
                      <button type="button" className="text-error hover:opacity-70" aria-label={t.privacy.confirmRemove} onClick={() => void removeUser(u)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-base-content/60">{t.privacy.addUserTitle}</span>
            <Field label={t.privacy.username}>
              <input className="lp-modal-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user" spellCheck={false} />
            </Field>
            <Field label={t.privacy.password}>
              <input className="lp-modal-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label={t.privacy.realmLabel}>
              <input className="lp-modal-input" value={realm} onChange={(e) => setRealm(e.target.value)} placeholder={t.privacy.realmPlaceholder} />
            </Field>
            <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void protect()} disabled={busy || !username.trim() || !password}>
              {busy ? <span className="loading loading-spinner loading-xs" /> : <ShieldCheck size={16} />}
              {t.privacy.add}
            </button>
          </div>

          {isProt ? (
            <button type="button" className="lp-modal-btn lp-modal-btn--danger" onClick={() => void unprotect()}>
              {t.privacy.unprotect}
            </button>
          ) : null}
        </div>
      )}
      {dialog}
    </Modal>
  );
}

// ── Enlaces de compartir ─────────────────────────────────────────────────────
export function ShareDialog({
  serverId,
  language,
  seedPath,
  onClose,
  onToast,
}: {
  serverId: string;
  language?: string;
  seedPath: string;
  onClose: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);
  const { confirm, dialog } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShareItem[]>([]);
  const [roots, setRoots] = useState<ShareRoot[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filePath, setFilePath] = useState(seedPath);
  const [root, setRoot] = useState("");
  const [expires, setExpires] = useState("60");
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("0");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const cli = api(serverId);
    const [li, ro] = await Promise.all([cli.get<ShareItem[]>("/api/files/share"), cli.get<ShareRoot[]>("/api/files/share/roots")]);
    setLoading(false);
    if (!li.ok && !ro.ok) setErr(li.error ?? t.toasts.error);
    const list = unwrap<ShareItem[]>(li);
    setItems(Array.isArray(list) ? list : []);
    const rs = unwrap<ShareRoot[]>(ro);
    const arr = Array.isArray(rs) ? rs : [];
    setRoots(arr);
    setRoot((cur) => cur || arr[0]?.root || "");
  }, [serverId, t.toasts.error]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async () => {
    const p = filePath.trim();
    if (!p || !root) return;
    setBusy(true);
    const body = {
      path: p,
      root,
      expiresInMin: Math.max(1, Number(expires) || 60),
      ...(password ? { password } : {}),
      maxDownloads: Math.max(0, Number(maxDownloads) || 0),
    };
    const out = await runServerMutation(serverId, () => a.post("/api/files/share", body));
    setBusy(false);
    if (out.ok) {
      onToast(t.share.created);
      setPassword("");
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
  };

  const revoke = async (item: ShareItem) => {
    const ok = await confirm({ title: t.share.revokeTitle, message: t.share.revokeMessage, confirmLabel: t.share.confirmRevoke, cancelLabel: t.share.cancel, danger: true });
    if (!ok) return;
    const out = await runServerMutation(serverId, () => a.post(`/api/files/share/${encodeURIComponent(item.id)}/revoke`));
    if (out.ok) {
      onToast(t.share.revokedToast);
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
  };

  const copyUrl = async (url?: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      onToast(t.share.urlCopied);
    } catch {
      onToast(t.toasts.error, true);
    }
  };

  const fmtWhen = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <Modal title={t.share.title} onClose={onClose} width="md" fillHeight footer={<button type="button" className="lp-modal-btn lp-modal-btn--ghost w-full" onClick={onClose}>{t.share.close}</button>}>
      <p className="text-xs text-base-content/60">{t.share.subtitle}</p>

      <div className="flex flex-col gap-2 rounded-xl border border-base-300 p-3">
        <span className="text-sm font-semibold">{t.share.createTitle}</span>
        {!loading && roots.length === 0 ? <InfoBox tone="warn">{t.share.noRoots}</InfoBox> : null}
        <Field label={t.share.labelPath}>
          <input className="lp-modal-input" value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder={t.share.pathPlaceholder} spellCheck={false} />
        </Field>
        <Field label={t.share.labelRoot}>
          <select className="lp-modal-select" value={root} onChange={(e) => setRoot(e.target.value)}>
            <option value="" disabled>
              {t.share.rootPlaceholder}
            </option>
            {roots.map((r) => (
              <option key={r.root} value={r.root}>
                {r.domain}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2.5">
          <div className="flex-1">
            <Field label={t.share.labelExpires}>
              <input className="lp-modal-input" value={expires} onChange={(e) => setExpires(e.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <div className="flex-1">
            <Field label={t.share.labelMaxDownloads}>
              <input className="lp-modal-input" value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value)} inputMode="numeric" />
            </Field>
          </div>
        </div>
        <Field label={t.share.labelPassword}>
          <input className="lp-modal-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void create()} disabled={busy || !filePath.trim() || !root}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : <Share2 size={16} />}
          {t.share.create}
        </button>
      </div>

      {loading ? (
        <LoadingRow label={t.share.loading} />
      ) : err ? (
        <p className="text-sm text-error">{err}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-base-content/50">{t.share.empty}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((s) => {
            const revoked = !!s.revoked;
            return (
              <div key={s.id} className={`flex flex-col gap-1.5 rounded-xl border border-base-300 p-2.5 ${revoked ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.filename || s.path || s.id}</span>
                  {revoked ? <Pill kind="danger" label={t.share.statusRevoked} /> : s.hasPassword ? <Pill kind="sky" label={t.share.statusProtected} /> : null}
                </div>
                {s.url ? <span className="truncate text-[11px] text-primary">{s.url}</span> : null}
                <span className="text-[11px] text-base-content/50">
                  {[formatMessage(t.share.downloads, { n: s.downloadCount ?? 0 }), formatMessage(t.share.expires, { when: fmtWhen(s.expiresAt) })].join(" · ")}
                </span>
                <div className="flex justify-end gap-2">
                  {s.url && !revoked ? (
                    <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm" onClick={() => void copyUrl(s.url)}>
                      <Copy size={14} /> {t.share.copyUrl}
                    </button>
                  ) : null}
                  {!revoked ? (
                    <button type="button" className="lp-modal-btn lp-modal-btn--danger lp-modal-btn--sm" onClick={() => void revoke(s)}>
                      <Trash2 size={14} /> {t.share.revoke}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {dialog}
    </Modal>
  );
}

// ── Visor de contenido de un comprimido (.tar/.zip…) ─────────────────────────
export function ArchiveContentsDialog({
  serverId,
  language,
  entry,
  onClose,
}: {
  serverId: string;
  language?: string;
  entry: Entry;
  onClose: () => void;
}) {
  const t = getMessages(language).serverFiles;

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api(serverId)
      .get<string[]>(`/api/files/archive-contents?path=${encodeURIComponent(entry.path)}`)
      .then((res) => {
        if (!alive) return;
        const data = unwrap<string[]>(res);
        setList(Array.isArray(data) ? data : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [serverId, entry.path]);

  return (
    <Modal title={t.archiveView.title} onClose={onClose} width="md" fillHeight footer={<button type="button" className="lp-modal-btn lp-modal-btn--ghost w-full" onClick={onClose}>{t.archiveView.close}</button>}>
      <p className="truncate text-xs text-base-content/50">{entry.name}</p>
      {loading ? (
        <LoadingRow label={t.archiveView.loading} />
      ) : list.length === 0 ? (
        <p className="text-sm text-base-content/50">{t.archiveView.empty}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-base-content/60">{formatMessage(t.archiveView.entries, { n: list.length })}</span>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-base-300">
            {list.map((line, i) => (
              <div key={`${line}-${i}`} className={`flex items-center gap-2 px-2.5 py-1.5 ${i === 0 ? "" : "border-t border-base-300"}`}>
                <FileIcon size={14} className="shrink-0 text-base-content/50" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-base-content/70">{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
