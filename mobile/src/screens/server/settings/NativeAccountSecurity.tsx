import { nativeText } from '../../../i18n/native-text';
import { localizeServerError } from '../../../lib/server-error-localization';
import React, { useState } from "react";
import { Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useServerPreferences } from "../../../lib/use-server-preferences";
import { useNativeModuleVisible } from "../../main/native-module-visibility";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/server/Form";
export function NativeAccountSecurity({panelId}:{panelId:string}) {
 const [open,setOpen]=useState(false),[label,setLabel]=useState("Passkey"),[confirm,setConfirm]=useState<string|null>(null);
 const visible=useNativeModuleVisible(),state=useServerPreferences(panelId,visible&&open),colors=getThemeTokens(useTheme().theme==="dark");
 return <View style={{gap:10}}><Button label={nativeText("{p0} Passkeys y códigos de recuperación", {p0: String(open?"−":"+")})} variant="secondary" onPress={()=>setOpen(!open)} />{open&&<>
  {state.error&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(state.error)}</Text>}{state.notice&&<Text style={{color:colors.textSecondary}}>{state.notice}</Text>}
  <Input label={nativeText("Nombre de la passkey")} value={label} onChangeText={setLabel}/><Button label={nativeText("Registrar passkey")} loading={state.busy} disabled={!!state.enrollment||!label.trim()} onPress={()=>void state.register(url=>WebBrowser.openBrowserAsync(url),label)}/>
  {state.passkeys.map(key=><View key={key.id} style={{gap:6}}><Text style={{color:colors.textPrimary}}>{key.label}</Text><Button label={nativeText("Eliminar passkey")} variant="ghost" onPress={()=>setConfirm(key.id)}/></View>)}
  <Button label={nativeText("Regenerar códigos de recuperación")} onPress={()=>setConfirm("regenerate")} disabled={state.busy}/>{state.codes.length>0&&<><Text selectable style={{color:colors.textPrimary,fontFamily:"monospace"}}>{state.codes.join("\n")}</Text><Button label={nativeText("Copiar códigos")} variant="ghost" onPress={()=>void Clipboard.setStringAsync(state.codes.join("\n"))}/><Button label={nativeText("Ocultar códigos")} variant="ghost" onPress={()=>state.setCodes([])}/></>}
 </>}
 <ConfirmDialog visible={!!confirm} title={confirm==="regenerate"?nativeText("Regenerar códigos"):nativeText("Eliminar passkey")} message={confirm==="regenerate"?nativeText("Los códigos anteriores dejarán de funcionar. Guarda los nuevos al terminar."):nativeText("Eliminar la passkey seleccionada de tu cuenta.")} confirmLabel={nativeText("Confirmar")} cancelLabel={nativeText("Cancelar")} submitting={state.busy} onCancel={()=>setConfirm(null)} onConfirm={()=>void (confirm==="regenerate"?state.regenerate():state.revoke(confirm!)).then(ok=>{if(ok)setConfirm(null);})}/>
 </View>;
}
