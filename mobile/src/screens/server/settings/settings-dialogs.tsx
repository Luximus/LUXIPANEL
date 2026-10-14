import { FormDrawer } from "../../../components/ui/FormDrawer";
import { ModuleLoading } from "../../../components/server/ModuleLoading";
/**
 * settings-dialogs — diálogos del módulo Ajustes extraídos de SettingsViewScreen
 * sin cambio de comportamiento: alta 2FA (TOTP), credenciales de token/almacén,
 * detalle de ticket de soporte y asignación de imagen de branding.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { Field, InfoBox, DialogFooter, ConfirmDialog } from "../../../components/server/Form";
import { pillColors } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Modal } from "../../../components/ui/Modal";
import { serverSettingsApi, unwrap, callServerApi } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { TablerSend } from "./settings-icons";
import {
  type StorageCred,
  type TicketDetail,
  type TokenConnector,
  fmtDate,
  statusKind,
  statusLabel,
} from "./settings-types";

export function TotpSetupDialog({ panelId, token, secret, onClose, onDone, onError }: { panelId: string; token: string; secret?: string; onClose: () => void; onDone: () => void; onError: () => void }) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverSettings;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const enable = async () => {
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/auth/totp/enable", { code, token: code }));
    setBusy(false);
    if (out.ok) onDone();
    else throw new Error(out.error ?? t.toasts.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={t.security.twoFaTitle} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.security.cancel} onSubmit={enable} submitLabel={t.security.enable} submitting={busy} />}>
      {secret ? (
        <Field label={t.security.secretLabel}>
          <Text selectable style={{ color: tokens.textSecondary, fontSize: 13, fontFamily: "monospace", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgInput }}>{secret}</Text>
        </Field>
      ) : (
        <InfoBox tone="warn">{t.toasts.error}</InfoBox>
      )}
      <Field label={t.security.codeLabel}>
        <Input value={code} onChangeText={setCode} placeholder="000000" keyboardType="number-pad" maxLength={10} />
      </Field>
    </FormDrawer>
  );
}

export function TokenCredDialog({ panelId, token, connector, onClose, onSaved, onError }: { panelId: string; token: string; connector: TokenConnector; onClose: () => void; onSaved: () => void; onError: (e?: string) => void }) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverSettings;
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", connector.base, { [connector.putKey]: value }));
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={`${t.credentials.saveTitle} · ${connector.label}`} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.cancel} onSubmit={submit} submitLabel={t.credentials.save} submitting={busy} disabled={!value.trim()} />}>
      <Field label={t.credentials.tokenLabel}>
        <Input value={value} onChangeText={setValue} placeholder={t.credentials.tokenPlaceholder} autoCapitalize="none" autoCorrect={false} secureToggle secureTextEntry />
      </Field>
    </FormDrawer>
  );
}

export function StorageCredDialog({ panelId, token, provider, label, existing, onClose, onSaved, onError }: { panelId: string; token: string; provider: string; label: string; existing?: StorageCred; onClose: () => void; onSaved: () => void; onError: (e?: string) => void }) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverSettings;
  const isR2 = provider === "r2";
  const [accountId, setAccountId] = useState(existing?.accountId ?? "");
  const [endpoint, setEndpoint] = useState(existing?.endpoint ?? "");
  const [region, setRegion] = useState(existing?.region ?? "");
  const [accessKeyId, setAccessKeyId] = useState(existing?.accessKeyId ?? "");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const body: Record<string, string> = { accessKeyId };
    if (isR2) body.accountId = accountId;
    else {
      body.endpoint = endpoint;
      body.region = region;
    }
    if (secret) body.secretAccessKey = secret;
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", `/api/backups/provider-creds/${provider}`, body));
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={`${t.credentials.saveTitle} · ${label}`} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.cancel} onSubmit={submit} submitLabel={t.credentials.save} submitting={busy} disabled={!accessKeyId.trim()} />}>
      {isR2 ? (
        <Field label={t.credentials.accountId}>
          <Input value={accountId} onChangeText={setAccountId} autoCapitalize="none" autoCorrect={false} />
        </Field>
      ) : (
        <>
          <Field label={t.credentials.endpoint}>
            <Input value={endpoint} onChangeText={setEndpoint} autoCapitalize="none" autoCorrect={false} placeholder="https://s3.amazonaws.com" />
          </Field>
          <Field label={t.credentials.region}>
            <Input value={region} onChangeText={setRegion} autoCapitalize="none" autoCorrect={false} placeholder="us-east-1" />
          </Field>
        </>
      )}
      <Field label={t.credentials.accessKeyId}>
        <Input value={accessKeyId} onChangeText={setAccessKeyId} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t.credentials.secretAccessKey} hint={existing?.hasSecret ? t.credentials.secretKeep : undefined}>
        <Input value={secret} onChangeText={setSecret} autoCapitalize="none" autoCorrect={false} secureToggle secureTextEntry placeholder={existing?.hasSecret ? "••••••••" : ""} />
      </Field>
    </FormDrawer>
  );
}


export function AssignImageDialog({
  panelId,
  token,
  image,
  onClose,
  onAssigned,
  onError,
}: {
  panelId: string;
  token: string;
  image: { url: string; name: string };
  onClose: () => void;
  onAssigned: () => void;
  onError: (e?: string) => void;
}) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverSettings;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const [target, setTarget] = useState("layout_logo_primary");
  const [busy, setBusy] = useState(false);
  const options = [
    { value: "layout_logo_primary", label: t.appearance.targetLogoPrimary },
    { value: "layout_logo_sidebar", label: t.appearance.targetLogoSidebar },
    { value: "layout_logo_login", label: t.appearance.targetLogoLogin },
    { value: "layout_logo_footer", label: t.appearance.targetLogoFooter },
    { value: "layout_favicon", label: t.appearance.targetFavicon },
  ];
  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => serverSettingsApi.set(panelId, token, { key: target, value: image.url, category: "layout" }));
    setBusy(false);
    if (out.ok) onAssigned();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={t.appearance.assignTitle} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.appearance.cancel} onSubmit={submit} submitLabel={t.appearance.assign} submitting={busy} />}>
      <Field label={image.name}>
        <Text selectable style={{ color: tokens.textSecondary, fontSize: 12, fontFamily: "monospace", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgInput }}>{image.url}</Text>
      </Field>
      <Field label={t.appearance.assignTargetLabel}>
        <Select value={target} onChange={setTarget} options={options} />
      </Field>
    </FormDrawer>
  );
}
