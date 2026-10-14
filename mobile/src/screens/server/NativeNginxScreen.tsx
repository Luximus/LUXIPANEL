import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { NativeOperationCard } from "./NativeOperationCard";
import { NativeModuleContext } from "../main/native-module-visibility";
import { chatController } from "../../features/assistant/chat-controller";
import { chatStore } from "../../features/assistant/chat-store";
import { Select } from "../../components/ui/Select";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { loadSessionState } from "../../lib/session-state";
import { WorkspaceModuleSection } from "../main/WorkspaceModuleSection";
import { NativeNginxTools } from "./NativeNginxTools";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import React, { useContext, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { callServerApi, unwrap, type HttpMethod } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Site = { name: string; domains?: string[]; enabled?: boolean; root?: string | null; kind?: string };
type RawSite = { content: string; revision: string };
type Status = { installed: boolean; running: boolean; version: string | null; enabledSites: number; availableSites: number; configTest: { ok: boolean; output: string } };
type ConfirmAction = { title: string; message: string; method: HttpMethod; path: string; body?: unknown; clearSelection?: boolean };
const emptyRaw = Promise.resolve({ ok: true, data: { ok: true, data: null } });

/** Native Nginx site manager with revision-safe raw configuration editing. */
export function NativeNginxScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const moduleContext=useContext(NativeModuleContext);
  const [aiSubmit,setAiSubmit]=useState("auto");
  const [aiLines,setAiLines]=useState("200");
  const [aiBusy,setAiBusy]=useState(false);
  const [renewalOpen,setRenewalOpen]=useState(false);
  const [sslSite,setSslSite]=useState("");
  const [sslEmail,setSslEmail]=useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState("");
  const [domain, setDomain] = useState("");
  const [kind, setKind] = useState("static");
  const [phpSocket, setPhpSocket] = useState("");
  const [proxyPass, setProxyPass] = useState("");
  const [root, setRoot] = useState("");
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const status = useServerResource<Status>(() => callServerApi(panelId, token, "GET", "/api/nginx/status"), [panelId, token]);
  const sites = useServerResource<Site[]>(() => callServerApi(panelId, token, "GET", "/api/nginx/sites"), [panelId, token]);
  const raw = useServerResource<RawSite>(() => selected ? callServerApi(panelId, token, "GET", `/api/nginx/sites/${encodeURIComponent(selected)}/raw`) : emptyRaw, [panelId, token, selected]);
  const siteList = Array.isArray(sites.data) ? sites.data : [];
  const currentSite = siteList.find((item) => item.name === selected);
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 10 } as const;
  const reload = async () => { await Promise.all([status.reload(), sites.reload(), raw.reload()]); };
  const mutate = async (method: HttpMethod, path: string, body?: unknown) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try { setError(null); setNotice(null);
    const outcome = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, path, body));
    if (!outcome.ok) { setError(outcome.error ?? nativeText("No se pudo completar la operación.")); return false; }
    setNotice(nativeText("Cambio aplicado en Nginx."));
    await reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const create = async () => {
    const value = domain.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9.-]{1,252}[a-z0-9]$/.test(value)) { setError(nativeText("Introduce un dominio válido.")); return; }
    const form = { kind, phpSocket, proxyPass, domain: value, aliases: [], ...(root.trim() ? { root: root.trim() } : {}), websocket: false, forceHttps: false };
    if (await mutate("POST", "/api/nginx/sites", { mode: "form", enabled: true, form })) {
      setDomain(""); setRoot(""); setSelected(value); setCreateOpen(false);
    }
  };
  const save = async () => {
    if (!selected || !raw.data?.revision || !content.trim()) return;
    await mutate("PUT", `/api/nginx/sites/${encodeURIComponent(selected)}`, { mode: "raw", content, expectedRevision: raw.data.revision });
  };
  const askAssistant = async()=>{
    if(aiBusy || !moduleContext?.openModule)return;
    setAiBusy(true);
    try {
      const response=await callServerApi(panelId,token,"GET",`/api/nginx/logs?type=error&lines=${aiLines}`);
      if(!response.ok){setError(response.error??nativeText("No se pudieron cargar los registros."));return;}
      const prompt=`Revisa el estado y los errores de Nginx de este servidor y explica las posibles causas.\n${JSON.stringify(unwrap(response))}`;
      chatController.configure(panelId,{token});
      await chatController.loadProviders(panelId);
      chatController.newConversation(panelId);
      chatStore.setStarted(panelId,true);
      moduleContext.openModule("assistant");
      if(aiSubmit==="auto")chatController.sendText(panelId,prompt);
      else chatStore.patchComposer(panelId,{input:prompt});
    }finally{setAiBusy(false);}
  };
  return <ServerModuleScreen settingsPages={[{key:"ai",get label() { return nativeText("IA"); },content:<View style={{gap:16}}><Text style={{color:colors.textSecondary}}>{nativeText("Opciones para enviar diagnósticos al asistente.")}</Text><Field label={nativeText("Modo de envío")}><Select value={aiSubmit} onChange={setAiSubmit} options={[{value:"auto",get label() { return nativeText("Enviar automáticamente"); }},{value:"prefill",get label() { return nativeText("Preparar mensaje"); }}]}/></Field><Field label={nativeText("Líneas de registro")}><Select value={aiLines} onChange={setAiLines} options={[50,200,500].map(n=>({value:String(n),label:String(n)}))}/></Field></View>}]} title={nativeText("Nginx y DNS")} action={{get label() { return nativeText("Crear sitio"); },onPress:()=>setCreateOpen(true)}} subtitle={nativeText("Sitios y configuración del servidor")} onBack={onBack} error={error ?? status.error ?? sites.error ?? raw.error} guardCode={status.guardCode ?? sites.guardCode ?? raw.guardCode} onRetry={() => void reload()} onRefresh={() => void reload()} refreshing={status.loading || sites.loading || raw.loading}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    <WorkspaceModuleSection views={["overview", "status"]}>{moduleContext?.openModule?<Button label={nativeText("Consultar a IA")} variant="secondary" loading={aiBusy} onPress={()=>void askAssistant()}/>:null}<View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Servicio Nginx")}</Text>
      <Text style={{ color: colors.textSecondary }}>{status.data?.running ? nativeText("En ejecución") : status.data?.installed ? nativeText("Detenido") : nativeText("No instalado")} · {status.data?.version ?? "—"}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{status.data?.enabledSites ?? 0} {nativeText("de")}{" "}{status.data?.availableSites ?? 0} {nativeText("sitios activos")}</Text>
      {status.data?.configTest && !status.data.configTest.ok ? <Text style={{ color: colors.danger, fontSize: 12 }}>{status.data.configTest.output}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button label={nativeText("Probar config")} variant="ghost" onPress={() => void mutate("POST", "/api/nginx/service", { action: "test" })} disabled={busy} /><Button label={nativeText("Recargar")} variant="ghost" onPress={() => void mutate("POST", "/api/nginx/service", { action: "reload" })} disabled={busy || !status.data?.running} /><Button label={nativeText("Reiniciar")} variant="ghost" onPress={() => setConfirm({ get title() { return nativeText("Reiniciar Nginx"); }, get message() { return nativeText("Las conexiones actuales pueden interrumpirse."); }, method: "POST", path: "/api/nginx/service", body: { action: "restart" } })} disabled={busy || !status.data?.installed} /></View>
    </View></WorkspaceModuleSection>
    <WorkspaceModuleSection views={["sites"]}><Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Sitios")}</Text>
    {sites.loading && !sites.data ? <ActivityIndicator color={colors.brand} /> : null}
    <ServerDataTable settingsId="sites" title={nativeText("Sitios")} rows={siteList} rowKey={site=>site.name} columns={[{id:"name",get header() { return nativeText("Dominio"); },cell:site=>site.name,width:200},{id:"kind",get header() { return nativeText("Tipo"); },cell:site=>site.kind??"—",width:110},{id:"root",get header() { return nativeText("Directorio"); },cell:site=>site.root??"—",width:250},{id:"enabled",get header() { return nativeText("Estado"); },cell:site=>site.enabled?nativeText("Activo"):nativeText("Desactivado"),width:130}]} rowActions={[{id:"edit",get label() { return nativeText("Editar"); }},{id:"toggle",get label() { return nativeText("Activar/desactivar"); }},{id:"ssl",label:nativeText("SSL")},{id:"renewal",get label() { return nativeText("Renovación"); }},{id:"delete",get label() { return nativeText("Eliminar"); },danger:true}]} onRowAction={(action,site)=>{
      if(action==="toggle")void mutate("POST",`/api/nginx/sites/${encodeURIComponent(site.name)}/${site.enabled?"disable":"enable"}`);
      else if(action==="delete")setConfirm({get title() { return nativeText("Eliminar sitio"); },message:nativeText("Se eliminará {p0}.", {p0: String(site.name)}),method:"DELETE",path:`/api/nginx/sites/${encodeURIComponent(site.name)}`});
      else if(action==="ssl")setSslSite(site.name);
      else if(action==="renewal")setRenewalOpen(true);
      else {setSelected(site.name);setContent("");}
    }} />
    {!siteList.length && !sites.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("No hay sitios.")}</Text> : null}</WorkspaceModuleSection>
    {selected ? <FormDrawer visible onClose={()=>setSelected("")} title={nativeText("Editar {p0}", {p0: String(selected)})} language={language}>{error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text>:null}<View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{selected}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{nativeText("La configuración se valida en el servidor antes de aplicarse.")}</Text>
      {raw.loading && !raw.data ? <ActivityIndicator color={colors.brand} /> : null}
      {raw.data && content === "" ? <Button label={nativeText("Cargar configuración en el editor")} variant="ghost" onPress={() => setContent(raw.data?.content ?? "")} /> : null}
      {content ? <TextInput value={content} onChangeText={setContent} multiline autoCapitalize="none" autoCorrect={false} maxLength={262144} style={[inputStyle, { minHeight: 240, textAlignVertical: "top", fontFamily: "monospace", fontSize: 12, paddingVertical: 10 }]} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button label={nativeText("Guardar")} onPress={() => void save()} disabled={busy || !raw.data?.revision || !content.trim()} /><Button label={currentSite?.enabled ? nativeText("Desactivar") : nativeText("Activar")} variant="ghost" onPress={() => void mutate("POST", `/api/nginx/sites/${encodeURIComponent(selected)}/${currentSite?.enabled ? "disable" : "enable"}`)} disabled={busy} /><Button label={nativeText("Eliminar")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Eliminar sitio"); }, message: nativeText("Se eliminará {p0} del servidor.", {p0: String(selected)}), method: "DELETE", path: `/api/nginx/sites/${encodeURIComponent(selected)}`, clearSelection: true })} disabled={busy} /></View>
    </View></FormDrawer> : null}
    <FormDrawer visible={!!sslSite} onClose={()=>setSslSite("")} title={`SSL · ${sslSite}`} language={language}><Field label={nativeText("Correo para Let’s Encrypt")}><TextInput value={sslEmail} onChangeText={setSslEmail} autoCapitalize="none" keyboardType="email-address" style={inputStyle}/></Field><Button label={nativeText("Emitir certificado")} disabled={!sslEmail.trim()} loading={busy} onPress={()=>void mutate("POST",`/api/nginx/sites/${encodeURIComponent(sslSite)}/ssl`,{email:sslEmail}).then(ok=>{if(ok)setSslSite("");})}/></FormDrawer>
    <FormDrawer visible={renewalOpen} onClose={()=>setRenewalOpen(false)} title={nativeText("Renovación automática")} language={language}><NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Estado de renovación")} readPath="/api/nginx/ssl/renewal"/><NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Certificados")} readPath="/api/nginx/ssl/renewal/sites"/></FormDrawer>
    <NativeNginxTools logLines={aiLines} panelId={panelId} token={token} selected={selected} onSaved={() => void reload()} />
    <FormDrawer visible={createOpen} onClose={()=>setCreateOpen(false)} title={nativeText("Crear sitio")} language={language}>{error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text>:null}    <View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Crear sitio")}</Text>
      <SegmentedControl items={[{key:"static",get label() { return nativeText("Estático"); }},{key:"php",label:"PHP"},{key:"proxy",get label() { return nativeText("Proxy"); }}]} value={kind} onChange={setKind} />
      {kind === "php" ? <Field label={nativeText("Socket PHP-FPM")}><TextInput value={phpSocket} onChangeText={setPhpSocket} autoCapitalize="none" style={inputStyle} /></Field> : null}
      {kind === "proxy" ? <Field label={nativeText("URL de destino")}><TextInput value={proxyPass} onChangeText={setProxyPass} autoCapitalize="none" style={inputStyle} /></Field> : null}
      <Field label={nativeText("Dominio")}><TextInput value={domain} onChangeText={setDomain} placeholder="example.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={inputStyle} /></Field>
      <Field label={nativeText("Directorio web")}><TextInput value={root} onChangeText={setRoot} placeholder="/var/www/example.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={inputStyle} /></Field>
      <Button label={nativeText("Crear sitio")} onPress={() => void create()} disabled={busy || !domain.trim()} />
    </View>
</FormDrawer>
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const pending = confirm; void mutate(pending.method, pending.path, pending.body).then((ok) => { if (ok) setConfirm(null); if (ok && pending.clearSelection) { setSelected(""); setContent(""); } }); }} />
  </ServerModuleScreen>;
}
