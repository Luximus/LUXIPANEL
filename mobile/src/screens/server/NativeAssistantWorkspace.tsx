import { nativeText } from '../../i18n/native-text';
import React, { useContext, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, View } from "react-native";
import { NativeModuleContext } from "../main/native-module-context";
import { ChatScreen } from "../ChatScreen";
import { ModuleSettingsDrawer } from "../../components/ui/ModuleSettingsDrawer";
import { AssistantSettingsTab } from "../../components/assistant-settings/AssistantSettingsTab";
import { ConversationsDrawer } from "../../components/assistant/drawer/ConversationsDrawer";
import { strings } from "../../components/assistant/strings";
import { NativeModuleHeader } from "../../components/server/NativeModuleHeader";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { useAssistantSession } from "../../features/assistant/hooks";
import { chatController } from "../../features/assistant/chat-controller";
import { chatStore } from "../../features/assistant/chat-store";
import { loadSessionState } from "../../lib/session-state";
import { NativeTerminalScreen } from "./NativeTerminalScreen";
import { NativeAssistantProjects } from "./NativeAssistantProjects";
import { NativeAssistantConnectors } from "./NativeAssistantConnectors";

/** Full native assistant: shared persistent chat, history, projects, teams and settings. */
export function NativeAssistantWorkspace({panelId,token,onBack}:{panelId:string;token:string;onBack:()=>void}) {
  const moduleContext=useContext(NativeModuleContext);
  const colors=getThemeTokens(useTheme().theme==="dark");const language=loadSessionState().language;
  const effectiveToken=token||"direct-session";
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [tab,setTab]=useState("chat");const [visited,setVisited]=useState(new Set(["chat"]));
  const shift=useRef(new Animated.Value(0)).current;const session=useAssistantSession(panelId);
  const select=(next:string)=>{if(next==="settings"){setSettingsOpen(true);return;}setVisited(current=>new Set([...current,next]));setTab(next);};
  const backToChat=()=>{setSettingsOpen(false);select("chat");};const props={panelId,token:effectiveToken};
  return <KeyboardAvoidingView behavior={Platform.OS==="ios" && tab!=="terminal"?"padding":undefined} style={{flex:1,backgroundColor:colors.bgPrimary}}>
    <NativeModuleHeader title={language.startsWith("es") ? nativeText("Asistente") : nativeText("Assistant")} onClose={onBack} onSettings={()=>setSettingsOpen(true)}
      tabs={[{key:"chat",get label() { return nativeText("Chat"); }},{key:"history",label:language.startsWith("es")?nativeText("Historial"):nativeText("History")},{key:"projects",label:language.startsWith("es")?nativeText("Proyectos"):nativeText("Projects")},{key:"connectors",label:language.startsWith("es")?nativeText("Conectores"):nativeText("Connectors")},{key:"terminal",get label() { return nativeText("Terminal"); }}]}
      activeTab={tab} onTabChange={select}/>

    <View style={[{flex:1},tab!=="chat"&&{display:"none"}]}><ChatScreen {...props} language={language} onBack={onBack} onNewTerminal={()=>select("terminal")} keyboardShift={shift}/></View>
    <ModuleSettingsDrawer visible={settingsOpen} onClose={()=>setSettingsOpen(false)} title={language.startsWith("es")?nativeText("Ajustes del asistente"):nativeText("Assistant settings")} language={language}><AssistantSettingsTab {...props} language={language} onOpenChat={backToChat} onCloseDrawer={()=>setSettingsOpen(false)}/></ModuleSettingsDrawer>
    {visited.has("history")?<View style={[{flex:1},tab!=="history"&&{display:"none"}]}><ConversationsDrawer {...props} t={strings(language)} tokens={colors} activeId={session.conversationId} fill onOpen={id=>{chatController.openConversation(panelId,id);backToChat();}} onNew={()=>{chatController.newConversation(panelId);backToChat();}} onNewInProject={projectId=>{chatController.newConversation(panelId,{projectId});backToChat();}} onDeleted={id=>{if(session.conversationId===id)chatController.newConversation(panelId);}} onPickAgent={agent=>{if(agent.providerId)chatController.setProvider(panelId,agent.providerId);chatStore.patchSession(panelId,{agentId:agent.id,agentName:agent.name});chatController.newConversation(panelId);backToChat();}}/></View>:null}
    {visited.has("projects")?<View style={[{flex:1},tab!=="projects"&&{display:"none"}]}><NativeAssistantProjects {...props} onBack={backToChat}/></View>:null}
    {visited.has("connectors")?<View style={[{flex:1},tab!=="connectors"&&{display:"none"}]}><NativeAssistantConnectors {...props} onBack={backToChat}/></View>:null}
    {visited.has("terminal")?<View style={[{flex:1},tab!=="terminal"&&{display:"none"}]}><NativeModuleContext.Provider value={moduleContext ? {...moduleContext,visible:moduleContext.visible && tab==="terminal" && !settingsOpen}:null}><NativeTerminalScreen {...props} onBack={backToChat}/></NativeModuleContext.Provider></View>:null}
  </KeyboardAvoidingView>;
}
