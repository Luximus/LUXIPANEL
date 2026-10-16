import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {beforeEach,afterEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),del:vi.fn(),media:vi.fn(),scope:"host",track:{enabled:true,stop:vi.fn()}}));
vi.mock("@/lib/api-client",()=>({api:{get:m.get,post:m.post,delete:m.del},unwrap:(v:any)=>v,resolveTargetScope:()=>m.scope}));
import {useRealtimeVoice} from "./use-realtime-voice";
import {chatInputLocked} from "../chat-engine/input-lock";
let hook:ReturnType<typeof useRealtimeVoice>,root:Root,host:HTMLDivElement;
let options={enabled:true,chatKey:"chat",conversationId:"chat",ensureConversation:vi.fn(async()=>"chat"),refresh:vi.fn(async()=>{})};
function Harness(){hook=useRealtimeVoice(options);return createElement("div",null,null);}
beforeEach(async()=>{
 vi.clearAllMocks();m.scope="host";m.track.enabled=true;
 options={enabled:true,chatKey:"chat",conversationId:"chat",ensureConversation:vi.fn(async()=>"chat"),refresh:vi.fn(async()=>{})};
 m.get.mockImplementation(async(path:string)=>path.includes("/conversations/")?{ok:true,activeId:null}:{ok:true,closed:false,events:[]});
 m.post.mockResolvedValue({ok:true,id:"voice",sdp:"answer"});m.del.mockResolvedValue({ok:true});
 m.media.mockResolvedValue({getTracks:()=>[m.track],getAudioTracks:()=>[m.track]});
 vi.stubGlobal("navigator",{mediaDevices:{getUserMedia:m.media}});
 vi.stubGlobal("RTCPeerConnection",class {addTrack(){}createDataChannel(){}async createOffer(){return {sdp:"offer"};}async setLocalDescription(){}async setRemoteDescription(){}close(){}});
 vi.stubGlobal("Audio",class {autoplay=false;srcObject=null;pause(){}async play(){}});
 host=document.createElement("div");document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(createElement(Harness)));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it("starts directly from the existing microphone, without selection or a second confirmation",async()=>{
 expect(host.querySelector("select")).toBeNull();expect(host.textContent).toBe("");
 await act(async()=>hook.toggle());
 expect(m.media).toHaveBeenCalledOnce();
 expect(m.post).toHaveBeenCalledWith("/api/ai/realtime/sessions",{conversationId:"chat",sdp:"offer"});
 expect(host.querySelector("select")).toBeNull();expect(host.textContent).not.toMatch(/Proyectos|Equipos|Iniciar conversación/);
 expect(chatInputLocked("chat")).toBe(true);
 await act(async()=>hook.toggle());expect(chatInputLocked("chat")).toBe(false);
});
it("prevents duplicate starts while obtaining microphone permission",async()=>{
 let ready!:(value:any)=>void;m.media.mockReturnValue(new Promise(resolve=>{ready=resolve;}));
 let first!:Promise<void>;
 await act(async()=>{first=hook.toggle();});
 await act(async()=>hook.toggle()); // same button stops the in-flight start
 ready({getTracks:()=>[m.track],getAudioTracks:()=>[m.track]});
 await act(async()=>first);
 expect(m.post).not.toHaveBeenCalled();expect(m.track.stop).toHaveBeenCalled();
 expect(chatInputLocked("chat")).toBe(false);
});

it("closes on a new blank chat and never navigates back while refreshing",async()=>{
 await act(async()=>hook.toggle()); options={...options,chatKey:"new:2",conversationId:null as any};
 await act(async()=>root.render(createElement(Harness)));
 expect(hook.active).toBe(false);expect(hook.error).toBe("");expect(hook.asks).toEqual([]);
 expect(m.track.stop).toHaveBeenCalled();expect(options.refresh).toHaveBeenCalledWith("chat","chat");
 expect(m.post.mock.calls.some(c=>String(c[0]).includes("/cancel"))).toBe(false);
});
it("cleans a late created remote session without contaminating another chat",async()=>{
 let ready!:(v:any)=>void;m.post.mockReturnValue(new Promise(r=>{ready=r;}));let pending!:Promise<void>;
 await act(async()=>{pending=hook.toggle();});options={...options,chatKey:"other",conversationId:"other"};
 await act(async()=>root.render(createElement(Harness)));ready({id:"late",sdp:"answer"});await act(async()=>pending);
 expect(m.del).toHaveBeenCalledWith("/api/ai/realtime/sessions/late");expect(hook.active).toBe(false);expect(hook.error).toBe("");
});
it("adopts the id of a newly created chat without stopping its voice",async()=>{
 options={...options,chatKey:"new:1",conversationId:null as any,ensureConversation:vi.fn(async(accept?:any)=>{
   expect(accept("created")).toBe(true);options={...options,chatKey:"created",conversationId:"created"};
   root.render(createElement(Harness));return "created";
 })};
 await act(async()=>root.render(createElement(Harness)));
 await act(async()=>hook.toggle());expect(hook.active).toBe(true);expect(chatInputLocked("created")).toBe(true);
 expect(m.del).not.toHaveBeenCalled();
});
it("refreshes persisted transcripts once through history and retains button requests after stopping",async()=>{
 m.get.mockImplementation(async(path:string)=>path.includes("/conversations/")?{activeId:null}:{closed:false,events:[
 {seq:1,type:"transcript",role:"user",text:"Hola"},{seq:2,type:"permission_request",conversationId:"worker",event:{id:"request",title:"Ejecutar"}},
 {seq:3,type:"ask",taskId:"task",askedAt:"when",questions:[{type:"single",options:["Aprobar"]}]}
 ]});
 await act(async()=>hook.toggle());expect(host.textContent).toBe("");expect(options.refresh).toHaveBeenCalledWith("chat","chat");
 await act(async()=>hook.toggle());expect(hook.permissions).toHaveLength(1);expect(hook.asks).toHaveLength(1);
 await act(async()=>hook.permission(hook.permissions[0],"allow"));
 expect(m.post).toHaveBeenCalledWith("/api/ai/agent/permission",{conversationId:"worker",requestId:"request",decision:"allow"});
 expect(hook.permissions).toHaveLength(0);
 await act(async()=>hook.answer(hook.asks[0],0));
 expect(m.post).toHaveBeenCalledWith("/api/ai/realtime/sessions/voice/answer",{taskId:"task",askedAt:"when",choice:0});
 expect(hook.asks).toHaveLength(0);
});
it("discards a failed old poll after switching chats",async()=>{
 let reject!:(e:any)=>void;m.get.mockImplementation((p:string)=>p.includes("/conversations/")?Promise.resolve({activeId:null}):new Promise((_,r)=>{reject=r;}));
 await act(async()=>hook.toggle());options={...options,chatKey:"other",conversationId:"other"};
 await act(async()=>root.render(createElement(Harness)));await act(async()=>reject(new Error("old")));
 expect(hook.error).toBe("");expect(hook.active).toBe(false);
});
it("does not send the old session through a different server",async()=>{
 await act(async()=>hook.toggle());m.scope="other-server";
 await act(async()=>root.render(createElement(Harness)));
 expect(m.del).not.toHaveBeenCalled();expect(m.track.stop).toHaveBeenCalled();expect(hook.active).toBe(false);
});
