/**
 * files-tools — diálogo "Herramientas" del módulo Archivos (desktop) y sus
 * sub-pestañas (escáneres + operaciones masivas), port React DOM del gemelo
 * nativo sin cambio de comportamiento: malware/cuarentena, limpieza, reemplazo
 * masivo, chmod recursivo, publicar, exposición web y optimización de imágenes.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  File as FileIcon,
  Folder,
  Globe,
  Image as ImageIcon,
  Lock,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";
import { getMessages, formatMessage } from "../../../i18n";
import { useConfirm } from "../../../components/ConfirmDialog";
import { unwrap } from "../../../api/serverApi";
import { Modal, Field, InfoBox, Pill, LoadingRow, DialogFooter, api, runServerMutation, type PillKind, type ToolTabProps } from "./files-ui";
import {
  type CleanupItem,
  type CleanupScan,
  type ExposureScan,
  type ImageCapabilities,
  type ImageOp,
  type LargeImage,
  type MalwareScan,
  type PrivacyStatus,
  type PublishCandidate,
  type QuarantineEntry,
  type ReplacePreviewData,
  type ToolTab,
  fmtBytes,
} from "./files-types";

// ── Diálogo "Herramientas" (escáneres + operaciones masivas, por sub-pestañas) ─
export function ToolsDialog({
  serverId,
  language,
  dir,
  onClose,
  onToast,
  onChanged,
}: {
  serverId: string;
  language?: string;
  dir: string;
  onClose: () => void;
  onToast: (m: string, e?: boolean) => void;
  onChanged: () => void;
}) {
  const t = getMessages(language).serverFiles;
  const [tab, setTab] = useState<ToolTab>("malware");

  const items: Array<{ key: ToolTab; label: string }> = [
    { key: "malware", label: t.tools.tabMalware },
    { key: "cleanup", label: t.tools.tabCleanup },
    { key: "replace", label: t.tools.tabReplace },
    { key: "chmod", label: t.tools.tabChmod },
    { key: "publish", label: t.tools.tabPublish },
    { key: "exposure", label: t.tools.tabExposure },
    { key: "images", label: t.tools.tabImages },
  ];
  const tp: ToolTabProps = { serverId, language, dir, onToast, onChanged };

  return (
    <Modal title={t.tools.title} onClose={onClose} width="lg" fillHeight footer={<button type="button" className="lp-modal-btn lp-modal-btn--ghost w-full" onClick={onClose}>{t.tools.close}</button>}>
      <p className="truncate text-[11px] text-base-content/50">
        {t.tools.currentPath}: {dir}
      </p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`btn btn-xs ${tab === it.key ? "btn-primary" : "btn-ghost border border-base-300"}`}
            onClick={() => setTab(it.key)}
          >
            {it.label}
          </button>
        ))}
      </div>
      {tab === "malware" ? <MalwareTab {...tp} /> : null}
      {tab === "cleanup" ? <CleanupTab {...tp} /> : null}
      {tab === "replace" ? <ReplaceTab {...tp} /> : null}
      {tab === "chmod" ? <ChmodRecursiveTab {...tp} /> : null}
      {tab === "publish" ? <PublishTab {...tp} /> : null}
      {tab === "exposure" ? <ExposureTab {...tp} /> : null}
      {tab === "images" ? <ImagesTab {...tp} /> : null}
    </Modal>
  );
}

// ── Malware: escaneo heurístico (#12) + cuarentena (#13) ─────────────────────
function MalwareTab({ serverId, language, dir, onToast, onChanged }: ToolTabProps) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);
  const { confirm, dialog } = useConfirm();

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<MalwareScan | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [showQ, setShowQ] = useState(false);
  const [qList, setQList] = useState<QuarantineEntry[]>([]);
  const [qLoading, setQLoading] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    const res = await api(serverId).get<MalwareScan>(`/api/files/malware/scan?path=${encodeURIComponent(dir)}`);
    setScanning(false);
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    setResult(unwrap<MalwareScan>(res) ?? { findings: [] });
  }, [serverId, dir, onToast, t.toasts.error]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const loadQ = useCallback(async () => {
    setQLoading(true);
    const res = await api(serverId).get<QuarantineEntry[]>("/api/files/malware/quarantine");
    setQLoading(false);
    const list = unwrap<QuarantineEntry[]>(res);
    setQList(Array.isArray(list) ? list : []);
  }, [serverId]);

  const quarantine = useCallback(
    async (p: string) => {
      setBusyPath(p);
      const out = await runServerMutation(serverId, () => a.post("/api/files/malware/quarantine", { path: p }));
      setBusyPath(null);
      if (out.ok) {
        onToast(t.tools.malware.quarantined);
        onChanged();
        void scan();
        if (showQ) void loadQ();
      } else onToast(out.error ?? t.toasts.error, true);
    },
    [serverId, a, onToast, onChanged, scan, showQ, loadQ, t.tools.malware.quarantined, t.toasts.error],
  );

  const qAction = useCallback(
    async (kind: "restore" | "remove", id: string, name: string) => {
      const ok = await confirm({
        title: kind === "restore" ? t.tools.malware.restoreTitle : t.tools.malware.removeTitle,
        message: formatMessage(kind === "restore" ? t.tools.malware.restoreMessage : t.tools.malware.removeMessage, { name }),
        confirmLabel: kind === "restore" ? t.tools.malware.restore : t.tools.malware.remove,
        cancelLabel: t.tools.cancel,
        danger: kind === "remove",
      });
      if (!ok) return;
      const op =
        kind === "restore"
          ? () => a.post(`/api/files/malware/quarantine/${encodeURIComponent(id)}/restore`)
          : () => a.del(`/api/files/malware/quarantine/${encodeURIComponent(id)}`);
      const out = await runServerMutation(serverId, op);
      if (out.ok) {
        onToast(kind === "restore" ? t.tools.malware.restored : t.tools.malware.removed);
        void loadQ();
        onChanged();
      } else onToast(out.error ?? t.toasts.error, true);
    },
    [confirm, a, serverId, onToast, onChanged, loadQ, t.tools.malware, t.tools.cancel, t.toasts.error],
  );

  const findings = result?.findings ?? [];
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-base-content/60">{t.tools.malware.intro}</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm btn-outline flex-1 gap-1" onClick={() => void scan()} disabled={scanning}>
          {scanning ? <span className="loading loading-spinner loading-xs" /> : <Search size={15} />} {t.tools.scan}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline flex-1"
          onClick={() => {
            const nv = !showQ;
            setShowQ(nv);
            if (nv) void loadQ();
          }}
        >
          {t.tools.malware.viewQuarantine}
        </button>
      </div>

      {scanning ? (
        <LoadingRow label={t.tools.scanning} />
      ) : findings.length === 0 ? (
        <p className="text-sm text-base-content/50">{t.tools.malware.noFindings}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {result?.truncated ? <InfoBox tone="warn">{t.tools.malware.truncated}</InfoBox> : null}
          <span className="text-xs font-semibold text-base-content/60">{formatMessage(t.tools.malware.findings, { n: findings.length })}</span>
          {findings.slice(0, 100).map((f, i) => (
            <div key={`${f.path}-${i}`} className="flex flex-col gap-1.5 rounded-xl border border-base-300 p-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.name || (f.path || "").split("/").pop() || f.path}</span>
                <Pill kind={f.risk === "high" ? "danger" : "warn"} label={f.risk === "high" ? t.tools.malware.riskHigh : t.tools.malware.riskMedium} />
              </div>
              <span className="truncate text-[11px] text-base-content/50">{f.path}</span>
              {f.reason ? <span className="text-xs text-base-content/70">{f.reason}</span> : null}
              <div className="flex justify-end">
                <button type="button" className="lp-modal-btn lp-modal-btn--danger lp-modal-btn--sm" onClick={() => void quarantine(f.path)} disabled={busyPath === f.path}>
                  {busyPath === f.path ? <span className="loading loading-spinner loading-xs" /> : <Lock size={14} />} {t.tools.malware.quarantine}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showQ ? (
        <div className="mt-1 flex flex-col gap-2 border-t border-base-300 pt-3">
          <span className="text-sm font-semibold">{t.tools.malware.quarantineTitle}</span>
          {qLoading ? (
            <LoadingRow label={t.tools.loading} />
          ) : qList.length === 0 ? (
            <p className="text-sm text-base-content/50">{t.tools.malware.quarantineEmpty}</p>
          ) : (
            qList.map((q) => (
              <div key={q.id} className="flex flex-col gap-1.5 rounded-xl border border-base-300 p-2.5">
                <span className="truncate text-sm font-semibold">{q.name || q.id}</span>
                {q.originalPath ? <span className="truncate text-[11px] text-base-content/50">{q.originalPath}</span> : null}
                <div className="flex justify-end gap-2">
                  <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm" onClick={() => void qAction("restore", q.id, q.name || q.id)}>
                    {t.tools.malware.restore}
                  </button>
                  <button type="button" className="lp-modal-btn lp-modal-btn--danger lp-modal-btn--sm" onClick={() => void qAction("remove", q.id, q.name || q.id)}>
                    <Trash2 size={14} /> {t.tools.malware.remove}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
      {dialog}
    </div>
  );
}

// ── Limpieza: escaneo de espacio recuperable (#11) ───────────────────────────
function CleanupTab({ serverId, language, dir, onToast, onChanged }: ToolTabProps) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);
  const { confirm, dialog } = useConfirm();

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CleanupScan | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    const res = await api(serverId).get<CleanupScan>(`/api/files/cleanup/scan?path=${encodeURIComponent(dir)}`);
    setScanning(false);
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    setResult(unwrap<CleanupScan>(res) ?? { items: [] });
  }, [serverId, dir, onToast, t.toasts.error]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const remove = useCallback(
    async (item: CleanupItem) => {
      const ok = await confirm({
        title: t.tools.cleanup.removeTitle,
        message: formatMessage(t.tools.cleanup.removeMessage, { name: item.name || item.path }),
        confirmLabel: t.tools.cleanup.remove,
        cancelLabel: t.tools.cancel,
        danger: true,
      });
      if (!ok) return;
      const out = await runServerMutation(serverId, () => a.del("/api/files", { path: item.path }));
      if (out.ok) {
        onToast(t.tools.cleanup.removed);
        onChanged();
        void scan();
      } else onToast(out.error ?? t.toasts.error, true);
    },
    [confirm, a, serverId, onToast, onChanged, scan, t.tools.cleanup, t.tools.cancel, t.toasts.error],
  );

  const items = result?.items ?? [];
  const classLabel = (c?: string) => (c === "safe" ? t.tools.cleanup.classSafe : c === "review" ? t.tools.cleanup.classReview : t.tools.cleanup.classKeep);
  const classKind = (c?: string): PillKind => (c === "safe" ? "ok" : c === "review" ? "warn" : "neutral");
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-base-content/60">{t.tools.cleanup.intro}</p>
      <button type="button" className="btn btn-sm btn-outline w-fit gap-1" onClick={() => void scan()} disabled={scanning}>
        {scanning ? <span className="loading loading-spinner loading-xs" /> : <Search size={15} />} {t.tools.scan}
      </button>

      {scanning ? (
        <LoadingRow label={t.tools.scanning} />
      ) : items.length === 0 ? (
        <p className="text-sm text-base-content/50">{t.tools.cleanup.noItems}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {result?.truncated ? <InfoBox tone="warn">{t.tools.cleanup.truncated}</InfoBox> : null}
          <span className="text-xs font-semibold text-base-content/60">
            {formatMessage(t.tools.cleanup.items, { n: items.length })} · {formatMessage(t.tools.cleanup.reclaimable, { size: fmtBytes(result?.reclaimableBytes ?? 0) })}
          </span>
          {items.slice(0, 150).map((it, i) => (
            <div key={`${it.path}-${i}`} className="flex flex-col gap-1.5 rounded-xl border border-base-300 p-2.5">
              <div className="flex items-center gap-2">
                {it.kind === "dir" ? <Folder size={16} className="text-primary" /> : <FileIcon size={16} className="text-base-content/50" />}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{it.name || (it.path || "").split("/").pop() || it.path}</span>
                <Pill kind={classKind(it.classification)} label={classLabel(it.classification)} />
              </div>
              <span className="truncate text-[11px] text-base-content/50">{it.path}</span>
              <span className="text-xs text-base-content/70">{[fmtBytes(it.sizeBytes ?? 0), it.reason].filter(Boolean).join(" · ")}</span>
              <div className="flex justify-end">
                <button type="button" className="lp-modal-btn lp-modal-btn--danger lp-modal-btn--sm" onClick={() => void remove(it)}>
                  <Trash2 size={14} /> {t.tools.cleanup.remove}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {dialog}
    </div>
  );
}

// ── Reemplazo masivo: vista previa + aplicar (#10) ───────────────────────────
function ReplaceTab({ serverId, language, dir, onToast, onChanged }: ToolTabProps) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);

  const [search, setSearch] = useState("");
  const [replacement, setReplacement] = useState("");
  const [mode, setMode] = useState<"text" | "regex">("text");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [preview, setPreview] = useState<ReplacePreviewData | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "apply">("");

  const body = useCallback(() => ({ path: dir, search, replacement, mode, caseSensitive }), [dir, search, replacement, mode, caseSensitive]);

  const doPreview = useCallback(async () => {
    if (!search.trim()) {
      onToast(t.tools.replace.needSearch, true);
      return;
    }
    setBusy("preview");
    const res = await a.post("/api/files/replace/preview", body());
    setBusy("");
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    setPreview(unwrap<ReplacePreviewData>(res) ?? { files: [], totalReplacements: 0 });
  }, [search, a, body, onToast, t.tools.replace.needSearch, t.toasts.error]);

  const doApply = useCallback(async () => {
    if (!preview) {
      onToast(t.tools.replace.previewFirst, true);
      return;
    }
    setBusy("apply");
    const n = preview.totalReplacements ?? 0;
    const fileCount = (preview.files ?? []).length;
    const out = await runServerMutation(serverId, () => a.post("/api/files/replace/apply", body()));
    setBusy("");
    if (out.ok) {
      onToast(formatMessage(t.tools.replace.applyResult, { n, files: fileCount }));
      setPreview(null);
      onChanged();
    } else onToast(out.error ?? t.toasts.error, true);
  }, [preview, serverId, a, body, onToast, onChanged, t.tools.replace.applyResult, t.tools.replace.previewFirst, t.toasts.error]);

  const files = preview?.files ?? [];
  const totalMatches = preview?.totalReplacements ?? 0;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-base-content/60">{t.tools.replace.intro}</p>
      <Field label={t.tools.replace.search}>
        <input className="lp-modal-input" value={search} onChange={(e) => setSearch(e.target.value)} spellCheck={false} />
      </Field>
      <Field label={t.tools.replace.replacement}>
        <input className="lp-modal-input" value={replacement} onChange={(e) => setReplacement(e.target.value)} spellCheck={false} />
      </Field>
      <Field label={t.tools.replace.mode}>
        <div className="flex gap-1">
          {(["text", "regex"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`btn btn-xs flex-1 ${mode === m ? "btn-primary" : "btn-ghost border border-base-300"}`}
              onClick={() => setMode(m)}
            >
              {m === "text" ? t.tools.replace.modeText : t.tools.replace.modeRegex}
            </button>
          ))}
        </div>
      </Field>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
        <span className="text-sm">{t.tools.replace.caseSensitive}</span>
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm btn-outline flex-1 gap-1" onClick={() => void doPreview()} disabled={busy !== "" || !search.trim()}>
          {busy === "preview" ? <span className="loading loading-spinner loading-xs" /> : <Eye size={15} />} {t.tools.replace.preview}
        </button>
        <button type="button" className="btn btn-sm btn-primary flex-1 gap-1" onClick={() => void doApply()} disabled={busy !== "" || !preview || files.length === 0}>
          {busy === "apply" ? <span className="loading loading-spinner loading-xs" /> : <Save size={15} />} {t.tools.replace.apply}
        </button>
      </div>

      {preview ? (
        files.length === 0 ? (
          <p className="text-sm text-base-content/50">{t.tools.replace.noMatches}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {preview.truncated ? <InfoBox tone="warn">{t.tools.replace.truncated}</InfoBox> : null}
            <span className="text-xs font-semibold text-base-content/60">{formatMessage(t.tools.replace.matches, { n: totalMatches, files: files.length })}</span>
            {files.slice(0, 60).map((f, i) => (
              <div key={`${f.path}-${i}`} className="flex flex-col gap-1 rounded-xl border border-base-300 p-2.5">
                <span className="truncate text-xs font-semibold">{f.name || (f.path || "").split("/").pop() || f.path}</span>
                {(f.replacements ?? []).slice(0, 4).map((r, j) => (
                  <div key={j} className="flex flex-col">
                    <span className="truncate font-mono text-[11px] text-error">- {r.before}</span>
                    <span className="truncate font-mono text-[11px] text-success">+ {r.after}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

// ── chmod recursivo (carpeta + contenido) ────────────────────────────────────
function ChmodRecursiveTab({ serverId, language, dir, onToast, onChanged }: ToolTabProps) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);

  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = useCallback(async () => {
    const m = mode.trim();
    if (!/^[0-7]{3,4}$/.test(m)) {
      onToast(t.tools.chmod.invalid, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(serverId, () => a.put("/api/files/chmod-recursive", { path: dir, mode: m }));
    setBusy(false);
    if (out.ok) {
      onToast(t.tools.chmod.applied);
      onChanged();
    } else onToast(out.error ?? t.toasts.error, true);
  }, [mode, serverId, a, dir, onToast, onChanged, t.tools.chmod, t.toasts.error]);

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-base-content/60">{t.tools.chmod.intro}</p>
      <Field label={t.tools.chmod.mode}>
        <input className="lp-modal-input" value={mode} onChange={(e) => setMode(e.target.value)} placeholder={t.tools.chmod.placeholder} inputMode="numeric" />
      </Field>
      <button type="button" className="lp-modal-btn lp-modal-btn--danger w-fit" onClick={() => void apply()} disabled={busy || !/^[0-7]{3,4}$/.test(mode.trim())}>
        {busy ? <span className="loading loading-spinner loading-xs" /> : <Lock size={16} />} {t.tools.chmod.apply}
      </button>
    </div>
  );
}

// ── Publicar carpeta protegida bajo un sitio NGINX ───────────────────────────
function PublishTab({ serverId, language, dir, onToast, onChanged }: ToolTabProps) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);
  const { confirm, dialog } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<PublishCandidate[]>([]);
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [domain, setDomain] = useState("");
  const [tls, setTls] = useState(true);
  const [busy, setBusy] = useState<"" | "publish" | "unpublish">("");

  const reload = useCallback(async () => {
    setLoading(true);
    const cli = api(serverId);
    const [si, st] = await Promise.all([
      cli.get<PublishCandidate[]>(`/api/files/privacy/sites?path=${encodeURIComponent(dir)}`),
      cli.get<PrivacyStatus>(`/api/files/privacy?path=${encodeURIComponent(dir)}`),
    ]);
    setLoading(false);
    const list = unwrap<PublishCandidate[]>(si);
    const arr = Array.isArray(list) ? list : [];
    setSites(arr);
    setDomain((cur) => cur || arr[0]?.domain || "");
    setStatus(st.ok ? unwrap<PrivacyStatus>(st) ?? null : null);
  }, [serverId, dir]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const publish = useCallback(async () => {
    if (!domain) return;
    setBusy("publish");
    const out = await runServerMutation(serverId, () => a.post("/api/files/privacy/publish", { path: dir, domain, tls }));
    setBusy("");
    if (out.ok) {
      onToast(t.tools.publish.published);
      onChanged();
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
  }, [domain, tls, serverId, a, dir, onToast, onChanged, reload, t.tools.publish.published, t.toasts.error]);

  const unpublish = useCallback(async () => {
    const ok = await confirm({ title: t.tools.publish.unpublishTitle, message: t.tools.publish.unpublishMessage, confirmLabel: t.tools.publish.confirmUnpublish, cancelLabel: t.tools.cancel, danger: true });
    if (!ok) return;
    setBusy("unpublish");
    const out = await runServerMutation(serverId, () => a.post("/api/files/privacy/unpublish", { path: dir, domain }));
    setBusy("");
    if (out.ok) {
      onToast(t.tools.publish.unpublished);
      onChanged();
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
  }, [confirm, serverId, a, dir, domain, onToast, onChanged, reload, t.tools.publish, t.tools.cancel, t.toasts.error]);

  const isProt = !!status?.protected;
  const publicUrl = status?.enforcement?.publicUrl ?? null;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-base-content/60">{t.tools.publish.intro}</p>
      {loading ? (
        <LoadingRow label={t.tools.publish.loading} />
      ) : (
        <>
          {!isProt ? <InfoBox tone="warn">{t.tools.publish.needProtect}</InfoBox> : null}
          {publicUrl ? <span className="truncate text-xs text-primary">{formatMessage(t.tools.publish.publicUrl, { url: publicUrl })}</span> : null}
          {sites.length === 0 ? (
            <InfoBox tone="warn">{t.tools.publish.sitesEmpty}</InfoBox>
          ) : (
            <>
              <Field label={t.tools.publish.domain}>
                <select className="lp-modal-select" value={domain} onChange={(e) => setDomain(e.target.value)}>
                  <option value="" disabled>
                    {t.tools.publish.domainPlaceholder}
                  </option>
                  {sites.map((s) => (
                    <option key={s.domain} value={s.domain}>
                      {s.ssl ? `${s.domain} (TLS)` : s.domain}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={tls} onChange={(e) => setTls(e.target.checked)} />
                <span className="text-sm">{t.tools.publish.tls}</span>
              </label>
              <div className="flex gap-2">
                <button type="button" className="lp-modal-btn lp-modal-btn--primary flex-1" onClick={() => void publish()} disabled={busy !== "" || !isProt || !domain}>
                  {busy === "publish" ? <span className="loading loading-spinner loading-xs" /> : <Globe size={16} />} {t.tools.publish.publish}
                </button>
                <button type="button" className="lp-modal-btn lp-modal-btn--danger flex-1" onClick={() => void unpublish()} disabled={busy !== "" || !domain}>
                  {busy === "unpublish" ? <span className="loading loading-spinner loading-xs" /> : null} {t.tools.publish.unpublish}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {dialog}
    </div>
  );
}

// ── Exposición web: archivos sensibles accesibles + bloqueo .htaccess (#3/#16) ─
function ExposureTab({ serverId, language, dir, onToast, onChanged }: ToolTabProps) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ExposureScan | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    const res = await api(serverId).get<ExposureScan>(`/api/files/exposure/scan?path=${encodeURIComponent(dir)}`);
    setScanning(false);
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    setResult(unwrap<ExposureScan>(res) ?? { findings: [] });
  }, [serverId, dir, onToast, t.toasts.error]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const block = useCallback(
    async (p: string) => {
      setBusyPath(p);
      const out = await runServerMutation(serverId, () => a.post("/api/files/exposure/block", { path: p }));
      setBusyPath(null);
      if (out.ok) {
        onToast(t.tools.exposure.blocked);
        onChanged();
        void scan();
      } else onToast(out.error ?? t.toasts.error, true);
    },
    [serverId, a, onToast, onChanged, scan, t.tools.exposure.blocked, t.toasts.error],
  );

  const findings = result?.findings ?? [];
  const roots = result?.rootsScanned ?? [];
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-base-content/60">{t.tools.exposure.intro}</p>
      <button type="button" className="btn btn-sm btn-outline w-fit gap-1" onClick={() => void scan()} disabled={scanning}>
        {scanning ? <span className="loading loading-spinner loading-xs" /> : <Search size={15} />} {t.tools.scan}
      </button>

      {scanning ? (
        <LoadingRow label={t.tools.scanning} />
      ) : findings.length === 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-base-content/50">{t.tools.exposure.noFindings}</p>
          {roots.length ? <span className="text-[11px] text-base-content/50">{formatMessage(t.tools.exposure.rootsScanned, { n: roots.length })}</span> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {result?.truncated ? <InfoBox tone="warn">{t.tools.malware.truncated}</InfoBox> : null}
          <span className="text-xs font-semibold text-base-content/60">{formatMessage(t.tools.exposure.findings, { n: findings.length })}</span>
          {findings.slice(0, 100).map((f, i) => (
            <div key={`${f.path}-${i}`} className="flex flex-col gap-1.5 rounded-xl border border-base-300 p-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.name || (f.path || "").split("/").pop() || f.path}</span>
                <Pill kind={f.risk === "high" ? "danger" : "warn"} label={f.risk === "high" ? t.tools.exposure.riskHigh : t.tools.exposure.riskMedium} />
              </div>
              {f.url ? <span className="truncate text-[11px] text-primary">{f.url}</span> : null}
              <span className="truncate text-[11px] text-base-content/50">{f.path}</span>
              {f.reason ? <span className="text-xs text-base-content/70">{f.reason}</span> : null}
              <div className="flex justify-end">
                <button type="button" className="lp-modal-btn lp-modal-btn--danger lp-modal-btn--sm" onClick={() => void block(f.path)} disabled={busyPath === f.path}>
                  {busyPath === f.path ? <span className="loading loading-spinner loading-xs" /> : <ShieldCheck size={14} />} {t.tools.exposure.block}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Imágenes: optimización (WebP / comprimir / redimensionar / responsive, #22) ─
function ImagesTab({ serverId, language, dir, onToast, onChanged }: ToolTabProps) {
  const t = getMessages(language).serverFiles;

  const [caps, setCaps] = useState<ImageCapabilities | null>(null);
  const [scanning, setScanning] = useState(false);
  const [images, setImages] = useState<LargeImage[]>([]);
  const [target, setTarget] = useState<LargeImage | null>(null);

  const loadCaps = useCallback(async () => {
    const res = await api(serverId).get<ImageCapabilities>("/api/files/images/capabilities");
    if (res.ok) setCaps(unwrap<ImageCapabilities>(res) ?? null);
  }, [serverId]);

  const scan = useCallback(async () => {
    setScanning(true);
    const res = await api(serverId).get<LargeImage[]>(`/api/files/images/scan?path=${encodeURIComponent(dir)}`);
    setScanning(false);
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    const list = unwrap<LargeImage[]>(res);
    setImages(Array.isArray(list) ? list : []);
  }, [serverId, dir, onToast, t.toasts.error]);

  useEffect(() => {
    void loadCaps();
    void scan();
  }, [loadCaps, scan]);

  const capItems = caps
    ? [
        { key: "magick", label: t.tools.images.capMagick, on: !!caps.magick },
        { key: "cwebp", label: t.tools.images.capCwebp, on: !!caps.cwebp },
        { key: "jpegoptim", label: t.tools.images.capJpegoptim, on: !!caps.jpegoptim },
        { key: "optipng", label: t.tools.images.capOptipng, on: !!caps.optipng },
      ]
    : [];
  const noTools = caps ? !(caps.magick || caps.cwebp || caps.jpegoptim || caps.optipng) : false;

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-base-content/60">{t.tools.images.intro}</p>

      {caps ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-base-300 p-2.5">
          <span className="text-xs font-semibold text-base-content/60">{t.tools.images.capabilitiesTitle}</span>
          <div className="flex flex-wrap gap-1.5">
            {capItems.map((c) => (
              <Pill key={c.key} kind={c.on ? "ok" : "neutral"} label={`${c.label} · ${c.on ? t.tools.images.capAvailable : t.tools.images.capMissing}`} />
            ))}
          </div>
          {noTools ? <InfoBox tone="warn">{t.tools.images.noTools}</InfoBox> : null}
        </div>
      ) : null}

      <button type="button" className="btn btn-sm btn-outline w-fit gap-1" onClick={() => void scan()} disabled={scanning}>
        {scanning ? <span className="loading loading-spinner loading-xs" /> : <Search size={15} />} {t.tools.scan}
      </button>

      {scanning ? (
        <LoadingRow label={t.tools.scanning} />
      ) : images.length === 0 ? (
        <p className="text-sm text-base-content/50">{t.tools.images.noImages}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-base-content/60">{formatMessage(t.tools.images.count, { n: images.length })}</span>
          {images.slice(0, 150).map((img, i) => {
            const name = img.name || (img.path || "").split("/").pop() || img.path;
            const dims = img.width && img.height ? ` · ${img.width}×${img.height}` : "";
            return (
              <div key={`${img.path}-${i}`} className="flex flex-col gap-1.5 rounded-xl border border-base-300 p-2.5">
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} className="text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                </div>
                <span className="truncate text-[11px] text-base-content/50">{img.path}</span>
                <span className="text-xs text-base-content/70">{`${fmtBytes(img.sizeBytes ?? 0)}${dims}`}</span>
                <div className="flex justify-end">
                  <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm" onClick={() => setTarget(img)}>
                    <Wand2 size={14} /> {t.tools.images.optimize}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {target ? (
        <ImageOptimizeDialog
          serverId={serverId}
          language={language}
          image={target}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            onChanged();
            void scan();
          }}
          onToast={onToast}
        />
      ) : null}
    </div>
  );
}

// ── Diálogo de optimización por imagen (operación + parámetros, defensivo) ────
function ImageOptimizeDialog({
  serverId,
  language,
  image,
  onClose,
  onDone,
  onToast,
}: {
  serverId: string;
  language?: string;
  image: LargeImage;
  onClose: () => void;
  onDone: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverFiles;
  const a = api(serverId);

  const [op, setOp] = useState<ImageOp>("webp");
  const [quality, setQuality] = useState("80");
  const [width, setWidth] = useState("1280");
  const [widths, setWidths] = useState("480, 768, 1280");
  const [busy, setBusy] = useState(false);

  const needsQuality = op === "webp" || op === "compress";

  const submit = async () => {
    const body: { path: string; op: ImageOp; quality?: number; width?: number; widths?: number[] } = { path: image.path, op };
    if (needsQuality) {
      const q = Math.round(Number(quality));
      if (!Number.isFinite(q) || q < 1 || q > 100) {
        onToast(t.tools.images.invalidQuality, true);
        return;
      }
      body.quality = q;
    } else if (op === "resize") {
      const w = Math.round(Number(width));
      if (!Number.isFinite(w) || w < 1 || w > 10_000) {
        onToast(t.tools.images.invalidWidth, true);
        return;
      }
      body.width = w;
    } else {
      const ws = widths
        .split(",")
        .map((s) => Math.round(Number(s.trim())))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 10_000)
        .slice(0, 8);
      if (ws.length === 0) {
        onToast(t.tools.images.invalidWidths, true);
        return;
      }
      body.widths = ws;
    }
    setBusy(true);
    const out = await runServerMutation(serverId, () => a.post("/api/files/images/process", body));
    setBusy(false);
    if (out.ok) onToast(t.tools.images.processed);
    else {
      onToast(out.error ?? t.toasts.error, true);
      return;
    }
    onDone();
  };

  return (
    <Modal
      title={t.tools.images.optimizeTitle}
      onClose={onClose}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.tools.cancel} onSubmit={submit} submitLabel={t.tools.images.process} submitting={busy} />}
    >
      <span className="truncate text-sm font-semibold">{image.name || (image.path || "").split("/").pop() || image.path}</span>
      <span className="truncate text-[11px] text-base-content/50">{image.path}</span>
      <span className="text-[11px] text-base-content/50">{fmtBytes(image.sizeBytes ?? 0)}</span>

      <Field label={t.tools.images.operation}>
        <select className="lp-modal-select" value={op} onChange={(e) => setOp(e.target.value as ImageOp)}>
          <option value="webp">{t.tools.images.opWebp}</option>
          <option value="compress">{t.tools.images.opCompress}</option>
          <option value="resize">{t.tools.images.opResize}</option>
          <option value="responsive">{t.tools.images.opResponsive}</option>
        </select>
      </Field>

      {needsQuality ? (
        <Field label={t.tools.images.quality}>
          <input className="lp-modal-input" value={quality} onChange={(e) => setQuality(e.target.value)} inputMode="numeric" />
        </Field>
      ) : null}

      {op === "resize" ? (
        <Field label={t.tools.images.width}>
          <input className="lp-modal-input" value={width} onChange={(e) => setWidth(e.target.value)} inputMode="numeric" />
        </Field>
      ) : null}

      {op === "responsive" ? (
        <Field label={t.tools.images.widths} hint={t.tools.images.widthsHint}>
          <input className="lp-modal-input" value={widths} onChange={(e) => setWidths(e.target.value)} placeholder={t.tools.images.widthsPlaceholder} spellCheck={false} />
        </Field>
      ) : null}
    </Modal>
  );
}
