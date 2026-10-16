import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, TextInput } from "react-native";
import { PanelText as Text } from "../ui/PanelText";
import { getThemeTokens } from "../../theme/colors";
import { callServerApi } from "../../api/serverApi";
import { githubCopy } from "../../i18n/github-connection";
export interface GithubStatus {required:boolean;connected:boolean;login?:string;deviceFlowAvailable:boolean}
type Device={id:string;userCode:string;url:string;expiresAt:number;intervalMs:number};
export function GithubConnectionScreen({serverId,language,dark,status,onConnected,onLogout}:{serverId:string;language:string;dark:boolean;status:GithubStatus;onConnected:(s:GithubStatus)=>void;onLogout:()=>void}) {
 const t=githubCopy(language),c=getThemeTokens(dark),[token,setToken]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[device,setDevice]=useState<Device|null>(null);
 useEffect(()=>{if(!device)return;let active=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{if(!active)return;if(Date.now()>=device.expiresAt){setDevice(null);setError(t.failed);return;}
   const r=await callServerApi<{data?:{pending:boolean;status?:GithubStatus}}>(serverId,"","POST","/api/auth/github/device/poll",{id:device.id});
   if(!active)return;if(!r.ok){setError(r.error||t.failed);setDevice(null);return;}
   if(r.data?.data?.status){onConnected(r.data.data.status);setDevice(null);return;}
   timer=setTimeout(poll,device.intervalMs);
  };timer=setTimeout(poll,device.intervalMs);return()=>{active=false;clearTimeout(timer);};
 },[device,serverId,onConnected,t.failed]);
 const connect=async()=>{if(busy||!token.trim())return;setBusy(true);setError("");try{const r=await callServerApi<{data?:GithubStatus}>(serverId,"","POST","/api/auth/github",{token:token.trim()});if(!r.ok||!r.data?.data)throw Error(r.error||t.failed);setToken("");onConnected(r.data.data);}catch(e){setError(e instanceof Error?e.message:t.failed);}finally{setBusy(false);}};
 const start=async()=>{setBusy(true);setError("");try{const r=await callServerApi<{data?:Device}>(serverId,"","POST","/api/auth/github/device");if(!r.ok||!r.data?.data)throw Error(r.error||t.failed);setDevice(r.data.data);await Linking.openURL(r.data.data.url);}catch(e){setError(e instanceof Error?e.message:t.failed);}finally{setBusy(false);}};
 const button={minHeight:48,borderRadius:12,padding:16,backgroundColor:c.brandDim,justifyContent:"center" as const,alignItems:"center" as const};
 return <ScrollView contentContainerStyle={{flexGrow:1,justifyContent:"center",padding:24,gap:16}} keyboardShouldPersistTaps="handled">
  <Text accessibilityRole="header" style={{fontSize:26,fontWeight:"700",color:c.textPrimary}}>{t.title}</Text>
  <Text style={{color:c.textSecondary,lineHeight:23}}>{t.description}</Text>
  {status.deviceFlowAvailable&&<Pressable accessibilityRole="button" disabled={busy} style={button} onPress={()=>void start()}><Text style={{color:c.textPrimary}}>{t.browser}</Text></Pressable>}
  {device&&<><Text style={{color:c.textSecondary}}>{t.waiting}</Text><Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(device.url)}><Text selectable style={{color:c.textPrimary,fontSize:26,fontWeight:"700",textAlign:"center"}}>{device.userCode}</Text></Pressable></>}
  <Text style={{color:c.textPrimary}}>{t.token}</Text>
  <TextInput accessibilityLabel={t.token} value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={4096} style={{minHeight:48,borderWidth:1,borderColor:c.border,borderRadius:12,padding:12,color:c.textPrimary}} />
  <Text style={{color:c.textSecondary,fontSize:13}}>{t.tokenHelp}</Text>
  <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL("https://github.com/settings/tokens")}><Text style={{color:c.textPrimary,textDecorationLine:"underline"}}>GitHub ↗</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={busy||!token.trim()} style={[button,{opacity:busy||!token.trim()?0.5:1}]} onPress={()=>void connect()}><Text style={{color:c.textPrimary}}>{t.connect}</Text></Pressable>
  {!!error&&<Text accessibilityRole="alert" style={{color:c.danger}}>{error}</Text>}
  <Pressable accessibilityRole="button" style={button} onPress={onLogout}><Text style={{color:c.textPrimary}}>{t.logout}</Text></Pressable>
 </ScrollView>;
}
