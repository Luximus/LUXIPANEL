/**
 * AddStandaloneServerScreen — alta / re-conexión de un servidor LUXIPANEL
 * **standalone** por conexión DIRECTA (sin LP-LS).
 *
 * Réplica de la UX de "registrar servidor" managed, pero pidiendo la **URL del
 * panel + usuario Linux + contraseña** (el handshake real de `/api/login` del
 * box, ver `directAuth`). Si el box exige 2FA, muestra el paso del código TOTP.
 * Al validar, persiste el servidor (o actualiza su sesión en modo reconexión) y
 * devuelve el registro con `onDone`.
 */
import React, { useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { TextInput, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { formatMessage, getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { Field, Checkbox, InfoBox, DialogFooter } from "../../../components/server/Form";
import {
  loginStandalone,
  verifyStandaloneTotp,
  normalizeBaseUrl,
  type DirectSession,
} from "../../../api/directAuth";
import {
  addStandaloneServer,
  updateStandaloneServer,
  setStandaloneSession,
  setStandalonePassword,
  type StandaloneServer,
} from "../../../storage/standaloneServers";

function Input(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: "default" | "url" | "number-pad";
  autoCapitalize?: "none" | "sentences";
  maxLength?: number;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={tokens.textMuted}
      secureTextEntry={props.secure}
      keyboardType={props.keyboardType ?? "default"}
      autoCapitalize={props.autoCapitalize ?? "none"}
      autoCorrect={false}
      maxLength={props.maxLength}
      style={{
        backgroundColor: tokens.bgInput,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: tokens.textPrimary,
        fontSize: 15,
      }}
    />
  );
}

export function AddStandaloneServerScreen({
  existing,
  onCancel,
  onDone,
}: {
  /** Si viene, es RE-CONEXIÓN de un servidor ya guardado (pre-rellena + actualiza). */
  existing?: StandaloneServer;
  onCancel: () => void;
  onDone: (server: StandaloneServer) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverStandalone;

  const [name, setName] = useState(existing?.name ?? "");
  const [url, setUrl] = useState(existing?.baseUrl ?? "");
  const [username, setUsername] = useState(existing?.username ?? "");
  const [password, setPassword] = useState("");
  const [savePassword, setSavePassword] = useState(existing?.savePassword ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<DirectSession | null>(null);
  const [code, setCode] = useState("");

  const mapError = (errCode: string, message: string): string => {
    switch (errCode) {
      case "UNREACHABLE": return t.errUnreachable;
      case "BAD_URL": return t.errBadUrl;
      case "PASSWORD_LOGIN_DISABLED": return t.errPasswordDisabled;
      case "CAPTCHA_FAILED": return t.errCaptcha;
      case "TWO_FA_REQUIRED": return t.err2faRequired;
      default: return message || t.errGeneric;
    }
  };

  const persist = async (session: DirectSession) => {
    const base = normalizeBaseUrl(url);
    const finalName = name.trim() || base;
    const finalUser = username.trim();
    if (existing) {
      await setStandaloneSession(existing.id, session);
      await setStandalonePassword(existing.id, savePassword ? password : null);
      await updateStandaloneServer(existing.id, { name: finalName, baseUrl: base, username: finalUser, savePassword });
      onDone({ ...existing, name: finalName, baseUrl: base, username: finalUser, savePassword });
      return;
    }
    const server = await addStandaloneServer({
      name: finalName,
      baseUrl: base,
      username: finalUser,
      savePassword,
      password: savePassword ? password : undefined,
      session,
    });
    onDone(server);
  };

  const canSubmit = !!normalizeBaseUrl(url) && !!username.trim() && !!password && !submitting;

  const submit = async () => {
    setError(null);
    const base = normalizeBaseUrl(url);
    if (!base) { setError(t.errBadUrl); return; }
    setSubmitting(true);
    try {
      const r = await loginStandalone(base, username.trim(), password);
      if (r.status === "ok") { await persist(r.session); return; }
      if (r.status === "mfa") { setMfa(r.partial); return; }
      setError(mapError(r.code, r.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const submitTotp = async () => {
    if (!mfa) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await verifyStandaloneTotp(normalizeBaseUrl(url), mfa, code.trim());
      if (r.status === "ok") { await persist(r.session); return; }
      setError(mapError(r.code, r.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  // Paso 2FA: el box pidió un código TOTP.
  if (mfa) {
    return (
      <ServerModuleScreen title={t.twoFaTitle} onBack={() => { setMfa(null); setCode(""); }} error={error}>
        <InfoBox>{t.twoFaHint}</InfoBox>
        <Field label={t.twoFaTitle}>
          <Input value={code} onChangeText={setCode} placeholder={t.twoFaPlaceholder} keyboardType="number-pad" maxLength={6} />
        </Field>
        <View style={{ flexDirection: "row" }}>
          <DialogFooter
            onCancel={() => { setMfa(null); setCode(""); }}
            cancelLabel={t.cancel}
            onSubmit={() => void submitTotp()}
            submitLabel={t.verify}
            submitting={submitting}
            disabled={code.trim().length < 6}
          />
        </View>
      </ServerModuleScreen>
    );
  }

  return (
    <ServerModuleScreen title={t.addTitle} onBack={onCancel} error={error}>
      <InfoBox>{t.addHint}</InfoBox>
      <Field label={t.fieldUrl}>
        <Input value={url} onChangeText={setUrl} placeholder={t.fieldUrlPlaceholder} keyboardType="url" />
      </Field>
      <Field label={t.fieldName}>
        <Input value={name} onChangeText={setName} placeholder={t.fieldNamePlaceholder} autoCapitalize="sentences" />
      </Field>
      <Field label={t.fieldUser}>
        <Input value={username} onChangeText={setUsername} placeholder={t.fieldUserPlaceholder} />
      </Field>
      <Field label={t.fieldPassword}>
        <Input value={password} onChangeText={setPassword} placeholder={t.fieldPasswordPlaceholder} secure />
      </Field>
      <View style={{ marginBottom: 14, gap: 6 }}>
        <Checkbox value={savePassword} onChange={setSavePassword} label={t.savePassword} />
        <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{formatMessage(t.savePasswordHint, {})}</Text>
      </View>
      <View style={{ flexDirection: "row" }}>
        <DialogFooter
          onCancel={onCancel}
          cancelLabel={t.cancel}
          onSubmit={() => void submit()}
          submitLabel={t.testAndSave}
          submitting={submitting}
          disabled={!canSubmit}
        />
      </View>
    </ServerModuleScreen>
  );
}
