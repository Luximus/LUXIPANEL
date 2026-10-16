import React, {useEffect, useState} from "react";
import {Pressable, Text, View} from "react-native";
import {useRealtimeVoiceState} from "../../features/assistant/realtime-voice";
import {chatController} from "../../features/assistant/chat-controller";
import {PermissionView} from "./PermissionView";
import {turnBoxStyles} from "./turn-box.styles";
import type {ThemeTokens} from "../../theme/colors";
import type {AssistantStrings} from "./types";
function Action({label, action, tokens}: {label:string; action:()=>Promise<unknown>; tokens:ThemeTokens}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  return <View><Pressable accessibilityRole="button" disabled={busy} style={{paddingVertical:8, opacity:busy?0.5:1}}
    onPress={()=>{setBusy(true);setError("");void action().catch(()=>setError("No se pudo completar la acción.")).finally(()=>setBusy(false));}}>
    <Text style={{color:tokens.brand,fontSize:13}}>{label}</Text>
  </Pressable>{error?<Text accessibilityRole="alert" style={{color:tokens.danger}}>{error}</Text>:null}</View>;
}
/** Render actual delegated work in history, never an idle voice panel or a second transcript. */
export function RealtimeActivity({panelId,conversationId,tokens,t}: {
  panelId:string; conversationId:string|null; tokens:ThemeTokens; t:AssistantStrings;
}) {
  const state=useRealtimeVoiceState();
  const own=state?.panelId===panelId&&state.conversationId===conversationId?state:null;
  const [snapshot,setSnapshot]=useState<{panelId:string;id:string;tasks:any[]} | null>(null);
  const [resolved,setResolved]=useState<string[]>([]);
  const seq=own?.events.at(-1)?.seq??0;
  useEffect(()=>{setResolved([]);},[panelId,conversationId]);
  useEffect(()=>{
    if(!conversationId)return;
    let canceled=false,timer:ReturnType<typeof setTimeout>;
    async function load(){
      try{
        const data=await chatController.realtimeTasks(panelId,conversationId!);
        if(canceled)return;
        if(data?.tasks)setSnapshot({panelId,id:conversationId!,tasks:data.tasks});
        if(data?.tasks?.some((x:any)=>["pending","running"].includes(x.state))||own?.phase&&own.phase!=="idle")
          timer=setTimeout(()=>void load(),3000);
      }catch{if(!canceled)timer=setTimeout(()=>void load(),5000);}
    }
    void load();
    return()=>{canceled=true;clearTimeout(timer);};
  },[panelId,conversationId,seq,own?.phase]);
  useEffect(()=>{
    if(own&&(own.events.some(e=>e.type==="transcript")||own.phase==="idle"))void chatController.reloadMessages(panelId);
  },[panelId,conversationId,seq,own?.phase]);
  const tasks=snapshot?.panelId===panelId&&snapshot.id===conversationId?snapshot.tasks:[];
  const permissions=new Map<string,any>(),asks=new Map<string,any>();
  for(const e of own?.events??[]){
    if(e.type==="permission_request")permissions.set(e.event.id,e);
    if(e.type==="permission_resolved")permissions.delete(e.event.id);
    if(e.type==="ask")asks.set(e.taskId,e);
    if(e.type==="ask_resolved")asks.delete(e.taskId);
  }
  async function checked(result:Promise<{ok:boolean}|null>){if(!(await result)?.ok)throw new Error("La solicitud ya no está disponible.");}
  return <>
    {tasks.map(task=><View key={task.taskId} style={[turnBoxStyles.turnBox,{borderColor:tokens.border,backgroundColor:tokens.bgInput}]}>
      <Text style={{color:tokens.textPrimary,fontWeight:"600"}}>{task.title}</Text>
      <Text style={{color:tokens.textMuted,fontSize:12}}>{task.pendingPermission?"Necesita tu aprobación":({pending:"Pendiente",running:"En curso",done:"Completada",failed:"Falló",canceled:"Cancelada"} as Record<string,string>)[task.state]??task.state}</Text>
      {task.error?<Text style={{color:tokens.danger}}>{task.error}</Text>:null}
      <Pressable accessibilityRole="button" onPress={()=>chatController.openConversation(panelId,task.childConversationId)} style={{paddingVertical:8}}>
        <Text style={{color:tokens.brand,fontSize:13}}>Abrir conversación de la tarea</Text>
      </Pressable>
      {["pending","running"].includes(task.state)?<Action label="Cancelar tarea" tokens={tokens} action={()=>checked(chatController.cancelRealtimeTask(panelId,task.taskId))}/>:null}
    </View>)}
    {[...asks.values()].filter(e=>!resolved.includes(e.taskId+e.askedAt)).map(e=><View key={e.taskId+e.askedAt} style={[turnBoxStyles.turnBox,{borderColor:tokens.border,backgroundColor:tokens.bgInput}]}>
      {e.content?<Text selectable style={{color:tokens.textPrimary}}>{e.content}</Text>:null}
      {e.questions.length===1&&e.questions[0].type==="single"?<>
        <Text style={{color:tokens.textPrimary}}>{e.questions[0].text}</Text>
        {e.questions[0].options.map((label:string,i:number)=><Action key={i} label={label} tokens={tokens} action={async()=>{
          if(!own?.sessionId)throw new Error("Sesión no disponible.");
          await checked(chatController.realtimeAnswer(panelId,own.sessionId,e.taskId,e.askedAt,i));
          setResolved(v=>[...v,e.taskId+e.askedAt]);
        }}/>)}
      </>:<Text style={{color:tokens.textPrimary}}>Abre la conversación de la tarea para responder.</Text>}
    </View>)}
    {[...permissions.values()].filter(e=>!resolved.includes(e.event.id)).map(e=><PermissionView key={e.event.id} request={e.event} interactive t={t} tokens={tokens}
      onDecide={async decision=>{await checked(chatController.realtimePermission(panelId,e.conversationId,e.event.id,decision));setResolved(v=>[...v,e.event.id]);}}/>)}
  </>;
}
