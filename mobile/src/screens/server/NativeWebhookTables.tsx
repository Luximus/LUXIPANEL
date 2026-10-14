import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import React, { useContext, useState } from "react";
import { Text, View } from "react-native";
import { NativeModuleContext } from "../main/native-module-visibility";
import { WorkspaceModuleSection } from "../main/WorkspaceModuleSection";
import { callServerApi } from "../../api/serverApi";
import { useServerResource } from "../../hooks/useServerApi";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { Button } from "../../components/ui/Button";
import { NativeOperationCard } from "./NativeOperationCard";
import { serviceExtras } from "./native-extras/services";
import { loadSessionState } from "../../lib/session-state";

type Entry = {id:string|number;name?:string;enabled?:boolean;ingestUrl?:string;url?:string;source?:string;prefix?:string;createdAt?:string};
const sections = [
  {view:"receive",get title() { return nativeText("Recepción de datos"); },path:"/api/webhooks/gateways",create:"Crear receptor de datos",actions:[{id:"detail",get label() { return nativeText("Detalles y mensajes recibidos"); }},{id:"state",get label() { return nativeText("Cambiar estado de receptor"); }},{id:"delete",get label() { return nativeText("Eliminar receptor"); },danger:true}]},
  {view:"keys",get title() { return nativeText("Claves API"); },path:"/api/api-keys",create:"Crear clave API",actions:[{id:"delete",get label() { return nativeText("Revocar clave API"); },danger:true}]},
  {view:"discovered",get title() { return nativeText("Webhooks detectados"); },path:"/api/webhooks/discovered",create:"Volver a explorar webhooks",actions:[{id:"manage",get label() { return nativeText("Gestionar webhook detectado"); }}]},
];
export function NativeWebhookTables({panelId,token}:{panelId:string;token:string}) {
 return <>{sections.map(section=><WorkspaceModuleSection key={section.view} views={[section.view]}><WebhookTable panelId={panelId} token={token} section={section}/></WorkspaceModuleSection>)}</>;
}
function WebhookTable({panelId,token,section}:{panelId:string;token:string;section:typeof sections[number]}) {
 const context=useContext(NativeModuleContext);
 const language=loadSessionState().language;
 const list=useServerResource<Entry[]>(()=>callServerApi(panelId,token,"GET",section.path),[panelId,token,section.path],{enabled:context?.visible!==false});
 const [form,setForm]=useState<{title:string;row?:Entry}|null>(null);
 const operation=serviceExtras.webhooks.find(group=>group.title===section.title)?.operations.find(op=>op.title===form?.title);
 return <View style={{gap:12}}>{list.error?<Text accessibilityRole="alert">{localizeServerError(list.error)}</Text>:null}<View style={{alignItems:"flex-end"}}><Button label={section.create} onPress={()=>setForm({title:section.create})}/></View>
   <ServerDataTable settingsId={section.view} title={section.title} rows={Array.isArray(list.data)?list.data:[]} rowKey={row=>String(row.id)} loading={list.loading} columns={[
     {id:"name",get header() { return nativeText("Nombre"); },cell:row=>row.name??String(row.id),width:180},
     {id:"endpoint",header:section.view==="keys"?nativeText("Clave"):nativeText("URL"),cell:row=>row.ingestUrl??row.url??row.prefix??"—",width:260},
     {id:"state",get header() { return nativeText("Estado"); },cell:row=>row.enabled===false?nativeText("Pausado"):nativeText("Activo"),width:100},
     {id:"date",get header() { return nativeText("Creado"); },cell:row=>row.createdAt?new Date(row.createdAt).toLocaleString(language):"—",width:180}
   ]} rowActions={section.actions} onRowAction={(id,row)=>setForm({title:section.actions.find(action=>action.id===id)!.label,row})}/>
   <FormDrawer visible={!!form} onClose={()=>setForm(null)} title={form?.title??section.title} language={language}>
     {operation?<NativeOperationCard key={`${form?.title}:${form?.row?.id??"new"}`} embedded {...operation} panelId={panelId} token={token} initial={{...operation.initial,...(form?.row?{id:String(form.row.id),enabled:form.row.enabled}: {})}} onSaved={()=>void list.reload()}/>:null}
   </FormDrawer>
 </View>;
}
