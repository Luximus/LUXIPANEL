import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { styles } from "./StepUpCodeModal.styles";
import { ChevronRight, Fingerprint, LifeBuoy, ShieldCheck, Smartphone } from "lucide-react-native";
import {
  getStepUpMethods,
  stepUpPasskeyOptions,
  stepUpPasskeyVerify,
  stepUpRecovery,
  verifyStepUp,
  type StepUpMethods,
} from "../api/client";
import { assertPasskeyForStepUp, isPasskeySupported } from "../api/passkey";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { Button } from "./ui/Button";
import { localizeCommonError } from "../lib/error-localization";

type Method = "passkey" | "totp" | "recovery";

/**
 * Formulario de re-verificación 2FA (step-up) MULTI-MÉTODO, SIN shell de modal.
 * Es el cuerpo extraído de `StepUpCodeModal` para poder mostrarlo embebido (inline)
 * dentro de un panel (p. ej. desbloquear Seguridad) o dentro de un `Modal` (resto de
 * scopes). Entrega el `stepUpToken` al padre vía `onVerified`. `onCancel` es opcional:
 * si se omite (uso inline obligatorio) no se muestra el botón de cancelar.
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
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const [methods, setMethods] = useState<StepUpMethods | null>(null);
  const [active, setActive] = useState<Method | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput | null>(null);

  const passkeyUsable = isPasskeySupported();

  const pickInitial = (m: StepUpMethods) => {
    const available: Method[] = [];
    if (m.passkey && passkeyUsable) available.push("passkey");
    if (m.totp) available.push("totp");
    if (m.recovery) available.push("recovery");
    if (available.length <= 1) {
      setShowSelector(false);
      setActive(available[0] ?? "totp");
    } else {
      setShowSelector(true);
      setActive(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await getStepUpMethods(token);
        if (cancelled) return;
        setMethods(m);
        pickInitial(m);
      } catch {
        if (cancelled) return;
        const fallback: StepUpMethods = { totp: true, passkey: false, recovery: false };
        setMethods(fallback);
        pickInitial(fallback);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (active === "totp" || active === "recovery") {
      const id = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(id);
    }
  }, [active]);

  // Lanza la ceremonia nativa de passkey en cuanto entramos a ese método.
  useEffect(() => {
    if (active !== "passkey" || busy) return;
    let cancelled = false;
    (async () => {
      setError("");
      setBusy(true);
      try {
        const options = await stepUpPasskeyOptions(scope, token);
        const assertion = await assertPasskeyForStepUp(options);
        if (cancelled) return;
        const { stepUpToken } = await stepUpPasskeyVerify(scope, assertion, token);
        if (cancelled) return;
        onVerified(stepUpToken);
      } catch (e) {
        if (cancelled) return;
        setError(localizeCommonError(e, t, tr.error));
        setBusy(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const submitCode = async () => {
    if (busy) return;
    if (active === "totp" && !/^\d{6}$/.test(code)) {
      setError(tr.error);
      return;
    }
    if (active === "recovery" && code.trim().length === 0) {
      setError(tr.error);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { stepUpToken } =
        active === "recovery"
          ? await stepUpRecovery(scope, code.trim(), token)
          : await verifyStepUp(code, token, scope);
      onVerified(stepUpToken);
    } catch (e) {
      setError(localizeCommonError(e, t, tr.error));
      setBusy(false);
    }
  };

  const chooseMethod = (m: Method) => {
    setError("");
    setCode("");
    setBusy(false);
    setShowSelector(false);
    setActive(m);
  };

  const backToSelector = () => {
    setError("");
    setCode("");
    setBusy(false);
    setActive(null);
    setShowSelector(true);
  };

  const multiMethod =
    !!methods &&
    [methods.passkey && passkeyUsable, methods.totp, methods.recovery].filter(Boolean).length > 1;

  const isCodeMethod = active === "totp" || active === "recovery";
  const codeValid = active === "totp" ? code.length === 6 : code.trim().length > 0;

  const renderSelectorRow = (m: Method, icon: React.ReactNode, name: string, hint: string) => (
    <Pressable
      key={m}
      onPress={() => chooseMethod(m)}
      style={({ pressed }) => [
        styles.methodRow,
        { borderColor: tokens.border, backgroundColor: pressed ? tokens.bgSecondary : tokens.bgInput },
      ]}
    >
      <View style={[styles.methodIcon, { backgroundColor: tokens.bgSecondary }]}>{icon}</View>
      <View style={styles.selectorMethodContent}>
        <Text style={{ color: tokens.textPrimary, fontSize: 14, fontWeight: "800" }}>{name}</Text>
        <Text style={{ color: tokens.textMuted, fontSize: 12, marginTop: 2 }}>{hint}</Text>
      </View>
      <ChevronRight size={18} color={tokens.textMuted} />
    </Pressable>
  );

  const actions = showSelector ? (
    onCancel ? <Button label={t.importExport.cancel} variant="ghost" onPress={onCancel} disabled={busy} /> : null
  ) : isCodeMethod ? (
    <>
      {multiMethod ? (
        <Button label={tr.back} variant="ghost" onPress={backToSelector} disabled={busy} />
      ) : onCancel ? (
        <Button label={t.importExport.cancel} variant="ghost" onPress={onCancel} disabled={busy} />
      ) : null}
      <Button
        label={busy ? tr.verifying : tr.verify}
        variant="primary"
        onPress={submitCode}
        loading={busy}
        disabled={busy || !codeValid}
        icon={<ShieldCheck size={14} color="#fff" />}
      />
    </>
  ) : (
    multiMethod ? (
      <Button label={tr.back} variant="ghost" onPress={backToSelector} disabled={busy} />
    ) : onCancel ? (
      <Button label={t.importExport.cancel} variant="ghost" onPress={onCancel} disabled={busy} />
    ) : null
  );

  return (
    <View style={{ gap: 12 }}>
      {showSelector ? (
        <>
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{tr.chooseMethod}</Text>
          <View style={styles.selectorMethodList}>
            {methods?.passkey && passkeyUsable
              ? renderSelectorRow("passkey", <Fingerprint size={18} color={tokens.brand} />, tr.methods.passkeyName, tr.methods.passkeyHint)
              : null}
            {methods?.totp
              ? renderSelectorRow("totp", <Smartphone size={18} color={tokens.brand} />, tr.methods.totpName, tr.methods.totpHint)
              : null}
            {methods?.recovery
              ? renderSelectorRow("recovery", <LifeBuoy size={18} color={tokens.brand} />, tr.methods.recoveryName, tr.methods.recoveryHint)
              : null}
          </View>
        </>
      ) : active === "passkey" ? (
        <View style={styles.passkeyView}>
          <Fingerprint size={40} color={tokens.brand} />
          <Text style={{ color: tokens.textMuted, fontSize: 13, textAlign: "center" }}>
            {busy ? tr.passkeyVerifying : tr.methods.passkeyHint}
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>
            {active === "recovery" ? tr.recoverySubtitle : tr.subtitle}
          </Text>
          <Text style={[styles.label, { color: tokens.textPrimary }]}>
            {active === "recovery" ? tr.recoveryLabel : tr.codeLabel}
          </Text>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => {
              if (active === "totp") setCode(v.replace(/\D/g, "").slice(0, 6));
              else setCode(v.toUpperCase());
              if (error) setError("");
            }}
            keyboardType={active === "totp" ? "number-pad" : "default"}
            autoCapitalize={active === "totp" ? "none" : "characters"}
            autoCorrect={false}
            textContentType="oneTimeCode"
            maxLength={active === "totp" ? 6 : 24}
            placeholder={active === "totp" ? "000000" : "XXXX-XXXX-XXXX"}
            placeholderTextColor={tokens.textMuted}
            style={[
              active === "totp" ? styles.inputCode : styles.inputText,
              { borderColor: error ? tokens.danger : tokens.border, backgroundColor: tokens.bgInput, color: tokens.textPrimary },
            ]}
            onSubmitEditing={submitCode}
            editable={!busy}
          />
          {error ? (
            <View style={[styles.errorBox, { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary }]}>
              <Text style={{ color: tokens.danger, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}
        </>
      )}
      {actions ? (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>{actions}</View>
      ) : null}
    </View>
  );
}

export default StepUpCodeForm;
