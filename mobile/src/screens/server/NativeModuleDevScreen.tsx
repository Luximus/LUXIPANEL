import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { RelatedModuleSettings } from "../../components/server/RelatedModuleSettings";
import { FormSheet } from "../../components/ui/FormSheet";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { ModuleGrid } from "../../components/server/ModuleLayouts";
import { loadSessionState } from "../../lib/session-state";
import { NativeModuleDevTools, configFields } from "./NativeModuleDevTools";
import { NativeOperationCard } from "./NativeOperationCard";
import { NativeModuleContext } from "../main/native-module-visibility";
import { NativeModuleDevLogScreen } from "./NativeModuleDevLogScreen";
import React, { useContext, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Linking, TextInput, View } from "react-native";
import { callServerApi, unwrap } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type DevModule = { id?: string; code?: string; name?: string; version?: string; reviewStatus?: string; status?: string; prUrl?: string };
type DevList = { modules?: DevModule[]; stale?: boolean; marketplaceAvailable?: boolean };
type Link = { projectId?: string; moduleId?: string; id?: string };
type Preview = { moduleId: string; projectId?: string; ownerUsername?: string; installedAt: string };
type Validation = { valid?: boolean; errors?: Array<{ path: string; message: string }>; warnings?: Array<{ path: string; message: string }> };
type ConfirmAction = { title: string; message: string; path: string; body?: unknown };

/** Native module publishing, validation and preview controls. */
function NativeMyModulesScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const modules = useServerResource<DevList>(() => callServerApi(panelId, token, "GET", "/api/module-dev/modules"), [panelId, token]);
  const links = useServerResource<{ links?: Link[] }>(() => callServerApi(panelId, token, "GET", "/api/module-dev/links"), [panelId, token]);
  const previews = useServerResource<{ previews?: Preview[] }>(() => callServerApi(panelId, token, "GET", "/api/module-dev/preview"), [panelId, token]);
  const language=loadSessionState().language;
  const [submitOpen,setSubmitOpen]=useState(false);
  const [selectedModule,setSelectedModule]=useState<DevModule|null>(null);
  const [moduleId, setModuleId] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [manifestText, setManifestText] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [runOutput, setRunOutput] = useState("");
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const items = Array.isArray(modules.data?.modules) ? modules.data.modules : [];
  const projectLinks = Array.isArray(links.data?.links) ? links.data.links : [];
  const installed = Array.isArray(previews.data?.previews) ? previews.data.previews : [];
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 9 } as const;
  const reload = async () => { await Promise.all([modules.reload(), links.reload(), previews.reload()]); };
  const mutate = async (path: string, body?: unknown) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try { setError(null); setNotice(null);
    const outcome = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", path, body));
    if (!outcome.ok) { setError(outcome.error ?? nativeText("No se pudo completar la operación.")); return false; }
    setNotice(nativeText("Operación completada."));
    await reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const submit = () => {
    if (!moduleId.trim() || !/^https?:\/\//i.test(prUrl.trim())) { setError(nativeText("Indica un ID de módulo y una URL válida del pull request.")); return; }
    void mutate("/api/module-dev/modules/submit", { moduleId: moduleId.trim(), prUrl: prUrl.trim() });
  };
  const validate = async () => {
    let manifest: unknown;
    try { manifest = JSON.parse(manifestText); } catch { setError(nativeText("El manifest no es JSON válido.")); return; }
    if (!manifest || Array.isArray(manifest) || typeof manifest !== "object") { setError(nativeText("El manifest debe ser un objeto JSON.")); return; }
    setBusy(true); setError(null); setValidation(null);
    const response = await callServerApi(panelId, token, "POST", "/api/module-dev/manifest/validate", { manifest });
    setBusy(false);
    if (!response.ok) { setError(response.error ?? nativeText("No se pudo validar el manifest.")); return; }
    setValidation(unwrap<Validation>(response) ?? null);
  };
  const runCheck = async (projectId: string, tests: boolean) => {
    setBusy(true); setError(null); setRunOutput("");
    const response = await callServerApi(panelId, token, "POST", tests ? "/api/module-dev/tests/run" : "/api/module-dev/checks/run", { projectId });
    setBusy(false);
    if (!response.ok) { setError(response.error ?? nativeText("No se pudo ejecutar la comprobación.")); return; }
    setRunOutput((JSON.stringify(unwrap<unknown>(response) ?? null, null, 2) ?? nativeText("Sin resultado")).slice(0, 50000));
  };
  return <ServerModuleScreen title={nativeText("Mis módulos")} action={{get label() { return nativeText("Enviar módulo"); },onPress:()=>setSubmitOpen(true)}} settingsPages={[{key:"logs",get label() { return nativeText("Diagnósticos y reparaciones"); },content:<NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Ajustes")} readPath="/api/module-dev/logs/config" path="/api/module-dev/logs/config" selectData={value=>(value as {config?:Record<string,unknown>}|null)?.config??{}} fields={configFields} toBody={values=>Object.fromEntries(configFields.map(field=>[field.key,values[field.key]]))} confirmation={nativeText("Guardar la política de diagnósticos y reparación de este servidor.")}/>}]} subtitle={nativeText("Desarrollo, pruebas y publicación")} onBack={onBack} error={error ?? modules.error ?? links.error ?? previews.error} guardCode={modules.guardCode ?? links.guardCode ?? previews.guardCode} onRetry={() => void reload()} onRefresh={() => void reload()} refreshing={modules.loading || links.loading || previews.loading}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    {modules.data?.stale ? <Text style={{ color: colors.warning, fontSize: 12 }}>{nativeText("Datos en caché: el marketplace no respondió.")}</Text> : null}
    {modules.data?.marketplaceAvailable === false ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{nativeText("La publicación requiere vincular este servidor al portal.")}</Text> : null}
    {modules.loading && !modules.data ? <ActivityIndicator color={colors.brand} /> : null}
    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Módulos publicados")}</Text>
    <ServerDataTable settingsId="modules" settingsBeforeActions={<RelatedModuleSettings modules={["assistant","codebase-graph","files"]}/>} title={nativeText("Mis módulos")} rows={items} rowKey={item=>item.code??item.id??item.name??""} columns={[{id:"name",get header() { return nativeText("Módulo"); },cell:item=>item.name??item.code??"—",width:210},{id:"version",get header() { return nativeText("Versión"); },cell:item=>item.version??"—",width:90},{id:"status",get header() { return nativeText("Estado"); },cell:item=>item.reviewStatus??item.status??"—",width:140}]} rowActions={[{id:"manage",get label() { return nativeText("Gestionar"); }}]} onRowAction={(_,item)=>setSelectedModule(item)}/>
    <FormSheet visible={!!selectedModule} onClose={()=>setSelectedModule(null)} title={selectedModule?.name??nativeText("Módulo")} language={language}>{selectedModule?(()=>{const item=selectedModule;const code=item.code??item.id??"";const status=item.reviewStatus??item.status;return <View  style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.name || code}</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{code}{item.version ? ` · v${item.version}` : ""} · {status}</Text><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{status === "publico" ? <Button label={nativeText("Despublicar")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Despublicar módulo"); }, message: nativeText("Se despublicará {p0}.", {p0: String(item.name || code)}), path: `/api/module-dev/modules/${encodeURIComponent(code)}/unpublish` })} disabled={busy} /> : status === "inactivo" ? <Button label={nativeText("Republicar")} onPress={() => void mutate(`/api/module-dev/modules/${encodeURIComponent(code)}/republish`)} disabled={busy} /> : null}{item.prUrl ? <Button label={nativeText("Ver PR ↗")} variant="ghost" onPress={() => { void Linking.openURL(item.prUrl!); }} /> : null}</View>
      <NativeOperationCard panelId={panelId} token={token} title={nativeText("Revisiones")} readPath={`/api/module-dev/modules/${encodeURIComponent(code)}/reviews`} />
      <NativeOperationCard panelId={panelId} token={token} title={nativeText("Reenviar a revisión")} path={`/api/module-dev/modules/${encodeURIComponent(code)}/resubmit`} method="POST" fields={[{key:"prUrl",get label() { return nativeText("URL del pull request"); },required:true}]} initial={{prUrl:item.prUrl??""}} toBody={values=>({prUrl:values.prUrl})} actionLabel={nativeText("Reenviar")} onSaved={()=>void reload()} />
    </View>;})():null}</FormSheet>
    {!items.length && !modules.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("Aún no hay módulos publicados.")}</Text> : null}
    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Proyectos vinculados")}</Text>
    {projectLinks.map((link, index) => { const projectId = link.projectId || link.id || ""; return <View key={`${projectId}:${index}`} style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{projectId}{link.moduleId ? ` → ${link.moduleId}` : ""}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button label={nativeText("Validar")} variant="ghost" onPress={() => void runCheck(projectId, false)} disabled={busy || !projectId} /><Button label={nativeText("Tests")} variant="ghost" onPress={() => void runCheck(projectId, true)} disabled={busy || !projectId} /><Button label={nativeText("Instalar vista previa")} variant="ghost" onPress={() => void mutate("/api/module-dev/preview/install", { projectId })} disabled={busy || !projectId} /></View></View>; })}
    {!projectLinks.length && !links.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("Sin proyectos vinculados.")}</Text> : null}
    {runOutput ? <View style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{nativeText("Resultado de la comprobación")}</Text><Text selectable style={{ color: colors.textSecondary, fontFamily: "monospace", fontSize: 11 }}>{runOutput}</Text></View> : null}
    {installed.length ? <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Vistas previas instaladas")}</Text> : null}
    {installed.map((preview) => <View key={preview.moduleId} style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{preview.moduleId}</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{preview.projectId ?? "—"} · {preview.ownerUsername ?? "—"}</Text><Button label={nativeText("Desinstalar vista previa")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Desinstalar vista previa"); }, message: nativeText("Se desinstalará {p0}.", {p0: String(preview.moduleId)}), path: "/api/module-dev/preview/uninstall", body: { moduleId: preview.moduleId } })} disabled={busy} /></View>)}
    <FormDrawer visible={submitOpen} onClose={()=>setSubmitOpen(false)} title={nativeText("Enviar a revisión")} language={language}>{error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text>:null}    <View style={cardStyle}><Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Enviar a revisión")}</Text><Field label={nativeText("ID del módulo")}><TextInput value={moduleId} onChangeText={setModuleId} autoCapitalize="none" style={inputStyle} /></Field><Field label={nativeText("URL del pull request")}><TextInput value={prUrl} onChangeText={setPrUrl} keyboardType="url" autoCapitalize="none" style={inputStyle} /></Field><Button label={nativeText("Enviar")} onPress={submit} disabled={busy || modules.data?.marketplaceAvailable === false || !moduleId.trim() || !prUrl.trim()} /></View>
    <View style={cardStyle}><Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Validar manifest")}</Text><TextInput value={manifestText} onChangeText={setManifestText} multiline autoCapitalize="none" autoCorrect={false} placeholder="{ … }" placeholderTextColor={colors.textMuted} style={[inputStyle, { minHeight: 120, textAlignVertical: "top", paddingVertical: 10, fontFamily: "monospace" }]} /><Button label={nativeText("Validar")} variant="ghost" onPress={() => void validate()} disabled={busy || !manifestText.trim()} />{validation ? <Text style={{ color: validation.valid ? colors.brand : colors.danger }}>{validation.valid ? nativeText("Manifest válido") : nativeText("Manifest inválido")}</Text> : null}{[...(validation?.errors ?? []), ...(validation?.warnings ?? [])].map((issue, index) => <Text key={index} style={{ color: colors.textSecondary, fontFamily: "monospace", fontSize: 11 }}>{issue.path}: {issue.message}</Text>)}</View>
</FormDrawer>
    <NativeModuleDevTools panelId={panelId} token={token} />
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const pending = confirm; void mutate(pending.path, pending.body).then(ok => { if (ok) setConfirm(null); }); }} />
  </ServerModuleScreen>;
}

export function NativeModuleDevScreen(props: { panelId: string; token: string; onBack: () => void }) {
  const context = useContext(NativeModuleContext);
  return context?.selectedView === "logs" ? <NativeModuleDevLogScreen {...props} /> : <NativeMyModulesScreen {...props} />;
}
