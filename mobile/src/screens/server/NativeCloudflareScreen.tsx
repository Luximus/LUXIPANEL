import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { Select } from "../../components/ui/Select";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { loadSessionState } from "../../lib/session-state";
import { WorkspaceModuleSection } from "../main/WorkspaceModuleSection";
import React, { useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { callServerApi, unwrap, type HttpMethod } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { Checkbox, ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Config = { tokenSet: boolean; tokenPreview?: string };
type Zone = { id: string; name: string; status: string; planName?: string };
type DnsType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS";
type DnsRecord = { id: string; type: DnsType; name: string; content: string; ttl: number; proxied: boolean; priority?: number; pointsToServer?: boolean };
type ConfirmAction = { title: string; message: string; method: HttpMethod; path: string; body?: unknown };
const emptyRecords = Promise.resolve({ ok: true, data: { ok: true, data: [] } });

/** Native Cloudflare token, zones and DNS record manager. */
export function NativeCloudflareScreen({ panelId, token: panelToken, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const [recordOpen, setRecordOpen] = useState(false);
  const [apiToken, setApiToken] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [purgeUrls, setPurgeUrls] = useState("");
  const [ruleIp, setRuleIp] = useState("");
  const [ruleNotes, setRuleNotes] = useState("");
  const [ruleMode, setRuleMode] = useState("block");
  const serverIp = useServerResource<{ ip: string }>(() => callServerApi(panelId, panelToken, "GET", "/api/cloudflare/server-ip"), [panelId, panelToken]);
  const settings = useServerResource<Record<string, string>>(() => zoneId ? callServerApi(panelId, panelToken, "GET", `/api/cloudflare/zones/${zoneId}/settings`) : emptyRecords, [panelId, panelToken, zoneId]);
  const rules = useServerResource<Array<{ id: string; mode: string; value: string; notes: string }>>(() => zoneId ? callServerApi(panelId, panelToken, "GET", `/api/cloudflare/zones/${zoneId}/access-rules`) : emptyRecords, [panelId, panelToken, zoneId]);
  const [recordType, setRecordType] = useState<DnsType>("A");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [proxied, setProxied] = useState(false);
  const [priority, setPriority] = useState("10");
  const [ttl, setTtl] = useState("1");
  const [editing, setEditing] = useState<string | null>(null);
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const config = useServerResource<Config>(() => callServerApi(panelId, panelToken, "GET", "/api/cloudflare/config"), [panelId, panelToken]);
  const zones = useServerResource<Zone[]>(() => callServerApi(panelId, panelToken, "GET", "/api/cloudflare/zones"), [panelId, panelToken]);
  const records = useServerResource<DnsRecord[] | { records?: DnsRecord[] }>(() => zoneId ? callServerApi(panelId, panelToken, "GET", `/api/cloudflare/zones/${encodeURIComponent(zoneId)}/dns`) : emptyRecords, [panelId, panelToken, zoneId]);
  const zoneList = Array.isArray(zones.data) ? zones.data : [];
  const recordList = Array.isArray(records.data) ? records.data : Array.isArray(records.data?.records) ? records.data.records : [];
  useEffect(() => { if (zoneId && !zoneList.some((zone) => zone.id === zoneId)) setZoneId(""); }, [zoneId, zones.data]);
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 10 } as const;
  const reload = async () => { await Promise.all([config.reload(), zones.reload(), records.reload(), settings.reload(), rules.reload(), serverIp.reload()]); };
  const mutate = async (method: HttpMethod, path: string, body?: unknown) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try { setError(null); setNotice(null);
    const outcome = await runServerMutation(panelId, panelToken, () => callServerApi(panelId, panelToken, method, path, body));
    if (!outcome.ok) { setError(outcome.error ?? nativeText("No se pudo completar la operación.")); return false; }
    setNotice(nativeText("Cambio aplicado en Cloudflare."));
    await reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const saveRecord = async () => {
    const zone = zoneId;
    if (!zone || !name.trim() || !content.trim()) { setError(nativeText("Completa zona, nombre y contenido.")); return; }
    const parsedPriority = Number(priority);
    const parsedTtl = Number(ttl);
    if (recordType === "MX" && (!Number.isInteger(parsedPriority) || parsedPriority < 0 || parsedPriority > 65535)) { setError(nativeText("La prioridad MX debe estar entre 0 y 65535.")); return; }
    if (!Number.isInteger(parsedTtl) || (parsedTtl !== 1 && (parsedTtl < 60 || parsedTtl > 86400))) { setError(nativeText("TTL debe ser 1 o estar entre 60 y 86400 segundos.")); return; }
    const body = { type: recordType, name: name.trim(), content: content.trim(), ttl: parsedTtl, ...(["A", "AAAA", "CNAME"].includes(recordType) ? { proxied } : {}), ...(recordType === "MX" ? { priority: parsedPriority } : {}) };
    const path = `/api/cloudflare/zones/${encodeURIComponent(zone)}/dns${editing ? `/${encodeURIComponent(editing)}` : ""}`;
    if (await mutate(editing ? "PATCH" : "POST", path, body)) { setName(""); setContent(""); setEditing(null); setRecordOpen(false); }
  };
  const testToken = async () => {
    setBusy(true); setError(null); setNotice(null);
    const response = await callServerApi(panelId, panelToken, "POST", "/api/cloudflare/test");
    setBusy(false);
    if (!response.ok) { setError(response.error ?? nativeText("No se pudo probar el token.")); return; }
    const result = unwrap<{ valid?: boolean; message?: string }>(response);
    if (result?.valid) setNotice(result.message ?? nativeText("Conexión correcta."));
    else setError(result?.message ?? nativeText("El token no es válido."));
  };
  return <ServerModuleScreen title={nativeText("Cloudflare")} action={zoneId ? {get label() { return nativeText("Añadir DNS"); },onPress:()=>{setEditing(null);setRecordOpen(true);}} : null} subtitle={nativeText("Zonas y DNS")} onBack={onBack} error={error ?? config.error ?? (config.data?.tokenSet ? zones.error : null) ?? records.error} guardCode={config.guardCode ?? zones.guardCode ?? records.guardCode} onRetry={() => void reload()} onRefresh={() => void reload()} refreshing={config.loading || zones.loading || records.loading}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    {config.loading && !config.data ? <ActivityIndicator color={colors.brand} /> : null}
    <WorkspaceModuleSection views={["config"]}><View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("API token")}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{config.data?.tokenSet ? nativeText("Configurado {p0}", {p0: String(config.data.tokenPreview ?? "")}) : nativeText("Sin configurar")}</Text>
      <Field label={nativeText("Nuevo token")}><TextInput value={apiToken} onChangeText={setApiToken} secureTextEntry autoCapitalize="none" autoCorrect={false} style={inputStyle} /></Field>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}><Button label={nativeText("Guardar token")} onPress={() => { void mutate("PUT", "/api/cloudflare/config", { apiToken: apiToken.trim() }).then((ok) => { if (ok) setApiToken(""); }); }} disabled={busy || apiToken.trim().length < 20} />{config.data?.tokenSet ? <><Button label={nativeText("Probar")} variant="ghost" onPress={() => void testToken()} disabled={busy} /><Button label={nativeText("Quitar")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Quitar token"); }, get message() { return nativeText("Se desconectará Cloudflare de este panel."); }, method: "DELETE", path: "/api/cloudflare/config" })} disabled={busy} /></> : null}</View>
    </View></WorkspaceModuleSection>
    <Field label={nativeText("Zona")}><Select value={zoneId} onChange={value=>{setZoneId(value);setEditing(null);}} placeholder={nativeText("Seleccionar zona")} options={zoneList.map(zone=>({value:zone.id,label:`${zone.name} · ${zone.status}`}))}/></Field>
    {!zoneList.length && !zones.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("No hay zonas disponibles.")}</Text> : null}
    <Text style={{ color: colors.textMuted }}>{nativeText("IP del servidor:")}{" "}{serverIp.data?.ip ?? "…"}</Text>
    {zoneId ? <>
      <WorkspaceModuleSection views={["security"]}><View style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{nativeText("Seguridad y HTTPS")}</Text>
        {([
          { id: "ssl", key: "ssl", get title() { return nativeText("Modo SSL"); }, options: [["off", "Apagado"], ["flexible", "Flexible"], ["full", "Completo"], ["strict", "Estricto"]] },
          { id: "always_use_https", key: "alwaysUseHttps", get title() { return nativeText("Usar siempre HTTPS"); }, options: [["on", nativeText("Sí")], ["off", nativeText("No")]] },
          { id: "security_level", key: "securityLevel", get title() { return nativeText("Nivel de seguridad"); }, options: [["essentially_off", nativeText("Mínimo")], ["low", nativeText("Bajo")], ["medium", nativeText("Medio")], ["high", nativeText("Alto")], ["under_attack", nativeText("Bajo ataque")]] },
          { id: "development_mode", key: "developmentMode", get title() { return nativeText("Modo desarrollo"); }, options: [["on", nativeText("Sí")], ["off", nativeText("No")]] },
        ]).map(setting => <Field key={setting.id} label={setting.title}><SegmentedControl scroll items={setting.options.map(([key, label]) => ({ key, label }))} value={settings.data?.[setting.key] ?? ""} onChange={value => { if (!busy) setConfirm({ title: setting.title, message: nativeText("Aplicar {p0} a esta zona.", {p0: String(setting.options.find(item => item[0] === value)?.[1])}), method: "PATCH", path: `/api/cloudflare/zones/${zoneId}/settings`, body: { setting: setting.id, value } }); }} /></Field>)}
        {settings.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{localizeServerError(settings.error)}</Text> : null}
      </View></WorkspaceModuleSection>
      <WorkspaceModuleSection views={["cache"]}><View style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{nativeText("Purgar archivos concretos")}</Text><Field label={nativeText("URLs (una por línea, máximo 30)")}><TextInput multiline value={purgeUrls} onChangeText={setPurgeUrls} autoCapitalize="none" style={inputStyle} /></Field><Button label={nativeText("Purgar archivos")} disabled={busy || !purgeUrls.trim()} onPress={() => { const files = purgeUrls.split(/\r?\n/).map(line => line.trim()).filter(Boolean); if (files.length > 30 || files.some(url => !/^https?:\/\//.test(url))) { setError(nativeText("Indica hasta 30 URLs completas.")); return; } setConfirm({ get title() { return nativeText("Purgar archivos"); }, message: nativeText("Se purgarán {p0} archivos de esta zona.", {p0: String(files.length)}), method: "POST", path: `/api/cloudflare/zones/${zoneId}/purge`, body: { files } }); }} /></View></WorkspaceModuleSection>
      <WorkspaceModuleSection views={["access"]}><View style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{nativeText("Reglas de acceso IP")}</Text>
        {rules.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{localizeServerError(rules.error)}</Text> : null}
        <ServerDataTable settingsId="access" title={nativeText("Reglas de acceso")} rows={rules.data ?? []} rowKey={rule=>rule.id} columns={[{id:"value",get header() { return nativeText("IP / rango"); },cell:r=>r.value,width:180},{id:"mode",get header() { return nativeText("Acción"); },cell:r=>r.mode,width:120},{id:"notes",get header() { return nativeText("Notas"); },cell:r=>r.notes,width:180}]} rowActions={[{id:"delete",get label() { return nativeText("Eliminar"); },danger:true}]} onRowAction={(_,rule)=>setConfirm({get title() { return nativeText("Eliminar regla IP"); },message:nativeText("Se eliminará la regla para {p0}.", {p0: String(rule.value)}),method:"DELETE",path:`/api/cloudflare/zones/${zoneId}/access-rules/${rule.id}`})}/>

        <Field label={nativeText("IP o rango CIDR")}><TextInput value={ruleIp} onChangeText={setRuleIp} autoCapitalize="none" style={inputStyle} /></Field>
        <SegmentedControl items={[{ key: "block", get label() { return nativeText("Bloquear"); } }, { key: "whitelist", get label() { return nativeText("Permitir"); } }, { key: "challenge", get label() { return nativeText("Verificar"); } }]} value={ruleMode} onChange={setRuleMode} />
        <Field label={nativeText("Notas")}><TextInput value={ruleNotes} onChangeText={setRuleNotes} style={inputStyle} /></Field>
        <Button label={nativeText("Crear regla")} disabled={busy || !ruleIp.trim()} onPress={() => setConfirm({ get title() { return nativeText("Crear regla IP"); }, message: nativeText("Se aplicará {p0} a {p1}.", {p0: String(ruleMode), p1: String(ruleIp)}), method: "POST", path: `/api/cloudflare/zones/${zoneId}/access-rules`, body: { mode: ruleMode, ip: ruleIp.trim(), notes: ruleNotes } })} />
      </View></WorkspaceModuleSection>
      <WorkspaceModuleSection views={["cache"]}><Button label={nativeText("Purgar caché de la zona")} variant="ghost" onPress={() => setConfirm({ get title() { return nativeText("Purgar caché"); }, get message() { return nativeText("Se purgará toda la caché de esta zona de Cloudflare."); }, method: "POST", path: `/api/cloudflare/zones/${encodeURIComponent(zoneId)}/purge`, body: { everything: true } })} disabled={busy} /></WorkspaceModuleSection>
      <WorkspaceModuleSection views={["dns"]}><Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Registros DNS")}</Text>
      {records.loading && !records.data ? <ActivityIndicator color={colors.brand} /> : null}
      <ServerDataTable settingsId="dns" title={nativeText("Registros DNS")} rows={recordList} rowKey={record=>record.id} columns={[
        {id:"type",get header() { return nativeText("Tipo"); },cell:r=>r.type,width:90},{id:"name",get header() { return nativeText("Nombre"); },cell:r=>r.name,width:200},{id:"content",get header() { return nativeText("Contenido"); },cell:r=>r.content,width:240},{id:"proxy",get header() { return nativeText("Proxy"); },cell:r=>r.proxied?nativeText("Activo"):nativeText("Solo DNS"),width:120},{id:"ttl",header:"TTL",cell:r=>r.ttl===1?nativeText("Automático"):String(r.ttl),width:100}
      ]} rowActions={[{id:"edit",get label() { return nativeText("Editar"); }},{id:"delete",get label() { return nativeText("Eliminar"); },danger:true}]} onRowAction={(id,record)=>{if(id==='edit'){setEditing(record.id);setRecordType(record.type);setName(record.name);setContent(record.content);setProxied(record.proxied);setPriority(String(record.priority??10));setTtl(String(record.ttl??1));setRecordOpen(true);}else setConfirm({get title() { return nativeText("Eliminar DNS"); },message:nativeText("Se eliminará {p0} {p1}.", {p0: String(record.type), p1: String(record.name)}),method:"DELETE",path:`/api/cloudflare/zones/${encodeURIComponent(zoneId)}/dns/${encodeURIComponent(record.id)}`});}}/>
      {!recordList.length && !records.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("No hay registros DNS en esta zona.")}</Text> : null}</WorkspaceModuleSection>
    </> : null}
    <FormDrawer visible={recordOpen} onClose={()=>setRecordOpen(false)} title={editing?nativeText("Editar DNS"):nativeText("Añadir DNS")} language={language}>{error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text>:null}      <View style={cardStyle}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{editing ? nativeText("Editar DNS") : nativeText("Nuevo DNS")}</Text>
        <SegmentedControl items={(["A", "AAAA", "CNAME", "TXT", "MX", "NS"] as const).map((key) => ({ key, label: key }))} value={recordType} onChange={(value) => setRecordType(value as DnsType)} scroll />
        <Field label={nativeText("Nombre")}><TextInput value={name} onChangeText={setName} autoCapitalize="none" style={inputStyle} /></Field>
        <Field label={nativeText("Contenido")}><TextInput value={content} onChangeText={setContent} autoCapitalize="none" style={inputStyle} /></Field>
        <Field label={nativeText("TTL (1 = automático)")}><TextInput value={ttl} onChangeText={setTtl} keyboardType="number-pad" style={inputStyle} /></Field>
        {["A", "AAAA", "CNAME"].includes(recordType) ? <Checkbox value={proxied} onChange={setProxied} label={nativeText("Proxy de Cloudflare")} /> : null}
        {recordType === "MX" ? <Field label={nativeText("Prioridad MX")}><TextInput value={priority} onChangeText={setPriority} keyboardType="number-pad" style={inputStyle} /></Field> : null}
        <View style={{ flexDirection: "row", gap: 8 }}><Button label={editing ? nativeText("Actualizar") : nativeText("Agregar DNS")} onPress={() => void saveRecord()} disabled={busy || !name.trim() || !content.trim()} />{editing ? <Button label={nativeText("Cancelar")} variant="ghost" onPress={() => { setEditing(null); setName(""); setContent(""); }} /> : null}</View>
      </View>
</FormDrawer>
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const pending = confirm; void mutate(pending.method, pending.path, pending.body).then((ok) => { if (ok) setConfirm(null); if (ok && pending.path === "/api/cloudflare/config") setZoneId(""); }); }} />
  </ServerModuleScreen>;
}
