import { localizeServerError } from '../../../lib/server-error-localization';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { ModuleLoading } from "../../../components/server/ModuleLoading";
/**
 * files-dialogs — diálogos del módulo Archivos extraídos de FilesScreen sin
 * cambio de comportamiento: operaciones avanzadas (copiar/chmod/chown/
 * comprimir/extraer), privacidad de directorio (.htpasswd), enlaces de
 * compartir y visor de contenido de comprimidos.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, type ThemeTokens } from "../../../theme/colors";
import { archiveKeyExtractor } from "./files-list-logic";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ConfirmDialog, Field, DialogFooter, InfoBox } from "../../../components/server/Form";
import { pillColors } from "../../../components/server/badges";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Modal } from "../../../components/ui/Modal";
import { TablerTrash, TablerFile } from "../../../features/app/tabler-icons";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { CopyIcon, ShareIcon, ShieldLockIcon } from "./files-icons";
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
  panelId,
  token,
  kind,
  entry,
  onClose,
  onDone,
  onError,
}: {
  panelId: string;
  token: string;
  kind: OpKind;
  entry: Entry;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

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
    void callServerApi(panelId, token, "GET", `/api/files/permissions/recommend?path=${encodeURIComponent(entry.path)}`)
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
  }, [kind, panelId, token, entry.path]);

  const setFmt = (f: string) => {
    setFormat(f);
    setArchiveDest((cur) => stripArchiveExt(cur) + extForFormat(f));
  };

  const title =
    kind === "copy" ? t.ops.copyTitle : kind === "chmod" ? t.ops.chmodTitle : kind === "chown" ? t.ops.chownTitle : kind === "compress" ? t.ops.compressTitle : t.ops.extractTitle;

  const submit = async () => {
    let op: Parameters<typeof runServerMutation>[2] | null = null;
    let okMsg = "";
    if (kind === "copy") {
      const to = dest.trim();
      if (!to || to === entry.path) return;
      op = () => callServerApi(panelId, token, "POST", "/api/files/copy", { from: entry.path, to });
      okMsg = t.ops.copied;
    } else if (kind === "chmod") {
      const m = mode.trim();
      if (!/^[0-7]{3,4}$/.test(m)) {
        throw new Error(t.ops.chmodInvalid);
      }
      op = () => callServerApi(panelId, token, "PUT", "/api/files/chmod", { path: entry.path, mode: m });
      okMsg = t.ops.chmodChanged;
    } else if (kind === "chown") {
      const o = owner.trim();
      if (!o) return;
      const g = group.trim();
      op = () => callServerApi(panelId, token, "PUT", "/api/files/chown", { path: entry.path, owner: o, ...(g ? { group: g } : {}) });
      okMsg = t.ops.chownChanged;
    } else if (kind === "compress") {
      const d = archiveDest.trim();
      if (!d) return;
      op = () => callServerApi(panelId, token, "POST", "/api/files/compress", { sources: [entry.path], dest: d, format });
      okMsg = t.ops.compressed;
    } else {
      const d = extractDest.trim();
      if (!d) return;
      op = () => callServerApi(panelId, token, "POST", "/api/files/extract", { archive: entry.path, destDir: d });
      okMsg = t.ops.extracted;
    }
    if (!op) return;
    setBusy(true);
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onDone(okMsg);
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.ops.cancel} onSubmit={submit} submitLabel={t.ops.save} submitting={busy} />}
    >
      <Text style={{ color: tokens.textMuted, fontSize: 12, marginBottom: 12 }} numberOfLines={1}>{entry.path}</Text>

      {kind === "copy" ? (
        <Field label={t.ops.copyLabel} hint={t.ops.copyHint}>
          <Input value={dest} onChangeText={setDest} autoCapitalize="none" autoCorrect={false} />
        </Field>
      ) : null}

      {kind === "chmod" ? (
        <>
          {recLoading ? (
            <ModuleLoading label={t.privacy.loading} />
          ) : rec ? (
            <InfoBox tone={rec.level === "danger" ? "danger" : rec.level === "warning" ? "warn" : "info"}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{formatMessage(t.ops.chmodCurrent, { mode: rec.mode ?? "—" })}</Text>
                <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{formatMessage(t.ops.chmodRecommended, { mode: rec.recommended ?? "—" })}</Text>
                {(rec.reasons ?? []).slice(0, 3).map((r, i) => (
                  <Text key={i} style={{ color: tokens.textMuted, fontSize: 11 }}>• {r}</Text>
                ))}
                {rec.recommended ? (
                  <Pressable onPress={() => setMode(rec.recommended ?? "")} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                    <Text style={{ color: tokens.brand, fontSize: 12, fontWeight: "600" }}>{t.ops.chmodUseRecommended}</Text>
                  </Pressable>
                ) : null}
              </View>
            </InfoBox>
          ) : null}
          <Field label={t.ops.chmodLabel}>
            <Input value={mode} onChangeText={setMode} placeholder={t.ops.chmodPlaceholder} keyboardType="number-pad" autoCapitalize="none" />
          </Field>
        </>
      ) : null}

      {kind === "chown" ? (
        <>
          <Field label={t.ops.chownOwner}>
            <Input value={owner} onChangeText={setOwner} placeholder="www-data" autoCapitalize="none" autoCorrect={false} />
          </Field>
          <Field label={t.ops.chownGroup}>
            <Input value={group} onChangeText={setGroup} placeholder="www-data" autoCapitalize="none" autoCorrect={false} />
          </Field>
        </>
      ) : null}

      {kind === "compress" ? (
        <>
          <Field label={t.ops.compressFormat}>
            <Select value={format} onChange={setFmt} options={[{ value: "tar.gz", label: "tar.gz" }, { value: "tar.bz2", label: "tar.bz2" }, { value: "zip", label: "zip" }]} />
          </Field>
          <Field label={t.ops.compressDest}>
            <Input value={archiveDest} onChangeText={setArchiveDest} autoCapitalize="none" autoCorrect={false} />
          </Field>
        </>
      ) : null}

      {kind === "extract" ? (
        <Field label={t.ops.extractDest}>
          <Input value={extractDest} onChangeText={setExtractDest} autoCapitalize="none" autoCorrect={false} />
        </Field>
      ) : null}
    </FormDrawer>
  );
}

// ── Privacidad de directorio (.htpasswd) ─────────────────────────────────────
export function PrivacyDialog({ panelId, token, dir, onClose, onToast }: { panelId: string; token: string; dir: string; onClose: () => void; onToast: (m: string, e?: boolean) => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [realm, setRealm] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const close = () => { if (!pending.current) onClose(); };
  const [confirm, setConfirm] = useState<{ kind: "unprotect" } | { kind: "removeUser"; name: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const res = await callServerApi(panelId, token, "GET", `/api/files/privacy?path=${encodeURIComponent(dir)}`);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error ?? t.toasts.error);
      setStatus(null);
      return;
    }
    setStatus(unwrap<PrivacyStatus>(res) ?? null);
  }, [panelId, token, dir, t.toasts.error]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const protect = async () => {
    const u = username.trim();
    if (!u || !password) return;
    if (pending.current) return;
    pending.current = true; setBusy(true); setMutationError(null);
    const r = realm.trim();
    const out = await runServerMutation(panelId, token, () =>
      callServerApi(panelId, token, "POST", "/api/files/privacy/protect", { path: dir, username: u, password, ...(r ? { realm: r } : {}) }),
    );
    pending.current = false; setBusy(false);
    if (out.ok) {
      onToast(t.privacy.savedToast);
      setUsername("");
      setPassword("");
      void reload();
    } else setMutationError(out.error ?? t.toasts.error);
  };

  const doConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    const op =
      confirm.kind === "unprotect"
        ? () => callServerApi(panelId, token, "POST", "/api/files/privacy/unprotect", { path: dir })
        : () => callServerApi(panelId, token, "POST", "/api/files/privacy/user/remove", { path: dir, username: confirm.name });
    const out = await runServerMutation(panelId, token, op);
    setConfirmBusy(false);
    if (out.ok) {
      onToast(confirm.kind === "unprotect" ? t.privacy.unprotectedToast : t.privacy.removedUserToast);
      void reload();
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirm(null);
  };

  const isProt = !!status?.protected;
  const users = status?.users ?? [];
  const enforced = !!status?.enforcement?.enforced;

  return (
    <>
      <FormDrawer visible onClose={close} title={t.privacy.title} language={language} fillHeight footer={<Button label={t.privacy.close} variant="ghost" disabled={busy} onPress={close} style={{ flex: 1 }} />}>
        <Text style={{ color: tokens.textMuted, fontSize: 12, marginBottom: 4 }}>{t.privacy.subtitle}</Text>
        <Text style={{ color: tokens.textMuted, fontSize: 11, marginBottom: 12 }} numberOfLines={1}>{dir}</Text>
        {loading ? (
          <ModuleLoading label={t.privacy.loading} />
        ) : err ? (
          <Text style={{ color: tokens.danger, fontSize: 13 }}>{err}</Text>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {(() => {
                const c = pillColors(tokens, isProt ? "ok" : "neutral");
                return (
                  <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
                    <Text style={{ color: c.text, fontSize: 11 }}>{isProt ? t.privacy.statusProtected : t.privacy.unprotected}</Text>
                  </View>
                );
              })()}
            </View>
            {isProt ? (
              <Text style={{ color: enforced ? tokens.success : tokens.warning, fontSize: 11 }}>{enforced ? t.privacy.enforcedOn : t.privacy.enforcedOff}</Text>
            ) : null}

            {isProt ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{t.privacy.usersTitle}</Text>
                {users.length === 0 ? (
                  <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.privacy.noUsers}</Text>
                ) : (
                  <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 8 }}>
                    {users.map((u, i) => (
                      <View key={u} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: tokens.border }}>
                        <Text numberOfLines={1} style={{ flex: 1, color: tokens.textSecondary, fontSize: 13 }}>{u}</Text>
                        <Pressable onPress={() => setConfirm({ kind: "removeUser", name: u })} hitSlop={6}>
                          <TablerTrash size={16} color={tokens.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{t.privacy.addUserTitle}</Text>
              <Field label={t.privacy.username}>
                <Input value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="user" />
              </Field>
              <Field label={t.privacy.password}>
                <Input value={password} onChangeText={setPassword} secureTextEntry secureToggle autoCapitalize="none" />
              </Field>
              <Field label={t.privacy.realmLabel}>
                <Input value={realm} onChangeText={setRealm} placeholder={t.privacy.realmPlaceholder} />
              </Field>
          {mutationError ? <InfoBox tone="danger">{localizeServerError(mutationError)}</InfoBox> : null}
              <Button label={t.privacy.add} icon={<ShieldLockIcon size={16} />} onPress={protect} loading={busy} disabled={!username.trim() || !password} />
            </View>

            {isProt ? <Button label={t.privacy.unprotect} variant="danger" onPress={() => setConfirm({ kind: "unprotect" })} /> : null}
          </View>
        )}
      </FormDrawer>

      {confirm ? (
        <ConfirmDialog
          visible
          title={confirm.kind === "unprotect" ? t.privacy.unprotectTitle : t.privacy.removeUserTitle}
          message={confirm.kind === "unprotect" ? t.privacy.unprotectMessage : formatMessage(t.privacy.removeUserMessage, { name: confirm.name })}
          confirmLabel={confirm.kind === "unprotect" ? t.privacy.confirmUnprotect : t.privacy.confirmRemove}
          cancelLabel={t.privacy.cancel}
          submitting={confirmBusy}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}

// ── Enlaces de compartir ─────────────────────────────────────────────────────
export function ShareDialog({ panelId, token, seedPath, onClose, onToast }: { panelId: string; token: string; seedPath: string; onClose: () => void; onToast: (m: string, e?: boolean) => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

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
  const pending = useRef(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const close = () => { if (!pending.current) onClose(); };
  const [revoke, setRevoke] = useState<ShareItem | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [li, ro] = await Promise.all([
      callServerApi(panelId, token, "GET", "/api/files/share"),
      callServerApi(panelId, token, "GET", "/api/files/share/roots"),
    ]);
    setLoading(false);
    if (!li.ok && !ro.ok) setErr(li.error ?? t.toasts.error);
    const list = unwrap<ShareItem[]>(li);
    setItems(Array.isArray(list) ? list : []);
    const rs = unwrap<ShareRoot[]>(ro);
    const arr = Array.isArray(rs) ? rs : [];
    setRoots(arr);
    setRoot((cur) => cur || arr[0]?.root || "");
  }, [panelId, token, t.toasts.error]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async () => {
    const p = filePath.trim();
    if (!p || !root) return;
    if (pending.current) return;
    pending.current = true; setBusy(true); setMutationError(null);
    const body = {
      path: p,
      root,
      expiresInMin: Math.max(1, Number(expires) || 60),
      ...(password ? { password } : {}),
      maxDownloads: Math.max(0, Number(maxDownloads) || 0),
    };
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/files/share", body));
    pending.current = false; setBusy(false);
    if (out.ok) {
      onToast(t.share.created);
      setPassword("");
      void reload();
    } else setMutationError(out.error ?? t.toasts.error);
  };

  const doRevoke = async () => {
    if (!revoke) return;
    setRevokeBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", `/api/files/share/${encodeURIComponent(revoke.id)}/revoke`));
    setRevokeBusy(false);
    if (out.ok) {
      onToast(t.share.revokedToast);
      void reload();
    } else throw new Error(out.error ?? t.toasts.error);
    setRevoke(null);
  };

  const copyUrl = async (url?: string) => {
    if (!url) return;
    try {
      await Clipboard.setStringAsync(url);
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
    <>
      <FormDrawer visible onClose={close} title={t.share.title} language={language} fillHeight footer={<Button label={t.share.close} variant="ghost" disabled={busy} onPress={close} style={{ flex: 1 }} />}>
        <Text style={{ color: tokens.textMuted, fontSize: 12, marginBottom: 12 }}>{t.share.subtitle}</Text>

        <View style={{ gap: 8, borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{t.share.createTitle}</Text>
          {!loading && roots.length === 0 ? <InfoBox tone="warn">{t.share.noRoots}</InfoBox> : null}
          <Field label={t.share.labelPath}>
            <Input value={filePath} onChangeText={setFilePath} placeholder={t.share.pathPlaceholder} autoCapitalize="none" autoCorrect={false} />
          </Field>
          <Field label={t.share.labelRoot}>
            <Select value={root} onChange={setRoot} placeholder={t.share.rootPlaceholder} options={roots.map((r) => ({ value: r.root, label: r.domain }))} />
          </Field>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={t.share.labelExpires}>
                <Input value={expires} onChangeText={setExpires} keyboardType="number-pad" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t.share.labelMaxDownloads}>
                <Input value={maxDownloads} onChangeText={setMaxDownloads} keyboardType="number-pad" />
              </Field>
            </View>
          </View>
          <Field label={t.share.labelPassword}>
            <Input value={password} onChangeText={setPassword} secureTextEntry secureToggle autoCapitalize="none" />
          </Field>
          {mutationError ? <InfoBox tone="danger">{localizeServerError(mutationError)}</InfoBox> : null}
          <Button label={t.share.create} icon={<ShareIcon size={16} />} onPress={create} loading={busy} disabled={!filePath.trim() || !root} />
        </View>

        {loading ? (
          <ModuleLoading label={t.share.loading} />
        ) : err ? (
          <Text style={{ color: tokens.danger, fontSize: 13 }}>{err}</Text>
        ) : items.length === 0 ? (
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.share.empty}</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((s) => {
              const revoked = !!s.revoked;
              const dPill = pillColors(tokens, "danger");
              const sPill = pillColors(tokens, "sky");
              return (
                <View key={s.id} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 6, opacity: revoked ? 0.6 : 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{s.filename || s.path || s.id}</Text>
                    {revoked ? (
                      <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: dPill.bg, borderColor: dPill.border }}>
                        <Text style={{ color: dPill.text, fontSize: 10 }}>{t.share.statusRevoked}</Text>
                      </View>
                    ) : s.hasPassword ? (
                      <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: sPill.bg, borderColor: sPill.border }}>
                        <Text style={{ color: sPill.text, fontSize: 10 }}>{t.share.statusProtected}</Text>
                      </View>
                    ) : null}
                  </View>
                  {s.url ? <Text numberOfLines={1} style={{ color: tokens.brand, fontSize: 11 }}>{s.url}</Text> : null}
                  <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{[formatMessage(t.share.downloads, { n: s.downloadCount ?? 0 }), formatMessage(t.share.expires, { when: fmtWhen(s.expiresAt) })].join(" · ")}</Text>
                  <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                    {s.url && !revoked ? <Button label={t.share.copyUrl} icon={<CopyIcon size={16} />} variant="secondary" size="sm" onPress={() => copyUrl(s.url)} /> : null}
                    {!revoked ? <Button label={t.share.revoke} icon={<TablerTrash size={16} />} variant="danger" size="sm" onPress={() => setRevoke(s)} /> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </FormDrawer>

      {revoke ? (
        <ConfirmDialog
          visible
          title={t.share.revokeTitle}
          message={t.share.revokeMessage}
          confirmLabel={t.share.confirmRevoke}
          cancelLabel={t.share.cancel}
          submitting={revokeBusy}
          onConfirm={doRevoke}
          onCancel={() => setRevoke(null)}
        />
      ) : null}
    </>
  );
}

// ── Visor de contenido de un comprimido (.tar/.zip…) ─────────────────────────
export function ArchiveContentsDialog({ panelId, token, entry, onClose }: { panelId: string; token: string; entry: Entry; onClose: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverFiles;

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void callServerApi(panelId, token, "GET", `/api/files/archive-contents?path=${encodeURIComponent(entry.path)}`)
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
  }, [panelId, token, entry.path]);

  const renderLine = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <ArchiveLine line={item} isFirst={index === 0} tokens={tokens} />
    ),
    [tokens],
  );

  return (
    // `scrollable={false}`: el scroll lo gestiona la FlatList (evita una lista
    // virtualizada dentro del ScrollView del modal, que la anularía).
    <Modal
      visible
      onClose={onClose}
      title={t.archiveView.title}
      language={language}
      fillHeight
      scrollable={false}
      footer={<Button label={t.archiveView.close} variant="ghost" onPress={onClose} style={{ flex: 1 }} />}
    >
      {/* Con `scrollable={false}` el cuerpo del Modal es una View sin padding
          (el padding vive en su `bodyContent`, que sólo aplica al ScrollView),
          así que lo reponemos aquí para que se vea EXACTAMENTE igual. */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}>
        <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 12, marginBottom: 10 }}>{entry.name}</Text>
        {loading ? (
          <ModuleLoading label={t.archiveView.loading} />
        ) : list.length === 0 ? (
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.archiveView.empty}</Text>
        ) : (
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{formatMessage(t.archiveView.entries, { n: list.length })}</Text>
            {/* Un .tar/.zip puede traer miles de entradas. Antes se pintaban las
                500 primeras de golpe con `.map()` (y el contador de arriba seguía
                anunciando el total: truncado silencioso). Virtualizado, se pintan
                TODAS y sólo se montan las visibles. */}
            <View style={{ flex: 1, borderWidth: 1, borderColor: tokens.border, borderRadius: 8, overflow: "hidden" }}>
              <FlatList
                data={list}
                keyExtractor={archiveKeyExtractor}
                renderItem={renderLine}
                removeClippedSubviews
                initialNumToRender={24}
                maxToRenderPerBatch={24}
                windowSize={11}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

/** Fila del visor de comprimidos (memoizada: la FlatList la recicla). */
const ArchiveLine = React.memo(function ArchiveLine({
  line,
  isFirst,
  tokens,
}: {
  line: string;
  isFirst: boolean;
  tokens: ThemeTokens;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: isFirst ? 0 : 1, borderTopColor: tokens.border }}>
      <TablerFile size={14} color={tokens.textMuted} />
      <Text numberOfLines={1} style={{ flex: 1, color: tokens.textSecondary, fontSize: 12, fontFamily: "monospace" }}>{line}</Text>
    </View>
  );
});
