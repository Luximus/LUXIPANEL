import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, KeyRound, LifeBuoy, LogIn, ShieldCheck, UserCircle2, X } from "lucide-react";
import styles from "./LoginScreen.module.css";
import { useAuth } from "../context/useAuth";
import type { ThemeMode } from "../features/app/types";
import { getPageGradient, openExternal } from "../features/app/utils";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { LOCALES, getMessages } from "../i18n";
import { isLoginCancelled, localizeLoginError } from "../lib/error-localization";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { LoginAccountsList } from "../components/LoginAccountsList";
import type { AccountProvider, SavedAccount } from "../storage/savedAccounts";
import {
  guestEntryKey,
  loadGuestHistory,
  removeGuestEntry,
  type GuestEntry,
} from "../storage/guestHistory";

type Step = "menu" | "passkey" | "recovery" | "mfa" | "guest";

/** Email domains offered in the suffix selector for passkey / recovery login.
 *  First entry is the default; `CUSTOM_EMAIL` switches the field to a full
 *  free-form address (covers GitHub and any provider whose domain isn't listed). */
const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "icloud.com"] as const;
const CUSTOM_EMAIL = "__custom__";
const EMAIL_EXAMPLE = "name@example.com";

export function LoginScreen({
  theme,
  onToggleTheme,
  language,
  setLanguage,
  onGuestEnter,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
  language: string;
  setLanguage: (next: string) => void;
  onGuestEnter?: (subdomain?: string) => void;
}) {
  const { loginWithGoogle, loginWithApple, loginWithGithub, loginWithMicrosoft, loginWithPasskey, loginWithRecovery, loginWithSavedAccount, verifyMfa, licenseError, savedAccounts, removeAccount, reorderAccounts } = useAuth();
  const t = getMessages(language);

  const [step, setStep] = useState<Step>("menu");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [emailDomain, setEmailDomain] = useState<string>(EMAIL_DOMAINS[0]);
  const [domainOpen, setDomainOpen] = useState(false);
  const domainRef = useRef<HTMLDivElement>(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [guestSubdomain, setGuestSubdomain] = useState("");
  const [guestHistory, setGuestHistory] = useState<GuestEntry[]>(() => loadGuestHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const [langMenu, setLangMenu] = useState({ up: false, maxH: 320 });
  const currentLocale = LOCALES.find((e) => e.code === language) ?? LOCALES[0];

  useEffect(() => {
    if (!langOpen) return;
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langOpen]);

  useEffect(() => {
    if (!domainOpen) return;
    function handleClick(e: MouseEvent) {
      if (domainRef.current && !domainRef.current.contains(e.target as Node)) {
        setDomainOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [domainOpen]);

  // Decide whether the language menu opens up or down and cap its height so the
  // full list stays inside the window (it would otherwise overflow off the bottom).
  useLayoutEffect(() => {
    if (!langOpen || !langBtnRef.current) return;
    const rect = langBtnRef.current.getBoundingClientRect();
    const margin = 12;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const up = below < 260 && above > below;
    const maxH = Math.max(176, Math.min(up ? above : below, 360));
    setLangMenu({ up, maxH });
  }, [langOpen]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? licenseError;

  // Campo inválido marcado al continuar con valor vacío/incorrecto. Se enfoca y
  // resalta en rojo en vez de solo deshabilitar el botón. Se limpia al editar.
  const [invalidField, setInvalidField] = useState<"email" | "recovery" | "mfa" | "guest" | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const recoveryRef = useRef<HTMLInputElement>(null);
  const mfaRef = useRef<HTMLInputElement>(null);
  const guestRef = useRef<HTMLInputElement>(null);
  const fieldRefs = { email: emailRef, recovery: recoveryRef, mfa: mfaRef, guest: guestRef } as const;

  // Marca el campo como inválido y lo enfoca (re-enfoca aunque ya estuviera
  // marcado, p. ej. al reintentar con el mismo error).
  function flagInvalid(field: "email" | "recovery" | "mfa" | "guest") {
    setInvalidField(field);
    fieldRefs[field]?.current?.focus();
  }
  const errorClass = "input-error border-error focus:border-error";

  const titleClass = theme === "dark" ? "text-white" : "text-base-content";
  const subtitleClass = theme === "dark" ? "text-white/75" : "text-base-content/75";

  const animationRef = useEnterAnimation<HTMLElement>([
    { selector: "[data-anim='owl']", from: { opacity: 0, y: -20, scale: 0.92 }, duration: 0.55 },
    { selector: "[data-anim='title']", from: { opacity: 0, y: 24 }, duration: 0.5 },
    { selector: "[data-anim='subtitle']", from: { opacity: 0, y: 12 }, duration: 0.4 },
    { selector: "[data-anim='actions']", from: { opacity: 0, y: 12 }, duration: 0.4, delay: 0.1 },
  ]);

  const isCustomEmail = emailDomain === CUSTOM_EMAIL;
  const trimmedEmailPrefix = emailPrefix.trim();
  const composedEmail = isCustomEmail ? trimmedEmailPrefix : `${trimmedEmailPrefix}@${emailDomain}`;
  const emailValid = useMemo(
    () =>
      isCustomEmail
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmailPrefix)
        : /^[a-zA-Z0-9._%+-]+$/.test(trimmedEmailPrefix),
    [isCustomEmail, trimmedEmailPrefix],
  );
  const domainOptions = useMemo(
    () => [
      ...EMAIL_DOMAINS.map((d) => ({ value: d, label: `@${d}` })),
      { value: CUSTOM_EMAIL, label: t.login.emailDomainOther },
    ],
    [t],
  );

  // Adopt a full address into the prefix+domain model: a known domain selects
  // its suffix; anything else drops the field to the custom full-email mode.
  function applyEmailAddress(email: string) {
    const at = email.indexOf("@");
    if (at >= 0) {
      const domain = email.slice(at + 1).toLowerCase();
      if ((EMAIL_DOMAINS as readonly string[]).includes(domain)) {
        setEmailPrefix(email.slice(0, at));
        setEmailDomain(domain);
        return;
      }
      setEmailPrefix(email);
      setEmailDomain(CUSTOM_EMAIL);
      return;
    }
    setEmailPrefix(email);
    setEmailDomain(EMAIL_DOMAINS[0]);
  }

  function handleEmailInput(raw: string) {
    if (invalidField === "email") setInvalidField(null);
    const value = raw.trim();
    if (isCustomEmail) {
      setEmailPrefix(value);
      return;
    }
    const at = value.indexOf("@");
    if (at < 0) {
      setEmailPrefix(value);
      return;
    }
    // Pasting/typing a domain after '@' adopts it (or jumps to custom mode);
    // a lone trailing '@' just keeps the local part in the current domain.
    if (value.slice(at + 1).length === 0) {
      setEmailPrefix(value.slice(0, at));
      return;
    }
    applyEmailAddress(value);
  }

  function handleSelectDomain(next: string) {
    setDomainOpen(false);
    if (next === emailDomain) return;
    if (invalidField === "email") setInvalidField(null);
    const local = emailPrefix.trim().replace(/@.*$/, "");
    setEmailPrefix(next === CUSTOM_EMAIL ? (local ? `${local}@` : "") : local);
    setEmailDomain(next);
  }
  const buttonDisabledClass = "disabled:cursor-not-allowed disabled:border-base-300 disabled:bg-base-200 disabled:text-base-content/35 disabled:opacity-55";
  const fieldClass = "lp-login-field input input-bordered h-12";
  const ctaClass = "lp-login-cta btn h-12 min-h-0 gap-2 border-0 text-white";
  const ghostClass = `btn btn-ghost h-12 min-h-0 gap-2 rounded-[0.625rem] ${buttonDisabledClass}`;
  const outlineClass = `btn btn-outline min-h-12 h-auto py-1.5 gap-2 rounded-[0.625rem] ${buttonDisabledClass}`;

  const normalizedGuest = useMemo(() => guestSubdomain.trim().toLowerCase(), [guestSubdomain]);
  const entryLabel = (entry: GuestEntry): string =>
    entry.label || entry.subdomain || `${t.login.guestAccessTitle} · ${entry.token.slice(0, 6)}`;
  const filteredHistory = useMemo(() => {
    if (!normalizedGuest) return guestHistory;
    return guestHistory.filter((entry) => {
      const label = entry.label || entry.subdomain || "";
      return label.toLowerCase().includes(normalizedGuest) && label !== normalizedGuest;
    });
  }, [guestHistory, normalizedGuest]);

  function selectStep(next: Step) {
    setStep(next);
    setLocalError(null);
    setInvalidField(null);
  }

  function reset() {
    setStep("menu");
    setRecoveryCode("");
    setMfaCode("");
    setMfaToken("");
    setBusy(false);
    setLocalError(null);
    setInvalidField(null);
    setHistoryOpen(false);
  }

  // Accepts a subdomain/dynamic code OR an invitation link/token; enterAsGuest
  // (in the controller) detects which and stores + exchanges it.
  function handleGuestEnter() {
    const raw = guestSubdomain.trim();
    if (!raw) {
      setLocalError(t.login.errorsField.subdomainInvalid);
      flagInvalid("guest");
      return;
    }
    setLocalError(null);
    setInvalidField(null);
    setHistoryOpen(false);
    onGuestEnter?.(raw);
  }

  function removeGuest(key: string) {
    setGuestHistory(removeGuestEntry(key));
  }

  async function handlePasskey(emailOverride?: string) {
    if (!emailOverride && !emailValid) {
      setLocalError(t.login.errorsField.emailInvalid);
      flagInvalid("email");
      return;
    }
    setBusy(true);
    setLocalError(null);
    setInvalidField(null);
    try {
      const result = await loginWithPasskey(emailOverride ?? composedEmail);
      if (result.mfaPending) {
        setMfaToken(result.mfaToken);
        setStep("mfa");
      }
    } catch (err) {
      setLocalError(localizeLoginError(err, t, t.login.errorsField.passkeyFailed));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(loginHint?: string) {
    setBusy(true);
    setLocalError(null);
    try {
      await loginWithGoogle(loginHint);
    } catch (err) {
      // Cancelar (cerrar el popup) restaura la pantalla sin error para reintentar.
      if (!isLoginCancelled(err)) setLocalError(localizeLoginError(err, t, t.login.errorsField.googleFailed));
    } finally {
      setBusy(false);
    }
  }

  async function handleApple() {
    setBusy(true);
    setLocalError(null);
    try {
      await loginWithApple();
    } catch (err) {
      if (!isLoginCancelled(err)) setLocalError(localizeLoginError(err, t, t.login.errorsField.appleFailed));
    } finally {
      setBusy(false);
    }
  }

  async function handleGithub(login?: string) {
    setBusy(true);
    setLocalError(null);
    try {
      await loginWithGithub(login);
    } catch (err) {
      if (!isLoginCancelled(err)) setLocalError(localizeLoginError(err, t, t.login.errorsField.githubFailed));
    } finally {
      setBusy(false);
    }
  }

  async function handleMicrosoft(loginHint?: string) {
    setBusy(true);
    setLocalError(null);
    try {
      await loginWithMicrosoft(loginHint);
    } catch (err) {
      if (!isLoginCancelled(err)) setLocalError(localizeLoginError(err, t, t.login.errorsField.microsoftFailed));
    } finally {
      setBusy(false);
    }
  }

  // "Add account" buttons offered inside the selector. The desktop OAuth popup
  // flow supports every provider, so all four are always available.
  const addProviders: AccountProvider[] = ["google", "apple", "github", "microsoft"];

  function handleAddProvider(provider: AccountProvider) {
    switch (provider) {
      case "apple": return void handleApple();
      case "github": return void handleGithub();
      case "microsoft": return void handleMicrosoft();
      default: return void handleGoogle();
    }
  }

  // Pick a saved account: first try to redeem its remembered session silently
  // (no provider, no code). Only if that account has no usable refresh token
  // left do we fall back to a full re-auth through its original provider.
  async function handleSelectAccount(account: SavedAccount) {
    applyEmailAddress(account.email);
    setLocalError(null);
    setBusy(true);
    try {
      const ok = await loginWithSavedAccount(account);
      if (ok) return;
    } finally {
      setBusy(false);
    }
    switch (account.provider) {
      case "apple": return void handleApple();
      case "github": return void handleGithub(account.providerUsername ?? undefined);
      case "microsoft": return void handleMicrosoft(account.email);
      case "passkey": return void handlePasskey(account.email);
      case "recovery": setStep("recovery"); return;
      default: return void handleGoogle(account.email);
    }
  }

  async function handleRecovery() {
    if (!emailValid) {
      setLocalError(t.login.errorsField.emailInvalid);
      flagInvalid("email");
      return;
    }
    if (!recoveryCode.trim()) {
      setLocalError(t.login.errorsField.recoveryRequired);
      flagInvalid("recovery");
      return;
    }
    setBusy(true);
    setLocalError(null);
    setInvalidField(null);
    try {
      const result = await loginWithRecovery(composedEmail, recoveryCode.trim());
      if (result.mfaPending) {
        setMfaToken(result.mfaToken);
        setStep("mfa");
      }
    } catch (err) {
      setLocalError(localizeLoginError(err, t, t.login.errorsField.recoveryInvalid));
    } finally {
      setBusy(false);
    }
  }

  async function handleMfa() {
    if (!/^\d{6}$/.test(mfaCode)) {
      setLocalError(t.login.errorsField.mfaSixDigits);
      flagInvalid("mfa");
      return;
    }
    setBusy(true);
    setLocalError(null);
    setInvalidField(null);
    try {
      await verifyMfa(mfaToken, mfaCode);
    } catch (err) {
      setLocalError(localizeLoginError(err, t, t.login.errorsField.mfaInvalid));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-theme={theme} className="h-full w-full overflow-y-auto text-base-content" style={{ backgroundImage: getPageGradient(theme) }}>
      <main ref={animationRef} className="relative flex min-h-full w-full flex-col items-center justify-center gap-4 px-4 py-10 text-center sm:px-6">
        <div className="login-theme-toggle absolute end-6 top-6">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} label={t.common.toggleTheme} />
        </div>

        <header className="flex flex-col items-center gap-2">
          <img data-anim="owl" src="/login-owl.webp" alt="LP mascot" className="w-auto max-h-[15vh] max-w-full object-contain drop-shadow-[0_10px_30px_rgba(124,58,237,0.28)]" />

          <h1 data-anim="title" className="px-2 font-black leading-[1.02] tracking-tight text-[clamp(2.2rem,5.4vw,4.6rem)]">
            <span className={`block ${titleClass}`}>{t.login.titleStrong}</span>
            <span className="block py-1 bg-gradient-to-r from-indigo-400 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">{t.login.titleAccent}</span>
          </h1>

          <p data-anim="subtitle" className={`max-w-xl text-sm md:text-base ${subtitleClass}`}>{t.login.subtitle}</p>
        </header>

        <div className="relative z-30 w-full max-w-md" data-anim="actions">
          <div className={`pointer-events-none absolute -inset-x-6 -top-8 bottom-0 -z-10 ${styles.actionsGlow}`} />
          <div className="space-y-3">

            {step === "menu" ? (
              <div className="lp-login-card flex flex-col gap-3 p-4">
                <LoginAccountsList
                  accounts={savedAccounts}
                  loading={busy}
                  language={language}
                  className="w-full"
                  addProviders={addProviders}
                  onAddProvider={handleAddProvider}
                  onSelect={handleSelectAccount}
                  onRemove={removeAccount}
                  onReorder={reorderAccounts}
                  trailing={
                    <div ref={langRef} className="relative shrink-0">
                      <button
                        ref={langBtnRef}
                        type="button"
                        className="lp-login-pill btn h-14 min-h-0 w-14 rounded-[0.625rem] px-0 text-xs font-bold tracking-wide"
                        aria-label={t.login.languageLabel}
                        onClick={() => setLangOpen((v) => !v)}
                      >
                        {currentLocale.code.toUpperCase()}
                      </button>
                      {langOpen ? (
                        <div
                          className={`absolute end-0 z-50 min-w-[11rem] overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-base-300 bg-base-100 shadow-lg ${langMenu.up ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"}`}
                          style={{ maxHeight: langMenu.maxH }}
                        >
                          {LOCALES.map((entry) => (
                            <button
                              key={entry.code}
                              type="button"
                              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-base-200 text-start ${entry.code === language ? "font-bold text-primary" : ""}`}
                              onClick={() => { setLanguage(entry.code); setLangOpen(false); }}
                            >
                              <span className="w-7 text-xs font-bold opacity-60">{entry.code.toUpperCase()}</span>
                              <span>{entry.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  }
                />
                <div className="divider my-0" />
                <div className="flex items-stretch gap-2">
                  <button type="button" className={`${outlineClass} flex-1 min-w-0 flex-nowrap justify-center leading-tight`} disabled={busy} onClick={() => selectStep("passkey")}>
                    <KeyRound size={18} className="shrink-0" />
                    <span>{t.login.passkeyButton}</span>
                  </button>
                  <button type="button" className={`${outlineClass} flex-1 min-w-0 flex-nowrap justify-center leading-tight`} disabled={busy} onClick={() => selectStep("recovery")}>
                    <LifeBuoy size={18} className="shrink-0" />
                    <span>{t.login.recoveryButton}</span>
                  </button>
                </div>
                <div className="divider my-0" />
                <button
                  type="button"
                  className={`${ghostClass} justify-center`}
                  disabled={busy}
                  onClick={() => {
                    setLocalError(null);
                    if (guestHistory.length > 0) onGuestEnter?.();
                    else selectStep("guest");
                  }}
                >
                  <UserCircle2 size={18} />
                  <span>{t.login.guestButton}</span>
                </button>
              </div>
            ) : null}

            {step !== "menu" ? (
              <div className="lp-login-card flex flex-col gap-3 p-4 text-start">
                {step === "passkey" || step === "recovery" ? (
                  <div className="join w-full">
                    <div className={`lp-login-field join-item input input-bordered flex h-12 min-w-0 flex-1 items-center gap-1 pe-2${invalidField === "email" ? ` ${errorClass}` : ""}`}>
                      <input
                        ref={emailRef}
                        type="text"
                        autoCapitalize="none"
                        autoComplete="username webauthn"
                        inputMode="email"
                        aria-invalid={invalidField === "email" || undefined}
                        className="grow min-w-0 bg-transparent"
                        placeholder={isCustomEmail ? EMAIL_EXAMPLE : t.login.emailPlaceholder}
                        value={emailPrefix}
                        onChange={(e) => handleEmailInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && step === "passkey") void handlePasskey(); }}
                        disabled={busy}
                      />
                      <div ref={domainRef} className="relative shrink-0">
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm opacity-70 transition hover:opacity-100"
                          onClick={() => setDomainOpen((v) => !v)}
                          disabled={busy}
                        >
                          <span className="whitespace-nowrap">{isCustomEmail ? t.login.emailDomainOther : `@${emailDomain}`}</span>
                          <ChevronDown size={14} className="shrink-0" />
                        </button>
                        {domainOpen ? (
                          <div className="absolute end-0 top-[calc(100%+6px)] z-50 min-w-[10rem] overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-lg">
                            {domainOptions.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                className={`flex w-full items-center px-3 py-2 text-sm hover:bg-base-200 text-start ${opt.value === emailDomain ? "font-bold text-primary" : ""}`}
                                onClick={() => handleSelectDomain(opt.value)}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {step === "passkey" ? (
                      <button
                        type="button"
                        className={`${ctaClass} join-item`}
                        disabled={busy}
                        onClick={() => void handlePasskey()}
                      >
                        <LogIn size={18} />
                        {busy ? t.login.passkeyButtonBusy : t.login.passkeyButton}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {step === "passkey" ? (
                  <button type="button" className={`${ghostClass} w-full`} onClick={reset} disabled={busy}>
                    <ArrowLeft size={18} className="lp-rtl-flip" />
                    {t.login.back}
                  </button>
                ) : null}

                {step === "recovery" ? (
                  <>
                    <div className="join w-full">
                      <input
                        ref={recoveryRef}
                        type="text"
                        autoComplete="one-time-code"
                        aria-invalid={invalidField === "recovery" || undefined}
                        className={`${fieldClass} join-item flex-1 text-center font-mono tracking-widest${invalidField === "recovery" ? ` ${errorClass}` : ""}`}
                        placeholder={t.login.recoveryPlaceholder}
                        value={recoveryCode}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
                          const grouped = cleaned.match(/.{1,4}/g)?.join("-") ?? "";
                          setRecoveryCode(grouped);
                          if (invalidField === "recovery") setInvalidField(null);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !busy) void handleRecovery(); }}
                        maxLength={14}
                        disabled={busy}
                      />
                      <button type="button" className={`${ctaClass} join-item`} disabled={busy} onClick={() => void handleRecovery()}>
                        <LogIn size={18} />
                        {busy ? t.login.recoverySubmitBusy : t.login.recoverySubmit}
                      </button>
                    </div>
                    <button type="button" className={ghostClass} onClick={reset} disabled={busy}>
                      <ArrowLeft size={18} className="lp-rtl-flip" />
                      {t.login.back}
                    </button>
                  </>
                ) : null}

                {step === "mfa" ? (
                  <>
                    <p className="text-start text-sm opacity-80">{t.login.mfaPrompt}</p>
                    <input
                      ref={mfaRef}
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      aria-invalid={invalidField === "mfa" || undefined}
                      className={`lp-login-field input input-bordered h-14 w-full rounded-xl text-center font-mono text-2xl tracking-[0.4em]${invalidField === "mfa" ? ` ${errorClass}` : ""}`}
                      placeholder="000000"
                      value={mfaCode}
                      onChange={(e) => { setMfaCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6)); if (invalidField === "mfa") setInvalidField(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleMfa(); }}
                      disabled={busy}
                    />
                    <button type="button" className={`${ctaClass} w-full rounded-[0.625rem]`} disabled={busy} onClick={() => void handleMfa()}>
                      <ShieldCheck size={18} />
                      {busy ? t.login.mfaSubmitBusy : t.login.mfaSubmit}
                    </button>
                    <button type="button" className={ghostClass} onClick={reset} disabled={busy}>
                      <ArrowLeft size={18} className="lp-rtl-flip" />
                      {t.login.cancel}
                    </button>
                  </>
                ) : null}

                {step === "guest" ? (
                  <>
                    <p className="text-sm opacity-75">{t.login.guestPrompt}</p>
                    <div className="relative flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <input
                          ref={guestRef}
                          aria-invalid={invalidField === "guest" || undefined}
                          className={`${fieldClass} w-full rounded-xl pe-9${invalidField === "guest" ? ` ${errorClass}` : ""}`}
                          placeholder={t.login.guestPlaceholder}
                          value={guestSubdomain}
                          maxLength={63}
                          onChange={(event) => { setGuestSubdomain(event.target.value); if (invalidField === "guest") setInvalidField(null); }}
                          onFocus={() => setHistoryOpen(true)}
                          onKeyDown={(event) => { if (event.key === "Enter") handleGuestEnter(); }}
                        />
                        {guestHistory.length > 0 ? (
                          <button
                            type="button"
                            className="absolute end-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                            onClick={() => setHistoryOpen((v) => !v)}
                            tabIndex={-1}
                          >
                            <ChevronDown size={16} />
                          </button>
                        ) : null}
                      </div>
                      <button type="button" className={`${ctaClass} shrink-0 rounded-[0.625rem]`} disabled={busy} onClick={handleGuestEnter}>
                        <LogIn size={18} />
                        {t.login.guestSubmit}
                      </button>
                    </div>
                    {historyOpen && filteredHistory.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
                        {filteredHistory.map((entry) => (
                          <div key={guestEntryKey(entry)} className="flex items-center gap-2 px-3 py-2">
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-start text-sm font-semibold"
                              onClick={() => { setHistoryOpen(false); onGuestEnter?.(entry.token); }}
                            >
                              {entryLabel(entry)}
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost flex-none"
                              onClick={() => removeGuest(guestEntryKey(entry))}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <button type="button" className={ghostClass} onClick={reset} disabled={busy}>
                      <ArrowLeft size={18} className="lp-rtl-flip" />
                      {t.login.back}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-start">
                <p className="text-sm font-semibold leading-relaxed text-error">{error}</p>
                <button type="button" className="mt-1 text-sm text-primary underline underline-offset-4 hover:opacity-80" onClick={() => openExternal("https://luxipanel.com")}>luxipanel.com</button>
              </div>
            ) : null}

          </div>
        </div>

        <footer className="mt-2 flex w-full max-w-md flex-col items-center gap-2 border-t border-base-content/10 pt-5">
          <p className="max-w-sm text-center text-xs opacity-60">{t.login.footer.termsNotice}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <button type="button" className="text-xs font-semibold underline underline-offset-2 opacity-60 transition hover:opacity-100" onClick={() => openExternal("https://luxipanel.com/terms-and-conditions")}>
              {t.login.footer.terms}
            </button>
            <span className="opacity-40">·</span>
            <button type="button" className="text-xs font-semibold underline underline-offset-2 opacity-60 transition hover:opacity-100" onClick={() => openExternal("https://luxipanel.com/privacy-policy")}>
              {t.login.footer.privacy}
            </button>
            <span className="opacity-40">·</span>
            <button type="button" className="text-xs font-semibold underline underline-offset-2 opacity-60 transition hover:opacity-100" onClick={() => openExternal("https://luxipanel.com/es/refund-policy")}>
              {t.login.footer.refund}
            </button>
          </div>
          <p className="text-center text-xs opacity-50">{t.login.footer.copyright}</p>
          <button type="button" className="text-xs font-semibold text-primary underline underline-offset-2 opacity-60 transition hover:opacity-100" onClick={() => openExternal("https://luxisoft.com")}>
            {t.login.footer.createdBy}
          </button>
        </footer>

      </main>
    </div>
  );
}
