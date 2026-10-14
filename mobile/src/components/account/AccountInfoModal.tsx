import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScopedNativeModal as NativeModal } from "../../screens/main/native-module-context";;
import { styles } from "../AccountMenu.styles";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import { Camera, Check, ChevronDown, Globe, ImageOff, LifeBuoy, LogOut, MessageCircle, Pencil, Trash2, UserPlus, X } from "lucide-react-native";
import { deleteCurrentAccount, getCurrentCustomer, updateCurrentCustomer, startWhatsappVerification, getWhatsappStatus, uploadAvatar, deleteAvatar, AVATAR_ALLOWED_MIMES } from "../../api/client";
import { COUNTRY_OPTIONS, DIAL_OPTIONS } from "../../lib/countries-data";
import { useAuth } from "../../context/useAuth";
import { LOCALES, formatMessage, getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens, readableTextOn } from "../../theme/colors";
import { Modal } from "../ui/Modal";
import { FormSheet } from "../ui/FormSheet";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Avatar } from "../ui/Avatar";

type CountryOption = { value: string; label: string };
type DialOption = { value: string; label: string };

/** Modal independiente de "Información" (perfil): avatar R2, datos personales,
 *  validación de teléfono por WhatsApp, idioma y eliminación de cuenta. Espejo de
 *  la sección `info` del dropdown de cuenta web/desktop. Las acciones de
 *  navegación (Servidores/Store/Bitácora/Soporte/Admin/cambiar cuenta) viven en
 *  el dropdown (`AccountMenu`), no aquí. */
export function AccountInfoPanel({
  visible,
  onClose,
  language,
  setLanguage,
  displayName,
  token,
  logout,
  switchAccount,
  toggleTheme,
  onSupport,
}: {
  visible: boolean;
  onClose: () => void;
  language: string;
  setLanguage: (next: string) => void;
  displayName: string;
  token: string | null;
  logout: () => Promise<void>;
  /** Acciones de cuenta integradas en las filas de Preferencias / pie (opcionales:
   *  el modal standalone no las pasa). El tema actual sale del `useTheme` local. */
  switchAccount?: () => Promise<void>;
  toggleTheme?: () => void;
  /** Abre el soporte (botón movido del ChatTopBar al pie del perfil). Opcional:
   *  ausente en el modal standalone y en modo invitado → no se muestra. */
  onSupport?: () => void;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const { userEmail, savedAccounts, updateCurrentAccountProfile } = useAuth();
  const currentAccount = useMemo(
    () => (userEmail ? savedAccounts.find((entry) => entry.email === userEmail) ?? null : null),
    [savedAccounts, userEmail],
  );
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(displayName);
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [locale, setLocale] = useState(language);
  const [loaded, setLoaded] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [dialOpen, setDialOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  // Lista estática COMPLETA compartida con web y desktop (lib/countries-data).
  const countryOptions: CountryOption[] = COUNTRY_OPTIONS;
  const dialOptions: DialOption[] = DIAL_OPTIONS.map((d) => ({ value: d, label: d }));
  const [phonePrefix, setPhonePrefix] = useState("+57");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // ── Avatar (foto de perfil en R2) ──
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoOverride, setPhotoOverride] = useState<string | null | undefined>(undefined);
  const [maxUploadMb, setMaxUploadMb] = useState<number>(5);
  // ── Verificación de teléfono por WhatsApp (OTP) ──
  const [waVerified, setWaVerified] = useState(false);
  const [waState, setWaState] = useState<"idle" | "starting" | "pending">("idle");
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const waPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef<string>("");
  const waCopy = (language === "en"
    ? { validate: "Verify on WhatsApp", verified: "Phone verified ✓", hint: "We opened WhatsApp with your code. Just send the message and we'll verify your number automatically.", open: "Open WhatsApp", waiting: "Waiting for confirmation…", error: "Couldn't start verification." }
    : { validate: "Validar por WhatsApp", verified: "Teléfono verificado ✓", hint: "Abrimos WhatsApp con tu código. Solo envía el mensaje y verificaremos tu número automáticamente.", open: "Abrir WhatsApp", waiting: "Esperando confirmación…", error: "No se pudo iniciar la validación." });
  const countriesLoading = false;
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const rtl = rowDirection === "row-reverse";

  const confirmDeleteAccount = () => {
    if (!token || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    void (async () => {
      try {
        await deleteCurrentAccount(token);
        setDeleting(false);
        setDeleteOpen(false);
        onClose();
        Alert.alert("LUXIPANEL", t.account.deleteAccountDeleted);
        await logout();
      } catch {
        setDeleting(false);
        setDeleteError(t.account.deleteAccountError);
      }
    })();
  };

  // Valores más recientes para los fallbacks del efecto de carga, SIN que sus
  // cambios re-disparen el efecto (evita resetear el form al editar/cambiar idioma).
  const loadDepsRef = useRef({ currentAccount, displayName, language, dialOptions });
  loadDepsRef.current = { currentAccount, displayName, language, dialOptions };

  useEffect(() => {
    if (!visible) return;
    const { currentAccount: acc, displayName: dn, language: lang, dialOptions: dials } = loadDepsRef.current;
    setLoaded(false);
    setPhotoOverride(undefined);
    setPhotoError(null);
    setName(acc?.displayName ?? dn);
    setCompany(acc?.company ?? "");
    setCountry(acc?.country ?? "");
    setPhoneNumber((acc?.phone ?? "").replace(/\D/g, ""));
    setLocale(acc?.locale ?? lang);
    if (!token) { setLoaded(true); return; }
    void (async () => {
      const me = await getCurrentCustomer(token);
      if (!me) return;
      setMaxUploadMb(me.maxUploadMb ?? 5);
      if (photoOverride === undefined && (me.photoUrl ?? null) !== (acc?.photoURL ?? null)) {
        void updateCurrentAccountProfile({ photoURL: me.photoUrl ?? null });
      }
      setName(me.name ?? dn);
      setCompany(me.company ?? "");
      setCountry(me.country ?? "");
      const rawPhone = (me.phone ?? "").trim();
      let prefix = me.phoneCountryCode?.trim() || "";
      let number = rawPhone.replace(/\D/g, "");
      if (!prefix && rawPhone.startsWith("+")) {
        const match = dials
          .map((o) => o.value.replace(/\D/g, ""))
          .filter((d) => d && number.startsWith(d))
          .sort((a, b) => b.length - a.length)[0];
        if (match) {
          prefix = `+${match}`;
          number = number.slice(match.length);
        }
      }
      setPhonePrefix(prefix || "+57");
      setPhoneNumber(number);
      setLocale(me.locale ?? lang);
      lastSavedRef.current = JSON.stringify({
        name: (me.name ?? dn).trim(),
        company: (me.company ?? "").trim() || null,
        country: (me.country ?? "").trim() || null,
        phoneCountryCode: number ? ((prefix || "+57").trim() || null) : null,
        phone: number || null,
        locale: me.locale ?? lang,
      });
      setLoaded(true);
    })();
    // Solo al abrir el modal (o cambiar de sesión).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, token]);

  // Refleja el idioma cambiado desde fuera del modal (p. ej. el webview del panel).
  useEffect(() => {
    setLocale(language);
  }, [language]);

  const localeCurrent = LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0];

  const openCountryPicker = useCallback(() => {
    setCountryOpen(true);
  }, []);

  const openDialPicker = useCallback(() => {
    setDialOpen(true);
  }, []);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return countryOptions;
    return countryOptions.filter((entry) => entry.label.toLowerCase().includes(q));
  }, [countryOptions, countrySearch]);

  useEffect(() => {
    if (!visible || !loaded || !token || !name.trim()) return;
    const localNumber = phoneNumber.replace(/\D/g, "");
    const payload = {
      name: name.trim(),
      company: company.trim() || null,
      country: country.trim() || null,
      phoneCountryCode: localNumber ? (phonePrefix.trim() || null) : null,
      phone: localNumber || null,
      locale,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      setSaving(true);
      void (async () => {
        const updated = await updateCurrentCustomer(payload, token);
        lastSavedRef.current = serialized;
        if (updated) {
          await updateCurrentAccountProfile({
            displayName: updated.name ?? name.trim(),
            company: updated.company ?? null,
            country: updated.country ?? null,
            phone: updated.phone ?? (localNumber || null),
            locale: updated.locale ?? locale,
          });
        }
        setSaving(false);
      })();
    }, 700);
    return () => clearTimeout(timer);
  }, [visible, loaded, token, name, company, country, phonePrefix, phoneNumber, locale, updateCurrentAccountProfile]);

  // ── WhatsApp: estado inicial + limpieza del polling ──
  const stopWaPoll = () => { if (waPollRef.current) { clearInterval(waPollRef.current); waPollRef.current = null; } };
  useEffect(() => {
    if (!visible || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const s = await getWhatsappStatus(token);
        if (!cancelled && s?.whatsapp_verified) setWaVerified(true);
      } catch { /* sin estado */ }
    })();
    return () => { cancelled = true; stopWaPoll(); };
  }, [visible, token]);

  async function startWaVerification() {
    if (!token) return;
    const number = phoneNumber.replace(/\D/g, "");
    if (!number) return;
    setWaError(null);
    setWaState("starting");
    try {
      const out = await startWhatsappVerification(token, `${phonePrefix}${number}`);
      setWaUrl(out.wa_url);
      setWaState("pending");
      if (out.wa_url) void Linking.openURL(out.wa_url).catch(() => {});
      stopWaPoll();
      waPollRef.current = setInterval(async () => {
        try {
          const s = await getWhatsappStatus(token);
          if (s?.whatsapp_verified) { setWaVerified(true); setWaState("idle"); stopWaPoll(); }
        } catch { /* reintenta */ }
      }, 4000);
    } catch {
      setWaState("idle");
      setWaError(waCopy.error);
    }
  }

  const currentPhotoURL = photoOverride !== undefined ? photoOverride : (currentAccount?.photoURL ?? null);

  async function onPickAvatar() {
    if (!token || photoBusy) return;
    setPhotoError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...AVATAR_ALLOWED_MIMES],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      const mime = asset.mimeType ?? "";
      if (!(AVATAR_ALLOWED_MIMES as readonly string[]).includes(mime)) {
        setPhotoError(t.account.photoTypeError);
        return;
      }
      const maxBytes = (maxUploadMb ?? 5) * 1024 * 1024;
      if (typeof asset.size === "number" && asset.size > maxBytes) {
        setPhotoError(formatMessage(t.account.photoSizeError, { n: maxUploadMb ?? 5 }));
        return;
      }
      setPhotoBusy(true);
      setPhotoProgress(0);
      const photoUrl = await uploadAvatar(
        { uri: asset.uri, name: asset.name ?? "avatar", type: mime, size: asset.size ?? undefined },
        token,
        setPhotoProgress,
      );
      setPhotoOverride(photoUrl);
      await updateCurrentAccountProfile({ photoURL: photoUrl });
    } catch (err) {
      setPhotoError(err instanceof Error && err.message ? err.message : t.account.photoError);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemoveAvatar() {
    if (!token || photoBusy) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await deleteAvatar(token);
      setPhotoOverride(null);
      await updateCurrentAccountProfile({ photoURL: null });
    } catch (err) {
      setPhotoError(err instanceof Error && err.message ? err.message : t.account.photoError);
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <>
      <View style={styles.tabPanel}>
      {/* Profile hero */}
      <LinearGradient
        colors={theme === "dark"
          ? ["#0d0f1a", "#131628", "#0a0e1f"] as const
          : ["#f4f4ff", "#eef0ff", "#e8eaff"] as const}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.profileCard, { borderColor: theme === "dark" ? "rgba(99,102,241,0.25)" : tokens.border }]}
      >
        <View style={styles.avatarBadgeWrap}>
          <Avatar photoURL={currentPhotoURL} displayName={name || displayName} size={84} />
          <Pressable
            onPress={() => void onPickAvatar()}
            disabled={photoBusy}
            accessibilityRole="button"
            accessibilityLabel={t.account.changePhoto}
            style={[styles.avatarCamBtn, { backgroundColor: tokens.brand, borderColor: theme === "dark" ? "#0d0f1a" : "#f4f4ff", opacity: photoBusy ? 0.6 : 1 }]}
          >
            {photoBusy ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={15} color="#fff" />}
          </Pressable>
          <View style={[styles.statusDot, { backgroundColor: tokens.success, borderColor: theme === "dark" ? "#0d0f1a" : "#f4f4ff" }]} />
        </View>

        <View style={[styles.photoActionsRow, { flexDirection: rowDirection }]}>
          <Pressable onPress={() => void onPickAvatar()} disabled={photoBusy} style={[styles.photoActionBtn, { flexDirection: rowDirection, opacity: photoBusy ? 0.6 : 1 }]}>
            <Camera size={13} color={tokens.brand} />
            <Text style={[styles.photoActionText, { color: tokens.brand }]}>{photoBusy ? t.account.uploadingPhoto : t.account.changePhoto}</Text>
          </Pressable>
          {currentPhotoURL ? (
            <Pressable onPress={() => void onRemoveAvatar()} disabled={photoBusy} style={[styles.photoActionBtn, { flexDirection: rowDirection, opacity: photoBusy ? 0.6 : 1 }]}>
              <ImageOff size={13} color={tokens.textMuted} />
              <Text style={[styles.photoActionText, { color: tokens.textMuted }]}>{t.account.removePhoto}</Text>
            </Pressable>
          ) : null}
        </View>
        {photoBusy ? (
          <View style={[styles.photoProgressRow, { flexDirection: rowDirection }]}>
            <View style={[styles.photoProgressTrack, { backgroundColor: theme === "dark" ? "rgba(99,102,241,0.18)" : tokens.border }]}>
              <View style={[styles.photoProgressFill, { backgroundColor: tokens.brand, width: `${photoProgress}%` }]} />
            </View>
            <Text style={[styles.photoProgressPct, { color: tokens.textMuted }]}>{photoProgress}%</Text>
          </View>
        ) : null}
        {photoError ? <Text style={[styles.photoErrorText, { color: tokens.danger, textAlign: "center" }]}>{photoError}</Text> : null}
        <View style={styles.nameWrap}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.account.nameLabel}
            placeholderTextColor={tokens.textMuted}
            style={[styles.inlineNameInput, { color: tokens.textPrimary }]}
            textAlign="center"
          />
          <Pencil size={13} color={tokens.textMuted} style={[styles.namePencil, rtl ? { left: 2 } : { right: 2 }]} />
        </View>
        <Text style={[styles.profileEmail, { color: tokens.textMuted, textAlign: "center" }]}>{userEmail ?? "-"}</Text>
        {/* Badge RELLENO con `tokens.success` (sigue la paleta del panel activo) y
            texto/punto auto-contrastados → legible en light y en cualquier paleta. */}
        <View style={[styles.onlinePill, { backgroundColor: tokens.success, shadowColor: tokens.success, flexDirection: rowDirection }]}>
          <View style={[styles.onlinePillDot, { backgroundColor: readableTextOn(tokens.success) }]} />
          <Text style={[styles.onlinePillText, { color: readableTextOn(tokens.success) }]}>{t.account.online}</Text>
        </View>
      </LinearGradient>

      {/* Personal details */}
      <Text style={[styles.sectionHeader, { color: tokens.textMuted, textAlign }]}>{t.account.detailsTitle}</Text>
      <View style={styles.section}>
        {/* País + Empresa en una sola fila. */}
        <View style={{ flexDirection: rowDirection, gap: 10 }}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: tokens.textMuted, textAlign }]}>{t.account.countryLabel}</Text>
            <Pressable
              onPress={openCountryPicker}
              style={[styles.selectTrigger, { borderColor: tokens.border, backgroundColor: tokens.bgInput, flexDirection: rowDirection }]}
            >
              <Text numberOfLines={1} style={[styles.selectTriggerLabel, { color: country ? tokens.textPrimary : tokens.textMuted, textAlign }]}>
                {(countryOptions.find((entry) => entry.value === country)?.label) ?? t.account.countryPlaceholder}
              </Text>
              <ChevronDown size={16} color={tokens.textMuted} />
            </Pressable>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: tokens.textMuted, textAlign }]}>{t.account.companyLabel}</Text>
            <TextInput value={company} onChangeText={setCompany} style={[styles.input, { borderColor: tokens.border, backgroundColor: tokens.bgInput, color: tokens.textPrimary, textAlign }]} />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.textMuted, textAlign }]}>{t.account.whatsapp}</Text>
          {/* Prefijo + número + botón validar (WhatsApp) en una sola fila. */}
          <View style={[styles.phoneRow, { flexDirection: rowDirection }]}>
            <Pressable
              onPress={openDialPicker}
              style={[styles.phonePrefixBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput, flexDirection: rowDirection }]}
            >
              <Text style={[styles.phonePrefixText, { color: tokens.textPrimary }]}>{phonePrefix}</Text>
              <ChevronDown size={14} color={tokens.textMuted} />
            </Pressable>
            <TextInput
              value={phoneNumber}
              onChangeText={(next) => setPhoneNumber(next.replace(/\D/g, "").slice(0, 20))}
              style={[styles.phoneNumberInput, { borderColor: tokens.border, backgroundColor: tokens.bgInput, color: tokens.textPrimary, textAlign }]}
              keyboardType="number-pad"
              maxLength={20}
            />
            {waVerified ? (
              <View style={[styles.phoneValidateBtn, { borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(52,211,153,0.12)" }]}>
                <Check size={18} color="#34d399" />
              </View>
            ) : (
              <Pressable
                onPress={() => void startWaVerification()}
                disabled={waState === "starting" || !phoneNumber.trim()}
                accessibilityLabel={waCopy.validate}
                style={[styles.phoneValidateBtn, { borderColor: "rgba(37,211,102,0.4)", opacity: waState === "starting" || !phoneNumber.trim() ? 0.5 : 1 }]}
              >
                {waState === "starting"
                  ? <ActivityIndicator size="small" color="#25d366" />
                  : <MessageCircle size={18} color="#25d366" />}
              </Pressable>
            )}
          </View>

          {/* Detalle de la validación (pendiente / error) bajo la fila. */}
          {!waVerified && (waState === "pending" || waError) ? (
            <View style={styles.waBox}>
              {waState === "pending" ? (
                <>
                  <Text style={[styles.waHint, { color: tokens.textMuted, textAlign }]}>{waCopy.hint}</Text>
                  {waUrl ? (
                    <Pressable
                      onPress={() => void Linking.openURL(waUrl!).catch(() => {})}
                      style={[styles.waStartBtn, { flexDirection: rowDirection }]}
                    >
                      <MessageCircle size={14} color="#25d366" />
                      <Text style={styles.waStartText}>{waCopy.open}</Text>
                    </Pressable>
                  ) : null}
                  <View style={[styles.waBadge, { flexDirection: rowDirection }]}>
                    <ActivityIndicator size="small" color={tokens.textMuted} />
                    <Text style={[styles.waWaiting, { color: tokens.textMuted }]}>{waCopy.waiting}</Text>
                  </View>
                </>
              ) : null}
              {waError ? <Text style={styles.waError}>{waError}</Text> : null}
            </View>
          ) : null}
        </View>
      </View>

      {/* Separador: datos personales ↔ preferencias. */}
      <View style={[styles.sectionDivider, { backgroundColor: tokens.border }]} />

      {/* Preferences */}
      <Text style={[styles.sectionHeader, { color: tokens.textMuted, textAlign }]}>{t.account.preferencesTitle}</Text>
      <View style={styles.section}>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.textMuted, textAlign }]}>{t.account.languageLabel}</Text>
          {/* Idioma + Usar otra cuenta en una sola fila. */}
          <View style={{ flexDirection: rowDirection, gap: 8, alignItems: "center" }}>
            <Pressable
              onPress={() => setLangOpen((v) => !v)}
              style={[styles.selectTrigger, { flex: 1, borderColor: tokens.border, backgroundColor: tokens.bgInput, flexDirection: rowDirection }]}
            >
              <Globe size={18} color={tokens.textSecondary} />
              <Text numberOfLines={1} style={[styles.selectTriggerLabel, { color: tokens.textSecondary, textAlign }]}>
                {localeCurrent.flag} {localeCurrent.label} ({localeCurrent.code.toUpperCase()})
              </Text>
              <ChevronDown size={16} color={tokens.textMuted} style={langOpen ? styles.chevronUp : undefined} />
            </Pressable>
            {switchAccount ? (
              <Button
                variant="secondary"
                size="sm"
                label={t.account.useAnotherAccount}
                icon={<UserPlus size={14} />}
                onPress={() => { void switchAccount(); }}
              />
            ) : null}
          </View>
          {langOpen ? (
            <View style={[styles.langList, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
              {LOCALES.map((entry) => {
                const active = entry.code === locale;
                return (
                  <Pressable
                    key={entry.code}
                    onPress={() => {
                      setLocale(entry.code);
                      setLanguage(entry.code);
                      setLangOpen(false);
                    }}
                    style={[
                      styles.langRow,
                      { flexDirection: rowDirection },
                      active ? { backgroundColor: tokens.brand } : null,
                    ]}
                  >
                    <Text style={[styles.langLabel, { color: active ? "#fff" : tokens.textSecondary, textAlign }]}>
                      {entry.flag} {entry.label}
                    </Text>
                    {active ? (
                      <Check size={15} color="#fff" />
                    ) : (
                      <Text style={[styles.langCode, { color: tokens.textMuted }]}>{entry.code.toUpperCase()}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      {/* Separador: preferencias ↔ acciones (soporte / tema / eliminar / salir). */}
      <View style={[styles.sectionDivider, { backgroundColor: tokens.border }]} />

      {/* Fila 1: Soporte (movido del ChatTopBar) + Eliminar cuenta (solo icono). */}
      <View style={{ flexDirection: rowDirection, alignItems: "center", gap: 8 }}>
        {onSupport ? (
          <Button
            variant="secondary"
            size="sm"
            label={t.titleBar.fabSupport}
            icon={<LifeBuoy size={14} color={tokens.textSecondary} />}
            style={{ flex: 1 }}
            onPress={onSupport}
          />
        ) : null}
        <IconButton
          variant="secondary"
          size={34}
          accessibilityLabel={t.account.deleteAccount}
          icon={<Trash2 size={16} color={tokens.textMuted} />}
          onPress={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        />
      </View>

      {/* Fila 2: Tema claro/oscuro + Cerrar sesión. */}
      <View style={{ flexDirection: rowDirection, alignItems: "center", gap: 8 }}>
        {toggleTheme ? <ThemeToggle theme={theme} onToggle={toggleTheme} /> : null}
        <Button
          variant="danger"
          size="sm"
          label={t.account.logout}
          icon={<LogOut size={14} />}
          style={{ flex: 1 }}
          onPress={() => { void logout(); }}
        />
      </View>

      <Modal
        visible={deleteOpen}
        onClose={() => { if (!deleting) setDeleteOpen(false); }}
        title={t.account.deleteAccountTitle}
        language={language}
        footer={
          <>
            <Button
              label={t.common.cancel}
              variant="ghost"
              onPress={() => setDeleteOpen(false)}
              disabled={deleting}
            />
            <Button
              label={deleting ? t.account.deleteAccountProcessing : t.account.deleteAccountConfirm}
              variant="danger"
              onPress={confirmDeleteAccount}
              loading={deleting}
              disabled={deleting}
            />
          </>
        }
      >
        <Text style={{ color: tokens.textSecondary, fontSize: 15, lineHeight: 22 }}>
          {t.account.deleteAccountDescription}
        </Text>
        {deleteError ? (
          <View style={[styles.deleteErrorBox, { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary }]}>
            <Text style={{ color: tokens.danger, fontSize: 13 }}>{deleteError}</Text>
          </View>
        ) : null}
      </Modal>
      </View>

      {/* Pickers país / prefijo. Backdrop no cierra al tocar fuera; cierre por la X. */}
      <NativeModal visible={countryOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.backdrop}>
          <View
            style={[styles.sheet, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}
          >
            <Pressable onPress={() => setCountryOpen(false)} accessibilityRole="button" accessibilityLabel={t.common.close} style={styles.pickerCloseRow}>
              <X size={18} color={tokens.textMuted} />
            </Pressable>
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder={t.account.countrySearch}
              placeholderTextColor={tokens.textMuted}
              style={[styles.searchInput, { borderColor: tokens.border, color: tokens.textPrimary }]}
              autoCapitalize="none"
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {countriesLoading && filteredCountries.length === 0 ? (
                <View style={styles.countryLoadingRow}>
                  <ActivityIndicator size="small" color={tokens.brand} />
                  <Text style={[styles.countryLabel, { color: tokens.textMuted }]}>
                    {`${t.splash.loading} ${t.account.countryLabel.toLowerCase()}…`}
                  </Text>
                </View>
              ) : filteredCountries.map((entry) => {
                const active = entry.value === country;
                return (
                  <Pressable
                    key={entry.value}
                    onPress={() => {
                      setCountry(entry.value);
                      setCountryOpen(false);
                    }}
                    style={[styles.countryRow, active ? { backgroundColor: tokens.brandDim } : null]}
                  >
                    <Text style={[styles.countryLabel, { color: active ? tokens.brand : tokens.textSecondary }]}>
                      {entry.label}
                    </Text>
                    {active ? <Check size={16} color={tokens.brand} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </NativeModal>

      <NativeModal visible={dialOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.backdrop}>
          <View
            style={[styles.sheet, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}
          >
            <Pressable onPress={() => setDialOpen(false)} accessibilityRole="button" accessibilityLabel={t.common.close} style={styles.pickerCloseRow}>
              <X size={18} color={tokens.textMuted} />
            </Pressable>
            <ScrollView showsVerticalScrollIndicator={false}>
              {dialOptions.map((entry) => {
                const active = entry.value === phonePrefix;
                return (
                  <Pressable
                    key={entry.value}
                    onPress={() => {
                      setPhonePrefix(entry.value);
                      setDialOpen(false);
                    }}
                    style={[styles.countryRow, active ? { backgroundColor: tokens.brandDim } : null]}
                  >
                    <Text style={[styles.countryLabel, { color: active ? tokens.brand : tokens.textSecondary }]}>
                      {entry.label}
                    </Text>
                    {active ? <Check size={16} color={tokens.brand} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </NativeModal>
    </>
  );
}

/** Modal independiente de "Información": envuelve `AccountInfoPanel` en el shell
 *  Modal. El panel también se reutiliza embebido en el tab "Perfil" del drawer. */
export function AccountInfoModal(props: React.ComponentProps<typeof AccountInfoPanel>) {
  return (
    <FormSheet
      visible={props.visible}
      onClose={props.onClose}
      title={getMessages(props.language).account.tabInfo}
      language={props.language}
    >
      <AccountInfoPanel {...props} />
    </FormSheet>
  );
}
