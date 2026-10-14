/**
 * AddStandaloneServerModal (desktop) — alta / re-conexión de un servidor
 * LUXIPANEL **standalone** por conexión DIRECTA (sin LP-LS).
 *
 * Espejo de `app/src/screens/server/standalone/AddStandaloneServerScreen.tsx`
 * adaptado a Electron/web: pide **URL del panel + usuario Linux + contraseña**
 * (+ 2FA si el box lo exige) y ejecuta el handshake real de `/api/login` del box
 * vía `directAuth`. Al validar persiste el servidor (o actualiza su sesión en
 * modo reconexión) y lo devuelve por `onDone`. Reusa las clases `lp-modal-*` del
 * resto de modales del desktop.
 */
import { useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import {
  loginStandalone,
  normalizeBaseUrl,
  verifyStandaloneTotp,
  type DirectSession,
} from "../api/directAuth";
import {
  addStandaloneServer,
  setStandalonePassword,
  setStandaloneSession,
  updateStandaloneServer,
  type StandaloneServer,
} from "../lib/standalone-servers";
import { getMessages } from "../i18n";

export function AddStandaloneServerModal({
  open,
  existing,
  initialUrl,
  initialName,
  onClose,
  onDone,
  language,
}: {
  open: boolean;
  /** Si viene, es RE-CONEXIÓN de un servidor ya guardado (pre-rellena + actualiza). */
  existing?: StandaloneServer;
  /** Alta NUEVA pre-rellenada (p. ej. "Conectar" de una tarjeta de panel: URL del
   *  box resuelta desde `customDomain`/host). No implica reconexión de un id previo. */
  initialUrl?: string;
  initialName?: string;
  onClose: () => void;
  onDone: (server: StandaloneServer) => void;
  language?: string;
}) {
  const t = getMessages(language).serverStandalone;

  const [name, setName] = useState(existing?.name ?? initialName ?? "");
  const [url, setUrl] = useState(existing?.baseUrl ?? initialUrl ?? "");
  const [username, setUsername] = useState(existing?.username ?? "");
  const [password, setPassword] = useState("");
  const [savePassword, setSavePassword] = useState(existing?.savePassword ?? false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<DirectSession | null>(null);
  const [code, setCode] = useState("");

  if (!open) return null;

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
      updateStandaloneServer(existing.id, { name: finalName, baseUrl: base, username: finalUser, savePassword });
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

  const title = mfa ? t.twoFaTitle : existing ? t.addTitle : t.addTitle;

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-full w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.cancel} disabled={submitting}>
            <X size={18} />
          </button>
        </div>

        {mfa ? (
          // ── Paso 2FA: el box pidió un código TOTP ──────────────────────────
          <div className="lp-modal-body flex flex-col gap-3">
            <p className="text-sm text-base-content/70">{t.twoFaHint}</p>
            <label className="lp-modal-label flex flex-col gap-1">
              <span>{t.twoFaTitle}</span>
              <input
                className="lp-modal-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t.twoFaPlaceholder}
                value={code}
                disabled={submitting}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            {error ? <p className="lp-modal-error">{error}</p> : null}
          </div>
        ) : (
          // ── Alta / re-conexión ─────────────────────────────────────────────
          <div className="lp-modal-body flex flex-col gap-3">
            <p className="text-sm text-base-content/70">{t.addHint}</p>

            <label className="lp-modal-label flex flex-col gap-1">
              <span>{t.fieldUrl}</span>
              <input
                className="lp-modal-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={t.fieldUrlPlaceholder}
                value={url}
                disabled={submitting}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>

            <label className="lp-modal-label flex flex-col gap-1">
              <span>{t.fieldName}</span>
              <input
                className="lp-modal-input"
                type="text"
                autoComplete="off"
                placeholder={t.fieldNamePlaceholder}
                value={name}
                disabled={submitting}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="lp-modal-label flex flex-col gap-1">
              <span>{t.fieldUser}</span>
              <input
                className="lp-modal-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={t.fieldUserPlaceholder}
                value={username}
                disabled={submitting}
                onChange={(e) => setUsername(e.target.value.trim())}
              />
            </label>

            <label className="lp-modal-label flex flex-col gap-1">
              <span>{t.fieldPassword}</span>
              <div className="relative flex items-center">
                <input
                  className="lp-modal-input w-full pr-10"
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  placeholder={t.fieldPasswordPlaceholder}
                  value={password}
                  disabled={submitting}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="lp-input-reveal absolute right-2"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  aria-label={t.fieldPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox checkbox-sm mt-0.5"
                checked={savePassword}
                disabled={submitting}
                onChange={(e) => setSavePassword(e.target.checked)}
              />
              <span className="flex flex-col">
                <span>{t.savePassword}</span>
                <span className="text-xs text-base-content/60">{t.savePasswordHint}</span>
              </span>
            </label>

            {error ? <p className="lp-modal-error">{error}</p> : null}
          </div>
        )}

        <div className="lp-modal-footer">
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--ghost"
            onClick={mfa ? () => { setMfa(null); setCode(""); setError(null); } : onClose}
            disabled={submitting}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            onClick={() => void (mfa ? submitTotp() : submit())}
            disabled={mfa ? submitting || code.trim().length < 6 : !canSubmit}
          >
            {submitting ? t.connecting : mfa ? t.verify : t.testAndSave}
          </button>
        </div>
      </div>
    </div>
  );
}
