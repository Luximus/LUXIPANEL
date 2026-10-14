import React, { useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Check, Eye, EyeOff, Fingerprint, Globe2, KeyRound, LockKeyhole, Settings, ShieldCheck, UserRound, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PanelText as Text } from "../ui/PanelText";
import { ThemeIconButton } from "../ui/ThemeIconButton";
import { PixelSnowBackground } from "./PixelSnowBackground";
import { LoginAction, LoginField, LoginNotice, type LoginNoticeTone } from "./LoginControls";
import { getThemeTokens, readableTextOn, withAlpha } from "../../theme/colors";
import { panelLoginMessages } from "../../i18n/panel-login";
import { connectionMessages } from "../../i18n/connections";
import type { ThemeOrigin } from "../../theme/theme-transition";
import type { ThemeMode } from "../../features/app/types";
import type { PanelLoginMethods } from "../../api/directAuth";
import { ConnectionForm, ConnectionSelector, type ConnectionFormProps } from "./ConnectionForm";
import { LoginFormTransition } from "./LoginFormTransition";
import type { StandaloneServer } from "../../storage/standaloneServers";
import logo from "../../../assets/logo2.png";

export type LoginMethod = "password" | "passkey" | "recovery";
export type LoginValues = { user: string; password: string; recovery: string; code: string };
export type DirectLoginProps = {
  theme: ThemeMode; language: string; layout: Record<string, string>; profile: StandaloneServer | null;
  methods: PanelLoginMethods | null; method: LoginMethod; busy: boolean; partial: boolean;
  values: LoginValues; remember: boolean; visiblePassword: boolean; notice: string; noticeTone: LoginNoticeTone;
  onValue: (field: keyof LoginValues, value: string) => void; onMethod: (method: LoginMethod) => void;
  onRemember: () => void; onVisibility: () => void; onBack: () => void;
  onSubmit: () => void; onRetry: () => void; onConfigure: () => void; onLanguage: () => void;
  onTheme: (origin?: ThemeOrigin) => void;
  config: boolean; connection: ConnectionFormProps;
};

function LoginLogo({ layout, baseUrl }: { layout: Record<string, string>; baseUrl?: string }) {
  let uri: string | undefined;
  const configured = layout.layout_logo_login || layout.layout_logo;
  try { if (configured) { const candidate = new URL(configured, baseUrl); if (/^https?:$/.test(candidate.protocol)) uri = candidate.toString(); } } catch {}
  const [failed, setFailed] = useState<string>();
  return <View style={styles.logo}><Image accessibilityLabel="LUXIPANEL" source={uri && failed !== uri ? { uri } : logo}
    onError={() => setFailed(uri)} resizeMode="contain" style={{ width: 38, height: 38 }} /></View>;
}

export function DirectLoginScreen(p: DirectLoginProps) {
  const dark = p.theme === "dark", colors = getThemeTokens(dark), insets = useSafeAreaInsets();
  const t = panelLoginMessages(p.language), c = connectionMessages(p.language), rtl = p.language.startsWith("ar");
  const second = useRef<TextInput>(null);
  const row = rtl ? "row-reverse" : "row";
  const iconColor = colors.textMuted;
  const submitLabel = p.partial ? t.text.verify : p.method === "passkey" ? t.text.usePasskey : p.method === "recovery" ? t.text.verifyCode : t.text.signIn;
  const selectedMethods = (["password", "passkey", "recovery"] as const).filter(method => p.methods?.[method]);
  const MethodsIcon = { password: LockKeyhole, passkey: Fingerprint, recovery: KeyRound };
  const iconButton = (label: string, icon: React.ReactNode, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    onPress={action} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.bgCardSolid, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>{icon}</Pressable>;
  const field = (name: keyof LoginValues, label: string, icon: React.ReactNode, extra: React.ComponentProps<typeof TextInput> = {}) =>
    <LoginField label={label} colors={colors} rtl={rtl} icon={icon} value={p.values[name]} editable={!p.busy}
      onChangeText={value => p.onValue(name, value)} returnKeyType="go" onSubmitEditing={p.onSubmit} {...extra} />;
  return <View style={{ flex: 1 }}>
    <PixelSnowBackground layout={p.layout} dark={dark} />
    <View style={[styles.toolbar, { flexDirection: row }]}>
      {iconButton(p.config && p.connection.profiles.length ? c.close : c.configure,
        p.config && p.connection.profiles.length ? <X size={19} color={colors.textSecondary} /> : <Settings size={19} color={colors.textSecondary} />, p.onConfigure)}
      <View style={{ flexDirection: row, alignItems: "center", gap: 8 }}>
        <ThemeIconButton theme={p.theme} label={c.theme} onToggle={p.onTheme} />
        <Pressable accessibilityRole="button" accessibilityLabel={t.languageLabel} onPress={p.onLanguage}
          style={({ pressed }) => [styles.language, { backgroundColor: colors.bgCardSolid, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
          <Globe2 size={17} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>{p.language.toUpperCase()}</Text>
        </Pressable>
      </View>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.column}>
          <View style={styles.brand}>
            <LoginLogo layout={p.layout} baseUrl={p.profile?.baseUrl} />
            <Text style={{ color: colors.textPrimary, fontSize: 24, letterSpacing: 1.4, fontWeight: "700" }}>LUXIPANEL</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t.panelSubtitle}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: dark ? "#000000" : "#151c2c" }]}>
            <LoginFormTransition mode={p.config ? "connection" : "login"}>
            <View style={{ gap: 14 }}>
              <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 25, fontWeight: "700", textAlign: rtl ? "right" : "left" }}>
                {p.config ? (p.connection.editing ? c.edit : c.configure) : p.partial ? t.text.twoFactorTitle : t.pageTitle}
              </Text>
              {!p.config ? <ConnectionSelector {...p.connection} busy={p.connection.operation !== null} /> : null}
            </View>
            {p.config ? <ConnectionForm {...p.connection} /> : p.profile && p.methods ? <>
              {!p.partial && selectedMethods.length > 1 ? <View accessibilityRole="tablist" style={[styles.methods, { flexDirection: row, backgroundColor: colors.bgSecondary }]}>
                {selectedMethods.map(method => {
                  const Icon = MethodsIcon[method], active = p.method === method;
                  return <Pressable key={method} accessibilityRole="tab" accessibilityState={{ selected: active, disabled: p.busy }} disabled={p.busy}
                    onPress={() => p.onMethod(method)} style={[styles.method, { backgroundColor: active ? colors.bgCardSolid : "transparent", borderColor: active ? colors.border : "transparent" }]}>
                    <Icon size={17} color={active ? colors.brand : colors.textMuted} />
                    <Text style={{ color: active ? colors.textPrimary : colors.textMuted, fontSize: 11, fontWeight: active ? "700" : "400", textAlign: "center" }}>{t.tabs[method]}</Text>
                  </Pressable>;
                })}
              </View> : null}
              {p.partial ? <>
                <View style={[styles.methodHero, { backgroundColor: colors.brandDim }]}><ShieldCheck size={30} color={colors.brand} /></View>
                <Text style={[styles.help, { color: colors.textSecondary }]}>{t.text.twoFactorHelp}</Text>
                {field("code", t.labels.code6Digits, undefined, { keyboardType: "number-pad", maxLength: 6, autoComplete: "one-time-code", textContentType: "oneTimeCode", placeholder: t.placeholders.totp, style: { textAlign: "center", letterSpacing: 7, fontSize: 22 } })}
              </> : p.method === "passkey" ? <View style={{ gap: 14, alignItems: "center", paddingVertical: 14 }}>
                <View style={[styles.methodHero, { backgroundColor: colors.brandDim }]}><Fingerprint size={36} color={colors.brand} /></View>
                <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "700", textAlign: "center" }}>{t.text.biometricAuth}</Text>
                <Text style={[styles.help, { color: colors.textSecondary, textAlign: "center" }]}>{t.text.biometricHelp}</Text>
              </View> : <>
                <LoginField label={t.labels.user} colors={colors} rtl={rtl} icon={<UserRound size={18} color={iconColor} />} value={p.values.user}
                  editable={!p.busy} onChangeText={value => p.onValue("user", value)} placeholder={t.placeholders.user} autoComplete="username" textContentType="username"
                  returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => second.current?.focus()} />
                {p.method === "recovery" ? <>
                  <LoginField ref={second} label={t.labels.recoveryCode} colors={colors} rtl={rtl} icon={<KeyRound size={18} color={iconColor} />} value={p.values.recovery}
                    editable={!p.busy} onChangeText={value => p.onValue("recovery", value)} placeholder={t.placeholders.recoveryCode} autoComplete="off" returnKeyType="go" onSubmitEditing={p.onSubmit} />
                  <Text style={[styles.help, { color: colors.textMuted }]}>{t.text.recoveryWarning}</Text>
                </> : <LoginField ref={second} label={t.labels.password} colors={colors} rtl={rtl} icon={<LockKeyhole size={18} color={iconColor} />} value={p.values.password}
                  editable={!p.busy} secureTextEntry={!p.visiblePassword} autoComplete="current-password" textContentType="password" placeholder={t.placeholders.password}
                  onChangeText={value => p.onValue("password", value)} returnKeyType="go" onSubmitEditing={p.onSubmit}
                  suffix={<Pressable accessibilityRole="button" accessibilityLabel={p.visiblePassword ? c.hidePassword : c.showPassword} onPress={p.onVisibility} hitSlop={4} style={styles.eye}>
                    {p.visiblePassword ? <EyeOff size={19} color={iconColor} /> : <Eye size={19} color={iconColor} />}
                  </Pressable>} />}
              </>}
              {!p.partial ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: p.remember, disabled: p.busy }} disabled={p.busy}
                onPress={p.onRemember} style={{ flexDirection: row, alignItems: "center", gap: 10, minHeight: 44 }}>
                <View style={[styles.checkbox, { backgroundColor: p.remember ? colors.brand : colors.bgInput, borderColor: p.remember ? colors.brand : colors.borderStrong }]}>
                  {p.remember ? <Check size={14} color={readableTextOn(colors.brand, "#151c2c")} /> : null}
                </View><Text style={{ color: colors.textSecondary, fontSize: 13, flexShrink: 1 }}>{t.labels.remember}</Text>
              </Pressable> : null}
              {p.notice ? <LoginNotice message={p.notice} tone={p.noticeTone} colors={colors} /> : null}
              <LoginAction label={submitLabel} onPress={p.onSubmit} colors={colors} busy={p.busy} primary />
              {p.partial ? <LoginAction label={t.backToLogin} onPress={p.onBack} colors={colors} disabled={p.busy} /> : null}
            </> : <View style={{ gap: 16 }}>
              <Text style={[styles.help, { color: colors.textSecondary }]}>{p.profile ? (p.busy ? c.connecting : c.selectServer) : c.deployed}</Text>
              {p.notice ? <LoginNotice message={p.notice} tone={p.noticeTone} colors={colors} /> : null}
              <LoginAction label={p.profile ? c.retry : c.configure} onPress={p.profile ? p.onRetry : p.onConfigure} colors={colors} busy={p.busy} primary />
            </View>}
            </LoginFormTransition>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, alignItems: "center", justifyContent: "space-between", gap: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  language: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 14, flexDirection: "row", gap: 7, alignItems: "center" },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, paddingTop: 16 },
  column: { width: "100%", maxWidth: 420, gap: 18 },
  brand: { alignItems: "center", gap: 6 },
  logo: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", marginBottom: 4, borderWidth: 1, borderColor: "#0000000a" },
  card: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 14, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.12, shadowRadius: 28, elevation: 6 },
  server: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", gap: 10 },
  methods: { padding: 4, borderRadius: 16, gap: 4 },
  method: { flex: 1, minWidth: 0, minHeight: 52, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 3, paddingVertical: 8 },
  help: { fontSize: 13, lineHeight: 20 },
  methodHero: { width: 66, height: 66, borderRadius: 22, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  eye: { width: 44, minHeight: 44, marginEnd: -9, alignItems: "center", justifyContent: "center" },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  link: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
