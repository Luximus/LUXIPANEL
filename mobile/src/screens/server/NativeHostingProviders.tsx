import { loadSessionState } from "../../lib/session-state";
import { permissionModuleLabel, formatPermissionLabel } from "../../lib/permission-labels";
import { getPermissionLabelMessages } from "../../lib/permission-label-messages";
import { localizeServerError } from '../../lib/server-error-localization';
import { nativeOptionLabel } from '../../i18n/native-options';
import { nativeText } from '../../i18n/native-text';
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { callServerApi, unwrap, type HttpMethod } from "../../api/serverApi";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Checkbox, ConfirmDialog, Field } from "../../components/server/Form";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { baseGroupTemplate, setModuleSelection, type GroupTemplate, type ModuleSurface } from "./native-hosting-policy";

type Catalog = { modules: ModuleSurface[]; commandGroups: string[]; descriptions?: Record<string,string>; actionMetadata?: Record<string,{adminOnly?:boolean}> };
type Provider = Record<string,unknown> & {id:string;name:string;enabled:boolean;allowedModules:string[];operations:string[];groupTemplate:GroupTemplate};
const operations=["accounts.read","accounts.write","accounts.status","usage.read","sites.write","access.issue","accounts.delete","expo.read","expo.write","expo.build","expo.submit"];
const quotas:[string,string,number][]=[["diskQuotaMb","Disco (MB)",256],["bandwidthQuotaMb","Transferencia (MB)",1024],["maxDomains","Dominios",1],["maxEmailAccounts","Buzones",0],["maxDatabases","Bases de datos",0],["maxSubUsers","Subusuarios",0]];
const defaults={name:"",targetId:"local",panelUrl:"",upstreamUrl:"http://127.0.0.1:3400",templateId:"",plan:"basic",diskQuotaMb:10240,bandwidthQuotaMb:102400,maxDomains:10,maxEmailAccounts:20,maxDatabases:0,maxSubUsers:0,jailEnabled:false};
const toggle=(items:string[],id:string,enabled:boolean)=>enabled?[...new Set([...items,id])]:items.filter(item=>item!==id);

/** Provider list, form and policy groups follow hosting/ProviderGroupSettings on the web. */
export function NativeHostingProviders({panelId,token,onSaved}:{panelId:string;token:string;onSaved?:()=>void}) {
 const colors=getThemeTokens(useTheme().theme==="dark");
 const permissionMessages=getPermissionLabelMessages(loadSessionState().language);
 const providers=useServerResource<Provider[]>(()=>callServerApi(panelId,token,"GET","/api/hosting/providers"),[panelId,token]);
 const catalog=useServerResource<Catalog>(()=>callServerApi(panelId,token,"GET","/api/hosting/providers/permission-catalog"),[panelId,token]);
 const servers=useServerResource<{id:string;name:string;enabled:boolean;hostFingerprint?:string}[]>(()=>callServerApi(panelId,token,"GET","/api/servers"),[panelId,token]);
 const initialized=useRef(false);
 const [editing,setEditing]=useState<Provider|null>(null);
 const [values,setValues]=useState<Record<string,unknown>>(defaults);
 const [modules,setModules]=useState<string[]>(["files","mail","dns","backups","cron"]);
 const [policy,setPolicy]=useState<GroupTemplate>(baseGroupTemplate);
 const [selectedOps,setSelectedOps]=useState(operations.slice(0,6));
 const [busy,setBusy]=useState(false), [error,setError]=useState("");
 const [newKey,setNewKey]=useState("");
 const [confirm,setConfirm]=useState<{provider:Provider;action:"rotate"|"revoke"}|null>(null);
 const [expanded,setExpanded]=useState<string[]>([]);
 const target=String(values.targetId??"local");
 const plans=useServerResource<{id:string;name:string;revision:number}[]>(()=>callServerApi(panelId,token,"GET",`/api/hosting/providers/templates?targetId=${encodeURIComponent(target)}`),[panelId,token,target]);
 const change=(key:string,value:unknown)=>setValues(current=>({...current,[key]:value}));
 const reset=(provider?:Provider)=>{
  setEditing(provider??null);setValues({...defaults,...provider});setNewKey("");
  const selected=provider?.allowedModules??["files","mail","dns","backups","cron"];
  setModules(selected);setSelectedOps(provider?.operations??operations.slice(0,6));
  const next=provider?.groupTemplate?JSON.parse(JSON.stringify(provider.groupTemplate)) as GroupTemplate:baseGroupTemplate();
  if(!provider) for(const surface of catalog.data?.modules??[]) if(selected.includes(surface.module)) setModuleSelection(next,selected,surface,true,catalog.data?.modules??[]);
  if(catalog.data) next.actions=next.actions.filter(id=>!catalog.data!.actionMetadata?.[id]?.adminOnly);
  setPolicy(next);
 };
 useEffect(()=>{if(catalog.data&&!initialized.current){initialized.current=true;reset();}},[catalog.data]);
 const mutate=async(method:HttpMethod,path:string,body?:unknown)=>{
  if(busy)return false;
  setBusy(true);setError("");
  try {
   let result:unknown;
   const outcome=await runServerMutation(panelId,token,async()=>{const response=await callServerApi(panelId,token,method,path,body);result=unwrap(response);return response;});
   if(!outcome.ok)throw new Error(outcome.error??nativeText("No se pudieron guardar los cambios."));
   const data=result as {key?:string}|undefined;
   if(data?.key)setNewKey(data.key);
   await providers.reload();onSaved?.();return true;
  }catch(cause){setError(cause instanceof Error?cause.message:nativeText("Error de conexión."));return false;}
  finally{setBusy(false);}
 };
 const save=async()=>{
  const normalized=JSON.parse(JSON.stringify(policy)) as GroupTemplate;
  for(const key of ["allowPaths","denyPaths","readOnlyPaths"] as const) normalized.fileAccess[key]=normalized.fileAccess[key].map(v=>v.trim()).filter(Boolean);
  for(const key of ["allowCommands","denyCommands"] as const) normalized.commandPolicy[key]=normalized.commandPolicy[key].map(v=>v.trim()).filter(Boolean);
  normalized.actions=normalized.actions.filter(id=>!catalog.data?.actionMetadata?.[id]?.adminOnly);
  const body:Record<string,unknown>={...values,allowedModules:modules,operations:selectedOps,groupTemplate:normalized,templateId:values.templateId||null};
  for(const key of ["name","panelUrl","upstreamUrl"])if(!String(body[key]??"").trim()){setError(nativeText("Completa nombre, URL pública y servidor."));return;}
  for(const [key,label,min] of quotas){const value=Number(body[key]);if(!Number.isInteger(value)||value<min){setError(nativeText("Revisa {p0}.", {p0: String(label)}));return;}body[key]=value;}
  if(body.templateId)delete body.groupTemplate;
  delete body.id;delete body.createdAt;delete body.updatedAt;
  if(editing)delete body.targetId;
  const allowedKeys=[...Object.keys(defaults),"allowedModules","operations","groupTemplate"];
  const payload=Object.fromEntries(Object.entries(body).filter(([key])=>allowedKeys.includes(key)));
  await mutate(editing?"PATCH":"POST",editing?`/api/hosting/providers/${encodeURIComponent(editing.id)}`:"/api/hosting/providers",payload);
 };
 const card={borderWidth:1,borderColor:colors.border,borderRadius:10,padding:12,gap:10} as const;
 const input={borderWidth:1,borderColor:colors.border,borderRadius:8,padding:10,minHeight:42,color:colors.textPrimary,backgroundColor:colors.bgInput} as const;
 const textField=(key:string,label:string,numeric=false)=><Field key={key} label={nativeText(label)}><TextInput accessibilityLabel={nativeText(label)} style={input} value={String(values[key]??"")} onChangeText={value=>change(key,value)} editable={!busy} autoCapitalize="none" keyboardType={numeric?"numeric":"default"}/></Field>;
 const group=(id:string,label:string,body:React.ReactNode)=><View style={card}><Button variant="ghost" label={nativeText(label)} onPress={()=>setExpanded(current=>toggle(current,id,!current.includes(id)))}/>{expanded.includes(id)?body:null}</View>;
 const fileField=(key:"allowPaths"|"denyPaths"|"readOnlyPaths",label:string)=><Field key={key} label={nativeText(label)}><TextInput multiline style={input} value={policy.fileAccess[key].join("\n")} editable={!busy} onChangeText={value=>setPolicy(current=>({...current,fileAccess:{...current.fileAccess,[key]:value.split("\n")}}))}/></Field>;
 return <View style={{gap:20}}>
  <Text style={{fontWeight:"700",color:colors.textPrimary}}>{nativeText("Conexiones de proveedores")}</Text>
  {providers.loading&&!providers.data?<ActivityIndicator color={colors.brand}/>:null}
  {(providers.data??[]).map(provider=><View key={provider.id} style={card}>
   <Text style={{fontWeight:"600",color:colors.textPrimary}}>{provider.name} · {provider.enabled?nativeText("Activo"):nativeText("Revocado")}</Text>
   <Text style={{color:colors.textSecondary}}>{nativeText("Servidor:")}{" "}{String(provider.targetId)} · {provider.allowedModules.join(", ")}</Text>
   <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}><Button size="sm" label={nativeText("Editar")} variant="secondary" disabled={busy} onPress={()=>reset(provider)}/><Button size="sm" label={nativeText("Rotar clave")} variant="secondary" disabled={busy} onPress={()=>setConfirm({provider,action:"rotate"})}/><Button size="sm" label={provider.enabled?nativeText("Revocar"):nativeText("Reactivar")} variant="secondary" disabled={busy} onPress={()=>provider.enabled?setConfirm({provider,action:"revoke"}):void mutate("PATCH",`/api/hosting/providers/${encodeURIComponent(provider.id)}`,{enabled:true})}/></View>
  </View>)}
  {!providers.loading&&!providers.data?.length?<Text style={{color:colors.textMuted}}>{nativeText("No hay proveedores registrados.")}</Text>:null}
  {error||providers.error||catalog.error||servers.error||plans.error?<><Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error||providers.error||catalog.error||servers.error||plans.error)}</Text><Button label={nativeText("Reintentar")} variant="secondary" onPress={()=>{void providers.reload();void catalog.reload();void servers.reload();void plans.reload();}}/></>:null}
  <View style={{gap:14,borderTopWidth:1,borderColor:colors.border,paddingTop:18}} pointerEvents={busy||!catalog.data?"none":"auto"}>
   <Text style={{fontWeight:"700",color:colors.textPrimary}}>{editing?nativeText("Editar proveedor"):nativeText("Nuevo proveedor")}</Text>
   {textField("name",nativeText("Nombre"))}
   <Field label={nativeText("Servidor gestionado")}><View pointerEvents={editing?"none":"auto"}><Select value={target} onChange={v=>{change("targetId",v);change("templateId","");}} options={[{value:"local",get label() { return nativeText("Servidor local"); }},...(servers.data??[]).filter(s=>s.id!=="local"&&s.enabled&&s.hostFingerprint).map(s=>({value:s.id,label:s.name}))]}/></View></Field>
   {textField("panelUrl",nativeText("URL pública del panel (HTTPS)"))}{textField("upstreamUrl",nativeText("Motor del sitio"))}
   <Field label={nativeText("Plan de hosting")}><Select value={String(values.templateId??"")} onChange={v=>change("templateId",v)} options={[{value:"",get label() { return nativeText("Configuración personalizada"); }},...(plans.data??[]).map(p=>({value:p.id,label:`${p.name} · v${p.revision}`}))]}/></Field>
   <View style={card}><Text style={{fontWeight:"600",color:colors.textPrimary}}>{nativeText("Plantilla de permisos del grupo")}</Text>
    {(catalog.data?.modules??[]).map(surface=><View key={surface.module} style={{gap:10}}>
     <Checkbox label={permissionModuleLabel(surface.module,catalog.data!,permissionMessages)} value={modules.includes(surface.module)} onChange={enabled=>{const next=JSON.parse(JSON.stringify(policy)) as GroupTemplate;setModules(setModuleSelection(next,modules,surface,enabled,catalog.data?.modules??[]));next.actions=next.actions.filter(id=>!catalog.data?.actionMetadata?.[id]?.adminOnly);setPolicy(next);}}/>
     {modules.includes(surface.module)?group(`module:${surface.module}`,nativeText("Permisos"),<View style={{gap:12}}>{(["sidebar","views","actions"] as const).map(field=><View key={field} style={{gap:8}}><Text style={{color:colors.textMuted}}>{{sidebar:nativeText("Navegación"),views:nativeText("Vistas"),actions:nativeText("Acciones")}[field]}</Text>{surface[field].map(id=><Checkbox key={id} label={catalog.data ? formatPermissionLabel(id,catalog.data,permissionMessages) : id} value={policy[field].includes(id)} disabled={field==="actions"&&catalog.data?.actionMetadata?.[id]?.adminOnly} onChange={enabled=>setPolicy(p=>({...p,[field]:toggle(p[field],id,enabled)}))}/>)}</View>)}</View>):null}
    </View>)}
   </View>
   {group("files",nativeText("Acceso a archivos"),<View style={{gap:12}}>{fileField("allowPaths",nativeText("Rutas permitidas"))}{fileField("denyPaths",nativeText("Rutas denegadas"))}{fileField("readOnlyPaths",nativeText("Rutas de solo lectura"))}<Field label={nativeText("Directorio inicial")}><TextInput style={input} value={policy.fileAccess.defaultPath??""} onChangeText={value=>setPolicy(p=>({...p,fileAccess:{...p.fileAccess,defaultPath:value}}))}/></Field></View>)}
   {group("commands","Comandos",<View style={{gap:12}}><Checkbox label={nativeText("Permitir todos los comandos")} value={policy.commandPolicy.allowAll} onChange={value=>setPolicy(p=>({...p,commandPolicy:{...p.commandPolicy,allowAll:value}}))}/><Text style={{color:colors.textPrimary}}>{nativeText("Grupos de comandos")}</Text>{(catalog.data?.commandGroups??[]).map(id=><Checkbox key={id} label={catalog.data ? formatPermissionLabel(id,catalog.data,permissionMessages) : id} value={policy.commandPolicy.groups.includes(id)} onChange={enabled=>setPolicy(p=>({...p,commandPolicy:{...p.commandPolicy,groups:toggle(p.commandPolicy.groups,id,enabled)}}))}/>)}{(["allowCommands","denyCommands"] as const).map(key=><Field key={key} label={key==="allowCommands"?nativeText("Comandos permitidos"):nativeText("Comandos denegados")}><TextInput multiline style={input} value={policy.commandPolicy[key].join("\n")} onChangeText={value=>setPolicy(p=>({...p,commandPolicy:{...p.commandPolicy,[key]:value.split("\n")}}))}/></Field>)}</View>)}
   {group("resources","Recursos",<View style={{gap:12}}><Field label={nativeText("Plan")}><Select value={String(values.plan)} options={["basic","pro","business","custom"].map(value=>({value,label:nativeOptionLabel(value)}))} onChange={value=>change("plan",value)}/></Field>{quotas.map(([key,label])=>textField(key,label,true))}<Checkbox label={nativeText("Aislar cuentas")} value={values.jailEnabled===true} onChange={value=>change("jailEnabled",value)}/></View>)}
   <View style={card}><Text style={{fontWeight:"600",color:colors.textPrimary}}>{nativeText("Operaciones de la API")}</Text>{operations.map(id=><Checkbox key={id} label={id} value={selectedOps.includes(id)} onChange={enabled=>setSelectedOps(current=>toggle(current,id,enabled))}/>)}</View>
   <Button label={editing?nativeText("Guardar cambios"):nativeText("Crear proveedor")} loading={busy} disabled={!catalog.data||plans.loading||!!plans.error} onPress={()=>void save()}/>
   {editing?<Button label={nativeText("Cancelar edición")} variant="ghost" onPress={()=>reset()}/>:null}
  </View>
  {newKey?<View style={card}><Text style={{color:colors.textPrimary}}>{nativeText("Clave del proveedor")}</Text><Text selectable style={{color:colors.textPrimary}}>{newKey}</Text><Text style={{color:colors.textMuted}}>{nativeText("Guárdala ahora. No volverá a mostrarse.")}</Text></View>:null}
  <ConfirmDialog visible={!!confirm} title={confirm?.action==="rotate"?nativeText("Rotar clave"):nativeText("Revocar acceso")} message={confirm?.action==="rotate"?nativeText("La clave anterior dejará de funcionar."):nativeText("El proveedor perderá acceso a la API.")} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} onCancel={()=>setConfirm(null)} onConfirm={()=>{if(!confirm)return;const {provider,action}=confirm;void mutate(action==="rotate"?"POST":"PATCH",`/api/hosting/providers/${encodeURIComponent(provider.id)}${action==="rotate"?"/rotate":""}`,action==="rotate"?undefined:{enabled:false}).then(ok=>{if(ok)setConfirm(null);});}}/>
 </View>;
}
