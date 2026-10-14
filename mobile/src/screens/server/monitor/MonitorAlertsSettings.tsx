import { nativeText } from '../../../i18n/native-text';
import { localizeServerError } from '../../../lib/server-error-localization';
import React, { useState } from "react";
import { Text, View } from "react-native";
import { callServerApi } from "../../../api/serverApi";
import { runServerMutation, useServerResource } from "../../../hooks/useServerApi";
import { ServerDataTable } from "../../../components/server/ServerDataTable";
import { RelatedModuleSettings } from "../../../components/server/RelatedModuleSettings";
import { Button } from "../../../components/ui/Button";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { NativeOperationCard, type NativeField } from "../NativeOperationCard";

const metrics=["cpu_usage_percent","memory_usage_percent","disk_usage_percent","load_avg_1m","load_avg_5m","rx_bytes_per_sec","tx_bytes_per_sec"];
const fields:NativeField[]=[{key:"name",get label() { return nativeText("Nombre"); },required:true},{key:"metric",get label() { return nativeText("Métrica"); },options:metrics.map(key=>({key,label:key}))},{key:"operator",get label() { return nativeText("Condición"); },options:[{key:"gt",label:">"},{key:"gte",label:"≥"},{key:"lt",label:"<"},{key:"lte",label:"≤"}]},{key:"threshold",get label() { return nativeText("Umbral"); },type:"number",required:true},{key:"sustainedSamples",get label() { return nativeText("Muestras consecutivas"); },type:"number",min:1,max:60}];
type Rule={id:string;name:string;metric:string;operator:string;threshold:number;enabled:boolean;sustainedSamples:number};
type AlertEvent={id:string;ruleId:string;firedAt:string;state:string;triggerValue:number};
const defaults = {metric:metrics[0],operator:"gt",threshold:80,sustainedSamples:3,enabled:true};

export function MonitorAlertsSettings({panelId,token}:{panelId:string;token:string}) {
 const colors=getThemeTokens(useTheme().theme === "dark");
 const state=useServerResource<Rule[]|{items:Rule[]}>(()=>callServerApi(panelId,token,"GET","/api/monitor/alerts/rules"),[panelId,token]);
 const events=useServerResource<AlertEvent[]>(()=>callServerApi(panelId,token,"GET","/api/monitor/alerts/events?limit=10"),[panelId,token]);
 const [editing,setEditing]=useState<Partial<Rule>>(defaults);
 const [version,setVersion]=useState(0);
 const [actionError,setActionError]=useState("");
 const [busy,setBusy]=useState(false);
 const rows=Array.isArray(state.data)?state.data:state.data?.items??[];
 const reset=()=>{setEditing(defaults);setVersion(v=>v+1);};
 const saved=()=>{reset();void state.reload();void events.reload();};
 const toggleRule=async(rule:Rule)=>{
   if(busy)return;setBusy(true);setActionError("");
   try{const result=await runServerMutation(panelId,token,()=>callServerApi(panelId,token,"PUT",`/api/monitor/alerts/rules/${rule.id}`,{enabled:!rule.enabled}));if(!result.ok)throw new Error(result.error??nativeText("No se pudo actualizar la regla."));await state.reload();}
   catch(cause){setActionError(cause instanceof Error?cause.message:nativeText("No se pudo actualizar la regla."));}finally{setBusy(false);}
 };
 return <View style={{gap:16}}>
   <NativeOperationCard embedded key={`${editing.id??"new"}:${version}`} panelId={panelId} token={token} title={nativeText("Alerta")} initial={editing} fields={fields} path={editing.id?`/api/monitor/alerts/rules/${editing.id}`:"/api/monitor/alerts/rules"} method={editing.id?"PUT":"POST"} actionLabel={editing.id?nativeText("Guardar cambios"):nativeText("Crear alerta")} toBody={v=>({...Object.fromEntries(fields.map(f=>[f.key,v[f.key]])),enabled:v.enabled ?? true})} onSaved={saved}/>
   {editing.id?<View style={{gap:8}}><Button label={nativeText("Cancelar edición")} variant="ghost" onPress={reset}/><NativeOperationCard panelId={panelId} token={token} title={nativeText("Eliminar alerta")} path={`/api/monitor/alerts/rules/${editing.id}`} method="DELETE" actionLabel={nativeText("Eliminar")} confirmation={nativeText("Se eliminará esta regla de alertas.")} onSaved={saved}/></View>:null}
   {state.error||actionError?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(state.error||actionError)}</Text>:null}
   <ServerDataTable title={nativeText("Reglas")} rows={rows} rowKey={rule=>String(rule.id)} columns={[{id:"name",get header() { return nativeText("Nombre"); },cell:r=>r.name,width:140},{id:"metric",get header() { return nativeText("Métrica"); },cell:r=>r.metric,width:190},{id:"threshold",get header() { return nativeText("Umbral"); },cell:r=>`${r.operator} ${r.threshold}`,width:100},{id:"enabled",get header() { return nativeText("Estado"); },cell:r=>r.enabled?nativeText("Activa"):nativeText("Pausada"),width:100}]} rowActions={[{id:"edit",get label() { return nativeText("Editar"); }},{id:"toggle",get label() { return nativeText("Activar / pausar"); }}]} onRowAction={(id,rule)=>id==="edit"?setEditing(rule):void toggleRule(rule)}/>
   <RelatedModuleSettings modules={["webhooks"]}/>
   <View style={{gap:8,borderTopWidth:1,borderColor:colors.border,paddingTop:16}}>
     <Text style={{color:colors.textPrimary,fontWeight:"600"}}>{nativeText("Eventos recientes")}</Text>
     {events.error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(events.error)}</Text>:null}
     {(events.data??[]).map(event=><Text key={event.id} style={{color:colors.textSecondary}}>{new Date(event.firedAt).toLocaleString()} · {rows.find(r=>r.id===event.ruleId)?.name??event.ruleId} · {event.state==="firing"?nativeText("Disparada"):nativeText("Resuelta")} · {event.triggerValue}</Text>)}
     {!events.loading&&!events.error&&!events.data?.length?<Text style={{color:colors.textMuted}}>{nativeText("Sin eventos registrados.")}</Text>:null}
   </View>
 </View>;
}
