import React, { useEffect, useMemo, useState } from "react";
import { Animated, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScopedNativeModal as Modal } from "./main/native-module-context";;
import { styles } from "./LoginScreen.styles";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, ChevronDown, KeyRound, LifeBuoy, LogIn, ShieldCheck, UserCircle2, X } from "lucide-react-native";
import { useAuth } from "../context/useAuth";
import type { ThemeMode } from "../features/app/types";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { LoginBackground } from "../components/LoginBackground";
import { LoginAccountsList } from "../components/LoginAccountsList";
import { LOCALES, getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages, isRtlLocale } from "../i18n";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { getThemeTokens } from "../theme/colors";
import { isLoginCancelled, localizeLoginError } from "../lib/error-localization";
import {
  guestEntryKey,
  loadGuestHistory,
  loadGuestHistorySync,
  removeGuestEntry,
  type GuestEntry,
} from "../storage/guestHistory";
import type { AccountProvider, SavedAccount } from "../storage/savedAccounts";

const LOGIN_OWL = require("../../assets/login-owl.webp");

type Step = "menu" | "passkey" | "recovery" | "mfa" | "guest";

const CTA_COLORS = ["#6366f1", "#7c3aed", "#d946ef"] as const;

/** Email domains offered in the suffix selector for passkey / recovery login.
 *  First entry is the default; `CUSTOM_EMAIL` switches the field to a full
 *  free-form address (covers GitHub and any provider whose domain isn't listed). */
const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "icloud.com"] as const;
const CUSTOM_EMAIL = "__custom__";
const EMAIL_EXAMPLE = "name@example.com";

/** Botón de acción principal con gradiente de marca (réplica del CTA del
 *  login de escritorio). Reservado para las acciones de "entrar". */
function GradientButton({
  onPress,
  disabled,
  icon,
  label,
  rowDirection,
}: {
  onPress: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  rowDirection: "row" | "row-reverse";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.cta, disabled ? styles.ctaDisabled : null, pressed && !disabled ? styles.ctaPressed : null]}
    >
      <LinearGradient colors={CTA_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.ctaInner, { flexDirection: rowDirection }]}>
        {icon}
        <Text style={styles.ctaLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

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
  const { loginWithGoogle, loginWithApple, loginWithGithub, loginWithMicrosoft, loginWithPasskey, loginWithRecovery, loginWithSavedAccount, verifyMfa, licenseError, passkeySupported, appleSupported, githubSupported, microsoftSupported, savedAccounts, removeAccount, reorderAccounts } = useAuth();
  const t = getMessages(language);
  const tokens = getThemeTokens(theme === "dark");
  const rtl = isRtlLocale(language);
  const direction = getLocaleDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const rowDirection = getLocaleRowDirection(language);

  const [step, setStep] = useState<Step>("menu");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [emailDomain, setEmailDomain] = useState<string>(EMAIL_DOMAINS[0]);
  const [domainOpen, setDomainOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  // Campo señalado como inválido al intentar continuar: borde rojo + foco.
  const [invalidField, setInvalidField] = useState<"email" | "recovery" | "mfa" | "guest" | null>(null);
  const emailRef = React.useRef<TextInput>(null);
  const recoveryRef = React.useRef<TextInput>(null);
  const mfaRef = React.useRef<TextInput>(null);
  const guestRef = React.useRef<TextInput>(null);

  const [guestSubdomain, setGuestSubdomain] = useState("");
  const [guestHistory, setGuestHistory] = useState<GuestEntry[]>(() => loadGuestHistorySync());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(false);

  useEffect(() => {
    void loadGuestHistory().then(setGuestHistory);
  }, []);

  const owlAnim = useEnterAnimation({ duration: 550, fromY: -20 });
  const titleAnim = useEnterAnimation({ duration: 500, delay: 120 });
  const subtitleAnim = useEnterAnimation({ duration: 400, delay: 220 });
  const actionsAnim = useEnterAnimation({ duration: 400, delay: 320 });

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
  const normalizedGuest = useMemo(() => guestSubdomain.trim().toLowerCase(), [guestSubdomain]);
  const guestValid = guestSubdomain.trim().length > 0;
  // Display label for a guest history entry (panel name / invitation link).
  // Unnamed invitation links fall back to the localized "guest access" label plus
  // a short token suffix so multiple of them stay distinguishable in the list.
  const entryLabel = (entry: GuestEntry): string =>
    entry.label || entry.subdomain || `${t.login.guestAccessTitle} · ${entry.token.slice(0, 6)}`;
  const filteredHistory = useMemo(() => {
    const q = normalizedGuest;
    if (!q) return guestHistory;
    return guestHistory.filter((entry) => {
      const label = entry.label || entry.subdomain || "";
      return label.toLowerCase().includes(q) && label !== q;
    });
  }, [guestHistory, normalizedGuest]);
  const error = localError ?? licenseError;

  // Providers offered as "Add account" buttons inside the selector. Google is
  // always available; the social ones depend on their native build/env config.
  const addProviders = useMemo<AccountProvider[]>(
    () => [
      "google",
      ...(appleSupported ? (["apple"] as const) : []),
      ...(githubSupported ? (["github"] as const) : []),
      ...(microsoftSupported ? (["microsoft"] as const) : []),
    ],
    [appleSupported, githubSupported, microsoftSupported],
  );

  function reset() {
    setStep("menu");
    setRecoveryCode("");
    setMfaCode("");
    setMfaToken("");
    setBusy(false);
    setLocalError(null);
    setHistoryOpen(false);
    setInvalidField(null);
  }

  async function handlePasskey(emailOverride?: string) {
    if (!emailOverride && !emailValid) {
      setLocalError(t.login.errorsField.emailInvalid);
      setInvalidField("email");
      emailRef.current?.focus();
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
      // Cancelar (cerrar la ventana del proveedor) vuelve al estado inicial sin
      // error, listo para reintentar.
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
      setInvalidField("email");
      emailRef.current?.focus();
      return;
    }
    if (!recoveryCode.trim()) {
      setLocalError(t.login.errorsField.recoveryRequired);
      setInvalidField("recovery");
      recoveryRef.current?.focus();
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
      setInvalidField("mfa");
      mfaRef.current?.focus();
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

  // Accepts a subdomain/dynamic code OR an invitation link/token. enterAsGuest
  // (in the controller) detects which and stores + exchanges it.
  async function handleGuestEnter() {
    const raw = guestSubdomain.trim();
    if (!raw) {
      setLocalError(t.login.errorsField.subdomainInvalid);
      setInvalidField("guest");
      guestRef.current?.focus();
      return;
    }
    setLocalError(null);
    setInvalidField(null);
    setHistoryOpen(false);
    onGuestEnter?.(raw);
  }

  async function handleRemoveHistory(key: string) {
    const next = await removeGuestEntry(key);
    setGuestHistory(next);
  }

  function pickFromHistory(subdomain: string) {
    setGuestSubdomain(subdomain);
    setHistoryOpen(false);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { direction }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <LoginBackground theme={theme} />
      <View style={[styles.themeToggleAbsolute, rtl ? styles.themeToggleAbsoluteRtl : null]}>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Animated.Image source={LOGIN_OWL} style={[styles.owl, owlAnim.style as never]} />

        <Animated.View style={[titleAnim.style, { direction }]}>
          <Text style={[styles.titleStrong, { color: tokens.textPrimary }]}>{t.login.titleStrong}</Text>
          <Text style={[styles.titleAccent, { color: tokens.brand }]}>{t.login.titleAccent}</Text>
        </Animated.View>

        <Animated.Text style={[styles.subtitle, { color: tokens.textMuted }, subtitleAnim.style]}>
          {t.login.subtitle}
        </Animated.Text>

        <View style={[styles.sectionDivider, { backgroundColor: tokens.border }]} />

        <Animated.View
          style={[
            styles.formCol,
            styles.formCard,
            { backgroundColor: tokens.bgCard, borderColor: tokens.border },
            actionsAnim.style,
          ]}
        >
          {step === "menu" ? (
            <View style={styles.colGap}>
              <View style={styles.menuTopRow}>
                <View style={styles.googleSavedArea}>
                  <LoginAccountsList
                    variant="trigger"
                    expanded={accountsExpanded}
                    onToggleExpanded={() => setAccountsExpanded((v) => !v)}
                    accounts={savedAccounts}
                    loading={busy}
                    language={language}
                    addProviders={addProviders}
                    onAddProvider={handleAddProvider}
                    onSelect={handleSelectAccount}
                    onRemove={(em) => void removeAccount(em)}
                    onReorder={(emails) => void reorderAccounts(emails)}
                  />
                </View>
                <Select
                  value={language}
                  options={LOCALES.map((entry) => ({ value: entry.code, label: `${entry.flag} ${entry.code.toUpperCase()}` }))}
                  onChange={setLanguage}
                  style={styles.langSelectInline}
                />
              </View>
              {accountsExpanded ? (
                <LoginAccountsList
                  variant="panel"
                  expanded
                  accounts={savedAccounts}
                  loading={busy}
                  language={language}
                  addProviders={addProviders}
                  onAddProvider={handleAddProvider}
                  onSelect={handleSelectAccount}
                  onRemove={(em) => void removeAccount(em)}
                  onReorder={(emails) => void reorderAccounts(emails)}
                />
              ) : null}
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <Button
                variant="ghost"
                label={t.login.passkeyButton}
                icon={<KeyRound size={18} />}
                disabled={busy || !passkeySupported}
                onPress={() => { setStep("passkey"); setLocalError(null); }}
              />
              <Button
                variant="ghost"
                label={t.login.recoveryButton}
                icon={<LifeBuoy size={18} />}
                disabled={busy}
                onPress={() => { setStep("recovery"); setLocalError(null); }}
              />
              {!passkeySupported ? (
                <Text style={[styles.hint, { color: tokens.textMuted, textAlign }]}>
                  {t.login.passkeyHint}
                </Text>
              ) : null}
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <Button
                variant="ghost"
                label={t.login.guestButton}
                icon={<UserCircle2 size={18} />}
                disabled={busy}
                onPress={() => {
                  setLocalError(null);
                  if (guestHistory.length > 0) {
                    onGuestEnter?.();
                  } else {
                    setStep("guest");
                  }
                }}
              />
            </View>
          ) : null}

          {step === "passkey" || step === "recovery" ? (
            <View style={[styles.gmailField, { backgroundColor: tokens.bgInput, borderColor: invalidField === "email" ? tokens.danger : focusKey === "email" ? tokens.brand : tokens.border, flexDirection: rowDirection }]}>
              <TextInput
                ref={emailRef}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder={isCustomEmail ? EMAIL_EXAMPLE : t.login.emailPlaceholder}
                placeholderTextColor={tokens.textMuted}
                style={[styles.gmailFieldInput, { color: tokens.textPrimary, direction, textAlign }]}
                value={emailPrefix}
                onChangeText={handleEmailInput}
                onFocus={() => setFocusKey("email")}
                onBlur={() => setFocusKey(null)}
                editable={!busy}
              />
              <Pressable
                onPress={() => setDomainOpen(true)}
                disabled={busy}
                hitSlop={6}
                style={[styles.domainTrigger, { flexDirection: rowDirection }]}
              >
                <Text numberOfLines={1} style={[styles.domainTriggerLabel, { color: tokens.textSecondary }]}>
                  {isCustomEmail ? t.login.emailDomainOther : `@${emailDomain}`}
                </Text>
                <ChevronDown size={14} color={tokens.textMuted} />
              </Pressable>
              {/* Backdrop no cierra al tocar fuera; botón atrás (onRequestClose) no descarta. Cierre por la X o al elegir dominio. */}
              <Modal visible={domainOpen} transparent animationType="fade" onRequestClose={() => {}}>
                <View style={styles.domainBackdrop}>
                  <View
                    style={[styles.domainSheet, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, direction }]}
                  >
                    <Pressable onPress={() => setDomainOpen(false)} accessibilityRole="button" accessibilityLabel={t.common.close} style={styles.domainCloseRow}>
                      <X size={18} color={tokens.textMuted} />
                    </Pressable>
                    {domainOptions.map((opt) => {
                      const active = opt.value === emailDomain;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => handleSelectDomain(opt.value)}
                          style={[styles.domainRow, { flexDirection: rowDirection }, active ? { backgroundColor: tokens.brandDim } : null]}
                        >
                          <Text numberOfLines={1} style={[styles.domainRowLabel, { color: active ? tokens.brand : tokens.textSecondary, textAlign }]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Modal>
            </View>
          ) : null}

          {step === "passkey" ? (
            <View style={styles.colGap}>
              <GradientButton
                onPress={() => void handlePasskey()}
                disabled={busy}
                rowDirection={rowDirection}
                icon={<LogIn size={18} color="#ffffff" />}
                label={busy ? t.login.passkeyButtonBusy : t.login.passkeyButton}
              />
              <Button variant="ghost" label={t.login.back} icon={<ArrowLeft size={18} />} onPress={reset} disabled={busy} />
            </View>
          ) : null}

          {step === "recovery" ? (
            <View style={styles.colGap}>
              <TextInput
                ref={recoveryRef}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={t.login.recoveryPlaceholder}
                placeholderTextColor={tokens.textMuted}
                style={[styles.input, styles.inputCode, { backgroundColor: tokens.bgInput, borderColor: invalidField === "recovery" ? tokens.danger : focusKey === "recovery" ? tokens.brand : tokens.border, color: tokens.textPrimary }]}
                value={recoveryCode}
                onChangeText={(raw) => {
                  if (invalidField === "recovery") setInvalidField(null);
                  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
                  const grouped = cleaned.match(/.{1,4}/g)?.join("-") ?? "";
                  setRecoveryCode(grouped);
                }}
                onFocus={() => setFocusKey("recovery")}
                onBlur={() => setFocusKey(null)}
                maxLength={14}
                editable={!busy}
              />
              <GradientButton
                onPress={() => void handleRecovery()}
                disabled={busy}
                rowDirection={rowDirection}
                icon={<LogIn size={18} color="#ffffff" />}
                label={busy ? t.login.recoverySubmitBusy : t.login.recoverySubmit}
              />
              <Button variant="ghost" label={t.login.back} icon={<ArrowLeft size={18} />} onPress={reset} disabled={busy} />
            </View>
          ) : null}

          {step === "guest" ? (
            <View style={styles.colGap}>
              <Text style={[styles.hint, { color: tokens.textSecondary, textAlign }]}>
                {t.login.guestPrompt}
              </Text>
              <View style={[styles.guestRow, { flexDirection: rowDirection }]}>
                <View style={[styles.guestSubdomainWrap, { backgroundColor: tokens.bgInput, borderColor: invalidField === "guest" ? tokens.danger : focusKey === "guest" ? tokens.brand : tokens.border, flexDirection: rowDirection }]}>
                  <TextInput
                    ref={guestRef}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder={t.login.guestPlaceholder}
                    placeholderTextColor={tokens.textMuted}
                    style={[styles.guestSubdomainInput, { color: tokens.textPrimary, direction, textAlign }]}
                    value={guestSubdomain}
                    onChangeText={(v) => {
                      if (invalidField === "guest") setInvalidField(null);
                      setGuestSubdomain(v);
                    }}
                    onFocus={() => { setHistoryOpen(true); setFocusKey("guest"); }}
                    onBlur={() => setFocusKey(null)}
                    maxLength={63}
                    editable={!busy}
                    returnKeyType="go"
                    onSubmitEditing={() => void handleGuestEnter()}
                  />
                  {guestHistory.length > 0 ? (
                    <Pressable
                      onPress={() => setHistoryOpen((v) => !v)}
                      hitSlop={8}
                      style={styles.guestChevron}
                    >
                      <ChevronDown size={16} color={tokens.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {historyOpen && filteredHistory.length > 0 ? (
                <View style={[styles.historyList, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
                  {filteredHistory.map((entry) => (
                    <View key={guestEntryKey(entry)} style={[styles.historyRow, { flexDirection: rowDirection }]}>
                      <Pressable
                        onPress={() => { setHistoryOpen(false); onGuestEnter?.(entry.token); }}
                        style={styles.historyRowPick}
                      >
                        <Text numberOfLines={1} style={[styles.historyText, { color: tokens.textPrimary, textAlign }]}>
                          {entryLabel(entry)}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleRemoveHistory(guestEntryKey(entry))}
                        hitSlop={6}
                        style={styles.historyRemove}
                      >
                        <X size={14} color={tokens.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <GradientButton
                onPress={() => void handleGuestEnter()}
                disabled={busy}
                rowDirection={rowDirection}
                icon={<LogIn size={18} color="#ffffff" />}
                label={t.login.guestSubmit}
              />
              <Button variant="ghost" label={t.login.back} icon={<ArrowLeft size={18} />} onPress={reset} disabled={busy} />
            </View>
          ) : null}

          {step === "mfa" ? (
            <View style={styles.colGap}>
              <Text style={[styles.hint, { color: tokens.textSecondary, textAlign }]}>
                {t.login.mfaPrompt}
              </Text>
              <TextInput
                ref={mfaRef}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={tokens.textMuted}
                style={[styles.input, styles.inputCode, { backgroundColor: tokens.bgInput, borderColor: invalidField === "mfa" ? tokens.danger : focusKey === "mfa" ? tokens.brand : tokens.border, color: tokens.textPrimary }]}
                value={mfaCode}
                onChangeText={(v) => {
                  if (invalidField === "mfa") setInvalidField(null);
                  setMfaCode(v.replace(/[^\d]/g, "").slice(0, 6));
                }}
                onFocus={() => setFocusKey("mfa")}
                onBlur={() => setFocusKey(null)}
                editable={!busy}
              />
              <GradientButton
                onPress={() => void handleMfa()}
                disabled={busy}
                rowDirection={rowDirection}
                icon={<ShieldCheck size={18} color="#ffffff" />}
                label={busy ? t.login.mfaSubmitBusy : t.login.mfaSubmit}
              />
              <Button variant="ghost" label={t.login.cancel} icon={<ArrowLeft size={18} />} onPress={reset} disabled={busy} />
            </View>
          ) : null}

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.danger }]}>
              <Text style={{ color: tokens.danger, fontWeight: "600", fontSize: 13, textAlign }}>
                {localizeLoginError(error, t, t.login.errorsField.googleFailed)}
              </Text>
              <Pressable onPress={() => Linking.openURL("https://luxipanel.com")}>
                <Text style={{ color: tokens.brandLight, marginTop: 4, textDecorationLine: "underline", fontSize: 13, textAlign }}>luxipanel.com</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, styles.footerNotice, { color: tokens.textMuted, textAlign }]}>{t.login.footer.termsNotice}</Text>
          <View style={[styles.footerLinksRow, { flexDirection: rowDirection }]}>
            <Pressable onPress={() => Linking.openURL("https://luxipanel.com/terms-and-conditions")} hitSlop={6}>
              <Text style={[styles.footerLink, { color: tokens.textSecondary }]}>{t.login.footer.terms}</Text>
            </Pressable>
            <Text style={[styles.footerDot, { color: tokens.textMuted }]}>·</Text>
            <Pressable onPress={() => Linking.openURL("https://luxipanel.com/privacy-policy")} hitSlop={6}>
              <Text style={[styles.footerLink, { color: tokens.textSecondary }]}>{t.login.footer.privacy}</Text>
            </Pressable>
            <Text style={[styles.footerDot, { color: tokens.textMuted }]}>·</Text>
            <Pressable onPress={() => Linking.openURL("https://luxipanel.com/es/refund-policy")} hitSlop={6}>
              <Text style={[styles.footerLink, { color: tokens.textSecondary }]}>{t.login.footer.refund}</Text>
            </Pressable>
          </View>
          <Text style={[styles.footerText, { color: tokens.textMuted }]}>{t.login.footer.copyright}</Text>
          <Pressable onPress={() => Linking.openURL("https://luxisoft.com/en/")} hitSlop={6}>
            <Text style={[styles.footerLink, styles.footerText, { color: tokens.brandLight }]}>{t.login.footer.createdBy}</Text>
          </Pressable>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

