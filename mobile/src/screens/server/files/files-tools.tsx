import { FormDrawer } from "../../../components/ui/FormDrawer";
import { ModuleLoading } from "../../../components/server/ModuleLoading";
/**
 * files-tools — diálogo "Herramientas" del módulo Archivos y sus sub-pestañas
 * (escáneres + operaciones masivas), extraídos de FilesScreen sin cambio de
 * comportamiento: malware/cuarentena, limpieza, reemplazo masivo, chmod
 * recursivo, publicar, exposición web y optimización de imágenes.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ConfirmDialog, Field, DialogFooter, InfoBox, Checkbox } from "../../../components/server/Form";
import { pillColors, type PillKind } from "../../../components/server/badges";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { TablerFolder, TablerFile, TablerTrash, TablerDeviceFloppy } from "../../../features/app/tabler-icons";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { EyeIcon, GlobeIcon, LockIcon, PhotoIcon, SearchIcon, ShieldLockIcon, WandIcon } from "./files-icons";
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
  type ToolTabProps,
  fmtBytes,
} from "./files-types";

// ── Pill reutilizable para los escáneres ─────────────────────────────────────
function Pill({ tokens, kind, label }: { tokens: ReturnType<typeof getThemeTokens>; kind: PillKind; label: string }) {
  const c = pillColors(tokens, kind);
  return (
    <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: c.bg, borderColor: c.border }}>
      <Text style={{ color: c.text, fontSize: 10 }}>{label}</Text>
    </View>
  );
}

// ── Diálogo "Herramientas" (escáneres + operaciones masivas, por sub-pestañas) ─
export function ToolsDialog({ panelId, token, dir, onClose, onToast, onChanged }: { panelId: string; token: string; dir: string; onClose: () => void; onToast: (m: string, e?: boolean) => void; onChanged: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;
  const [tab, setTab] = useState<ToolTab>("malware");

  const items = [
    { key: "malware", label: t.tools.tabMalware },
    { key: "cleanup", label: t.tools.tabCleanup },
    { key: "replace", label: t.tools.tabReplace },
    { key: "chmod", label: t.tools.tabChmod },
    { key: "publish", label: t.tools.tabPublish },
    { key: "exposure", label: t.tools.tabExposure },
    { key: "images", label: t.tools.tabImages },
  ];
  const tp: ToolTabProps = { panelId, token, dir, onToast, onChanged };

  return (
    <FormDrawer visible onClose={onClose} title={t.tools.title} language={language} fillHeight footer={<Button label={t.tools.close} variant="ghost" onPress={onClose} style={{ flex: 1 }} />}>
      <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11, marginBottom: 8 }}>{t.tools.currentPath}: {dir}</Text>
      <SegmentedControl scroll items={items} value={tab} onChange={(k) => setTab(k as ToolTab)} style={{ marginBottom: 12 }} />
      {tab === "malware" ? <MalwareTab {...tp} /> : null}
      {tab === "cleanup" ? <CleanupTab {...tp} /> : null}
      {tab === "replace" ? <ReplaceTab {...tp} /> : null}
      {tab === "chmod" ? <ChmodRecursiveTab {...tp} /> : null}
      {tab === "publish" ? <PublishTab {...tp} /> : null}
      {tab === "exposure" ? <ExposureTab {...tp} /> : null}
      {tab === "images" ? <ImagesTab {...tp} /> : null}
    </FormDrawer>
  );
}

// ── Malware: escaneo heurístico (#12) + cuarentena (#13) ─────────────────────
function MalwareTab({ panelId, token, dir, onToast, onChanged }: ToolTabProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<MalwareScan | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [showQ, setShowQ] = useState(false);
  const [qList, setQList] = useState<QuarantineEntry[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "restore" | "remove"; id: string; name: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    const res = await callServerApi(panelId, token, "GET", `/api/files/malware/scan?path=${encodeURIComponent(dir)}`);
    setScanning(false);
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    setResult(unwrap<MalwareScan>(res) ?? { findings: [] });
  }, [panelId, token, dir, onToast, t.toasts.error]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const loadQ = useCallback(async () => {
    setQLoading(true);
    const res = await callServerApi(panelId, token, "GET", "/api/files/malware/quarantine");
    setQLoading(false);
    const list = unwrap<QuarantineEntry[]>(res);
    setQList(Array.isArray(list) ? list : []);
  }, [panelId, token]);

  const quarantine = useCallback(
    async (p: string) => {
      setBusyPath(p);
      const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/files/malware/quarantine", { path: p }));
      setBusyPath(null);
      if (out.ok) {
        onToast(t.tools.malware.quarantined);
        onChanged();
        void scan();
        if (showQ) void loadQ();
      } else onToast(out.error ?? t.toasts.error, true);
    },
    [panelId, token, onToast, onChanged, scan, showQ, loadQ, t.tools.malware.quarantined, t.toasts.error],
  );

  const doConfirm = useCallback(async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    const id = confirm.id;
    const op =
      confirm.kind === "restore"
        ? () => callServerApi(panelId, token, "POST", `/api/files/malware/quarantine/${encodeURIComponent(id)}/restore`)
        : () => callServerApi(panelId, token, "DELETE", `/api/files/malware/quarantine/${encodeURIComponent(id)}`);
    const out = await runServerMutation(panelId, token, op);
    setConfirmBusy(false);
    if (out.ok) {
      onToast(confirm.kind === "restore" ? t.tools.malware.restored : t.tools.malware.removed);
      void loadQ();
      onChanged();
    } else onToast(out.error ?? t.toasts.error, true);
    setConfirm(null);
  }, [confirm, panelId, token, onToast, onChanged, loadQ, t.tools.malware, t.toasts.error]);

  const findings = result?.findings ?? [];
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.tools.malware.intro}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={t.tools.scan} icon={<SearchIcon size={16} />} variant="secondary" size="sm" onPress={() => void scan()} loading={scanning} style={{ flex: 1 }} />
        <Button label={t.tools.malware.viewQuarantine} variant="secondary" size="sm" onPress={() => { const nv = !showQ; setShowQ(nv); if (nv) void loadQ(); }} style={{ flex: 1 }} />
      </View>

      {scanning ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
          <ActivityIndicator color={tokens.brand} />
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.scanning}</Text>
        </View>
      ) : findings.length === 0 ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.malware.noFindings}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {result?.truncated ? <InfoBox tone="warn">{t.tools.malware.truncated}</InfoBox> : null}
          <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{formatMessage(t.tools.malware.findings, { n: findings.length })}</Text>
          {findings.slice(0, 100).map((f, i) => (
            <View key={`${f.path}-${i}`} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{f.name || (f.path || "").split("/").pop() || f.path}</Text>
                <Pill tokens={tokens} kind={f.risk === "high" ? "danger" : "warn"} label={f.risk === "high" ? t.tools.malware.riskHigh : t.tools.malware.riskMedium} />
              </View>
              <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{f.path}</Text>
              {f.reason ? <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{f.reason}</Text> : null}
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Button label={t.tools.malware.quarantine} icon={<LockIcon size={16} />} variant="danger" size="sm" loading={busyPath === f.path} onPress={() => void quarantine(f.path)} />
              </View>
            </View>
          ))}
        </View>
      )}

      {showQ ? (
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: tokens.border, paddingTop: 12, marginTop: 4 }}>
          <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{t.tools.malware.quarantineTitle}</Text>
          {qLoading ? (
            <ModuleLoading label={t.tools.loading} />
          ) : qList.length === 0 ? (
            <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.malware.quarantineEmpty}</Text>
          ) : (
            qList.map((q) => (
              <View key={q.id} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 6 }}>
                <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{q.name || q.id}</Text>
                {q.originalPath ? <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{q.originalPath}</Text> : null}
                <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                  <Button label={t.tools.malware.restore} variant="secondary" size="sm" onPress={() => setConfirm({ kind: "restore", id: q.id, name: q.name || q.id })} />
                  <Button label={t.tools.malware.remove} icon={<TablerTrash size={16} />} variant="danger" size="sm" onPress={() => setConfirm({ kind: "remove", id: q.id, name: q.name || q.id })} />
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      {confirm ? (
        <ConfirmDialog
          visible
          title={confirm.kind === "restore" ? t.tools.malware.restoreTitle : t.tools.malware.removeTitle}
          message={formatMessage(confirm.kind === "restore" ? t.tools.malware.restoreMessage : t.tools.malware.removeMessage, { name: confirm.name })}
          confirmLabel={confirm.kind === "restore" ? t.tools.malware.restore : t.tools.malware.remove}
          cancelLabel={t.tools.cancel}
          danger={confirm.kind === "remove"}
          submitting={confirmBusy}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </View>
  );
}

// ── Limpieza: escaneo de espacio recuperable (#11) ───────────────────────────
function CleanupTab({ panelId, token, dir, onToast, onChanged }: ToolTabProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CleanupScan | null>(null);
  const [confirm, setConfirm] = useState<CleanupItem | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    const res = await callServerApi(panelId, token, "GET", `/api/files/cleanup/scan?path=${encodeURIComponent(dir)}`);
    setScanning(false);
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    setResult(unwrap<CleanupScan>(res) ?? { items: [] });
  }, [panelId, token, dir, onToast, t.toasts.error]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const doDelete = useCallback(async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "DELETE", "/api/files", { path: confirm.path }));
    setConfirmBusy(false);
    if (out.ok) {
      onToast(t.tools.cleanup.removed);
      onChanged();
      void scan();
    } else onToast(out.error ?? t.toasts.error, true);
    setConfirm(null);
  }, [confirm, panelId, token, onToast, onChanged, scan, t.tools.cleanup.removed, t.toasts.error]);

  const items = result?.items ?? [];
  const classLabel = (c?: string) => (c === "safe" ? t.tools.cleanup.classSafe : c === "review" ? t.tools.cleanup.classReview : t.tools.cleanup.classKeep);
  const classKind = (c?: string): PillKind => (c === "safe" ? "ok" : c === "review" ? "warn" : "neutral");
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.tools.cleanup.intro}</Text>
      <Button label={t.tools.scan} icon={<SearchIcon size={16} />} variant="secondary" size="sm" onPress={() => void scan()} loading={scanning} />

      {scanning ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
          <ActivityIndicator color={tokens.brand} />
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.scanning}</Text>
        </View>
      ) : items.length === 0 ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.cleanup.noItems}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {result?.truncated ? <InfoBox tone="warn">{t.tools.cleanup.truncated}</InfoBox> : null}
          <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{formatMessage(t.tools.cleanup.items, { n: items.length })} · {formatMessage(t.tools.cleanup.reclaimable, { size: fmtBytes(result?.reclaimableBytes ?? 0) })}</Text>
          {items.slice(0, 150).map((it, i) => (
            <View key={`${it.path}-${i}`} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {it.kind === "dir" ? <TablerFolder size={16} color={tokens.brand} /> : <TablerFile size={16} color={tokens.textMuted} />}
                <Text numberOfLines={1} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{it.name || (it.path || "").split("/").pop() || it.path}</Text>
                <Pill tokens={tokens} kind={classKind(it.classification)} label={classLabel(it.classification)} />
              </View>
              <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{it.path}</Text>
              <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{[fmtBytes(it.sizeBytes ?? 0), it.reason].filter(Boolean).join(" · ")}</Text>
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Button label={t.tools.cleanup.remove} icon={<TablerTrash size={16} />} variant="danger" size="sm" onPress={() => setConfirm(it)} />
              </View>
            </View>
          ))}
        </View>
      )}

      {confirm ? (
        <ConfirmDialog
          visible
          title={t.tools.cleanup.removeTitle}
          message={formatMessage(t.tools.cleanup.removeMessage, { name: confirm.name || confirm.path })}
          confirmLabel={t.tools.cleanup.remove}
          cancelLabel={t.tools.cancel}
          danger
          submitting={confirmBusy}
          onConfirm={doDelete}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </View>
  );
}

// ── Reemplazo masivo: vista previa + aplicar (#10) ───────────────────────────
function ReplaceTab({ panelId, token, dir, onToast, onChanged }: ToolTabProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [search, setSearch] = useState("");
  const [replacement, setReplacement] = useState("");
  const [mode, setMode] = useState<"text" | "regex">("text");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [preview, setPreview] = useState<ReplacePreviewData | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "apply">("");

  const body = useCallback(
    () => ({ path: dir, search, replacement, mode, caseSensitive }),
    [dir, search, replacement, mode, caseSensitive],
  );

  const doPreview = useCallback(async () => {
    if (!search.trim()) {
      onToast(t.tools.replace.needSearch, true);
      return;
    }
    setBusy("preview");
    const res = await callServerApi(panelId, token, "POST", "/api/files/replace/preview", body());
    setBusy("");
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    setPreview(unwrap<ReplacePreviewData>(res) ?? { files: [], totalReplacements: 0 });
  }, [search, panelId, token, body, onToast, t.tools.replace.needSearch, t.toasts.error]);

  const doApply = useCallback(async () => {
    if (!preview) {
      onToast(t.tools.replace.previewFirst, true);
      return;
    }
    setBusy("apply");
    // La vista previa ya reportó el alcance; `apply` muta y respalda cada archivo.
    const n = preview.totalReplacements ?? 0;
    const fileCount = (preview.files ?? []).length;
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/files/replace/apply", body()));
    setBusy("");
    if (out.ok) {
      onToast(formatMessage(t.tools.replace.applyResult, { n, files: fileCount }));
      setPreview(null);
      onChanged();
    } else onToast(out.error ?? t.toasts.error, true);
  }, [preview, panelId, token, body, onToast, onChanged, t.tools.replace.applyResult, t.tools.replace.previewFirst, t.toasts.error]);

  const files = preview?.files ?? [];
  const totalMatches = preview?.totalReplacements ?? 0;
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.tools.replace.intro}</Text>
      <Field label={t.tools.replace.search}>
        <Input value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t.tools.replace.replacement}>
        <Input value={replacement} onChangeText={setReplacement} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t.tools.replace.mode}>
        <SegmentedControl
          fill
          items={[{ key: "text", label: t.tools.replace.modeText }, { key: "regex", label: t.tools.replace.modeRegex }]}
          value={mode}
          onChange={(k) => setMode(k as "text" | "regex")}
        />
      </Field>
      <Checkbox value={caseSensitive} onChange={setCaseSensitive} label={t.tools.replace.caseSensitive} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={t.tools.replace.preview} icon={<EyeIcon size={16} />} variant="secondary" size="sm" onPress={() => void doPreview()} loading={busy === "preview"} disabled={busy !== "" || !search.trim()} style={{ flex: 1 }} />
        <Button label={t.tools.replace.apply} icon={<TablerDeviceFloppy size={16} />} size="sm" onPress={() => void doApply()} loading={busy === "apply"} disabled={busy !== "" || !preview || files.length === 0} style={{ flex: 1 }} />
      </View>

      {preview ? (
        files.length === 0 ? (
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.replace.noMatches}</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {preview.truncated ? <InfoBox tone="warn">{t.tools.replace.truncated}</InfoBox> : null}
            <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{formatMessage(t.tools.replace.matches, { n: totalMatches, files: files.length })}</Text>
            {files.slice(0, 60).map((f, i) => (
              <View key={`${f.path}-${i}`} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 4 }}>
                <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 12, fontWeight: "600" }}>{f.name || (f.path || "").split("/").pop() || f.path}</Text>
                {(f.replacements ?? []).slice(0, 4).map((r, j) => (
                  <View key={j} style={{ gap: 1 }}>
                    <Text numberOfLines={1} style={{ color: tokens.danger, fontSize: 11, fontFamily: "monospace" }}>- {r.before}</Text>
                    <Text numberOfLines={1} style={{ color: tokens.success, fontSize: 11, fontFamily: "monospace" }}>+ {r.after}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

// ── chmod recursivo (carpeta + contenido) ────────────────────────────────────
function ChmodRecursiveTab({ panelId, token, dir, onToast, onChanged }: ToolTabProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = useCallback(async () => {
    const m = mode.trim();
    if (!/^[0-7]{3,4}$/.test(m)) {
      onToast(t.tools.chmod.invalid, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/files/chmod-recursive", { path: dir, mode: m }));
    setBusy(false);
    if (out.ok) {
      onToast(t.tools.chmod.applied);
      onChanged();
    } else onToast(out.error ?? t.toasts.error, true);
  }, [mode, panelId, token, dir, onToast, onChanged, t.tools.chmod, t.toasts.error]);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.tools.chmod.intro}</Text>
      <Field label={t.tools.chmod.mode}>
        <Input value={mode} onChangeText={setMode} placeholder={t.tools.chmod.placeholder} keyboardType="number-pad" autoCapitalize="none" />
      </Field>
      <Button label={t.tools.chmod.apply} icon={<LockIcon size={16} />} variant="danger" onPress={() => void apply()} loading={busy} disabled={!/^[0-7]{3,4}$/.test(mode.trim())} />
    </View>
  );
}

// ── Publicar carpeta protegida bajo un sitio NGINX ───────────────────────────
function PublishTab({ panelId, token, dir, onToast, onChanged }: ToolTabProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<PublishCandidate[]>([]);
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [domain, setDomain] = useState("");
  const [tls, setTls] = useState(true);
  const [busy, setBusy] = useState<"" | "publish" | "unpublish">("");
  const [confirm, setConfirm] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [si, st] = await Promise.all([
      callServerApi(panelId, token, "GET", `/api/files/privacy/sites?path=${encodeURIComponent(dir)}`),
      callServerApi(panelId, token, "GET", `/api/files/privacy?path=${encodeURIComponent(dir)}`),
    ]);
    setLoading(false);
    const list = unwrap<PublishCandidate[]>(si);
    const arr = Array.isArray(list) ? list : [];
    setSites(arr);
    setDomain((cur) => cur || arr[0]?.domain || "");
    setStatus(st.ok ? unwrap<PrivacyStatus>(st) ?? null : null);
  }, [panelId, token, dir]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const publish = useCallback(async () => {
    if (!domain) return;
    setBusy("publish");
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/files/privacy/publish", { path: dir, domain, tls }));
    setBusy("");
    if (out.ok) {
      onToast(t.tools.publish.published);
      onChanged();
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
  }, [domain, tls, panelId, token, dir, onToast, onChanged, reload, t.tools.publish.published, t.toasts.error]);

  const doUnpublish = useCallback(async () => {
    setConfirmBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/files/privacy/unpublish", { path: dir, domain }));
    setConfirmBusy(false);
    if (out.ok) {
      onToast(t.tools.publish.unpublished);
      onChanged();
      void reload();
    } else onToast(out.error ?? t.toasts.error, true);
    setConfirm(false);
  }, [panelId, token, dir, domain, onToast, onChanged, reload, t.tools.publish.unpublished, t.toasts.error]);

  const isProt = !!status?.protected;
  const publicUrl = status?.enforcement?.publicUrl ?? null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.tools.publish.intro}</Text>
      {loading ? (
        <ModuleLoading label={t.tools.publish.loading} />
      ) : (
        <>
          {!isProt ? <InfoBox tone="warn">{t.tools.publish.needProtect}</InfoBox> : null}
          {publicUrl ? <Text numberOfLines={1} style={{ color: tokens.brand, fontSize: 12 }}>{formatMessage(t.tools.publish.publicUrl, { url: publicUrl })}</Text> : null}
          {sites.length === 0 ? (
            <InfoBox tone="warn">{t.tools.publish.sitesEmpty}</InfoBox>
          ) : (
            <>
              <Field label={t.tools.publish.domain}>
                <Select value={domain} onChange={setDomain} placeholder={t.tools.publish.domainPlaceholder} options={sites.map((s) => ({ value: s.domain, label: s.ssl ? `${s.domain} (TLS)` : s.domain }))} />
              </Field>
              <Checkbox value={tls} onChange={setTls} label={t.tools.publish.tls} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button label={t.tools.publish.publish} icon={<GlobeIcon size={16} />} onPress={() => void publish()} loading={busy === "publish"} disabled={busy !== "" || !isProt || !domain} style={{ flex: 1 }} />
                <Button label={t.tools.publish.unpublish} variant="danger" onPress={() => setConfirm(true)} loading={busy === "unpublish"} disabled={busy !== "" || !domain} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </>
      )}

      {confirm ? (
        <ConfirmDialog
          visible
          title={t.tools.publish.unpublishTitle}
          message={t.tools.publish.unpublishMessage}
          confirmLabel={t.tools.publish.confirmUnpublish}
          cancelLabel={t.tools.cancel}
          danger
          submitting={confirmBusy}
          onConfirm={doUnpublish}
          onCancel={() => setConfirm(false)}
        />
      ) : null}
    </View>
  );
}

// ── Exposición web: archivos sensibles accesibles + bloqueo .htaccess (#3/#16) ─
function ExposureTab({ panelId, token, dir, onToast, onChanged }: ToolTabProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ExposureScan | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    const res = await callServerApi(panelId, token, "GET", `/api/files/exposure/scan?path=${encodeURIComponent(dir)}`);
    setScanning(false);
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    setResult(unwrap<ExposureScan>(res) ?? { findings: [] });
  }, [panelId, token, dir, onToast, t.toasts.error]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const block = useCallback(
    async (p: string) => {
      setBusyPath(p);
      const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/files/exposure/block", { path: p }));
      setBusyPath(null);
      if (out.ok) {
        onToast(t.tools.exposure.blocked);
        onChanged();
        void scan();
      } else onToast(out.error ?? t.toasts.error, true);
    },
    [panelId, token, onToast, onChanged, scan, t.tools.exposure.blocked, t.toasts.error],
  );

  const findings = result?.findings ?? [];
  const roots = result?.rootsScanned ?? [];
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.tools.exposure.intro}</Text>
      <Button label={t.tools.scan} icon={<SearchIcon size={16} />} variant="secondary" size="sm" onPress={() => void scan()} loading={scanning} />

      {scanning ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
          <ActivityIndicator color={tokens.brand} />
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.scanning}</Text>
        </View>
      ) : findings.length === 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.exposure.noFindings}</Text>
          {roots.length ? <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{formatMessage(t.tools.exposure.rootsScanned, { n: roots.length })}</Text> : null}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {result?.truncated ? <InfoBox tone="warn">{t.tools.malware.truncated}</InfoBox> : null}
          <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{formatMessage(t.tools.exposure.findings, { n: findings.length })}</Text>
          {findings.slice(0, 100).map((f, i) => (
            <View key={`${f.path}-${i}`} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{f.name || (f.path || "").split("/").pop() || f.path}</Text>
                <Pill tokens={tokens} kind={f.risk === "high" ? "danger" : "warn"} label={f.risk === "high" ? t.tools.exposure.riskHigh : t.tools.exposure.riskMedium} />
              </View>
              {f.url ? <Text numberOfLines={1} style={{ color: tokens.brand, fontSize: 11 }}>{f.url}</Text> : null}
              <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{f.path}</Text>
              {f.reason ? <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{f.reason}</Text> : null}
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Button label={t.tools.exposure.block} icon={<ShieldLockIcon size={16} />} variant="danger" size="sm" loading={busyPath === f.path} onPress={() => void block(f.path)} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Imágenes: optimización (WebP / comprimir / redimensionar / responsive, #22) ─
function ImagesTab({ panelId, token, dir, onToast, onChanged }: ToolTabProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [caps, setCaps] = useState<ImageCapabilities | null>(null);
  const [scanning, setScanning] = useState(false);
  const [images, setImages] = useState<LargeImage[]>([]);
  const [target, setTarget] = useState<LargeImage | null>(null);

  const loadCaps = useCallback(async () => {
    const res = await callServerApi(panelId, token, "GET", "/api/files/images/capabilities");
    if (res.ok) setCaps(unwrap<ImageCapabilities>(res) ?? null);
  }, [panelId, token]);

  const scan = useCallback(async () => {
    setScanning(true);
    const res = await callServerApi(panelId, token, "GET", `/api/files/images/scan?path=${encodeURIComponent(dir)}`);
    setScanning(false);
    if (!res.ok) {
      onToast(res.error ?? t.toasts.error, true);
      return;
    }
    const list = unwrap<LargeImage[]>(res);
    setImages(Array.isArray(list) ? list : []);
  }, [panelId, token, dir, onToast, t.toasts.error]);

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
    <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.tools.images.intro}</Text>

      {caps ? (
        <View style={{ gap: 6, borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10 }}>
          <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{t.tools.images.capabilitiesTitle}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {capItems.map((c) => (
              <Pill key={c.key} tokens={tokens} kind={c.on ? "ok" : "neutral"} label={`${c.label} · ${c.on ? t.tools.images.capAvailable : t.tools.images.capMissing}`} />
            ))}
          </View>
          {noTools ? <InfoBox tone="warn">{t.tools.images.noTools}</InfoBox> : null}
        </View>
      ) : null}

      <Button label={t.tools.scan} icon={<SearchIcon size={16} />} variant="secondary" size="sm" onPress={() => void scan()} loading={scanning} />

      {scanning ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
          <ActivityIndicator color={tokens.brand} />
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.scanning}</Text>
        </View>
      ) : images.length === 0 ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tools.images.noImages}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{formatMessage(t.tools.images.count, { n: images.length })}</Text>
          {images.slice(0, 150).map((img, i) => {
            const name = img.name || (img.path || "").split("/").pop() || img.path;
            const dims = img.width && img.height ? ` · ${img.width}×${img.height}` : "";
            return (
              <View key={`${img.path}-${i}`} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <PhotoIcon size={16} color={tokens.brand} />
                  <Text numberOfLines={1} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{name}</Text>
                </View>
                <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{img.path}</Text>
                <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{`${fmtBytes(img.sizeBytes ?? 0)}${dims}`}</Text>
                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <Button label={t.tools.images.optimize} icon={<WandIcon size={16} />} variant="secondary" size="sm" onPress={() => setTarget(img)} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {target ? (
        <ImageOptimizeDialog
          panelId={panelId}
          token={token}
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
    </View>
  );
}

// ── Diálogo de optimización por imagen (operación + parámetros, defensivo) ────
function ImageOptimizeDialog({
  panelId,
  token,
  image,
  onClose,
  onDone,
  onToast,
}: {
  panelId: string;
  token: string;
  image: LargeImage;
  onClose: () => void;
  onDone: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [op, setOp] = useState<ImageOp>("webp");
  const [quality, setQuality] = useState("80");
  const [width, setWidth] = useState("1280");
  const [widths, setWidths] = useState("480, 768, 1280");
  const [busy, setBusy] = useState(false);

  const opOptions = [
    { value: "webp", label: t.tools.images.opWebp },
    { value: "compress", label: t.tools.images.opCompress },
    { value: "resize", label: t.tools.images.opResize },
    { value: "responsive", label: t.tools.images.opResponsive },
  ];
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
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/files/images/process", body));
    setBusy(false);
    if (out.ok) onToast(t.tools.images.processed);
    else {
      onToast(out.error ?? t.toasts.error, true);
      return;
    }
    onDone();
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.tools.images.optimizeTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.tools.cancel} onSubmit={submit} submitLabel={t.tools.images.process} submitting={busy} />}
    >
      <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 2 }}>{image.name || (image.path || "").split("/").pop() || image.path}</Text>
      <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11, marginBottom: 4 }}>{image.path}</Text>
      <Text style={{ color: tokens.textMuted, fontSize: 11, marginBottom: 12 }}>{fmtBytes(image.sizeBytes ?? 0)}</Text>

      <Field label={t.tools.images.operation}>
        <Select value={op} onChange={(v) => setOp(v as ImageOp)} options={opOptions} />
      </Field>

      {needsQuality ? (
        <Field label={t.tools.images.quality}>
          <Input value={quality} onChangeText={setQuality} keyboardType="number-pad" autoCapitalize="none" />
        </Field>
      ) : null}

      {op === "resize" ? (
        <Field label={t.tools.images.width}>
          <Input value={width} onChangeText={setWidth} keyboardType="number-pad" autoCapitalize="none" />
        </Field>
      ) : null}

      {op === "responsive" ? (
        <Field label={t.tools.images.widths} hint={t.tools.images.widthsHint}>
          <Input value={widths} onChangeText={setWidths} placeholder={t.tools.images.widthsPlaceholder} autoCapitalize="none" autoCorrect={false} />
        </Field>
      ) : null}
    </FormDrawer>
  );
}
