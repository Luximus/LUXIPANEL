import { nativeText } from '../../i18n/native-text';
import React, { useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, View } from "react-native";
import { callServerApi, unwrap } from "../../api/serverApi";
import { useServerResource } from "../../hooks/useServerApi";
import { useNativeModuleVisible } from "../main/native-module-visibility";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { NativeFlowchart } from "../../components/NativeFlowchart";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
type MapData = { map: { project: { name: string; type: string; summary: string }; tabs: Array<{ id: string; title: string; plainExplanation: string; mermaid: string }>; generatedAt: string } | null; updatedAt?: string };
export function NativeProjectMapScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
 const colors = getThemeTokens(useTheme().theme === "dark"), visible = useNativeModuleVisible();
 const [draft, setDraft] = useState("/var/www"), [path,setPath] = useState("/var/www"), [provider,setProvider] = useState("codex"), [tab,setTab] = useState(""), [job,setJob] = useState<string|null>(null), [busy,setBusy] = useState(false), [error,setError] = useState<string|null>(null);
 const sequence = useRef(0); useEffect(()=>()=>{sequence.current++;},[]);
 const state = useServerResource<MapData>(()=>callServerApi(panelId,token,"GET",`/api/ai/project-map?path=${encodeURIComponent(path)}`),[panelId,token,path]);
 const start = async()=>{const current=++sequence.current;setBusy(true);setError(null);try { const response=await callServerApi(panelId,token,"POST","/api/ai/project-map/generate",{path,providerId:provider});if(current!==sequence.current)return;if(!response.ok)throw new Error(response.error??nativeText("No se pudo generar el mapa."));const body=unwrap<{jobId?:string}>(response);if(!body?.jobId)throw new Error(nativeText("No se recibió el identificador de generación."));setJob(body.jobId);}catch(cause){if(current===sequence.current)setError(cause instanceof Error?cause.message:nativeText("No se pudo generar el mapa."));}finally{if(current===sequence.current)setBusy(false);}};
 useEffect(()=>{if(!job||!visible)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;const poll=async()=>{try{const response=await callServerApi(panelId,token,"GET",`/api/ai/project-map/status?jobId=${encodeURIComponent(job)}`);if(stopped)return;if(!response.ok)throw new Error(response.error??nativeText("No se pudo consultar la generación."));const body=unwrap<{state:string;error?:string}>(response);if(body?.state==="done"){setJob(null);await state.reload();return;}if(body?.state==="error"||body?.state==="unknown")throw new Error(body.error??nativeText("La generación se interrumpió. Puedes generar de nuevo."));timer=setTimeout(()=>void poll(),2000);}catch(cause){if(!stopped){setJob(null);setError(cause instanceof Error?cause.message:nativeText("No se pudo consultar la generación."));}}};void poll();return()=>{stopped=true;clearTimeout(timer);};},[job,visible,panelId,token]);
 const map=state.data?.map, selected=map?.tabs.find(item=>item.id===tab)??map?.tabs[0];
 return <ServerModuleScreen title={nativeText("Mapa de proyectos")} onBack={onBack} subtitle={path} error={error??state.error} onRetry={()=>void state.reload()} onRefresh={()=>void state.reload()} refreshing={state.loading}>
  <Input label={nativeText("Carpeta del proyecto")} value={draft} onChangeText={setDraft} autoCapitalize="none"/><Button label={nativeText("Abrir mapa guardado")} disabled={!draft.startsWith("/")||!!job} onPress={()=>{sequence.current++;setPath(draft.trim());setTab("");setError(null);}}/>
  <SegmentedControl scroll value={provider} onChange={setProvider} items={["codex","claude","gemini","deepseek","grok","minimax"].map(key=>({key,label:key}))}/><Button label={map?nativeText("Regenerar mapa"):nativeText("Generar mapa con IA")} loading={busy||!!job} disabled={busy||!!job} onPress={()=>void start()}/>{job&&<Text style={{color:colors.textMuted}}>{nativeText("Generando mapa del proyecto…")}</Text>}{state.loading&&!map&&<ActivityIndicator color={colors.brand}/>}
  {map?<><Text style={{color:colors.textPrimary,fontSize:19,fontWeight:"700"}}>{map.project.name} · {map.project.type}</Text><Text style={{color:colors.textSecondary}}>{map.project.summary}</Text><SegmentedControl scroll value={selected?.id??""} onChange={setTab} items={map.tabs.map(item=>({key:item.id,label:item.title}))}/>{selected&&<View style={{gap:12}}><Text style={{color:colors.textSecondary}}>{selected.plainExplanation}</Text><NativeFlowchart source={selected.mermaid}/></View>}</>:!state.loading&&!state.error&&<Text style={{color:colors.textMuted}}>{nativeText("Todavía no hay un mapa guardado para esta carpeta.")}</Text>}
 </ServerModuleScreen>;
}
