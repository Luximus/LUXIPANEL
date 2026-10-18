// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatPane, type ChatPaneVM } from "./use-chat-pane";
import { ChatMain } from "./ChatMain";
import { chatUiState } from "../chat-ui-state";
import { chatEngine } from "../chat-engine";
import type { TurnView } from "./turn-view";
import type { AssistantAgent } from "../assistant-api";
import type { useRealtimeVoice } from "./use-realtime-voice";

const m = vi.hoisted(() => ({ list:vi.fn(), create:vi.fn(), approval:vi.fn(), toggle:vi.fn(),
 voiceActive:false, voiceOptions:null as Parameters<typeof useRealtimeVoice>[0] | null,
 turn:null as Parameters<typeof TurnView>[0] | null }));
vi.mock("./turn-view", () => ({TurnView:(props:Parameters<typeof TurnView>[0]) => {
 if(props.turn.role==="assistant") m.turn=props;
 return createElement("span",null,props.turn.text);
}}));
vi.mock("./use-realtime-voice", () => ({useRealtimeVoice:(opts:Parameters<typeof useRealtimeVoice>[0]) => {
 const [active,setActive]=useState(m.voiceActive);
 m.voiceOptions=opts;
 return {active,phase:active?"live":"idle",toggle:()=>{m.toggle();setActive(!active);},toggleMuted:vi.fn(),permissions:[],asks:[]};
}}));
vi.mock("../assistant-api", async original => ({...await original<Record<string,unknown>>(),
 assistantProjectsApi:{list:async()=>[{id:"child",title:"Proyecto"}]},
 assistantAgentsApi:{list:m.list},
 assistantAgentRolesApi:{list:async()=>[]},
}));
vi.mock("../assistant-api/conversations", async original => ({...await original<Record<string,unknown>>(),
 assistantConversationsApi:{
 list:async()=>({items:[],total:0}), create:m.create, activity:async()=>[],
 get:async(id:string)=>({id,provider:"claude",agentId:"worker",projectId:id==="historical"?null:"child",title:"History",messageCount:0,preview:""}), messages:async()=>({items:[],total:0,hasMore:false}),
 session:async()=>({sessionId:null}),context:async()=>({enabled:false}),markReviewed:async()=>{},
 },
}));
const agent = {id:"worker",name:"Agente",providerId:"claude",model:"",description:"",systemPrompt:"",allowedTools:null,
 capabilities:{canExecute:true},context:{projectId:"child",membership:"direct"},execution:{projectId:"child",error:null}} as AssistantAgent;
const attachment={name:"contexto.txt",mimeType:"text/plain",dataBase64:"YQ=="};
let root:Root,host:HTMLDivElement,vm:ChatPaneVM;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.clearAllMocks();m.turn=null;m.voiceActive=false;
 m.list.mockResolvedValue([agent]);
 m.create.mockResolvedValue({id:"unexpected-chat",provider:"claude",projectId:"child",agentId:"worker"});
 m.approval.mockResolvedValue(true);
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({ok:true,items:[],tasks:[],runs:[],leader:null}),{headers:{"Content-Type":"application/json"}})));
 chatUiState.patchPane("claude",{activeId:null,currentAgentId:"worker",currentProjectId:"child",draft:"Conservar borrador",attachments:[attachment]});
 host=document.createElement("div");document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
function Probe(){
 vm=useChatPane({provider:"claude",mode:"api",active:true,onApprovalModeChange:m.approval,
 voice:{realtimeEnabled:true,enabled:true} as NonNullable<Parameters<typeof useChatPane>[0]["voice"]>});
 return createElement(ChatMain,{vm:{...vm,voiceEnabled:true},attachmentImages:new Map()});
}
async function mount(){await act(async()=>root.render(createElement(Probe)));}
it("retains the active voice stop control while catalog reload is loading and fails",async()=>{
 m.voiceActive=true;await mount();
 let reject!:(error:unknown)=>void;
 m.list.mockReturnValueOnce(new Promise((_yes,no)=>{reject=no;}));
 await act(async()=>window.dispatchEvent(new Event("lxp:assistant:agents-updated")));
 expect(m.voiceOptions?.enabled).toBe(true);
 expect(host.querySelector('[aria-label="Terminar voz en tiempo real"]')).not.toBeNull();
 await act(async()=>reject(new Error("catalog unavailable")));
 const stop=host.querySelector<HTMLButtonElement>('[aria-label="Terminar voz en tiempo real"]');
 expect(stop).not.toBeNull();
 await act(async()=>stop!.click());
 expect(m.toggle).toHaveBeenCalledTimes(1);
 expect(host.querySelector('[aria-label="Iniciar voz en tiempo real"]')).toBeNull();
 expect(vm.draft).toBe("Conservar borrador");expect(vm.attachments).toEqual([attachment]);
});
it.each(["removed","loading","error","null-history"])("blocks every send path without touching draft/history (%s)",async state=>{
 if(state==="removed") m.list.mockResolvedValue([{...agent,capabilities:{canExecute:false},context:{projectId:"child",membership:"removed"}}]);
 if(state==="loading") m.list.mockReturnValue(new Promise(()=>{}));
 if(state==="error") m.list.mockRejectedValue(new Error("offline"));
 const send=vi.spyOn(chatEngine,"send").mockResolvedValue(undefined);
 const pop=vi.spyOn(chatEngine,"popTurns");
 await mount();
 // Historical binding with null must not inherit the sidebar's project.
 if(state==="null-history"){
   await act(async()=>{vm.setActiveId("historical");vm.setConvos([{id:"historical",title:"History",provider:"claude",agentId:"worker",projectId:null,messageCount:0,preview:""}]);});
 }
 const suggestion=host.querySelector<HTMLButtonElement>(".lxp-chat-start-actions button")!;
 expect(suggestion).not.toBeNull();
 await act(async()=>suggestion.click());
 await act(async()=>vm.send("envío directo"));
 await act(async()=>vm.send(undefined,{queue:true}));
 await act(async()=>vm.send("",{attachmentsOverride:[{...attachment,voice:true}]}));
 expect(m.create).not.toHaveBeenCalled();
 expect(send).not.toHaveBeenCalled();
 expect(vm.draft).toBe("Conservar borrador");expect(vm.attachments).toEqual([attachment]);
 await act(async()=>chatEngine.seed(vm.chatKey,"claude",vm.activeId,[
   {role:"user",text:"Pregunta",tools:[],createdAt:1},{role:"assistant",text:"Respuesta previa",stopped:true,tools:[],createdAt:2},
 ]));
 await vi.waitFor(()=>expect(m.turn).not.toBeNull());
 await act(async()=>{
   m.turn?.onRetry?.();
   await m.turn?.onAnswer?.("respuesta");
   await m.turn?.onAnswer?.("aprobar",{planDecision:"approve"});
 });
 expect(m.approval).not.toHaveBeenCalled();
 expect(send).not.toHaveBeenCalled();expect(pop).not.toHaveBeenCalled();
 expect(m.create).not.toHaveBeenCalled();
 expect(vm.draft).toBe("Conservar borrador");expect(vm.attachments).toEqual([attachment]);
 expect(chatEngine.get(vm.chatKey)?.turns.map(turn=>turn.text)).toEqual(["Pregunta","Respuesta previa"]);
});
