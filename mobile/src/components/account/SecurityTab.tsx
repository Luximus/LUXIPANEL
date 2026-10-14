import { useConfirmation } from "../ui/useConfirmation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Switch, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { AlertTriangle, Copy, KeyRound, QrCode, RefreshCw, ShieldCheck, ShieldOff, Smartphone, Trash2 } from "lucide-react-native";
import {
  disableTotp,
  enableTotp,
  generateRecoveryCodes,
  getRecoveryCodeStatus,
  getTotpStatus,
  listSecurityPasskeys,
  revokeSecurityPasskey,
  setupTotp,
  type SecurityPasskey,
  type TotpSetupData,
} from "../../api/client";
import { isPasskeySupported, registerPasskey } from "../../api/passkey";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { SegmentedControl } from "../ui/SegmentedControl";
import { useStepUp } from "../StepUpProvider";
import { StepUpCodeForm } from "../StepUpCodeForm";
import { styles } from "./SecurityTab.styles";

/** Scope del gate de entrada a Seguridad (debe coincidir con el backend). */
const SECURITY_SCOPE = "security.access";

type SecurityTabId = "passkeys" | "codes" | "totp";

// Etiquetas de los scopes de step-up (idioma base ES; localizables a futuro).
// La granularidad es por acción (editar/eliminar separados).
const STEP_UP_TEXT = {
  heading: "Pedir 2FA por acción",
  help: "Elige en qué acciones se pedirá tu código 2FA. Entrar a Seguridad siempre lo pide.",
  needsTotp: "Activa 2FA arriba para configurar dónde pedirlo.",
};
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
// al tab se hidrata de aquí (sin refetch); las mutaciones actualizan el estado y
// el efecto de sync reescribe el cache. El botón "Actualizar" fuerza la recarga
// (load(true)). `securityLoaded` separa "ya cargó" de "tiene cache".
const securityCache = new Map<string, SecuritySnapshot>();
const securityLoaded = new Set<string>();

export function SecurityTab({
  language,
  token,
  onRegisterReload,
}: {
  language: string;
  token: string;
  /** Expone al contenedor la recarga forzada (para el pull-to-refresh del tab). */
  onRegisterReload?: (reload: () => Promise<void>) => void;
}) {
  const { askConfirmation, confirmation } = useConfirmation(language);
  function confirm(title: string, message: string, labels: { cancel: string; confirm: string }, destructive = false): Promise<boolean> {
    return new Promise((resolve) => {
      askConfirmation(title, message, [
        { text: labels.cancel, style: "cancel", onPress: () => resolve(false) },
        { text: labels.confirm, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ]);
    });
  }

  const messages = getMessages(language);
  const s = messages.security;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const [activeTab, setActiveTab] = useState<SecurityTabId>("passkeys");
  const [passkeys, setPasskeys] = useState<SecurityPasskey[]>(() => securityCache.get(token)?.passkeys ?? []);
  const [passkeyLabel, setPasskeyLabel] = useState("");
  const [passkeyStatus, setPasskeyStatus] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState(() => securityCache.get(token)?.recoveryStatus ?? s.checking);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [totpStatus, setTotpStatus] = useState(() => securityCache.get(token)?.totpStatus ?? s.checking);
  const [totpEnabled, setTotpEnabled] = useState(() => securityCache.get(token)?.totpEnabled ?? false);
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupData | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  // Código TOTP señalado como inválido (vacío/incompleto al activar): borde rojo + foco.
  const [totpCodeInvalid, setTotpCodeInvalid] = useState(false);
  const totpCodeRef = React.useRef<TextInput>(null);
  const [loading, setLoading] = useState(false);
  const passkeyAvailable = isPasskeySupported();
  const stepUp = useStepUp();
  // Gate inline: si hay 2FA y no hay token vigente, el panel muestra el formulario
  // 2FA en vez del contenido (sin modal). Al verificar se cachea el token y se
  // desbloquea; el cache vive en el provider (root), así volver al tab no re-pide.
  const [unlocked, setUnlocked] = useState(() => stepUp.isUnlocked(SECURITY_SCOPE));

  const load = useCallback(async (force = false) => {
    if (!token) return;
    // Solo la primera carga (o un refresh forzado por el usuario) consulta la
    // API; al re-entrar al tab se reutiliza el estado hidratado del cache.
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

  // Pull-to-refresh del tab "Seguridad": expone la recarga forzada al contenedor.
  useEffect(() => {
    onRegisterReload?.(() => load(true));
  }, [onRegisterReload, load]);

  // Sin 2FA (o token ya vigente) → desbloqueado directo. Espera al bootstrap del
  // provider (`ready`) para no decidir con `totpEnabled` aún sin resolver.
  useEffect(() => {
    if (stepUp.ready && (!stepUp.totpEnabled || stepUp.isUnlocked(SECURITY_SCOPE))) {
      setUnlocked(true);
    }
  }, [stepUp.ready, stepUp.totpEnabled, stepUp]);

  // Carga los reads de Seguridad y, DESPUÉS, las prefs granulares de step-up SOLO
  // cuando ya está desbloqueado: así las lecturas gateadas reusan el token que
  // cacheó el formulario inline y nunca disparan el modal global.
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

  const tabs = useMemo<Array<{ id: SecurityTabId; label: string }>>(
    () => [
      { id: "passkeys", label: s.tabs.passkeys },
      { id: "codes", label: s.tabs.codes },
      { id: "totp", label: s.tabs.totp },
    ],
    [s],
  );

  const addPasskey = async () => {
    if (!token) return;
    setPasskeyStatus(s.passkeyRequesting);
    try {
      await registerPasskey(passkeyLabel.trim() || s.defaultPasskeyName, token);
      setPasskeyLabel("");
      setPasskeyStatus(s.passkeyRegistered);
      setPasskeys(await listSecurityPasskeys(token));
    } catch (error) {
      setPasskeyStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const revokePasskey = async (id: string) => {
    if (!token) return;
    const ok = await confirm(s.revokeTitle, s.revokeMessage, s, true);
    if (!ok) return;
    try {
      await revokeSecurityPasskey(id, token);
      setPasskeys(await listSecurityPasskeys(token));
    } catch (error) {
      Alert.alert(s.revokeErrorTitle, error instanceof Error ? error.message : String(error));
    }
  };

  const regenerateCodes = async () => {
    if (!token) return;
    const ok = await confirm(s.regenerateTitle, s.regenerateMessage, s, true);
    if (!ok) return;
    setRecoveryStatus(s.generating);
    try {
      const codes = await generateRecoveryCodes(token);
      setRecoveryCodes(codes);
      setRecoveryStatus(s.codesGenerated);
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const copyCodes = async () => {
    await Clipboard.setStringAsync(recoveryCodes.join("\n"));
    Alert.alert(s.codesCopiedTitle, s.codesCopiedMessage);
  };

  const startTotpSetup = async () => {
    if (!token) return;
    setTotpStatus(s.totpSecretGenerating);
    setTotpError("");
    try {
      const data = await setupTotp(token);
      setTotpSetupData(data);
      setTotpStatus(s.totpVerify);
    } catch (error) {
      setTotpStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const confirmTotp = async () => {
    if (!token) return;
    // El código TOTP de 6 dígitos es obligatorio para activar 2FA: resalta y
    // enfoca el campo si falta o está incompleto.
    if (!/^\d{6}$/.test(totpCode.trim())) {
      setTotpCodeInvalid(true);
      setTotpError(messages.errors.totpCodeRequired);
      totpCodeRef.current?.focus();
      return;
    }
    setTotpCodeInvalid(false);
    setTotpError("");
    try {
      await enableTotp(totpCode.trim(), token);
      setTotpCode("");
      setTotpSetupData(null);
      setTotpEnabled(true);
      setTotpStatus(s.totpActive);
      void stepUp.refresh();
    } catch (error) {
      setTotpError(error instanceof Error ? error.message : String(error));
    }
  };

  const turnOffTotp = async () => {
    if (!token) return;
    const ok = await confirm(s.disableTotpTitle, s.disableTotpMessage, s, true);
    if (!ok) return;
    try {
      await disableTotp(token);
      setTotpEnabled(false);
      setTotpStatus(s.totpConfiguredDisabled);
      void stepUp.refresh();
    } catch (error) {
      Alert.alert(s.disableTotpErrorTitle, error instanceof Error ? error.message : String(error));
    }
  };

  // Mientras el provider resuelve si hay 2FA, evita parpadeos / disparar el gate.
  if (!stepUp.ready) {
    return <>
      {confirmation}
      <View style={[styles.root, { alignItems: "center", justifyContent: "center", paddingVertical: 40 }]}>
        <ActivityIndicator color={tokens.brand} />
      </View>
    </>;
  }

  // Gate INLINE: 2FA dentro del propio panel (sin modal). Al verificar, cachea el
  // token en el provider y desbloquea el contenido.
  if (!unlocked) {
    return <>
      {confirmation}
      <View style={styles.root}>
        <View style={[styles.topRow, { flexDirection: rowDirection }]}>
          <View style={styles.topText}>
            <Text style={[styles.topTitle, { color: tokens.textPrimary, textAlign }]}>{s.heroTitle}</Text>
            <Text style={[styles.topSubtitle, { color: tokens.textSecondary, textAlign }]}>{s.gateSubtitle}</Text>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
          <SectionHeader
            icon={<ShieldCheck size={22} color={tokens.brand} />}
            title={messages.importExport.stepUp.title}
            body={s.gateSubtitle}
            textAlign={textAlign}
            tokens={tokens}
          />
          <StepUpCodeForm
            token={token}
            scope={SECURITY_SCOPE}
            language={language}
            onVerified={(tok) => { stepUp.cacheToken(SECURITY_SCOPE, tok); setUnlocked(true); }}
          />
        </View>
      </View>
    </>;
  }

  return <>
      {confirmation}
    <View style={styles.root}>
      <View style={[styles.topRow, { flexDirection: rowDirection }]}>
        <View style={styles.topText}>
          <Text style={[styles.topTitle, { color: tokens.textPrimary, textAlign }]}>{s.heroTitle}</Text>
          <Text style={[styles.topSubtitle, { color: tokens.textSecondary, textAlign }]}>{s.heroSubtitle}</Text>
        </View>
        <IconButton
          shape="round"
          size={42}
          variant="secondary"
          onPress={() => void load(true)}
          disabled={loading}
          accessibilityLabel={s.refreshAria}
          icon={loading ? <ActivityIndicator size="small" color={tokens.brand} /> : <RefreshCw size={18} />}
        />
      </View>

      <SegmentedControl
        items={tabs.map((tab) => ({
          key: tab.id,
          label: tab.label,
          icon: tab.id === "passkeys" ? <KeyRound size={14} /> : tab.id === "codes" ? <ShieldCheck size={14} /> : <Smartphone size={14} />,
        }))}
        value={activeTab}
        onChange={(k) => setActiveTab(k as SecurityTabId)}
        style={styles.tabs}
      />

      <View style={styles.scrollContent}>
        {activeTab === "passkeys" ? (
          <View style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
            <SectionHeader
              icon={<KeyRound size={22} color={tokens.brand} />}
              title={s.tabs.passkeys}
              body={s.passkeyBody}
              textAlign={textAlign}
              tokens={tokens}
            />
            <TextInput
              value={passkeyLabel}
              onChangeText={setPasskeyLabel}
              placeholder={s.passkeyPlaceholder}
              placeholderTextColor={tokens.textMuted}
              maxLength={128}
              style={[styles.input, { backgroundColor: tokens.bgInput, borderColor: tokens.border, color: tokens.textPrimary, textAlign }]}
            />
            <Button
              variant="primary"
              label={s.addPasskey}
              onPress={() => void addPasskey()}
              disabled={!passkeyAvailable}
            />
            {!passkeyAvailable ? (
              <Text style={[styles.muted, { color: tokens.textMuted, textAlign }]}>
                {s.passkeyUnavailable}
              </Text>
            ) : null}
            {passkeyStatus ? <Text style={[styles.muted, { color: tokens.textMuted, textAlign }]}>{passkeyStatus}</Text> : null}
            <View style={styles.list}>
              {passkeys.length === 0 ? (
                <Text style={[styles.empty, { color: tokens.textMuted, textAlign }]}>{s.passkeyEmpty}</Text>
              ) : passkeys.map((passkey) => (
                <View key={passkey.id} style={[styles.passkeyRow, { borderColor: tokens.border, flexDirection: rowDirection }]}>
                  <View style={[styles.passkeyChip, { backgroundColor: tokens.brandDim }]}>
                    <KeyRound size={16} color={tokens.brand} />
                  </View>
                  <View style={styles.passkeyInfo}>
                    <Text style={[styles.rowTitle, { color: tokens.textPrimary, textAlign }]}>{passkey.label}</Text>
                    <Text style={[styles.rowMeta, { color: tokens.textMuted, textAlign }]}>{s.created}: {formatDate(passkey.createdAt, s.never)}</Text>
                    <Text style={[styles.rowMeta, { color: tokens.textMuted, textAlign }]}>{s.lastUsed}: {formatDate(passkey.lastUsedAt, s.never)}</Text>
                  </View>
                  <IconButton
                    variant="secondary"
                    size={38}
                    onPress={() => void revokePasskey(passkey.id)}
                    icon={<Trash2 size={18} color={tokens.danger} />}
                    style={{ backgroundColor: "transparent" }}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {activeTab === "codes" ? (
          <View style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
            <SectionHeader
              icon={<ShieldCheck size={22} color={tokens.brand} />}
              title={s.codesTitle}
              body={s.codesBody}
              textAlign={textAlign}
              tokens={tokens}
            />
            <Text style={[styles.muted, { color: tokens.textMuted, textAlign }]}>{recoveryStatus}</Text>
            <Button variant="primary" label={s.generateCodes} onPress={() => void regenerateCodes()} />
            {recoveryCodes.length > 0 ? (
              <View style={[styles.warningBox, { borderColor: tokens.warning }]}>
                <View style={[styles.warningHeader, { flexDirection: rowDirection }]}>
                  <AlertTriangle size={16} color={tokens.warning} />
                  <Text style={[styles.warningText, { color: tokens.textPrimary, textAlign }]}>
                    {s.warningCodes}
                  </Text>
                </View>
                <View style={styles.codesGrid}>
                  {recoveryCodes.map((code) => (
                    <Text key={code} style={[styles.codeText, { color: tokens.textPrimary }]}>{code}</Text>
                  ))}
                </View>
                <Button variant="ghost" label={s.copyAll} icon={<Copy size={16} />} onPress={() => void copyCodes()} />
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === "totp" ? (
          <View style={[styles.card, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}>
            <SectionHeader
              icon={totpEnabled ? <ShieldCheck size={22} color={tokens.brand} /> : <ShieldOff size={22} color={tokens.textMuted} />}
              title={s.totpTitle}
              body={s.totpBody}
              textAlign={textAlign}
              tokens={tokens}
            />
            <Text style={[styles.muted, { color: tokens.textMuted, textAlign }]}>{totpStatus}</Text>
            {totpEnabled ? (
              <Button variant="danger" label={s.disable2fa} onPress={() => void turnOffTotp()} />
            ) : (
              <Button variant="primary" label={s.configure2fa} onPress={() => void startTotpSetup()} />
            )}
            {totpSetupData ? (
              <View style={[styles.wizard, { borderColor: tokens.border }]}>
                <Text style={[styles.muted, { color: tokens.textMuted, textAlign }]}>
                  {s.scanQr}
                </Text>
                <Image source={{ uri: totpSetupData.qrDataUrl }} style={styles.qr} />
                <View style={[styles.secretBox, { backgroundColor: tokens.bgSecondary, flexDirection: rowDirection }]}>
                  <QrCode size={16} color={tokens.textMuted} />
                  <Text style={[styles.secretText, { color: tokens.textPrimary }]}>{totpSetupData.secret}</Text>
                </View>
                <TextInput
                  ref={totpCodeRef}
                  value={totpCode}
                  onChangeText={(next) => {
                    if (totpCodeInvalid) setTotpCodeInvalid(false);
                    setTotpCode(next.replace(/\D/g, "").slice(0, 6));
                  }}
                  placeholder="000000"
                  placeholderTextColor={tokens.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[styles.codeInput, { backgroundColor: tokens.bgInput, borderColor: totpCodeInvalid ? tokens.danger : tokens.border, color: tokens.textPrimary }]}
                />
                <View style={[styles.actionsRow, { flexDirection: rowDirection }]}>
                  <Button
                    variant="ghost"
                    label={s.cancel}
                    onPress={() => { setTotpSetupData(null); setTotpCode(""); }}
                  />
                  <Button variant="primary" label={s.activate2fa} onPress={() => void confirmTotp()} />
                </View>
                {totpError ? <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{totpError}</Text> : null}
              </View>
            ) : null}

            {/* Preferencias granulares: dónde pedir 2FA. Entrar a Seguridad
                siempre lo pide; el resto es opt-in por acción. */}
            <View style={[styles.stepUpBox, { borderColor: tokens.border }]}>
              <Text style={[styles.rowTitle, { color: tokens.textPrimary, textAlign }]}>{STEP_UP_TEXT.heading}</Text>
              <Text style={[styles.muted, { color: tokens.textMuted, textAlign }]}>{STEP_UP_TEXT.help}</Text>
              {!totpEnabled ? (
                <Text style={[styles.muted, { color: tokens.textMuted, textAlign }]}>{STEP_UP_TEXT.needsTotp}</Text>
              ) : (
                stepUp.availableScopes.map((scope) => {
                  const on = stepUp.enabledScopes.includes(scope);
                  return (
                    <View key={scope} style={[styles.stepUpRow, { borderTopColor: tokens.border, flexDirection: rowDirection }]}>
                      <Text style={[styles.stepUpLabel, { color: tokens.textSecondary, textAlign }]}>
                        {STEP_UP_SCOPE_LABELS[scope] ?? scope}
                      </Text>
                      <Switch
                        value={on}
                        onValueChange={(next) => {
                          const set = new Set(stepUp.enabledScopes);
                          if (next) set.add(scope); else set.delete(scope);
                          void stepUp.saveScopes(Array.from(set));
                        }}
                        trackColor={{ true: tokens.brand, false: tokens.border }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  );
                })
              )}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  </>;
}

function SectionHeader({
  icon,
  title,
  body,
  textAlign,
  tokens,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  textAlign: "auto" | "left" | "right" | "center" | "justify";
  tokens: ReturnType<typeof getThemeTokens>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>{icon}</View>
      <View style={styles.sectionText}>
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary, textAlign }]}>{title}</Text>
        <Text style={[styles.sectionBody, { color: tokens.textSecondary, textAlign }]}>{body}</Text>
      </View>
    </View>
  );
}
