import { localizeServerError } from '../../lib/server-error-localization';
import { nativeText } from '../../i18n/native-text';
import React from "react";
import { Text, View } from "react-native";
import { callServerApi } from "../../api/serverApi";
import { useServerResource } from "../../hooks/useServerApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { NativeOperationCard } from "./NativeOperationCard";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
type Connector={id:string;name:string;description:string;connected:boolean;configured:boolean;lastError?:string;credentialFields:Array<{key:string;label:string;type:string;required?:boolean;help?:string}>;setup?:{steps?:string[]}};
export function NativeAssistantConnectors({panelId,token,onBack}:{panelId:string;token:string;onBack:()=>void}) {
  const props={panelId,token};const colors=getThemeTokens(useTheme().theme==="dark");
  const resource=useServerResource<{connectors:Connector[]}>(()=>callServerApi(panelId,token,"GET","/api/ai/connectors"),[panelId,token]);const reload=()=>void resource.reload();
  return <ServerModuleScreen title={nativeText("Conectores del asistente")} onBack={onBack} error={resource.error} onRetry={reload} onRefresh={reload} refreshing={resource.loading}>
    {(resource.data?.connectors??[]).map(connector=><View key={connector.id} style={{gap:10}}><Text style={{color:colors.textPrimary,fontWeight:"700"}}>{connector.name} · {connector.connected?nativeText("Conectado"):connector.configured?nativeText("Configurado"):nativeText("Sin configurar")}</Text><Text style={{color:colors.textMuted}}>{connector.description}</Text>
      {connector.lastError?<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(connector.lastError)}</Text>:null}
      <NativeOperationCard {...props} title={nativeText("Configurar {p0}", {p0: String(connector.name)})} path={`/api/ai/connectors/${connector.id}/connect`} method="POST" fields={connector.credentialFields.map(field=>({key:field.key,label:field.label,type:field.type==="textarea"?"code":field.type==="password"?"secret":undefined,required:field.required,hint:field.help}))} toBody={values=>({secrets:Object.fromEntries(connector.credentialFields.map(field=>[field.key,values[field.key]]))})} actionLabel={nativeText("Conectar")} onSaved={reload}><>{connector.setup?.steps?.map((step,i)=><Text key={i} style={{color:colors.textMuted}}>{i+1}. {step}</Text>)}</></NativeOperationCard>
      {connector.configured?<>
        <NativeOperationCard {...props} title={nativeText("Desconectar {p0}", {p0: String(connector.name)})} path={`/api/ai/connectors/${connector.id}/disconnect`} method="POST" toBody={()=>({})} actionLabel={nativeText("Desconectar")} confirmation={nativeText("Eliminar las credenciales y desconectar este conector.")} onSaved={reload}/>
        <NativeOperationCard {...props} title={nativeText("Activar herramientas del conector")} path={`/api/ai/connectors/${connector.id}/active`} method="PUT" fields={[{key:"active",get label() { return nativeText("Habilitado"); },type:"boolean"}]} initial={{active:connector.connected}} toBody={values=>({active:values.active})} onSaved={reload}/>
        <NativeOperationCard {...props} title={nativeText("Explorar archivos")} path={values=>`/api/ai/connectors/${connector.id}/files?query=${encodeURIComponent(String(values.query??""))}`} method="GET" fields={[{key:"query",get label() { return nativeText("Buscar archivos"); }}]} actionLabel={nativeText("Buscar")}/>
        <NativeOperationCard {...props} title={nativeText("Obtener archivo")} path={`/api/ai/connectors/${connector.id}/files/fetch`} method="POST" fields={[{key:"fileId",get label() { return nativeText("Identificador de archivo"); },required:true},{key:"name",get label() { return nativeText("Nombre opcional"); }}]} toBody={values=>Object.fromEntries(Object.entries(values).filter(([,value])=>value!==""))} actionLabel={nativeText("Obtener")}/>
      </>:null}
    </View>)}
  </ServerModuleScreen>;
}
