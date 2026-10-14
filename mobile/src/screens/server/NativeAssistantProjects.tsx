import { nativeText } from '../../i18n/native-text';
import React from "react";
import { Text } from "react-native";
import { callServerApi } from "../../api/serverApi";
import { useServerResource } from "../../hooks/useServerApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { NativeOperationCard, type NativeField } from "./NativeOperationCard";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
const fields: NativeField[] = [{key:"title",get label() { return nativeText("Nombre"); },required:true},{key:"path",get label() { return nativeText("Directorio del proyecto"); }},{key:"instructions",get label() { return nativeText("Instrucciones"); },type:"code"},{key:"provider",get label() { return nativeText("Proveedor"); },options:["claude","codex","gemini","deepseek","grok","minimax"].map(key=>({key,label:key}))},{key:"webPreviewUrl",get label() { return nativeText("Vista previa web (HTTPS)"); }},{key:"appPreviewUrl",get label() { return nativeText("Vista previa app (HTTPS)"); }},{key:"graphIndexEnabled",get label() { return nativeText("Indexar grafo de código"); },type:"boolean"}];
export function NativeAssistantProjects({panelId,token,onBack}:{panelId:string;token:string;onBack:()=>void}) {
  const props={panelId,token};const colors=getThemeTokens(useTheme().theme==="dark");
  const projects=useServerResource<{projects:Array<{id:string;title:string;path?:string;instructions?:string;provider?:string;webPreviewUrl?:string;appPreviewUrl?:string;graphIndex?:{enabled?:boolean}}>}>(()=>callServerApi(panelId,token,"GET","/api/ai/projects"),[panelId,token]);
  const reload=()=>void projects.reload();const body=(values:Record<string,unknown>)=>Object.fromEntries(fields.filter(field=>values[field.key]!==undefined).map(field=>[field.key,values[field.key]]));
  return <ServerModuleScreen title={nativeText("Proyectos del asistente")} onBack={onBack} error={projects.error} onRetry={reload} onRefresh={reload} refreshing={projects.loading}>
    <NativeOperationCard {...props} title={nativeText("Nuevo proyecto")} path="/api/ai/projects" method="POST" fields={fields} initial={{title:"",path:"",instructions:"",provider:"codex",webPreviewUrl:"",appPreviewUrl:"",graphIndexEnabled:false}} toBody={body} actionLabel={nativeText("Crear proyecto")} onSaved={reload}/>
    {(projects.data?.projects??[]).map(project=><React.Fragment key={project.id}><Text style={{color:colors.textPrimary,fontWeight:"700"}}>{project.title}</Text>
      <NativeOperationCard {...props} title={nativeText("Editar {p0}", {p0: String(project.title)})} fields={fields} initial={{...project,graphIndexEnabled:project.graphIndex?.enabled??false}} path={`/api/ai/projects/${project.id}`} method="PUT" toBody={body} onSaved={reload}/>
      <NativeOperationCard {...props} title={nativeText("Eliminar {p0}", {p0: String(project.title)})} path={`/api/ai/projects/${project.id}`} method="DELETE" toBody={()=>undefined} actionLabel={nativeText("Eliminar proyecto")} confirmation={nativeText("Se eliminará el proyecto del asistente.")} onSaved={reload}/>
    </React.Fragment>)}
  </ServerModuleScreen>;
}
