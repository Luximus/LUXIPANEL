import { useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, ShieldCheck, SmartphoneNfc } from "lucide-react";
import { getStepUpMethods, stepUpRecovery, verifyStepUp, type StepUpMethods } from "../api/client";
import { runStepUpPasskey } from "../api/webauthn";
import { getStepUpMethodPref } from "../lib/stepUpMethodPref";
import { getMessages } from "../i18n";
import styles from "./StepUpCodeModal.module.css";

type Method = "passkey" | "totp" | "recovery";

const METHOD_ORDER: Method[] = ["passkey", "totp", "recovery"];

/**
 * Cuerpo multi-método de re-verificación 2FA (step-up), SIN el shell de modal. Es
 * lo extraído de `StepUpCodeModal` para poder mostrarlo embebido (inline) dentro de
 * un panel (desbloquear Seguridad) o dentro del modal (resto de scopes). Entrega el
 * `stepUpToken` vía `onVerified`. `onCancel` es opcional: sin él no hay botón de
 * cancelar (uso inline obligatorio).
 */
export function StepUpCodeForm({
  token,
  language,
  scope = "data-export",
  onVerified,
  onCancel,
}: {
  token: string;
  language?: string;
  scope?: string;
  onVerified: (stepUpToken: string) => void;
  onCancel?: () => void;
}) {
  const t = getMessages(language);
  const tr = t.importExport.stepUp;

  const [methods, setMethods] = useState<StepUpMethods | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [active, setActive] = useState<Method | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingMethods(true);
    void (async () => {
      let resolved: StepUpMethods;
      try {
        resolved = await getStepUpMethods(token);
      } catch {
        resolved = { totp: true, passkey: false, recovery: false };
      }
      if (cancelled) return;
      const available = METHOD_ORDER.filter((m) => resolved[m]);
      if (available.length === 0) available.push("totp");
      setMethods(resolved);
      const pref = getStepUpMethodPref();
      const preferred = pref && available.includes(pref) ? pref : null;
      const chosen = preferred ?? (available.length === 1 ? available[0]! : null);
      setActive(chosen);
      if (preferred === "passkey") void runPasskey();
      setLoadingMethods(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (active === "totp" || active === "recovery") {
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [active]);

  const availableMethods = methods ? METHOD_ORDER.filter((m) => methods[m]) : [];
  const showSelector = active === null;
  const canGoBack = availableMethods.length > 1;

  async function submitCode() {
    if (busy) return;
    if (active === "totp" && !/^\d{6}$/.test(code)) {
      setError(tr.error);
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    if (active === "recovery" && code.trim().length === 0) {
      setError(tr.recoveryError);
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    setError("");
    setInvalid(false);
    setBusy(true);
    try {
      const { stepUpToken } =
        active === "recovery"
          ? await stepUpRecovery(scope, code.trim(), token)
          : await verifyStepUp(code, token, scope);
      onVerified(stepUpToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : active === "recovery" ? tr.recoveryError : tr.error);
      setInvalid(true);
      setBusy(false);
    }
  }

  async function runPasskey() {
    if (busy) return;
    setError("");
    setInvalid(false);
    setBusy(true);
    try {
      const { stepUpToken } = await runStepUpPasskey(scope, token, language ?? "es");
      onVerified(stepUpToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg !== "passkey_cancelled") setError(tr.passkeyError);
      setBusy(false);
    }
  }

  function pickMethod(m: Method) {
    setError("");
    setInvalid(false);
    setCode("");
    if (m === "passkey") {
      setActive("passkey");
      void runPasskey();
    } else {
      setActive(m);
    }
  }

  function back() {
    setActive(null);
    setCode("");
    setError("");
    setInvalid(false);
  }

  const isNumeric = active === "totp";

  return (
    <>
      <div className="lp-modal-body">
        {loadingMethods ? (
          <p className={styles.bodyText}>{tr.verifying}</p>
        ) : showSelector ? (
          <>
            <p className={styles.bodyText}>{tr.chooseMethod}</p>
            <div className="flex flex-col gap-2">
              {availableMethods.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="lp-modal-method flex w-full items-start gap-3 rounded-lg border border-base-300 p-3 text-left hover:border-primary"
                  onClick={() => pickMethod(m)}
                  disabled={busy}
                >
                  <span className="mt-0.5 shrink-0 text-primary">
                    {m === "passkey" ? <Fingerprint size={20} /> : m === "totp" ? <SmartphoneNfc size={20} /> : <KeyRound size={20} />}
                  </span>
                  <span className="flex flex-col">
                    <span className={styles.methodLabel}>
                      {m === "passkey" ? tr.methodPasskey : m === "totp" ? tr.methodTotp : tr.methodRecovery}
                    </span>
                    <span className={styles.methodHint}>
                      {m === "passkey" ? tr.methodPasskeyHint : m === "totp" ? tr.methodTotpHint : tr.methodRecoveryHint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : active === "passkey" ? (
          <p className={styles.bodyText}>{busy ? tr.passkeyBusy : tr.methodPasskeyHint}</p>
        ) : (
          <>
            <p className={styles.bodyText}>{active === "recovery" ? tr.methodRecoveryHint : tr.subtitle}</p>
            <div>
              <p className="lp-modal-label">{active === "recovery" ? tr.recoveryLabel : tr.codeLabel}</p>
              <input
                ref={inputRef}
                type="text"
                inputMode={isNumeric ? "numeric" : "text"}
                autoComplete={isNumeric ? "one-time-code" : "off"}
                maxLength={isNumeric ? 6 : 64}
                value={code}
                placeholder={isNumeric ? "000000" : ""}
                aria-invalid={invalid || undefined}
                onChange={(event) => {
                  const raw = event.target.value;
                  setCode(isNumeric ? raw.replace(/\D/g, "").slice(0, 6) : raw);
                  if (error) setError("");
                  if (invalid) setInvalid(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitCode();
                  }
                }}
                className={`input input-bordered w-full ${isNumeric ? "text-center tracking-[0.5em] font-mono text-lg" : ""}${invalid ? " input-error border-error" : ""}`}
                disabled={busy}
              />
            </div>
          </>
        )}
        {error ? <p className="lp-modal-error">{error}</p> : null}
      </div>

      <div className="lp-modal-footer">
        {!showSelector && canGoBack ? (
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={back} disabled={busy}>
            {tr.back}
          </button>
        ) : onCancel ? (
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onCancel} disabled={busy}>
            {t.importExport.cancel}
          </button>
        ) : null}

        {active === "passkey" ? (
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void runPasskey()} disabled={busy}>
            <Fingerprint size={16} />
            {busy ? tr.passkeyBusy : tr.passkeyVerify}
          </button>
        ) : active === "totp" || active === "recovery" ? (
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            onClick={() => void submitCode()}
            disabled={busy || (isNumeric ? code.length !== 6 : code.trim().length === 0)}
          >
            <ShieldCheck size={16} />
            {busy ? tr.verifying : tr.verify}
          </button>
        ) : null}
      </div>
    </>
  );
}

export default StepUpCodeForm;
