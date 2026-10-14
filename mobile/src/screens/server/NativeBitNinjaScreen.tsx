import { nativeText } from '../../i18n/native-text';
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import React, { useContext, useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, TextInput, View } from "react-native";
import { callServerApi, type HttpMethod } from "../../api/serverApi";
import { Activity, PanelsTopLeft } from "lucide-react-native";
import { NativeModuleContext } from "../main/native-module-context";
import { ModuleGrid } from "../../components/server/ModuleLayouts";
import { Select } from "../../components/ui/Select";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { Checkbox, ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Status = { installed: boolean; running: boolean; licenseValid: boolean; version: string | null; components: { name: string; active: boolean }[]; raw: string };
type Config = { tokenSet: boolean; tokenPreview: string };
type Logs = { output: string };
type ConfirmAction = { title: string; message: string; method: HttpMethod; path: string; body?: unknown };

/** Native BitNinja service, license, component and log controls. */
export function NativeBitNinjaScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const context = useContext(NativeModuleContext);
  const [logLines, setLogLines] = useState("50");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const status = useServerResource<Status>(() => callServerApi(panelId, token, "GET", "/api/bitninja/status"), [panelId, token]);
  const config = useServerResource<Config>(() => callServerApi(panelId, token, "GET", "/api/bitninja/config"), [panelId, token]);
  const logs = useServerResource<Logs>(() => callServerApi(panelId, token, "GET", `/api/bitninja/logs?lines=${logLines}`), [panelId, token, logLines]);
  const [licenseKey, setLicenseKey] = useState("");
  const [sudoPassword, setSudoPassword] = useState("");
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 9 } as const;
  const reload = async () => { await Promise.all([status.reload(), config.reload(), logs.reload()]); };
  const mutate = async (method: HttpMethod, path: string, body?: unknown) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try { setError(null); setNotice(null);
    const outcome = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, path, body));
    if (!outcome.ok) {
      setError(outcome.code === "SUDO_PASSWORD_REQUIRED" ? nativeText("Introduce la contraseña sudo y vuelve a intentarlo.") : outcome.code === "SUDO_PASSWORD_INVALID" ? nativeText("La contraseña sudo es incorrecta.") : outcome.error ?? nativeText("No se pudo completar la operación."));
      return false;
    }
    setNotice(nativeText("Cambio aplicado en BitNinja."));
    setLicenseKey(""); setSudoPassword("");
    await reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!autoRefresh || context?.visible === false) return;
    const interval = setInterval(() => { void status.reload(); }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, context?.visible, status.reload]);
  const settingsPages = [
    { key: "diagnostics", get label() { return nativeText("Diagnóstico"); }, icon: <Activity size={20} color={colors.textMuted} />, content: <View style={{ gap: 16 }}><Text style={{ color: colors.textSecondary }}>{nativeText("Estado y registros del agente instalado en el servidor.")}</Text><Checkbox label={nativeText("Actualizar automáticamente")} value={autoRefresh} onChange={setAutoRefresh} /><Field label={nativeText("Líneas del registro")}><Select value={logLines} onChange={setLogLines} options={[20, 50, 100, 200].map(value => ({ value: String(value), label: String(value) }))} /></Field></View> },
    ...(context?.openModule ? [{ key: "related", get label() { return nativeText("Módulos relacionados"); }, icon: <PanelsTopLeft size={20} color={colors.textMuted} />, content: <View style={{ gap: 12 }}><Button label={nativeText("Firewall y auditoría")} variant="secondary" onPress={() => context.openModule?.("firewall", "audit")} /><Button label={nativeText("Credenciales")} variant="secondary" onPress={() => context.openModule?.("settings", "credentials")} /></View> }] : []),
  ];
  const licenseBody = { ...(licenseKey.trim() ? { licenseKey: licenseKey.trim() } : {}), ...(sudoPassword ? { sudoPassword } : {}) };
  return <ServerModuleScreen settingsPages={settingsPages} title={nativeText("BitNinja")} subtitle={nativeText("Agente de seguridad del servidor")} onBack={onBack} error={error ?? status.error ?? config.error ?? logs.error} guardCode={status.guardCode ?? config.guardCode ?? logs.guardCode} onRetry={() => void reload()} onRefresh={() => void reload()} refreshing={status.loading || config.loading || logs.loading}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    {status.loading && !status.data ? <ActivityIndicator color={colors.brand} /> : null}
    <View style={cardStyle}><Field label={nativeText("Contraseña sudo (si se requiere)")}><TextInput value={sudoPassword} onChangeText={setSudoPassword} secureTextEntry autoCapitalize="none" style={inputStyle} /></Field></View>
    {status.data?.installed ? <ModuleGrid>{[
      ["Servicio", status.data.running ? nativeText("En ejecución") : nativeText("Detenido")], ["Licencia", status.data.licenseValid ? nativeText("Válida") : nativeText("Sin verificar")], ["Versión", status.data.version ?? "—"],
    ].map(([label, value]) => <View key={label} style={cardStyle}><Text style={{ color: colors.textMuted }}>{nativeText(label)}</Text><Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 18 }}>{value}</Text></View>)}</ModuleGrid> : null}
    <View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Control del servicio")}</Text>
      <Text style={{ color: colors.textSecondary }}>{status.data?.installed ? status.data.running ? nativeText("En ejecución") : nativeText("Detenido") : nativeText("No instalado")} · {status.data?.version ?? "—"}</Text>
      <Text style={{ color: status.data?.licenseValid ? colors.brand : colors.warning, fontSize: 12 }}>{nativeText("Licencia")}{" "}{status.data?.licenseValid ? nativeText("válida") : nativeText("sin verificar")}</Text>
      {status.data?.installed ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button label={nativeText("Iniciar")} onPress={() => void mutate("POST", "/api/bitninja/service", { action: "start", ...(sudoPassword ? { sudoPassword } : {}) })} disabled={busy || !!status.data.running} /><Button label={nativeText("Detener")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Detener BitNinja"); }, get message() { return nativeText("El agente dejará de proteger el servidor."); }, method: "POST", path: "/api/bitninja/service", body: { action: "stop", ...(sudoPassword ? { sudoPassword } : {}) } })} disabled={busy || !status.data.running} /><Button label={nativeText("Reiniciar")} variant="ghost" onPress={() => void mutate("POST", "/api/bitninja/service", { action: "restart", ...(sudoPassword ? { sudoPassword } : {}) })} disabled={busy} /></View> : null}
    </View>
    {status.data?.installed ? <View style={cardStyle}><Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Componentes")}</Text>{(status.data.components ?? []).map((item) => <View key={item.name} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, gap: 5 }}><Text style={{ color: colors.textPrimary }}>{item.name} · {item.active ? nativeText("Activo") : nativeText("Detenido")}</Text><Button label={item.active ? nativeText("Desactivar") : nativeText("Activar")} variant={item.active ? "ghost" : "primary"} onPress={() => item.active ? setConfirm({ get title() { return nativeText("Desactivar componente"); }, message: nativeText("Se desactivará {p0}.", {p0: String(item.name)}), method: "POST", path: "/api/bitninja/components", body: { component: item.name, enabled: false, ...(sudoPassword ? { sudoPassword } : {}) } }) : void mutate("POST", "/api/bitninja/components", { component: item.name, enabled: true, ...(sudoPassword ? { sudoPassword } : {}) })} disabled={busy} /></View>)}{!status.data.components?.length ? <Text style={{ color: colors.textMuted }}>{nativeText("No se detectaron componentes.")}</Text> : null}</View> : null}
    <View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Licencia")}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{config.data?.tokenSet ? nativeText("Configurada {p0}", {p0: String(config.data.tokenPreview)}) : nativeText("Sin configurar")}</Text>
      <Field label={nativeText("Clave de licencia")}><TextInput value={licenseKey} onChangeText={setLicenseKey} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} style={inputStyle} /></Field>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button label={nativeText("Guardar clave")} onPress={() => void mutate("PUT", "/api/bitninja/config", { licenseKey: licenseKey.trim() })} disabled={busy || !/^[A-Za-z0-9_-]+$/.test(licenseKey.trim())} />{config.data?.tokenSet ? <Button label={nativeText("Quitar clave")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Quitar licencia"); }, get message() { return nativeText("Se borrará la clave guardada en el panel."); }, method: "DELETE", path: "/api/bitninja/config" })} disabled={busy} /> : null}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button label={status.data?.installed ? nativeText("Actualizar licencia") : nativeText("Instalar BitNinja")} onPress={() => void mutate("POST", status.data?.installed ? "/api/bitninja/license" : "/api/bitninja/packages", licenseBody)} disabled={busy || (!licenseKey.trim() && !config.data?.tokenSet)} /></View>
    </View>

    <View style={cardStyle}><Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Registro reciente")}</Text><Text selectable style={{ color: colors.textSecondary, fontFamily: "monospace", fontSize: 11, lineHeight: 17 }}>{logs.data?.output ?? nativeText("Sin registros.")}</Text></View>
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const pending = confirm; void mutate(pending.method, pending.path, pending.body).then(ok => { if (ok) setConfirm(null); }); }} />
  </ServerModuleScreen>;
}
