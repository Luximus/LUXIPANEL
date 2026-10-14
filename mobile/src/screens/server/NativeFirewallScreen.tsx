import { nativeOptionLabel } from '../../i18n/native-options';
import { localizeServerError } from '../../lib/server-error-localization';
import { nativeText } from '../../i18n/native-text';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { RelatedModuleSettings } from "../../components/server/RelatedModuleSettings";
import { Select } from "../../components/ui/Select";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { loadSessionState } from "../../lib/session-state";
import { WorkspaceModuleSection } from "../main/WorkspaceModuleSection";
import React, { useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, TextInput, View } from "react-native";
import { callServerApi, type HttpMethod } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { firewallRuleDeletePath, type FirewallRule } from "./native-firewall-logic";

type Jail = { name?: string; jail?: string; banned?: string[]; bannedIps?: string[]; currentlyBanned?: number };
type Overview = { ufw?: { active?: boolean; installed?: boolean; logging?: string }; fail2ban?: { installed?: boolean; jails?: Jail[] } };
type ConfirmAction = { title: string; message: string; method: HttpMethod; path: string; body?: unknown };

/** Native UFW and Fail2ban controls backed by the panel's direct REST API. */
export function NativeFirewallScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const overview = useServerResource<Overview>(() => callServerApi(panelId, token, "GET", "/api/firewall/status"), [panelId, token]);
  const rulesState = useServerResource<FirewallRule[]>(() => callServerApi(panelId, token, "GET", "/api/firewall/rules"), [panelId, token]);
  const language = loadSessionState().language;
  const [createOpen, setCreateOpen] = useState(false);
  const [ruleFilter, setRuleFilter] = useState("all");
  const [logLevel, setLogLevel] = useState("low");
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [action, setAction] = useState<"allow" | "deny" | "limit" | "reject">("allow");
  const [proto, setProto] = useState<"any" | "tcp" | "udp">("any");
  const [port, setPort] = useState("");
  const [from, setFrom] = useState("any");
  const [comment, setComment] = useState("");
  const [jail, setJail] = useState("");
  const [ip, setIp] = useState("");
  const [sudoPassword, setSudoPassword] = useState("");
  const rules = Array.isArray(rulesState.data) ? rulesState.data : [];

  const reload = async () => { await Promise.all([overview.reload(), rulesState.reload()]); };
  const mutate = async (method: HttpMethod, path: string, body?: unknown) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try {
    setMutationError(null);
    setMessage(null);
    const result = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, path, body));
    if (!result.ok) { setMutationError(result.error ?? nativeText("No se pudo completar la operación.")); return false; }
    setSudoPassword("");
    setMessage(nativeText("Cambio aplicado en el servidor."));
    if (path === "/api/firewall/rules" && method === "POST") setCreateOpen(false);
    await reload();
    return true;
    } catch (cause) { setMutationError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const addRule = () => {
    const value = port.trim();
    if (!/^[\w./:+-]{1,64}$/.test(value)) { setMutationError(nativeText("Introduce un puerto o servicio válido.")); return; }
    void mutate("POST", "/api/firewall/rules", { action, proto, port: value, from: from.trim() || "any", ...(comment.trim() ? { comment: comment.trim() } : {}) });
  };
  const ban = (kind: "ban" | "unban") => {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(jail.trim()) || !/^[0-9a-fA-F:.]+(\/\d{1,3})?$/.test(ip.trim())) {
      setMutationError(nativeText("Introduce una jail y una IP válidas."));
      return;
    }
    void mutate("POST", `/api/firewall/fail2ban/${kind}`, { jail: jail.trim(), ip: ip.trim() });
  };
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const sectionStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 15, gap: 10 } as const;
  return <ServerModuleScreen
    title={nativeText("Firewall")}
    action={{get label() { return nativeText("Añadir regla"); },onPress:()=>setCreateOpen(true)}}
    settingsPages={[
      {key:"related",get label() { return nativeText("Relacionados"); },content:<RelatedModuleSettings modules={["bitninja","cloudflare"]}/>},
      {key:"rules",get label() { return nativeText("Reglas"); },content:<Field label={nativeText("Filtrar por acción")}><Select value={ruleFilter} onChange={setRuleFilter} options={[{value:"all",get label() { return nativeText("Todas"); }},...['ALLOW','DENY','REJECT','LIMIT'].map(value=>({value,label:nativeOptionLabel(value)}))]}/></Field>},
      {key:"logging",get label() { return nativeText("Registro"); },content:<View style={{gap:12}}><Field label={nativeText("Nivel de registro")}><Select value={logLevel} onChange={setLogLevel} options={['off','low','medium','high','full'].map(value=>({value,label:nativeOptionLabel(value)}))}/></Field><Button label={nativeText("Guardar")} loading={busy} onPress={()=>void mutate("PUT","/api/firewall/logging",{level:logLevel})}/>{mutationError?<Text style={{color:colors.danger}}>{localizeServerError(mutationError)}</Text>:null}{message?<Text style={{color:colors.brand}}>{message}</Text>:null}</View>},
    ]}
    subtitle="UFW · Fail2ban"
    onBack={onBack}
    error={mutationError ?? overview.error ?? rulesState.error}
    guardCode={overview.guardCode ?? rulesState.guardCode}
    onRetry={() => void reload()}
    onRefresh={() => void reload()}
    refreshing={overview.loading || rulesState.loading}
  >
    {message ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{message}</Text> : null}
    {(overview.loading || rulesState.loading) && !overview.data && !rulesState.data ? <ActivityIndicator color={colors.brand} /> : null}
    <WorkspaceModuleSection views={["rules"]}><View style={sectionStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>UFW</Text>
      <Text style={{ color: colors.textSecondary }}>{!overview.data?.ufw?.installed ? nativeText("No instalado") : overview.data.ufw.active ? nativeText("Activo") : nativeText("Detenido")} {nativeText("· Registro:")}{" "}{overview.data?.ufw?.logging ?? "—"}</Text>
      {overview.data?.ufw?.installed ? <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button label={nativeText("Activar seguro")} onPress={() => void mutate("POST", "/api/firewall/enable")} disabled={busy || !!overview.data.ufw?.active} />
        <Button label={nativeText("Desactivar")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Desactivar firewall"); }, get message() { return nativeText("El servidor quedará sin protección UFW. ¿Continuar?"); }, method: "POST", path: "/api/firewall/disable" })} disabled={busy || !overview.data.ufw?.active} />
      </View> : <View style={{ gap: 8 }}>
        <Field label={nativeText("Contraseña sudo (si se requiere)")}><TextInput value={sudoPassword} onChangeText={setSudoPassword} secureTextEntry autoCapitalize="none" style={inputStyle} /></Field>
        <Button label={nativeText("Instalar UFW")} onPress={() => void mutate("POST", "/api/firewall/install", { ufw: true, fail2ban: false, ...(sudoPassword ? { sudoPassword } : {}) })} disabled={busy} />
      </View>}
    </View></WorkspaceModuleSection>
    <WorkspaceModuleSection views={["rules"]}><View style={sectionStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Reglas UFW")}</Text>
      <ServerDataTable title={nativeText("Reglas UFW")} rows={rules.filter(rule=>ruleFilter === "all" || rule.action?.toUpperCase().includes(ruleFilter))} rowKey={rule=>String(rule.number)} columns={[
        {id:"number",get header() { return nativeText("Nº"); },cell:rule=>String(rule.number),width:60},{id:"to",get header() { return nativeText("Destino"); },cell:rule=>rule.to??"—",width:160},{id:"action",get header() { return nativeText("Acción"); },cell:rule=>rule.action??"—",width:110},{id:"from",get header() { return nativeText("Origen"); },cell:rule=>rule.from??"any",width:160},{id:"comment",get header() { return nativeText("Comentario"); },cell:rule=>rule.comment??"—",width:200}
      ]} rowActions={[{id:"delete",get label() { return nativeText("Eliminar"); },danger:true}]} onRowAction={(_,rule)=>{if(Number.isInteger(rule.number)&&rule.to&&rule.action)setConfirm({get title() { return nativeText("Eliminar regla"); },message:nativeText("Se eliminará la regla #{p0}. El servidor verificará su contenido antes de borrarla.", {p0: String(rule.number)}),method:"DELETE",path:firewallRuleDeletePath(rule)});}}/>
    </View></WorkspaceModuleSection>
    <WorkspaceModuleSection views={["fail2ban"]}><View style={sectionStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>Fail2ban</Text>
      <Text style={{ color: colors.textSecondary }}>{overview.data?.fail2ban?.installed ? `${overview.data.fail2ban.jails?.length ?? 0} jails` : nativeText("No instalado")}</Text>
      {!overview.data?.fail2ban?.installed ? <><Field label={nativeText("Contraseña sudo (si se requiere)")}><TextInput value={sudoPassword} onChangeText={setSudoPassword} secureTextEntry autoCapitalize="none" style={inputStyle} /></Field><Button label={nativeText("Instalar Fail2ban")} onPress={() => void mutate("POST", "/api/firewall/install", { ufw: false, fail2ban: true, ...(sudoPassword ? { sudoPassword } : {}) })} disabled={busy} /></> : <>
        {(overview.data.fail2ban.jails ?? []).map((item, index) => <Text key={`${item.name ?? item.jail}:${index}`} style={{ color: colors.textSecondary }}>{item.name ?? item.jail ?? `Jail ${index + 1}`} · {item.currentlyBanned ?? item.banned?.length ?? item.bannedIps?.length ?? 0} {nativeText("bloqueos")}</Text>)}
        <Field label={nativeText("Jail")}><TextInput value={jail} onChangeText={setJail} autoCapitalize="none" style={inputStyle} /></Field>
        <Field label={nativeText("IP")}><TextInput value={ip} onChangeText={setIp} autoCapitalize="none" style={inputStyle} /></Field>
        <View style={{ flexDirection: "row", gap: 8 }}><Button label={nativeText("Bloquear")} onPress={() => ban("ban")} disabled={busy || !jail || !ip} /><Button label={nativeText("Desbloquear")} variant="ghost" onPress={() => ban("unban")} disabled={busy || !jail || !ip} /></View>
      </>}
    </View></WorkspaceModuleSection>
    <FormDrawer visible={createOpen} onClose={()=>setCreateOpen(false)} title={nativeText("Añadir regla UFW")} language={language}><View style={{gap:12}}>{mutationError?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(mutationError)}</Text>:null}      <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{nativeText("Añadir regla")}</Text>
      <SegmentedControl items={(["allow", "deny", "limit", "reject"] as const).map((key) => ({ key, label: nativeOptionLabel(key) }))} value={action} onChange={(key) => setAction(key as typeof action)} scroll />
      <Field label={nativeText("Puerto o servicio")}><TextInput value={port} onChangeText={setPort} placeholder="443" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={inputStyle} /></Field>
      <SegmentedControl items={(["any", "tcp", "udp"] as const).map((key) => ({ key, label: nativeOptionLabel(key) }))} value={proto} onChange={(key) => setProto(key as typeof proto)} />
      <Field label={nativeText("Origen")}><TextInput value={from} onChangeText={setFrom} placeholder={"any"} placeholderTextColor={colors.textMuted} autoCapitalize="none" style={inputStyle} /></Field>
      <Field label={nativeText("Comentario")}><TextInput value={comment} onChangeText={setComment} placeholder={nativeText("Opcional")} placeholderTextColor={colors.textMuted} style={inputStyle} /></Field>
      <Button label={nativeText("Añadir regla")} onPress={addRule} disabled={busy || !port.trim() || !overview.data?.ufw?.installed} />
</View></FormDrawer>
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={mutationError ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const actionToRun = confirm; void mutate(actionToRun.method, actionToRun.path, actionToRun.body).then(ok => { if (ok) setConfirm(null); }); }} />
  </ServerModuleScreen>;
}
