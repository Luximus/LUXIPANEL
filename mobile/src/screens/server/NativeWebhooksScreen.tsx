import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { loadSessionState } from "../../lib/session-state";
import { NativeWebhookTables } from "./NativeWebhookTables";
import React, { useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { callServerApi, unwrap, type HttpMethod } from "../../api/serverApi";
import { WorkspaceModuleSection } from "../main/WorkspaceModuleSection";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { Checkbox, ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Hook = { id: number; name: string; url: string; events: string[]; enabled: boolean };
type Delivery = { id?: string | number; status?: string; statusCode?: number; createdAt?: string; error?: string };
type ConfirmAction = { title: string; message: string; method: HttpMethod; path: string; revealSecret?: boolean };

/** Native webhook registration, testing, delivery history and secret rotation. */
export function NativeWebhooksScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const hooksState = useServerResource<Hook[]>(() => callServerApi(panelId, token, "GET", "/api/webhooks"), [panelId, token]);
  const eventsState = useServerResource<string[]>(() => callServerApi(panelId, token, "GET", "/api/webhooks/events"), [panelId, token]);
  const language=loadSessionState().language;
  const [createOpen,setCreateOpen]=useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [secret, setSecret] = useState("");
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 9 } as const;
  const hooks = Array.isArray(hooksState.data) ? hooksState.data : [];
  const events = Array.isArray(eventsState.data) ? eventsState.data : [];
  const reload = async () => { await Promise.all([hooksState.reload(), eventsState.reload()]); };
  const mutate = async (method: HttpMethod, path: string, body?: unknown, revealSecret = false) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try { setError(null); setNotice(null);
    if (revealSecret) {
      const response = await callServerApi(panelId, token, method, path, body);
        if (!response.ok) { setError(response.error ?? nativeText("No se pudo completar la operación.")); return false; }
      setSecret(unwrap<{ secret?: string }>(response)?.secret ?? "");
    } else {
      const result = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, path, body));
        if (!result.ok) { setError(result.error ?? nativeText("No se pudo completar la operación.")); return false; }
    }
    setNotice(nativeText("Operación completada."));
    await reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const save = async () => {
    if (name.trim().length < 2 || !/^https?:\/\//i.test(url.trim()) || !chosen.length) { setError(nativeText("Completa nombre, URL HTTP(S) y al menos un evento.")); return; }
    const payload = { name: name.trim(), url: url.trim(), events: chosen, enabled: true };
    if (await mutate(editing ? "PUT" : "POST", editing ? `/api/webhooks/${editing}` : "/api/webhooks", payload, !editing)) {
      setName(""); setUrl(""); setChosen([]); setEditing(null); setCreateOpen(false);
    }
  };
  const showDeliveries = async (id: number) => {
    setSelected(id); setDeliveries([]); setError(null);
    const result = await callServerApi(panelId, token, "GET", `/api/webhooks/${id}/deliveries`);
    const data = unwrap<Delivery[]>(result);
    if (result.ok && Array.isArray(data)) setDeliveries(data);
    else setError(result.error ?? nativeText("No se pudieron cargar las entregas."));
  };
  const test = async (id: number) => {
    setBusy(true); setError(null); setNotice(null);
    const response = await callServerApi(panelId, token, "POST", `/api/webhooks/${id}/test`);
    setBusy(false);
    const detail = unwrap<{ delivered?: boolean; error?: string }>(response);
    if (response.ok) setNotice(nativeText("Webhook entregado correctamente."));
    else setError(detail?.error ?? response.error ?? nativeText("La prueba no se entregó."));
    if (selected === id) void showDeliveries(id);
  };
  return <ServerModuleScreen title={nativeText("Webhooks")} subtitle={nativeText("Eventos y entregas del panel")} onBack={onBack} error={error ?? hooksState.error ?? eventsState.error} guardCode={hooksState.guardCode ?? eventsState.guardCode} onRetry={() => void reload()} onRefresh={() => void reload()} refreshing={hooksState.loading || eventsState.loading}>
    <WorkspaceModuleSection views={["webhooks"]}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    {secret ? <View style={[cardStyle, { borderColor: colors.warning }]}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{nativeText("Guarda este secreto ahora; sólo se muestra una vez.")}</Text><Text selectable style={{ color: colors.textSecondary, fontFamily: "monospace", fontSize: 12 }}>{secret}</Text><View style={{ flexDirection: "row", gap: 8 }}><Button label={nativeText("Copiar")} onPress={() => { void Clipboard.setStringAsync(secret); }} /><Button label={nativeText("Ocultar")} variant="ghost" onPress={() => setSecret("")} /></View></View> : null}
    <Button label={nativeText("Nuevo webhook")} onPress={()=>{setEditing(null);setCreateOpen(true);}}/>
    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Webhooks")}</Text>
    {hooksState.loading && !hooksState.data ? <ActivityIndicator color={colors.brand} /> : null}
    <ServerDataTable settingsId="webhooks" title={nativeText("Webhooks")} rows={hooks} rowKey={hook=>String(hook.id)} columns={[{id:"name",get header() { return nativeText("Nombre"); },cell:h=>h.name,width:170},{id:"url",get header() { return nativeText("URL"); },cell:h=>h.url,width:260},{id:"events",get header() { return nativeText("Eventos"); },cell:h=>h.events.join(", "),width:200},{id:"state",get header() { return nativeText("Estado"); },cell:h=>h.enabled?nativeText("Activo"):nativeText("Pausado"),width:100}]} rowActions={[{id:"edit",get label() { return nativeText("Editar"); }},{id:"deliveries",get label() { return nativeText("Entregas"); }},{id:"test",get label() { return nativeText("Probar"); }},{id:"toggle",get label() { return nativeText("Activar/pausar"); }},{id:"secret",get label() { return nativeText("Rotar secreto"); }},{id:"delete",get label() { return nativeText("Eliminar"); },danger:true}]} onRowAction={(id,hook)=>{
      if(id==="edit"){setEditing(hook.id);setName(hook.name);setUrl(hook.url);setChosen(hook.events);setCreateOpen(true);}
      else if(id==="deliveries")void showDeliveries(hook.id);
      else if(id==="test")void test(hook.id);
      else if(id==="toggle")void mutate("PUT",`/api/webhooks/${hook.id}`,{enabled:!hook.enabled});
      else if(id==="secret")setConfirm({get title() { return nativeText("Rotar secreto"); },message:nativeText("El secreto actual de {p0} dejará de funcionar.", {p0: String(hook.name)}),method:"POST",path:`/api/webhooks/${hook.id}/regenerate-secret`,revealSecret:true});
      else setConfirm({get title() { return nativeText("Eliminar webhook"); },message:nativeText("Se eliminará {p0}.", {p0: String(hook.name)}),method:"DELETE",path:`/api/webhooks/${hook.id}`});
    }}/>
    {!hooks.length && !hooksState.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("No hay webhooks.")}</Text> : null}
    {selected != null ? <View style={cardStyle}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{nativeText("Entregas recientes")}</Text>{deliveries.map((item, index) => <View key={item.id ?? index} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.status ?? item.statusCode ?? "—"} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</Text>{item.error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{localizeServerError(item.error)}</Text> : null}</View>)}{!deliveries.length ? <Text style={{ color: colors.textMuted }}>{nativeText("Sin entregas.")}</Text> : null}</View> : null}
    </WorkspaceModuleSection>
    <NativeWebhookTables panelId={panelId} token={token}/>
    <FormDrawer visible={createOpen} onClose={()=>setCreateOpen(false)} title={editing?nativeText("Editar webhook"):nativeText("Nuevo webhook")} language={language}>{error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text>:null}    <View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{editing ? nativeText("Editar webhook") : nativeText("Nuevo webhook")}</Text>
      <Field label={nativeText("Nombre")}><TextInput value={name} onChangeText={setName} maxLength={128} style={inputStyle} /></Field>
      <Field label={nativeText("URL")}><TextInput value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="https://…" placeholderTextColor={colors.textMuted} style={inputStyle} /></Field>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{nativeText("Eventos")}</Text>
      {events.map((event) => <Checkbox key={event} value={chosen.includes(event)} onChange={(value) => setChosen((current) => value ? [...new Set([...current, event])] : current.filter((item) => item !== event))} label={event} />)}
      <View style={{ flexDirection: "row", gap: 8 }}><Button label={editing ? nativeText("Guardar") : nativeText("Crear")} onPress={() => void save()} disabled={busy || !name.trim() || !url.trim() || !chosen.length} />{editing ? <Button label={nativeText("Cancelar")} variant="ghost" onPress={() => { setEditing(null); setName(""); setUrl(""); setChosen([]); }} /> : null}</View>
    </View>
</FormDrawer>
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const pending = confirm; void mutate(pending.method, pending.path, undefined, pending.revealSecret).then(ok => { if (ok) setConfirm(null); }); }} />
  </ServerModuleScreen>;
}
