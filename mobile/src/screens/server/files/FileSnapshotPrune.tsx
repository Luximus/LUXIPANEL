import { nativeText } from '../../../i18n/native-text';
import React, { useState } from "react";
import { Text, View } from "react-native";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/server/Form";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";

export function FileSnapshotPrune({panelId,token}:{panelId:string;token:string}) {
 const colors=getThemeTokens(useTheme().theme==="dark");
 const [preview,setPreview]=useState<{count:number;bytes:number}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const inspect=async()=>{
  setBusy(true);setMessage("");
  try {const response=await callServerApi(panelId,token,"GET","/api/files/config/prune-preview");const data=unwrap<{count:number;bytes:number}>(response);if(!response.ok||!data)throw new Error(response.error??nativeText("No se pudo revisar la limpieza."));if(data.count)setPreview(data);else setMessage(nativeText("No hay copias para limpiar."));}
  catch(cause){setMessage(cause instanceof Error?cause.message:nativeText("No se pudo revisar la limpieza."));}finally{setBusy(false);}
 };
 const prune=async()=>{
  setBusy(true);
  try{const response=await runServerMutation(panelId,token,()=>callServerApi(panelId,token,"POST","/api/files/config/prune"));if(!response.ok)throw new Error(response.error??nativeText("No se pudieron limpiar las copias."));setPreview(null);setMessage(nativeText("Copias antiguas eliminadas."));}
  catch(cause){setMessage(cause instanceof Error?cause.message:nativeText("No se pudieron limpiar las copias."));}finally{setBusy(false);}
 };
 return <View style={{gap:8}}><Button label={nativeText("Limpiar copias")} variant="secondary" loading={busy} onPress={()=>void inspect()}/>{message?<Text accessibilityRole="alert" style={{color:colors.textSecondary}}>{message}</Text>:null}<ConfirmDialog visible={!!preview} title={nativeText("Limpiar copias")} message={nativeText("{p0} copias antiguas se eliminarán permanentemente ({p1} MiB).", {p0: String(preview?.count??0), p1: String(((preview?.bytes??0)/1048576).toFixed(1))})} confirmLabel={nativeText("Eliminar")} cancelLabel={nativeText("Cancelar")} submitting={busy} onCancel={()=>setPreview(null)} onConfirm={()=>void prune()}/></View>;
}
