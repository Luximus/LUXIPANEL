import { nativeText } from '../../../i18n/native-text';
import { localizeServerError } from '../../../lib/server-error-localization';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { ModuleLoading } from "../../../components/server/ModuleLoading";
/** Diálogos de acciones de usuario: cambiar contraseña (2FA), llaves SSH y
 *  generar llave de acceso. Réplica de `#dialog-change-pw`, `#dialog-ssh-keys`,
 *  `#dialog-gen-key`/`#dialog-user-key` de users/index.astro. */
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Field, DialogFooter, InfoBox } from "../../../components/server/Form";
import { TablerTrash, TablerCopy } from "../../../features/app/tabler-icons";
import { runServerMutation, useServerResource } from "../../../hooks/useServerApi";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ServerUser } from "./types";

type Ctx = { panelId: string; token: string; user: ServerUser; onClose: () => void; onToast: (msg: string, err?: boolean) => void };

// ── Cambiar contraseña ──────────────────────────────────────────────────────
export function ChangePwDialog({ panelId, token, user, onClose, onToast }: Ctx) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverUsers;
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { if (!pending.current) onClose(); };

  const submit = async () => {
    if (pending.current) return;
    pending.current = true; setSubmitting(true); setError(null);
    try {
      const result = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", `/api/users/${encodeURIComponent(String(user.id))}/password`, {password, totpCode:totp}));
      if (!result.ok) { setError(result.error ?? t.toasts.saveFailed); return; }
      onToast(t.toasts.passwordChanged); onClose();
    } finally { pending.current = false; setSubmitting(false); }
  };

  return (
    <FormDrawer
      visible
      onClose={close}
      title={formatMessage(t.titles.changePassword, { username: user.username })}
      language={language}
      footer={
        <DialogFooter onCancel={close} cancelLabel={t.changePwDialog.btnCancel} onSubmit={submit} submitLabel={t.changePwDialog.btnSubmit} submitting={submitting} />
      }
    >
      <InfoBox tone="warn">{t.changePwDialog.infoText}</InfoBox>
      {error ? <InfoBox tone="danger">{localizeServerError(error)}</InfoBox> : null}
      <Field label={t.changePwDialog.labelNewPassword} hint={t.changePwDialog.passwordStrengthHint}>
        <Input value={password} onChangeText={setPassword} secureTextEntry secureToggle autoCapitalize="none" />
      </Field>
      <Field label={t.changePwDialog.labelTotp}>
        <Input value={totp} onChangeText={setTotp} placeholder="000000" keyboardType="number-pad" maxLength={10} />
      </Field>
      <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{t.changePwDialog.twoFaHintBody}</Text>
    </FormDrawer>
  );
}

// ── Llaves SSH ──────────────────────────────────────────────────────────────
type SshKey = { id: string; comment?: string; type?: string; preview?: string };

export function SshKeysDialog({ panelId, token, user, onClose, onToast }: Ctx) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverUsers;
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const { askConfirmation, confirmation } = useConfirmation(language);
  const route = `/api/users/${encodeURIComponent(String(user.id))}/ssh-keys`;
  const resource = useServerResource<SshKey[]>(() => callServerApi(panelId, token, "GET", `${route}?username=${encodeURIComponent(user.username)}`), [panelId, token, route, user.username]);
  const keys = Array.isArray(resource.data) ? resource.data : [];
  const loading = resource.loading;
  const close = () => { if (!pending.current) onClose(); };
  const mutateKey = async (method: "POST" | "DELETE", body: Record<string, string>) => {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError(null);
    try {
      const result = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, route, {...body, username:user.username}));
      if (!result.ok) { setError(result.error ?? t.toasts.saveFailed); return false; }
      if (method === "POST") setNewKey("");
      onToast(method === "POST" ? t.toasts.keyAdded : t.toasts.keyDeleted);
      await resource.reload();
      return true;
    } finally { pending.current = false; setBusy(false); }
  };
  const add = () => { if (newKey.trim()) void mutateKey("POST", {publicKey:newKey.trim()}); };
  const remove = (id: string) => askConfirmation(nativeText("Eliminar llave SSH"), nativeText("¿Eliminar esta llave de acceso del usuario?"), [
    {text:"Cancelar",style:"cancel"},
    {text:"Eliminar",style:"destructive",onPress:()=>mutateKey("DELETE",{keyId:id})},
  ]);

  return (
    <FormDrawer visible onClose={close} title={formatMessage(t.titles.sshKeys, { username: user.username })} language={language}>
      <InfoBox>{t.sshKeysDialog.info}</InfoBox>
      {error || resource.error ? <InfoBox tone="danger">{localizeServerError(error ?? resource.error)}</InfoBox> : null}
      {resource.error ? <Button label={nativeText("Reintentar")} onPress={() => void resource.reload()} /> : null}
      {confirmation}
      {loading ? (
        <ModuleLoading label={t.sshKeysDialog.loadingKeys} />
      ) : keys.length === 0 ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13, paddingVertical: 8 }}>{t.empty.noSshKeys}</Text>
      ) : (
        keys.map((k, idx) => (
          <View key={k.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: idx === keys.length - 1 ? 0 : 1, borderBottomColor: tokens.border }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 13 }}>{k.comment || k.type || "ssh-key"}</Text>
              {k.preview ? <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11 }}>{k.type} {k.preview}</Text> : null}
            </View>
            <Pressable disabled={busy} onPress={() => remove(k.id)} hitSlop={8} style={{ padding: 4 }}>
              <TablerTrash size={18} color={tokens.danger} />
            </Pressable>
          </View>
        ))
      )}
      <View style={{ marginTop: 14 }}>
        <Field label={t.sshKeysDialog.labelAddKey}>
          <Input value={newKey} onChangeText={setNewKey} placeholder={t.sshKeysDialog.placeholderKey} multiline autoCapitalize="none" style={{ minHeight: 70 }} />
        </Field>
        <Button label={t.sshKeysDialog.btnAddKey} onPress={add} loading={busy} />
      </View>
    </FormDrawer>
  );
}

// ── Generar llave de acceso (+ resultado) ───────────────────────────────────
type GenResult = { privateKey?: string; publicKey?: string; fingerprint?: string };

export function GenKeyDialog({ panelId, token, user, onClose, onToast }: Ctx) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverUsers;
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { if (!pending.current) onClose(); };
  const [result, setResult] = useState<GenResult | null>(null);

  const generate = async () => {
    if (pending.current) return;
    pending.current = true; setSubmitting(true); setError(null);
    try {
      const res = await callServerApi(panelId, token, "POST", `/api/users/${encodeURIComponent(String(user.id))}/login-key`, {passphrase:password, username:user.username});
      const data = unwrap<GenResult>(res);
      if (res.ok && data && (data.privateKey || data.publicKey)) { setResult(data); setPassword(""); }
      else setError((res.data as {error?:string} | undefined)?.error ?? res.error ?? t.toasts.saveFailed);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.toasts.saveFailed); }
    finally { pending.current = false; setSubmitting(false); }
  };

  const copy = async (value: string | undefined) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    onToast(t.toasts.copied);
  };

  if (result) {
    return (
      <Modal visible onClose={close} title={t.keyResultDialog.title} language={language} footer={<Button label={t.keyResultDialog.btnDone} onPress={onClose} style={{ flex: 1 }} />}>
        <InfoBox tone="warn">{t.keyResultDialog.warning}</InfoBox>
        <Field label={t.keyResultDialog.labelPrivateKey}>
          <KeyBox value={result.privateKey ?? ""} tokens={tokens} />
          <Button label={t.keyResultDialog.btnCopyPrivate} variant="secondary" size="sm" icon={<TablerCopy size={15} />} onPress={() => copy(result.privateKey)} style={{ marginTop: 8 }} />
        </Field>
        <Field label={t.keyResultDialog.labelPublicKey}>
          <KeyBox value={result.publicKey ?? ""} tokens={tokens} />
          <Button label={t.keyResultDialog.btnCopyPublic} variant="secondary" size="sm" icon={<TablerCopy size={15} />} onPress={() => copy(result.publicKey)} style={{ marginTop: 8 }} />
        </Field>
        {result.fingerprint ? (
          <Text style={{ color: tokens.textMuted, fontSize: 11 }}>
            {t.keyResultDialog.fingerprintLabel} {result.fingerprint}
          </Text>
        ) : null}
      </Modal>
    );
  }

  return (
    <FormDrawer
      visible
      onClose={close}
      title={formatMessage(t.titles.genKey, { username: user.username })}
      language={language}
      footer={<DialogFooter onCancel={close} cancelLabel={t.genKeyDialog.btnCancel} onSubmit={generate} submitLabel={t.genKeyDialog.btnGenerate} submitting={submitting} />}
    >
      <InfoBox>{t.genKeyDialog.info}</InfoBox>
      {error ? <InfoBox tone="danger">{localizeServerError(error)}</InfoBox> : null}
      <Field label={t.genKeyDialog.labelPassword} hint={t.genKeyDialog.passwordHelp}>
        <Input value={password} onChangeText={setPassword} secureTextEntry secureToggle autoCapitalize="none" />
      </Field>
    </FormDrawer>
  );
}

function KeyBox({ value, tokens }: { value: string; tokens: { bgInput: string; border: string; textSecondary: string } }) {
  return (
    <ScrollView style={{ maxHeight: 120, borderRadius: 8, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgInput, padding: 8 }} nestedScrollEnabled>
      <Text selectable style={{ color: tokens.textSecondary, fontSize: 11, fontFamily: "monospace" }}>
        {value}
      </Text>
    </ScrollView>
  );
}
