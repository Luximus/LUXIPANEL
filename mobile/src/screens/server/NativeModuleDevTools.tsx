import { nativeText } from '../../i18n/native-text';
import React, { useState } from "react";
import { TextInput, View, Text } from "react-native";
import { NativeOperationCard, type NativeField } from "./NativeOperationCard";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
export const configFields: NativeField[] = [
  {key:"agentId",get label() { return nativeText("Agente"); }},
  {key:"providerId",get label() { return nativeText("Proveedor"); },options:["","claude","codex","gemini","deepseek","grok","minimax"].map(key=>({key,label:key||nativeText("Desde el agente")}))},
  {key:"model",get label() { return nativeText("Modelo"); }},
  {key:"effort",get label() { return nativeText("Esfuerzo"); },options:["low","medium","high","xhigh"].map(key=>({key,label:key}))},
  {key:"approvalMode",get label() { return nativeText("Aprobación"); },options:[{key:"auto",get label() { return nativeText("Automática"); }},{key:"manual",get label() { return nativeText("Manual"); }}]},
  {key:"instructions",get label() { return nativeText("Instrucciones de reparación"); },type:"code"},
  {key:"tokenBudget",get label() { return nativeText("Presupuesto de tokens"); },type:"number",min:1000,max:2000000},
  {key:"timeoutMinutes",get label() { return nativeText("Tiempo máximo (minutos)"); },type:"number",min:1,max:120},
  {key:"concurrency",get label() { return nativeText("Reparaciones simultáneas"); },type:"number",min:1,max:4},
  {key:"credentialId",heading:"GitHub",get label() { return nativeText("Credencial de repositorio"); }}, {key:"repairTarget",get label() { return nativeText("Área afectada"); },options:["auto","web","desktop","mobile","developer"].map(key=>({key,label:key}))},
  {key:"checks",get label() { return nativeText("Comprobaciones (una por línea)"); },type:"lines",hint:"backend-types, backend-tests, frontend-tests, frontend-build, desktop-types, desktop-tests, desktop-build, mobile-types, mobile-tests"},
  {key:"enabled",get heading() { return nativeText("Captura de diagnósticos"); },get label() { return nativeText("Recopilar diagnósticos"); },type:"boolean"},
  {key:"retentionDays",get label() { return nativeText("Retención (días)"); },type:"number",min:1,max:365},
  {key:"maxStorageMiB",get label() { return nativeText("Almacenamiento máximo (MiB)"); },type:"number",min:16,max:4096},
];
export function NativeModuleDevTools({ panelId, token }: {panelId:string;token:string}) {
  const props={panelId,token}; const colors=getThemeTokens(useTheme().theme==="dark");
  const [directory,setDirectory]=useState(""); const [search,setSearch]=useState(""); const [file,setFile]=useState("");
  return <>

    <View style={{gap:10}}><Text style={{color:colors.textPrimary,fontWeight:"700"}}>{nativeText("Explorar el código del panel")}</Text>{[[directory,setDirectory,nativeText("Directorio")],[search,setSearch,nativeText("Buscar texto")],[file,setFile,nativeText("Ruta de archivo")]].map(([value,setter,label])=><TextInput key={String(label)} value={value as string} onChangeText={setter as (text:string)=>void} placeholder={label as string} placeholderTextColor={colors.textMuted} autoCapitalize="none" style={{color:colors.textPrimary,padding:12,borderWidth:1,borderColor:colors.border,borderRadius:10}} />)}</View>
    <NativeOperationCard {...props} title={nativeText("Archivos del proyecto")} readPath={`/api/module-dev/project/tree?path=${encodeURIComponent(directory)}`} />
    {search.trim().length>=2?<NativeOperationCard {...props} title={nativeText("Resultados de búsqueda")} readPath={`/api/module-dev/project/search?q=${encodeURIComponent(search.trim())}`} />:null}
    {file.trim()?<NativeOperationCard {...props} title={nativeText("Contenido del archivo")} readPath={`/api/module-dev/project/file?path=${encodeURIComponent(file.trim())}`} />:null}
    <NativeOperationCard {...props} title={nativeText("Actualizar índice del proyecto")} path="/api/module-dev/project/refresh" method="POST" toBody={()=>({})} actionLabel={nativeText("Actualizar")} />
  </>;
}
