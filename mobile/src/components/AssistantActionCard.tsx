import * as React from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { ShieldCheck, Copy, Check } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { request, configurePanelSsh, setupTotp, enableTotp, generateRecoveryCodes } from "../api/client";
import { registerPasskey, isPasskeySupported } from "../api/passkey";
import { getMessages, isLocaleCode, type LocaleCode } from "../i18n";
import { getThemeTokens } from "../theme/colors";
import { Button } from "./ui/Button";
import type { ChatAction } from "./SupportChatWidget";
import { styles, inputStyle } from "./AssistantActionCard.styles";

/**
 * Tarjetas interactivas que el asistente despliega DENTRO del chat
 * (`client_action`). El widget renderiza esta tarjeta en vez de un botón.
 *
 * SEGURIDAD: los campos sensibles (llave privada, passphrase, QR/secreto TOTP,
 * códigos de recuperación) viven SOLO en el estado local de esta tarjeta y se
 * piden/envían DIRECTO al backend con el token del usuario (vía `request` /
 * helpers de `api/client`, que resuelven el 2FA step-up). Nunca se mandan a
 * `/portal/support/chat` ni entran al contexto del modelo.
 *
 * Reflejo de los cards de desktop/frontend — si cambias uno, replica en los tres.
 * El registro de passkey llega en la Fase 4 (build nativa del app).
 *
 * i18n: sistema de mensajes del proyecto (`getMessages(locale).assistantChat
 * .actionCard`). Antes tenía su propia tabla STRINGS con solo 5 locales
 * (en/es/pt/fr/it) y los otros 6 (ru, zh, ko, ja, hi, ar) caían a inglés.
 */
type CardAction = Extract<ChatAction, { type: "client_action" }>;

type CardStrings = ReturnType<typeof getMessages>["assistantChat"]["actionCard"];

/** Textos de las tarjetas en el idioma ACTIVO de la app. Fallback "es" (misma
 *  semántica que `strings()` del asistente; `normalizeLocale` caería a inglés). */
function cardT(locale: string): CardStrings {
  const base = (locale || "es").split("-")[0];
  const code: LocaleCode = isLocaleCode(base) ? base : "es";
  return getMessages(code).assistantChat.actionCard;
}

export interface AssistantActionCardProps {
  action: CardAction;
  token: string;
  language: string;
  isDark: boolean;
  disabled: boolean;
  /** Inyecta un mensaje del asistente en el chat con el resultado. */
  onResult: (message: string) => void;
  /** Marca la acción como consumida (no re-enviar). */
  onDone: () => void;
}

export function AssistantActionCard(props: AssistantActionCardProps) {
  switch (props.action.card) {
    case "ssh_key_form":
      return <SshKeyForm {...props} />;
    case "ssh_server_form":
      return <SshServerForm {...props} />;
    case "totp_setup":
      return <TotpSetup {...props} />;
    case "recovery_codes":
      return <RecoveryCodes {...props} />;
    case "passkey_register":
      return <PasskeyRegister {...props} />;
    default:
      // Si llega una tarjeta no soportada por esta versión, no rompemos la UI.
      return null;
  }
}

function SshKeyForm({ action, token, language, isDark, disabled, onResult, onDone }: AssistantActionCardProps) {
  const tokens = getThemeTokens(isDark);
  const t = cardT(language);
  const ctx = action.context ?? {};
  const [linuxUser, setLinuxUser] = React.useState(ctx.suggestedUsername ?? "");
  const [sshKey, setSshKey] = React.useState("");
  const [passphrase, setPassphrase] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async () => {
    if (busy || disabled) return;
    if (!linuxUser.trim() || !sshKey.trim() || !passphrase.trim()) {
      setErr(t.fillFields);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await request<{ ok: boolean }>("/portal/ssh-keys", token, {
        method: "POST",
        body: JSON.stringify({
          sshKey: sshKey.trim(),
          linuxUsername: linuxUser.trim(),
          passphrase,
          ...(ctx.panelIds && ctx.panelIds.length > 0 ? { panelIds: ctx.panelIds } : {}),
        }),
      });
      onResult(t.keyOk);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.fillFields);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell title={t.registerKey} tokens={tokens} t={t}>
      <Field label={t.linuxUser} tokens={tokens}>
        <TextInput value={linuxUser} onChangeText={setLinuxUser} autoCapitalize="none" autoCorrect={false} editable={!disabled} placeholder="deploy" placeholderTextColor={tokens.textMuted} style={[styles.input, inputStyle(tokens)]} />
      </Field>
      <Field label={t.privateKey} tokens={tokens}>
        <TextInput value={sshKey} onChangeText={setSshKey} autoCapitalize="none" autoCorrect={false} editable={!disabled} multiline placeholder={t.keyPlaceholder} placeholderTextColor={tokens.textMuted} style={[styles.input, styles.inputMultiline, inputStyle(tokens)]} />
      </Field>
      <Field label={t.passphrase} tokens={tokens}>
        <TextInput value={passphrase} onChangeText={setPassphrase} autoCapitalize="none" autoCorrect={false} editable={!disabled} secureTextEntry style={[styles.input, inputStyle(tokens)]} />
      </Field>
      {err ? <Text style={[styles.err, { color: tokens.danger }]}>{err}</Text> : null}
      <Button variant="primary" size="sm" disabled={disabled || busy} label={busy ? t.saving : t.registerKey} onPress={() => void submit()} style={styles.submit} />
    </CardShell>
  );
}

function SshServerForm({ action, token, language, isDark, disabled, onResult, onDone }: AssistantActionCardProps) {
  const tokens = getThemeTokens(isDark);
  const t = cardT(language);
  const ctx = action.context ?? {};
  const keys = ctx.availableKeys ?? [];
  const [ip, setIp] = React.useState("");
  const [port, setPort] = React.useState(String(ctx.suggestedPort ?? 22));
  const [sshUser, setSshUser] = React.useState(ctx.suggestedUsername ?? "");
  const [keyId, setKeyId] = React.useState<string | null>(keys[0]?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async () => {
    if (busy || disabled) return;
    const portNum = Number(port);
    if (!ip.trim() || !sshUser.trim() || !keyId || !Number.isFinite(portNum)) {
      setErr(t.fillFields);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await configurePanelSsh(
        ctx.panelId ?? "",
        { ip: ip.trim(), port: portNum, sshUsername: sshUser.trim(), sshKeyId: keyId, saveCredentials: true },
        token,
      );
      onResult(t.sshOk);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.fillFields);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell title={ctx.panelName ? `${t.configureSsh} · ${ctx.panelName}` : t.configureSsh} tokens={tokens} t={t}>
      <Field label={t.serverIp} tokens={tokens}>
        <TextInput value={ip} onChangeText={setIp} autoCapitalize="none" autoCorrect={false} editable={!disabled} keyboardType="numbers-and-punctuation" placeholder="203.0.113.10" placeholderTextColor={tokens.textMuted} style={[styles.input, inputStyle(tokens)]} />
      </Field>
      <View style={styles.row}>
        <View style={styles.rowItemSmall}>
          <Field label={t.port} tokens={tokens}>
            <TextInput value={port} onChangeText={setPort} editable={!disabled} keyboardType="number-pad" style={[styles.input, inputStyle(tokens)]} />
          </Field>
        </View>
        <View style={styles.rowItem}>
          <Field label={t.sshUser} tokens={tokens}>
            <TextInput value={sshUser} onChangeText={setSshUser} autoCapitalize="none" autoCorrect={false} editable={!disabled} placeholder="root" placeholderTextColor={tokens.textMuted} style={[styles.input, inputStyle(tokens)]} />
          </Field>
        </View>
      </View>
      <Field label={t.keyToUse} tokens={tokens}>
        <View style={styles.chips}>
          {keys.map((k) => {
            const selected = k.id === keyId;
            return (
              <Pressable key={k.id} disabled={disabled} onPress={() => setKeyId(k.id)} style={[styles.chip, { borderColor: selected ? tokens.brand : tokens.border, backgroundColor: selected ? tokens.brandDim : tokens.bgInput }]}>
                <Text style={{ color: tokens.textPrimary, fontSize: 13 }}>{k.linuxUsername ?? k.id.slice(0, 8)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>
      {err ? <Text style={[styles.err, { color: tokens.danger }]}>{err}</Text> : null}
      <Button variant="primary" size="sm" disabled={disabled || busy} label={busy ? t.saving : t.save} onPress={() => void submit()} style={styles.submit} />
    </CardShell>
  );
}

function TotpSetup({ token, language, isDark, disabled, onResult, onDone }: AssistantActionCardProps) {
  const tokens = getThemeTokens(isDark);
  const t = cardT(language);
  const [setup, setSetup] = React.useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await setupTotp(token);
        if (alive) setSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl });
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : t.fillFields);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const enable = async () => {
    if (busy || disabled) return;
    if (!/^\d{6}$/.test(code)) {
      setErr(t.totpCode);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await enableTotp(code, token);
      onResult(t.totpOk);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.fillFields);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell title={t.totpTitle} tokens={tokens} t={t} notice={false}>
      <Text style={[styles.hint, { color: tokens.textMuted }]}>{t.totpScan}</Text>
      {setup ? (
        <>
          <Image source={{ uri: setup.qrDataUrl }} style={styles.qr} />
          <Field label={t.totpSecret} tokens={tokens}>
            <TextInput value={setup.secret} editable={false} selectTextOnFocus style={[styles.input, styles.mono, inputStyle(tokens)]} />
          </Field>
          <Field label={t.totpCode} tokens={tokens}>
            <TextInput value={code} onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))} editable={!disabled} keyboardType="number-pad" placeholder="000000" placeholderTextColor={tokens.textMuted} style={[styles.input, inputStyle(tokens)]} />
          </Field>
          {err ? <Text style={[styles.err, { color: tokens.danger }]}>{err}</Text> : null}
          <Button variant="primary" size="sm" disabled={disabled || busy} label={busy ? t.saving : t.totpEnable} onPress={() => void enable()} style={styles.submit} />
        </>
      ) : err ? (
        <Text style={[styles.err, { color: tokens.danger }]}>{err}</Text>
      ) : (
        <Text style={[styles.hint, { color: tokens.textMuted }]}>{t.totpLoading}</Text>
      )}
    </CardShell>
  );
}

function RecoveryCodes({ token, language, isDark, disabled, onResult, onDone }: AssistantActionCardProps) {
  const tokens = getThemeTokens(isDark);
  const t = cardT(language);
  const [codes, setCodes] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const generate = async () => {
    if (busy || disabled) return;
    setErr(null);
    setBusy(true);
    try {
      const list = await generateRecoveryCodes(token);
      setCodes(list);
      onResult(t.recoveryOk);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.fillFields);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!codes) return;
    await Clipboard.setStringAsync(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <CardShell title={t.recoveryTitle} tokens={tokens} t={t} notice={false}>
      {codes ? (
        <>
          <Text style={[styles.warn, { color: "#b45309", borderColor: "rgba(245,158,11,0.35)", backgroundColor: "rgba(245,158,11,0.12)" }]}>{t.recoveryWarn}</Text>
          <View style={styles.codes}>
            {codes.map((c) => (
              <Text key={c} style={[styles.codeItem, styles.mono, { color: tokens.textPrimary }]}>{c}</Text>
            ))}
          </View>
          <Button variant="secondary" size="sm" label={copied ? t.copied : t.copy} icon={copied ? <Check size={14} /> : <Copy size={14} />} onPress={() => void copy()} style={styles.submit} />
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: tokens.textMuted }]}>{t.recoveryIntro}</Text>
          {err ? <Text style={[styles.err, { color: tokens.danger }]}>{err}</Text> : null}
          <Button variant="primary" size="sm" disabled={disabled || busy} label={busy ? t.saving : t.recoveryGenerate} onPress={() => void generate()} style={styles.submit} />
        </>
      )}
    </CardShell>
  );
}

function PasskeyRegister({ token, language, isDark, disabled, onResult, onDone }: AssistantActionCardProps) {
  const tokens = getThemeTokens(isDark);
  const t = cardT(language);
  const supported = isPasskeySupported();
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const register = async () => {
    if (busy || disabled) return;
    setErr(null);
    setBusy(true);
    try {
      await registerPasskey(label.trim() || t.passkeyDefault, token);
      onResult(t.passkeyOk);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.passkeyUnavailable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell title={t.passkeyTitle} tokens={tokens} t={t} notice={false}>
      {supported ? (
        <>
          <Field label={t.passkeyName} tokens={tokens}>
            <TextInput value={label} onChangeText={setLabel} editable={!disabled} maxLength={128} placeholder={t.passkeyDefault} placeholderTextColor={tokens.textMuted} style={[styles.input, inputStyle(tokens)]} />
          </Field>
          {err ? <Text style={[styles.err, { color: tokens.danger }]}>{err}</Text> : null}
          <Button variant="primary" size="sm" disabled={disabled || busy} label={busy ? t.saving : t.passkeyRegister} onPress={() => void register()} style={styles.submit} />
        </>
      ) : (
        <Text style={[styles.hint, { color: tokens.textMuted }]}>{t.passkeyUnavailable}</Text>
      )}
    </CardShell>
  );
}

function CardShell({
  title,
  tokens,
  t,
  children,
  notice = true,
}: {
  title: string;
  tokens: ReturnType<typeof getThemeTokens>;
  t: CardStrings;
  children: React.ReactNode;
  notice?: boolean;
}) {
  return (
    <View style={[styles.card, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
      <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>{title}</Text>
      {children}
      {notice ? (
        <View style={styles.notice}>
          <ShieldCheck size={13} color={tokens.textMuted} />
          <Text style={[styles.noticeText, { color: tokens.textMuted }]}>{t.notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Field({
  label,
  tokens,
  children,
}: {
  label: string;
  tokens: ReturnType<typeof getThemeTokens>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: tokens.textSecondary ?? tokens.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

export default AssistantActionCard;
