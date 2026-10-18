// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ get:vi.fn(), post:vi.fn(), del:vi.fn(), list:vi.fn(), create:vi.fn(), messages:vi.fn(), getChat:vi.fn(), offer:vi.fn(), local:vi.fn(), media:vi.fn(), trackStop:vi.fn(), seen:[] as unknown[] }));
vi.mock("@/lib/api-client", async original => ({...await original<Record<string,unknown>>(), api:{get:m.get,post:m.post,delete:m.del}}));
vi.mock("@/components/floating-assistant/assistant-api", async original => ({...await original<Record<string,unknown>>(),
 assistantAgentsApi:{list:m.list},
 assistantAgentRolesApi:{list:async()=>[]},
 assistantProjectsApi:{list:async()=>[{id:"qa-project-a",title:"Proyecto QA A"},{id:"qa-project-b",title:"Proyecto QA B"}]},
}));
vi.mock("@/components/floating-assistant/assistant-api/conversations", async original => ({...await original<Record<string,unknown>>(),
 assistantConversationsApi:{
 list:async()=>({items:[],total:0}),create:m.create,activity:async()=>[],
 get:m.getChat,
 messages:m.messages,session:async()=>({sessionId:null}),context:async()=>({enabled:false}),markReviewed:async()=>{},
 },
}));
import { useChatPane, type ChatPaneVM } from "@/components/floating-assistant/chat-pane/use-chat-pane";
import { ChatMain } from "@/components/floating-assistant/chat-pane/ChatMain";
import { chatUiState } from "@/components/floating-assistant/chat-ui-state";
import { scopeHeaders, BRIDGE_SESSION_SESSION_KEY, TARGET_SCOPE_SESSION_KEY } from "@/lib/api-client";
const ok = (data:unknown)=>({ok:true,status:200,data});
const agent = {id:"qa-worker",name:"Agente QA",providerId:"claude",model:"",description:"",systemPrompt:"",allowedTools:null,
 capabilities:{canExecute:true},context:{projectId:"qa-project-a",membership:"direct"},execution:{projectId:"qa-project-a",error:null}};
let root:Root,host:HTMLDivElement,vm:ChatPaneVM;
function App(){
 vm=useChatPane({provider:"claude",mode:"api",active:true,voice:{enabled:true,realtimeEnabled:true} as NonNullable<Parameters<typeof useChatPane>[0]["voice"]>});
 return createElement(ChatMain,{vm:{...vm,voiceEnabled:true},attachmentImages:new Map()});
}
const render=()=>act(async()=>root.render(createElement(App)));
function button(label:string){
 const item=[...host.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.getAttribute("aria-label")===label || b.textContent?.trim()===label);
 expect(item,"real button "+label).toBeDefined(); return item!;
}
const deferred=()=>{let resolve!:(v?:unknown)=>void;const promise=new Promise<any>(r=>{resolve=r;});return {resolve,promise};};
const sessionPosts=()=>m.post.mock.calls.filter(([p])=>p==="/api/ai/realtime/sessions");
const actionPosts=()=>m.post.mock.calls.filter(([p])=>p==="/api/ai/agent/permission" || String(p).endsWith("/answer"));
beforeEach(async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.clearAllMocks();m.seen=[];sessionStorage.clear();
 sessionStorage.setItem(TARGET_SCOPE_SESSION_KEY,"qa-target-a");sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY,"qa-session-a");
 document.documentElement.lang="es";
 m.messages.mockResolvedValue({items:[],total:0,hasMore:false});
 m.getChat.mockImplementation(async(id:string)=>({id,provider:"claude",agentId:"qa-worker",projectId:"qa-project-a",title:"QA",messageCount:0,preview:""}));
 m.list.mockResolvedValue([agent]);m.create.mockResolvedValue({id:"qa-chat-a",provider:"claude",projectId:"qa-project-a",agentId:"qa-worker",title:"QA",messageCount:0,preview:""});
 m.get.mockImplementation(async(path:string)=>ok(path.includes("/realtime/conversations/")?{activeId:null}:path.includes("/realtime/sessions/")?{closed:false,events:[
  {seq:1,type:"permission_request",conversationId:"qa-worker-chat",event:{id:"qa-request",tool:"files.write",title:"Aplicar QA"}},
  {seq:2,type:"ask",taskId:"qa-task",askedAt:"qa-time",questions:[{id:"qa-question",type:"single",text:"¿Continuar QA?",options:["Respuesta QA"]}]},
 ]}:{items:[],total:0,tasks:[],runs:[],leader:null}));
 m.post.mockImplementation(async(path:string,body:unknown)=>{m.seen.push({path,body,headers:scopeHeaders(true)});return ok({id:"qa-voice",sdp:"qa-answer"});});
 m.del.mockResolvedValue(ok({ok:true}));
 m.offer.mockResolvedValue({sdp:"qa-offer",type:"offer"});m.local.mockResolvedValue(undefined);
 const track={enabled:true,stop:m.trackStop};m.media.mockResolvedValue({getTracks:()=>[track],getAudioTracks:()=>[track]});
 vi.stubGlobal("navigator",{mediaDevices:{getUserMedia:m.media}});
 vi.stubGlobal("RTCPeerConnection",class{addTrack(){}createDataChannel(){}createOffer=m.offer;setLocalDescription=m.local;async setRemoteDescription(){}close(){}});
 vi.stubGlobal("Audio",class{autoplay=false;srcObject=null;pause(){}async play(){}});
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({ok:true,items:[],tasks:[],runs:[],leader:null}),{headers:{"Content-Type":"application/json"}})));
 chatUiState.patchPane("claude",{activeId:null,currentAgentId:"qa-worker",currentProjectId:"qa-project-a",draft:"",attachments:[]});
 host=document.createElement("div");document.body.append(host);root=createRoot(host);await render();
 await act(async()=>{vm.setActiveId("qa-chat-a");vm.setConvos([{id:"qa-chat-a",provider:"claude",agentId:"qa-worker",projectId:"qa-project-a",title:"QA",messageCount:0,preview:""}]);});
 expect(vm.agentInputBlocked).toBe(false);expect(vm.activeId).toBe("qa-chat-a");
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();sessionStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function start(){await act(async()=>button("Iniciar voz en tiempo real").click());}
async function pendingCatalog(){
 const gate=deferred();m.list.mockReturnValueOnce(gate.promise);
 await act(async()=>window.dispatchEvent(new Event("lxp:assistant:agents-updated")));
 expect(vm.agentInputBlocked).toBe(true);return gate;
}
it.each(["Aprobar","Respuesta QA"])("H2 ChatMain + hook + RealtimeRequests reales: %s bloqueado",async label=>{
 await start();expect(sessionPosts()).toHaveLength(1);expect(button(label).disabled).toBe(false);
 await pendingCatalog();await act(async()=>button(label).click());
 expect(actionPosts()).toEqual([]);expect(button(label).disabled).toBe(true);
 await act(async()=>button("Terminar voz en tiempo real").click());
 expect(m.del).toHaveBeenCalledWith("/api/ai/realtime/sessions/qa-voice");
});
it.each(["createOffer","setLocalDescription"] as const)("H1 ChatMain real: pérdida persistente en %s bloquea POST",async step=>{
 const gate=deferred();(step==="createOffer"?m.offer:m.local).mockReturnValueOnce(gate.promise);
 await start();expect(step==="createOffer"?m.offer:m.local).toHaveBeenCalledTimes(1);
 await pendingCatalog();await act(async()=>gate.resolve(step==="createOffer"?{sdp:"qa-offer",type:"offer"}:undefined));
 expect(sessionPosts()).toEqual([]);
});
it.each(["createOffer","setLocalDescription"] as const)("H1 ChatMain real: recarga y readmisión en %s no reviven intento",async step=>{
 const sdp=deferred();(step==="createOffer"?m.offer:m.local).mockReturnValueOnce(sdp.promise);
 await start();expect(step==="createOffer"?m.offer:m.local).toHaveBeenCalledTimes(1);
 const catalog=await pendingCatalog();await act(async()=>catalog.resolve([agent]));expect(vm.agentInputBlocked).toBe(false);
 await act(async()=>sdp.resolve(step==="createOffer"?{sdp:"qa-offer",type:"offer"}:undefined));
 expect(sessionPosts()).toEqual([]);
});
it("H1 ChatMain real: nueva sesión del mismo target no recupera SDP anterior",async()=>{
 const sdp=deferred();m.offer.mockReturnValueOnce(sdp.promise);await start();expect(m.offer).toHaveBeenCalledTimes(1);
 const catalog=deferred();m.list.mockReturnValueOnce(catalog.promise);
 sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY,"qa-session-b");await render();expect(vm.agentInputBlocked).toBe(true);
 await act(async()=>catalog.resolve([agent]));expect(vm.agentInputBlocked).toBe(false);
 await act(async()=>sdp.resolve({sdp:"qa-offer",type:"offer"}));
 expect(m.seen).toEqual([]);expect(sessionPosts()).toEqual([]);
});

it.each(["createOffer","setLocalDescription"] as const)("Contexto: navegación real a otro proyecto durante %s descarta intento anterior",async step=>{
 const sdp=deferred();(step==="createOffer"?m.offer:m.local).mockReturnValueOnce(sdp.promise);
 await start();expect(step==="createOffer"?m.offer:m.local).toHaveBeenCalledTimes(1);
 await act(async()=>vm.looseTreeActions.onNewProjectChat("qa-project-b"));
 expect(vm.currentProjectId).toBe("qa-project-b");expect(vm.activeId).toBeNull();
 await act(async()=>vm.looseTreeActions.onNewProjectChat("qa-project-a"));
 expect(vm.currentProjectId).toBe("qa-project-a");
 await act(async()=>sdp.resolve(step==="createOffer"?{sdp:"qa-offer",type:"offer"}:undefined));
 expect(sessionPosts()).toEqual([]);
});

it.each(["createOffer", "setLocalDescription"] as const)("ChatMain real: un NUEVO clic tras readmisión inicia voz y descarta el %s anterior", async step => {
 const sdp=deferred(); (step==="createOffer"?m.offer:m.local).mockReturnValueOnce(sdp.promise);
 await start();
 const catalog=await pendingCatalog(); await act(async()=>catalog.resolve([agent]));
 expect(vm.agentInputBlocked).toBe(false);
 await start(); expect(sessionPosts()).toHaveLength(1);
 await act(async()=>sdp.resolve(step==="createOffer"?{sdp:"qa-offer",type:"offer"}:undefined));
 expect(sessionPosts()).toHaveLength(1);
 expect(button("Terminar voz en tiempo real")).toBeDefined();
 await act(async()=>button("Terminar voz en tiempo real").click());
 expect(m.del).toHaveBeenCalledTimes(1);
});

it("ChatMain real: el nuevo contexto de sesión admite un clic nuevo sin rescatar el SDP anterior", async()=>{
 const sdp=deferred(); m.offer.mockReturnValueOnce(sdp.promise); await start();
 const catalog=deferred(); m.list.mockReturnValueOnce(catalog.promise);
 sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY,"qa-session-b"); await render();
 await act(async()=>catalog.resolve([agent])); expect(vm.agentInputBlocked).toBe(false);
 await start(); expect(sessionPosts()).toHaveLength(1);
 await act(async()=>sdp.resolve({sdp:"qa-offer",type:"offer"}));
 expect(sessionPosts()).toHaveLength(1);
 expect(button("Terminar voz en tiempo real")).toBeDefined();
});

it("ChatMain real: error del catálogo conserva Terminar y bloquea Aprobar y respuesta", async()=>{
 await start(); m.list.mockRejectedValueOnce(new Error("catalog unavailable"));
 await act(async()=>window.dispatchEvent(new Event("lxp:assistant:agents-updated")));
 expect(vm.agentInputBlocked).toBe(true);
 for(const label of ["Aprobar","Aprobar y no preguntar más","Respuesta QA"]) {
  expect(button(label).disabled).toBe(true); await act(async()=>button(label).click());
 }
 expect(actionPosts()).toEqual([]);
 await act(async()=>button("Terminar voz en tiempo real").click());
 expect(m.del).toHaveBeenCalledWith("/api/ai/realtime/sessions/qa-voice");
 expect(m.trackStop).toHaveBeenCalled();
});

it("ChatMain real: la creación autorizada adopta su conversación y continúa el inicio de voz", async()=>{
 m.create.mockResolvedValue({id:"qa-created",provider:"claude",agentId:"qa-worker",projectId:"qa-project-a",title:"QA",messageCount:0,preview:""});
 await act(async()=>vm.newConversation({preserveAgent:true}));
 expect(vm.activeId).toBeNull(); expect(vm.agentInputBlocked).toBe(false);
 const messages=deferred(), meta=deferred();
 m.messages.mockReturnValue(messages.promise); m.getChat.mockReturnValue(meta.promise);
 await start();
 expect(m.create).toHaveBeenCalledTimes(1); expect(vm.activeId).toBe("qa-created");
 expect(vm.agentInputBlocked).toBe(false);
 expect(sessionPosts()).toEqual([]);
 await act(async()=>{messages.resolve({items:[],total:0,hasMore:false});meta.resolve({id:"qa-created",provider:"claude",agentId:"qa-worker",projectId:"qa-project-a",title:"QA",messageCount:0,preview:""});});

 expect(sessionPosts()).toHaveLength(1);
 expect(sessionPosts()[0][1]).toEqual({conversationId:"qa-created",sdp:"qa-offer"});
 expect(button("Terminar voz en tiempo real")).toBeDefined();
});

it("ChatMain real: la creación tardía de conversación no se abre en la sesión nueva", async()=>{
 const created=deferred(); m.create.mockReturnValueOnce(created.promise);
 await act(async()=>vm.newConversation({preserveAgent:true})); await start();
 expect(m.create).toHaveBeenCalledTimes(1);
 sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY,"qa-session-b"); await render();
 expect(vm.agentInputBlocked).toBe(false);
 m.messages.mockClear();
 await act(async()=>created.resolve({id:"qa-created-late",provider:"claude",agentId:"qa-worker",projectId:"qa-project-a",title:"QA",messageCount:0,preview:""}));
 expect(vm.activeId).toBeNull(); expect(m.messages).not.toHaveBeenCalled();
 expect(sessionPosts()).toEqual([]);
});
