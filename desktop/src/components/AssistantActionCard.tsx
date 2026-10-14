import * as React from "react";
import { ShieldCheck, Copy, Check } from "lucide-react";
import {
  request,
  configurePanelSsh,
  setupTotp,
  enableTotp,
  generateRecoveryCodes,
  getPasskeyRegistrationOptions,
  registerSecurityPasskey,
} from "../api/client";
import { startRegistration } from "../api/webauthn";
import type { ChatAction } from "./SupportChatWidget";
// Estilos de las tarjetas (`support-chat-card*`): se importan aquí (y no solo en
// SupportChatWidget) porque el card también se monta en ServerAssistantPane.
import "./SupportChatWidget.css";

/**
 * Tarjetas interactivas que el asistente despliega DENTRO del chat
 * (`client_action`). Reflejo del card del app (`app/src/components/
 * AssistantActionCard.tsx`) y del frontend — si cambias una, replica en las tres.
 *
 * SEGURIDAD: los datos sensibles (llave privada, passphrase, QR/secreto TOTP,
 * códigos de recuperación) viven SOLO en el estado local de la tarjeta y se
 * piden/envían DIRECTO al backend con el token del usuario (vía `request`, que
 * resuelve el 2FA step-up). Nunca pasan por `/portal/support/chat` ni por el
 * contexto del modelo.
 */
type CardAction = Extract<ChatAction, { type: "client_action" }>;

type ElectronPasskeyApi = {
  registerPasskey?: (a: { token: string; label: string; lang: string }) => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
};

const STRINGS = {
  en: {
    notice: "Your sensitive data is sent straight to the server, encrypted — it never goes through the assistant.",
    linuxUser: "Linux user",
    privateKey: "Private key (PEM)",
    keyPlaceholder: "SSH private key (PEM)",
    passphrase: "Passphrase",
    registerKey: "Register SSH key",
    serverIp: "Server IP",
    port: "Port",
    sshUser: "SSH user",
    keyToUse: "Key to use",
    configureSsh: "Configure SSH connection",
    save: "Save",
    saving: "Saving…",
    fillFields: "Fill in the required fields.",
    keyOk: "SSH key registered.",
    sshOk: "SSH connection configured.",
    totpTitle: "Enable 2FA",
    totpScan: "Scan the QR with your authenticator app (Google Authenticator, Authy…), or use the manual key.",
    totpSecret: "Manual key",
    totpCode: "6-digit code",
    totpEnable: "Enable 2FA",
    totpOk: "Two-factor authentication enabled.",
    totpLoading: "Generating QR…",
    recoveryTitle: "Recovery codes",
    recoveryIntro: "Generate single-use codes to sign in if you lose your authenticator.",
    recoveryGenerate: "Generate codes",
    recoveryWarn: "Save them somewhere safe. They won't be shown again.",
    recoveryOk: "Recovery codes generated.",
    copy: "Copy",
    copied: "Copied",
    passkeyTitle: "Register a passkey",
    passkeyName: "Passkey name",
    passkeyRegister: "Register passkey",
    passkeyOk: "Passkey registered.",
    passkeyUnavailable: "Passkeys aren't available on this device.",
    passkeyDefault: "My passkey",
  },
  es: {
    notice: "Tus datos sensibles se envían directo y cifrados al servidor; no pasan por el asistente.",
    linuxUser: "Usuario Linux",
    privateKey: "Llave privada (PEM)",
    keyPlaceholder: "SSH private key (PEM)",
    passphrase: "Passphrase",
    registerKey: "Registrar llave SSH",
    serverIp: "IP del servidor",
    port: "Puerto",
    sshUser: "Usuario SSH",
    keyToUse: "Llave a usar",
    configureSsh: "Configurar conexión SSH",
    save: "Guardar",
    saving: "Guardando…",
    fillFields: "Completa los campos requeridos.",
    keyOk: "Llave SSH registrada.",
    sshOk: "Conexión SSH configurada.",
    totpTitle: "Activar 2FA",
    totpScan: "Escanea el QR con tu app de autenticación (Google Authenticator, Authy…) o usa la clave manual.",
    totpSecret: "Clave manual",
    totpCode: "Código de 6 dígitos",
    totpEnable: "Activar 2FA",
    totpOk: "Autenticación en dos pasos activada.",
    totpLoading: "Generando QR…",
    recoveryTitle: "Códigos de recuperación",
    recoveryIntro: "Genera códigos de un solo uso para entrar si pierdes tu autenticador.",
    recoveryGenerate: "Generar códigos",
    recoveryWarn: "Guárdalos en un lugar seguro. No se mostrarán de nuevo.",
    recoveryOk: "Códigos de recuperación generados.",
    copy: "Copiar",
    copied: "Copiado",
    passkeyTitle: "Registrar una passkey",
    passkeyName: "Nombre de la passkey",
    passkeyRegister: "Registrar passkey",
    passkeyOk: "Passkey registrada.",
    passkeyUnavailable: "Las passkeys no están disponibles en este dispositivo.",
    passkeyDefault: "Mi passkey",
  },
  pt: {
    notice: "Seus dados sensíveis são enviados direto e criptografados ao servidor; não passam pelo assistente.",
    linuxUser: "Usuário Linux",
    privateKey: "Chave privada (PEM)",
    passphrase: "Passphrase",
    registerKey: "Registrar chave SSH",
    serverIp: "IP do servidor",
    port: "Porta",
    sshUser: "Usuário SSH",
    keyToUse: "Chave a usar",
    configureSsh: "Configurar conexão SSH",
    save: "Salvar",
    saving: "Salvando…",
    fillFields: "Preencha os campos obrigatórios.",
    keyOk: "Chave SSH registrada.",
    sshOk: "Conexão SSH configurada.",
    totpTitle: "Ativar 2FA",
    totpScan: "Escaneie o QR com seu app autenticador (Google Authenticator, Authy…) ou use a chave manual.",
    totpSecret: "Chave manual",
    totpCode: "Código de 6 dígitos",
    totpEnable: "Ativar 2FA",
    totpOk: "Autenticação em duas etapas ativada.",
    totpLoading: "Gerando QR…",
    recoveryTitle: "Códigos de recuperação",
    recoveryIntro: "Gere códigos de uso único para entrar se perder seu autenticador.",
    recoveryGenerate: "Gerar códigos",
    recoveryWarn: "Guarde-os em local seguro. Não serão mostrados novamente.",
    recoveryOk: "Códigos de recuperação gerados.",
    copy: "Copiar",
    copied: "Copiado",
    passkeyTitle: "Registrar uma passkey",
    passkeyName: "Nome da passkey",
    passkeyRegister: "Registrar passkey",
    passkeyOk: "Passkey registrada.",
    passkeyUnavailable: "Passkeys não estão disponíveis neste dispositivo.",
    passkeyDefault: "Minha passkey",
  },
  fr: {
    notice: "Vos données sensibles sont envoyées directement et chiffrées au serveur ; elles ne passent pas par l'assistant.",
    linuxUser: "Utilisateur Linux",
    privateKey: "Clé privée (PEM)",
    passphrase: "Phrase secrète",
    registerKey: "Enregistrer la clé SSH",
    serverIp: "IP du serveur",
    port: "Port",
    sshUser: "Utilisateur SSH",
    keyToUse: "Clé à utiliser",
    configureSsh: "Configurer la connexion SSH",
    save: "Enregistrer",
    saving: "Enregistrement…",
    fillFields: "Remplissez les champs requis.",
    keyOk: "Clé SSH enregistrée.",
    sshOk: "Connexion SSH configurée.",
    totpTitle: "Activer la 2FA",
    totpScan: "Scannez le QR avec votre application d'authentification (Google Authenticator, Authy…) ou utilisez la clé manuelle.",
    totpSecret: "Clé manuelle",
    totpCode: "Code à 6 chiffres",
    totpEnable: "Activer la 2FA",
    totpOk: "Authentification à deux facteurs activée.",
    totpLoading: "Génération du QR…",
    recoveryTitle: "Codes de récupération",
    recoveryIntro: "Générez des codes à usage unique pour vous connecter si vous perdez votre authentificateur.",
    recoveryGenerate: "Générer les codes",
    recoveryWarn: "Conservez-les en lieu sûr. Ils ne seront plus affichés.",
    recoveryOk: "Codes de récupération générés.",
    copy: "Copier",
    copied: "Copié",
    passkeyTitle: "Enregistrer une passkey",
    passkeyName: "Nom de la passkey",
    passkeyRegister: "Enregistrer la passkey",
    passkeyOk: "Passkey enregistrée.",
    passkeyUnavailable: "Les passkeys ne sont pas disponibles sur cet appareil.",
    passkeyDefault: "Ma passkey",
  },
  it: {
    notice: "I tuoi dati sensibili vengono inviati direttamente e cifrati al server; non passano dall'assistente.",
    linuxUser: "Utente Linux",
    privateKey: "Chiave privata (PEM)",
    passphrase: "Passphrase",
    registerKey: "Registra chiave SSH",
    serverIp: "IP del server",
    port: "Porta",
    sshUser: "Utente SSH",
    keyToUse: "Chiave da usare",
    configureSsh: "Configura connessione SSH",
    save: "Salva",
    saving: "Salvataggio…",
    fillFields: "Compila i campi obbligatori.",
    keyOk: "Chiave SSH registrata.",
    sshOk: "Connessione SSH configurata.",
    totpTitle: "Attiva 2FA",
    totpScan: "Inquadra il QR con la tua app di autenticazione (Google Authenticator, Authy…) o usa la chiave manuale.",
    totpSecret: "Chiave manuale",
    totpCode: "Codice a 6 cifre",
    totpEnable: "Attiva 2FA",
    totpOk: "Autenticazione a due fattori attivata.",
    totpLoading: "Generazione QR…",
    recoveryTitle: "Codici di recupero",
    recoveryIntro: "Genera codici monouso per accedere se perdi il tuo autenticatore.",
    recoveryGenerate: "Genera codici",
    recoveryWarn: "Conservali in un luogo sicuro. Non verranno più mostrati.",
    recoveryOk: "Codici di recupero generati.",
    copy: "Copia",
    copied: "Copiato",
    passkeyTitle: "Registra una passkey",
    passkeyName: "Nome della passkey",
    passkeyRegister: "Registra passkey",
    passkeyOk: "Passkey registrata.",
    passkeyUnavailable: "Le passkey non sono disponibili su questo dispositivo.",
    passkeyDefault: "La mia passkey",
  },
} as const;

type CardStrings = typeof STRINGS.en;

function cardT(locale: string): CardStrings {
  const base = (locale || "es").split("-")[0];
  return { ...STRINGS.en, ...((STRINGS as unknown as Record<string, Partial<CardStrings>>)[base] ?? {}) };
}

export interface AssistantActionCardProps {
  action: CardAction;
  token: string;
  language: string;
  disabled: boolean;
  onResult: (message: string) => void;
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
      return null;
  }
}

function CardShell({ title, t, children, notice = true }: { title: string; t: CardStrings; children: React.ReactNode; notice?: boolean }) {
  return (
    <div className="support-chat-card">
      <div className="support-chat-card__title">{title}</div>
      {children}
      {notice ? (
        <div className="support-chat-card__notice">
          <ShieldCheck size={13} aria-hidden="true" />
          <span>{t.notice}</span>
        </div>
      ) : null}
    </div>
  );
}

function SshKeyForm({ action, token, language, disabled, onResult, onDone }: AssistantActionCardProps) {
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
    <CardShell title={t.registerKey} t={t}>
      <label className="support-chat-card__field">
        <span>{t.linuxUser}</span>
        <input className="input input-bordered input-sm w-full" value={linuxUser} onChange={(e) => setLinuxUser(e.target.value)} disabled={disabled} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="deploy" />
      </label>
      <label className="support-chat-card__field">
        <span>{t.privateKey}</span>
        <textarea className="textarea textarea-bordered textarea-sm w-full support-chat-card__key" value={sshKey} onChange={(e) => setSshKey(e.target.value)} disabled={disabled} spellCheck={false} rows={4} placeholder={t.keyPlaceholder} />
      </label>
      <label className="support-chat-card__field">
        <span>{t.passphrase}</span>
        <input className="input input-bordered input-sm w-full" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} disabled={disabled} />
      </label>
      {err ? <div className="support-chat-card__err">{err}</div> : null}
      <button type="button" className="btn btn-primary btn-sm" disabled={disabled || busy} onClick={() => void submit()}>
        {busy ? t.saving : t.registerKey}
      </button>
    </CardShell>
  );
}

function SshServerForm({ action, token, language, disabled, onResult, onDone }: AssistantActionCardProps) {
  const t = cardT(language);
  const ctx = action.context ?? {};
  const keys = ctx.availableKeys ?? [];
  const [ip, setIp] = React.useState("");
  const [port, setPort] = React.useState(String(ctx.suggestedPort ?? 22));
  const [sshUser, setSshUser] = React.useState(ctx.suggestedUsername ?? "");
  const [keyId, setKeyId] = React.useState<string>(keys[0]?.id ?? "");
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
    <CardShell title={ctx.panelName ? `${t.configureSsh} · ${ctx.panelName}` : t.configureSsh} t={t}>
      <label className="support-chat-card__field">
        <span>{t.serverIp}</span>
        <input className="input input-bordered input-sm w-full" value={ip} onChange={(e) => setIp(e.target.value)} disabled={disabled} placeholder="203.0.113.10" spellCheck={false} />
      </label>
      <div className="support-chat-card__row">
        <label className="support-chat-card__field support-chat-card__field--port">
          <span>{t.port}</span>
          <input className="input input-bordered input-sm w-full" value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} disabled={disabled} inputMode="numeric" />
        </label>
        <label className="support-chat-card__field support-chat-card__field--grow">
          <span>{t.sshUser}</span>
          <input className="input input-bordered input-sm w-full" value={sshUser} onChange={(e) => setSshUser(e.target.value)} disabled={disabled} placeholder="root" spellCheck={false} />
        </label>
      </div>
      <label className="support-chat-card__field">
        <span>{t.keyToUse}</span>
        <select className="select select-bordered select-sm w-full" value={keyId} onChange={(e) => setKeyId(e.target.value)} disabled={disabled}>
          {keys.map((k) => (
            <option key={k.id} value={k.id}>
              {k.linuxUsername ?? k.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      {err ? <div className="support-chat-card__err">{err}</div> : null}
      <button type="button" className="btn btn-primary btn-sm" disabled={disabled || busy} onClick={() => void submit()}>
        {busy ? t.saving : t.save}
      </button>
    </CardShell>
  );
}

function TotpSetup({ token, language, disabled, onResult, onDone }: AssistantActionCardProps) {
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
    <CardShell title={t.totpTitle} t={t} notice={false}>
      <div className="support-chat-card__hint">{t.totpScan}</div>
      {setup ? (
        <>
          <img className="support-chat-card__qr" src={setup.qrDataUrl} alt="" width={160} height={160} />
          <label className="support-chat-card__field">
            <span>{t.totpSecret}</span>
            <input className="input input-bordered input-sm w-full support-chat-card__key" value={setup.secret} readOnly onFocus={(e) => e.currentTarget.select()} />
          </label>
          <label className="support-chat-card__field">
            <span>{t.totpCode}</span>
            <input className="input input-bordered input-sm w-full" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} disabled={disabled} inputMode="numeric" placeholder="000000" />
          </label>
          {err ? <div className="support-chat-card__err">{err}</div> : null}
          <button type="button" className="btn btn-primary btn-sm" disabled={disabled || busy} onClick={() => void enable()}>
            {busy ? t.saving : t.totpEnable}
          </button>
        </>
      ) : err ? (
        <div className="support-chat-card__err">{err}</div>
      ) : (
        <div className="support-chat-card__hint">{t.totpLoading}</div>
      )}
    </CardShell>
  );
}

function RecoveryCodes({ token, language, disabled, onResult, onDone }: AssistantActionCardProps) {
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
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <CardShell title={t.recoveryTitle} t={t} notice={false}>
      {codes ? (
        <>
          <div className="support-chat-card__warn">{t.recoveryWarn}</div>
          <ol className="support-chat-card__codes">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void copy()}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? t.copied : t.copy}
          </button>
        </>
      ) : (
        <>
          <div className="support-chat-card__hint">{t.recoveryIntro}</div>
          {err ? <div className="support-chat-card__err">{err}</div> : null}
          <button type="button" className="btn btn-primary btn-sm" disabled={disabled || busy} onClick={() => void generate()}>
            {busy ? t.saving : t.recoveryGenerate}
          </button>
        </>
      )}
    </CardShell>
  );
}

function PasskeyRegister({ token, language, disabled, onResult, onDone }: AssistantActionCardProps) {
  const t = cardT(language);
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const register = async () => {
    if (busy || disabled) return;
    setErr(null);
    setBusy(true);
    try {
      const name = label.trim() || t.passkeyDefault;
      // En Electron, las passkeys se crean en la ventana puente https aislada
      // (electron/main.cjs → passkey:register); fuera de Electron usamos el flujo
      // WebAuthn en página. Espejo de SecurityScreen.addPasskey.
      const electronApi = (window as unknown as { electronApi?: ElectronPasskeyApi }).electronApi;
      if (electronApi?.registerPasskey) {
        const result = await electronApi.registerPasskey({ token, label: name, lang: language });
        if (result.cancelled) {
          setBusy(false);
          return;
        }
        if (!result.ok) {
          setErr(result.error || t.passkeyUnavailable);
          setBusy(false);
          return;
        }
      } else {
        const options = await getPasskeyRegistrationOptions(token);
        const credential = await startRegistration(options);
        await registerSecurityPasskey(name, credential, token);
      }
      onResult(t.passkeyOk);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.passkeyUnavailable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell title={t.passkeyTitle} t={t} notice={false}>
      <label className="support-chat-card__field">
        <span>{t.passkeyName}</span>
        <input className="input input-bordered input-sm w-full" value={label} onChange={(e) => setLabel(e.target.value)} disabled={disabled} maxLength={128} placeholder={t.passkeyDefault} />
      </label>
      {err ? <div className="support-chat-card__err">{err}</div> : null}
      <button type="button" className="btn btn-primary btn-sm" disabled={disabled || busy} onClick={() => void register()}>
        {busy ? t.saving : t.passkeyRegister}
      </button>
    </CardShell>
  );
}

export default AssistantActionCard;
