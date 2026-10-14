import { nativeText } from '../../i18n/native-text';
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import React, { useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { TextInput, View } from "react-native";
import { callServerApi, unwrap } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Config = { endpoint: string; defaultModel: string; apiKeySet: boolean; apiKeyPreview: string };
type TestResult = { ok: boolean; status: number; endpoint: string; message: string };

/** Native OpenClaw connection settings. */
export function NativeOpenClawScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const config = useServerResource<Config>(() => callServerApi(panelId, token, "GET", "/api/openclaw/config"), [panelId, token]);
  const [endpoint, setEndpoint] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  useEffect(() => { if (config.data) { setEndpoint(config.data.endpoint); setDefaultModel(config.data.defaultModel); } }, [config.data]);
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 10 } as const;
  const mutate = async (method: "PUT" | "DELETE", path: string, body?: unknown) => {
    if (pending.current) return false;
    pending.current = true;
    try {
    setBusy(true); setError(null); setNotice(null);
    const outcome = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, path, body));
    if (!outcome.ok) { setError(outcome.error ?? nativeText("No se pudo guardar la configuración.")); return false; }
    setApiKey(""); setNotice(nativeText("Configuración guardada."));
    await config.reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { pending.current = false; setBusy(false); }
  };
  const save = () => {
    if (!/^https?:\/\//i.test(endpoint.trim())) { setError(nativeText("El endpoint debe usar HTTP o HTTPS.")); return; }
    void mutate("PUT", "/api/openclaw/config", { endpoint: endpoint.trim(), defaultModel: defaultModel.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
  };
  const test = async () => {
    if (pending.current) return false;
    pending.current = true;
    try {
    setBusy(true); setError(null); setNotice(null);
    const response = await callServerApi(panelId, token, "POST", "/api/openclaw/test");
    const data = unwrap<TestResult>(response);
    if (response.ok && data?.ok) setNotice(data.message || nativeText("Conexión correcta."));
    else setError(data?.message ?? response.error ?? nativeText("Falló la conexión con OpenClaw."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { pending.current = false; setBusy(false); }
  };
  return <ServerModuleScreen title={nativeText("OpenClaw")} subtitle={nativeText("Conexión y modelo predeterminado")} onBack={onBack} error={error ?? config.error} guardCode={config.guardCode} onRetry={() => void config.reload()} onRefresh={() => void config.reload()} refreshing={config.loading}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    <View style={[cardStyle, { flexDirection: "row", alignItems: "center" }]}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: config.data?.apiKeySet ? colors.brand : colors.textMuted }} /><View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{nativeText("Conexión con OpenClaw")}</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{config.data?.apiKeySet ? nativeText("Clave configurada {p0}", {p0: String(config.data.apiKeyPreview)}) : nativeText("Sin clave API")}</Text></View><Button label={nativeText("Probar")} size="sm" variant="secondary" onPress={() => void test()} disabled={busy} /></View>
    <View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Configuración")}</Text>
      <Field label={nativeText("Endpoint")}><TextInput value={endpoint} onChangeText={setEndpoint} autoCapitalize="none" keyboardType="url" style={inputStyle} /></Field>
      <Field label={nativeText("Clave API")}><View style={{ flexDirection: "row", gap: 8 }}><TextInput value={apiKey} onChangeText={setApiKey} secureTextEntry={!showKey} autoCapitalize="none" autoCorrect={false} style={[inputStyle, { flex: 1 }]} /><Button label={showKey ? nativeText("Ocultar") : nativeText("Mostrar")} variant="secondary" onPress={() => setShowKey(value => !value)} /></View></Field>
      <Field label={nativeText("Modelo predeterminado")}><TextInput value={defaultModel} onChangeText={setDefaultModel} autoCapitalize="none" style={inputStyle} /></Field>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button label={nativeText("Guardar")} onPress={save} disabled={busy || !endpoint.trim()} />{config.data?.apiKeySet ? <Button label={nativeText("Quitar clave")} variant="danger" onPress={() => setClearConfirm(true)} disabled={busy} /> : null}</View>
    </View>
    <ConfirmDialog visible={clearConfirm} title={nativeText("Quitar clave API")} message={nativeText("OpenClaw dejará de autenticarse hasta que configures otra clave.")} confirmLabel={nativeText("Quitar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => setClearConfirm(false)} onConfirm={() => { void mutate("DELETE", "/api/openclaw/api-key").then(ok => { if (ok) setClearConfirm(false); }); }} />
  </ServerModuleScreen>;
}
