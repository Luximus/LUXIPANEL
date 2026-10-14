import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import React, { useState } from "react";
import { Text, View } from "react-native";
import { callServerApi, unwrap } from "../../api/serverApi";
import { useServerResource } from "../../hooks/useServerApi";
import { NativeOperationCard, NativeResult, type NativeField } from "./NativeOperationCard";
import { RoleDialog } from "./users/RoleDialog";
import type { RolePermissionsPayload } from "./users/types";
import { Button } from "../../components/ui/Button";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
const plans = ["basic","pro","business","custom"].map(key => ({key,label:key}));
const quotaFields: NativeField[] = [
  {key:"diskQuotaMb",get label() { return nativeText("Disco (MB)"); },type:"number",min:256}, {key:"bandwidthQuotaMb",get label() { return nativeText("Transferencia (MB)"); },type:"number",min:1024}, {key:"maxDomains",get label() { return nativeText("Dominios"); },type:"number",min:0},
  {key:"maxEmailAccounts",get label() { return nativeText("Cuentas de correo"); },type:"number",min:0}, {key:"maxDatabases",get label() { return nativeText("Bases de datos"); },type:"number",min:0}, {key:"maxSubUsers",get label() { return nativeText("Subusuarios"); },type:"number",min:0},
];
const accountFields: NativeField[] = [{key:"plan",get label() { return nativeText("Plan"); },options:plans},...quotaFields,{key:"jailEnabled",get label() { return nativeText("Aislar la cuenta"); },type:"boolean"},{key:"allowedModules",get label() { return nativeText("Módulos habilitados (uno por línea)"); },type:"lines"}];
const templateFields: NativeField[] = [{key:"name",get label() { return nativeText("Nombre del plan"); },required:true},...quotaFields.filter(f=>f.key!=="bandwidthQuotaMb").map(f=>({...f,key:`limits.${f.key}`})),
  {key:"limits.cpuPercent",get label() { return nativeText("CPU (%)"); },type:"number",min:1,max:10000},{key:"limits.memoryMb",get label() { return nativeText("Memoria (MB)"); },type:"number",min:64},{key:"limits.maxProcesses",get label() { return nativeText("Procesos"); },type:"number",min:8},
  {key:"security.shell",get label() { return nativeText("Terminal"); },options:[{key:"disabled",get label() { return nativeText("Deshabilitada"); }},{key:"jailed",get label() { return nativeText("Aislada"); }}]},{key:"security.maxTerminalSessions",get label() { return nativeText("Sesiones de terminal"); },type:"number",min:1,max:20},
  {key:"security.commandTimeoutSeconds",get label() { return nativeText("Tiempo por comando (segundos)"); },type:"number",min:1,max:3600},{key:"security.sessionHours",get label() { return nativeText("Duración de sesión (horas)"); },type:"number",min:0.1,max:720},{key:"security.requireMfa",get label() { return nativeText("Exigir MFA"); },type:"boolean"},{key:"security.mailTargetIds",get label() { return nativeText("Destinos de correo"); },type:"lines"}];
type Template = {id:string;revision:number;name:string;permissions:RolePermissionsPayload;limits:Record<string,number>;security:Record<string,unknown>};
const basePermissions: RolePermissionsPayload = {sidebar:["dashboard","preferences"],views:["panel.dashboard","panel.preferences"],actions:[],fileAccess:{allowAll:false,allowPaths:["."],denyPaths:[],readOnlyPaths:[],defaultPath:"."},commandPolicy:{allowAll:false,groups:[],allowCommands:[],denyCommands:[]}};
export function NativeHostingTools({panelId,token,selectedId,onSaved,section="all"}:{panelId:string;token:string;selectedId:number|null;onSaved:()=>void;section?:"all"|"defaults"|"plans"|"account"}) {
  const props={panelId,token};const colors=getThemeTokens(useTheme().theme==="dark");
  const templates=useServerResource<Template[]>(()=>callServerApi(panelId,token,"GET","/api/roles/templates"),[panelId,token]);
  const [editing,setEditing]=useState<Template|null>(null);const [creating,setCreating]=useState(false);const [permissions,setPermissions]=useState<RolePermissionsPayload>(basePermissions);const [roleOpen,setRoleOpen]=useState(false);
  const pickTemplate=(item:Template|null)=>{setEditing(item);setCreating(true);setPermissions(item?.permissions??basePermissions);};
  const reload=()=>{void templates.reload();onSaved();};
  const toTemplate=(values:Record<string,unknown>)=>({name:values.name,limits:values.limits,security:values.security,permissions:{...permissions,version:2,fileAccess:{...permissions.fileAccess,allowAll:false},commandPolicy:{...permissions.commandPolicy,allowAll:false}},...(editing?{expectedRevision:editing.revision}:{})});
  return <>
    {(section === "defaults" || section === "all") ? <NativeOperationCard embedded {...props} title={nativeText("Valores predeterminados de hosting")} readPath="/api/hosting/defaults" path="/api/hosting/defaults" fields={accountFields} toBody={values=>Object.fromEntries(accountFields.map(f=>[f.key,values[f.key]]))} confirmation={nativeText("Las cuentas nuevas utilizarán estos valores.")} /> : null}
    {selectedId && (section === "account" || section === "all") ? <>
      <NativeOperationCard {...props} key={`limits:${selectedId}`} title={nativeText("Cuotas y permisos de la cuenta")} readPath={`/api/hosting/accounts/${selectedId}`} path={`/api/hosting/accounts/${selectedId}`} fields={[{key:"templateId",get label() { return nativeText("Identificador del plan reutilizable"); }},{key:"displayName",get label() { return nativeText("Nombre visible"); }},{key:"email",get label() { return nativeText("Correo"); }},...accountFields,{key:"notes",get label() { return nativeText("Notas"); },type:"code"}]} toBody={values=>Object.fromEntries(["templateId","displayName","email","plan",...quotaFields.map(f=>f.key),"allowedModules","jailEnabled","notes"].filter(key=>values[key]!==undefined&&!(["templateId","email"].includes(key)&&!values[key])).map(key=>[key,values[key]]))} onSaved={onSaved} />
      <NativeOperationCard {...props} key={`audit:${selectedId}`} title={nativeText("Auditoría de la cuenta")} readPath={`/api/hosting/accounts/${selectedId}/audit?limit=100`} />
      <NativeOperationCard {...props} key={`jail:${selectedId}`} title={nativeText("Estado del aislamiento")} readPath={`/api/hosting/accounts/${selectedId}/jail`} />
      <NativeOperationCard {...props} key={`reconcile:${selectedId}`} title={nativeText("Reaplicar el plan de la cuenta")} path={`/api/hosting/accounts/${selectedId}/reconcile`} method="POST" toBody={()=>({})} actionLabel={nativeText("Reconciliar")} confirmation={nativeText("Se reaplicarán los límites y permisos de su plan.")} onSaved={onSaved} />
    </>:null}
    {(section === "plans" || section === "all") ? <><View style={{gap:10}}><Text style={{color:colors.textPrimary,fontWeight:"700"}}>{nativeText("Planes reutilizables")}</Text>
      {templates.error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(templates.error)}</Text>:null}
      {(Array.isArray(templates.data)?templates.data:[]).map(item=><View key={item.id} style={{gap:8}}><Text style={{color:colors.textSecondary}}>{item.name} {nativeText("· revisión")}{" "}{item.revision}</Text><Button label={nativeText("Editar plan")} variant="ghost" onPress={()=>pickTemplate(item)}/><NativeOperationCard {...props} title={nativeText("Eliminar {p0}", {p0: String(item.name)})} path={`/api/roles/templates/${item.id}`} method="DELETE" toBody={()=>undefined} actionLabel={nativeText("Eliminar")} confirmation={nativeText("Eliminar este plan. El servidor rechazará la operación si lo utiliza alguna cuenta.")} onSaved={reload}/></View>)}
      <Button label={nativeText("Crear plan")} onPress={()=>pickTemplate(null)}/>
    </View>
    {creating?<NativeOperationCard {...props} key={editing?.id??"new-plan"} title={editing?nativeText("Editar {p0}", {p0: String(editing.name)}):nativeText("Nuevo plan")} initial={editing?{...editing}:{name:"Nuevo plan",limits:{diskQuotaMb:1024,maxDomains:1,maxEmailAccounts:5,maxDatabases:1,maxSubUsers:0,cpuPercent:100,memoryMb:256,maxProcesses:64},security:{shell:"disabled",maxTerminalSessions:2,commandTimeoutSeconds:120,sessionHours:24,requireMfa:false,mailTargetIds:[]}}} fields={templateFields} path={editing?`/api/roles/templates/${editing.id}`:"/api/roles/templates"} method={editing?"PUT":"POST"} toBody={toTemplate} onSaved={()=>{setCreating(false);reload();}}><Button label={nativeText("Editar matriz de permisos")} onPress={()=>setRoleOpen(true)}/><NativeResult value={permissions}/></NativeOperationCard>:null}
    </> : null}
    <RoleDialog visible={roleOpen} mode="edit" initial={{name:editing?.name??nativeText("Nuevo plan"),permissions}} panelId={panelId} token={token} onClose={()=>setRoleOpen(false)} onSave={async payload=>{if(payload.permissions)setPermissions(payload.permissions);setRoleOpen(false);return true;}}/>
  </>;
}
