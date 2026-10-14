import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Copy, KeyRound, Plus, QrCode, RefreshCw, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import {
  disableTotp,
  enableTotp,
  generateRecoveryCodes,
  getPasskeyRegistrationOptions,
  getRecoveryCodeStatus,
  getTotpStatus,
  listSecurityPasskeys,
  registerSecurityPasskey,
  revokeSecurityPasskey,
  setupTotp,
  type SecurityPasskey,
  type TotpSetupData,
} from "../../api/client";
import { startRegistration } from "../../api/webauthn";
import { getMessages } from "../../i18n";
import { useDialog } from "../../hooks/useDialog";
import { useToast } from "../ToastProvider";
import { useStepUp } from "../StepUpProvider";
import { StepUpCodeForm } from "../StepUpCodeForm";
import { getStepUpMethodPref, setStepUpMethodPref, type StepUpMethod } from "../../lib/stepUpMethodPref";

type SecuritySubTab = "passkeys" | "codes" | "totp";

/** Scope del gate de entrada a Seguridad (debe coincidir con el backend). */
const SECURITY_SCOPE = "security.access";

// Etiquetas de los scopes de step-up (idioma base ES; localizables a futuro).
const STEP_UP_SCOPE_LABELS: Record<string, string> = {
  "panel.edit": "Editar panel",
  "panel.delete": "Eliminar panel",
  "ssh.edit": "Editar llave SSH",
  "ssh.delete": "Eliminar llave SSH",
  "category.edit": "Editar categoría",
  "category.delete": "Eliminar categoría",
  "tag.edit": "Editar tag",
  "tag.delete": "Eliminar tag",
  "integration.edit": "Guardar integración",
  "integration.delete": "Eliminar integración",
  "apikey.generate": "Generar API key",
  "import": "Importar",
  "export": "Exportar",
  "purchase": "Realizar compra",
  "ticket.edit": "Editar ticket",
  "ticket.delete": "Eliminar ticket",
  "passkey.register": "Registrar passkey",
  "passkey.delete": "Eliminar passkey",
  "recovery.generate": "Regenerar códigos de recuperación",
};
const STEP_UP_TEXT = {
  heading: "Pedir 2FA por acción",
  help: "Elige en qué acciones se pedirá tu código 2FA. Entrar a Seguridad siempre lo pide.",
  needsTotp: "Activa 2FA para configurar dónde pedirlo.",
  methodHeading: "Método de verificación",
  methodHelp: "Elige UN método; al pedir 2FA se usará directo, sin selector. Activar uno desactiva los otros.",
  methodPasskey: "Passkey",
  methodTotp: "Código de la app (2FA)",
  methodRecovery: "Código de recuperación",
  methodUnavailable: "No configurado",
};

function formatDate(value: string | null, neverLabel: string): string {
  if (!value) return neverLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

type SecuritySnapshot = {
  passkeys: SecurityPasskey[];
  recoveryStatus: string;
  totpEnabled: boolean;
  totpStatus: string;
};
// Cache en memoria por token: Seguridad consulta la API una sola vez. Al volver
// a la pestaña se hidrata de aquí (sin refetch); las mutaciones actualizan el
// estado y el efecto de sync reescribe el cache. El botón "Actualizar" fuerza
// una recarga (load(true)). `securityLoaded` separa "ya cargó" de "tiene cache"
// para no auto-saltarse la primera carga.
const securityCache = new Map<string, SecuritySnapshot>();
const securityLoaded = new Set<string>();

export function SecurityTab({
  token,
  language,
}: {
  token: string;
  language: string;
}) {
  const t = getMessages(language);
  const s = t.security;
  const dialog = useDialog(language);
  const toast = useToast();
  const stepUp = useStepUp();
  const [activeTab, setActiveTab] = useState<SecuritySubTab>("passkeys");
  const [passkeys, setPasskeys] = useState<SecurityPasskey[]>(() => securityCache.get(token)?.passkeys ?? []);
  const [passkeyStatus, setPasskeyStatus] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState(() => securityCache.get(token)?.recoveryStatus ?? s.checking);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [totpStatus, setTotpStatus] = useState(() => securityCache.get(token)?.totpStatus ?? s.checking);
  const [totpEnabled, setTotpEnabled] = useState(() => securityCache.get(token)?.totpEnabled ?? false);
  // Método preferido para el step-up (passkey/totp/recovery); local al dispositivo.
  const [stepUpMethod, setStepUpMethod] = useState<StepUpMethod | null>(() => getStepUpMethodPref());
  const [totpSetup, setTotpSetup] = useState<TotpSetupData | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [totpInvalid, setTotpInvalid] = useState(false);
  const totpCodeRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  // Gate inline: si hay 2FA y no hay token vigente, el panel muestra el formulario
  // 2FA en vez del contenido (sin modal). El cache vive en el provider, así volver
  // a Seguridad dentro del TTL no re-pide el código.
  const [unlocked, setUnlocked] = useState(() => stepUp.isUnlocked(SECURITY_SCOPE));

  const load = useCallback(async (force = false) => {
    if (!token) return;
    // Solo la primera carga (o un refresh forzado por el usuario) consulta la
    // API; al re-entrar a la pestaña se reutiliza el estado hidratado del cache.
    if (!force && securityLoaded.has(token)) return;
    setLoading(true);
    try {
      const [keys, recovery, totp] = await Promise.all([
        listSecurityPasskeys(token),
        getRecoveryCodeStatus(token),
        getTotpStatus(token),
      ]);
      setPasskeys(keys);
      setRecoveryStatus(recovery.hasActiveCodes ? s.recoveryActive : s.recoveryEmpty);
      setTotpEnabled(Boolean(totp.enabled));
      setTotpStatus(
        totp.enabled
          ? s.totpActive
          : totp.configured
            ? s.totpConfiguredDisabled
            : s.totpNotConfigured,
      );
      securityLoaded.add(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPasskeyStatus(message);
      setRecoveryStatus(message);
      setTotpStatus(message);
    } finally {
      setLoading(false);
    }
  }, [token, s]);

  // Sin 2FA (o token ya vigente) → desbloqueado directo. Espera al bootstrap
  // (`ready`) para no decidir con `totpEnabled` aún sin resolver.
  useEffect(() => {
    if (stepUp.ready && (!stepUp.totpEnabled || stepUp.isUnlocked(SECURITY_SCOPE))) {
      setUnlocked(true);
    }
  }, [stepUp.ready, stepUp.totpEnabled, stepUp]);

  // Carga los reads de Seguridad (y luego las prefs de step-up) SOLO al estar
  // desbloqueado: así las lecturas gateadas reusan el token cacheado por el
  // formulario inline y nunca disparan el modal global.
  useEffect(() => {
    if (!unlocked) return;
    void (async () => {
      await load();
      void stepUp.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, load]);

  // Mantiene el cache en memoria sincronizado con el estado (tras la carga
  // inicial y tras cada mutación local), para hidratar sin refetch al volver.
  useEffect(() => {
    if (token && securityLoaded.has(token)) {
      securityCache.set(token, { passkeys, recoveryStatus, totpEnabled, totpStatus });
    }
  }, [token, passkeys, recoveryStatus, totpEnabled, totpStatus]);

  // Ask for the passkey name in a modal, then continue with the WebAuthn flow.
  const promptAddPasskey = async () => {
    if (!token) return;
    const label = await dialog.prompt({
      title: s.addPasskey,
      message: s.addPasskeyMessage,
      label: s.passkeyNameLabel,
      placeholder: s.passkeyPlaceholder,
      confirmLabel: s.continueLabel,
      maxLength: 128,
    });
    if (label === null) return;
    await addPasskey(label);
  };

  const addPasskey = async (label: string) => {
    if (!token) return;
    const trimmed = label.trim() || s.defaultPasskeyName;
    setPasskeyStatus(s.passkeyRequesting);
    try {
      // Passkeys are bound to a web origin and cannot be created from the
      // file:// / localhost Electron shell. In Electron, hand the ceremony to
      // the isolated https bridge window (electron/main.cjs → passkey:register);
      // outside Electron (browser/dev) fall back to the in-page WebAuthn flow.
      if (window.electronApi?.registerPasskey) {
        const result = await window.electronApi.registerPasskey({ token, label: trimmed, lang: language });
        if (result.cancelled) {
          setPasskeyStatus("");
          return;
        }
        if (!result.ok) {
          setPasskeyStatus("");
          toast.error(result.error || s.passkeyRegisterFailed);
          return;
        }
      } else {
        const options = await getPasskeyRegistrationOptions(token);
        const credential = await startRegistration(options);
        await registerSecurityPasskey(trimmed, credential, token);
      }
      setPasskeyStatus(s.passkeyRegistered);
      setPasskeys(await listSecurityPasskeys(token));
      toast.success(s.passkeyRegistered);
    } catch (error) {
      setPasskeyStatus("");
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const revokePasskey = async (id: string) => {
    if (!token) return;
    const ok = await dialog.confirm({
      title: s.revokeTitle,
      message: s.revokeMessage,
      confirmLabel: s.revoke,
      tone: "danger",
    });
    if (!ok) return;
    try {
      await revokeSecurityPasskey(id, token);
      setPasskeys(await listSecurityPasskeys(token));
      toast.success(t.toast.deleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const regenerateCodes = async () => {
    if (!token) return;
    const ok = await dialog.confirm({
      title: s.regenerateTitle,
      message: s.regenerateMessage,
      confirmLabel: s.generate,
      tone: "danger",
    });
    if (!ok) return;
    setRecoveryStatus(s.generating);
    try {
      const codes = await generateRecoveryCodes(token);
      setRecoveryCodes(codes);
      setRecoveryStatus(s.codesGenerated);
      toast.success(s.codesGenerated);
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : String(error));
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast.success(s.codesCopiedMessage);
  };

  const startTotpSetup = async () => {
    if (!token) return;
    setTotpStatus(s.totpSecretGenerating);
    setTotpError("");
    try {
      const data = await setupTotp(token);
      setTotpSetup(data);
      setTotpStatus(s.totpVerify);
    } catch (error) {
      setTotpStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const confirmTotp = async () => {
    if (!token) return;
    setTotpError("");
    // Enfoca + resalta el campo si el código no tiene los 6 dígitos requeridos.
    if (!/^\d{6}$/.test(totpCode.trim())) {
      setTotpError(s.totpCodeRequired);
      setTotpInvalid(true);
      totpCodeRef.current?.focus();
      return;
    }
    setTotpInvalid(false);
    try {
      await enableTotp(totpCode.trim(), token);
      setTotpCode("");
      setTotpSetup(null);
      const status = await getTotpStatus(token);
      setTotpEnabled(Boolean(status.enabled));
      setTotpStatus(s.totpActive);
      void stepUp.refresh();
      toast.success(s.totpActive);
    } catch (error) {
      setTotpError(error instanceof Error ? error.message : String(error));
    }
  };

  const turnOffTotp = async () => {
    if (!token) return;
    const ok = await dialog.confirm({
      title: s.disableTotpTitle,
      message: s.disableTotpMessage,
      confirmLabel: s.disable,
      tone: "danger",
    });
    if (!ok) return;
    try {
      await disableTotp(token);
      setTotpEnabled(false);
      setTotpStatus(s.totpConfiguredDisabled);
      void stepUp.refresh();
      toast.success(s.totpConfiguredDisabled);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const tabs = useMemo<Array<{ id: SecuritySubTab; label: string; icon: ReactNode }>>(
    () => [
      { id: "passkeys", label: s.tabPasskeys, icon: <KeyRound size={15} /> },
      { id: "codes", label: s.tabCodes, icon: <ShieldCheck size={15} /> },
      { id: "totp", label: s.tabTotp, icon: <ShieldCheck size={15} /> },
    ],
    [s],
  );

  // Acción primaria de la sub-pestaña (antes publicada al navbar como FAB): se
  // muestra junto al botón "Actualizar" dentro del propio panel del modal.
  const primaryAction =
    activeTab === "passkeys"
      ? { label: s.addPasskey, onClick: () => void promptAddPasskey(), icon: <Plus size={16} />, danger: false }
      : activeTab === "codes"
        ? { label: s.generateCodesShort, onClick: () => void regenerateCodes(), icon: <Plus size={16} />, danger: false }
        : totpEnabled
          ? { label: s.disable2fa, onClick: () => void turnOffTotp(), icon: <ShieldOff size={16} />, danger: true }
          : { label: s.configure2fa, onClick: () => void startTotpSetup(), icon: <ShieldCheck size={16} />, danger: false };

  // Espera al bootstrap del provider para no parpadear ni disparar el gate.
  if (!stepUp.ready) {
    return (
      <div className="support-section" aria-busy="true">
        <div className="flex items-center justify-center py-10">
          <span className="loading loading-spinner loading-md" />
        </div>
      </div>
    );
  }

  // Gate INLINE: 2FA dentro del propio panel (sin modal). Al verificar, cachea el
  // token en el provider y desbloquea el contenido.
  if (!unlocked) {
    return (
      <div className="support-section">
        <div className="lp-modal-card mt-2 flex flex-col">
          <div className="lp-modal-header">
            <h3 className="lp-modal-title">
              <ShieldCheck size={16} /> {t.importExport.stepUp.title}
            </h3>
          </div>
          <StepUpCodeForm
            token={token}
            scope={SECURITY_SCOPE}
            language={language}
            onVerified={(tok) => { stepUp.cacheToken(SECURITY_SCOPE, tok); setUnlocked(true); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="support-section">
      <div className="support-section__header flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm lp-seg-tab ${activeTab === tab.id ? "is-active" : "btn-outline"}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm gap-2 ${primaryAction.danger ? "btn-error text-white" : "btn-primary text-white"}`}
            onClick={primaryAction.onClick}
          >
            {primaryAction.icon} {primaryAction.label}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost gap-2"
            onClick={() => void load(true)}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-sm" /> : <RefreshCw size={16} />}
            {loading ? s.refreshing : t.common.refresh}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 space-y-4" aria-busy="true">
          <div className="flex items-start gap-3">
            <div className="skeleton h-6 w-6 shrink-0 rounded-sm"></div>
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-48"></div>
              <div className="skeleton h-3 w-72 max-w-full"></div>
            </div>
          </div>
          <div className="skeleton h-10 w-full max-w-md rounded-lg"></div>
          <div className="overflow-hidden rounded-2xl border border-base-300/60 dark:border-zinc-700">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`sec-skeleton-${idx}`} className="flex items-center gap-3 border-b border-base-300/40 p-3 last:border-b-0 dark:border-zinc-700/60">
                <div className="skeleton h-4 flex-1"></div>
                <div className="skeleton h-4 w-24"></div>
                <div className="skeleton h-7 w-7 rounded-md"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <>
      {activeTab === "passkeys" ? (
        <div className="mt-3">
          <div className="mb-4 flex items-start gap-3">
            <KeyRound className="mt-1 shrink-0 text-primary" size={22} />
            <div>
              <h2 className="text-lg font-black">{s.passkeysSectionTitle}</h2>
              <p className="text-sm text-base-content/70">{s.passkeyBody}</p>
            </div>
          </div>
          {passkeyStatus ? <p className="text-sm text-base-content/70">{passkeyStatus}</p> : null}
          <div className="mt-4 overflow-x-auto rounded-2xl border border-base-300/60 bg-base-100/60 dark:border-zinc-700 dark:bg-zinc-900/40">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{s.colPasskey}</th>
                  <th>{s.lastUsed}</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {passkeys.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-base-content/60">{s.passkeyEmpty}</td></tr>
                ) : passkeys.map((passkey) => (
                  <tr key={passkey.id}>
                    <td>
                      <strong>{passkey.label}</strong>
                      <div className="text-xs text-base-content/55">{s.created}: {formatDate(passkey.createdAt, s.never)}</div>
                    </td>
                    <td>{formatDate(passkey.lastUsedAt, s.never)}</td>
                    <td>
                      <button type="button" className="lp-icon-btn is-danger tooltip tooltip-left" onClick={() => void revokePasskey(passkey.id)} aria-label={s.revokeTitle} data-tip={s.revokeTitle}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "codes" ? (
        <div className="mt-3">
          <div className="mb-4 flex items-start gap-3">
            <ShieldCheck className="mt-1 shrink-0 text-primary" size={22} />
            <div>
              <h2 className="text-lg font-black">{s.codesTitle}</h2>
              <p className="text-sm text-base-content/70">{s.codesBody}</p>
            </div>
          </div>
          <p className="text-sm text-base-content/70">{recoveryStatus}</p>
          <button type="button" className="btn btn-primary mt-4 text-white" onClick={() => void regenerateCodes()}>
            {s.generateCodes}
          </button>
          {recoveryCodes.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="flex items-start gap-2 text-sm font-bold"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{s.warningCodes}</p>
              <ol className="mt-3 grid gap-2 font-mono text-sm sm:grid-cols-2">
                {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
              </ol>
              <button type="button" className="btn btn-outline btn-sm mt-4 gap-2" onClick={() => void copyCodes()}>
                <Copy size={14} />
                {s.copyAll}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "totp" ? (
        <div className="mt-3">
          <div className="mb-4 flex items-start gap-3">
            {totpEnabled ? <ShieldCheck className="mt-1 shrink-0 text-primary" size={22} /> : <ShieldOff className="mt-1 shrink-0 text-base-content/60" size={22} />}
            <div>
              <h2 className="text-lg font-black">{s.totpTitle}</h2>
              <p className="text-sm text-base-content/70">{s.totpBody}</p>
            </div>
          </div>
          <p className="text-sm text-base-content/70">{totpStatus}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!totpEnabled ? (
              <button type="button" className="btn btn-primary text-white" onClick={() => void startTotpSetup()}>
                {s.configure2fa}
              </button>
            ) : (
              <button type="button" className="btn btn-error text-white" onClick={() => void turnOffTotp()}>
                {s.disable2fa}
              </button>
            )}
          </div>
          {totpSetup ? (
            <div className="mt-4 rounded-xl border border-dashed border-base-300 p-4 dark:border-zinc-700">
              <p className="text-sm text-base-content/70">{s.scanQr}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
                <img src={totpSetup.qrDataUrl} alt={s.qrAlt} width={200} height={200} className="rounded-lg border border-base-300 bg-white p-2" />
                <div className="min-w-0">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-base-200 px-3 py-2 font-mono text-sm">
                    <QrCode size={15} />
                    <span className="break-all">{totpSetup.secret}</span>
                  </div>
                  <input
                    ref={totpCodeRef}
                    className={`input input-bordered w-full max-w-xs text-center font-mono text-lg tracking-[0.35em]${totpInvalid ? " input-error border-error" : ""}`}
                    aria-invalid={totpInvalid || undefined}
                    value={totpCode}
                    onChange={(event) => { setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6)); if (totpInvalid) setTotpInvalid(false); }}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-outline" onClick={() => { setTotpSetup(null); setTotpCode(""); setTotpInvalid(false); }}>
                      {t.common.cancel}
                    </button>
                    <button type="button" className="btn btn-primary text-white" onClick={() => void confirmTotp()}>
                      {s.activate2fa}
                    </button>
                  </div>
                  {totpError ? <p className="mt-2 text-sm text-error">{totpError}</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Preferencias granulares: dónde pedir 2FA. Entrar a Seguridad
              siempre lo pide; el resto es opt-in por acción. */}
          <div className="mt-5 rounded-xl border border-base-300 p-4 dark:border-zinc-700">
            <h3 className="text-base font-bold">{STEP_UP_TEXT.heading}</h3>
            <p className="mt-1 text-sm text-base-content/70">{STEP_UP_TEXT.help}</p>
            {!totpEnabled ? (
              <p className="mt-2 text-sm text-base-content/60">{STEP_UP_TEXT.needsTotp}</p>
            ) : (
              <>
              {/* Método de verificación: UN solo método (switches mutuamente
                  excluyentes); el modal de step-up lo usa directo, sin selector. */}
              <div className="mt-3 rounded-lg border border-base-200 p-3 dark:border-zinc-800">
                <p className="text-sm font-semibold">{STEP_UP_TEXT.methodHeading}</p>
                <p className="mt-0.5 text-xs text-base-content/60">{STEP_UP_TEXT.methodHelp}</p>
                <div className="mt-2 flex flex-col">
                  {([
                    { m: "passkey" as StepUpMethod, label: STEP_UP_TEXT.methodPasskey, avail: passkeys.length > 0 },
                    { m: "totp" as StepUpMethod, label: STEP_UP_TEXT.methodTotp, avail: true },
                    { m: "recovery" as StepUpMethod, label: STEP_UP_TEXT.methodRecovery, avail: recoveryStatus === s.recoveryActive },
                  ]).map(({ m, label, avail }) => (
                    <label key={m} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="text-sm">
                        {label}
                        {!avail ? <span className="ms-2 text-xs text-base-content/50">({STEP_UP_TEXT.methodUnavailable})</span> : null}
                      </span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={stepUpMethod === m}
                        disabled={!avail}
                        onChange={(event) => {
                          const next = event.target.checked ? m : null;
                          setStepUpMethod(next);
                          setStepUpMethodPref(next);
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-3 divide-y divide-base-200 dark:divide-zinc-800">
                {stepUp.availableScopes.map((scope) => {
                  const on = stepUp.enabledScopes.includes(scope);
                  return (
                    <label key={scope} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm">{STEP_UP_SCOPE_LABELS[scope] ?? scope}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={on}
                        onChange={(event) => {
                          const set = new Set(stepUp.enabledScopes);
                          if (event.target.checked) set.add(scope); else set.delete(scope);
                          void stepUp.saveScopes(Array.from(set));
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      </>
      )}

      {dialog.element}
    </div>
  );
}
