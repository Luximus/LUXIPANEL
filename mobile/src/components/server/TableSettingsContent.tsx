import { nativeText } from '../../i18n/native-text';
import React from "react";
import { Pressable, View } from "react-native";
import { PanelText as Text } from "../ui/PanelText";
import { Checkbox } from "./Form";
import { Button } from "../ui/Button";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { loadSessionState } from "../../lib/session-state";

export function TableSettingsContent({ pageSize, pageSizes = [10,25,50,100], onPageSize, actions = [], hidden = [], onHidden, beforeActions, bulk = false }: {
  pageSize:number; pageSizes?:number[]; onPageSize:(value:number)=>void;
  actions?:Array<{id:string;label:string}>; hidden?:string[]; onHidden?:(ids:string[])=>void;
  beforeActions?:React.ReactNode; bulk?:boolean;
}) {
  const tokens=getThemeTokens(useTheme().theme==="dark"), es=loadSessionState().language.startsWith("es");
  return <View style={{gap:20}}>
    <View style={{gap:10}}>
      <Text style={{color:tokens.textPrimary,fontWeight:"600"}}>{es?nativeText("Paginación"):nativeText("Pagination")}</Text>
      <Text style={{color:tokens.textMuted,fontSize:12}}>{es?nativeText("Filas por página"):nativeText("Rows per page")}</Text>
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:4}}>{pageSizes.map(size=><Pressable key={size} accessibilityRole="button" accessibilityLabel={String(size)} accessibilityState={{selected:size===pageSize}} onPress={()=>onPageSize(size)} style={{minHeight:40,paddingHorizontal:12,justifyContent:"center",borderWidth:1,borderRadius:6,borderColor:size===pageSize?tokens.brand:tokens.border,backgroundColor:size===pageSize?tokens.brandDim:tokens.bgInput}}><Text style={{color:size===pageSize?tokens.brand:tokens.textPrimary}}>{size}</Text></Pressable>)}</View>
    </View>
    {beforeActions}
    {actions.length ? <View style={{gap:10}}>
      <Text style={{color:tokens.textPrimary,fontWeight:"600"}}>{es?nativeText("Acciones a mostrar"):nativeText("Visible actions")}</Text>
      {bulk ? <View style={{flexDirection:"row",gap:8}}><Button label={es?nativeText("Mostrar todas"):nativeText("Show all")} size="sm" variant="secondary" onPress={()=>onHidden?.([])}/><Button label={es?nativeText("Ocultar todas"):nativeText("Hide all")} size="sm" variant="secondary" onPress={()=>onHidden?.(actions.map(a=>a.id))}/></View> : null}
      {actions.map(action=><Checkbox key={action.id} label={action.label} value={!hidden.includes(action.id)} onChange={checked=>onHidden?.(checked?hidden.filter(id=>id!==action.id):[...hidden,action.id])}/>)}
    </View>:null}
  </View>;
}
