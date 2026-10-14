import { localizeServerError } from '../../../lib/server-error-localization';
import { nativeText } from '../../../i18n/native-text';
import { ModuleLoading } from "../../../components/server/ModuleLoading";
import {serverUserModuleLabel} from "../../../i18n/server-user-messages";
/**
 * DirectPanelConnectScreen — flujo NATIVO de "Conectar" para un panel del
 * **directorio LP** (registro de servidores de la cuenta), SIN webview y SIN
 * gateway LP-LS.
 *
 * Reemplaza el antiguo connect (redirectUrl SSO → SshScreen/webview). Al pulsar
 * "Conectar" en una tarjeta:
 *   1. Resuelve `baseUrl` = `panel.customDomain` (URL COMPLETA canónica de
 *      acceso al LUXIPANEL: esquema/puerto opcionales, puede ser IP con
 *      puerto). `normalizeBaseUrl` añade https por defecto y PRESERVA
 *      esquema/puerto/ruta (solo limpia barra final y un `/api` colgante).
 *   2. Autentica DIRECTO contra el backend LUXIPANEL del box (`/api/login` +
 *      2FA) reusando `directAuth`; si ya hay sesión/contraseña guardada para el
 *      `panelId`, reconecta en silencio (un-tap).
 *      Si no hay sesión nativa, usa el handoff de LP con las credenciales ya
 *      guardadas en la bóveda. La terminal nunca pide volver a escribirlas.
 *   3. `registerDirectServer(panel.id, target)` — MISMO `panelId` que usan las
 *      pantallas nativas → todo el módulo nativo habla directo (ver `serverApi`).
 *   4. Abre el selector de módulos NATIVO (`ServerModuleScreen`) y las pantallas
 *      nativas (`renderModule`), idénticas al gestor standalone.
 *
 * Persistencia (opt-in) en `directPanelSession` (SecureStore) para reconexión
 * un-tap. Al cerrar, `unregisterDirectServer(panel.id)`, salvo cuando el login
 * transfiere el target al host de consolas mediante `onAuthenticated` (la sesión
 * guardada se conserva para el próximo un-tap; "Olvidar" la purga).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { ActivityIndicator, BackHandler, Pressable, TextInput, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { formatMessage, getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { Field, Checkbox, InfoBox, DialogFooter } from "../../../components/server/Form";
import { TablerServer } from "../../../features/app/tabler-icons";
import { LUX_MODULES, CORE_MODULES, TOOL_MODULES, type LuxModule } from "../../../features/app/luxipanel-modules";
import { registerDirectServer, unregisterDirectServer, getDirectSessionRevision, type DirectTarget } from "../../../api/serverApi";
import { registerForPanelPushNotifications } from "../../../lib/notifications";
import {
  loginStandalone,
  verifyStandaloneTotp,
  reloginStandalone,
  normalizeBaseUrl,
  type DirectSession,
} from "../../../api/directAuth";
import {
  getDirectPanelSession,
  setDirectPanelSession,
  getDirectPanelUsername,
  setDirectPanelUsername,
  getDirectPanelPassword,
  setDirectPanelPassword,
} from "../../../storage/directPanelSession";
import type { Panel } from "../../../types/models";
import { getPanelDisplayName } from "../../../features/app/utils";
import { PersistentNativeModules } from "../../main/PersistentNativeModules";
import { dismissNativeModuleDialog } from "../../main/native-module-context";
import { NATIVE_MODULE_IDS } from "../../main/shell-types";
import { fetchNativeModuleAccess } from "../native-module-access";
import { connectWithSavedPanelCredentials } from "../../../api/panelHandoff";

const MODULE_CATALOG: LuxModule[] = [...TOOL_MODULES, ...LUX_MODULES, ...CORE_MODULES];
const NATIVE_MODULES = MODULE_CATALOG.filter((module) => NATIVE_MODULE_IDS.has(module.id));

type ConnView =
  | { kind: "connecting" }
  | { kind: "connection-error" }
  | { kind: "credentials" }
  | { kind: "picker" }
  | { kind: "module"; moduleId: string };

function LoginInput(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: "default" | "number-pad";
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
      autoCapitalize="none"
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

export function DirectPanelConnectScreen({
  panel,
  initialModuleId = "assistant",
  onClose,
  onAuthenticated,
  portalToken,
  visible = true,
}: {
  panel: Panel;
  initialModuleId?: string;
  onClose: () => void;
  /** Transfiere la sesión al host de consolas al terminar el login. */
  onAuthenticated?: () => void;
  portalToken?: string;
  visible?: boolean;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverStandalone;
  const moduleLabels = getMessages(language).modules.labels as Record<string, string>;

  const panelId = panel.id;
  const transferredSession = useRef(false);
  const authenticatedRef = useRef(onAuthenticated);
  authenticatedRef.current = onAuthenticated;
  const panelName = getPanelDisplayName(panel);
  // URL canónica de acceso (customDomain, URL completa). El caller
  // (`openDirectConnect`) ya garantiza que el panel tiene URL configurada.
  const baseUrl = normalizeBaseUrl(panel.customDomain ?? "");

  const [view, setView] = useState<ConnView>({ kind: "connecting" });
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [allowedModules, setAllowedModules] = useState<Set<string> | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const refreshModuleAccess = useCallback(async () => {
    setCatalogError(null);
    try {
      const access = await fetchNativeModuleAccess(panelId);
      setAllowedModules(access);
      if (!access.has(initialModuleId)) setView({ kind: "picker" });
    }
    catch (cause) { setAllowedModules(null); setCatalogError(cause instanceof Error ? cause.message : nativeText("Error de catálogo")); }
  }, [panelId, initialModuleId]);
  // Credenciales.
  const [username, setUsername] = useState(panel.sshUsername ?? "");
  const [password, setPassword] = useState("");
  const [savePassword, setSavePassword] = useState(false);
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

  // Registra el DirectTarget bajo panel.id (con relogin silencioso por contraseña
  // guardada) — a partir de aquí TODAS las pantallas nativas hablan directo.
  const register = useCallback((session: DirectSession) => {
    const relogin = async (): Promise<DirectTarget | null> => {
      const revision = getDirectSessionRevision(panelId);
      const current = () => getDirectSessionRevision(panelId) === revision;
      let s = portalToken ? await connectWithSavedPanelCredentials(panelId, portalToken, baseUrl, panel.sshKeyId, current) : null;
      const [user, pw] = await Promise.all([
        getDirectPanelUsername(panelId),
        getDirectPanelPassword(panelId),
      ]);
      if (!s && user && pw) s = await reloginStandalone(baseUrl, user, pw);
      if (!s || !current()) return null;
      await setDirectPanelSession(panelId, s);
      if (!current()) return null;
      const next: DirectTarget = { baseUrl, jwt: s.jwt, csrf: s.csrf, exp: s.exp, relogin };
      registerDirectServer(panelId, next);
      return next;
    };
    const target: DirectTarget = { baseUrl, jwt: session.jwt, csrf: session.csrf, exp: session.exp, relogin };
    registerDirectServer(panelId, target);
    void refreshModuleAccess();
    void registerForPanelPushNotifications(panelId);
    if (authenticatedRef.current) {
      transferredSession.current = true;
      authenticatedRef.current();
    }
  }, [baseUrl, panelId, refreshModuleAccess, portalToken, panel.sshKeyId]);

  // Reusa la sesión nativa o la bóveda LP antes de ofrecer login manual.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await getDirectPanelSession(panelId);
      const validSaved = !!saved && saved.jwt && (saved.exp === 0 || saved.exp > Date.now() + 60_000);
      if (validSaved) {
        if (cancelled) return;
        register(saved as DirectSession);
        setView({ kind: "module", moduleId: initialModuleId });
        return;
      }
      if (portalToken) {
        const session = await connectWithSavedPanelCredentials(panelId, portalToken, baseUrl, panel.sshKeyId, () => !cancelled);
        if (cancelled) return;
        if (session) {
          await setDirectPanelSession(panelId, session);
          if (cancelled) return;
          register(session);
          setView({ kind: "module", moduleId: initialModuleId });
          return;
        }
      }
      // Sesión ausente/caducada: relogin silencioso si hay contraseña guardada.
      const [user, pw] = await Promise.all([
        getDirectPanelUsername(panelId),
        getDirectPanelPassword(panelId),
      ]);
      if (user && pw) {
        const s = await reloginStandalone(baseUrl, user, pw);
        if (cancelled) return;
        if (s) {
          await setDirectPanelSession(panelId, s);
          register(s);
          setView({ kind: "module", moduleId: initialModuleId });
          return;
        }
      }
      if (cancelled) return;
      if (initialModuleId === "terminal") {
        setError(baseUrl ? t.errSavedConnection : t.errBadUrl);
        setView({ kind: "connection-error" });
        return;
      }
      if (user) setUsername(user);
      setView({ kind: "credentials" });
    })().catch(() => {
      if (cancelled) return;
      setError(t.errSavedConnection);
      setView({ kind: "connection-error" });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, connectAttempt]);

  // El host de consolas conserva el target transferido hasta olvidar/logout.
  useEffect(() => {
    return () => { if (!transferredSession.current) unregisterDirectServer(panelId); };
  }, [panelId]);

  // Navegación atrás por hardware: paso a paso dentro del overlay.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!visible) return false;
      if (view.kind === "module") { if(dismissNativeModuleDialog(`${panelId}:${view.moduleId}`))return true;setView({ kind: "picker" }); return true; }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, view, onClose]);

  const persist = useCallback(async (session: DirectSession) => {
    const finalUser = username.trim();
    await setDirectPanelSession(panelId, session);
    await setDirectPanelUsername(panelId, finalUser);
    await setDirectPanelPassword(panelId, savePassword ? password : null);
    register(session);
    setView({ kind: "module", moduleId: initialModuleId });
  }, [panelId, username, password, savePassword, register, initialModuleId]);

  const submit = useCallback(async () => {
    setError(null);
    if (!baseUrl) { setError(t.errBadUrl); return; }
    const user = username.trim();
    if (!user || !password) return;
    setSubmitting(true);
    try {
      const r = await loginStandalone(baseUrl, user, password);
      if (r.status === "ok") { await persist(r.session); return; }
      if (r.status === "mfa") { setMfa(r.partial); return; }
      setError(mapError(r.code, r.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGeneric);
    } finally {
      setSubmitting(false);
    }
  }, [baseUrl, username, password, persist, t]);

  const submitTotp = useCallback(async () => {
    if (!mfa) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await verifyStandaloneTotp(baseUrl, mfa, code.trim());
      if (r.status === "ok") { setMfa(null); setCode(""); await persist(r.session); return; }
      setError(mapError(r.code, r.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGeneric);
    } finally {
      setSubmitting(false);
    }
  }, [mfa, baseUrl, code, persist, t]);

  function renderConnectionView() {

  // ── Conectando (sesión un-tap en curso) ─────────────────────────────────────
  if (view.kind === "connecting") {
    return (
      <ServerModuleScreen title={panelName} subtitle={baseUrl} onBack={onClose}>
        <View style={{ paddingVertical: 48, alignItems: "center", gap: 12 }}>
          <ActivityIndicator color={tokens.brand} />
          <Text style={{ color: tokens.textMuted, fontSize: 14 }}>{t.connecting}</Text>
        </View>
      </ServerModuleScreen>
    );
  }

  if (view.kind === "connection-error") {
    return (
      <ServerModuleScreen title={panelName} subtitle={baseUrl} onBack={onClose} error={error}>
        <DialogFooter
          onCancel={onClose}
          cancelLabel={t.cancel}
          onSubmit={() => {
            setError(null);
            setView({ kind: "connecting" });
            setConnectAttempt(attempt => attempt + 1);
          }}
          submitLabel={t.retryConnection}
        />
      </ServerModuleScreen>
    );
  }

  // ── Paso 2FA ────────────────────────────────────────────────────────────────
  if (view.kind === "credentials" && mfa) {
    return (
      <ServerModuleScreen title={t.twoFaTitle} onBack={() => { setMfa(null); setCode(""); }} error={error}>
        <InfoBox>{t.twoFaHint}</InfoBox>
        <Field label={t.twoFaTitle}>
          <LoginInput value={code} onChangeText={setCode} placeholder={t.twoFaPlaceholder} keyboardType="number-pad" maxLength={6} />
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

  // ── Credenciales del box (usuario Linux + contraseña + 2FA opt-in) ───────────
  if (view.kind === "credentials") {
    const canSubmit = !!username.trim() && !!password && !submitting;
    return (
      <ServerModuleScreen title={panelName} subtitle={baseUrl} onBack={onClose} error={error}>
        <InfoBox>{t.addHint}</InfoBox>
        <Field label={t.fieldUser}>
          <LoginInput value={username} onChangeText={setUsername} placeholder={t.fieldUserPlaceholder} />
        </Field>
        <Field label={t.fieldPassword}>
          <LoginInput value={password} onChangeText={setPassword} placeholder={t.fieldPasswordPlaceholder} secure />
        </Field>
        <View style={{ marginBottom: 14, gap: 6 }}>
          <Checkbox value={savePassword} onChange={setSavePassword} label={t.savePassword} />
          <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{formatMessage(t.savePasswordHint, {})}</Text>
        </View>
        <View style={{ flexDirection: "row" }}>
          <DialogFooter
            onCancel={onClose}
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

  // ── Selector de módulos NATIVO ──────────────────────────────────────────────
  return (
    <ServerModuleScreen
      title={panelName}
      subtitle={formatMessage(t.pickModuleSubtitle, { name: panelName })}
      onBack={onClose}
    >
      {catalogError ? <Text style={{ color: tokens.danger }}>{localizeServerError(catalogError)}</Text> : null}
      {!allowedModules ? catalogError ? <Pressable onPress={() => void refreshModuleAccess()}><Text style={{ color: tokens.brand }}>{nativeText("Reintentar")}</Text></Pressable> : <ModuleLoading /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {NATIVE_MODULES.filter((m) => allowedModules?.has(m.id)).map((m) => {
          const Icon = m.icon;
          return (
            <Pressable
              key={m.id}
              onPress={() => setView({ kind: "module", moduleId: m.id })}
              style={{
                width: "47%",
                flexGrow: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.bgCardSolid,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(tokens.brand, 0.12) }}>
                <Icon size={20} color={tokens.brand} />
              </View>
              <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 14, fontWeight: "600", flexShrink: 1 }}>
                {serverUserModuleLabel(m.id,language) ?? moduleLabels[m.labelKey] ?? m.id}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8, opacity: 0.6 }}>
        <TablerServer size={14} color={tokens.textMuted} />
        <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 12 }}>{baseUrl}</Text>
      </View>
    </ServerModuleScreen>
  );
  }
  return <View style={{flex:1}}>{renderConnectionView()}<PersistentNativeModules visible={visible} active={view.kind === "module" ? { panelId, moduleId: view.moduleId } : null} token="" onClose={() => {if(view.kind === "module") setView({ kind: "picker" });}}/></View>;

}
