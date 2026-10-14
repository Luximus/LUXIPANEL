import { nativeText } from '../../i18n/native-text';
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Folder, FileCode2 } from "lucide-react-native";
import { callServerApi } from "../../api/serverApi";
import { useServerResource } from "../../hooks/useServerApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { ModuleSplitLayout } from "../../components/server/ModuleLayouts";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Entry={name:string;path:string;kind:"directory"|"file"};
type Listing={path:string;entries:Entry[];truncated:boolean};
type ProjectFile={path:string;name:string;size:number;content:string|null;truncated:boolean;language:string;binary:boolean};
/** Same read-only source explorer as the web's Project map module. */
export function NativeProjectExplorerScreen({panelId,token,onBack}:{panelId:string;token:string;onBack:()=>void}) {
 const colors=getThemeTokens(useTheme().theme==="dark");
 const [directory,setDirectory]=useState("");
 const [file,setFile]=useState("");
 const [query,setQuery]=useState("");
 const [search,setSearch]=useState("");
 const listing=useServerResource<Listing>(()=>callServerApi(panelId,token,"GET",`/api/module-dev/project/tree?path=${encodeURIComponent(directory)}`),[panelId,token,directory]);
 const result=useServerResource<{results:Entry[];truncated:boolean}>(()=>callServerApi(panelId,token,"GET",`/api/module-dev/project/search?q=${encodeURIComponent(search)}`),[panelId,token,search],{enabled:search.length>=2});
 const source=useServerResource<ProjectFile>(()=>callServerApi(panelId,token,"GET",`/api/module-dev/project/file?path=${encodeURIComponent(file)}`),[panelId,token,file],{enabled:!!file});
 const entries=search.length>=2?result.data?.results??[]:listing.data?.entries??[];
 const open=(entry:Entry)=>{if(entry.kind==="directory"){setDirectory(entry.path);setFile("");setSearch("");setQuery("");}else setFile(entry.path);};
 const reload=()=>{void listing.reload();if(file)void source.reload();if(search.length>=2)void result.reload();};
 const row=(entry:Entry)=><Pressable key={entry.path} accessibilityRole="button" onPress={()=>open(entry)} style={{flexDirection:"row",alignItems:"center",gap:8,minHeight:44,padding:8,backgroundColor:file===entry.path?colors.brandDim:"transparent"}}>{entry.kind==="directory"?<Folder size={18} color={colors.brand}/>:<FileCode2 size={18} color={colors.textMuted}/>}<Text numberOfLines={2} style={{color:colors.textPrimary,flex:1}}>{search?entry.path:entry.name}</Text></Pressable>;
 return <ServerModuleScreen title={nativeText("Mapa de proyecto")} subtitle={nativeText("Explorar el código de LUXIPANEL")} onBack={onBack} onRefresh={reload} onRetry={reload} refreshing={listing.loading||source.loading||result.loading} error={listing.error??source.error??result.error} guardCode={listing.guardCode??source.guardCode??result.guardCode}>
  <ModuleSplitLayout sidebar={<View style={{gap:12}}><Input value={query} onChangeText={setQuery} placeholder={nativeText("Buscar archivos y carpetas")} autoCapitalize="none" onSubmitEditing={()=>setSearch(query.trim())}/><Button label={nativeText("Buscar")} disabled={query.trim().length<2} onPress={()=>setSearch(query.trim())}/><Button label="LUXIPANEL" variant="ghost" onPress={()=>{setDirectory("");setFile("");setSearch("");setQuery("");}}/>{directory?<Button label={nativeText("Carpeta superior")} variant="ghost" onPress={()=>{setDirectory(directory.split("/").slice(0,-1).join("/"));setFile("");}}/>:null}<ScrollView style={{maxHeight:560}}>{entries.map(row)}</ScrollView></View>}>
    <Text selectable style={{color:colors.textMuted}}>{file||directory||nativeText("LUXIPANEL")}</Text>
    {file ? <View style={{gap:12}}><Text style={{color:colors.textPrimary,fontWeight:"700",fontSize:18}}>{source.data?.name??file.split("/").at(-1)}</Text><Text style={{color:colors.textMuted}}>{source.data?.language??""} · {source.data?.size??0} bytes</Text>{source.data?.binary?<Text style={{color:colors.textMuted}}>{nativeText("Este archivo no tiene vista previa de texto.")}</Text>:<ScrollView horizontal style={{minHeight:360}}><View style={{flexDirection:"row",gap:14}}><Text style={{color:colors.textMuted,fontFamily:"monospace",fontSize:12,lineHeight:18}}>{(source.data?.content??"").split("\n").map((_,index)=>index+1).join("\n")}</Text><Text selectable style={{color:colors.textPrimary,fontFamily:"monospace",fontSize:12,lineHeight:18}}>{source.data?.content}</Text></View></ScrollView>}{source.data?.truncated?<Text style={{color:colors.warning}}>{nativeText("El archivo es grande; se muestra una vista parcial.")}</Text>:null}</View>:<View style={{gap:8}}><Text style={{color:colors.textPrimary,fontSize:18,fontWeight:"700"}}>{directory.split("/").at(-1)||nativeText("LUXIPANEL")}</Text>{entries.map(row)}{!listing.loading&&!entries.length?<Text style={{color:colors.textMuted}}>{nativeText("Sin resultados.")}</Text>:null}</View>}
    {listing.data?.truncated||result.data?.truncated?<Text style={{color:colors.warning}}>{nativeText("Hay más resultados; limita la búsqueda para encontrarlos.")}</Text>:null}
  </ModuleSplitLayout>
 </ServerModuleScreen>;
}
