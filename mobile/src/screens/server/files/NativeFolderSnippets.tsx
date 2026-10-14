import { nativeText } from '../../../i18n/native-text';
import React, { useState } from "react";
import { Text, View } from "react-native";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Checkbox } from "../../../components/server/Form";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
type Snippet = { name: string; command: string; tags?: string[] };
export function NativeFolderSnippets({ panelId, token }: { panelId: string; token: string }) {
 const colors=getThemeTokens(useTheme().theme==="dark");const [open,setOpen]=useState(false),[path,setPath]=useState("/var/www"),[category,setCategory]=useState("Proyecto"),[plan,setPlan]=useState<Snippet[]>([]),[chosen,setChosen]=useState<Set<number>>(new Set()),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const suggest=async()=>{setBusy(true);setMessage("");try{const response=await callServerApi(panelId,token,"GET",`/api/files/snippets/suggest?path=${encodeURIComponent(path)}`);if(!response.ok)throw new Error(response.error??nativeText("No se pudieron proponer comandos."));const result=unwrap<{snippets?:Snippet[];category?:string}>(response);setPlan(result?.snippets??[]);setChosen(new Set((result?.snippets??[]).map((_,index)=>index)));if(result?.category)setCategory(result.category);}catch(cause){setMessage(cause instanceof Error?cause.message:nativeText("No se pudieron proponer comandos."));}finally{setBusy(false);}};
 const save=async()=>{setBusy(true);setMessage("");try{const result=await runServerMutation(panelId,token,()=>callServerApi(panelId,token,"POST","/api/terminal/snippets/import",{category,snippets:plan.filter((_,index)=>chosen.has(index)).map(snippet=>({name:snippet.name,command:snippet.command,tags:snippet.tags??[]}))}));if(!result.ok)throw new Error(result.error??nativeText("No se pudieron guardar comandos."));setMessage(nativeText("Comandos guardados en la terminal."));}catch(cause){setMessage(cause instanceof Error?cause.message:nativeText("No se pudieron guardar comandos."));}finally{setBusy(false);}};
 return <View style={{gap:10}}><Button variant="secondary" label={nativeText("{p0} Comandos de terminal para una carpeta", {p0: String(open?"−":"+")})} onPress={()=>setOpen(!open)}/>{open&&<><Input label={nativeText("Carpeta")} value={path} onChangeText={setPath} autoCapitalize="none"/><Button label={nativeText("Proponer comandos")} loading={busy} onPress={()=>void suggest()}/>{plan.map((snippet,index)=><View key={index} style={{gap:6}}><Checkbox label={snippet.name} value={chosen.has(index)} onChange={checked=>setChosen(current=>{const next=new Set(current);if(checked)next.add(index);else next.delete(index);return next;})}/><Text selectable style={{color:colors.textSecondary,fontFamily:"monospace"}}>{snippet.command}</Text></View>)}{plan.length>0&&<><Input label={nativeText("Categoría de comandos")} value={category} onChangeText={setCategory}/><Button label={nativeText("Guardar comandos seleccionados")} disabled={busy||chosen.size===0||!category.trim()} onPress={()=>void save()}/></>}{message&&<Text accessibilityRole="alert" style={{color:colors.textSecondary}}>{message}</Text>}</>}</View>;
}
